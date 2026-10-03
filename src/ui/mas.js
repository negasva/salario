import { EN_MAS } from './shell.js';
import { icon } from './icons.js';
import { avatar } from './piezas.js';
import * as store from '../store.js';
import { nombreVisible } from '../engine/persona.js';
import { esc } from '../format.js';

const DETALLE = {
  recurrentes: 'Lo que se paga cada mes',
  reportes: 'Mes y año, calendario, imprimir',
  comparar: 'Cada categoría contra antes',
  categorias: 'Nombres y presupuestos',
  ajustes: 'Saldo, datos, avisos',
};

/* En el teléfono no caben todas las pestañas: lo que no va abajo vive aquí.
   Arriba, quién eres; el resto, una fila por pantalla. */
export function renderMas(root) {
  const p = store.active();
  const correo = store.correo();
  const fila = (n) => `<li class="row row-link">
      <a class="row-main" href="#${n.id}">
        <span class="av" style="--c:var(--brand)" aria-hidden="true">${icon(n.ic, 'ic-sm')}</span>
        <span class="row-txt"><span class="row-t">${n.label}</span><span class="row-s">${DETALLE[n.id] || ''}</span></span>
        <span class="mas-flecha" aria-hidden="true">${icon('der', 'ic-sm')}</span>
      </a></li>`;
  root.innerHTML = `
    <header class="page-head"><div class="ph-txt"><h1 class="mes-titulo">Más</h1></div></header>
    <a class="card mas-perfil" href="#perfil">
      ${avatar(p.persona, correo, 'lg')}
      <span class="mas-perfil-txt"><b>${esc(nombreVisible(p.persona.nombre, correo) || 'Tu perfil')}</b><small>${esc(correo || 'Nombre, contraseña y sesión')}</small></span>
      <span class="mas-flecha" aria-hidden="true">${icon('der', 'ic-sm')}</span>
    </a>
    <ul class="list">${EN_MAS.filter((n) => n.id !== 'perfil').map(fila).join('')}</ul>`;
}
