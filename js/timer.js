// Rest timer: starts after each saved set, survives screen changes and reloads.
// Beeps are scheduled ahead on the audio clock so they still sound if the page is throttled.
import { h, icon } from './ui.js';
import { t } from './i18n.js';
import * as data from './data.js';

let endAt = 0, total = 0, iv = null, audio = null, nodes = [], doneTimer = null;
const root = () => document.getElementById('timer');

export function init() {
  try {
    const s = JSON.parse(localStorage.getItem('restTimer') || 'null');
    if (s && s.endAt > Date.now()) { endAt = s.endAt; total = s.total; loop(); }
  } catch { /* storage unavailable */ }
  draw();
}

export const running = () => endAt > Date.now();

export function startRest(sec) {
  if (!sec || sec <= 0) return;
  unlockAudio();
  total = sec;
  endAt = Date.now() + sec * 1000;
  clearTimeout(doneTimer); doneTimer = null;
  schedule(); save(); loop(); draw(); changed();
}

export function adjust(delta) {
  if (!running()) return;
  endAt += delta * 1000;
  total = Math.max(1, total + delta);
  if (endAt <= Date.now() + 500) return stop();
  schedule(); save(); draw();
}

export function stop() {
  endAt = 0;
  cancelBeeps();
  clearInterval(iv); iv = null;
  save(); draw(); changed();
}

function save() { try { localStorage.setItem('restTimer', JSON.stringify({ endAt, total })); } catch { /* ignore */ } }
function changed() { window.dispatchEvent(new Event('timerchange')); }
function loop() { if (!iv) iv = setInterval(tick, 250); }
function tick() { if (Date.now() >= endAt) finish(); else update(); }

function finish() {
  clearInterval(iv); iv = null;
  endAt = 0; save();
  if (data.settings.vibrate && navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
  const scheduledOk = audio && audio.state === 'running' && nodes.length;
  if (data.settings.sound && !scheduledOk) beep(0);
  nodes = [];
  doneTimer = setTimeout(clearDone, 6000);
  draw(); changed();
}
function clearDone() { clearTimeout(doneTimer); doneTimer = null; draw(); }

// ---------- sound ----------
function unlockAudio() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { audio = null; }
}
function cancelBeeps() { for (const n of nodes) { try { n.stop(); } catch { /* already stopped */ } } nodes = []; }
function schedule() {
  cancelBeeps();
  if (data.settings.sound && audio) beep(Math.max(0, (endAt - Date.now()) / 1000));
}
function beep(delay) {
  if (!audio) unlockAudio();
  if (!audio) return;
  const t0 = audio.currentTime + delay;
  for (let i = 0; i < 3; i++) {
    const o = audio.createOscillator(), g = audio.createGain(), s = t0 + i * 0.35;
    o.type = 'sine';
    o.frequency.value = i === 2 ? 1175 : 880;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.6, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.28);
    o.connect(g).connect(audio.destination);
    o.start(s); o.stop(s + 0.3);
    nodes.push(o);
  }
}
/** Plays the alarm now (used by the "test" button in settings). */
export function testAlarm() {
  unlockAudio();
  if (data.settings.sound) beep(0.05);
  if (data.settings.vibrate && navigator.vibrate) navigator.vibrate([400, 200, 400]);
}

// ---------- view ----------
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function draw() {
  const el = root();
  if (!el) return;
  const visible = running() || !!doneTimer;
  document.body.classList.toggle('has-timer', visible);
  el.hidden = !visible;
  if (!visible) { el.replaceChildren(); return; }
  if (doneTimer) {
    el.className = 'timer done';
    el.replaceChildren(h('button', { class: 'timer-done', onclick: clearDone }, '✓ ' + t('restOver')));
    return;
  }
  el.className = 'timer';
  el.replaceChildren(
    h('div', { class: 'timer-fill' }),
    h('button', { class: 'timer-btn', 'aria-label': t('minus15'), onclick: () => adjust(-15) }, '−15'),
    h('div', { class: 'timer-time', 'aria-live': 'off' }),
    h('button', { class: 'timer-btn', 'aria-label': t('plus15'), onclick: () => adjust(15) }, '+15'),
    h('button', { class: 'timer-btn', 'aria-label': t('stopTimer'), onclick: stop }, icon('close')));
  update();
}

function update() {
  const el = root();
  const rem = Math.max(0, endAt - Date.now());
  const tt = el.querySelector('.timer-time');
  if (tt) tt.textContent = fmt(Math.ceil(rem / 1000));
  const f = el.querySelector('.timer-fill');
  if (f) f.style.transform = `scaleX(${Math.min(1, rem / (total * 1000))})`;
}
