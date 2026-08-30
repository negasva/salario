import * as store from '../store.js';
import { esc } from '../format.js';
import { GRUPOS, CATEGORIAS, nombreCategoria, iconoCategoria } from '../engine/clasificar.js';
import { abrirModal } from './modal.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

/* F11 — el pop-up para corregir la categoría de un gasto ya registrado.

   La clasificación automática se equivoca, y cuando se equivoca hay que poder
   arreglarla donde se ve el error, no entrando a editar el movimiento entero.
   Por eso la etiqueta del libro es un botón y esto es lo que abre.

   Lo que se elige aquí queda marcado `catManual`: ni la pasada local ni la IA
   vuelven a tocar un gasto que el usuario ya clasificó. */

export function badgeCategoria(cat) {
  const puesta = cat && cat !== 'otros';
  return `<button class="badge badge-cat${puesta ? '' : ' badge-cat-vacio'}" data-cat-btn="1"
    title="Cambiar la categoría" aria-label="Categoría: ${puesta ? esc(nombreCategoria(cat)) : 'sin categoría'}. Tocar para cambiarla">
    ${icon(puesta ? iconoCategoria(cat) : 'etiqueta', 'ic-sm')} ${puesta ? esc(nombreCategoria(cat)) : 'sin categoría'}</button>`;
}

export function abrirCategoria(mov, alGuardar = () => {}) {
  const { cuerpo, cerrar } = abrirModal({ titulo: 'Categoría del gasto' });

  cuerpo.innerHTML = `
    <p class="sub" style="margin-top:0">${esc(mov.nota || 'Este gasto')} — lo que elijas aquí manda sobre lo que propone la app.</p>
    ${GRUPOS.map((g) => `<div class="cat-grupo">
      <span class="label">${esc(g.n)}</span>
      <div class="chips">
        ${CATEGORIAS.filter((c) => c.grupo === g.id).map((c) => `
          <button class="chip cat-op ${mov.cat === c.id ? 'on' : ''}" data-cat="${c.id}">
            ${icon(c.ic, 'ic-sm')} ${esc(c.n)}</button>`).join('')}
      </div>
    </div>`).join('')}
    <div class="cat-grupo">
      <span class="label">Sin grupo</span>
      <div class="chips">
        <button class="chip cat-op ${!mov.cat || mov.cat === 'otros' ? 'on' : ''}" data-cat="otros">
          ${icon('etiqueta', 'ic-sm')} Otros</button>
      </div>
    </div>`;

  cuerpo.querySelectorAll('.cat-op').forEach((b) => {
    b.onclick = () => {
      mov.cat = b.dataset.cat;
      mov.catManual = true;
      store.save();
      cerrar();
      alGuardar(mov);
      toast(`Quedó en ${nombreCategoria(mov.cat)}`);
    };
  });
}
