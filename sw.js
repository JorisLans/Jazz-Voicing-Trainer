// ============================================================================
// SW.JS — Service Worker voor Jazz Inversie Studio (4-Bestanden Architectuur)
// ============================================================================

const CACHE_NAME = 'jazz-studio-v9';

const URLS_TO_CACHE = [
  './',
  './index.html',
  './chords.js',
  './leaderboard.js',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 1. INSTALLATIE: Sla de kernbestanden op in de offline cache
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activeer nieuwe Service Worker direct
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // We voegen bestanden één voor één toe zodat een ontbrekend icoontje de rest niet blokkeert
      for (const url of URLS_TO_CACHE) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[SW] Kon bestand niet vooraf cachen:', url, err);
        }
      }
    })
  );
});

// 2. ACTIVATIE: Ruim alle oude caches (v1 t/m v6) automatisch op
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Oude cache verwijderd:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH: Firebase altijd live, app-bestanden Network-First met Cache-Fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Alleen GET-requests afhandelen (POST-requests naar Firebase gaan direct door)
  if (req.method !== 'GET') {
    return;
  }

  // A. Firebase Realtime Database ALTIJD live via het netwerk (nooit cachen!)
  if (url.hostname.includes('firebasedatabase.app') || url.hostname.includes('googleapis.com/identitytoolkit')) {
    event.respondWith(fetch(req));
    return;
  }

  // B. Voor eigen app-bestanden (HTML & JS): Network-First, val terug op Cache als je offline bent
  // Zo zie je bij een wifi/4G-verbinding altijd meteen je nieuwste GitHub-aanpassingen,
  // maar werkt de app aan de piano zonder internet nog steeds 100% offline.
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        // Sla een succesvolle versie meteen bijgewerkt op in de cache (ook voor Tailwind CDN & Fonts)
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline? Haal het bestand uit de lokale cache
        return caches.match(req).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // Als iemand offline de hoofdmap opent, geef index.html terug
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
