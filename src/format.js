export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// 'AAAA-MM' → 'agosto de 2026'
export function nombreMes(periodo) {
  const [a, m] = String(periodo).split('-').map(Number);
  return MESES[m - 1] ? `${MESES[m - 1]} de ${a}` : String(periodo);
}

// 'AAAA-MM-DD' → '8 ago'
export function fechaCorta(fecha) {
  const [, m, d] = String(fecha).split('-').map(Number);
  return MESES_CORTOS[m - 1] ? `${d} ${MESES_CORTOS[m - 1]}` : String(fecha);
}

// Solo pesos colombianos: sin decimales y con punto de miles.
export function money(v) {
  const n = Math.round(Number(v) || 0);
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
  } catch {
    return `$ ${n}`;
  }
}

// Con signo explícito, para saldos: +$ 900.000 / −$ 100.000
export function moneySigno(v) {
  const n = Math.round(Number(v) || 0);
  return (n < 0 ? '−' : n > 0 ? '+' : '') + money(Math.abs(n));
}

export function plain(v) {
  const n = Math.round(Number(v) || 0);
  try { return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n); } catch { return String(n); }
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* Lee un monto tecleado sin importar cómo separe el usuario. La regla que
   desempata: tres cifras después del separador son miles, una o dos son
   decimales. Un signo menos delante se respeta (saldo inicial en rojo). */
export function digits(v) {
  const texto = String(v ?? '').trim();
  const negativo = /^[-−]/.test(texto);
  const limpio = texto.replace(/[^\d.,]/g, '');
  if (!limpio) return 0;
  const ultimo = Math.max(limpio.lastIndexOf('.'), limpio.lastIndexOf(','));
  const decimales = ultimo >= 0 ? limpio.length - ultimo - 1 : 0;
  let n;
  if (ultimo >= 0 && decimales > 0 && decimales < 3) {
    const entero = limpio.slice(0, ultimo).replace(/[.,]/g, '');
    n = Number(`${entero || 0}.${limpio.slice(ultimo + 1)}`) || 0;
  } else {
    n = Number(limpio.replace(/[.,]/g, '')) || 0;
  }
  return negativo ? -n : n;
}
