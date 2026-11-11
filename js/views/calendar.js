// Calendar: month grid with a coloured dot per muscle group trained; tap a day to see it.
import { h, icon, toast } from '../ui.js';
import * as data from '../data.js';
import { t, fmtNum, fmtLong, fmtDate, fmtSet } from '../i18n.js';
import { toISODate, addDays, parseISODate, pad } from '../util.js';
import { workoutMinutes } from '../stats.js';
import { catDots, groupByExercise } from './components.js';

let month = null;      // 'YYYY-MM' being shown
let selected = null;   // 'YYYY-MM-DD'

export async function render(_, ctx) {
  const today = toISODate();
  month ??= today.slice(0, 7);
  selected ??= today;
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${month}-${pad(lastDay)}`;
  const sets = data.doneOnly(await data.setsInRange(first, last));
  const byDay = new Map();
  for (const s of sets) { if (!byDay.has(s.date)) byDay.set(s.date, []); byDay.get(s.date).push(s); }

  const shift = k => { const d = new Date(y, m - 1 + k, 1); month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; ctx.refresh(); };
  const lead = (parseISODate(first).getDay() + 6) % 7;     // Monday-first grid
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(h('span', { class: 'cal-day out' }));
  for (let d = 1; d <= lastDay; d++) {
    const iso = `${month}-${pad(d)}`;
    const list = byDay.get(iso) || [];
    cells.push(h('button', {
      class: 'cal-day' + (list.length ? ' has' : '') + (iso === today ? ' today' : '') + (iso === selected ? ' sel' : ''),
      'aria-label': fmtLong(iso), onclick: () => { selected = iso; ctx.refresh(); },
    }, String(d), catDots(list)));
  }
  const dows = Array.from({ length: 7 }, (_, i) => h('span', { class: 'cal-dow' }, fmtDate(addDays('2026-11-02', i), { weekday: 'narrow' })));

  const vol = sets.reduce((a, s) => a + data.setVolume(s), 0);
  const header = h('header', { class: 'cal-head' },
    h('button', { class: 'icon-btn', 'aria-label': t('prevMonth'), onclick: () => shift(-1) }, icon('left')),
    h('div', { class: 'title' }, (x => x.charAt(0).toUpperCase() + x.slice(1))(fmtDate(first, { month: 'long', year: 'numeric' }))),
    h('button', { class: 'icon-btn', 'aria-label': t('nextMonth'), onclick: () => shift(1) }, icon('right')),
    h('button', { class: 'icon-btn', 'aria-label': t('listView'), onclick: () => ctx.go('/history', { replace: true }) }, icon('list')));

  return h('div', { class: 'screen' },
    header,
    h('div', { class: 'cal-grid' }, dows, cells),
    h('div', { class: 'cal-summary' },
      h('div', { class: 'tile', style: { flex: 1 } }, h('b', {}, byDay.size), h('span', {}, t('workoutsMonth'))),
      h('div', { class: 'tile', style: { flex: 1 } }, h('b', {}, sets.length), h('span', {}, t('setsWord'))),
      h('div', { class: 'tile', style: { flex: 1.3 } }, h('b', {}, fmtNum(Math.round(vol / 100) / 10), h('small', { style: { fontSize: '16px' } }, ' t')), h('span', {}, t('volume')))),
    month !== today.slice(0, 7) && h('div', { class: 'content', style: { paddingBottom: 0 } },
      h('button', { class: 'btn small', onclick: () => { month = today.slice(0, 7); selected = today; ctx.refresh(); } }, t('thisMonth'))),
    await dayDetail(selected, ctx));
}

async function dayDetail(date, ctx) {
  const all = await data.setsForDate(date);
  const sets = data.doneOnly(all);
  const today = toISODate();
  const open = () => ctx.setDate(date);
  if (!sets.length) {
    return h('div', { class: 'content' },
      h('h3', { class: 'section' }, fmtLong(date)),
      h('div', { class: 'card empty' }, all.length ? t('onlyPlanned', { n: all.length }) : t('restDay')),
      h('button', { class: 'btn full', onclick: open }, icon('dumbbell'), date === today ? t('openToday') : t('openDay')));
  }
  const groups = groupByExercise(sets);
  const session = await data.getSession(date);
  const vol = sets.reduce((a, s) => a + data.setVolume(s), 0);
  const min = workoutMinutes(sets);
  const repeatToday = async () => {
    const n = await data.repeatWorkout(date, today);
    toast(t('setsPlanned', { n }));
    ctx.setDate(today);
  };
  return h('div', { class: 'content' },
    h('h3', { class: 'section' }, fmtLong(date), h('span', {}, `${t('nSets', { n: sets.length })} · ${fmtNum(Math.round(vol))} kg${min ? ` · ${min} min` : ''}`)),
    [...groups].map(([id, list]) => {
      const ex = data.getExercise(id);
      const cat = ex && data.getCategory(ex.categoryId);
      return h('button', { class: 'card ex-card', style: { '--c': cat?.color || 'var(--accent)', padding: '12px 14px' }, onclick: () => { ctx.state.date = date; ctx.state.followToday = date === today; ctx.go('/ex/' + id + '/history'); } },
        h('div', { class: 'card-title' }, ex ? data.exName(ex) : '?'),
        h('div', { class: 'chips', style: { marginTop: '6px' } }, list.map(s => h('span', { class: 'chip' }, data.setLabel(s)))));
    }),
    session?.tags?.length > 0 && h('div', { class: 'tag-list' }, session.tags.map(k => h('span', {}, t('tag_' + k)))),
    session?.note && h('div', { class: 'card note' }, '“' + session.note + '”'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: open }, icon('dumbbell'), t('openDay')),
      date !== today && h('button', { class: 'btn primary', onclick: repeatToday }, icon('repeat'), t('repeatToday'))));
}
