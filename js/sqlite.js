// Minimal read-only SQLite file reader — just enough to read a FitNotes backup
// (.fitnotes) in the browser without any library. Reads ordinary rowid tables:
// B-tree pages, overflow pages, record format, and column DEFAULTs for rows
// written before an ALTER TABLE ADD COLUMN. File format: https://www.sqlite.org/fileformat.html

const SIG = 'SQLite format 3\0';
export function isSQLite(bytes) {
  for (let i = 0; i < SIG.length; i++) if (bytes[i] !== SIG.charCodeAt(i)) return false;
  return true;
}

function varint(arr, pos) {
  let v = 0;
  for (let i = 0; i < 8; i++) {
    const b = arr[pos + i];
    v = v * 128 + (b & 0x7f);
    if (b < 0x80) return [v, pos + i + 1];
  }
  return [v * 256 + arr[pos + 8], pos + 9];
}

/** Column names (+ rowid alias and DEFAULT value) from a CREATE TABLE statement. */
export function parseColumns(sql) {
  const body = sql.slice(sql.indexOf('(') + 1, sql.lastIndexOf(')'));
  const parts = [];
  let depth = 0, cur = '', quote = null;
  for (const ch of body) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; cur += ch; continue; }
    if (ch === '[') { quote = ']'; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts
    .filter(p => !/^(constraint|primary\s+key|unique|check|foreign\s+key)\b/i.test(p))
    .map(p => {
      const m = /^(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|(\S+))\s*([\s\S]*)$/.exec(p);
      const name = m[1] ?? m[2] ?? m[3] ?? m[4];
      const rest = m[5] || '';
      let dflt = null;
      const d = /\bDEFAULT\s+\(?\s*('(?:[^']|'')*'|[-+]?\d+(?:\.\d+)?|NULL|TRUE|FALSE)/i.exec(rest);
      if (d) {
        const s = d[1];
        if (s[0] === "'") dflt = s.slice(1, -1).replace(/''/g, "'");
        else if (/^null$/i.test(s)) dflt = null;
        else if (/^true$/i.test(s)) dflt = 1;
        else if (/^false$/i.test(s)) dflt = 0;
        else dflt = Number(s);
      }
      return { name, rowid: /^INTEGER\s+PRIMARY\s+KEY\b/i.test(rest.trim()), dflt };
    });
}

export function openSQLite(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 100 || !isSQLite(bytes)) throw new Error('Not a SQLite database');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pageSize = dv.getUint16(16);
  if (pageSize === 1) pageSize = 65536;
  const usable = pageSize - bytes[20];
  const encoding = dv.getUint32(56) || 1;
  const decoder = new TextDecoder(encoding === 2 ? 'utf-16le' : encoding === 3 ? 'utf-16be' : 'utf-8');
  const pageStart = n => (n - 1) * pageSize;

  function payload(p, size) {
    const maxLocal = usable - 35;
    if (size <= maxLocal) return bytes.subarray(p, p + size);
    const minLocal = Math.floor(((usable - 12) * 32) / 255) - 23;
    const k = minLocal + ((size - minLocal) % (usable - 4));
    const local = k <= maxLocal ? k : minLocal;
    const out = new Uint8Array(size);
    out.set(bytes.subarray(p, p + local), 0);
    let got = local, next = dv.getUint32(p + local), guard = 0;
    while (got < size && next) {
      if (++guard > 1e6) throw new Error('Overflow chain too long');
      const o = pageStart(next);
      const n = Math.min(usable - 4, size - got);
      out.set(bytes.subarray(o + 4, o + 4 + n), got);
      got += n;
      next = dv.getUint32(o);
    }
    return out;
  }

  /** Collects [rowid, payload] of a table B-tree in rowid order. */
  function walk(page, out, depth = 0) {
    if (depth > 64) throw new Error('B-tree too deep');
    const base = pageStart(page);
    const h = page === 1 ? 100 + base : base;
    const type = bytes[h];
    const cells = dv.getUint16(h + 3);
    if (type === 0x05) {
      for (let i = 0; i < cells; i++) walk(dv.getUint32(base + dv.getUint16(h + 12 + 2 * i)), out, depth + 1);
      walk(dv.getUint32(h + 8), out, depth + 1);
    } else if (type === 0x0d) {
      for (let i = 0; i < cells; i++) {
        let p = base + dv.getUint16(h + 8 + 2 * i), size, rowid;
        [size, p] = varint(bytes, p);
        [rowid, p] = varint(bytes, p);
        out.push([rowid, payload(p, size)]);
      }
    } else throw new Error(`Unexpected page type ${type} on page ${page}`);
  }

  function record(buf) {
    const d = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let [headerSize, p] = varint(buf, 0);
    const types = [];
    while (p < headerSize) { let t; [t, p] = varint(buf, p); types.push(t); }
    let q = headerSize;
    return types.map(t => {
      if (t === 0) return null;
      if (t === 8) return 0;
      if (t === 9) return 1;
      if (t === 7) { q += 8; return d.getFloat64(q - 8); }
      if (t >= 1 && t <= 6) {
        const n = [0, 1, 2, 3, 4, 6, 8][t];
        let v;
        if (n === 8) v = Number(d.getBigInt64(q));
        else {
          v = 0;
          for (let i = 0; i < n; i++) v = v * 256 + buf[q + i];
          if (buf[q] & 0x80) v -= 2 ** (8 * n);
        }
        q += n;
        return v;
      }
      if (t >= 12) {
        const n = t % 2 ? (t - 13) / 2 : (t - 12) / 2;
        const slice = buf.subarray(q, q + n);
        q += n;
        return t % 2 ? decoder.decode(slice) : slice.slice();
      }
      throw new Error('Bad serial type ' + t);
    });
  }

  const tables = new Map();
  const master = [];
  walk(1, master);
  for (const [, buf] of master) {
    const [type, name, , rootpage, sql] = record(buf);
    if (type === 'table' && rootpage && sql && !/WITHOUT\s+ROWID/i.test(sql)) {
      tables.set(String(name).toLowerCase(), { name, root: rootpage, cols: parseColumns(sql) });
    }
  }

  return {
    tables: () => [...tables.values()].map(t => t.name),
    has: name => tables.has(name.toLowerCase()),
    columns: name => tables.get(name.toLowerCase())?.cols.map(c => c.name) ?? [],
    rows(name) {
      const t = tables.get(name.toLowerCase());
      if (!t) throw new Error('No table ' + name);
      const raw = [];
      walk(t.root, raw);
      return raw.map(([rowid, buf]) => {
        const v = record(buf);
        const o = {};
        t.cols.forEach((c, i) => { o[c.name] = c.rowid ? rowid : i < v.length ? v[i] : c.dflt; });
        return o;
      });
    },
  };
}
