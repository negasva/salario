export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/* F7 — en una tabla de pagos la fecha es una referencia, no el dato: "8 ago"
   cabe en su columna y se lee igual de rápido que "8 de agosto", que la
   desbordaba. Sin punto, que en español la abreviatura de mes no lo lleva
   cuando es de tres letras y se ve más limpio en una columna. */
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fechaCorta(fecha) {
  const [, m, d] = String(fecha).split('-').map(Number);
  return MESES_CORTOS[m - 1] ? `${d} ${MESES_CORTOS[m - 1]}` : String(fecha);
}

export function noDecimals(cur) {
  return cur === 'COP' || cur === 'CLP' || cur === 'ARS';
}

/* En pesos las unidades sobran: $ 1.479.418 se lee peor que $ 1.479.400 y no
   dice nada más. Se redondea a la centena más cercana solo de mil para arriba,
   para no convertir un gasto de $ 30 en $ 0. `exacto` deja el número tal cual,
   para lo que sí necesita cada peso: una tasa de cambio. */
export function redondeoVista(v, cur) {
  const n = Number(v) || 0;
  return noDecimals(cur) && Math.abs(n) >= 1000 ? Math.round(n / 100) * 100 : n;
}

export function money(v, cur, exacto = false) {
  const d = noDecimals(cur) ? 0 : 2;
  const n = exacto ? (Number(v) || 0) : redondeoVista(v, cur);
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: cur, minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  } catch {
    return `${cur} ${Math.round(n)}`;
  }
}

export function plain(v, cur) {
  const n = noDecimals(cur) ? Math.round(v || 0) : Math.round((v || 0) * 100) / 100;
  try {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: noDecimals(cur) ? 0 : 2 }).format(n);
  } catch {
    return String(n);
  }
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* Lee un monto tecleado sin importar cómo separe el usuario. La regla que
   desempata: tres cifras después del separador son miles, una o dos son
   decimales. Es lo que hace la gente en es-CO y en en-US por igual. */
export function digits(v) {
  const limpio = String(v).replace(/[^\d.,]/g, '');
  if (!limpio) return 0;
  const ultimo = Math.max(limpio.lastIndexOf('.'), limpio.lastIndexOf(','));
  const decimales = ultimo >= 0 ? limpio.length - ultimo - 1 : 0;
  if (ultimo >= 0 && decimales > 0 && decimales < 3) {
    const entero = limpio.slice(0, ultimo).replace(/[.,]/g, '');
    return Number(`${entero || 0}.${limpio.slice(ultimo + 1)}`) || 0;
  }
  return Number(limpio.replace(/[.,]/g, '')) || 0;
}
