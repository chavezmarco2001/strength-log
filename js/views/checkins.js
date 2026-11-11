// How the post-workout check-ins change week by week.
import { h, topbar } from '../ui.js';
import * as data from '../data.js';
import { t, fmtNum, fmtShort, fmtLong } from '../i18n.js';
import { parseISODate, toISODate, addDays } from '../util.js';
import { weeklyCheckins, CHECKIN_KEYS } from '../stats.js';
import { lineChart } from '../chart.js';

const COLORS = { mood: '#4f9cff', motivation: '#3ccf7a', satisfaction: '#f5c542' };

export async function render(_, ctx) {
  const sessions = await data.allSessions();
  const weeks = weeklyCheckins(sessions).slice(-12);
  const notes = sessions.filter(s => s.note || s.tags?.length).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 15);
  const tagCount = new Map();
  const since = addDays(toISODate(), -28);
  for (const s of sessions) if (s.date >= since) for (const k of s.tags || []) tagCount.set(k, (tagCount.get(k) || 0) + 1);
  const topTags = [...tagCount].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const bar = topbar({ title: t('checkins'), back: () => ctx.back('/more') });
  if (!weeks.length && !notes.length) return h('div', { class: 'screen' }, bar, h('div', { class: 'content empty' }, t('noCheckins')));

  const series = CHECKIN_KEYS.map(k => ({
    label: t(k).slice(0, 3) + '.',
    color: COLORS[k],
    points: weeks.filter(w => w[k] != null).map(w => ({ x: parseISODate(w.week).getTime(), y: w[k] })),
  }));
  const avg = v => (v == null ? '–' : fmtNum(v, 1));

  return h('div', { class: 'screen' }, bar,
    h('div', { class: 'content' },
      h('p', { class: 'muted small' }, t('checkinsExplain')),
      weeks.length > 0 && h('div', { class: 'chart-wrap' },
        lineChart({ series, yMin: 1, yMax: data.CHECKIN_SCALE, fmtY: v => fmtNum(v, 0), fmtVal: v => fmtNum(v, 1), fmtX: x => t('weekOf', { date: fmtShort(toISODate(new Date(x))) }) }),
        h('div', { class: 'legend' }, CHECKIN_KEYS.map(k => h('span', {}, h('i', { style: { background: COLORS[k] } }), t(k))))),
      weeks.length > 0 && h('div', { class: 'card' }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, t('week')), h('th', {}, '#'), CHECKIN_KEYS.map(k => h('th', { style: { color: COLORS[k] } }, t(k).slice(0, 3) + '.')))),
        h('tbody', {}, [...weeks].reverse().map(w => h('tr', {},
          h('td', {}, fmtShort(w.week)), h('td', { class: 'muted' }, w.n), CHECKIN_KEYS.map(k => h('td', {}, avg(w[k])))))))),
      topTags.length > 0 && h('h3', { class: 'section' }, t('topTags')),
      topTags.length > 0 && h('div', { class: 'tag-list' }, topTags.map(([k, n]) => h('span', {}, `${t('tag_' + k)} ×${n}`))),
      notes.length > 0 && h('h3', { class: 'section' }, t('notes')),
      notes.map(s => h('div', { class: 'card' }, h('div', { class: 'muted small' }, fmtLong(s.date)),
        s.tags?.length > 0 && h('div', { class: 'tag-list' }, s.tags.map(k => h('span', {}, t('tag_' + k)))),
        s.note && h('div', { style: { marginTop: '6px' } }, s.note)))));
}
