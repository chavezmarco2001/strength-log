// Main screen: the workout of one day — week strip, summary, exercises with ✓ sets.
import { h, icon, chooser, formDialog, confirmDialog, toast } from '../ui.js';
import * as data from '../data.js';
import { t, fmtNum, fmtDayTitle, fmtLong, fmtShort, fmtDate } from '../i18n.js';
import { toISODate, addDays, weekStart } from '../util.js';
import { markPRs, workoutMinutes } from '../stats.js';
import { openCheckin } from '../checkin.js';
import { toggleDone, addPlannedSet } from '../actions.js';
import { setTable, catDots, groupByExercise } from './components.js';
import { focusSet } from './log.js';

export async function render(_, ctx) {
  const date = ctx.state.date;
  const today = toISODate();
  const w0 = weekStart(date);
  const [sets, session, weekSets] = await Promise.all([data.setsForDate(date), data.getSession(date), data.setsInRange(w0, addDays(w0, 6))]);
  const backupDue = date === today && data.needsBackup();
  const routine = session?.routineId ? data.getRoutine(session.routineId) : null;

  const groups = groupByExercise(sets);
  const ids = [...groups.keys()].filter(id => data.getExercise(id));
  const [prev, prIds] = await Promise.all([
    Promise.all(ids.map(id => data.lastSessionSets(id, date))),
    Promise.all(ids.map(async id => markPRs(data.doneOnly(await data.setsForExercise(id))))).then(ms => new Set(ms.flatMap(m => [...m.keys()]))),
  ]);
  const done = sets.filter(data.isDone);
  const volume = done.reduce((a, s) => a + data.setVolume(s), 0);
  const minutes = workoutMinutes(done);

  // ----- actions -----
  const finish = async () => { if (await openCheckin(date)) ctx.refresh(); };
  const pickRoutine = async () => {
    if (!data.routines.length) return ctx.go('/routines');
    const groups = data.routineGroups();
    const nexts = new Set((await Promise.all(groups.filter(g => g.group).map(g => data.nextDay(g.group)))).filter(Boolean).map(r => r.id));
    const id = await chooser(t('startRoutine'), groups.flatMap(g => g.days).map(r => ({
      label: (nexts.has(r.id) ? '▶ ' : '') + data.routineLabel(r) + (nexts.has(r.id) ? ' · ' + t('nextUp') : ''),
      sub: r.exercises.map(e => data.getExercise(e.id)).filter(Boolean).map(data.exName).join(' · '), value: r.id,
    })));
    if (!id) return;
    const n = await data.startRoutine(id, date);
    toast(t('setsPlanned', { n }));
    ctx.refresh();
  };
  const repeat = async () => {
    const days = (await data.workoutDays(25)).filter(d => d.date !== date);
    if (!days.length) return toast(t('noWorkouts'));
    const from = await chooser(t('repeatWorkout'), days.map(d => ({
      label: fmtLong(d.date), value: d.date,
      sub: d.exerciseIds.map(id => data.getExercise(id)).filter(Boolean).map(data.exName).slice(0, 4).join(' · ') + ` · ${t('nSets', { n: d.sets })}`,
    })));
    if (!from) return;
    const n = await data.repeatWorkout(from, date);
    toast(t('setsPlanned', { n }));
    ctx.refresh();
  };
  const saveAsRoutine = async () => {
    const v = await formDialog(t('saveAsRoutine'), [{ name: 'name', label: t('routineName'), value: t('defaultRoutineName', { date: fmtShort(date) }), required: true, maxlength: 40 }]);
    if (!v) return;
    await data.routineFromDay(date, v.name);
    toast(t('routineSaved'));
  };
  const clearPlanned = async () => {
    const planned = sets.filter(s => !data.isDone(s));
    if (!(await confirmDialog(t('clearPlannedConfirm', { n: planned.length }), { ok: t('delete'), danger: true }))) return;
    for (const s of planned) await data.deleteSet(s.id);
    ctx.refresh();
  };
  const menu = async () => {
    const opts = [];
    if (date !== today) opts.push({ label: t('goToday'), value: 'today' });
    opts.push({ label: t('startRoutine'), value: 'routine' }, { label: t('repeatWorkout'), value: 'repeat' });
    if (done.length) opts.push({ label: t('saveAsRoutine'), value: 'save' }, { label: session?.finishedAt ? t('editCheckin') : t('finishWorkout'), value: 'finish' });
    if (sets.some(s => !data.isDone(s))) opts.push({ label: t('clearPlanned'), value: 'clear', danger: true });
    const v = await chooser(null, opts);
    ({ today: () => ctx.setDate(today), routine: pickRoutine, repeat, save: saveAsRoutine, finish, clear: clearPlanned })[v]?.();
  };

  // ----- header + week strip -----
  const dateInput = h('input', { type: 'date', class: 'sr-date', value: date, tabindex: '-1', 'aria-hidden': 'true', onchange: e => e.target.value && ctx.setDate(e.target.value) });
  const openPicker = () => { try { dateInput.showPicker(); } catch { dateInput.click(); } };
  const header = h('header', { class: 'topbar' },
    h('button', { class: 'icon-btn', 'aria-label': t('prevDay'), onclick: () => ctx.setDate(addDays(date, -1)) }, icon('left')),
    h('button', { class: 'topbar-title center', onclick: openPicker }, h('div', { class: 'title' }, fmtDayTitle(date)), h('div', { class: 'sub' }, fmtLong(date))),
    h('button', { class: 'icon-btn', 'aria-label': t('nextDay'), onclick: () => ctx.setDate(addDays(date, 1)) }, icon('right')),
    h('button', { class: 'icon-btn', 'aria-label': t('menu'), onclick: menu }, icon('more')),
    dateInput);
  const week = h('div', { class: 'week' }, Array.from({ length: 7 }, (_, i) => {
    const d = addDays(w0, i);
    return h('button', { class: 'day' + (d === date ? ' sel' : '') + (d === today ? ' today' : ''), onclick: () => d !== date && ctx.setDate(d), 'aria-label': fmtLong(d) },
      fmtDate(d, { weekday: 'narrow' }), h('b', {}, Number(d.slice(8))), catDots(data.doneOnly(weekSets.filter(s => s.date === d))));
  }));

  // ----- hero / quick actions -----
  let top;
  if (sets.length) {
    const pct = Math.round((done.length / sets.length) * 100);
    top = h('div', { class: 'hero' },
      h('div', { class: 'hero-label' }, routine ? routine.group || t('routine') : date === today ? t('todaysWorkout') : t('workout')),
      h('div', { class: 'hero-title' }, routine ? routine.name : t('nExercises', { n: ids.length })),
      h('div', { class: 'hero-stats' },
        h('div', {}, h('b', {}, `${done.length}/${sets.length}`), h('span', {}, t('setsWord'))),
        h('div', {}, h('b', {}, fmtNum(Math.round(volume))), h('span', {}, t('kgVolume'))),
        minutes && h('div', {}, h('b', {}, minutes), h('span', {}, t('minutes')))),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: { width: pct + '%' } })));
  } else {
    top = [
      h('div', { class: 'hero' },
        h('div', { class: 'hero-label' }, fmtDayTitle(date)),
        h('div', { class: 'hero-title' }, date === today ? t('readyToTrain') : t('emptyDay')),
        h('div', { class: 'small', style: { position: 'relative', zIndex: 1, opacity: 0.9 } }, t('heroHint'))),
      h('div', { class: 'quick' },
        h('button', { onclick: pickRoutine }, icon('play', 26), t('startRoutine')),
        h('button', { onclick: repeat }, icon('repeat', 26), t('repeatWorkout')),
        h('button', { onclick: () => { ctx.state.pickFor = null; ctx.go('/pick'); } }, icon('plus', 26), t('addExercise'))),
    ];
  }

  // ----- exercise cards -----
  const cards = ids.map((id, k) => {
    const ex = data.getExercise(id);
    const list = groups.get(id);
    const cat = data.getCategory(ex.categoryId);
    const nDone = list.filter(data.isDone).length;
    return h('div', { class: 'card ex-card', style: { '--c': cat?.color || 'var(--accent)' } },
      h('button', { class: 'ex-head', onclick: () => ctx.go('/ex/' + id) },
        h('div', { class: 'card-title' }, data.exName(ex), h('div', { class: 'tag', style: { '--c': cat?.color } }, cat ? data.catName(cat) : '')),
        h('span', { class: 'count' + (nDone === list.length ? ' all' : '') }, `${nDone}/${list.length}`),
        icon('right', 20)),
      setTable({
        sets: list, prev: prev[k], prIds,
        onTick: async s => { await toggleDone(s); ctx.refresh(); },
        onRow: s => { focusSet(s.id); ctx.go('/ex/' + id); },
      }),
      h('button', { class: 'add-set', onclick: async () => { await addPlannedSet(id, date, sets); ctx.refresh(); } }, icon('plus', 18), t('addSet')));
  });

  const v = k => (session?.[k] ? session[k] + '/5' : '–');
  const summary = session?.finishedAt && h('button', { class: 'card', onclick: finish },
    h('div', { class: 'card-title' }, '✓ ' + t('workoutFinished')),
    h('div', { class: 'muted small' }, `${t('mood')} ${v('mood')} · ${t('motivation')} ${v('motivation')} · ${t('satisfaction')} ${v('satisfaction')}`),
    session.note && h('div', { class: 'note' }, '“' + session.note + '”'));

  const addExercise = () => { ctx.state.pickFor = null; ctx.go('/pick'); };
  const body = h('div', { class: 'content' },
    backupDue && h('div', { class: 'banner warn' },
      h('div', {}, backupDue === 'never' ? t('backupNever') : t('backupOld', { n: backupDue })),
      h('button', { class: 'btn small', onclick: () => ctx.go('/more') }, t('backupNow')),
      h('button', { class: 'icon-btn small', 'aria-label': t('later'), onclick: async () => { await data.snoozeBackup(); ctx.refresh(); } }, icon('close', 20))),
    top,
    cards,
    sets.length > 0 && h('button', { class: 'btn primary big', onclick: addExercise }, icon('plus'), t('addExercise')),
    done.length > 0 && (summary || h('button', { class: 'btn big outline', onclick: finish }, icon('check'), t('finishWorkout'))));

  return h('div', { class: 'screen' }, header, week, body);
}
