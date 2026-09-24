import { icon, logo } from './icons.js';
import { abrirRegistro } from './registrar.js';
import { signOut } from '../auth.js';

/* En el teléfono caben cinco pestañas: las cuatro de todos los días y Más,
   que abre el resto. En escritorio la barra lateral las muestra todas. */
const NAV = [
  { id: 'inicio', label: 'Inicio', ic: 'inicio', tel: true },
  { id: 'movimientos', label: 'Movimientos', ic: 'movimientos', tel: true },
  { id: 'recurrentes', label: 'Recurrentes', ic: 'recurrente', tel: true },
  { id: 'ahorro', label: 'Ahorro', ic: 'ahorro', tel: true },
  { id: 'comparar', label: 'Comparar', ic: 'comparar' },
  { id: 'categorias', label: 'Categorías', ic: 'categorias' },
  { id: 'ajustes', label: 'Ajustes', ic: 'ajustes' },
  { id: 'mas', label: 'Más', ic: 'mas-menu', soloTel: true },
];

// Las pantallas que en el teléfono viven dentro de Más.
export const EN_MAS = NAV.filter((n) => !n.tel && !n.soloTel);

/* Un solo menú: barra lateral en escritorio y barra de pestañas abajo en el
   teléfono, donde alcanza el pulgar. Cada pestaña es un enlace con su #, así
   que atrás y adelante del navegador funcionan. */
export function renderShell(root, currentRoute, onNavigate) {
  root.innerHTML = `
    <a class="skip" href="#main">Saltar al contenido</a>
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">${logo()}<span class="brand-txt">Reparto<small>mensual</small></span></div>
        <button class="btn-primary sidebar-cta" id="sideRegistrar">${icon('mas')}Registrar</button>
        <nav class="nav" aria-label="Secciones">
          ${NAV.map((n) => {
    // Más se enciende cuando la pantalla es una de las que viven dentro de él
    const actual = n.id === currentRoute || (n.soloTel && EN_MAS.some((m) => m.id === currentRoute));
    return `<a class="navlink ${n.tel ? '' : n.soloTel ? 'solo-tel' : 'solo-esc'}" href="#${n.id}" data-r="${n.id}" ${actual ? 'aria-current="page"' : ''}>
            <span class="navlink-ic">${icon(n.ic)}</span><span class="navlink-txt">${n.label}</span></a>`;
  }).join('')}
        </nav>
        <button class="navlink logout" id="btnLogout">${icon('salir')}<span>Cerrar sesión</span></button>
      </aside>
      <main class="content" id="main" tabindex="-1"><div class="content-in" id="content"></div></main>
    </div>
    <button class="fab" id="fab" aria-label="Registrar movimiento">${icon('mas')}</button>
    <div class="toast" id="toast" aria-live="polite" aria-atomic="true"><span id="toastMsg"></span></div>`;

  const registrar = () => abrirRegistro({ alGuardar: () => onNavigate(currentRoute) });
  root.querySelector('.skip').onclick = (e) => { e.preventDefault(); root.querySelector('#main').focus(); };
  root.querySelector('#btnLogout').onclick = salir;
  root.querySelector('#fab').onclick = registrar;
  root.querySelector('#sideRegistrar').onclick = registrar;
  return root.querySelector('#content');
}

// sale y vuelve a la entrada sin #: al entrar de nuevo se empieza por Inicio
export async function salir() {
  await signOut();
  history.replaceState(null, '', location.pathname);
  location.reload();
}

let toastTimer;
export function toast(msg, onUndo) {
  const el = document.getElementById('toast');
  if (!el) return;
  document.getElementById('toastMsg').textContent = msg;
  el.querySelector('button')?.remove();
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
