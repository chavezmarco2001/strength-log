// One exercise: Track (log sets) · History · Graph & records.
import { h, icon, topbar, chooser, toast, seg } from '../ui.js';
import * as data from '../data.js';
import { t, fmtNum, fmtW, fmtSet, fmtShort, fmtShortY, fmtLong, fmtDayTitle, fmtRest } from '../i18n.js';
import { toISODate, parseNum, round2, parseISODate, REST_OPTIONS } from '../util.js';
import { markPRs, dailyStats, records } from '../stats.js';
import { lineChart } from '../chart.js';
import * as timer from '../timer.js';
import { exerciseForm } from './forms.js';

const drafts = new Map();   // "exerciseId|date" → unsaved { weight, reps } typed by the user
let editing = null;         // id of the set being edited
let graphMetric = 'max', graphRange = '1y', histLimit = 30;

export async function render([exId, tab = 'track'], ctx) {
  const ex = data.getExercise(exId);
  if (!ex) { ctx.go('/', { replace: true }); return h('div'); }
  const date = ctx.state.date;
  const all = await data.setsForExercise(ex.id);

  const tabs = h('div', { class: 'tabs', role: 'tablist' }, ['track', 'history', 'graph'].map(k =>
    h('button', {
      class: 'tab' + (k === tab ? ' active' : ''), role: 'tab', 'aria-selected': String(k === tab),
      onclick: () => { if (k !== tab) { editing = null; ctx.go('/ex/' + exId + (k === 'track' ? '' : '/' + k), { replace: true }); } },
    }, t('tab_' + k))));
  const bar = topbar({
    title: data.exName(ex),
    sub: date !== toISODate() ? fmtDayTitle(date) : null,
    back: () => { editing = null; ctx.back('/'); },
    actions: [{ icon: 'more', label: t('menu'), onclick: () => menu(ex, ctx) }],
  });
  const body = tab === 'history' ? historyTab(all, ctx) : tab === 'graph' ? graphTab(all, ctx) : trackTab(ex, all, date, ctx);
  return h('div', { class: 'screen' }, bar, tabs, body);
}

