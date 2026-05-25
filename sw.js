const CACHE = 'speedhennen-v2';

const STATIC_ASSETS = [
    './',
    './index.html',
    './app.js',
    './style.css',
    './src/elo.js',
    './src/api.js',
    './src/state.js',
    './src/ui.js',
    './src/chart.js',
    './src/demo.js',
    './src/streaks.js',
    './icons/icon-192.svg',
    './icons/icon-512.svg',
    'https://fonts.googleapis.com/css2?family=Fredoka+One&family=Quicksand:wght@400;700&display=swap',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Supabase API und externe CDNs → Network-First (frische Daten)
    if (url.hostname.includes('supabase.co') || url.hostname.includes('jsdelivr.net')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // config.js → immer vom Netzwerk (enthält lokale Credentials)
    if (url.pathname.endsWith('config.js')) {
        event.respondWith(fetch(event.request).catch(() => new Response('')));
        return;
    }

    // Alle anderen Requests → Cache-First
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
