// Routines (workout templates): list, edit sets/reps per exercise, start.
import { h, icon, topbar, formDialog, confirmDialog, toast, miniStepper } from '../ui.js';
import * as data from '../data.js';
import { t } from '../i18n.js';
import { toISODate } from '../util.js';

async function start(id, ctx) {
  const today = toISODate();
  const n = await data.startRoutine(id, today);
  toast(t('setsPlanned', { n }));
  ctx.setDate(today);
}

const totalSets = r => r.exercises.reduce((a, e) => a + e.sets, 0);
const firstColor = r => data.getCategory(data.getExercise(r.exercises[0]?.id)?.categoryId)?.color;

export async function renderList(_, ctx) {
  const list = [...data.routines].sort((a, b) => a.name.localeCompare(b.name));
  const create = async () => {
    const v = await formDialog(t('newRoutine'), [{ name: 'name', label: t('routineName'), required: true, maxlength: 40 }], t('create'));
    if (!v) return;
    const r = await data.saveRoutine({ name: v.name, exercises: [] });
    ctx.go('/routine/' + r.id);
  };
  return h('div', { class: 'screen' },
    topbar({ title: t('nav_routines'), actions: [{ icon: 'plus', label: t('newRoutine'), onclick: create }] }),
    h('div', { class: 'content' },
      list.length ? list.map(r => h('div', { class: 'card routine-card', style: { '--c': firstColor(r) || 'var(--accent)' } },
        h('button', { class: 'routine-main', onclick: () => ctx.go('/routine/' + r.id) },
          h('div', { class: 'card-title' }, r.name),
          h('div', { class: 'muted small' }, r.exercises.length
            ? `${t('nExercises', { n: r.exercises.length })} · ${t('nSets', { n: totalSets(r) })}`
            : t('noExercisesYet')),
          h('div', { class: 'small', style: { marginTop: '4px' } }, r.exercises.map(e => data.getExercise(e.id)).filter(Boolean).map(data.exName).slice(0, 4).join(' · ') + (r.exercises.length > 4 ? ' …' : ''))),
        r.exercises.length > 0 && h('button', { class: 'btn primary', 'aria-label': t('start') + ' ' + r.name, onclick: () => start(r.id, ctx) }, icon('play', 18), t('start'))))
        : h('div', { class: 'empty' }, t('noRoutines')),
      h('button', { class: 'btn big outline', onclick: create }, icon('plus'), t('newRoutine')),
      list.length > 0 && h('p', { class: 'muted small center' }, t('routinesHint'))));
}

export async function renderEdit([id], ctx) {
  const r = data.getRoutine(id);
  if (!r) { ctx.go('/routines', { replace: true }); return h('div'); }
  const items = r.exercises.filter(e => data.getExercise(e.id));
  const save = async exercises => { await data.saveRoutine({ ...r, exercises }); ctx.refresh(); };
  const patch = (i, change) => save(items.map((e, j) => (j === i ? { ...e, ...change } : e)));
  const move = (i, d) => { const next = [...items]; [next[i], next[i + d]] = [next[i + d], next[i]]; save(next); };
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

  return h('div', { class: 'screen' },
    topbar({ title: r.name, sub: items.length ? `${t('nExercises', { n: items.length })} · ${t('nSets', { n: totalSets({ exercises: items }) })}` : null, back: () => ctx.back('/routines'), actions: [{ icon: 'edit', label: t('renameRoutine'), onclick: rename }] }),
    h('div', { class: 'content' },
      items.length > 0 && h('button', { class: 'btn primary big', onclick: () => start(r.id, ctx) }, icon('play'), t('startThisRoutine')),
      items.map((e, i) => {
        const ex = data.getExercise(e.id);
        const cat = data.getCategory(ex.categoryId);
        return h('div', { class: 'card ex-card', style: { '--c': cat?.color || 'var(--accent)', padding: '10px 8px 12px 14px' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
            h('div', { class: 'card-title', style: { flex: 1, minWidth: 0 } }, `${i + 1}. ${data.exName(ex)}`),
            h('button', { class: 'icon-btn small', 'aria-label': t('moveUp'), disabled: i === 0, onclick: () => move(i, -1) }, icon('up', 20)),
            h('button', { class: 'icon-btn small', 'aria-label': t('moveDown'), disabled: i === items.length - 1, onclick: () => move(i, 1) }, icon('down', 20)),
            h('button', { class: 'icon-btn small', 'aria-label': t('remove'), onclick: () => save(items.filter((_, j) => j !== i)) }, icon('close', 20))),
          h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' } },
            h('span', { class: 'small muted' }, t('setsWord')),
            miniStepper(e.sets, { min: 1, max: 20, label: t('setsWord'), onchange: v => patch(i, { sets: v }) }),
            h('span', { class: 'small muted' }, t('reps')),
            miniStepper(e.reps || 0, { min: 0, max: 100, empty: t('auto'), label: t('reps'), onchange: v => patch(i, { reps: v || undefined }) })));
      }),
      !items.length && h('div', { class: 'empty' }, t('noExercisesYet')),
      h('button', { class: 'btn big', onclick: () => { ctx.state.pickFor = { routineId: r.id }; ctx.go('/pick'); } }, icon('plus'), t('addExercise')),
      h('p', { class: 'muted small' }, t('routineRepsHint')),
      h('button', { class: 'btn danger full', onclick: remove }, icon('trash'), t('deleteRoutine'))));
}
