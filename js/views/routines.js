// Routines (workout templates): list, edit, start.
import { h, icon, topbar, formDialog, confirmDialog, toast } from '../ui.js';
import * as data from '../data.js';
import { t } from '../i18n.js';
import { toISODate } from '../util.js';

async function start(id, ctx) {
  await data.startRoutine(id);
  ctx.setDate(toISODate());
}

export async function renderList(_, ctx) {
  const list = [...data.routines].sort((a, b) => a.name.localeCompare(b.name));
  const create = async () => {
    const v = await formDialog(t('newRoutine'), [{ name: 'name', label: t('routineName'), required: true, maxlength: 40 }], t('create'));
    if (!v) return;
    const r = await data.saveRoutine({ name: v.name, items: [] });
    ctx.go('/routine/' + r.id);
  };
  return h('div', { class: 'screen' },
    topbar({ title: t('nav_routines') }),
    h('div', { class: 'content' },
      list.length ? list.map(r => h('div', { class: 'card routine-card' },
        h('button', { class: 'routine-main', onclick: () => ctx.go('/routine/' + r.id) },
          h('div', { class: 'card-title' }, r.name),
          h('div', { class: 'muted small' }, r.items.map(id => data.getExercise(id)).filter(Boolean).map(data.exName).join(' · ') || t('noExercisesYet'))),
        r.items.length > 0 && h('button', { class: 'btn primary', onclick: () => start(r.id, ctx) }, t('start'))))
        : h('div', { class: 'empty' }, t('noRoutines')),
      h('button', { class: 'btn big', onclick: create }, icon('plus'), t('newRoutine'))));
}

export async function renderEdit([id], ctx) {
  const r = data.getRoutine(id);
  if (!r) { ctx.go('/routines', { replace: true }); return h('div'); }
  const save = async items => { await data.saveRoutine({ ...r, items }); ctx.refresh(); };
  const move = (i, d) => { const items = [...r.items]; [items[i], items[i + d]] = [items[i + d], items[i]]; save(items); };
  const rename = async () => {
    const v = await formDialog(t('renameRoutine'), [{ name: 'name', label: t('routineName'), value: r.name, required: true, maxlength: 40 }]);
    if (v) { await data.saveRoutine({ ...r, name: v.name }); ctx.refresh(); }
  };
  const remove = async () => {
    if (!(await confirmDialog(t('deleteRoutineConfirm', { name: r.name }), { ok: t('delete'), danger: true }))) return;
    await data.deleteRoutine(r.id);
    toast(t('deleted'));
    ctx.back('/routines');
  };
  const items = r.items.filter(i => data.getExercise(i));

  return h('div', { class: 'screen' },
    topbar({ title: r.name, back: () => ctx.back('/routines'), actions: [{ icon: 'edit', label: t('renameRoutine'), onclick: rename }] }),
    h('div', { class: 'content' },
      items.length > 0 && h('button', { class: 'btn primary big', onclick: () => start(r.id, ctx) }, t('startThisRoutine')),
      h('div', { class: 'list' }, items.map((exId, i) => h('div', { class: 'row' },
        h('span', { class: 'set-n' }, i + 1),
        h('span', { class: 'row-main' }, data.exName(data.getExercise(exId))),
        h('button', { class: 'icon-btn', 'aria-label': t('moveUp'), disabled: i === 0, onclick: () => move(i, -1) }, icon('up')),
        h('button', { class: 'icon-btn', 'aria-label': t('moveDown'), disabled: i === items.length - 1, onclick: () => move(i, 1) }, icon('down')),
        h('button', { class: 'icon-btn', 'aria-label': t('remove'), onclick: () => save(items.filter(x => x !== exId)) }, icon('close'))))),
      !items.length && h('div', { class: 'empty' }, t('noExercisesYet')),
      h('button', { class: 'btn big', onclick: () => { ctx.state.pickFor = { routineId: r.id }; ctx.go('/pick'); } }, icon('plus'), t('addExercise')),
      h('button', { class: 'btn danger full', onclick: remove }, icon('trash'), t('deleteRoutine'))));
}
