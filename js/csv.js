// CSV parsing / writing (RFC 4180, comma or semicolon). Pure — no DOM.

/** Returns [{ line, cells }] where `line` is the 1-based line where the row starts. */
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const nl = text.search(/\r?\n/);
  const first = nl === -1 ? text : text.slice(0, nl);
  const delim = first.split(';').length > first.split(',').length ? ';' : ',';
  const rows = [];
  let row = [], field = '', inQuotes = false, line = 1, rowLine = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else {
        if (c === '\n') line++;
        field += c;
      }
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') {
      row.push(field); rows.push({ line: rowLine, cells: row });
      row = []; field = ''; line++; rowLine = line;
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push({ line: rowLine, cells: row }); }
  return rows;
}

const cell = v => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export const toCSV = rows => rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
