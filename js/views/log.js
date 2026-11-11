// One exercise: Track (log / complete sets) · History · Graph & records.
import { h, icon, topbar, chooser, toast, seg, sheet, formDialog } from '../ui.js';
import * as data from '../data.js';
import { t, fmtNum, fmtW, fmtSet, fmtShortY, fmtLong, fmtDayTitle, fmtRest } from '../i18n.js';
import { toISODate, parseNum, round2, parseISODate, REST_OPTIONS } from '../util.js';
import { markPRs, dailyStats, records, e1rm, bestE1rm, platesFor } from '../stats.js';
import { lineChart } from '../chart.js';
import * as timer from '../timer.js';
import { afterComplete, toggleDone, restFor } from '../actions.js';
import { exerciseForm } from './forms.js';
import { setTable } from './components.js';

const drafts = new Map();   // "exerciseId|date" → unsaved { weight, reps } typed by the user
let editing = null;         // id of the set being edited
let graphMetric = 'max', graphRange = '1y', histLimit = 30;

/** Open the exercise screen with this set selected for editing. */
export function focusSet(id) { editing = id; }

export async function render([exId, tab = 'track'], ctx) {
  const ex = data.getExercise(exId);
  if (!ex) { ctx.go('/', { replace: true }); return h('div'); }
  const date = ctx.state.date;
  const all = await data.setsForExercise(ex.id);
  const cat = data.getCategory(ex.categoryId);

  const tabs = h('div', { class: 'tabs', role: 'tablist' }, ['track', 'history', 'graph'].map(k =>
    h('button', {
      class: 'tab' + (k === tab ? ' active' : ''), role: 'tab', 'aria-selected': String(k === tab),
      onclick: () => { if (k !== tab) { editing = null; ctx.go('/ex/' + exId + (k === 'track' ? '' : '/' + k), { replace: true }); } },
    }, t('tab_' + k))));
  const bar = topbar({
    title: data.exName(ex),
    sub: [cat && data.catName(cat), date !== toISODate() && fmtDayTitle(date)].filter(Boolean).join(' · '),
    back: () => { editing = null; ctx.back('/'); },
    actions: [{ icon: 'more', label: t('menu'), onclick: () => menu(ex, ctx) }],
  });
  const done = data.doneOnly(all);
  const body = tab === 'history' ? historyTab(done, ctx) : tab === 'graph' ? graphTab(done, ctx) : trackTab(ex, all, date, ctx);
  return h('div', { class: 'screen' }, bar, tabs, body);
}

