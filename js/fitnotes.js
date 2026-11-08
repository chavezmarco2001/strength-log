// Reads FitNotes data: the CSV export (analyzeFitNotes) or the full backup file
// .fitnotes, which is a SQLite database (analyzeFitNotesBackup).
// CSV columns are detected by header name (English or Spanish) instead of position.
// Pure — no DOM, no database. Rows that can't be read are returned in `skipped`.
import { parseCSV } from './csv.js';
import { parseNum, pad } from './util.js';
import { openSQLite } from './sqlite.js';

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

// ---------------------------------------------------------------- .fitnotes backup
// Structure checked against a real FitNotes backup (Nov 2026):
//   training_log(_id, exercise_id, date 'YYYY-MM-DD', metric_weight (kg), reps, distance,
//                duration_seconds, is_complete, …)
//   exercise(_id, name, category_id, exercise_type_id (0 = weight & reps), …)
//   Category(_id, name, colour ARGB int) · Routine → RoutineSection → RoutineSectionExercise
//   settings(mark_sets_complete, rest_timer_seconds, …)
const colourHex = c => (c ? '#' + ((c >>> 0) & 0xffffff).toString(16).padStart(6, '0') : undefined);
const byOrder = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a._id - b._id;

/**
 * @returns {{error?: 'notFitnotes', source: 'backup', sets: object[], incomplete: object[], skipped: object[],
 *   total: number, library: object[], routines: object[], nonWeightExercises: number, comments: number, restSeconds?: number}}
 */
export function analyzeFitNotesBackup(buffer) {
  const db = openSQLite(buffer);
  if (!['training_log', 'exercise', 'Category'].every(t => db.has(t))) return { error: 'notFitnotes', source: 'backup', sets: [], incomplete: [], skipped: [], total: 0 };

  const cats = new Map(db.rows('Category').map(c => [c._id, { name: String(c.name ?? '').trim(), color: colourHex(c.colour) }]));
  const exRows = db.rows('exercise');
  const exs = new Map(exRows.map(e => [e._id, e]));
  const settings = db.has('settings') ? db.rows('settings')[0] || {} : {};
  const tracksComplete = !!settings.mark_sets_complete && db.columns('training_log').includes('is_complete');
  const info = e => {
    const c = cats.get(e.category_id);
    return { name: String(e.name).trim().replace(/\s+/g, ' '), category: c?.name || '', color: c?.color };
  };
  const isWeight = e => (e.exercise_type_id ?? 0) === 0;

  const log = db.rows('training_log').sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a._id - b._id));
  const sets = [], incomplete = [], skipped = [];
  log.forEach((r, order) => {
    const ex = exs.get(r.exercise_id);
    const raw = `${r.date}, ${ex ? ex.name : '?'}, ${r.metric_weight} kg × ${r.reps}`;
    const skip = reason => skipped.push({ line: r._id, reason, raw });
    if (!ex) return skip('noExercise');
    const date = parseDate(String(r.date ?? ''));
    if (!date) return skip('badDate');
    if (!(r.reps > 0)) return skip(r.distance > 0 || r.duration_seconds > 0 ? 'cardio' : 'noReps');
    if (!Number.isInteger(r.reps) || r.reps > 1000) return skip('badReps');
    const weight = Math.round(Number(r.metric_weight) * 100) / 100;
    if (!Number.isFinite(weight) || weight > 2000) return skip('badWeight');
    if (weight < 0) return skip('negativeWeight');
    const set = { line: r._id, order, date, exercise: info(ex).name, category: info(ex).category, categoryColor: info(ex).color, weight, reps: r.reps, raw };
    if (tracksComplete && !r.is_complete) incomplete.push(set);
    else sets.push(set);
  });

  const library = exRows.filter(isWeight).map(info);
  const routines = [];
  if (db.has('Routine') && db.has('RoutineSection') && db.has('RoutineSectionExercise')) {
    const sections = db.rows('RoutineSection');
    const items = db.rows('RoutineSectionExercise');
    for (const r of db.rows('Routine')) {
      const own = sections.filter(s => s.routine_id === r._id).sort(byOrder);
      for (const s of own) {
        const exercises = items.filter(i => i.routine_section_id === s._id).sort(byOrder)
          .map(i => exs.get(i.exercise_id)).filter(e => e && isWeight(e)).map(info);
        if (!exercises.length) continue;
        const name = own.length > 1 ? `${String(r.name).trim()} – ${String(s.name).trim()}` : String(r.name).trim();
        routines.push({ name, exercises });
      }
    }
  }
  const count = t => (db.has(t) ? db.rows(t).length : 0);
  return {
    source: 'backup', sets, incomplete, skipped, total: log.length, unit: 'kg',
    library, routines,
    nonWeightExercises: exRows.length - library.length,
    comments: count('Comment') + count('WorkoutComment'),
    restSeconds: settings.rest_timer_seconds > 0 ? settings.rest_timer_seconds : undefined,
  };
}
