import { icon } from './icons.js';
import { signOut } from '../auth.js';
import * as store from '../store.js';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', ic: 'dashboard' },
  { id: 'categorias', label: 'Categorías', ic: 'categorias' },
  { id: 'metas', label: 'Metas', ic: 'metas' },
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
            <label class="search">${icon('buscar', 'ic-sm')}<input id="chipSearch" placeholder="Buscar perfil…" aria-label="Buscar perfil"></label>
            <div class="user" id="userLabel"></div>
          </div>
          <div class="content" id="content"></div>
        </div>
      </div>
    </div>
    <div class="toast" id="toast"><span id="toastMsg"></span></div>`;

  root.querySelectorAll('.navlink[data-r]').forEach((b) => {
    b.onclick = () => onNavigate(b.dataset.r);
  });
  root.querySelector('#btnLogout').onclick = async () => { await signOut(); location.reload(); };

  root.querySelector('#userLabel').textContent = p ? `Hola, ${p.name}` : '';

  root.querySelector('#chipSearch').onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    const q = e.target.value.trim().toLowerCase();
    const match = store.profiles().find((pr) => pr.name.toLowerCase().includes(q));
    if (match) { store.setActive(match.id); onNavigate(currentRoute); }
  };

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
