// Choose an exercise: recent ones, categories, search, or create a new one.
// Also used to add exercises to a routine (ctx.state.pickFor = { routineId }).
import { h, icon, topbar } from '../ui.js';
import * as data from '../data.js';
import { t } from '../i18n.js';
import { norm } from '../util.js';
import { exerciseForm } from './forms.js';

let query = '';

export async function render([catId], ctx) {
  const pickFor = ctx.state.pickFor;
  const cat = catId ? data.getCategory(catId) : null;
  const recent = !cat && !pickFor?.routineId ? await data.recentExercises(6) : [];

  async function choose(exId) {
    query = '';
    if (pickFor?.routineId) {
      await data.addToRoutine(pickFor.routineId, exId);
      ctx.state.pickFor = null;
      ctx.back('/routine/' + pickFor.routineId);
    } else if (pickFor?.mode === 'progress') {
      ctx.state.pickFor = null;
      ctx.go('/ex/' + exId + '/graph', { replace: true });
    } else ctx.go('/ex/' + exId, { replace: true });
  }

  const row = (e, showCat) => {
    const c = data.getCategory(e.categoryId);
    return h('button', { class: 'row', onclick: () => choose(e.id) },
      h('span', { class: 'dot', style: { background: c?.color || 'var(--muted)' } }),
      h('span', { class: 'row-main' }, data.exName(e), showCat && c && h('div', { class: 'row-sub' }, data.catName(c))));
  };
  const catRow = c => h('button', { class: 'row', onclick: () => ctx.go('/pick/' + c.id, { replace: true }) },
    h('span', { class: 'dot', style: { background: c.color } }),
    h('span', { class: 'row-main' }, data.catName(c)),
    h('span', { class: 'row-count' }, data.exercisesInCategory(c.id).length),
    icon('right', 20));

  const list = h('div', { class: 'list' });
  function fill() {
    const q = norm(query);
    const out = [];
    if (q) {
      const res = data.exercises.filter(e => norm(data.exName(e)).includes(q) || norm(e.name).includes(q)).sort(data.byExName);
      out.push(res.map(e => row(e, true)));
      if (!res.length) out.push(h('p', { class: 'muted pad' }, t('noResults')));
    } else if (cat) {
      out.push(data.exercisesInCategory(cat.id).map(e => row(e, false)));
    } else {
      if (recent.length) out.push(h('h3', { class: 'section' }, t('recent')), recent.map(e => row(e, true)));
      out.push(h('h3', { class: 'section' }, t('categories')), data.categories.map(catRow));
    }
    out.push(h('button', { class: 'btn big new-ex', onclick: newExercise }, icon('plus'), t('newExercise')));
    list.replaceChildren(...out.flat());
  }
  async function newExercise() {
    const ex = await exerciseForm(null, { name: query, categoryId: catId });
    if (ex) choose(ex.id);
  }

  const search = h('input', {
    class: 'input search', type: 'search', placeholder: t('searchExercises'), value: query, enterkeyhint: 'search', autocomplete: 'off',
    oninput: e => { query = e.target.value; fill(); },
  });
  fill();

  return h('div', { class: 'screen' },
    topbar({
      title: cat ? data.catName(cat) : pickFor?.routineId ? t('addToRoutine') : pickFor?.mode === 'progress' ? t('allExercises') : t('addExercise'),
      back: () => { if (cat) ctx.go('/pick', { replace: true }); else { query = ''; ctx.back(pickFor?.routineId ? '/routine/' + pickFor.routineId : pickFor?.mode === 'progress' ? '/progress' : '/'); } },
    }),
    h('div', { class: 'content' }, search, list));
}
