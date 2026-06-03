const CACHE_NAME = 'fudoshin-v1';
const BESTANDEN = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

// Installatie — bestanden opslaan in cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(BESTANDEN))
  );
});

// Activatie — oude cache verwijderen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    )
  );
});

// Ophalen — eerst cache, dan internet
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});

// Synchronisatie — offline scans versturen als internet terug is
self.addEventListener('sync', event => {
  if (event.tag === 'sync-aanwezigheden') {
    event.waitUntil(syncAanwezigheden());
  }
});

async function syncAanwezigheden() {
  const db = await openDB();
  const scans = await getAllScans(db);
  
  for (const scan of scans) {
    try {
      await verstuurScan(scan);
      await verwijderScan(db, scan.id);
    } catch(err) {
      console.log('Sync mislukt, later opnieuw proberen');
    }
  }
}