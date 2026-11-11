// Routines (workout templates): list, edit sets/reps per exercise, start.
import { h, icon, topbar, formDialog, confirmDialog, toast, miniStepper, chooser } from '../ui.js';
import * as data from '../data.js';
import { t, fmtNum } from '../i18n.js';
import { toISODate, parseNum, norm } from '../util.js';
import { TEMPLATES } from '../templates.js';

async function start(id, ctx) {
  const today = toISODate();
  const n = await data.startRoutine(id, today);
  toast(t('setsPlanned', { n }));
  ctx.setDate(today);
}

const totalSets = r => r.exercises.reduce((a, e) => a + e.sets, 0);
const firstColor = r => data.getCategory(data.getExercise(r.exercises[0]?.id)?.categoryId)?.color;

export async function renderList(_, ctx) {
  const groups = data.routineGroups();
  const nexts = new Map(await Promise.all(groups.filter(g => g.group).map(async g => [g.group, (await data.nextDay(g.group))?.id])));
  const create = async () => {
    const v = await formDialog(t('newRoutine'), [{ name: 'name', label: t('routineName'), required: true, maxlength: 40 }], t('create'));
    if (!v) return;
    const r = await data.saveRoutine({ name: v.name, exercises: [] });
    ctx.go('/routine/' + r.id);
  };
  const addDay = async g => {
    const v = await formDialog(t('addDay'), [{ name: 'name', label: t('dayName'), value: t('dayN', { n: g.days.length + 1 }), required: true, maxlength: 40 }], t('create'));
    if (!v) return;
    const r = await data.saveRoutine({ name: v.name, group: g.group, order: Math.max(0, ...g.days.map(d => d.order || 0)) + 1, exercises: [] });
    ctx.go('/routine/' + r.id);
  };
  const summary = r => (r.exercises.length ? `${t('nExercises', { n: r.exercises.length })} · ${t('nSets', { n: totalSets(r) })}` : t('noExercisesYet'));
  const names = r => r.exercises.map(e => data.getExercise(e.id)).filter(Boolean).map(data.exName).slice(0, 4).join(' · ') + (r.exercises.length > 4 ? ' …' : '');
  const startBtn = (r, primary) => r.exercises.length > 0 && h('button', { class: 'btn ' + (primary ? 'primary' : 'outline'), 'aria-label': t('start') + ' ' + data.routineLabel(r), onclick: () => start(r.id, ctx) }, icon('play', 18), t('start'));

  const single = r => h('div', { class: 'card routine-card', style: { '--c': firstColor(r) || 'var(--accent)' } },
    h('button', { class: 'routine-main', onclick: () => ctx.go('/routine/' + r.id) },
      h('div', { class: 'card-title' }, r.name),
      h('div', { class: 'muted small' }, summary(r)),
      h('div', { class: 'small', style: { marginTop: '4px' } }, names(r))),
    startBtn(r, true),
    h('button', { class: 'icon-btn small', 'aria-label': t('menu'), onclick: () => routineMenu(r, ctx) }, icon('more', 20)));

  const multi = g => h('div', { class: 'card group-card' },
    h('div', { class: 'group-head' }, h('div', { class: 'card-title' }, g.group), h('span', { class: 'muted small' }, t('nDays', { n: g.days.length })),
      h('button', { class: 'icon-btn small', 'aria-label': t('menu'), onclick: () => groupMenu(g, ctx) }, icon('more', 20))),
    g.days.map(r => {
      const isNext = nexts.get(g.group) === r.id;
      return h('div', { class: 'day-row' + (isNext ? ' next' : ''), style: { '--c': firstColor(r) || 'var(--accent)' } },
        h('button', { class: 'routine-main', onclick: () => ctx.go('/routine/' + r.id) },
          h('div', { class: 'day-name' }, r.name, isNext && h('span', { class: 'next-tag' }, t('nextUp'))),
          h('div', { class: 'muted small' }, summary(r)),
          h('div', { class: 'small', style: { marginTop: '2px' } }, names(r))),
        startBtn(r, isNext));
    }),
    h('button', { class: 'add-set', style: { marginTop: '6px' }, onclick: () => addDay(g) }, icon('plus', 18), t('addDay')));

  return h('div', { class: 'screen' },
    topbar({ title: t('nav_routines'), actions: [{ icon: 'plus', label: t('newRoutine'), onclick: create }] }),
    h('div', { class: 'content' },
      groups.length ? groups.map(g => (g.group ? multi(g) : single(g.days[0]))) : h('div', { class: 'empty' }, t('noRoutines')),
      suggested(ctx),
      h('button', { class: 'btn big outline', onclick: create }, icon('plus'), t('newRoutine')),
      groups.length > 0 && h('p', { class: 'muted small center' }, t('routinesHint'))));
}

