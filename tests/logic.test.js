import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { parseNum, weekStart, addDays, norm } from '../js/util.js';
import { checkPR, markPRs, records, weeklyCheckins } from '../js/stats.js';
import { parseCSV, toCSV } from '../js/csv.js';
import { analyzeFitNotes, parseDate } from '../js/fitnotes.js';
import { dict } from '../js/i18n.js';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const S = (id, date, weight, reps, t = 0) => ({ id, date, weight, reps, t });

test('parseNum accepts comma decimals and rejects junk', () => {
  assert.equal(parseNum('62,5'), 62.5);
  assert.equal(parseNum(' 60 '), 60);
  assert.ok(Number.isNaN(parseNum('five')));
  assert.ok(Number.isNaN(parseNum('')));
  assert.ok(Number.isNaN(parseNum('6O')));
});

test('dates: weekStart is Monday, addDays crosses months', () => {
  assert.equal(weekStart('2026-11-08'), '2026-11-02'); // Sunday → previous Monday
  assert.equal(weekStart('2026-11-02'), '2026-11-02');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
});

test('norm ignores case, accents and spaces', () => {
  assert.equal(norm('  Press  de Bánca '), 'press de banca');
  assert.equal(norm('Pull-Up'), norm('pull up'));
});

test('checkPR: heavier weight, more reps at same weight, nothing on first set', () => {
  const prior = [S('a', '2026-01-01', 60, 8), S('b', '2026-01-01', 62.5, 5)];
  assert.equal(checkPR([], S('x', '2026-01-02', 60, 8)), null);
  assert.equal(checkPR(prior, S('x', '2026-01-02', 65, 1)), 'weight');
  assert.equal(checkPR(prior, S('x', '2026-01-02', 60, 9)), 'reps');
  assert.equal(checkPR(prior, S('x', '2026-01-02', 60, 8)), null);
  assert.equal(checkPR(prior, S('x', '2026-01-02', 55, 20)), null); // never done 55 before: not a record
});

test('markPRs flags records chronologically', () => {
  const sets = [S('1', 'd1', 60, 8), S('2', 'd1', 60, 8), S('3', 'd2', 62.5, 6), S('4', 'd3', 60, 10), S('5', 'd3', 62.5, 6)];
  const m = markPRs(sets);
  assert.deepEqual([...m.entries()], [['3', 'weight'], ['4', 'reps']]);
});

test('records: heaviest, best volume day, rep max per weight', () => {
  const r = records([S('1', 'd1', 60, 8), S('2', 'd1', 60, 8), S('3', 'd2', 70, 3), S('4', 'd2', 60, 10)]);
  assert.equal(r.heaviest.id, '3');
  assert.equal(r.bestVolume.date, 'd1'); // d1 = 960 kg, d2 = 210 + 600 = 810 kg
  assert.equal(r.repMax.find(s => s.weight === 60).reps, 10);
});

test('weeklyCheckins averages per Monday week and ignores empty sessions', () => {
  const w = weeklyCheckins([
    { date: '2026-11-02', mood: 4, motivation: 2 },
    { date: '2026-11-05', mood: 2 },
    { date: '2026-11-09', satisfaction: 5 },
    { date: '2026-11-10', note: 'only a note' },
  ]);
  assert.equal(w.length, 2);
  assert.deepEqual(w[0], { week: '2026-11-02', n: 2, mood: 3, motivation: 2, satisfaction: null });
  assert.equal(w[1].satisfaction, 5);
});

test('CSV round trip with quotes, commas and newlines', () => {
  const rows = [['a', 'b,c', 'say "hi"', 'line1\nline2'], ['1', '', '3', '4']];
  const parsed = parseCSV(toCSV(rows)).map(r => r.cells);
  assert.deepEqual(parsed, rows);
});

test('CSV with semicolons and BOM', () => {
  const p = parseCSV('﻿Date;Exercise\n2026-01-01;Squat\n');
  assert.deepEqual(p.map(r => r.cells), [['Date', 'Exercise'], ['2026-01-01', 'Squat']]);
});

test('parseDate handles ISO and day/month', () => {
  assert.equal(parseDate('2026-01-05'), '2026-01-05');
  assert.equal(parseDate('2026-01-05 18:30:00'), '2026-01-05');
  assert.equal(parseDate('05/01/2026', 'dmy'), '2026-01-05');
  assert.equal(parseDate('01/05/2026', 'mdy'), '2026-01-05');
  assert.equal(parseDate('2026-02-30'), null);
});

test('FitNotes sample: imports good rows and explains every skipped row', () => {
  const an = analyzeFitNotes(fs.readFileSync(path.join(root, 'tests/fixtures/fitnotes-sample.csv'), 'utf8'));
  assert.equal(an.error, undefined);
  assert.equal(an.total, 12);
  assert.equal(an.sets.length, 6);
  assert.equal(an.sets.length + an.skipped.length, an.total);
  const reasons = Object.fromEntries(an.skipped.map(s => [s.line, s.reason]));
  assert.deepEqual(reasons, { 6: 'cardio', 8: 'negativeWeight', 9: 'noExercise', 10: 'badDate', 11: 'badReps', 13: 'cardio' });
  const bench = an.sets.filter(s => norm(s.exercise) === 'flat barbell bench press');
  assert.equal(bench.length, 3);
  assert.equal(bench[2].comment, 'felt heavy, ok');
  assert.equal(an.sets.find(s => s.exercise === 'Pull Up').weight, 0);
});

test('FitNotes: missing columns are reported, pounds converted', () => {
  assert.equal(analyzeFitNotes('Foo,Bar\n1,2\n').error, 'columns');
  const an = analyzeFitNotes('Date,Exercise,Category,Weight (lbs),Reps\n2026-01-01,Squat,Legs,225,5\n');
  assert.equal(an.unit, 'lb');
  assert.equal(an.sets[0].weight, 102.06);
});

test('every translation key used in the code exists in English and Spanish', () => {
  const files = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') && files.push(path.join(d, e.name)));
  walk(path.join(root, 'js'));
  const used = new Set();
  for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\bt\('([a-zA-Z0-9_]+)'\s*([+)?,])/g)) if (m[2] !== '+') used.add(m[1]);
  // keys built dynamically
  for (const p of ['nav_workout', 'nav_history', 'nav_routines', 'nav_more', 'tab_track', 'tab_history', 'tab_graph']) used.add(p);
  for (const k of ['mood', 'motivation', 'satisfaction']) ['q_', 'low_', 'high_'].forEach(p => used.add(p + k));
  for (const r of ['noExercise', 'badDate', 'cardio', 'noReps', 'badReps', 'badWeight', 'negativeWeight']) used.add('skip_' + r);
  const missing = [...used].filter(k => !dict.en[k] || !dict.es[k]);
  assert.deepEqual(missing, []);
  const extraEs = Object.keys(dict.es).filter(k => !dict.en[k]);
  assert.deepEqual(extraEs, []);
  const missingEs = Object.keys(dict.en).filter(k => !dict.es[k]);
  assert.deepEqual(missingEs, []);
});

test('service worker caches every app file', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const listed = new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]));
  const files = [];
  const walk = (d, rel) => fs.readdirSync(d, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(path.join(d, e.name), rel + e.name + '/') : files.push(rel + e.name));
  walk(path.join(root, 'js'), 'js/');
  walk(path.join(root, 'icons'), 'icons/');
  files.push('css/app.css', 'index.html', 'manifest.webmanifest');
  assert.deepEqual(files.filter(f => !listed.has(f)), []);
});
