const CACHE_NAME = 'schoolbook-v1';

// Всё что кэшируем при установке
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Geologica:wght@300;400;500;600;700&family=Unbounded:wght@400;700&display=swap',
];

// ===== INSTALL — кэшируем основные файлы =====
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Кэшируем по одному — чтобы ошибка одного не ломала всё
      return Promise.allSettled(
        PRECACHE.map(url => cache.add(url).catch(e => console.warn('[SW] Failed to cache:', url, e)))
      );
    }).then(() => {
      console.log('[SW] Install complete');
      return self.skipWaiting();
    })
  );
});

// ===== ACTIVATE — удаляем старые кэши =====
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      console.log('[SW] Activated');
      return self.clients.claim();
    })
  );
});

// ===== FETCH — отдаём из кэша, обновляем в фоне =====
self.addEventListener('fetch', event => {
  // Только GET запросы
  if (event.request.method !== 'GET') return;

  // Пропускаем chrome-extension и прочее нерелевантное
  const url = new URL(event.request.url);
  if (!['http:', 'https:'].includes(url.protocol)) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      // Запрос в сеть (в фоне)
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => null);

      // Если есть в кэше — сразу отдаём, сеть обновит в фоне
      // Если нет — ждём сеть
      return cached || networkFetch.then(r => r || new Response('Офлайн — обновите страницу с интернетом', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      }));
    })
  );
});

// ===== MESSAGE — ручное обновление кэша =====
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
