// Data layer: everything the screens read or write goes through here.
//
// Records (IndexedDB stores):
//   categories { id, name, nameEs?, color, order }
//   exercises  { id, name, nameEs?, categoryId, rest? }      rest = seconds, overrides default
//   sets       { id, exerciseId, date:'YYYY-MM-DD', weight (kg), reps, t (ordering ms), comment? }
//   sessions   { date, routineId?, mood?, motivation?, satisfaction?, note?, finishedAt? }
//   routines   { id, name, items: [exerciseId] }
//   settings   { k, v }
import * as db from './db.js';
import { SEED_CATEGORIES, SEED_EXERCISES, PALETTE } from './seed.js';
import { uid, norm, parseISODate, toISODate, wkey } from './util.js';
import { getLang } from './i18n.js';
import { checkPR } from './stats.js';
import { toCSV } from './csv.js';

export const DEFAULTS = {
  lang: 'en', theme: 'dark', rest: 90, step: 2.5,
  sound: true, vibrate: true, wake: true,
  lastBackup: 0, backupDays: 7, backupSnooze: 0,
};
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

export async function reload() {
  [categories, exercises, routines] = await Promise.all([db.getAll('categories'), db.getAll('exercises'), db.getAll('routines')]);
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
    routines.forEach(r => { if (r.items.includes(id)) s.routines.put({ ...r, items: r.items.filter(i => i !== id) }); });
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

/** Saves a new set and tells whether it is a personal record ('weight' | 'reps' | null). */
export async function addSet({ exerciseId, date, weight, reps }) {
  const history = await setsForExercise(exerciseId);
  const set = { id: uid(), exerciseId, date, weight, reps, t: Date.now() };
  const pr = checkPR(history.filter(s => bySetOrder(s, set) < 0), set);
  await db.put('sets', set);
  anySets = true;
  return { set, pr };
}
export const putSet = s => db.put('sets', s);
export const deleteSet = id => db.del('sets', id);

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
  if (!r.id) r.id = uid();
  r.items ??= [];
  await db.put('routines', r);
  await reload();
  return r;
}
export async function deleteRoutine(id) { await db.del('routines', id); await reload(); }
export async function addToRoutine(id, exId) {
  const r = getRoutine(id);
  if (r && !r.items.includes(exId)) await saveRoutine({ ...r, items: [...r.items, exId] });
}
export async function startRoutine(id) {
  const d = toISODate();
  const s = (await getSession(d)) || { date: d };
  s.routineId = id;
  await saveSession(s);
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
  const [cats, exs, sets, sessions, rts, sett] = await Promise.all(db.STORES.map(n => db.getAll(n)));
  return {
    app: 'strength-log', format: 1, exportedAt: new Date().toISOString(),
    categories: cats, exercises: exs, sets, sessions, routines: rts,
    settings: sett.filter(s => s.k !== 'lastImport'),
  };
}

export function validateBackup(o) {
  if (!o || o.app !== 'strength-log' || typeof o.format !== 'number') return 'notBackup';
  if (o.format > 1) return 'newerFormat';
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
    o.routines.forEach(x => s.routines.put(x));
    (o.settings || []).forEach(x => s.settings.put(x));
    s.settings.put({ k: 'seeded', v: true });
  });
  for (const k of Object.keys(settings)) delete settings[k];
  Object.assign(settings, DEFAULTS, { seeded: true });
  for (const r of o.settings || []) settings[r.k] = r.v;
  await reload();
  anySets = o.sets.length > 0;
}

/** All sets as CSV, using the same columns as FitNotes so it can be re-imported. */
export async function exportCSV() {
  const rows = [['Date', 'Exercise', 'Category', 'Weight (kgs)', 'Reps', 'Comment']];
  for (const s of await allSets()) {
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

  const routineNames = new Set(routines.map(r => norm(r.name)));
  for (const r of an.routines || []) {
    if (routineNames.has(norm(r.name))) { report.existingRoutines.push(r.name); continue; }
    routineNames.add(norm(r.name));
    newRoutines.push({ id: uid(), name: r.name, items: [...new Set(r.exercises.map(e => exercise(e.name, e.category, e.color).id))] });
    report.createdRoutines.push(r.name);
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
