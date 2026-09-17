import { icon } from './icons.js';
import { abrirRegistro } from './registrar.js';
import { signOut } from '../auth.js';

const NAV = [
  { id: 'inicio', label: 'Inicio', ic: 'inicio' },
  { id: 'movimientos', label: 'Movimientos', ic: 'movimientos' },
  { id: 'recurrentes', label: 'Recurrentes', ic: 'recurrente' },
  { id: 'categorias', label: 'Categorías', ic: 'categorias' },
  { id: 'ajustes', label: 'Ajustes', ic: 'ajustes' },
];

export function renderShell(root, currentRoute, onNavigate) {
  root.innerHTML = `
    <div class="shell">
      <div class="shell-panel">
        <aside class="sidebar">
          <nav>
            ${NAV.map((n) => `<button class="navlink ${n.id === currentRoute ? 'on' : ''}" data-r="${n.id}" aria-label="${n.label}" title="${n.label}">${icon(n.ic)}<span>${n.label}</span></button>`).join('')}
          </nav>
          <button class="navlink logout" id="btnLogout" title="Salir" aria-label="Salir">${icon('salir')}</button>
        </aside>
        <div class="content" id="content"></div>
      </div>
    </div>
    <button class="fab" id="fab" aria-label="Registrar movimiento">+</button>
    <div class="toast" id="toast" aria-live="polite" aria-atomic="true"><span id="toastMsg"></span></div>`;

  root.querySelectorAll('.navlink[data-r]').forEach((b) => { b.onclick = () => onNavigate(b.dataset.r); });
  root.querySelector('#btnLogout').onclick = async () => { await signOut(); location.reload(); };
  root.querySelector('#fab').onclick = () => abrirRegistro({ alGuardar: () => onNavigate(currentRoute) });
  return root.querySelector('#content');
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
