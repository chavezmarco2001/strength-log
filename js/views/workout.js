// Main screen: the workout of one day — week strip, summary, exercises with ✓ sets.
import { h, icon, chooser, formDialog, confirmDialog, toast, sheet, onLongPress, haptic } from '../ui.js';
import * as data from '../data.js';
import { t, fmtNum, fmtDayTitle, fmtLong, fmtShort, fmtDate } from '../i18n.js';
import { toISODate, addDays, weekStart } from '../util.js';
import { markPRs, workoutMinutes } from '../stats.js';
import { openCheckin } from '../checkin.js';
import { toggleDone, addPlannedSet } from '../actions.js';
import { setTable, catDots, groupByExercise } from './components.js';
import { focusSet } from './log.js';

let reorderFor = null;   // date being reordered (press-and-hold on an exercise)

export async function render(_, ctx) {
  const date = ctx.state.date;
  if (reorderFor && reorderFor !== date) reorderFor = null;
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
  const moveTo = async () => {
    const to = await pickDate(t('moveWorkoutTo'), date);
    if (!to) return;
    const n = await data.moveDay(date, to);
    toast(t('workoutMoved', { n, date: fmtLong(to) }), { ms: 4000, action: { label: t('undo'), fn: async () => { await data.moveDay(to, date); ctx.refresh(); } } });
    ctx.setDate(to);
  };
  const copyTo = async () => {
    const to = await pickDate(t('copyWorkoutTo'), date);
    if (!to) return;
    const n = await data.copyDay(date, to);
    toast(t('workoutCopied', { n, date: fmtLong(to) }), { ms: 4000 });
    ctx.setDate(to);
  };
  const deleteWorkout = async () => {
    if (!(await confirmDialog(t('deleteWorkoutConfirm', { n: sets.length, date: fmtLong(date) }), { ok: t('delete'), danger: true }))) return;
    const snap = await data.deleteDay(date);
    ctx.refresh();
    toast(t('workoutDeleted'), { ms: 6000, action: { label: t('undo'), fn: async () => { await data.undoDeleteDay(snap); ctx.refresh(); } } });
  };
  const menu = async () => {
    const opts = [];
    if (date !== today) opts.push({ label: t('goToday'), value: 'today' });
    opts.push({ label: t('startRoutine'), value: 'routine' }, { label: t('repeatWorkout'), sub: t('repeatWorkoutSub'), value: 'repeat' });
    if (sets.length) opts.push({ label: t('moveWorkoutTo'), value: 'move' }, { label: t('copyWorkoutTo'), value: 'copy' });
    if (done.length) opts.push({ label: t('saveAsRoutine'), value: 'save' }, { label: session?.finishedAt ? t('editCheckin') : t('finishWorkout'), value: 'finish' });
    if (sets.some(s => !data.isDone(s)) && done.length) opts.push({ label: t('clearPlanned'), value: 'clear', danger: true });
    if (sets.length) opts.push({ label: t('deleteWorkout'), sub: t('nSets', { n: sets.length }), value: 'delete', danger: true });
    const v = await chooser(null, opts);
    ({ today: () => ctx.setDate(today), routine: pickRoutine, repeat, move: moveTo, copy: copyTo, save: saveAsRoutine, finish, clear: clearPlanned, delete: deleteWorkout })[v]?.();
  };
  const tick = async s => {
    if (await toggleDone(s) === 'empty') { toast(t('enterValuesFirst')); focusSet(s.id); return ctx.go('/ex/' + s.exerciseId); }
    ctx.refresh();
  };
  const exMenu = async (id, list) => {
    const v = await chooser(data.exName(data.getExercise(id)), [
      { label: t('openExercise'), value: 'open' },
      ...(ids.length > 1 ? [{ label: t('reorderExercises'), sub: t('reorderHint'), value: 'reorder' }] : []),
      { label: t('removeFromWorkout'), sub: t('nSets', { n: list.length }), value: 'remove', danger: true },
    ]);
    if (v === 'open') ctx.go('/ex/' + id);
    if (v === 'reorder') { reorderFor = date; ctx.refresh(); }
    if (v === 'remove') {
      const removed = await data.removeExerciseFromDay(id, date);
      ctx.refresh();
      toast(t('exerciseRemoved'), { ms: 5000, action: { label: t('undo'), fn: async () => { await data.restoreSets(removed); ctx.refresh(); } } });
    }
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
    return onLongPress(h('div', { class: 'card ex-card', style: { '--c': cat?.color || 'var(--accent)' } },
      h('div', { class: 'ex-top' },
        h('button', { class: 'ex-head', onclick: () => ctx.go('/ex/' + id) },
          h('div', { class: 'card-title' }, data.exName(ex), h('div', { class: 'tag', style: { '--c': cat?.color } }, cat ? data.catName(cat) : '')),
          h('span', { class: 'count' + (nDone === list.length ? ' all' : '') }, `${nDone}/${list.length}`)),
        h('button', { class: 'icon-btn small', 'aria-label': t('menu'), onclick: () => exMenu(id, list) }, icon('more', 20))),
      setTable({
        sets: list, prev: prev[k], prIds,
        onTick: tick,
        onRow: s => { focusSet(s.id); ctx.go('/ex/' + id); },
      }),
      h('button', { class: 'add-set', onclick: async () => { await addPlannedSet(id, date, sets); ctx.refresh(); } }, icon('plus', 18), t('addSet'))),
    () => { if (ids.length > 1) { haptic(data.settings.vibrate, 30); reorderFor = date; ctx.refresh(); } });
  });

  const v = k => (session?.[k] ? session[k] + '/' + data.CHECKIN_SCALE : '–');
  const summary = session?.finishedAt && h('button', { class: 'card', onclick: finish },
    h('div', { class: 'card-title' }, '✓ ' + t('workoutFinished')),
    h('div', { class: 'muted small' }, `${t('mood')} ${v('mood')} · ${t('motivation')} ${v('motivation')} · ${t('satisfaction')} ${v('satisfaction')}`),
    session.tags?.length > 0 && h('div', { class: 'tag-list' }, session.tags.map(k => h('span', {}, t('tag_' + k)))),
    session.note && h('div', { class: 'note' }, '“' + session.note + '”'));

  const addExercise = () => { ctx.state.pickFor = null; ctx.go('/pick'); };
  if (reorderFor === date && ids.length > 1) return h('div', { class: 'screen' }, header, week, reorderView(ids, date, ctx));

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

