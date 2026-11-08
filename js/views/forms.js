// Forms shared by several screens.
import { formDialog, toast } from '../ui.js';
import * as data from '../data.js';
import { t } from '../i18n.js';

/** Create (ex = null) or edit an exercise. Resolves with the saved exercise or null. */
export async function exerciseForm(ex, defaults = {}) {
  const isNew = !ex;
  const v = await formDialog(isNew ? t('newExercise') : t('editExercise'), [
    { name: 'name', label: t('exerciseName'), value: ex ? data.exName(ex) : defaults.name || '', required: true, maxlength: 60 },
    { name: 'categoryId', label: t('category'), type: 'select', value: ex?.categoryId || defaults.categoryId || data.categories[0]?.id, options: data.categories.map(c => ({ value: c.id, label: data.catName(c) })) },
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
  return data.saveExercise(out);
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
