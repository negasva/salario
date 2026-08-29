/* F1 — cada medio de pago con su marca a la vista. Sin librería de íconos: un
   badge con la inicial y el color de la marca donde se puede pintar HTML, y un
   emoji donde no —dentro de un <option> nativo no entra nada más—. */
import { esc } from '../format.js';

const MARCAS = [
  [/bancolombia/, '#FDDA24', '#1A1A1A', '🟡'],
  [/nequi/, '#2E0854', '#FFFFFF', '🟣'],
  [/daviplata/, '#E1111C', '#FFFFFF', '🔴'],
  [/efectivo/, '#1FA971', '#FFFFFF', '💵'],
  [/tarjeta|cr[eé]dito|d[eé]bito/, '#4A4A4A', '#FFFFFF', '💳'],
  [/banco|davivienda|bbva|falabella|scotia|caja social/, '#0F62FE', '#FFFFFF', '🏦'],
  [/otro/, '#9CA3AF', '#FFFFFF', '🏷️'],
];

const POR_DEFECTO = ['var(--pink)', 'var(--on-pink)', '🏷️'];

export function estiloMedio(nombre) {
  const t = String(nombre || '').toLowerCase();
  const marca = MARCAS.find(([re]) => re.test(t));
  const [fondo, texto, emoji] = marca ? marca.slice(1) : POR_DEFECTO;
  return { fondo, texto, emoji, inicial: (t.trim()[0] || '·').toUpperCase() };
}

// Para listas y tarjetas: el círculo con la inicial en el color de la marca
export function badgeMedio(nombre) {
  const { fondo, texto, inicial } = estiloMedio(nombre);
  return `<span class="medio-ic" style="background:${fondo};color:${texto}" aria-hidden="true">${esc(inicial)}</span>`;
}

// Para un <option>: solo texto, así que el emoji hace de logo
export function etiquetaMedio(nombre) {
  return `${estiloMedio(nombre).emoji} ${nombre}`;
}
