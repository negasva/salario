import { icon, logo } from './icons.js';
import { abrirRegistro } from './registrar.js';
import { signOut } from '../auth.js';

const NAV = [
  { id: 'inicio', label: 'Inicio', ic: 'inicio' },
  { id: 'movimientos', label: 'Movimientos', ic: 'movimientos' },
  { id: 'recurrentes', label: 'Recurrentes', ic: 'recurrente' },
  { id: 'categorias', label: 'Categorías', ic: 'categorias' },
  { id: 'ajustes', label: 'Ajustes', ic: 'ajustes' },
];

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
          ${NAV.map((n) => `<a class="navlink" href="#${n.id}" data-r="${n.id}" ${n.id === currentRoute ? 'aria-current="page"' : ''}>
            <span class="navlink-ic">${icon(n.ic)}</span><span class="navlink-txt">${n.label}</span></a>`).join('')}
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
