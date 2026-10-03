import { icon } from './icons.js';
import { esc } from '../format.js';
import { COLORES_AVATAR, iniciales, textoSobre } from '../engine/persona.js';

/* Piezas de interfaz que se repiten en varias pantallas. */

// El título de una tarjeta con su ícono: se lee más rápido que una palabra sola.
export function titulo(ic, texto, nivel = 2) {
  return `<h${nivel} class="card-title"><span class="ct-ic" aria-hidden="true">${icon(ic, 'ic-sm')}</span>${texto}</h${nivel}>`;
}

// El círculo con las iniciales. `tam` es 'sm' | 'md' | 'xl'.
export function avatar(persona, correo, tam = 'md') {
  const fondo = COLORES_AVATAR[persona.color] || COLORES_AVATAR[0];
  return `<span class="avatar avatar-${tam}" style="--av:${fondo};--av-t:${textoSobre(fondo)}" aria-hidden="true">${esc(iniciales(persona.nombre, correo))}</span>`;
}
