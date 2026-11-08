// Main screen: the workout of one day.
import { h, icon, chooser, formDialog, toast } from '../ui.js';
import * as data from '../data.js';
import { t, fmtSet, fmtDayTitle, fmtLong, fmtShort } from '../i18n.js';
import { toISODate, addDays } from '../util.js';
import { markPRs } from '../stats.js';
import { openCheckin } from '../checkin.js';

export async function render(_, ctx) {
  const date = ctx.state.date;
  const today = toISODate();
  const [sets, session] = await Promise.all([data.setsForDate(date), data.getSession(date)]);
  const backupDue = date === today && data.needsBackup();

  const groups = new Map();
  for (const s of sets) {
    if (!groups.has(s.exerciseId)) groups.set(s.exerciseId, []);
    groups.get(s.exerciseId).push(s);
  }
  const routine = session?.routineId ? data.getRoutine(session.routineId) : null;
  const order = [...new Set([...(routine?.items || []), ...groups.keys()])].filter(id => data.getExercise(id));
  const prIds = new Set();
  await Promise.all([...groups.keys()].map(async id => {
    for (const sid of markPRs(await data.setsForExercise(id)).keys()) prIds.add(sid);
  }));

  // ----- actions -----
  const finish = async () => { if (await openCheckin(date)) ctx.refresh(); };
  const pickRoutine = async () => {
    const id = await chooser(t('startRoutine'), data.routines.map(r => ({ label: r.name, sub: t('nExercises', { n: r.items.length }), value: r.id })));
    if (!id) return;
    await data.startRoutine(id);
    ctx.setDate(today);
  };
  const saveAsRoutine = async () => {
    const v = await formDialog(t('saveAsRoutine'), [{ name: 'name', label: t('routineName'), value: t('defaultRoutineName', { date: fmtShort(date) }), required: true, maxlength: 40 }]);
    if (!v) return;
    await data.saveRoutine({ name: v.name, items: order.filter(id => groups.has(id)) });
    toast(t('routineSaved'));
  };
  const menu = async () => {
    const opts = [];
    if (date !== today) opts.push({ label: t('goToday'), value: 'today' });
    if (data.routines.length) opts.push({ label: t('startRoutine'), value: 'routine' });
    if (groups.size) opts.push({ label: t('saveAsRoutine'), value: 'save' });
    if (groups.size) opts.push({ label: session?.finishedAt ? t('editCheckin') : t('finishWorkout'), value: 'finish' });
    if (!opts.length) opts.push({ label: t('goToday'), value: 'today' });
    const v = await chooser(null, opts);
    if (v === 'today') ctx.setDate(today);
    else if (v === 'routine') pickRoutine();
    else if (v === 'save') saveAsRoutine();
    else if (v === 'finish') finish();
  };

  // ----- header with day navigation -----
  const dateInput = h('input', { type: 'date', class: 'sr-date', value: date, tabindex: '-1', 'aria-hidden': 'true', onchange: e => e.target.value && ctx.setDate(e.target.value) });
  const openPicker = () => { try { dateInput.showPicker(); } catch { dateInput.click(); } };
  const header = h('header', { class: 'topbar' },
    h('button', { class: 'icon-btn', 'aria-label': t('prevDay'), onclick: () => ctx.setDate(addDays(date, -1)) }, icon('left')),
    h('button', { class: 'topbar-title center', onclick: openPicker },
      h('div', { class: 'title' }, fmtDayTitle(date)),
      h('div', { class: 'sub' }, fmtLong(date))),
    h('button', { class: 'icon-btn', 'aria-label': t('nextDay'), onclick: () => ctx.setDate(addDays(date, 1)) }, icon('right')),
    h('button', { class: 'icon-btn', 'aria-label': t('menu'), onclick: menu }, icon('more')),
    dateInput);

  // ----- exercise cards -----
  const cards = order.map(id => {
    const ex = data.getExercise(id);
    const list = groups.get(id) || [];
    const cat = data.getCategory(ex.categoryId);
    return h('button', { class: 'card ex-card' + (list.length ? '' : ' pending'), style: { '--c': cat?.color || 'var(--muted)' }, onclick: () => ctx.go('/ex/' + id) },
      h('div', { class: 'card-title' }, data.exName(ex)),
      list.length
        ? h('div', { class: 'chips' }, list.map(s => h('span', { class: 'chip' + (prIds.has(s.id) ? ' pr' : '') }, prIds.has(s.id) ? '🏆 ' : '', fmtSet(s))))
        : h('div', { class: 'muted small' }, t('notStarted')));
  });

  const v = k => (session?.[k] ? session[k] + '/5' : '–');
  const summary = session?.finishedAt && h('button', { class: 'card summary', onclick: finish },
    h('div', { class: 'card-title' }, '✓ ' + t('workoutFinished')),
    h('div', { class: 'muted small' }, `${t('mood')} ${v('mood')} · ${t('motivation')} ${v('motivation')} · ${t('satisfaction')} ${v('satisfaction')}`),
    session.note && h('div', { class: 'note' }, '“' + session.note + '”'));

  const body = h('div', { class: 'content' },
    backupDue && h('div', { class: 'banner warn' },
      h('div', {}, backupDue === 'never' ? t('backupNever') : t('backupOld', { n: backupDue })),
      h('button', { class: 'btn small', onclick: () => ctx.go('/more') }, t('backupNow')),
      h('button', { class: 'icon-btn small', 'aria-label': t('later'), onclick: async () => { await data.snoozeBackup(); ctx.refresh(); } }, icon('close', 20))),
    routine && h('div', { class: 'muted small' }, t('fromRoutine', { name: routine.name })),
    cards.length ? cards : h('div', { class: 'empty' }, date === today ? t('emptyToday') : t('emptyDay')),
    h('button', { class: 'btn primary big', onclick: () => { ctx.state.pickFor = null; ctx.go('/pick'); } }, icon('plus'), t('addExercise')),
    !sets.length && !routine && data.routines.length > 0 && h('button', { class: 'btn big', onclick: pickRoutine }, t('startRoutine')),
    sets.length > 0 && (summary || h('button', { class: 'btn big', onclick: finish }, icon('check'), t('finishWorkout'))));

  return h('div', { class: 'screen' }, header, body);
}
