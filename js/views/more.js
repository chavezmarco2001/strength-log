// "More" tab: backup & import, progress pages, settings. Plus the import report.
import { h, icon, topbar, seg, toggleRow, chooser, confirmDialog, toast, applyTheme, applyAccent, ACCENTS, sheet } from '../ui.js';
import * as data from '../data.js';
import { t, setLang, fmtLong, fmtRest, fmtAgo, fmtNum } from '../i18n.js';
import { toISODate, norm, REST_OPTIONS, STEP_OPTIONS } from '../util.js';
import { analyzeFitNotes, analyzeFitNotesBackup } from '../fitnotes.js';
import { isSQLite } from '../sqlite.js';
import { saveFile, canShareFiles } from '../files.js';
import { testAlarm } from '../timer.js';

export const APP_VERSION = '2.2.0';
const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5];

export async function render(_, ctx) {
  const s = data.settings;
  const c = await data.counts();
  const set = async (k, v) => { await data.setSetting(k, v); ctx.refresh(); };

  // No `accept` filter: Android often stores downloaded .csv/.json files under another
  // type (octet-stream, vnd.ms-excel…) and greys them out. The content is checked after picking.
  const jsonInput = h('input', { type: 'file', hidden: true, 'data-kind': 'backup', onchange: e => { const f = e.target.files[0]; e.target.value = ''; restore(f, ctx); } });
  const csvInput = h('input', { type: 'file', hidden: true, 'data-kind': 'csv', onchange: e => { const f = e.target.files[0]; e.target.value = ''; importCSV(f, ctx); } });

  const backupDays = s.lastBackup ? Math.floor((Date.now() - s.lastBackup) / 86400000) : null;
  const backupState = backupDays == null ? t('lastBackupNever') : t('lastBackupAgo', { when: fmtAgo(s.lastBackup) });

  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const est = await navigator.storage?.estimate?.().catch(() => null);

  return h('div', { class: 'screen' },
    topbar({ title: t('nav_more') }),
    h('div', { class: 'content' },
      // ----- backup -----
      h('h3', { class: 'section' }, t('backup')),
      h('div', { class: 'card stack' },
        h('div', { class: 'backup-state' + (backupDays == null || backupDays >= s.backupDays ? ' due' : '') }, backupState),
        h('p', { class: 'muted small' }, t('backupExplain')),
        h('button', { class: 'btn primary full', onclick: () => backupJSON('download', ctx) }, t('saveBackup')),
        canShareFiles() && h('button', { class: 'btn full', onclick: () => backupJSON('share', ctx) }, t('shareBackup')),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', onclick: () => exportCSV('sets') }, t('exportSetsCSV')),
          h('button', { class: 'btn', onclick: () => exportCSV('checkins') }, t('exportCheckinsCSV'))),
        h('button', { class: 'btn full', onclick: () => jsonInput.click() }, t('restoreBackup')),
        jsonInput),
      h('h3', { class: 'section' }, t('importSection')),
      h('div', { class: 'card stack' },
        h('p', { class: 'muted small' }, t('importExplain')),
        h('button', { class: 'btn full', onclick: () => csvInput.click() }, t('importFitNotes')),
        s.lastImport && h('button', { class: 'btn ghost full', onclick: () => ctx.go('/import-report') }, t('viewLastImport')),
        csvInput),

      // ----- library -----
      h('div', { class: 'list card flush' },
        h('button', { class: 'row', onclick: () => ctx.go('/library') }, icon('dumbbell', 22), h('span', { class: 'row-main' }, t('library'), h('div', { class: 'row-sub' }, t('librarySub', { n: c.exercises }))), icon('right', 20)),
        h('button', { class: 'row', onclick: () => ctx.go('/bodyweight') }, icon('scale', 22), h('span', { class: 'row-main' }, t('bodyweight')), icon('right', 20)),
        h('button', { class: 'row', onclick: () => ctx.go('/checkins') }, icon('chart', 22), h('span', { class: 'row-main' }, t('checkins'), h('div', { class: 'row-sub' }, t('checkinsSub'))), icon('right', 20))),

      // ----- workout settings -----
      h('h3', { class: 'section' }, t('workoutSettings')),
      h('div', { class: 'list card flush' },
        h('button', { class: 'row', onclick: async () => {
          const v = await chooser(t('defaultRest'), REST_OPTIONS.map(x => ({ label: fmtRest(x), value: x, selected: x === s.rest })));
          if (v !== undefined) set('rest', v);
        } }, h('span', { class: 'row-main' }, t('defaultRest'), h('div', { class: 'row-sub' }, t('defaultRestSub'))), h('span', { class: 'row-count' }, fmtRest(s.rest))),
        toggleRow(t('timerOnComplete'), s.timerOnComplete, v => set('timerOnComplete', v), t('timerOnCompleteSub')),
        toggleRow(t('sound'), s.sound, v => set('sound', v)),
        toggleRow(t('vibration'), s.vibrate, v => set('vibrate', v)),
        h('button', { class: 'row', onclick: testAlarm }, h('span', { class: 'row-main' }, t('testAlarm'))),
        toggleRow(t('keepAwake'), s.wake, v => set('wake', v), t('keepAwakeSub'))),
      h('div', { class: 'card stack' },
        h('div', { class: 'field-label' }, t('weightStep')),
        seg(STEP_OPTIONS.map(v => [v, fmtNum(v) + ' kg']), s.step, v => set('step', v)),
        h('div', { class: 'field-label' }, t('barWeight')),
        seg([10, 15, 20, 25].map(v => [v, fmtNum(v) + ' kg']), Number(s.barWeight), v => set('barWeight', v)),
        h('div', { class: 'field-label' }, t('platesAvailable')),
        h('div', { class: 'chips' }, ALL_PLATES.map(p => {
          const on = (s.plates || []).includes(p);
          return h('button', { class: 'chip', style: on ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : {}, 'aria-pressed': String(on),
            onclick: () => set('plates', on ? s.plates.filter(x => x !== p) : [...(s.plates || []), p].sort((a, b) => b - a)) }, fmtNum(p));
        }))),

      // ----- appearance -----
      h('h3', { class: 'section' }, t('appearance')),
      h('div', { class: 'card stack' },
        h('div', { class: 'field-label' }, t('language')),
        seg([['en', 'English'], ['es', 'Español']], s.lang, async v => { await data.setSetting('lang', v); setLang(v); ctx.relabel(); }),
        h('div', { class: 'field-label' }, t('accentColor')),
        h('div', { class: 'swatches' }, Object.entries(ACCENTS).map(([k, [a1, a2]]) =>
          h('button', { class: 'swatch' + (s.accent === k ? ' active' : ''), style: { '--a1': a1, '--a2': a2 }, 'aria-label': t('accent_' + k), 'aria-pressed': String(s.accent === k),
            onclick: async () => { await data.setSetting('accent', k); applyAccent(k); ctx.refresh(); } }))),
        h('div', { class: 'field-label' }, t('theme')),
        seg([['dark', t('themeDark')], ['light', t('themeLight')], ['system', t('themeSystem')]], s.theme, async v => { await data.setSetting('theme', v); applyTheme(v); ctx.refresh(); })),

      // ----- storage -----
      h('h3', { class: 'section' }, t('storage')),
      h('div', { class: 'card stack small' },
        h('div', {}, t('storageCounts', { sets: c.sets, days: c.days })),
        est?.usage != null && h('div', { class: 'muted' }, t('storageUsed', { mb: fmtNum(est.usage / 1048576, 1) })),
        h('div', { class: 'muted' }, persisted ? t('persistedYes') : t('persistedNo'))),
      h('p', { class: 'muted small center' }, `Strength Log ${APP_VERSION}`)));
}

