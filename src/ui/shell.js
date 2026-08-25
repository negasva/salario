import { icon } from './icons.js';
import { abrirBuscador } from './buscador.js';
import { signOut } from '../auth.js';
import * as store from '../store.js';
import { PALETAS, normalizarPaleta } from '../theme.js';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', ic: 'dashboard' },
  { id: 'categorias', label: 'Categorías', ic: 'categorias' },
  { id: 'metas', label: 'Metas', ic: 'metas' },
  { id: 'movimientos', label: 'Movimientos', ic: 'movimientos' },
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
          <button class="navlink" id="btnBuscar" title="Buscar" aria-label="Buscar">${icon('buscar')}</button>
          <div class="palette-control">
            <button class="navlink palette-trigger" id="btnPalette" title="Cambiar paleta" aria-label="Cambiar paleta" aria-expanded="false">${icon('paleta')}</button>
            <div class="palette-menu" id="paletteMenu" role="menu" aria-label="Paletas de colores" hidden>
              <span class="palette-title">Paleta de colores</span>
              ${Object.entries(PALETAS).map(([id, paleta]) => `
                <button class="palette-option" data-palette="${id}" role="menuitemradio" aria-checked="${normalizarPaleta(p?.paleta) === id}">
                  <span class="palette-swatches" aria-hidden="true">${paleta.swatches.map((color) => `<i style="background:${color}"></i>`).join('')}</span>
                  <span>${paleta.label}</span>
                  <span class="palette-check" aria-hidden="true">✓</span>
                </button>`).join('')}
            </div>
          </div>
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
    <div class="toast" id="toast" aria-live="polite" aria-atomic="true"><span id="toastMsg"></span></div>`;

  root.querySelector('#btnBuscar').onclick = () => abrirBuscador();
  root.querySelectorAll('.navlink[data-r]').forEach((b) => {
    b.onclick = () => onNavigate(b.dataset.r);
  });
  root.querySelector('#btnLogout').onclick = async () => { await signOut(); location.reload(); };

  const paletteButton = root.querySelector('#btnPalette');
  const paletteMenu = root.querySelector('#paletteMenu');
  const paintPaletteOptions = () => {
    const selected = normalizarPaleta(store.active()?.paleta);
    paletteMenu.querySelectorAll('.palette-option').forEach((option) => {
      option.setAttribute('aria-checked', String(option.dataset.palette === selected));
    });
  };
  paletteButton.onclick = () => {
    paletteMenu.hidden = !paletteMenu.hidden;
    paletteButton.setAttribute('aria-expanded', String(!paletteMenu.hidden));
  };
  paletteMenu.querySelectorAll('.palette-option').forEach((option) => {
    option.onclick = () => {
      store.setPalette(option.dataset.palette);
      paintPaletteOptions();
      paletteMenu.hidden = true;
      paletteButton.setAttribute('aria-expanded', 'false');
    };
  });
  paletteMenu.onkeydown = (e) => {
    if (e.key === 'Escape') {
      paletteMenu.hidden = true;
      paletteButton.setAttribute('aria-expanded', 'false');
      paletteButton.focus();
    }
  };

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
