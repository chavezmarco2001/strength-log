// Minimal promise wrapper around IndexedDB.
const DB_NAME = 'strength-log';
const VERSION = 2;
export const STORES = ['categories', 'exercises', 'sets', 'sessions', 'routines', 'settings', 'bodyweight'];

let dbp = null;
export function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = e => {
      const db = req.result;
      if (e.oldVersion < 1) {
        db.createObjectStore('categories', { keyPath: 'id' });
        db.createObjectStore('exercises', { keyPath: 'id' });
        const sets = db.createObjectStore('sets', { keyPath: 'id' });
        sets.createIndex('date', 'date');
        sets.createIndex('exerciseId', 'exerciseId');
        db.createObjectStore('sessions', { keyPath: 'date' });   // one per day: check-in + routine
        db.createObjectStore('routines', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'k' });
      }
      if (e.oldVersion < 2) {
        db.createObjectStore('bodyweight', { keyPath: 'date' });  // v2: { date, kg }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database blocked: close other tabs of this app.'));
  });
  return dbp;
}

const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
async function store(name, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export const getAll = async name => wrap((await store(name)).getAll());
export const get = async (name, key) => wrap((await store(name)).get(key));
export const count = async name => wrap((await store(name)).count());
export const byIndex = async (name, index, value) => wrap((await store(name)).index(index).getAll(value));
export const byRange = async (name, index, lo, hi) => wrap((await store(name)).index(index).getAll(IDBKeyRange.bound(lo, hi)));
export async function put(name, obj) { await wrap((await store(name, 'readwrite')).put(obj)); return obj; }
export const del = async (name, key) => wrap((await store(name, 'readwrite')).delete(key));

/** Walk an index with a cursor; stop when cb returns false. */
export async function iterate(name, index, direction, cb) {
  const s = await store(name);
  return new Promise((res, rej) => {
    const req = s.index(index).openCursor(null, direction);
    req.onsuccess = () => {
      const c = req.result;
      if (!c || cb(c.value) === false) return res();
      c.continue();
    };
    req.onerror = () => rej(req.error);
  });
}

/** Run several writes atomically: fn receives { storeName: IDBObjectStore }. */
export async function transact(names, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite');
    const stores = Object.fromEntries(names.map(n => [n, tx.objectStore(n)]));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    try { fn(stores); } catch (e) { tx.abort(); reject(e); }
  });
}
