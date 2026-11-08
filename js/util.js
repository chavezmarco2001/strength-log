// Small pure helpers (no DOM) — safe to import from Node tests.

let counter = 0;
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  Date.now().toString(36) + (++counter).toString(36) + Math.random().toString(36).slice(2, 10);

export const pad = n => String(n).padStart(2, '0');

/** Local calendar date as 'YYYY-MM-DD'. */
export function toISODate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(iso, n) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}
/** Monday of the week that contains `iso`. */
export function weekStart(iso) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISODate(d);
}

/** Accepts "62.5", "62,5", 62.5 → 62.5; anything else → NaN. */
export function parseNum(s) {
  if (typeof s === 'number') return s;
  const str = String(s ?? '').trim().replace(',', '.');
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(str)) return NaN;
  return parseFloat(str);
}
export const round2 = n => Math.round(n * 100) / 100;
/** Stable key for comparing weights (avoids float noise). */
export const wkey = w => Math.round(w * 100);

/** Lowercase, no accents, hyphens as spaces, single spaces — used to match names ("Pull-Up" = "pull up"). */
export const norm = s =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

export const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
export const STEP_OPTIONS = [1, 1.25, 2.5, 5];
