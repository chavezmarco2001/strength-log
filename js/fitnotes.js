// Reads a FitNotes CSV export. Columns are detected by header name (English or
// Spanish) instead of position, so small format differences don't break it.
// Pure — no DOM, no database. Rows that can't be read are returned in `skipped`.
import { parseCSV } from './csv.js';
import { parseNum, pad } from './util.js';

const strip = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Order matters: more specific patterns first.
const COLS = [
  ['date', /^(date|fecha)\b/],
  ['exercise', /^(exercise|ejercicio)\b/],
  ['category', /^(category|categoria)\b/],
  ['weightUnit', /^(weight unit|unidad de peso|unidad)$/],
  ['weight', /^(weight|peso)\b/],
  ['reps', /^(reps|repetitions|repeticiones)\b/],
  ['distanceUnit', /^(distance unit|unidad de distancia)$/],
  ['distance', /^(distance|distancia)\b/],
  ['time', /^(time|tiempo|duration|duracion)\b/],
  ['comment', /^(comments?|comentarios?|notes?|notas?)\b/],
];

const isZeroish = s => !s || /^[0:.,\s]*$/.test(s);

function detectDateOrder(cells) {
  let dmy = false, mdy = false, any = false;
  for (const c of cells) {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(c);
    if (!m) continue;
    any = true;
    if (+m[1] > 12) dmy = true;
    if (+m[2] > 12) mdy = true;
  }
  if (mdy && !dmy) return { order: 'mdy', assumed: false };
  return { order: 'dmy', assumed: any && !dmy };
}

function validDate(y, m, d) {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  if (d > new Date(y, m, 0).getDate()) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseDate(s, order = 'dmy') {
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s);
  if (m) {
    let y = +m[3]; if (y < 100) y += 2000;
    return order === 'mdy' ? validDate(y, +m[1], +m[2]) : validDate(y, +m[2], +m[1]);
  }
  return null;
}

/**
 * @returns {{error?: 'empty'|'columns', columns: string[], sets: object[], skipped: object[], total: number, unit: string, dateOrderAssumed: boolean}}
 */
export function analyzeFitNotes(text) {
  const rows = parseCSV(text).filter(r => r.cells.some(c => c.trim() !== ''));
  if (!rows.length) return { error: 'empty', columns: [], sets: [], skipped: [], total: 0 };
  const headerRaw = rows[0].cells.map(c => c.trim());
  const header = headerRaw.map(strip);
  const idx = {};
  header.forEach((name, i) => {
    for (const [key, re] of COLS) if (idx[key] == null && re.test(name)) { idx[key] = i; break; }
  });
  if (idx.date == null || idx.exercise == null || idx.reps == null) {
    return { error: 'columns', columns: headerRaw, sets: [], skipped: [], total: rows.length - 1 };
  }
  const unit = idx.weight != null && /\blbs?\b/.test(header[idx.weight]) ? 'lb' : 'kg';
  const body = rows.slice(1);
  const { order, assumed } = detectDateOrder(body.map(r => (r.cells[idx.date] || '').trim()));

  const sets = [], skipped = [];
  for (const r of body) {
    const get = k => (idx[k] == null ? '' : (r.cells[idx[k]] ?? '').trim());
    const skip = reason => skipped.push({ line: r.line, reason, raw: r.cells.join(', ') });

    const exercise = get('exercise').replace(/\s+/g, ' ');
    if (!exercise) { skip('noExercise'); continue; }
    const date = parseDate(get('date'), order);
    if (!date) { skip('badDate'); continue; }

    const repsStr = get('reps'), weightStr = get('weight');
    const isCardio = !isZeroish(get('distance')) || !isZeroish(get('time'));
    if (isZeroish(repsStr)) { skip(isCardio ? 'cardio' : 'noReps'); continue; }
    const reps = parseNum(repsStr);
    if (!Number.isInteger(reps) || reps < 1 || reps > 1000) { skip('badReps'); continue; }

    let weight = weightStr === '' ? 0 : parseNum(weightStr);
    if (!Number.isFinite(weight)) { skip('badWeight'); continue; }
    const u = strip(get('weightUnit'));
    if ((u ? /lb/.test(u) : unit === 'lb')) weight *= 0.45359237;
    weight = Math.round(weight * 100) / 100;
    if (weight < 0) { skip('negativeWeight'); continue; }
    if (weight > 2000) { skip('badWeight'); continue; }

    sets.push({ line: r.line, date, exercise, category: get('category').replace(/\s+/g, ' '), weight, reps, comment: get('comment') });
  }
  return { columns: headerRaw, sets, skipped, total: body.length, unit, dateOrderAssumed: assumed };
}
