// Data layer: everything the screens read or write goes through here.
//
// Records (IndexedDB stores):
//   categories { id, name, nameEs?, color, order }
//   exercises  { id, name, nameEs?, categoryId, rest?, note?, type? }   rest = seconds; type 'bodyweight' → weight = extra kg
//   sets       { id, exerciseId, date:'YYYY-MM-DD', weight (kg), reps, t (ordering ms), comment?, done? }
//              done === false → planned (not yet completed). Missing = completed (v1 data, imports).
//   sessions   { date, routineId?, mood?, motivation?, satisfaction?, note?, finishedAt? }
//   routines   { id, name, exercises: [{ id, sets, reps? }], items: [exerciseId] }   items = ids, kept in sync (v1)
//              group?, order?   → several routines with the same group = one routine with days
//   bodyweight { date, kg }
//   settings   { k, v }
import * as db from './db.js';
import { SEED_CATEGORIES, SEED_EXERCISES, PALETTE } from './seed.js';
import { uid, norm, parseISODate, toISODate, wkey } from './util.js';
import { getLang, t, fmtNum, fmtSet } from './i18n.js';
import { checkPR } from './stats.js';
import { toCSV } from './csv.js';

export const DEFAULTS = {
  lang: 'en', theme: 'dark', accent: 'blaze', rest: 90, step: 2.5,
  sound: true, vibrate: true, wake: true, timerOnComplete: true,
  barWeight: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  lastBackup: 0, backupDays: 7, backupSnooze: 0,
};
export const DEFAULT_ROUTINE_SETS = 3;
export const isDone = s => s.done !== false;
export const doneOnly = list => list.filter(isDone);
export const settings = { ...DEFAULTS };
export let categories = [];
export let exercises = [];
export let routines = [];
let exMap = new Map(), catMap = new Map();
let anySets = false;

export async function init() {
  for (const r of await db.getAll('settings')) settings[r.k] = r.v;
  if (!settings.seeded) await seed();
  await reload();
  await bodyweights();
  anySets = (await db.count('sets')) > 0;
}

async function seed() {
  await db.transact(['categories', 'exercises', 'settings'], s => {
    SEED_CATEGORIES.forEach(c => s.categories.put(c));
    SEED_EXERCISES.forEach(e => s.exercises.put(e));
    s.settings.put({ k: 'seeded', v: true });
  });
  settings.seeded = true;
}

/** v1 routines only had `items` (ids); v2 adds per-exercise sets/reps in `exercises`. */
export function normalizeRoutine(r) {
  const list = Array.isArray(r.exercises) ? r.exercises : (r.items || []).map(id => ({ id, sets: DEFAULT_ROUTINE_SETS }));
  const exercises = list
    .filter(e => e && e.id)
    .map(e => ({ id: e.id, sets: Math.min(20, Math.max(1, Math.round(e.sets) || DEFAULT_ROUTINE_SETS)), ...(e.reps > 0 ? { reps: Math.round(e.reps) } : {}) }));
  return { ...r, exercises, items: exercises.map(e => e.id) };
}

export async function reload() {
  let rts;
  [categories, exercises, rts] = await Promise.all([db.getAll('categories'), db.getAll('exercises'), db.getAll('routines')]);
  routines = rts.map(normalizeRoutine);
  categories.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || catName(a).localeCompare(catName(b)));
  exMap = new Map(exercises.map(e => [e.id, e]));
  catMap = new Map(categories.map(c => [c.id, c]));
}

// ---------- names & lookups ----------
export const exName = e => (getLang() === 'es' && e.nameEs) || e.name;
export const catName = c => (getLang() === 'es' && c.nameEs) || c.name;
export const byExName = (a, b) => exName(a).localeCompare(exName(b), getLang());
export const getExercise = id => exMap.get(id);
export const getCategory = id => catMap.get(id);
export const getRoutine = id => routines.find(r => r.id === id);
export const exercisesInCategory = id => exercises.filter(e => e.categoryId === id).sort(byExName);
export function findExerciseByName(name) {
  const n = norm(name);
  return exercises.find(e => norm(e.name) === n || (e.nameEs && norm(e.nameEs) === n));
}

// ---------- settings ----------
export async function setSetting(k, v) { settings[k] = v; await db.put('settings', { k, v }); }