// ---------------------------------------------------------------- Track
function trackTab(ex, all, date, ctx) {
  const todays = all.filter(s => s.date === date);
  const prs = markPRs(all);
  let lastDate = null;
  for (let i = all.length - 1; i >= 0; i--) if (all[i].date < date) { lastDate = all[i].date; break; }
  const last = lastDate ? all.filter(s => s.date === lastDate) : [];
  const key = ex.id + '|' + date;
  const editSet = editing ? todays.find(s => s.id === editing) : null;
  if (!editSet) editing = null;

  // Suggested values: set being edited › what you typed › last set today › first set last time.
  const src = editSet || drafts.get(key) || todays.at(-1) || last[0] || { weight: '', reps: '' };
  const wIn = h('input', { class: 'num', inputmode: 'decimal', autocomplete: 'off', value: String(src.weight), 'aria-label': t('weightKg'), onfocus: e => e.target.select(), oninput: saveDraft });
  const rIn = h('input', { class: 'num', inputmode: 'numeric', autocomplete: 'off', value: String(src.reps), 'aria-label': t('reps'), onfocus: e => e.target.select(), oninput: saveDraft });

  function saveDraft() { if (!editing) drafts.set(key, { weight: wIn.value, reps: rIn.value }); }
  function bump(input, d, isInt) {
    let v = parseNum(input.value);
    if (!Number.isFinite(v)) v = 0;
    v = Math.max(0, round2(v + d));
    input.value = String(isInt ? Math.round(v) : v);
    saveDraft();
  }
  const stepper = (input, d, isInt, label) => h('div', { class: 'field-block' },
    h('div', { class: 'field-label' }, label),
    h('div', { class: 'stepper' },
      h('button', { class: 'step-btn', 'aria-label': t('decrease'), onclick: () => bump(input, -d, isInt) }, icon('minus', 28)),
      input,
      h('button', { class: 'step-btn', 'aria-label': t('increase'), onclick: () => bump(input, d, isInt) }, icon('plus', 28))));

  function read() {
    const w = wIn.value.trim() === '' ? 0 : parseNum(wIn.value);
    const r = parseNum(rIn.value);
    if (!Number.isFinite(w) || w < 0 || w > 2000 || !Number.isInteger(r) || r < 1 || r > 1000) {
      toast(t('invalidSet'), { kind: 'error' });
      return null;
    }
    return { weight: round2(w), reps: r };
  }
  function after(pr) {
    if (pr) {
      toast(t(pr === 'weight' ? 'prWeight' : 'prReps'), { kind: 'pr', ms: 4000 });
      if (data.settings.vibrate) navigator.vibrate?.([60, 60, 60]);
    }
    const rest = ex.rest != null ? ex.rest : data.settings.rest;
    if (date === toISODate()) timer.startRest(rest);
    ctx.refresh();
  }
  async function save() {
    const v = read();
    if (!v) return;
    const { pr } = await data.addSet({ exerciseId: ex.id, date, ...v });
    drafts.delete(key);
    after(pr);
  }
  async function copy(s) {
    editing = null;
    const { pr } = await data.addSet({ exerciseId: ex.id, date, weight: s.weight, reps: s.reps });
    drafts.delete(key);
    after(pr);
  }
  async function update() {
    const v = read();
    if (!v) return;
    await data.putSet({ ...editSet, ...v });
    editing = null;
    ctx.refresh();
  }
  async function remove() {
    const s = editSet;
    await data.deleteSet(s.id);
    editing = null;
    ctx.refresh();
    toast(t('setDeleted'), { ms: 5000, action: { label: t('undo'), fn: async () => { await data.putSet(s); ctx.refresh(); } } });
  }

  const lastEl = last.length
    ? h('div', { class: 'last' },
      h('div', { class: 'muted small' }, t('lastTime', { date: fmtShortY(lastDate) })),
      h('div', { class: 'chips' }, last.map(s => h('button', { class: 'chip', onclick: () => { wIn.value = s.weight; rIn.value = s.reps; saveDraft(); } }, fmtSet(s)))))
    : h('div', { class: 'last muted small' }, all.length ? '' : t('firstTime'));

  const actions = editSet
    ? [h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary big', onclick: update }, t('update')),
      h('button', { class: 'btn danger big', onclick: remove }, icon('trash'), t('delete'))),
    h('button', { class: 'btn ghost full', onclick: () => { editing = null; ctx.refresh(); } }, t('cancelEdit'))]
    : h('button', { class: 'btn primary big save-btn', onclick: save }, t('save'));

  const rows = todays.map((s, i) => h('div', { class: 'set-row' + (s.id === editing ? ' selected' : '') },
    h('button', { class: 'set-main', onclick: () => { editing = editing === s.id ? null : s.id; ctx.refresh(); } },
      h('span', { class: 'set-n' }, i + 1),
      h('span', { class: 'set-v' }, fmtW(s.weight), h('span', { class: 'x' }, ' × '), s.reps, h('span', { class: 'unit' }, ' ' + t('repsShort'))),
      prs.has(s.id) && h('span', { class: 'trophy', title: t(prs.get(s.id) === 'weight' ? 'prWeightShort' : 'prRepsShort') }, '🏆')),
    h('button', { class: 'icon-btn', 'aria-label': t('copySet'), onclick: () => copy(s) }, icon('copy'))));

  return h('div', { class: 'content track' },
    lastEl,
    stepper(wIn, Number(data.settings.step) || 2.5, false, t('weightKg')),
    stepper(rIn, 1, true, t('reps')),
    actions,
    todays.length > 0 && h('h3', { class: 'section' }, date === toISODate() ? t('todaySets') : fmtLong(date)),
    todays.length > 0 && h('div', { class: 'sets' }, rows),
    todays.length > 0 && !editSet && h('p', { class: 'muted small hint' }, t('setHint')));
}