async function backupJSON(mode, ctx) {
  const obj = await data.exportAll();
  const res = await saveFile(`strength-log-backup-${toISODate()}.json`, 'application/json', JSON.stringify(obj), mode);
  if (res === 'cancel') return;
  await data.markBackup();
  toast(t(res === 'shared' ? 'backupShared' : 'backupSaved'), { ms: 4000 });
  ctx.refresh();
}

async function exportCSV(kind) {
  const content = kind === 'sets' ? await data.exportCSV() : await data.exportCheckinsCSV();
  await saveFile(`strength-log-${kind}-${toISODate()}.csv`, 'text/csv', content);
  toast(t('csvSaved'), { ms: 4000 });
}

async function restore(file, ctx) {
  if (!file) return;
  let obj;
  if (/\.(csv|fitnotes)$/i.test(file.name)) return confirmDialog(t('backupIsCsv', { name: file.name }), { cancel: false });
  try { obj = JSON.parse(await file.text()); } catch { return toast(t('badBackup'), { kind: 'error' }); }
  if (data.validateBackup(obj)) return toast(t('badBackup'), { kind: 'error' });
  const ok = await confirmDialog(t('restoreConfirm', { sets: obj.sets.length, date: obj.exportedAt ? fmtLong(obj.exportedAt.slice(0, 10)) : '?' }), { ok: t('restore'), danger: true });
  if (!ok) return;
  await data.restoreAll(obj);
  setLang(data.settings.lang);
  applyTheme(data.settings.theme);
  applyAccent(data.settings.accent);
  toast(t('restored'));
  ctx.relabel();
}

