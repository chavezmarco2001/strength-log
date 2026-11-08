import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openSQLite, isSQLite, parseColumns } from '../js/sqlite.js';

function makeDb(build) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sl-')), 'test.db');
  const db = new DatabaseSync(file);
  build(db);
  db.close();
  return file;
}

test('parseColumns finds names, rowid alias and defaults', () => {
  const cols = parseColumns(`CREATE TABLE t (_id INTEGER PRIMARY KEY AUTOINCREMENT, "my name" TEXT NOT NULL, w REAL DEFAULT 2.5, s TEXT DEFAULT 'it''s', n INTEGER NOT NULL DEFAULT -1, UNIQUE (w, s))`);
  assert.deepEqual(cols, [
    { name: '_id', rowid: true, dflt: null },
    { name: 'my name', rowid: false, dflt: null },
    { name: 'w', rowid: false, dflt: 2.5 },
    { name: 's', rowid: false, dflt: "it's" },
    { name: 'n', rowid: false, dflt: -1 },
  ]);
});

test('reader matches SQLite: many rows, overflow pages, unicode, negatives, added columns', () => {
  const long = 'ñandú 💪 '.repeat(2000);
  const file = makeDb(db => {
    db.exec('PRAGMA page_size = 1024');
    db.exec('CREATE TABLE log (_id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, w REAL, reps INTEGER, note TEXT, big INTEGER)');
    const ins = db.prepare('INSERT INTO log (date, w, reps, note, big) VALUES (?, ?, ?, ?, ?)');
    db.exec('BEGIN');
    for (let i = 0; i < 3000; i++) ins.run(`2026-01-${String((i % 28) + 1).padStart(2, '0')}`, i % 7 === 0 ? 62.5 : i, i % 2 ? -i : i, i % 500 === 0 ? long : i % 3 ? null : 'Press de banca', i * 1e9);
    db.exec('COMMIT');
    db.exec("ALTER TABLE log ADD COLUMN done INTEGER NOT NULL DEFAULT 1");
    db.exec("ALTER TABLE log ADD COLUMN tag TEXT DEFAULT 'x'");
    db.exec("INSERT INTO log (date, w, reps, done, tag) VALUES ('2026-02-01', 1.25, 3, 0, 'new')");
    db.exec('CREATE TABLE "Category" (_id INTEGER PRIMARY KEY, name TEXT, colour INTEGER)');
    db.exec("INSERT INTO Category VALUES (1, 'Pecho', -1739917), (2, 'Piernas', 4278190335)");
  });
  const bytes = fs.readFileSync(file);
  assert.ok(isSQLite(bytes));
  const mine = openSQLite(bytes);
  const ref = new DatabaseSync(file, { readOnly: true });
  for (const t of ['log', 'Category']) {
    const a = mine.rows(t);
    const b = ref.prepare(`SELECT * FROM "${t}" ORDER BY rowid`).all().map(r => ({ ...r }));
    assert.equal(a.length, b.length, t + ' row count');
    assert.deepEqual(a, b, t + ' rows');
  }
  assert.ok(mine.has('category'));
  assert.equal(mine.rows('log')[0].tag, 'x');      // old row gets the column DEFAULT
  assert.equal(mine.rows('log').at(-1).done, 0);
});

test('rejects files that are not SQLite', () => {
  assert.equal(isSQLite(new TextEncoder().encode('Date,Exercise\n')), false);
  assert.throws(() => openSQLite(new Uint8Array(200)));
});
