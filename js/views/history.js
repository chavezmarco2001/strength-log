// All workout days, newest first.
import { h, topbar } from '../ui.js';
import * as data from '../data.js';
import { t, fmtLong } from '../i18n.js';
import { toISODate, weekStart } from '../util.js';

let limit = 40;

export async function render(_, ctx) {
  const [sets, sessions] = await Promise.all([data.allSets(), data.allSessions()]);
  const sess = new Map(sessions.map(s => [s.date, s]));
  const days = new Map();
  for (const s of sets) {
    let d = days.get(s.date);
    if (!d) days.set(s.date, d = { date: s.date, ex: [], n: 0 });
    if (!d.ex.includes(s.exerciseId)) d.ex.push(s.exerciseId);
    d.n++;
  }
  const list = [...days.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  const thisWeek = weekStart(toISODate());
  const weekCount = list.filter(d => d.date >= thisWeek).length;

  const card = d => {
    const names = d.ex.map(id => data.getExercise(id)).filter(Boolean).map(data.exName);
    const s = sess.get(d.date);
    const ci = s && (s.mood || s.motivation || s.satisfaction)
      ? `${t('mood')} ${s.mood ?? '–'} · ${t('motivation')} ${s.motivation ?? '–'} · ${t('satisfaction')} ${s.satisfaction ?? '–'}` : null;
    return h('button', { class: 'card day-card', onclick: () => ctx.setDate(d.date) },
      h('div', { class: 'day-head' }, h('span', { class: 'card-title' }, fmtLong(d.date)), h('span', { class: 'muted small' }, t('nSets', { n: d.n }))),
      h('div', { class: 'small' }, names.slice(0, 5).join(' · ') + (names.length > 5 ? ` +${names.length - 5}` : '')),
      ci && h('div', { class: 'muted small' }, ci));
  };

  return h('div', { class: 'screen' },
    topbar({ title: t('nav_history') }),
    h('div', { class: 'content' },
      list.length > 0 && h('div', { class: 'stats-line muted small' }, t('historyStats', { week: weekCount, total: list.length })),
      list.length ? list.slice(0, limit).map(card) : h('div', { class: 'empty' }, t('noWorkouts')),
      list.length > limit && h('button', { class: 'btn full', onclick: () => { limit += 40; ctx.refresh(); } }, t('showMore'))));
}