// ---------------------------------------------------------------- History
function historyTab(all, ctx) {
  if (!all.length) return h('div', { class: 'content empty' }, t('noHistory'));
  const prs = markPRs(all);
  const byDate = new Map();
  for (const s of all) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  }
  const dates = [...byDate.keys()].reverse();
  return h('div', { class: 'content' },
    dates.slice(0, histLimit).map(d => {
      const list = byDate.get(d);
      const vol = list.reduce((a, s) => a + s.weight * s.reps, 0);
      return h('div', { class: 'card hist' },
        h('button', { class: 'hist-head', onclick: () => ctx.setDate(d) },
          h('span', {}, fmtLong(d)),
          h('span', { class: 'muted small' }, t('volumeShort', { v: fmtNum(Math.round(vol)) }))),
        list.map(s => h('div', { class: 'hist-set' },
          h('span', {}, fmtW(s.weight), ' × ', s.reps),
          prs.has(s.id) && h('span', { class: 'trophy' }, ' 🏆'),
          s.comment && h('div', { class: 'muted small' }, s.comment))));
    }),
    dates.length > histLimit && h('button', { class: 'btn full', onclick: () => { histLimit += 30; ctx.refresh(); } }, t('showMore')));
}

// ---------------------------------------------------------------- Graph
function graphTab(all, ctx) {
  if (!all.length) return h('div', { class: 'content empty' }, t('noHistory'));
  const days = { '3m': 92, '1y': 366, all: Infinity }[graphRange];
  const cutoff = Date.now() - days * 86400000;
  const pts = dailyStats(all)
    .map(d => ({ x: parseISODate(d.date).getTime(), y: graphMetric === 'max' ? d.maxWeight : d.volume }))
    .filter(p => p.x >= cutoff);
  const chart = pts.length
    ? lineChart({
      series: [{ points: pts, color: 'var(--accent)' }],
      fmtY: v => fmtNum(v, graphMetric === 'max' ? 1 : 0),
      fmtVal: v => fmtNum(Math.round(v * 10) / 10) + ' kg',
      fmtX: x => fmtShortY(toISODate(new Date(x))),
    })
    : h('p', { class: 'muted pad' }, t('noDataRange'));
  const rec = records(all);
  const recRow = (label, value, date) => h('div', { class: 'rec-row' },
    h('span', { class: 'muted' }, label), h('span', { class: 'rec-val' }, value), h('span', { class: 'muted small' }, fmtShortY(date)));

  return h('div', { class: 'content' },
    seg([['max', t('maxWeight')], ['vol', t('volume')]], graphMetric, v => { graphMetric = v; ctx.refresh(); }),
    h('div', { class: 'chart-wrap' }, chart),
    seg([['3m', t('range3m')], ['1y', t('range1y')], ['all', t('rangeAll')]], graphRange, v => { graphRange = v; ctx.refresh(); }),
    h('h3', { class: 'section' }, t('records')),
    h('div', { class: 'card' },
      recRow(t('heaviest'), `${fmtW(rec.heaviest.weight)} × ${rec.heaviest.reps}`, rec.heaviest.date),
      recRow(t('bestVolume'), fmtNum(Math.round(rec.bestVolume.volume)) + ' kg', rec.bestVolume.date)),
    h('h3', { class: 'section' }, t('repRecords')),
    h('div', { class: 'card' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, t('weight')), h('th', {}, t('bestReps')), h('th', {}, t('date')))),
      h('tbody', {}, rec.repMax.slice(0, 20).map(s => h('tr', {},
        h('td', {}, fmtW(s.weight)), h('td', {}, s.reps), h('td', { class: 'muted' }, fmtShortY(s.date))))))));
}

// ---------------------------------------------------------------- menu
async function menu(ex, ctx) {
  const restNow = ex.rest != null ? fmtRest(ex.rest) : t('restDefault', { v: fmtRest(data.settings.rest) });
  const v = await chooser(data.exName(ex), [
    { label: t('restTimer'), sub: restNow, value: 'rest' },
    { label: t('editExercise'), value: 'edit' },
  ]);
  if (v === 'rest') {
    const r = await chooser(t('restTimer'), [
      { label: t('useDefault', { v: fmtRest(data.settings.rest) }), value: 'default', selected: ex.rest == null },
      ...REST_OPTIONS.map(s => ({ label: fmtRest(s), value: s, selected: ex.rest === s })),
    ]);
    if (r === undefined) return;
    const out = { ...ex };
    if (r === 'default') delete out.rest; else out.rest = r;
    await data.saveExercise(out);
    toast(t('saved'));
    ctx.refresh();
  } else if (v === 'edit') {
    if (await exerciseForm(ex)) ctx.refresh();
  }
}
