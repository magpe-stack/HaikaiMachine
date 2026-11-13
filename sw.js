/* Haikai Machine — Service Worker
 * Estratégia:
 *  - Pré-cache do "app shell" na instalação (funciona offline depois da 1ª visita).
 *  - Navegação: rede primeiro, com fallback para o index.html em cache.
 *  - Demais arquivos do mesmo domínio: stale-while-revalidate.
 *  - Requisições de outros domínios (ex.: endereço reverso) NÃO são interceptadas.
 */
const VERSAO = 'haikai-machine-v1';
const ARQUIVOS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './teoria-haikai.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    // add individual: se um arquivo faltar (ex.: ícone), os demais continuam em cache.
    await Promise.all(ARQUIVOS.map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (e) { console.warn('[SW] não foi possível pré-cachear', url, e); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const chaves = await caches.keys();
    await Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const resp = await fetch(req);
        const cache = await caches.open(VERSAO);
        cache.put('./index.html', resp.clone()).catch(() => {});
        return resp;
      } catch (e) {
        const cache = await caches.open(VERSAO);
        return (await cache.match('./index.html')) || (await cache.match('./')) ||
          new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const emCache = await cache.match(req);
    const rede = fetch(req).then((resp) => {
      if (resp && resp.ok) cache.put(req, resp.clone()).catch(() => {});
      return resp;
    }).catch(() => null);
    if (emCache) { rede.catch(() => {}); return emCache; }
    const resp = await rede;
    return resp || new Response('', { status: 504 });
  })());
});