async function importCSV(file, ctx) {
  if (!file) return;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const say = key => confirmDialog(t(key, { name: file.name }), { cancel: false });
  let an;
  if (isSQLite(head)) {
    // FitNotes backup (.fitnotes) — read the database directly
    try { an = analyzeFitNotesBackup(await file.arrayBuffer()); } catch (e) { console.error(e); return say('backupUnreadable'); }
    if (an.error) return say('notFitnotesDb');
  } else {
    if (head[0] === 0x50 && head[1] === 0x4b) return say('csvIsZip');
    if (/\.json$/i.test(file.name)) return say('csvIsJson');
    an = analyzeFitNotes(await file.text());
    if (an.error) return confirmDialog(an.error === 'columns' ? t('csvBadColumns', { cols: an.columns.join(', ') || '—' }) : t('csvEmpty'), { cancel: false });
  }
  const opts = await importOptions(an);
  if (!opts) return;
  const incomplete = an.incomplete || [];
  const final = opts.includeIncomplete
    ? { ...an, sets: [...an.sets, ...incomplete].sort((a, b) => a.order - b.order) }
    : { ...an, skipped: [...an.skipped, ...incomplete.map(s => ({ line: s.line, reason: 'notComplete', raw: s.raw }))] };
  toast(t('importing'), { ms: 1500 });
  await data.importFitNotes(final, { removeUnusedBuiltins: opts.removeBuiltins, restSeconds: opts.useRest ? an.restSeconds : undefined });
  ctx.go('/import-report');
}

/** Summary + choices before importing. Resolves with the options, or null if cancelled. */
function importOptions(an) {
  const isBackup = an.source === 'backup';
  const incomplete = an.incomplete || [];
  const restDiffers = !!an.restSeconds && an.restSeconds !== data.settings.rest;
  const opts = { includeIncomplete: false, removeBuiltins: isBackup, useRest: restDiffers };
  return sheet(close => {
    const box = h('div', { class: 'stack' });
    const draw = () => {
      const sets = opts.includeIncomplete ? [...an.sets, ...incomplete] : an.sets;
      const dates = sets.map(s => s.date).sort();
      const lines = [t('csvSummary', {
        sets: sets.length, ex: new Set(sets.map(s => norm(s.exercise))).size,
        from: dates[0] ? fmtLong(dates[0]) : '–', to: dates.length ? fmtLong(dates.at(-1)) : '–',
      })];
      if (isBackup) lines.push(t('backupExtras', { lib: an.library.length, routines: an.routines.length }));
      if (an.skipped.length) lines.push(t('csvSkippedWarn', { n: an.skipped.length }));
      if (an.dateOrderAssumed) lines.push(t('csvDateAssumed'));
      if (an.unit === 'lb' && !isBackup) lines.push(t('csvLbs'));
      box.replaceChildren(
        h('h3', { class: 'sheet-title' }, t('importFromFitNotes')),
        h('p', { class: 'msg' }, lines.join('\n\n')),
        h('div', { class: 'list' },
          incomplete.length > 0 && toggleRow(t('includeIncomplete', { n: incomplete.length }), opts.includeIncomplete, v => { opts.includeIncomplete = v; draw(); }, t('includeIncompleteSub')),
          toggleRow(t('removeBuiltins'), opts.removeBuiltins, v => { opts.removeBuiltins = v; draw(); }, t('removeBuiltinsSub')),
          restDiffers && toggleRow(t('useFitnotesRest', { v: fmtRest(an.restSeconds) }), opts.useRest, v => { opts.useRest = v; draw(); }, t('useFitnotesRestSub', { v: fmtRest(data.settings.rest) }))),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn big', onclick: () => close(null) }, t('cancel')),
          h('button', { class: 'btn big primary', onclick: () => close({ ...opts }) }, t('import'))));
    };
    draw();
    return box;
  }).then(v => v ?? null);
}