export async function renderEdit([id], ctx) {
  const r = data.getRoutine(id);
  if (!r) { ctx.go('/routines', { replace: true }); return h('div'); }
  const items = r.exercises.filter(e => data.getExercise(e.id));
  const save = async exercises => { await data.saveRoutine({ ...r, exercises }); ctx.refresh(); };
  const patch = (i, change) => save(items.map((e, j) => (j === i ? { ...e, ...change } : e)));
  const move = (i, d) => { const next = [...items]; [next[i], next[i + d]] = [next[i + d], next[i]]; save(next); };
  const rename = () => renameRoutine(r, ctx);
  const remove = async () => {
    if (!(await confirmDialog(t('deleteRoutineConfirm', { name: r.name }), { ok: t('delete'), danger: true }))) return;
    await data.deleteRoutine(r.id);
    toast(t('deleted'));
    ctx.back('/routines');
  };

  return h('div', { class: 'screen' },
    topbar({ title: r.name, sub: [r.group, items.length && `${t('nExercises', { n: items.length })} · ${t('nSets', { n: totalSets({ exercises: items }) })}`].filter(Boolean).join(' · ') || null, back: () => ctx.back('/routines'), actions: [{ icon: 'edit', label: r.group ? t('renameDay') : t('renameRoutine'), onclick: rename }] }),
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
          h('div', { class: 'plan-row' },
            h('div', { class: 'plan-cell' }, h('span', { class: 'field-label' }, t('setsWord')),
              miniStepper(e.sets, { min: 1, max: 20, label: t('setsWord'), onchange: v => patch(i, { sets: v }) })),
            h('div', { class: 'plan-cell' }, h('span', { class: 'field-label' }, t('reps')),
              miniStepper(e.reps || 0, { min: 0, max: 100, empty: t('auto'), label: t('reps'), onchange: v => patch(i, { reps: v || undefined }) }))));
      }),
      !items.length && h('div', { class: 'empty' }, t('noExercisesYet')),
      h('button', { class: 'btn big', onclick: () => { ctx.state.pickFor = { routineId: r.id }; ctx.go('/pick'); } }, icon('plus'), t('addExercise')),
      h('p', { class: 'muted small' }, t('routineRepsHint')),
      h('button', { class: 'btn danger full', onclick: remove }, icon('trash'), t('deleteRoutine'))));
}

