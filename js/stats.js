// Pure calculations on sets: personal records, daily aggregates, weekly check-ins.
import { wkey, weekStart } from './util.js';

/**
 * Is `s` a personal record compared with `prior` (all earlier sets of the same exercise)?
 * 'weight' = heaviest weight ever; 'reps' = more reps than ever at this exact weight.
 * The very first set of an exercise is not a record (nothing to beat yet).
 */
export function checkPR(prior, s) {
  if (!prior.length) return null;
  let maxW = -Infinity, repsAtW = -Infinity;
  for (const p of prior) {
    if (p.weight > maxW) maxW = p.weight;
    if (wkey(p.weight) === wkey(s.weight) && p.reps > repsAtW) repsAtW = p.reps;
  }
  if (s.weight > maxW) return 'weight';
  if (repsAtW > -Infinity && s.reps > repsAtW) return 'reps';
  return null;
}

/** Map setId → 'weight' | 'reps' for every record in a chronologically sorted list. */
export function markPRs(sorted) {
  const res = new Map();
  const reps = new Map();
  let maxW = -Infinity;
  sorted.forEach((s, i) => {
    const k = wkey(s.weight);
    if (i > 0) {
      if (s.weight > maxW) res.set(s.id, 'weight');
      else if (reps.has(k) && s.reps > reps.get(k)) res.set(s.id, 'reps');
    }
    if (s.weight > maxW) maxW = s.weight;
    if (!reps.has(k) || s.reps > reps.get(k)) reps.set(k, s.reps);
  });
  return res;
}

/** Per-day aggregates for one exercise (input sorted by date). */
export function dailyStats(sorted) {
  const m = new Map();
  for (const s of sorted) {
    let d = m.get(s.date);
    if (!d) m.set(s.date, d = { date: s.date, maxWeight: -Infinity, volume: 0, sets: 0, reps: 0 });
    d.maxWeight = Math.max(d.maxWeight, s.weight);
    d.volume += s.weight * s.reps;
    d.sets++;
    d.reps += s.reps;
  }
  return [...m.values()];
}

/** Summary records for one exercise. */
export function records(sorted) {
  if (!sorted.length) return null;
  let heaviest = null;
  const repMax = new Map();
  for (const s of sorted) {
    if (!heaviest || s.weight > heaviest.weight || (s.weight === heaviest.weight && s.reps > heaviest.reps)) heaviest = s;
    const k = wkey(s.weight), cur = repMax.get(k);
    if (!cur || s.reps > cur.reps) repMax.set(k, s);
  }
  const days = dailyStats(sorted);
  const bestVolume = days.reduce((a, b) => (b.volume > a.volume ? b : a), days[0]);
  return { heaviest, bestVolume, repMax: [...repMax.values()].sort((a, b) => b.weight - a.weight) };
}

export const CHECKIN_KEYS = ['mood', 'motivation', 'satisfaction'];

/** Weekly averages of the post-workout check-ins (weeks start on Monday). */
export function weeklyCheckins(sessions) {
  const m = new Map();
  for (const s of sessions) {
    if (!CHECKIN_KEYS.some(k => s[k])) continue;
    const week = weekStart(s.date);
    let a = m.get(week);
    if (!a) m.set(week, a = { week, n: 0, sum: {}, cnt: {} });
    a.n++;
    for (const k of CHECKIN_KEYS) if (s[k]) { a.sum[k] = (a.sum[k] || 0) + s[k]; a.cnt[k] = (a.cnt[k] || 0) + 1; }
  }
  return [...m.values()]
    .sort((a, b) => (a.week < b.week ? -1 : 1))
    .map(a => ({ week: a.week, n: a.n, ...Object.fromEntries(CHECKIN_KEYS.map(k => [k, a.cnt[k] ? a.sum[k] / a.cnt[k] : null])) }));
}

// ---------------------------------------------------------------- v2
/** Estimated one-rep max (Epley). Only trusted up to 12 reps; returns null above. */
export function e1rm(weight, reps) {
  if (!(weight > 0) || !(reps > 0) || reps > 12) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}
export function bestE1rm(sets) {
  let best = null;
  for (const s of sets) { const v = e1rm(s.weight, s.reps); if (v != null && (!best || v > best.value)) best = { value: v, set: s }; }
  return best;
}

/**
 * Plates to load on EACH side of the bar for `total` kg.
 * @returns {{ perSide: number[], loaded: number, rest: number }} rest = kg that couldn't be matched
 */
export function platesFor(total, bar = 20, plates = [25, 20, 15, 10, 5, 2.5, 1.25]) {
  const per = Math.round(((total - bar) / 2) * 1000) / 1000;
  const perSide = [];
  if (per <= 0) return { perSide, loaded: Math.max(bar, 0), rest: Math.max(0, Math.round((total - bar) * 100) / 100) };
  let left = per;
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (left + 1e-9 >= p) { perSide.push(p); left = Math.round((left - p) * 1000) / 1000; }
  }
  const loaded = bar + 2 * perSide.reduce((a, b) => a + b, 0);
  return { perSide, loaded: Math.round(loaded * 100) / 100, rest: Math.round((total - loaded) * 100) / 100 };
}

/** Per-week totals (weeks start Monday) for completed sets: [{ week, workouts, sets, volume }]. */
export function weeklyTotals(sets) {
  const m = new Map();
  for (const s of sets) {
    const w = weekStart(s.date);
    let a = m.get(w);
    if (!a) m.set(w, a = { week: w, days: new Set(), sets: 0, volume: 0 });
    a.days.add(s.date);
    a.sets++;
    a.volume += s.weight * s.reps;
  }
  return [...m.values()].sort((a, b) => (a.week < b.week ? -1 : 1)).map(a => ({ week: a.week, workouts: a.days.size, sets: a.sets, volume: a.volume }));
}

/** Consecutive weeks (ending this week or last week) with at least one workout. */
export function weekStreak(sets, today) {
  const weeks = new Set(sets.map(s => weekStart(s.date)));
  let w = weekStart(today);
  if (!weeks.has(w)) w = shiftWeek(w, -1);         // this week not started yet: count from last week
  let n = 0;
  while (weeks.has(w)) { n++; w = shiftWeek(w, -1); }
  return n;
}
function shiftWeek(iso, k) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 7 * k);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Most recent personal records across all exercises: [{ set, type }], newest first. */
export function recentRecords(sortedSets, limit = 10) {
  const byEx = new Map();
  for (const s of sortedSets) { if (!byEx.has(s.exerciseId)) byEx.set(s.exerciseId, []); byEx.get(s.exerciseId).push(s); }
  const out = [];
  for (const list of byEx.values()) for (const [id, type] of markPRs(list)) out.push({ set: list.find(s => s.id === id), type });
  return out.sort((a, b) => (a.set.date < b.set.date ? 1 : a.set.date > b.set.date ? -1 : b.set.t - a.set.t)).slice(0, limit);
}

/** Minutes between the first and last completed set of a day (by their timestamps), or null. */
export function workoutMinutes(daySets) {
  const ts = daySets.map(s => s.t).filter(Boolean);
  if (ts.length < 2) return null;
  const min = Math.round((Math.max(...ts) - Math.min(...ts)) / 60000);
  return min > 0 && min < 6 * 60 ? min : null;   // imported data has fake timestamps: ignore silly values
}