export async function renderReport(_, ctx) {
  const r = data.settings.lastImport;
  const bar = topbar({ title: t('importReport'), back: () => ctx.back('/more') });
  if (!r) return h('div', { class: 'screen' }, bar, h('div', { class: 'content empty' }, t('noImport')));
  const isBackup = r.source === 'backup';
  const stat = (label, value) => h('div', { class: 'rec-row' }, h('span', { class: 'muted' }, label), h('span', { class: 'rec-val' }, value));
  const details = (title, items, render = x => x) => items?.length > 0 && h('details', { class: 'card' },
    h('summary', {}, `${title} (${items.length})`),
    h('ul', { class: 'plain' }, items.map(x => h('li', {}, render(x)))));
  const notes = [
    r.nonWeightExercises > 0 && t('nonWeightNotImported', { n: r.nonWeightExercises }),
    r.comments > 0 && t('commentsNotImported', { n: r.comments }),
  ].filter(Boolean);
  return h('div', { class: 'screen' }, bar,
    h('div', { class: 'content' },
      h('div', { class: 'card' },
        stat(t(isBackup ? 'setsInFile' : 'rowsRead'), r.total),
        stat(t('setsImported'), r.imported),
        stat(t('duplicatesSkipped'), r.duplicates),
        stat(t(isBackup ? 'setsNotImported' : 'rowsNotRead'), r.skippedCount),
        r.from && stat(t('dateRange'), `${fmtLong(r.from)} – ${fmtLong(r.to)}`),
        r.createdRoutines?.length > 0 && stat(t('routinesCreated'), r.createdRoutines.length),
        r.builtinsRemoved > 0 && stat(t('builtinsRemoved'), r.builtinsRemoved),
        r.restSeconds && stat(t('defaultRest'), fmtRest(r.restSeconds))),
      r.dateOrderAssumed && h('div', { class: 'banner warn' }, t('csvDateAssumed')),
      notes.length > 0 && h('p', { class: 'muted small' }, notes.join(' ')),
      details(t(isBackup ? 'setsNotImported' : 'rowsNotRead'), r.skipped, x => h('span', {}, h('b', {}, t(isBackup ? 'setNo' : 'line', { n: x.line })), ' — ', t('skip_' + x.reason), h('div', { class: 'muted small mono' }, x.raw))),
      r.skippedCount > r.skipped.length && h('p', { class: 'muted small' }, t('moreRowsNotShown', { n: r.skippedCount - r.skipped.length })),
      details(t('routinesCreated'), r.createdRoutines),
      details(t('routinesExisting'), r.existingRoutines),
      details(t('mergedSpellings'), r.mergedNames, x => x.join('  =  ')),
      details(t('matchedExercises'), r.matchedExercises),
      details(t('createdExercises'), r.createdExercises),
      details(t('createdCategories'), r.createdCategories),
      h('button', { class: 'btn primary big', onclick: () => ctx.go('/', { replace: true }) }, t('done'))));
}