// ---------------------------------------------------------------- Track
function trackTab(ex, all, date, ctx) {
  const todays = all.filter(s => s.date === date);
  const done = data.doneOnly(all);
  const prs = markPRs(done);
  let lastDate = null;
  for (let i = done.length - 1; i >= 0; i--) if (done[i].date < date) { lastDate = done[i].date; break; }
  const last = lastDate ? done.filter(s => s.date === lastDate) : [];
  const key = ex.id + '|' + date;
  const editSet = editing ? todays.find(s => s.id === editing) : null;
  if (!editSet) editing = null;
  const next = todays.find(s => !data.isDone(s));            // next planned set to complete
  const nextNo = next ? todays.indexOf(next) + 1 : 0;

  // Suggested values: set being edited › what you typed › next planned set › last set today › first set last time.
  const src = editSet || drafts.get(key) || next || todays.at(-1) || last[0] || { weight: '', reps: '' };
  const wIn = h('input', { class: 'num-in', inputmode: 'decimal', autocomplete: 'off', value: String(src.weight), 'aria-label': t('weightKg'), onfocus: e => e.target.select(), oninput: saveDraft });
  const rIn = h('input', { class: 'num-in', inputmode: 'numeric', autocomplete: 'off', value: String(src.reps), 'aria-label': t('reps'), onfocus: e => e.target.select(), oninput: saveDraft });

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
      h('button', { class: 'step-btn', 'aria-label': t('decrease'), onclick: () => bump(input, -d, isInt) }, icon('minus', 30)),
      input,
      h('button', { class: 'step-btn', 'aria-label': t('increase'), onclick: () => bump(input, d, isInt) }, icon('plus', 30))));

  function read() {
    const w = wIn.value.trim() === '' ? 0 : parseNum(wIn.value);
    const r = parseNum(rIn.value);
    if (!Number.isFinite(w) || w < 0 || w > 2000 || !Number.isInteger(r) || r < 1 || r > 1000) {
      toast(t('invalidSet'), { kind: 'error' });
      return null;
    }
    return { weight: round2(w), reps: r };
  }
  async function save() {
    const v = read();
    if (!v) return;
    const res = next ? await data.completeSet(next, v) : await data.addSet({ exerciseId: ex.id, date, ...v });
    drafts.delete(key);
    afterComplete(res.set, res.pr);
    ctx.refresh();
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
  async function copyLast() {
    const ref = todays.at(-1);
    if (!ref) return;
    const res = await data.addSet({ exerciseId: ex.id, date, weight: ref.weight, reps: ref.reps });
    afterComplete(res.set, res.pr);
    ctx.refresh();
  }

  const note = h('button', { class: 'ex-note', onclick: () => editNote(ex, ctx) }, icon('note', 18),
    ex.note ? h('b', {}, ex.note) : h('span', {}, t('addNote')));

  const lastEl = last.length
    ? h('div', { class: 'last' },
      h('div', { class: 'muted small' }, t('lastTime', { date: fmtShortY(lastDate) })),
      h('div', { class: 'chips' }, last.map(s => h('button', { class: 'chip', onclick: () => { wIn.value = s.weight; rIn.value = s.reps; saveDraft(); } }, fmtSet(s)))))
    : !done.length && h('div', { class: 'last muted small' }, t('firstTime'));

  const actions = editSet
    ? [h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary big', onclick: update }, t('update')),
      h('button', { class: 'btn danger big', onclick: remove }, icon('trash'), t('delete'))),
    h('button', { class: 'btn ghost full', onclick: () => { editing = null; ctx.refresh(); } }, t('cancelEdit'))]
    : h('button', { class: 'btn primary big save-btn', onclick: save }, icon('check', 26), next ? t('completeSetN', { n: nextNo }) : t('saveSet'));

  const tools = h('div', { class: 'tools' },
    h('button', { class: 'btn small', onclick: () => plateSheet(parseNum(wIn.value)) }, icon('plates', 18), t('plates')),
    h('button', { class: 'btn small', onclick: () => timer.startRest(restFor(ex)) }, icon('play', 16), t('restNow', { v: fmtRest(restFor(ex)) })),
    todays.length > 0 && !editSet && h('button', { class: 'btn small', onclick: copyLast }, icon('copy', 18), t('repeatLast')));

  const lastByIndex = last; // "previous" column = same position last time
  return h('div', { class: 'content track' },
    note,
    lastEl,
    stepper(wIn, Number(data.settings.step) || 2.5, false, t('weightKg')),
    stepper(rIn, 1, true, t('reps')),
    actions,
    tools,
    todays.length > 0 && h('h3', { class: 'section' }, date === toISODate() ? t('todaySets') : fmtLong(date)),
    todays.length > 0 && h('div', { class: 'card', style: { padding: '6px 0' } }, setTable({
      sets: todays, prev: lastByIndex, prIds: prs, selectedId: editing,
      onTick: async s => { await toggleDone(s); ctx.refresh(); },
      onRow: s => { editing = editing === s.id ? null : s.id; ctx.refresh(); },
    })),
    todays.length > 0 && !editSet && h('p', { class: 'muted small hint' }, t('setHint')));
}

async function editNote(ex, ctx) {
  const v = await formDialog(t('exerciseNote'), [{ name: 'note', label: t('exerciseNoteHint'), type: 'textarea', value: ex.note || '', maxlength: 200 }]);
  if (v === null) return;
  const out = { ...ex };
  if (v.note) out.note = v.note; else delete out.note;
  await data.saveExercise(out);
  ctx.refresh();
}

