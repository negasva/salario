/* F1 — monedas. COP es la principal; USD y EUR se convierten con la tasa del
   día de frankfurter.app, que no pide llave. La tasa se cachea 12 horas en
   localStorage y, si la red falla, se usa la última conocida por vieja que
   sea: una tasa de ayer es infinitamente mejor que un cero. */
export const MONEDAS = ['COP', 'USD', 'EUR'];
export const TTL = 12 * 60 * 60 * 1000;
const KEY = 'reparto:tasas';

export function convertir(monto, tasa) {
  return (Number(monto) || 0) * (Number(tasa) || 0);
}

export function vigente(entrada, ahora = Date.now(), ttl = TTL) {
  return !!entrada && ahora - entrada.t < ttl;
}

function leer() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function escribir(cache) {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* sin cache, se pide cada vez */ }
}

/* Devuelve cuántas unidades de `to` vale una de `from`. null si nunca se pudo
   consultar: quien llama decide si muestra el monto sin convertir o un aviso. */
export async function tasa(from, to, ahora = Date.now()) {
  if (from === to) return 1;
  const cache = leer();
  const clave = `${from}-${to}`;
  if (vigente(cache[clave], ahora)) return cache[clave].v;
  try {
    const r = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    const json = await r.json();
    const v = json?.rates?.[to];
    if (!(v > 0)) throw new Error('sin tasa');
    cache[clave] = { v, t: ahora };
    escribir(cache);
    return v;
  } catch {
    return cache[clave]?.v ?? null;
  }
}
