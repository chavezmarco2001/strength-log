// Small dependency-free SVG line chart. Tap or drag on it to read values.
import { svg } from './ui.js';

/**
 * series: [{ points: [{x, y}], color, label? }]  (x = ms timestamp)
 * fmtY: axis labels, fmtVal: readout values, fmtX: readout date
 */
export function lineChart({ series, yMin, yMax, fmtY = String, fmtVal = fmtY, fmtX = String, height = 220 }) {
  const W = 360, H = height, L = 44, R = 14, T = 30, B = 22;
  const pts = series.flatMap(s => s.points);
  if (!pts.length) return null;
  let x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x));
  if (x0 === x1) { x0 -= 86400000; x1 += 86400000; }
  let y0 = yMin ?? Math.min(...pts.map(p => p.y)), y1 = yMax ?? Math.max(...pts.map(p => p.y));
  if (yMin == null || yMax == null) {
    const padY = (y1 - y0) * 0.12 || Math.max(1, Math.abs(y1) * 0.1);
    if (yMin == null) y0 = Math.max(0, y0 - padY);
    if (yMax == null) y1 += padY;
  }
  const sx = x => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const sy = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
  for (let i = 0; i <= 4; i++) {
    const v = y0 + ((y1 - y0) * i) / 4, y = sy(v);
    root.append(svg('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'grid' }), svg('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', class: 'axis' }, fmtY(v)));
  }
  const allX = [...new Set(pts.map(p => p.x))].sort((a, b) => a - b);
  root.append(
    svg('text', { x: L, y: H - 4, class: 'axis' }, fmtX(allX[0])),
    svg('text', { x: W - R, y: H - 4, 'text-anchor': 'end', class: 'axis' }, fmtX(allX.at(-1))));

  const cursor = svg('line', { y1: T - 4, y2: H - B, class: 'cursor', visibility: 'hidden' });
  root.append(cursor);
  for (const s of series) {
    const p = [...s.points].sort((a, b) => a.x - b.x);
    const d = p.map((q, i) => `${i ? 'L' : 'M'}${sx(q.x).toFixed(1)},${sy(q.y).toFixed(1)}`).join('');
    if (p.length > 1 && series.length === 1) root.append(svg('path', { d: `${d}L${sx(p.at(-1).x).toFixed(1)},${H - B}L${sx(p[0].x).toFixed(1)},${H - B}Z`, class: 'area', style: `fill:${s.color}` }));
    if (p.length > 1) root.append(svg('path', { d, class: 'line', style: `stroke:${s.color}` }));
    if (p.length <= 80) p.forEach(q => root.append(svg('circle', { cx: sx(q.x), cy: sy(q.y), r: 3.5, class: 'pt', style: `fill:${s.color}` })));
  }

  const readout = svg('text', { x: L, y: 16, class: 'readout' });
  root.append(readout);
  function show(x) {
    readout.replaceChildren(fmtX(x) + '   ');
    for (const s of series) {
      const q = s.points.find(p => p.x === x);
      if (!q) continue;
      readout.append(svg('tspan', { style: `fill:${s.color}` }, (s.label ? s.label + ' ' : '') + fmtVal(q.y) + '   '));
    }
    cursor.setAttribute('x1', sx(x)); cursor.setAttribute('x2', sx(x));
    cursor.setAttribute('visibility', 'visible');
  }
  const pick = e => {
    const r = root.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    let best = allX[0];
    for (const x of allX) if (Math.abs(sx(x) - vx) < Math.abs(sx(best) - vx)) best = x;
    show(best);
  };
  root.addEventListener('pointerdown', pick);
  root.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') pick(e); });
  show(allX.at(-1));
  return root;
}

/**
 * Simple bar chart. bars: [{ label, value, title? }]. Tap a bar to read it.
 * The last bar is highlighted (usually "this week").
 */
export function barChart({ bars, fmtY = String, fmtVal = fmtY, color = 'var(--accent)', height = 170 }) {
  if (!bars.length) return null;
  const W = 360, H = height, L = 34, R = 8, T = 26, B = 22;
  const max = Math.max(1, ...bars.map(b => b.value));
  const top = niceMax(max);
  const bw = (W - L - R) / bars.length;
  const sy = v => T + (1 - v / top) * (H - T - B);
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
  for (let i = 0; i <= 2; i++) {
    const v = (top * i) / 2, y = sy(v);
    root.append(svg('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'grid' }), svg('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', class: 'axis' }, fmtY(v)));
  }
  const readout = svg('text', { x: L, y: 15, class: 'readout' });
  const rects = bars.map((b, i) => {
    const x = L + i * bw + bw * 0.18, w = bw * 0.64, y = sy(b.value);
    const r = svg('rect', { x, y, width: w, height: Math.max(0, H - B - y), class: 'bar', style: `fill:${color}` });
    root.append(r);
    if (bars.length <= 6 || (bars.length - 1 - i) % 2 === 0) root.append(svg('text', { x: x + w / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis' }, b.label));
    return r;
  });
  root.append(readout);
  const show = i => {
    readout.textContent = `${bars[i].title || bars[i].label}: ${fmtVal(bars[i].value)}`;
    rects.forEach((r, j) => (r.style.fill = j === i ? 'var(--accent2)' : color));
  };
  root.addEventListener('pointerdown', e => {
    const rr = root.getBoundingClientRect();
    const i = Math.floor((((e.clientX - rr.left) / rr.width) * W - L) / bw);
    if (i >= 0 && i < bars.length) show(i);
  });
  show(bars.length - 1);
  return root;
}
function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
