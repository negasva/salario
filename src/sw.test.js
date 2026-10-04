import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/* El service worker corre fuera de la página: aquí se evalúa con una caché y una
   red de mentira para probar qué guarda y qué no. */

function montar(red) {
  const tienda = new Map();
  const caches = {
    open: async () => ({
      put: async (k, v) => { tienda.set(typeof k === 'string' ? `https://app.test${k}` : k.url, v); },
      keys: async () => [...tienda.keys()].map((url) => ({ url })),
      delete: async (k) => tienda.delete(k.url),
    }),
    match: async (k) => tienda.get(typeof k === 'string' ? `https://app.test${k}` : k.url),
  };
  const manejadores = {};
  const self = { location: { origin: 'https://app.test' }, addEventListener: (n, f) => { manejadores[n] = f; }, clients: {} };
  new Function('self', 'caches', 'fetch', readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'))(self, caches, async (req) => red(req));
  const pedir = async (path, mode = 'cors') => {
    const esperas = [];
    let respuesta;
    manejadores.fetch({ request: { method: 'GET', url: `https://app.test${path}`, mode }, respondWith: (p) => { respuesta = p; }, waitUntil: (p) => esperas.push(p) });
    const r = await respuesta;
    await Promise.all(esperas);
    return r;
  };
  return { tienda, pedir };
}

const resp = (tipo, ok = true) => ({ ok, headers: { get: () => tipo }, clone() { return this; } });

describe('service worker', () => {
  it('no guarda como asset una página HTML que llegó con 200', async () => {
    const { tienda, pedir } = montar(() => resp('text/html'));
    await pedir('/assets/viejo-123.js');
    expect(tienda.size).toBe(0);
  });

  it('guarda los assets buenos y la navegación refresca el cascarón', async () => {
    const { tienda, pedir } = montar((req) => resp(req.url.endsWith('.js') ? 'text/javascript' : 'text/html'));
    await pedir('/assets/app-1.js');
    await pedir('/algo', 'navigate');
    expect([...tienda.keys()].sort()).toEqual(['https://app.test/assets/app-1.js', 'https://app.test/index.html']);
  });

  it('pasado el tope, vacía los assets viejos al entrar con red', async () => {
    const { tienda, pedir } = montar(() => resp('text/javascript'));
    for (let i = 0; i < 61; i++) await pedir(`/assets/a-${i}.js`);
    expect(tienda.size).toBe(61);
    await pedir('/', 'navigate');
    expect([...tienda.keys()].filter((k) => k.includes('/assets/'))).toEqual([]);
  });

  it('sin red sirve el último cascarón guardado', async () => {
    let conRed = true;
    const { pedir } = montar(() => { if (!conRed) throw new Error('sin red'); return resp('text/html'); });
    const primero = await pedir('/', 'navigate');
    conRed = false;
    expect(await pedir('/', 'navigate')).toBe(primero);
  });
});