/** Quick date choice: today / tomorrow / yesterday, or any date. Resolves 'YYYY-MM-DD' or null. */
async function pickDate(title, current) {
  const today = toISODate();
  const quick = [[today, t('today')], [addDays(today, 1), t('tomorrow')], [addDays(today, -1), t('yesterday')]].filter(([d]) => d !== current);
  const v = await chooser(title, [...quick.map(([d, label]) => ({ label, sub: fmtLong(d), value: d })), { label: t('pickDate'), value: 'pick' }]);
  if (v !== 'pick') return v || null;
  return sheet(close => {
    const input = h('input', { class: 'input', type: 'date', value: current });
    return h('div', { class: 'form' },
      h('h3', { class: 'sheet-title' }, title),
      input,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn big', onclick: () => close(null) }, t('cancel')),
        h('button', { class: 'btn big primary', onclick: () => close(input.value && input.value !== current ? input.value : null) }, t('ok'))));
  }).then(v2 => v2 || null);
}

/** Reorder mode: drag an exercise by its handle (≡) or use the arrows; changes save at once. */
function reorderView(ids, date, ctx) {
  const order = [...ids];
  const list = h('div', { class: 'reorder-list' });
  const save = () => data.reorderDay(date, order);
  const move = async (i, d) => { [order[i], order[i + d]] = [order[i + d], order[i]]; draw(); await save(); };

  const row = (id, i) => {
    const ex = data.getExercise(id);
    const cat = data.getCategory(ex.categoryId);
    const grip = h('span', { class: 'grip', 'aria-label': t('dragToMove') }, icon('menu', 22));
    const el = h('div', { class: 'reorder-row', style: { '--c': cat?.color || 'var(--accent)' } },
      grip,
      h('div', { class: 'row-main' }, h('div', { class: 'card-title' }, data.exName(ex)), h('div', { class: 'muted small' }, cat ? data.catName(cat) : '')),
      h('button', { class: 'icon-btn', 'aria-label': t('moveUp'), disabled: i === 0, onclick: () => move(i, -1) }, icon('up')),
      h('button', { class: 'icon-btn', 'aria-label': t('moveDown'), disabled: i === order.length - 1, onclick: () => move(i, 1) }, icon('down')));
    // drag by the handle (touch-action: none on .grip, so the page doesn't scroll)
    grip.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { grip.setPointerCapture(e.pointerId); } catch { /* moves are also followed on window */ }
      const pid = e.pointerId;
      const rows = [...list.children];
      const mids = rows.map(r => { const b = r.getBoundingClientRect(); return b.top + b.height / 2; });
      const startY = e.clientY, h0 = el.getBoundingClientRect().height + 8;
      let target = i;
      el.classList.add('dragging');
      const onMove = ev => {
        if (ev.pointerId !== pid) return;
        const dy = ev.clientY - startY;
        el.style.transform = `translateY(${dy}px)`;
        const center = mids[i] + dy;
        target = mids.filter((m, j) => j !== i && m < center).length;
        rows.forEach((r, j) => {
          if (j === i) return;
          const shift = j > i && j <= target ? -h0 : j < i && j >= target ? h0 : 0;
          r.style.transform = shift ? `translateY(${shift}px)` : '';
        });
      };
      const onUp = async ev => {
        if (ev.pointerId !== pid) return;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        rows.forEach(r => (r.style.transform = ''));
        el.classList.remove('dragging');
        if (target !== i) { const [moved] = order.splice(i, 1); order.splice(target, 0, moved); draw(); haptic(data.settings.vibrate, 15); await save(); }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });
    return el;
  };
  const draw = () => list.replaceChildren(...order.map(row));
  draw();
  return h('div', { class: 'content' },
    h('div', { class: 'banner', style: { background: 'var(--surface)' } }, icon('menu', 20), h('div', {}, t('reorderBanner'))),
    list,
    h('button', { class: 'btn primary big', onclick: () => { reorderFor = null; ctx.refresh(); } }, icon('check'), t('done')));
}
