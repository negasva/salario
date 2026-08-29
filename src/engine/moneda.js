/* F1 — monedas. COP es la principal; USD y EUR se convierten con la tasa del
   día. La tasa se cachea 12 horas en localStorage y, si la red falla, se usa
   la última conocida por vieja que sea: una tasa de ayer es infinitamente
   mejor que un cero.

   F5 — la fuente era frankfurter.app, que publica las tasas de referencia del
   BCE: unas treinta monedas entre las que NO está el peso colombiano. Toda
   conversión a COP devolvía undefined y el formulario decía "no hay tasa".
   Ahora se consultan dos fuentes gratuitas que sí traen COP, en orden, y como
   último recurso queda la tasa que el usuario escriba a mano. */
export const MONEDAS = ['COP', 'USD', 'EUR'];
export const TTL = 12 * 60 * 60 * 1000;
const KEY = 'reparto:tasas';

const FUENTES = [
  {
    url: (from) => `https://open.er-api.com/v6/latest/${from}`,
    leer: (json, from, to) => json?.rates?.[to],
  },
  {
    url: (from) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from.toLowerCase()}.json`,
    leer: (json, from, to) => json?.[from.toLowerCase()]?.[to.toLowerCase()],
  },
];

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

/* Lo que hay guardado de ese par: { v, t } o null. La vista lo usa para decir
   "tasa del <fecha>" en vez de aparentar que el dato es de hoy. */
export function entradaTasa(from, to) {
  return leer()[`${from}-${to}`] || null;
}

// Último recurso: la tasa la escribe el usuario y se guarda como cualquier otra
export function guardarTasaManual(from, to, valor, ahora = Date.now()) {
  const v = Number(valor);
  if (!(v > 0)) return null;
  const cache = leer();
  cache[`${from}-${to}`] = { v, t: ahora, manual: true };
  escribir(cache);
  return v;
}

/* Devuelve cuántas unidades de `to` vale una de `from`. null si nunca se pudo
   consultar: quien llama decide si muestra el monto sin convertir o un aviso. */
export async function tasa(from, to, ahora = Date.now()) {
  if (from === to) return 1;
  const cache = leer();
  const clave = `${from}-${to}`;
  if (vigente(cache[clave], ahora)) return cache[clave].v;

  for (const fuente of FUENTES) {
    try {
      const r = await fetch(fuente.url(from, to));
      const json = await r.json();
      const v = Number(fuente.leer(json, from, to));
      if (!(v > 0)) throw new Error(`la fuente no trae ${to}`);
      cache[clave] = { v, t: ahora };
      escribir(cache);
      return v;
    } catch (e) {
      // el mensaje real, para poder diagnosticar sin adivinar
      console.error(`tasa ${clave}: ${fuente.url(from, to)} falló`, e);
    }
  }
  return cache[clave]?.v ?? null;
}
