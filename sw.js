const CACHE = 'bettermeV1.4.0-shell';
const SHELL = [
  './', 'index.html', 'lab.html', 'app.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'icon.svg',
  'src/config.js', 'src/supabase.js', 'src/auth.js', 'src/store.js',
  'src/analytics.js', 'src/prompts.js', 'src/sound.js', 'src/algorithms.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first: updates reach the phone on the next load. The cache is the offline fallback.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Opens the app when a reminder notification is tapped.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    const win = list.find(c => c.url.includes('app.html'));
    return win ? win.focus() : self.clients.openWindow('./app.html');
  }));
});