// ---------------------------------------------------------------- menus
async function renameRoutine(r, ctx) {
  const v = await formDialog(r.group ? t('renameDay') : t('renameRoutine'), [{ name: 'name', label: r.group ? t('dayName') : t('routineName'), value: r.name, required: true, maxlength: 40 }]);
  if (v) { await data.saveRoutine({ ...r, name: v.name }); toast(t('saved')); ctx.refresh(); }
}
async function deleteRoutine(r, ctx) {
  if (!(await confirmDialog(t('deleteRoutineConfirm', { name: data.routineLabel(r) }), { ok: t('delete'), danger: true }))) return false;
  await data.deleteRoutine(r.id);
  toast(t('deleted'));
  ctx.refresh();
  return true;
}
async function routineMenu(r, ctx) {
  const v = await chooser(r.name, [
    { label: t('editRoutine'), sub: t('editRoutineSub'), value: 'edit' },
    { label: t('renameRoutine'), value: 'rename' },
    { label: t('deleteRoutine'), value: 'delete', danger: true },
  ]);
  if (v === 'edit') ctx.go('/routine/' + r.id);
  if (v === 'rename') renameRoutine(r, ctx);
  if (v === 'delete') deleteRoutine(r, ctx);
}
async function groupMenu(g, ctx) {
  const v = await chooser(g.group, [
    { label: t('renameRoutine'), value: 'rename' },
    ...g.days.map(d => ({ label: t('renameDayX', { name: d.name }), value: 'day:' + d.id })),
    { label: t('deleteWholeRoutine', { n: g.days.length }), value: 'delete', danger: true },
  ]);
  if (v === 'rename') {
    const res = await formDialog(t('renameRoutine'), [{ name: 'name', label: t('routineName'), value: g.group, required: true, maxlength: 40 }]);
    if (res && res.name !== g.group) { await data.renameGroup(g.group, res.name); toast(t('saved')); ctx.refresh(); }
  } else if (v === 'delete') {
    if (!(await confirmDialog(t('deleteRoutineConfirm', { name: g.group }), { ok: t('delete'), danger: true }))) return;
    await data.deleteGroup(g.group);
    toast(t('deleted'));
    ctx.refresh();
  } else if (v?.startsWith('day:')) renameRoutine(data.getRoutine(v.slice(4)), ctx);
}

// ---------------------------------------------------------------- suggested routines
function suggested(ctx) {
  const have = new Set(data.routines.map(r => norm(r.group || r.name)));
  const list = TEMPLATES.filter(tp => !have.has(norm(tp.pack.group || tp.pack.days[0].name)));
  if (!list.length) return null;
  return [
    h('h3', { class: 'section' }, t('suggestedRoutines')),
    list.map(tp => h('div', { class: 'card group-card' },
      h('div', { class: 'group-head' }, h('div', { class: 'card-title' }, tp.pack.group || tp.pack.days[0].name), h('span', { class: 'muted small' }, t('nDays', { n: tp.pack.days.length }))),
      tp.pack.days.map(d => h('div', { class: 'day-row', style: { '--c': 'var(--accent)' } },
        h('div', { class: 'routine-main' },
          h('div', { class: 'day-name' }, d.name),
          h('div', { class: 'small', style: { marginTop: '2px' } }, d.exercises.map(e => e.name + (e.bodyweight ? ` (${t('bwShort')})` : '')).join(' · '))))),
      h('button', { class: 'btn primary full', style: { marginTop: '10px' }, onclick: () => addTemplate(tp, ctx) }, icon('plus'), t('addThisRoutine')))),
  ];
}

async function addTemplate(tp, ctx) {
  const pack = { ...tp.pack };
  if (pack.days.some(d => d.exercises.some(e => e.bodyweight))) {
    const last = data.bodyweightAt(toISODate());
    const v = await formDialog(t('yourBodyweight'), [{ name: 'kg', label: t('yourBodyweightHint'), value: last != null ? String(last) : '', inputmode: 'decimal', required: true, maxlength: 6 }], t('addRoutineBtn'));
    if (!v) return;
    const kg = parseNum(v.kg);
    if (!(kg > 20 && kg < 400)) return toast(t('invalidBodyweight'), { kind: 'error' });
    pack.bodyweight = Math.round(kg * 100) / 100;
  }
  const replaceable = (pack.replaces || []).flatMap(n => data.routinesNamed(n));
  let replaceOld = false;
  if (replaceable.length) {
    const names = [...new Set(replaceable.map(r => r.group || r.name.split(' – ')[0]))].join(', ');
    replaceOld = await confirmDialog(t('replaceOldAsk', { names }), { ok: t('replace') });
  }
  const res = await data.addRoutinePack(pack, { replaceOld });
  toast(t('routineAdded', { name: pack.group || pack.days[0].name }), { ms: 4000 });
  if (res.converted) setTimeout(() => toast(t('bwConverted', { n: res.converted }), { ms: 4000 }), 1200);
  if (res.bodyweight) setTimeout(() => toast(t('bodyweightSaved', { kg: fmtNum(res.bodyweight) }), { ms: 3500 }), 2600);
  ctx.refresh();
}
