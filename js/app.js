// App entry: routing, bottom navigation, screen wake lock, service worker.
import * as data from './data.js';
import { t, setLang } from './i18n.js';
import { h, icon, toast, applyTheme, applyAccent, closeAllSheets } from './ui.js';
import { toISODate } from './util.js';
import * as timer from './timer.js';
import * as workout from './views/workout.js';
import * as picker from './views/picker.js';
import * as log from './views/log.js';
import * as historyView from './views/history.js';
import * as calendar from './views/calendar.js';
import * as routines from './views/routines.js';
import * as progress from './views/progress.js';
import * as more from './views/more.js';
import * as checkins from './views/checkins.js';
import * as library from './views/library.js';
import * as addRoutine from './views/addroutine.js';

// [pattern, render, bottom-nav tab (null = hide nav for focus)]
const ROUTES = [
  [/^\/$/, workout.render, 'workout'],
  [/^\/pick(?:\/([^/]+))?$/, picker.render, null],
  [/^\/ex\/([^/]+)(?:\/(history|graph))?$/, log.render, null],
  [/^\/calendar$/, calendar.render, 'calendar'],
  [/^\/history$/, historyView.render, 'calendar'],
  [/^\/routines$/, routines.renderList, 'routines'],
  [/^\/routine\/([^/]+)$/, routines.renderEdit, null],
  [/^\/progress$/, progress.render, 'progress'],
  [/^\/bodyweight$/, progress.renderBodyweight, null],
  [/^\/more$/, more.render, 'more'],
  [/^\/checkins$/, checkins.render, null],
  [/^\/library(?:\/([^/]+))?$/, library.render, null],
  [/^\/import-report$/, more.renderReport, null],
  [/^\/add\/([A-Za-z0-9_-]+)$/, addRoutine.render, null],
];
const TABS = [['workout', '/', 'dumbbell'], ['calendar', '/calendar', 'calendar'], ['routines', '/routines', 'clipboard'], ['progress', '/progress', 'chart'], ['more', '/more', 'menu']];

const view = document.getElementById('view');
const nav = document.getElementById('nav');
const state = { date: toISODate(), followToday: true, pickFor: null };
const stack = [];          // mirror of in-app history, so "back" never leaves the app by surprise
let seq = 0;

const currentPath = () => decodeURI(location.hash.slice(1)) || '/';

const ctx = {
  state,
  go(path, { replace = false } = {}) {
    if (path === currentPath()) return render(true);
    if (replace) { stack[stack.length - 1] = path; location.replace('#' + path); }
    else { stack.push(path); location.hash = path; }
  },
  back(fallback = '/') {
    if (stack.length > 1) history.back();
    else ctx.go(fallback, { replace: true });
  },
  refresh: () => render(true),
  relabel() { document.title = 'Strength Log'; renderNav(); render(true); },
  setDate(d) {
    state.date = d;
    state.followToday = d === toISODate();
    if (currentPath() === '/') render(false);
    else if (stack[stack.length - 2] === '/') history.back();
    else ctx.go('/');
  },
};

function onHashChange() {
  closeAllSheets();
  const p = currentPath();
  if (stack[stack.length - 1] !== p) {
    if (stack[stack.length - 2] === p) stack.pop();
    else stack.push(p);
  }
  render(false);
}

async function render(keepScroll) {
  const path = currentPath();
  const my = ++seq;
  const route = ROUTES.find(([re]) => re.test(path));
  if (!route) return ctx.go('/', { replace: true });
  const [re, fn, tab] = route;
  let el;
  try {
    el = await fn(path.match(re).slice(1).map(x => (x == null ? undefined : x)), ctx);
  } catch (e) {
    console.error(e);
    el = h('div', { class: 'content' }, h('p', {}, t('error')), h('pre', { class: 'small muted mono' }, String(e?.stack || e)),
      h('button', { class: 'btn full', onclick: () => ctx.go('/', { replace: true }) }, t('goToday')));
  }
  if (my !== seq) return; // a newer render started meanwhile
  const y = window.scrollY;
  view.replaceChildren(el);
  window.scrollTo(0, keepScroll ? y : 0);
  document.body.classList.toggle('no-nav', !tab);
  nav.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.k === tab));
  wake.update();
}

function renderNav() {
  nav.replaceChildren(...TABS.map(([k, p, ic]) => h('button', { class: 'nav-btn', 'data-k': k, onclick: () => navTo(p) }, icon(ic), h('span', {}, t('nav_' + k)))));
}
function navTo(p) {
  const cur = currentPath();
  if (p === cur) return;
  if (p === '/' && stack[stack.length - 2] === '/') return history.back();
  if (cur === '/') ctx.go(p);
  else ctx.go(p, { replace: true });
}

// Keep the screen on while logging or while the rest timer runs.
const wake = {
  lock: null, busy: false,
  async update() {
    if (this.busy || !('wakeLock' in navigator)) return;
    const want = data.settings.wake && document.visibilityState === 'visible' && (currentPath() === '/' || currentPath().startsWith('/ex/') || timer.running());
    this.busy = true;
    try {
      if (want && !this.lock) {
        this.lock = await navigator.wakeLock.request('screen');
        this.lock.addEventListener('release', () => { this.lock = null; });
      } else if (!want && this.lock) {
        await this.lock.release();
        this.lock = null;
      }
    } catch { this.lock = null; } finally { this.busy = false; }
  },
};

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  // During local development the cache would hide changes; opt in with ?sw
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (isLocal && !new URLSearchParams(location.search).has('sw')) {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
    return;
  }
  let reloading = false;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    const offer = w => toast(t('updateReady'), { ms: 0, action: { label: t('reload'), fn: () => { reloading = true; w.postMessage('skipWaiting'); } } });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
  }).catch(e => console.warn('SW registration failed', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) location.reload(); });
}

async function boot() {
  try {
    await data.init();
  } catch (e) {
    view.replaceChildren(h('div', { class: 'content' }, h('h2', {}, 'Storage unavailable'), h('p', {}, 'This browser blocked local storage (private mode?). Data cannot be saved.'), h('pre', { class: 'small mono' }, String(e))));
    return;
  }
  setLang(data.settings.lang);
  applyTheme(data.settings.theme);
  applyAccent(data.settings.accent);
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => applyTheme(data.settings.theme));
  renderNav();
  timer.init();
  stack.push(currentPath());
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('timerchange', () => wake.update());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (state.followToday && state.date !== toISODate()) { state.date = toISODate(); if (currentPath() === '/') render(true); }
    wake.update();
  });
  await render(false);
  registerSW();
  navigator.storage?.persist?.().catch(() => {});
}

boot();