// ---------- exercises & categories ----------
export async function saveExercise(e) {
  if (!e.id) e.id = uid();
  await db.put('exercises', e);
  await reload();
  return getExercise(e.id);
}
export async function countSets(exerciseId) { return (await db.byIndex('sets', 'exerciseId', exerciseId)).length; }
export async function deleteExercise(id) {
  const sets = await db.byIndex('sets', 'exerciseId', id);
  await db.transact(['sets', 'exercises', 'routines'], s => {
    sets.forEach(x => s.sets.delete(x.id));
    s.exercises.delete(id);
    routines.forEach(r => { if (r.items.includes(id)) s.routines.put(normalizeRoutine({ ...r, exercises: r.exercises.filter(e => e.id !== id) })); });
  });
  await reload();
}
export async function saveCategory(c) {
  if (!c.id) {
    c.id = uid();
    c.order ??= 100 + categories.length;
    c.color ??= PALETTE[categories.length % PALETTE.length];
  }
  await db.put('categories', c);
  await reload();
  return c;
}
export async function deleteCategory(id) {
  if (exercises.some(e => e.categoryId === id)) return false;
  await db.del('categories', id);
  await reload();
  return true;
}

// ---------- sets ----------
export const bySetOrder = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.t - b.t);
export const setsForDate = async d => (await db.byIndex('sets', 'date', d)).sort(bySetOrder);
export const setsForExercise = async id => (await db.byIndex('sets', 'exerciseId', id)).sort(bySetOrder);
export const allSets = async () => (await db.getAll('sets')).sort(bySetOrder);

export const setsInRange = async (from, to) => (await db.byRange('sets', 'date', from, to)).sort(bySetOrder);

/** Is `set` a personal record against the completed sets logged before it? */
async function prFor(set) {
  const history = doneOnly(await setsForExercise(set.exerciseId));
  return checkPR(history.filter(s => s.id !== set.id && bySetOrder(s, set) < 0), set);
}

/** Saves a new completed set and tells whether it is a personal record ('weight' | 'reps' | null). */
export async function addSet({ exerciseId, date, weight, reps }) {
  const set = { id: uid(), exerciseId, date, weight, reps, t: Date.now() };
  const pr = await prFor(set);
  await db.put('sets', set);
  anySets = true;
  return { set, pr };
}
/** Marks a planned set as completed (optionally with new values). */
export async function completeSet(set, values = {}) {
  const done = { ...set, ...values };
  delete done.done;
  const pr = await prFor(done);
  await db.put('sets', done);
  anySets = true;
  return { set: done, pr };
}
export async function uncompleteSet(set) { await db.put('sets', { ...set, done: false }); }
export const putSet = s => db.put('sets', s);
export const deleteSet = id => db.del('sets', id);

/** Adds planned (not yet done) sets at the end of `date`, in the given order. */
export async function planSets(date, entries) {
  const t0 = Date.now();
  const sets = entries.map((e, i) => ({ id: uid(), exerciseId: e.exerciseId, date, weight: e.weight ?? 0, reps: e.reps ?? 0, t: t0 + i, done: false }));
  if (sets.length) await db.transact(['sets'], s => sets.forEach(x => s.sets.put(x)));
  return sets.length;
}

/** Completed sets of the most recent day before `date` for one exercise. */
export async function lastSessionSets(exerciseId, beforeDate) {
  const all = doneOnly(await setsForExercise(exerciseId));
  let d = null;
  for (let i = all.length - 1; i >= 0; i--) if (all[i].date < beforeDate) { d = all[i].date; break; }
  return d ? all.filter(s => s.date === d) : [];
}

/** Copies the completed sets of `fromDate` into `toDate` as planned sets. Returns how many. */
export async function repeatWorkout(fromDate, toDate) {
  const src = doneOnly(await setsForDate(fromDate));
  return planSets(toDate, src.map(s => ({ exerciseId: s.exerciseId, weight: s.weight, reps: s.reps })));
}

