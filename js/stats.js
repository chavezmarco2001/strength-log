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
