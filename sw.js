const CACHE = 'betterme-2.0.0';
const SHELL = [
  './', 'index.html', 'lab.html', 'app.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png',
  'vendor/supabase.js', 'src/config.js', 'src/supabase.js', 'src/auth.js', 'src/store.js', 'src/analytics.js', 'src/algorithms.js',
  'src/prompts.js', 'src/sound.js', 'src/theme.js', 'src/charts.js', 'src/nlp.js', 'src/report.js'
];
const LAZY = ['vendor/jspdf.umd.min.js', 'vendor/html2canvas.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).then(() => c.addAll(LAZY).catch(() => {}))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network first for the app itself (updates arrive on the next load), cache as offline fallback.
// Google Fonts are cached on first use.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const font = url.host.endsWith('fonts.googleapis.com') || url.host.endsWith('fonts.gstatic.com');
  if (url.origin !== self.location.origin && !font) return;
  if (font) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return res; })));
    return;
  }
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || (e.request.mode === 'navigate' ? caches.match('app.html') : undefined)))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const win = list.find(c => c.url.includes('app.html'));
    return win ? win.focus() : self.clients.openWindow('./app.html');
  }));
});
