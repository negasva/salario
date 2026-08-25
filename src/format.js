export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function noDecimals(cur) {
  return cur === 'COP' || cur === 'CLP' || cur === 'ARS';
}

export function money(v, cur) {
  const d = noDecimals(cur) ? 0 : 2;
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: cur, minimumFractionDigits: d, maximumFractionDigits: d }).format(v || 0);
  } catch {
    return `${cur} ${Math.round(v || 0)}`;
  }
}

// Los avisos hablan en grande: $3,2 M se lee de un vistazo, $3.200.000 no.
export function moneyCorto(v, cur) {
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: cur, notation: 'compact', maximumFractionDigits: 1 }).format(v || 0);
  } catch {
    return money(v, cur);
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
