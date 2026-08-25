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

export function digits(v) {
  const c = String(v).replace(/[^\d]/g, '');
  return c ? Number(c) : 0;
}
