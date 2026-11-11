// Service worker: keeps the whole app cached so it opens without internet.
// IMPORTANT: bump VERSION whenever any file changes, or phones keep the old copy.
const VERSION = '2.3.0';
const CACHE = 'strength-log-' + VERSION;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './fonts/barlow-condensed-600.woff2',
  './fonts/barlow-condensed-800.woff2',
  './js/app.js',
  './js/actions.js',
  './js/chart.js',
  './js/checkin.js',
  './js/csv.js',
  './js/data.js',
  './js/db.js',
  './js/files.js',
  './js/fitnotes.js',
  './js/i18n.js',
  './js/seed.js',
  './js/sqlite.js',
  './js/stats.js',
  './js/templates.js',
  './js/timer.js',
  './js/ui.js',
  './js/util.js',
  './js/views/addroutine.js',
  './js/views/checkins.js',
  './js/views/calendar.js',
  './js/views/components.js',
  './js/views/forms.js',
  './js/views/history.js',
  './js/views/library.js',
  './js/views/log.js',
  './js/views/more.js',
  './js/views/picker.js',
  './js/views/progress.js',
  './js/views/routines.js',
  './js/views/workout.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try { return await fetch(req); }
    catch { return (req.mode === 'navigate' && (await caches.match('./index.html'))) || Response.error(); }
  })());
});
