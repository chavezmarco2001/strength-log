// Progress: weekly summary, streak, records, most trained exercises, body weight, check-ins.
import { h, icon, topbar, formDialog, toast, confirmDialog } from '../ui.js';
import * as data from '../data.js';
import { t, fmtNum, fmtShort, fmtShortY, fmtLong, fmtDate, fmtSet } from '../i18n.js';
import { toISODate, addDays, weekStart, parseNum, parseISODate, round2 } from '../util.js';
import { weeklyTotals, weekStreak, recentRecords, weeklyCheckins } from '../stats.js';
import { barChart, lineChart } from '../chart.js';

let volumeMode = false;

export async function render(_, ctx) {
  const today = toISODate();
  const [all, bw, sessions] = await Promise.all([data.allSets(), data.bodyweights(), data.allSessions()]);
  const sets = data.doneOnly(all);
  const weeks = weeklyTotals(sets);
  const w0 = weekStart(today);
  const wk = weeks.find(w => w.week === w0) || { workouts: 0, sets: 0, volume: 0 };
  const month0 = today.slice(0, 7) + '-01';
  const monthDays = new Set(sets.filter(s => s.date >= month0).map(s => s.date)).size;
  const totalDays = new Set(sets.map(s => s.date)).size;
  const streak = weekStreak(sets, today);

  const bars = Array.from({ length: 12 }, (_, i) => {
    const w = addDays(w0, -7 * (11 - i));
    const x = weeks.find(z => z.week === w);
    return { label: fmtDate(w, { day: 'numeric', month: 'numeric' }), title: t('weekOf', { date: fmtShort(w) }), value: volumeMode ? Math.round((x?.volume || 0) / 100) / 10 : x?.workouts || 0 };
  });

  // most trained exercises in the last 90 days
  const since = addDays(today, -90);
  const counts = new Map();
  for (const s of sets) if (s.date >= since) counts.set(s.exerciseId, (counts.get(s.exerciseId) || 0) + 1);
  const top = [...counts].filter(([id]) => data.getExercise(id)).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const seenEx = new Set();
  const records = recentRecords(sets, 200).filter(r => data.getExercise(r.set.exerciseId) && !seenEx.has(r.set.exerciseId) && seenEx.add(r.set.exerciseId)).slice(0, 6);
  const ci = weeklyCheckins(sessions).at(-1);

  const tile = (value, label, hot) => h('div', { class: 'tile' + (hot ? ' hot' : '') }, h('b', {}, value), h('span', {}, label));
  const exRow = (id, right, sub) => {
    const ex = data.getExercise(id), cat = data.getCategory(ex.categoryId);
    return h('button', { class: 'row', onclick: () => ctx.go('/ex/' + id + '/graph') },
      h('span', { class: 'dot', style: { background: cat?.color || 'var(--muted)' } }),
      h('span', { class: 'row-main' }, data.exName(ex), sub && h('div', { class: 'row-sub' }, sub)),
      h('span', { class: 'row-count' }, right), icon('right', 18));
  };
  const latest = bw.at(-1);
  const monthAgo = [...bw].reverse().find(b => b.date <= addDays(today, -28));
  const delta = latest && monthAgo ? round2(latest.kg - monthAgo.kg) : null;

  return h('div', { class: 'screen' },
    topbar({ title: t('nav_progress') }),
    h('div', { class: 'content' },
      h('div', { class: 'tiles' },
        tile(wk.workouts, t('thisWeek'), true),
        tile(streak, t('weekStreak')),
        tile(monthDays, t('thisMonth')),
        tile(totalDays, t('totalWorkouts'))),

      h('h3', { class: 'section' }, volumeMode ? t('volumePerWeek') : t('workoutsPerWeek'),
        h('button', { onclick: () => { volumeMode = !volumeMode; ctx.refresh(); } }, volumeMode ? t('showWorkouts') : t('showVolume'))),
      h('div', { class: 'chart-wrap' }, barChart({ bars, fmtY: v => fmtNum(v, 1), fmtVal: v => (volumeMode ? fmtNum(v, 1) + ' t' : t('nWorkouts', { n: v })) })),

      h('h3', { class: 'section' }, t('recentRecords')),
      h('div', { class: 'card flush list' }, records.length
        ? records.map(r => exRow(r.set.exerciseId, '🏆 ' + fmtSet(r.set), `${t(r.type === 'weight' ? 'prWeightShort' : 'prRepsShort')} · ${fmtShortY(r.set.date)}`))
        : h('p', { class: 'muted small pad' }, t('noRecordsYet'))),

      h('h3', { class: 'section' }, t('mostTrained'), h('button', { onclick: () => { ctx.state.pickFor = { mode: 'progress' }; ctx.go('/pick'); } }, t('allExercises'))),
      h('div', { class: 'card flush list' }, top.length
        ? top.map(([id, n]) => exRow(id, t('nSets', { n })))
        : h('p', { class: 'muted small pad' }, t('noHistory'))),

      h('h3', { class: 'section' }, t('bodyweight'), h('button', { onclick: () => ctx.go('/bodyweight') }, t('seeAll'))),
      h('div', { class: 'card stack' },
        latest
          ? h('div', { class: 'rec-row' },
            h('span', {}, h('span', { class: 'rec-val' }, fmtNum(latest.kg) + ' kg'), h('div', { class: 'muted small' }, fmtLong(latest.date))),
            delta != null && h('span', { class: 'muted small' }, t('vsMonthAgo', { d: (delta > 0 ? '+' : '') + fmtNum(delta) })))
          : h('p', { class: 'muted small', style: { margin: 0 } }, t('noBodyweight')),
        bw.length > 1 && bodyweightChart(bw.slice(-60)),
        h('button', { class: 'btn full', onclick: () => logBodyweight(ctx) }, icon('scale', 20), t('logBodyweight'))),

      h('h3', { class: 'section' }, t('checkins'), h('button', { onclick: () => ctx.go('/checkins') }, t('seeAll'))),
      h('button', { class: 'card', onclick: () => ctx.go('/checkins') },
        ci ? h('div', { class: 'small' }, t('weekOf', { date: fmtShort(ci.week) }) + ': ',
          ['mood', 'motivation', 'satisfaction'].map(k => `${t(k)} ${ci[k] != null ? fmtNum(ci[k], 1) : '–'}`).join(' · '))
          : h('div', { class: 'muted small' }, t('noCheckins')))));
}