// ---------------------------------------------------------------- Plates
const PLATE_COLORS = { 25: '#e5383b', 20: '#3a86ff', 15: '#ffbe0b', 10: '#38b000', 5: '#e9ecef', 2.5: '#212529', 1.25: '#adb5bd' };
function plateSheet(total) {
  const bar = Number(data.settings.barWeight) || 20;
  const plates = data.settings.plates || [25, 20, 15, 10, 5, 2.5, 1.25];
  const w = Number.isFinite(total) ? total : 0;
  const res = platesFor(w, bar, plates);
  const maxP = Math.max(...plates);
  const plate = p => h('i', { class: 'plate', title: fmtW(p), style: { height: Math.round(40 + 70 * (p / maxP)) + 'px', background: PLATE_COLORS[p] || '#8b95a7', border: p === 5 ? '1px solid #999' : '' } });
  return sheet(close => h('div', { class: 'stack' },
    h('h3', { class: 'sheet-title' }, t('platesFor', { w: fmtW(w) })),
    h('div', { class: 'bar-viz' },
      [...res.perSide].reverse().map(plate), h('i', { class: 'sleeve' }), h('i', { class: 'shaft' }), h('i', { class: 'sleeve' }), res.perSide.map(plate)),
    res.perSide.length
      ? h('p', { class: 'center' }, t('perSide'), ' ', h('b', { class: 'display', style: { fontSize: '22px' } }, res.perSide.map(p => fmtNum(p)).join(' + ')))
      : h('p', { class: 'center muted' }, t('justBar')),
    h('p', { class: 'center muted small' }, t('barIs', { w: fmtW(bar) }) + (res.rest > 0 ? ' · ' + t('platesRest', { w: fmtW(res.rest) }) : '')),
    h('button', { class: 'btn full', onclick: () => close() }, t('done'))));
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
      const best = bestE1rm(list);
      return h('div', { class: 'card hist' },
        h('button', { class: 'hist-head', onclick: () => ctx.setDate(d) },
          h('span', {}, fmtLong(d)),
          h('span', { class: 'muted small' }, t('volumeShort', { v: fmtNum(Math.round(vol)) }) + (best ? ' · 1RM ≈ ' + fmtNum(Math.round(best.value)) : ''))),
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
  const byDay = new Map();
  for (const s of all) { if (!byDay.has(s.date)) byDay.set(s.date, []); byDay.get(s.date).push(s); }
  const value = d => graphMetric === 'max' ? d.maxWeight : graphMetric === 'vol' ? d.volume : bestE1rm(byDay.get(d.date))?.value;
  const pts = dailyStats(all)
    .map(d => ({ x: parseISODate(d.date).getTime(), y: value(d) }))
    .filter(p => p.x >= cutoff && p.y != null);
  const chart = pts.length
    ? lineChart({
      series: [{ points: pts, color: 'var(--accent)' }],
      fmtY: v => fmtNum(v, graphMetric === 'vol' ? 0 : 1),
      fmtVal: v => fmtNum(Math.round(v * 10) / 10) + ' kg',
      fmtX: x => fmtShortY(toISODate(new Date(x))),
    })
    : h('p', { class: 'muted pad' }, t('noDataRange'));
  const rec = records(all);
  const best1rm = bestE1rm(all);
  const recRow = (label, val, date) => h('div', { class: 'rec-row' },
    h('span', { class: 'muted' }, label), h('span', { class: 'rec-val' }, val), h('span', { class: 'muted small' }, fmtShortY(date)));

  return h('div', { class: 'content' },
    seg([['max', t('maxWeight')], ['e1rm', t('e1rm')], ['vol', t('volume')]], graphMetric, v => { graphMetric = v; ctx.refresh(); }),
    h('div', { class: 'chart-wrap' }, chart),
    seg([['3m', t('range3m')], ['1y', t('range1y')], ['all', t('rangeAll')]], graphRange, v => { graphRange = v; ctx.refresh(); }),
    h('h3', { class: 'section' }, t('records')),
    h('div', { class: 'card' },
      recRow(t('heaviest'), `${fmtW(rec.heaviest.weight)} × ${rec.heaviest.reps}`, rec.heaviest.date),
      best1rm && recRow(t('bestE1rm'), fmtNum(Math.round(best1rm.value * 10) / 10) + ' kg', best1rm.set.date),
      recRow(t('bestVolume'), fmtNum(Math.round(rec.bestVolume.volume)) + ' kg', rec.bestVolume.date)),
    h('h3', { class: 'section' }, t('repRecords')),
    h('div', { class: 'card' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, t('weight')), h('th', {}, t('bestReps')), h('th', {}, '1RM'), h('th', {}, t('date')))),
      h('tbody', {}, rec.repMax.slice(0, 20).map(s => h('tr', {},
        h('td', {}, fmtW(s.weight)), h('td', {}, s.reps), h('td', { class: 'muted' }, e1rm(s.weight, s.reps) ? fmtNum(Math.round(e1rm(s.weight, s.reps))) : '–'), h('td', { class: 'muted' }, fmtShortY(s.date))))))),
    h('p', { class: 'muted small' }, t('e1rmExplain')));
}

// ---------------------------------------------------------------- menu
async function menu(ex, ctx) {
  const restNow = ex.rest != null ? fmtRest(ex.rest) : t('restDefault', { v: fmtRest(data.settings.rest) });
  const v = await chooser(data.exName(ex), [
    { label: t('restTimer'), sub: restNow, value: 'rest' },
    { label: t('exerciseNote'), sub: ex.note || t('addNote'), value: 'note' },
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
  } else if (v === 'note') editNote(ex, ctx);
  else if (v === 'edit') { if (await exerciseForm(ex)) ctx.refresh(); }
}
