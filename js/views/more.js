// "More" tab: backup & import, progress pages, settings. Plus the import report.
import { h, icon, topbar, seg, toggleRow, chooser, confirmDialog, toast, applyTheme } from '../ui.js';
import * as data from '../data.js';
import { t, setLang, fmtLong, fmtRest, fmtAgo, fmtNum } from '../i18n.js';
import { toISODate, norm, REST_OPTIONS, STEP_OPTIONS } from '../util.js';
import { analyzeFitNotes } from '../fitnotes.js';
import { saveFile, canShareFiles } from '../files.js';
import { testAlarm } from '../timer.js';

export const APP_VERSION = '1.0.1';

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

      // ----- progress -----
      h('h3', { class: 'section' }, t('progress')),
      h('div', { class: 'list card flush' },
        h('button', { class: 'row', onclick: () => ctx.go('/checkins') }, h('span', { class: 'row-main' }, t('checkins'), h('div', { class: 'row-sub' }, t('checkinsSub'))), icon('right', 20)),
        h('button', { class: 'row', onclick: () => ctx.go('/library') }, h('span', { class: 'row-main' }, t('library'), h('div', { class: 'row-sub' }, t('librarySub', { n: c.exercises }))), icon('right', 20))),

      // ----- settings -----
      h('h3', { class: 'section' }, t('settings')),
      h('div', { class: 'card stack' },
        h('div', { class: 'field-label' }, t('language')),
        seg([['en', 'English'], ['es', 'Español']], s.lang, async v => { await data.setSetting('lang', v); setLang(v); ctx.relabel(); }),
        h('div', { class: 'field-label' }, t('theme')),
        seg([['dark', t('themeDark')], ['light', t('themeLight')], ['system', t('themeSystem')]], s.theme, async v => { await data.setSetting('theme', v); applyTheme(v); ctx.refresh(); }),
        h('div', { class: 'field-label' }, t('weightStep')),
        seg(STEP_OPTIONS.map(v => [v, fmtNum(v) + ' kg']), s.step, v => set('step', v))),
      h('div', { class: 'list card flush' },
        h('button', { class: 'row', onclick: async () => {
          const v = await chooser(t('defaultRest'), REST_OPTIONS.map(x => ({ label: fmtRest(x), value: x, selected: x === s.rest })));
          if (v !== undefined) set('rest', v);
        } }, h('span', { class: 'row-main' }, t('defaultRest'), h('div', { class: 'row-sub' }, t('defaultRestSub'))), h('span', { class: 'row-count' }, fmtRest(s.rest))),
        toggleRow(t('sound'), s.sound, v => set('sound', v)),
        toggleRow(t('vibration'), s.vibrate, v => set('vibrate', v)),
        h('button', { class: 'row', onclick: testAlarm }, h('span', { class: 'row-main' }, t('testAlarm'))),
        toggleRow(t('keepAwake'), s.wake, v => set('wake', v), t('keepAwakeSub'))),

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
  toast(t('restored'));
  ctx.relabel();
}

async function importCSV(file, ctx) {
  if (!file) return;
  const sig = String.fromCharCode(...new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (sig.startsWith('SQLite format 3') || /\.fitnotes$/i.test(file.name)) return confirmDialog(t('csvIsFitnotesBackup', { name: file.name }), { cancel: false });
  if (sig.startsWith('PK')) return confirmDialog(t('csvIsZip', { name: file.name }), { cancel: false });
  if (/\.json$/i.test(file.name)) return confirmDialog(t('csvIsJson', { name: file.name }), { cancel: false });
  const an = analyzeFitNotes(await file.text());
  if (an.error) {
    await confirmDialog(an.error === 'columns' ? t('csvBadColumns', { cols: an.columns.join(', ') || '—' }) : t('csvEmpty'), { cancel: false });
    return;
  }
  const exCount = new Set(an.sets.map(s => norm(s.exercise))).size;
  const dates = an.sets.map(s => s.date).sort();
  let msg = t('csvSummary', { sets: an.sets.length, ex: exCount, from: dates[0] ? fmtLong(dates[0]) : '–', to: dates.length ? fmtLong(dates.at(-1)) : '–' });
  if (an.skipped.length) msg += '\n\n' + t('csvSkippedWarn', { n: an.skipped.length });
  if (an.dateOrderAssumed) msg += '\n\n' + t('csvDateAssumed');
  if (an.unit === 'lb') msg += '\n\n' + t('csvLbs');
  if (!(await confirmDialog(msg, { ok: t('import') }))) return;
  await data.importFitNotes(an);
  ctx.go('/import-report');
}

export async function renderReport(_, ctx) {
  const r = data.settings.lastImport;
  const bar = topbar({ title: t('importReport'), back: () => ctx.back('/more') });
  if (!r) return h('div', { class: 'screen' }, bar, h('div', { class: 'content empty' }, t('noImport')));
  const stat = (label, value) => h('div', { class: 'rec-row' }, h('span', { class: 'muted' }, label), h('span', { class: 'rec-val' }, value));
  const details = (title, items, render = x => x) => items.length > 0 && h('details', { class: 'card' },
    h('summary', {}, `${title} (${items.length})`),
    h('ul', { class: 'plain' }, items.map(x => h('li', {}, render(x)))));
  return h('div', { class: 'screen' }, bar,
    h('div', { class: 'content' },
      h('div', { class: 'card' },
        stat(t('rowsRead'), r.total),
        stat(t('setsImported'), r.imported),
        stat(t('duplicatesSkipped'), r.duplicates),
        stat(t('rowsNotRead'), r.skippedCount),
        r.from && stat(t('dateRange'), `${fmtLong(r.from)} – ${fmtLong(r.to)}`)),
      r.dateOrderAssumed && h('div', { class: 'banner warn' }, t('csvDateAssumed')),
      details(t('rowsNotRead'), r.skipped, x => h('span', {}, h('b', {}, t('line', { n: x.line })), ' — ', t('skip_' + x.reason), h('div', { class: 'muted small mono' }, x.raw))),
      r.skippedCount > r.skipped.length && h('p', { class: 'muted small' }, t('moreRowsNotShown', { n: r.skippedCount - r.skipped.length })),
      details(t('mergedSpellings'), r.mergedNames, x => x.join('  =  ')),
      details(t('matchedExercises'), r.matchedExercises),
      details(t('createdExercises'), r.createdExercises),
      details(t('createdCategories'), r.createdCategories),
      h('button', { class: 'btn primary big', onclick: () => ctx.go('/', { replace: true }) }, t('done'))));
}
