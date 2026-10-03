import { icon } from './icons.js';
import { esc, money } from '../format.js';
import { franjaReparto } from '../engine/graficas.js';
import { COLORES_AVATAR, iniciales, textoSobre } from '../engine/persona.js';

/* Piezas de interfaz que se repiten en varias pantallas. */

// El título de una tarjeta con su ícono: se lee más rápido que una palabra sola.
export function titulo(ic, texto, nivel = 2) {
  return `<h${nivel} class="card-title">${texto}</h${nivel}>`;
}

// El círculo con las iniciales. `tam` es 'sm' | 'md' | 'xl'.
export function avatar(persona, correo, tam = 'md') {
  const fondo = COLORES_AVATAR[persona.color] || COLORES_AVATAR[0];
  return `<span class="avatar avatar-${tam}" style="--av:${fondo};--av-t:${textoSobre(fondo)}" aria-hidden="true">${esc(iniciales(persona.nombre, correo))}</span>`;
}

/* La franja de reparto: `entro` partido en las categorías de `segs` y lo que
   queda libre. Cada tramo da su monto al tocarlo. Debajo, las `n` más grandes.
   Sin nada que repartir devuelve la franja vacía con su invitación. */
export function franja(segs, entro, { n = 3, vacio = 'Aquí se reparte el mes cuando registres un ingreso y un gasto.' } = {}) {
  const f = franjaReparto(segs, entro);
  if (!f) {
    return `<div class="reparto reparto-vacio" aria-hidden="true"><i class="libre" style="--w:100;--k:0"></i></div>
  <p class="reparto-pie">${esc(vacio)}</p>`;
  }
  const libre = f.libre ? { nombre: 'Libre', monto: f.libre.monto, pct: f.libre.pct, libre: true } : null;
  const tramos = [...f.partes, ...(libre ? [libre] : [])];
  const resumen = tramos.map((t) => `${t.nombre} ${money(t.monto)}`).join(', ');
  const leyenda = f.partes.slice(0, n).concat(libre ? [libre] : []);
  return `<div class="reparto" role="img" aria-label="Cómo se reparte: ${esc(resumen)}">
    ${tramos.map((t, k) => `<i class="${t.libre ? 'libre' : ''}" data-tip="${esc(t.nombre)}\n${money(t.monto)} · ${String(t.pct).replace('.', ',')} %" style="--w:${t.pct};--k:${k}${t.libre ? '' : `;--c:${t.color}`}"></i>`).join('')}
  </div>
  <ul class="reparto-ley">${leyenda.map((t) => `<li class="${t.libre ? 'libre' : ''}"><i style="${t.libre ? '' : `background:${t.color}`}"></i><span>${esc(t.nombre)}</span><b class="num">${money(t.monto)}</b></li>`).join('')}</ul>
  ${f.exceso ? `<p class="reparto-aviso">Gastaste ${money(f.exceso)} más de lo que entró.</p>` : ''}`;
}