function bodyweightChart(bw) {
  return lineChart({
    series: [{ points: bw.map(b => ({ x: parseISODate(b.date).getTime(), y: b.kg })), color: 'var(--accent)' }],
    fmtY: v => fmtNum(v, 1), fmtVal: v => fmtNum(v, 1) + ' kg', fmtX: x => fmtShortY(toISODate(new Date(x))), height: 180,
  });
}

async function logBodyweight(ctx, date = toISODate()) {
  const last = (await data.bodyweights()).at(-1);
  const v = await formDialog(t('logBodyweight'), [{ name: 'kg', label: t('bodyweightOn', { date: fmtLong(date) }), value: last ? String(last.kg) : '', inputmode: 'decimal', required: true, maxlength: 6 }]);
  if (!v) return;
  const kg = parseNum(v.kg);
  if (!(kg > 20 && kg < 400)) return toast(t('invalidBodyweight'), { kind: 'error' });
  await data.saveBodyweight(date, round2(kg));
  toast(t('saved'));
  ctx.refresh();
}

export async function renderBodyweight(_, ctx) {
  const bw = await data.bodyweights();
  return h('div', { class: 'screen' },
    topbar({ title: t('bodyweight'), back: () => ctx.back('/progress'), actions: [{ icon: 'plus', label: t('logBodyweight'), onclick: () => logBodyweight(ctx) }] }),
    h('div', { class: 'content' },
      bw.length > 1 && h('div', { class: 'chart-wrap' }, bodyweightChart(bw)),
      bw.length ? h('div', { class: 'card flush list' }, [...bw].reverse().map(b => h('div', { class: 'row' },
        h('span', { class: 'row-main' }, fmtLong(b.date)),
        h('span', { class: 'rec-val' }, fmtNum(b.kg) + ' kg'),
        h('button', { class: 'icon-btn small', 'aria-label': t('delete'), onclick: async () => {
          if (await confirmDialog(t('deleteBodyweightConfirm', { date: fmtLong(b.date) }), { ok: t('delete'), danger: true })) { await data.deleteBodyweight(b.date); ctx.refresh(); }
        } }, icon('trash', 18)))))
        : h('div', { class: 'empty' }, t('noBodyweight')),
      h('button', { class: 'btn primary big', onclick: () => logBodyweight(ctx) }, icon('scale'), t('logBodyweight'))));
}
