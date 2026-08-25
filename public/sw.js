/* Service worker mínimo: cascarón offline y nada más.

   Cachea el HTML y lo que el build sirve con hash en el nombre; para todo lo
   demás va a la red primero. Los datos viven en localStorage y en Supabase, así
   que aquí no se cachea ni una respuesta de la API: una app de plata que
   muestra saldos viejos es peor que una que dice que no hay internet. */

const CACHE = 'reparto-v1';
const BASE = ['/', '/index.html', '/manifest.webmanifest', '/icono.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // navegación: red primero, y si no hay, el cascarón guardado
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')));
    return;
  }

  // estáticos del build (llevan hash): sirve de caché y actualiza por detrás
  if (url.pathname.startsWith('/assets/') || BASE.includes(url.pathname)) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      const copia = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copia));
      return r;
    })));
  }
});
