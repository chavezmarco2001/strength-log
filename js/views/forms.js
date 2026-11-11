// Forms shared by several screens.
import { formDialog, toast, confirmDialog } from '../ui.js';
import { toISODate } from '../util.js';
import * as data from '../data.js';
import { t } from '../i18n.js';

/** Create (ex = null) or edit an exercise. Resolves with the saved exercise or null. */
export async function exerciseForm(ex, defaults = {}) {
  const isNew = !ex;
  const v = await formDialog(isNew ? t('newExercise') : t('editExercise'), [
    { name: 'name', label: t('exerciseName'), value: ex ? data.exName(ex) : defaults.name || '', required: true, maxlength: 60 },
    { name: 'categoryId', label: t('category'), type: 'select', value: ex?.categoryId || defaults.categoryId || data.categories[0]?.id, options: data.categories.map(c => ({ value: c.id, label: data.catName(c) })) },
    { name: 'type', label: t('exerciseType'), type: 'select', value: ex && data.isBW(ex) ? 'bodyweight' : 'weight', options: [{ value: 'weight', label: t('typeWeight') }, { value: 'bodyweight', label: t('typeBodyweight') }] },
  ], isNew ? t('create') : t('save'));
  if (!v) return null;
  const same = data.findExerciseByName(v.name);
  if (same && same.id !== ex?.id) {
    toast(t('exerciseExists'));
    return isNew ? same : null;
  }
  const out = ex ? { ...ex } : {};
  if (!ex || v.name !== data.exName(ex)) { out.name = v.name; delete out.nameEs; }
  out.categoryId = v.categoryId;
  const saved = await data.saveExercise(out);
  if ((v.type === 'bodyweight') !== data.isBW(saved)) await setBodyweight(saved, v.type === 'bodyweight');
  return data.getExercise(saved.id);
}

/**
 * Switch an exercise to/from bodyweight. Turning it on converts sets logged with your
 * body weight as weight (e.g. 90 kg push-ups) into "body weight + 0".
 */
export async function setBodyweight(ex, on) {
  if (!on) { await data.setExerciseBodyweight(ex.id, false); toast(t('saved')); return true; }
  const kg = data.bodyweightAt(toISODate());
  const n = kg ? (await data.setsForExercise(ex.id)).filter(s => Math.abs(s.weight - kg) < 0.01).length : 0;
  if (n && !(await confirmDialog(t('bwConvertConfirm', { n, kg }), { ok: t('convert') }))) return false;
  const done = await data.setExerciseBodyweight(ex.id, true, kg);
  toast(done ? t('bwConverted', { n: done }) : t('saved'));
  return true;
}

export async function categoryForm(cat) {
  const v = await formDialog(cat ? t('renameCategory') : t('newCategory'), [
    { name: 'name', label: t('categoryName'), value: cat ? data.catName(cat) : '', required: true, maxlength: 30 },
  ], cat ? t('save') : t('create'));
  if (!v) return null;
  const out = cat ? { ...cat } : {};
  if (!cat || v.name !== data.catName(cat)) { out.name = v.name; delete out.nameEs; }
  return data.saveCategory(out);
}
