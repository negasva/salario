import { EN_MAS } from './shell.js';
import { icon } from './icons.js';

const DETALLE = {
  comparar: 'Cada categoría contra el mes anterior o el promedio',
  categorias: 'Nombres y presupuesto de cada una',
  ajustes: 'Saldo inicial, exportar e importar, avisos y calendario',
};

/* En el teléfono no caben todas las pestañas: lo que no va abajo vive aquí. */
export function renderMas(root) {
  root.innerHTML = `
    <header class="page-head"><div class="ph-txt"><h1 class="mes-titulo">Más</h1></div></header>
    <ul class="list">${EN_MAS.map((n) => `<li class="row row-link">
      <a class="row-main" href="#${n.id}">
        <span class="av" style="--c:var(--brand)" aria-hidden="true">${icon(n.ic, 'ic-sm')}</span>
        <span class="row-txt"><span class="row-t">${n.label}</span><span class="row-s">${DETALLE[n.id] || ''}</span></span>
        <span class="mas-flecha" aria-hidden="true">${icon('der', 'ic-sm')}</span>
      </a></li>`).join('')}</ul>`;
}
