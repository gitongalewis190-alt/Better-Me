const CACHE = 'bettermeV1.0.1-shell';
const SHELL = [
  './', 'index.html', 'lab.html', 'app.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'src/config.js', 'src/supabase.js', 'src/auth.js', 'src/store.js',
  'src/analytics.js', 'src/prompts.js', 'src/sound.js', 'src/calendar.js', 'src/algorithms.js'
];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
