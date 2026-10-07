/* ============================================================
   Service Worker — Dona Rita Amostras
   Necessário para habilitar a instalação como app (PWA).
   ============================================================ */

const CACHE_NAME = 'dona-rita-amostras-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

/* Instala e faz o pré-cache do app shell */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

/* Ativa e limpa caches antigos */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* Estratégia de fetch:
   - Requisições não-GET: passam direto
   - Firebase / Google / CDN: passam direto (não cachear)
   - Navegação (HTML): network-first, cai para cache se offline
   - Outros assets: cache-first, com fallback para rede
*/
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Deixa passar tudo que é externo (Firebase, Google, CDNs)
  const externo =
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('cloudflare') ||
    url.hostname.includes('jsdelivr') ||
    url.hostname.includes('fonts.') ||
    url.origin !== self.location.origin;

  if (externo) return;

  // Navegação / HTML → network-first
  const aceitaHtml = (req.headers.get('accept') || '').includes('text/html');
  if (req.mode === 'navigate' || aceitaHtml) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match('./index.html'))
        )
    );
    return;
  }

  // Demais assets → cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
