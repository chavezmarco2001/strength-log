// Exercise library: categories and exercises (create, rename, move, delete).
import { h, icon, topbar, chooser, confirmDialog, toast } from '../ui.js';
import * as data from '../data.js';
import { t, fmtRest } from '../i18n.js';
import { REST_OPTIONS } from '../util.js';
import { exerciseForm, categoryForm } from './forms.js';

export async function render([catId], ctx) {
  const cat = catId ? data.getCategory(catId) : null;
  if (!cat) {
    return h('div', { class: 'screen' },
      topbar({ title: t('library'), back: () => ctx.back('/more') }),
      h('div', { class: 'content' },
        h('div', { class: 'list' }, data.categories.map(c => h('button', { class: 'row', onclick: () => ctx.go('/library/' + c.id) },
          h('span', { class: 'dot', style: { background: c.color } }),
          h('span', { class: 'row-main' }, data.catName(c)),
          h('span', { class: 'row-count' }, data.exercisesInCategory(c.id).length),
          icon('right', 20)))),
        h('button', { class: 'btn big', onclick: async () => { if (await categoryForm(null)) ctx.refresh(); } }, icon('plus'), t('newCategory'))));
  }

  const exMenu = async ex => {
    const v = await chooser(data.exName(ex), [
      { label: t('editExercise'), value: 'edit' },
      { label: t('restTimer'), sub: ex.rest != null ? fmtRest(ex.rest) : t('restDefault', { v: fmtRest(data.settings.rest) }), value: 'rest' },
      { label: t('deleteExercise'), value: 'delete', danger: true },
    ]);
    if (v === 'edit') { if (await exerciseForm(ex)) ctx.refresh(); }
    if (v === 'rest') {
      const r = await chooser(t('restTimer'), [{ label: t('useDefault', { v: fmtRest(data.settings.rest) }), value: 'default', selected: ex.rest == null }, ...REST_OPTIONS.map(s => ({ label: fmtRest(s), value: s, selected: ex.rest === s }))]);
      if (r === undefined) return;
      const out = { ...ex };
      if (r === 'default') delete out.rest; else out.rest = r;
      await data.saveExercise(out);
      ctx.refresh();
    }
    if (v === 'delete') {
      const n = await data.countSets(ex.id);
      const msg = n ? t('deleteExerciseConfirmSets', { name: data.exName(ex), n }) : t('deleteExerciseConfirm', { name: data.exName(ex) });
      if (!(await confirmDialog(msg, { ok: t('delete'), danger: true }))) return;
      await data.deleteExercise(ex.id);
      toast(t('deleted'));
      ctx.refresh();
    }
  };
  const catMenu = async () => {
    const v = await chooser(data.catName(cat), [{ label: t('renameCategory'), value: 'rename' }, { label: t('deleteCategory'), value: 'delete', danger: true }]);
    if (v === 'rename') { if (await categoryForm(cat)) ctx.refresh(); }
    if (v === 'delete') {
      if (!(await data.deleteCategory(cat.id))) return toast(t('categoryNotEmpty'), { kind: 'error' });
      ctx.back('/library');
    }
  };

  return h('div', { class: 'screen' },
    topbar({ title: data.catName(cat), back: () => ctx.back('/library'), actions: [{ icon: 'more', label: t('menu'), onclick: catMenu }] }),
    h('div', { class: 'content' },
      h('div', { class: 'list' }, data.exercisesInCategory(cat.id).map(ex => h('button', { class: 'row', onclick: () => exMenu(ex) },
        h('span', { class: 'row-main' }, data.exName(ex), ex.rest != null && h('div', { class: 'row-sub' }, t('restTimer') + ': ' + fmtRest(ex.rest))),
        icon('more', 20)))),
      h('button', { class: 'btn big', onclick: async () => { if (await exerciseForm(null, { categoryId: cat.id })) ctx.refresh(); } }, icon('plus'), t('newExercise'))));
}
