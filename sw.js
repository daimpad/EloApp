const CACHE = 'eloapp-v2';

/**
 * Eigene Dateien. Schlägt hier etwas fehl, ist die Installation zu Recht
 * gescheitert — ohne sie läuft die App nicht.
 */
const CORE_ASSETS = [
    './',
    './index.html',
    './app.js',
    './style.css',
    './manifest.json',
    './src/elo.js',
    './src/api.js',
    './src/state.js',
    './src/match.js',
    './src/replay.js',
    './src/format.js',
    './src/ui.js',
    './src/chart.js',
    './src/demo.js',
    './src/streaks.js',
    './src/branding.js',
    './vendor/chart.umd.js',
    './icons/icon-180.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

/**
 * Fremde Ressourcen. Diese dürfen fehlschlagen — vorher steckte die
 * Google-Fonts-URL in derselben atomaren addAll()-Liste, sodass ein
 * blockierter Font-Zugriff (Schul-WLAN, Content-Blocker) dazu führte, dass
 * gar nichts gecacht wurde.
 */
const OPTIONAL_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Fredoka+One&family=Quicksand:wght@400;700&display=swap',
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await cache.addAll(CORE_ASSETS);
        await Promise.allSettled(OPTIONAL_ASSETS.map(url => cache.add(url)));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Supabase → immer Netzwerk, mit Cache als Notnagel.
    if (url.hostname.endsWith('supabase.co')) {
        event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
        return;
    }

    // config.js enthält lokale Zugangsdaten und wird nie zwischengespeichert.
    if (url.pathname.endsWith('config.js')) {
        event.respondWith(fetch(event.request).catch(() => new Response('')));
        return;
    }

    // Eigene Dateien → Stale-While-Revalidate: sofort aus dem Cache ausliefern
    // und im Hintergrund aktualisieren. Reines Cache-First ließ jeden
    // installierten Client dauerhaft auf einer alten app.js laufen, solange
    // niemand die Cache-Version von Hand hochzählte.
    if (url.origin === self.location.origin) {
        event.respondWith(staleWhileRevalidate(event));
        return;
    }

    // Alles Übrige (Schriften) → Cache-First mit Nachladen.
    event.respondWith(
        caches.match(event.request).then(cached => cached || fetchAndCache(event.request))
    );
});

function staleWhileRevalidate(event) {
    return caches.match(event.request).then(cached => {
        const network = fetchAndCache(event.request).catch(() => cached);
        if (cached) {
            event.waitUntil(network);
            return cached;
        }
        return network;
    });
}

async function fetchAndCache(request) {
    const response = await fetch(request);
    if (response.ok) {
        const clone = response.clone();
        const cache = await caches.open(CACHE);
        await cache.put(request, clone);
    }
    return response;
}
