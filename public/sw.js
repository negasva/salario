/* Service worker mínimo: cascarón offline y nada más.

   Cachea el HTML y lo que el build sirve con hash en el nombre; para todo lo
   demás va a la red primero. Los datos viven en localStorage y en Supabase, así
   que aquí no se cachea ni una respuesta de la API: una app de plata que
   muestra saldos viejos es peor que una que dice que no hay internet. */

const CACHE = 'reparto-v5';
const BASE = ['/', '/index.html', '/manifest.webmanifest', '/icono.svg', '/icono-192.png'];

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

/* Guarda una copia solo de respuestas buenas, y de un asset solo si no es HTML:
   un hash que ya no existe puede devolver la página de entrada con 200, y eso
   cacheado para siempre rompería la app sin red. */
function guardar(e, clave, r, html = false) {
  if (!r.ok || (!html && /html/.test(r.headers.get('content-type') || ''))) return r;
  const copia = r.clone();
  e.waitUntil(caches.open(CACHE).then((c) => c.put(clave, copia)));
  return r;
}

/* Cada build tiene su propio JS y CSS con hash. Al entrar con red, los de
   versiones anteriores (los que el index.html nuevo ya no nombra) se borran;
   las fuentes se quedan, que casi nunca cambian.
   ponytail: sirve mientras el build sea un solo JS y un solo CSS; con chunks perezosos, conservar los de la versión vigente. */
async function podar(html) {
  const c = await caches.open(CACHE);
  const viejos = (await c.keys()).filter((k) => {
    const ruta = new URL(k.url).pathname;
    return /^\/assets\/.*\.(js|css|map)$/.test(ruta) && !html.includes(ruta);
  });
  await Promise.all(viejos.map((k) => c.delete(k)));
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // navegación: red primero (y se guarda copia fresca del cascarón); sin red, el último guardado
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok) e.waitUntil(r.clone().text().then(podar));
      return guardar(e, '/index.html', r, true);
    }).catch(() => caches.match('/index.html')));
    return;
  }

  // lo que lleva hash en el nombre no cambia nunca: de la caché, y si falta, de la red
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => guardar(e, e.request, r))));
    return;
  }

  // iconos y manifest (sin hash): se sirve lo guardado y se actualiza por detrás para la próxima vez
  if (BASE.includes(url.pathname)) {
    e.respondWith(caches.match(e.request).then((hit) => {
      const red = fetch(e.request).then((r) => guardar(e, e.request, r));
      if (hit) { e.waitUntil(red.catch(() => {})); return hit; }
      return red;
    }));
  }
});

// tocar un aviso de vencimiento abre la app en Recurrentes
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((ventanas) => {
    const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
    if (abierta) { abierta.navigate(url); return abierta.focus(); }
    return self.clients.openWindow(url);
  }));
});
