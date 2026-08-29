/* F1 — cada medio de pago con su marca a la vista. Sin librería de íconos: el
   color de la marca de fondo y un ícono del sprite encima donde se puede pintar
   HTML, y un emoji dentro de un <option> nativo, que no admite nada más. */
import { icon } from './icons.js';

const MARCAS = [
  [/bancolombia/, '#FDDA24', '#1A1A1A', '🟡', 'banco'],
  [/nequi/, '#2E0854', '#FFFFFF', '🟣', 'celular'],
  [/daviplata/, '#E1111C', '#FFFFFF', '🔴', 'celular'],
  [/efectivo/, '#1FA971', '#FFFFFF', '💵', 'billete'],
  [/tarjeta|cr[eé]dito|d[eé]bito/, '#4A4A4A', '#FFFFFF', '💳', 'deuda'],
  [/banco|davivienda|bbva|falabella|scotia|caja social|bogot[aá]|occidente/, '#0F62FE', '#FFFFFF', '🏦', 'banco'],
  [/ahorro|alcanc[ií]a/, '#F5A623', '#1A1A1A', '🐷', 'ahorro'],
  [/otro/, '#9CA3AF', '#FFFFFF', '🏷️', 'etiqueta'],
];

const POR_DEFECTO = ['var(--pink)', 'var(--on-pink)', '🏷️', 'etiqueta'];

export function estiloMedio(nombre) {
  const t = String(nombre || '').toLowerCase();
  const marca = MARCAS.find(([re]) => re.test(t));
  const [fondo, texto, emoji, ic] = marca ? marca.slice(1) : POR_DEFECTO;
  return { fondo, texto, emoji, ic, inicial: (t.trim()[0] || '·').toUpperCase() };
}

// Para listas y tarjetas: el ícono de la entidad sobre el color de la marca
export function badgeMedio(nombre) {
  const { fondo, texto, ic } = estiloMedio(nombre);
  return `<span class="medio-ic" style="background:${fondo};color:${texto}">${icon(ic, 'ic-sm')}</span>`;
}

// Para un <option>: solo texto, así que el emoji hace de logo
export function etiquetaMedio(nombre) {
  return `${estiloMedio(nombre).emoji} ${nombre}`;
}