/** Days with completed sets, newest first: [{ date, sets, exerciseIds }]. */
export async function workoutDays(limit = Infinity) {
  const map = new Map();
  for (const s of doneOnly(await allSets())) {
    let d = map.get(s.date);
    if (!d) map.set(s.date, d = { date: s.date, sets: 0, exerciseIds: [] });
    d.sets++;
    if (!d.exerciseIds.includes(s.exerciseId)) d.exerciseIds.push(s.exerciseId);
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
}

// ---------- body weight ----------
let bwCache = [];   // body weight entries, oldest first (kept in memory for set labels and volume)
export async function bodyweights() {
  bwCache = (await db.getAll('bodyweight')).sort((a, b) => (a.date < b.date ? -1 : 1));
  return bwCache;
}
export async function saveBodyweight(date, kg) { await db.put('bodyweight', { date, kg }); await bodyweights(); }
export async function deleteBodyweight(date) { await db.del('bodyweight', date); await bodyweights(); }
/** Body weight on `date`: the last entry on or before it (or the first entry after it). */
export function bodyweightAt(date) {
  let v = null;
  for (const b of bwCache) { if (b.date <= date) v = b.kg; else break; }
  return v ?? bwCache[0]?.kg ?? null;
}

// ---------- bodyweight exercises ----------
// exercise.type === 'bodyweight' → a set's `weight` is EXTRA weight (0 = body weight only,
// +10 = vest, −20 = assisted). Records compare reps at the same extra weight; volume uses
// body weight + extra.
export const isBW = exOrId => (typeof exOrId === 'string' ? exMap.get(exOrId) : exOrId)?.type === 'bodyweight';
export const effWeight = s => (isBW(s.exerciseId) ? (bodyweightAt(s.date) ?? 0) + s.weight : s.weight);
export const setVolume = s => effWeight(s) * s.reps;
export function setLabel(s) {
  if (!isBW(s.exerciseId)) return fmtSet(s);
  const w = s.weight;
  return `${t('bwShort')}${w ? (w > 0 ? ' +' : ' −') + fmtNum(Math.abs(w)) : ''} × ${s.reps}`;
}
/**
 * Marks an exercise as bodyweight (or not). When turning it on, sets logged with the
 * body weight as their weight (e.g. 90 kg on push-ups) become "body weight + 0".
 * Returns how many sets were converted.
 */
export async function setExerciseBodyweight(id, on, convertKg = null) {
  const ex = exMap.get(id);
  if (!ex) return 0;
  const out = { ...ex };
  if (on) out.type = 'bodyweight'; else delete out.type;
  const toFix = on && convertKg > 0 ? (await setsForExercise(id)).filter(s => Math.abs(s.weight - convertKg) < 0.01) : [];
  await db.transact(['exercises', 'sets'], s => {
    s.exercises.put(out);
    toFix.forEach(x => s.sets.put({ ...x, weight: 0 }));
  });
  await reload();
  return toFix.length;
}

/** Most recently trained exercises, newest first. */
export async function recentExercises(n) {
  const out = [], seen = new Set();
  await db.iterate('sets', 'date', 'prev', s => {
    if (!seen.has(s.exerciseId) && exMap.has(s.exerciseId)) { seen.add(s.exerciseId); out.push(exMap.get(s.exerciseId)); }
    return out.length < n;
  });
  return out;
}

// ---------- sessions (one per day) ----------
export const getSession = d => db.get('sessions', d);
export const saveSession = s => db.put('sessions', s);
export const allSessions = () => db.getAll('sessions');

// ---------- routines ----------
export async function saveRoutine(r) {
  const out = normalizeRoutine({ ...r, id: r.id || uid() });
  await db.put('routines', out);
  await reload();
  return getRoutine(out.id);
}
export async function deleteRoutine(id) { await db.del('routines', id); await reload(); }
export async function addToRoutine(id, exId) {
  const r = getRoutine(id);
  if (r && !r.items.includes(exId)) await saveRoutine({ ...r, exercises: [...r.exercises, { id: exId, sets: DEFAULT_ROUTINE_SETS }] });
}

/**
 * Starts a routine on `date`: links it to the day and plans its sets. Weights (and reps,
 * unless the routine sets a target) come from the last time each exercise was done.
 * Exercises that already have sets that day are left alone. Returns the number of planned sets.
 */
export async function startRoutine(id, date = toISODate()) {
  const r = getRoutine(id);
  if (!r) return 0;
  const s = (await getSession(date)) || { date };
  s.routineId = id;
  await saveSession(s);
  const today = await setsForDate(date);
  const entries = [];
  for (const item of r.exercises) {
    if (!exMap.has(item.id) || today.some(x => x.exerciseId === item.id)) continue;
    const last = await lastSessionSets(item.id, date);
    for (let i = 0; i < item.sets; i++) {
      const ref = last[Math.min(i, last.length - 1)];
      entries.push({ exerciseId: item.id, weight: ref?.weight ?? 0, reps: item.reps || ref?.reps || 0 });
    }
  }
  return planSets(date, entries);
}

/** Creates a routine from the exercises (and number of sets) done on `date`. */
export async function routineFromDay(date, name) {
  const sets = doneOnly(await setsForDate(date));
  const order = [];
  for (const s of sets) {
    let e = order.find(x => x.id === s.exerciseId);
    if (!e) order.push(e = { id: s.exerciseId, sets: 0, repsSeen: [] });
    e.sets++;
    e.repsSeen.push(s.reps);
  }
  const exercisesPlan = order.map(e => {
    const same = e.repsSeen.every(x => x === e.repsSeen[0]);
    return { id: e.id, sets: e.sets, ...(same ? { reps: e.repsSeen[0] } : {}) };
  });
  return saveRoutine({ name, exercises: exercisesPlan });
}

// ---------- routines with days ----------
// A multi-day routine is a set of routines sharing `group` (the routine's name);
// each one is a day (`name`), ordered by `order`.
export const routineLabel = r => (r.group ? `${r.group} · ${r.name}` : r.name);

/** [{ group: string|null, days: [routine] }] — grouped first by name, single routines as their own entry. */
export function routineGroups() {
  const out = [], byGroup = new Map();
  for (const r of routines) {
    if (!r.group) { out.push({ group: null, days: [r] }); continue; }
    if (!byGroup.has(r.group)) { const g = { group: r.group, days: [] }; byGroup.set(r.group, g); out.push(g); }
    byGroup.get(r.group).days.push(r);
  }
  for (const g of out) g.days.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
  return out.sort((a, b) => (a.group || a.days[0].name).localeCompare(b.group || b.days[0].name));
}

/** Rename a multi-day routine (all its days keep their own names). */
export async function renameGroup(oldName, newName) {
  const days = routines.filter(r => r.group === oldName);
  await db.transact(['routines'], s => days.forEach(r => s.routines.put({ ...r, group: newName })));
  await reload();
}
/** Delete a multi-day routine (all its days). Logged sets are kept. */
export async function deleteGroup(name) {
  const days = routines.filter(r => r.group === name);
  await db.transact(['routines'], s => days.forEach(r => s.routines.delete(r.id)));
  await reload();
}
/** The day that comes after the last one started for this group (rotation), or the first day. */
export async function nextDay(group) {
  const days = routineGroups().find(g => g.group === group)?.days || [];
  if (!days.length) return null;
  const ids = days.map(d => d.id);
  const last = (await allSessions()).filter(s => ids.includes(s.routineId)).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return last ? days[(ids.indexOf(last.routineId) + 1) % days.length] : days[0];
}

/**
 * Adds a routine shared as a link/file:
 *   { v: 1, group?, bodyweight?: kg, replaces?: [routine names], days: [{ name, exercises: [{ name, category?, sets, reps?, bodyweight? }] }] }
 * bodyweight (kg) is logged for today; exercises flagged bodyweight are switched to that type
 * and their sets logged at that weight become "body weight + 0".
 * Exercises are matched by name (case/accents/hyphens ignored); missing ones are created.
 * A day that already exists (same group + name) is replaced. Returns what changed.
 */
/** Routines matching a name to replace: a group with that name, that exact name, or "Name – Day" (v2.0 imports). */
export function routinesNamed(name) {
  const n = norm(name);
  return routines.filter(r => (r.group && norm(r.group) === n) || norm(r.name) === n || norm(r.name).startsWith(n + ' – '));
}

export async function addRoutinePack(pack, { replaceOld = true } = {}) {
  const err = validatePack(pack);
  if (err) throw new Error(err);
  const res = { created: [], replaced: [], removed: [], newExercises: [], bodyweightExercises: [], converted: 0, bodyweight: null };
  if (replaceOld) for (const old of pack.replaces || []) for (const r of routinesNamed(old)) { await deleteRoutine(r.id); res.removed.push(routineLabel(r)); }
  const kg = pack.bodyweight > 0 ? pack.bodyweight : null;
  if (kg) { await saveBodyweight(toISODate(), kg); res.bodyweight = kg; }
  const catByNorm = new Map();
  for (const c of categories) { catByNorm.set(norm(c.name), c); if (c.nameEs) catByNorm.set(norm(c.nameEs), c); }
  const group = pack.group ? String(pack.group).trim() : undefined;
  for (const [i, day] of pack.days.entries()) {
    const items = [];
    for (const e of day.exercises) {
      let ex = findExerciseByName(e.name);
      if (!ex) {
        let cat = e.category ? catByNorm.get(norm(e.category)) : null;
        if (!cat && e.category) { cat = await saveCategory({ name: String(e.category).trim() }); catByNorm.set(norm(cat.name), cat); }
        ex = await saveExercise({ name: String(e.name).trim(), categoryId: (cat || categories[0]).id });
        res.newExercises.push(ex.name);
      }
      if (e.bodyweight && !isBW(ex)) {
        res.converted += await setExerciseBodyweight(ex.id, true, kg ?? bodyweightAt(toISODate()));
        res.bodyweightExercises.push(exName(getExercise(ex.id)));
      }
      if (!items.some(x => x.id === ex.id)) items.push({ id: ex.id, sets: e.sets, ...(e.reps > 0 ? { reps: e.reps } : {}) });
    }
    const name = String(day.name).trim();
    const existing = routines.find(r => (r.group || undefined) === group && norm(r.name) === norm(name));
    await saveRoutine({ ...(existing || {}), name, group, order: i + 1, exercises: items });
    (existing ? res.replaced : res.created).push(name);
  }
  return res;
}

export function validatePack(p) {
  if (!p || typeof p !== 'object' || p.v !== 1 || !Array.isArray(p.days) || !p.days.length || p.days.length > 14) return 'badPack';
  if (p.group != null && (typeof p.group !== 'string' || p.group.length > 60)) return 'badPack';
  if (p.bodyweight != null && !(typeof p.bodyweight === 'number' && p.bodyweight > 20 && p.bodyweight < 400)) return 'badPack';
  if (p.replaces != null && (!Array.isArray(p.replaces) || p.replaces.length > 10 || p.replaces.some(x => typeof x !== 'string' || !x.trim() || x.length > 60))) return 'badPack';
  for (const d of p.days) {
    if (!d || typeof d.name !== 'string' || !d.name.trim() || d.name.length > 60 || !Array.isArray(d.exercises) || d.exercises.length > 40) return 'badPack';
    for (const e of d.exercises) {
      if (!e || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 80) return 'badPack';
      if (!Number.isInteger(e.sets) || e.sets < 1 || e.sets > 20) return 'badPack';
      if (e.reps != null && (!Number.isInteger(e.reps) || e.reps < 0 || e.reps > 100)) return 'badPack';
      if (e.category != null && (typeof e.category !== 'string' || e.category.length > 40)) return 'badPack';
      if (e.bodyweight != null && typeof e.bodyweight !== 'boolean') return 'badPack';
    }
  }
  return null;
}

/** Link-safe text <-> pack (UTF-8 JSON as base64url). */
export function encodePack(pack) {
  const bytes = new TextEncoder().encode(JSON.stringify(pack));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodePack(text) {
  try {
    const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
  } catch { return null; }
}

// ---------- backups ----------
/** false, 'never', or number of days since the last backup (only when it's due). */
export function needsBackup() {
  if (!anySets) return false;
  if (settings.backupSnooze && Date.now() < settings.backupSnooze) return false;
  if (!settings.lastBackup) return 'never';
  const days = Math.floor((Date.now() - settings.lastBackup) / 86400000);
  return days >= settings.backupDays ? days : false;
}
export const markBackup = () => setSetting('lastBackup', Date.now());
export const snoozeBackup = () => setSetting('backupSnooze', Date.now() + 86400000);

export async function counts() {
  const sets = await db.getAll('sets');
  return { sets: sets.length, days: new Set(sets.map(s => s.date)).size, exercises: exercises.length };
}

export async function exportAll() {
  const [cats, exs, sets, sessions, rts, sett, bw] = await Promise.all(db.STORES.map(n => db.getAll(n)));
  return {
    app: 'strength-log', format: 2, exportedAt: new Date().toISOString(),
    categories: cats, exercises: exs, sets, sessions, routines: rts, bodyweight: bw,
    settings: sett.filter(s => s.k !== 'lastImport'),
  };
}

export function validateBackup(o) {
  if (!o || o.app !== 'strength-log' || typeof o.format !== 'number') return 'notBackup';
  if (o.format > 2) return 'newerFormat';
  for (const k of ['categories', 'exercises', 'sets', 'sessions', 'routines']) if (!Array.isArray(o[k])) return 'missing:' + k;
  return null;
}

/** Replaces ALL data with the backup's contents. */
export async function restoreAll(o) {
  await db.transact(db.STORES, s => {
    for (const n of db.STORES) s[n].clear();
    o.categories.forEach(x => s.categories.put(x));
    o.exercises.forEach(x => s.exercises.put(x));
    o.sets.forEach(x => s.sets.put(x));
    o.sessions.forEach(x => s.sessions.put(x));
    o.routines.forEach(x => s.routines.put(normalizeRoutine(x)));
    (o.bodyweight || []).forEach(x => s.bodyweight.put(x));
    (o.settings || []).forEach(x => s.settings.put(x));
    s.settings.put({ k: 'seeded', v: true });
  });
  for (const k of Object.keys(settings)) delete settings[k];
  Object.assign(settings, DEFAULTS, { seeded: true });
  for (const r of o.settings || []) settings[r.k] = r.v;
  await reload();
  await bodyweights();
  anySets = o.sets.length > 0;
}

/** All sets as CSV, using the same columns as FitNotes so it can be re-imported. */
export async function exportCSV() {
  const rows = [['Date', 'Exercise', 'Category', 'Weight (kgs)', 'Reps', 'Comment']];
  for (const s of doneOnly(await allSets())) {
    const e = getExercise(s.exerciseId), c = e && getCategory(e.categoryId);
    rows.push([s.date, e ? e.name : '?', c ? c.name : '', s.weight, s.reps, s.comment || '']);
  }
  return toCSV(rows);
}

export async function exportCheckinsCSV() {
  const rows = [['Date', 'Mood', 'Motivation', 'Satisfaction', 'Note']];
  const list = (await allSessions()).filter(s => s.mood || s.motivation || s.satisfaction || s.note).sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const s of list) rows.push([s.date, s.mood ?? '', s.motivation ?? '', s.satisfaction ?? '', s.note ?? '']);
  return toCSV(rows);
}

// ---------- FitNotes import ----------
/**
 * Writes what analyzeFitNotes() (CSV) or analyzeFitNotesBackup() (.fitnotes) produced.
 * Exercises are matched by name (ignoring case, accents, hyphens and extra spaces)
 * against the library and each other. Sets already present (same day, exercise,
 * weight, reps) are skipped, so importing the same file twice duplicates nothing.
 * Options: removeUnusedBuiltins (drop built-in exercises never used), restSeconds (new default rest).
 */
export async function importFitNotes(an, { removeUnusedBuiltins = false, restSeconds } = {}) {
  const report = {
    at: Date.now(), source: an.source || 'csv', total: an.total, imported: 0, duplicates: 0,
    createdExercises: [], matchedExercises: [], mergedNames: [], createdCategories: [],
    createdRoutines: [], existingRoutines: [], builtinsRemoved: 0,
    nonWeightExercises: an.nonWeightExercises || 0, comments: an.comments || 0,
    skippedCount: an.skipped.length, skipped: an.skipped.slice(0, 500), from: null, to: null,
    dateOrderAssumed: !!an.dateOrderAssumed,
  };
  const catByNorm = new Map();
  for (const c of categories) { catByNorm.set(norm(c.name), c); if (c.nameEs) catByNorm.set(norm(c.nameEs), c); }
  const exByNorm = new Map();
  for (const e of exercises) { exByNorm.set(norm(e.name), e); if (e.nameEs) exByNorm.set(norm(e.nameEs), e); }

  const dup = new Map();
  for (const s of await db.getAll('sets')) { const k = `${s.date}|${s.exerciseId}|${wkey(s.weight)}|${s.reps}`; dup.set(k, (dup.get(k) || 0) + 1); }

  const spellings = new Map(); // norm → Set(original names)
  const created = new Set(), matched = new Set();
  const newCats = [], newEx = [], newSets = [], newRoutines = [];
  let other = null;

  function category(name, color) {
    let cat = name ? catByNorm.get(norm(name)) : null;
    if (!cat && name) {
      cat = { id: uid(), name, color: color || PALETTE[(categories.length + newCats.length) % PALETTE.length], order: 100 + newCats.length };
      newCats.push(cat); catByNorm.set(norm(name), cat); report.createdCategories.push(name);
    }
    if (!cat) {
      other ??= catByNorm.get('other') || catByNorm.get('otros');
      if (!other) { other = { id: uid(), name: 'Other', nameEs: 'Otros', color: '#8b949e', order: 999 }; newCats.push(other); catByNorm.set('other', other); report.createdCategories.push('Other'); }
      cat = other;
    }
    return cat;
  }
  function exercise(name, catName, color) {
    const n = norm(name);
    let ex = exByNorm.get(n);
    if (!ex) {
      ex = { id: uid(), name, categoryId: category(catName, color).id };
      newEx.push(ex); exByNorm.set(n, ex); created.add(n);
    } else if (!created.has(n)) matched.add(n);
    touched.add(ex.id);
    return ex;
  }
  const touched = new Set(); // every exercise the file mentions (sets, library, routines)

  let order = 0;
  for (const r of an.sets) {
    const n = norm(r.exercise);
    if (!spellings.has(n)) spellings.set(n, new Set());
    spellings.get(n).add(r.exercise);
    const ex = exercise(r.exercise, r.category, r.categoryColor);
    const k = `${r.date}|${ex.id}|${wkey(r.weight)}|${r.reps}`;
    const left = dup.get(k) || 0;
    if (left > 0) { dup.set(k, left - 1); report.duplicates++; continue; }
    const set = { id: uid(), exerciseId: ex.id, date: r.date, weight: r.weight, reps: r.reps, t: parseISODate(r.date).getTime() + 1000 * order++ };
    if (r.comment) set.comment = r.comment;
    newSets.push(set);
    if (!report.from || r.date < report.from) report.from = r.date;
    if (!report.to || r.date > report.to) report.to = r.date;
  }
  for (const l of an.library || []) exercise(l.name, l.category, l.color);

  const routineNames = new Set(routines.map(r => norm(routineLabel(r))));
  for (const r of an.routines || []) {
    const label = routineLabel(r);
    if (routineNames.has(norm(label))) { report.existingRoutines.push(label); continue; }
    routineNames.add(norm(label));
    const ids = [...new Set(r.exercises.map(e => exercise(e.name, e.category, e.color).id))];
    newRoutines.push(normalizeRoutine({ id: uid(), name: r.name, ...(r.group ? { group: r.group, order: r.order } : {}), exercises: ids.map(id => ({ id, sets: DEFAULT_ROUTINE_SETS })) }));
    report.createdRoutines.push(label);
  }

  await db.transact(['categories', 'exercises', 'sets', 'routines'], s => {
    newCats.forEach(c => s.categories.put(c));
    newEx.forEach(e => s.exercises.put(e));
    newSets.forEach(x => s.sets.put(x));
    newRoutines.forEach(x => s.routines.put(x));
  });
  report.imported = newSets.length;
  report.createdExercises = newEx.map(e => e.name).sort();
  report.matchedExercises = [...matched].map(n => exName(exByNorm.get(n))).sort();
  report.mergedNames = [...spellings.values()].filter(v => v.size > 1).map(v => [...v]);
  if (newSets.length) anySets = true;
  await reload();
  if (removeUnusedBuiltins) report.builtinsRemoved = await removeUnusedBuiltinExercises(touched);
  if (restSeconds > 0) { await setSetting('rest', restSeconds); report.restSeconds = restSeconds; }
  await setSetting('lastImport', report);
  return report;
}

/** Deletes built-in exercises (ids "x-…") that have no sets, are in no routine and are not in `keep`. */
export async function removeUnusedBuiltinExercises(keep = new Set()) {
  const used = new Set([...keep, ...(await db.getAll('sets')).map(s => s.exerciseId)]);
  routines.forEach(r => r.items.forEach(i => used.add(i)));
  const victims = exercises.filter(e => e.id.startsWith('x-') && !used.has(e.id));
  if (victims.length) await db.transact(['exercises'], s => victims.forEach(e => s.exercises.delete(e.id)));
  await reload();
  return victims.length;
}
