// DOM helpers and shared UI pieces (sheets, dialogs, toasts, icons).
import { t } from './i18n.js';

const SVGNS = 'http://www.w3.org/2000/svg';

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === true) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

/** h('button', { class: 'btn', onclick }, 'Label', childNode, [more]) */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
    } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}

export function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) el.append(k);
  return el;
}

const ICONS = {
  back: 'M15 18l-6-6 6-6',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 6l6 6-6 6',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  dumbbell: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  clipboard: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.5-4.5',
};
export function icon(name, size = 24) {
  return svg('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': name === 'more' ? 3.2 : 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    svg('path', { d: ICONS[name] }));
}

export function topbar({ title, sub, back, actions = [] }) {
  return h('header', { class: 'topbar' },
    back && h('button', { class: 'icon-btn', 'aria-label': t('back'), onclick: back }, icon('back')),
    h('div', { class: 'topbar-title' }, h('div', { class: 'title' }, title), sub && h('div', { class: 'sub' }, sub)),
    actions.map(a => h('button', { class: 'icon-btn', 'aria-label': a.label || '', onclick: a.onclick }, icon(a.icon))));
}

/** Segmented control. */
export function seg(options, value, onpick) {
  return h('div', { class: 'seg', role: 'radiogroup' }, options.map(([v, label]) =>
    h('button', { class: v === value ? 'active' : '', role: 'radio', 'aria-checked': String(v === value), onclick: () => v !== value && onpick(v) }, label)));
}

/** On/off row. */
export function toggleRow(label, on, onchange, sub) {
  return h('button', { class: 'row switch-row', role: 'switch', 'aria-checked': String(!!on), onclick: () => onchange(!on) },
    h('span', { class: 'row-main' }, label, sub && h('div', { class: 'row-sub' }, sub)), h('span', { class: 'switch' }));
}

// ---------- toasts ----------
export function toast(msg, { kind = '', ms = 2600, action } = {}) {
  const root = document.getElementById('toast-root');
  let timer = null;
  const el = h('div', { class: 'toast ' + kind, role: 'status' }, h('span', {}, msg),
    action && h('button', { class: 'toast-action', onclick: e => { e.stopPropagation(); dismiss(); action.fn(); } }, action.label));
  const dismiss = () => { clearTimeout(timer); el.classList.remove('show'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', dismiss);
  root.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  if (ms) timer = setTimeout(dismiss, ms);
  return dismiss;
}

// ---------- bottom sheets ----------
const openSheets = new Set();
export function closeAllSheets() { for (const c of [...openSheets]) c(undefined); }

/** build(close) → element. Resolves with the value passed to close(), or undefined if dismissed. */
export function sheet(build) {
  return new Promise(resolve => {
    const root = document.getElementById('overlay-root');
    const backdrop = h('div', { class: 'backdrop' });
    const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
    let done = false;
    const close = val => {
      if (done) return;
      done = true;
      openSheets.delete(close);
      backdrop.classList.remove('show'); panel.classList.remove('show');
      setTimeout(() => { backdrop.remove(); panel.remove(); }, 220);
      resolve(val);
    };
    openSheets.add(close);
    backdrop.addEventListener('click', () => close(undefined));
    append(panel, [build(close)]);
    root.append(backdrop, panel);
    requestAnimationFrame(() => requestAnimationFrame(() => { backdrop.classList.add('show'); panel.classList.add('show'); }));
  });
}

/** List of options in a sheet → chosen value or undefined. */
export function chooser(title, options) {
  return sheet(close => h('div', {},
    title && h('h3', { class: 'sheet-title' }, title),
    options.map(o => h('button', { class: 'row' + (o.selected ? ' selected' : '') + (o.danger ? ' danger' : ''), onclick: () => close(o.value) },
      h('span', { class: 'row-main' }, o.label, o.sub && h('div', { class: 'row-sub' }, o.sub)), o.selected && icon('check'))),
    h('button', { class: 'btn ghost full', onclick: () => close(undefined) }, t('cancel'))));
}

export function confirmDialog(msg, { ok = t('ok'), danger = false, cancel = true } = {}) {
  return sheet(close => h('div', {},
    h('p', { class: 'msg' }, msg),
    h('div', { class: 'btn-row' },
      cancel && h('button', { class: 'btn big', onclick: () => close(false) }, t('cancel')),
      h('button', { class: 'btn big ' + (danger ? 'danger' : 'primary'), onclick: () => close(true) }, ok)))).then(v => !!v);
}

/** Simple form in a sheet → { name: value } or null. */
export function formDialog(title, fields, okLabel = t('save')) {
  return sheet(close => {
    const inputs = {};
    const form = h('form', {
      class: 'form',
      onsubmit: e => {
        e.preventDefault();
        const out = {};
        for (const f of fields) out[f.name] = inputs[f.name].value.trim();
        const missing = fields.find(f => f.required && !out[f.name]);
        if (missing) { inputs[missing.name].focus(); return; }
        close(out);
      },
    },
    h('h3', { class: 'sheet-title' }, title),
    fields.map(f => {
      let input;
      if (f.type === 'select') input = h('select', { class: 'input' }, f.options.map(o => h('option', { value: o.value, selected: o.value === f.value }, o.label)));
      else if (f.type === 'textarea') { input = h('textarea', { class: 'input', rows: 3, maxlength: f.maxlength }); input.value = f.value ?? ''; }
      else input = h('input', { class: 'input', type: 'text', value: f.value ?? '', maxlength: f.maxlength, autocomplete: 'off', enterkeyhint: 'done' });
      inputs[f.name] = input;
      return h('label', { class: 'field' }, h('span', { class: 'field-label' }, f.label), input);
    }),
    h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn big', onclick: () => close(null) }, t('cancel')),
      h('button', { type: 'submit', class: 'btn big primary' }, okLabel)));
    return form;
  }).then(v => v ?? null);
}

// ---------- theme ----------
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'system' && !matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0f1115' : '#f4f5f7');
}
