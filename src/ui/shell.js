import { icon } from './icons.js';
import { abrirBuscador } from './buscador.js';
import { abrirRegistro } from './registrar.js';
import { abrirIA } from './preguntar.js';
import { signOut } from '../auth.js';
import * as store from '../store.js';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', ic: 'dashboard' },
  { id: 'movimientos', label: 'Registrar', ic: 'movimientos' },
  { id: 'categorias', label: 'Planear', ic: 'categorias' },
  { id: 'metas', label: 'Metas', ic: 'metas' },
  { id: 'analisis', label: 'Análisis', ic: 'analisis' },
  { id: 'historial', label: 'Historial', ic: 'historial' },
  { id: 'ajustes', label: 'Ajustes', ic: 'ajustes' },
];

// iniciales del perfil activo, no un logo inventado
function initials(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '·';
}

/* El menú del botón flotante se cierra al tocar fuera. El shell se repinta en
   cada navegación, así que el listener se registra una sola vez y siempre
   apunta al menú vivo. */
let cerrarFabActual = () => {};
document.addEventListener('click', (e) => {
  if (!e.target.closest('.fab-wrap')) cerrarFabActual();
});

export function renderShell(root, currentRoute, onNavigate) {
  const p = store.active();
  root.innerHTML = `
    <div class="shell">
      <div class="shell-panel">
        <aside class="sidebar">
          <div class="brand" title="${p ? p.name : ''}">${initials(p && p.name)}</div>
          <nav>
            ${NAV.map((n) => `<button class="navlink ${n.id === currentRoute ? 'on' : ''}" data-r="${n.id}" title="${n.label}" aria-label="${n.label}">${icon(n.ic)}</button>`).join('')}
          </nav>
          <button class="navlink logout" id="btnLogout" title="Salir" aria-label="Salir">${icon('salir')}</button>
        </aside>
        <div class="main">
          <div class="topbar">
            <div class="user" id="userLabel"></div>
          </div>
          <div class="content" id="content"></div>
        </div>
      </div>
    </div>
    <div class="fab-wrap">
      <div class="fab-menu" id="fabMenu" hidden>
        <button data-a="ingreso">${icon('movimientos', 'ic-sm')} Agregar ingreso</button>
        <button data-a="egreso">${icon('movimientos', 'ic-sm')} Agregar egreso</button>
        <button data-a="meta">${icon('metas', 'ic-sm')} Agregar meta</button>
        <button data-a="buscar">${icon('buscar', 'ic-sm')} Buscar transacciones</button>
        <button data-a="ia">${icon('ia', 'ic-sm')} Pregúntale a tus números</button>
      </div>
      <button class="fab" id="fab" aria-label="Agregar" aria-expanded="false">+</button>
    </div>
    <div class="toast" id="toast" aria-live="polite" aria-atomic="true"><span id="toastMsg"></span></div>`;

  root.querySelectorAll('.navlink[data-r]').forEach((b) => {
    b.onclick = () => onNavigate(b.dataset.r);
  });
  root.querySelector('#btnLogout').onclick = async () => { await signOut(); location.reload(); };

  root.querySelector('#userLabel').textContent = p ? `Hola, ${p.name}` : '';

  /* F3 — el botón flotante: lo que antes era navegar a una vista ahora es una
     hoja. La única acción que sigue siendo una vista es crear una meta, que
     tiene su propio editor. */
  const fab = root.querySelector('#fab');
  const fabMenu = root.querySelector('#fabMenu');
  const cerrarFab = () => { fabMenu.hidden = true; fab.setAttribute('aria-expanded', 'false'); };
  fab.onclick = () => {
    fabMenu.hidden = !fabMenu.hidden;
    fab.setAttribute('aria-expanded', String(!fabMenu.hidden));
  };
  const repintar = () => onNavigate(currentRoute);
  fabMenu.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    cerrarFab();
    const acciones = {
      ingreso: () => abrirRegistro({ tipo: 'ingreso', alGuardar: repintar }),
      egreso: () => abrirRegistro({ tipo: 'gasto', alGuardar: repintar }),
      meta: () => window.dispatchEvent(new CustomEvent('ir-a-vista', { detail: { route: 'metas', args: { nueva: true } } })),
      buscar: () => abrirBuscador(),
      ia: () => abrirIA(),
    };
    acciones[b.dataset.a]?.();
  };
  cerrarFabActual = cerrarFab;

  return root.querySelector('#content');
}

let toastTimer;
export function toast(msg, onUndo) {
  const el = document.getElementById('toast');
  if (!el) return;
  const msgEl = document.getElementById('toastMsg');
  msgEl.textContent = msg;
  const old = el.querySelector('button');
  if (old) old.remove();
  if (onUndo) {
    const b = document.createElement('button');
    b.textContent = 'Deshacer';
    b.onclick = () => { onUndo(); el.classList.remove('on'); };
    el.appendChild(b);
  }
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 6000);
}
