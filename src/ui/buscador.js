import * as store from '../store.js';
import { buscar, totalDeMovimientos } from '../engine/buscar.js';
import { money, esc } from '../format.js';
import { icon } from './icons.js';

/* Buscador de todo el perfil. Un solo componente para los dos sitios donde se
   pide: el botón de la barra lateral y la tarjeta del dashboard. */

const ICONO = { movimiento: 'movimientos', meta: 'metas', categoria: 'categorias', renglon: 'etiqueta' };

export function pintarResultados(box, p, consulta) {
  const res = buscar(p, consulta);
  if (consulta.trim().length < 2) { box.innerHTML = ''; return; }
  if (!res.length) {
    box.innerHTML = `<div class="empty">Nada con “${esc(consulta)}”.</div>`;
    return;
  }
  const total = totalDeMovimientos(res);
  box.innerHTML = `
    ${total > 0 ? `<div class="sub">${res.filter((r) => r.tipo === 'movimiento').length} movimientos ·
      <b class="num">${money(total, p.cur)}</b> en total</div>` : ''}
    <div class="busca-list">
      ${res.map((r, i) => `<button class="busca-item" data-i="${i}">
        ${icon(ICONO[r.tipo] || 'etiqueta', 'ic-sm')}
        <span class="nm">${esc(r.titulo)}</span>
        <span class="sub">${esc(r.sub)}</span>
        ${r.monto ? `<span class="num">${money(r.monto, p.cur)}</span>` : ''}
      </button>`).join('')}
    </div>`;

  box.querySelectorAll('.busca-item').forEach((b) => {
    b.onclick = () => {
      const r = res[Number(b.dataset.i)];
      if (r.tipo === 'meta') {
        window.dispatchEvent(new CustomEvent('ir-a-meta', { detail: { goalId: r.id } }));
        return;
      }
      window.dispatchEvent(new CustomEvent('ir-a-vista', { detail: { route: r.ruta, args: r.args || {} } }));
      cerrarOverlay();
    };
  });
}

let overlay = null;

function cerrarOverlay() {
  overlay?.remove();
  overlay = null;
  document.body.style.overflow = '';
}

export function abrirBuscador() {
  if (overlay) return;
  const p = store.active();
  overlay = document.createElement('div');
  overlay.className = 'overlay on';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  overlay.innerHTML = `
    <div class="sheet">
      <div class="sheet-head">
        <h3>Buscar</h3>
        <button class="btn-del" id="bqClose" aria-label="Cerrar">${icon('cerrar')}</button>
      </div>
      <label class="search wide">${icon('buscar', 'ic-sm')}
        <input id="bqInput" placeholder="Un gasto, una meta, un renglón…" aria-label="Buscar en el perfil"></label>
      <div id="bqRes" style="margin-top:var(--space-4)"></div>
    </div>`;

  const input = overlay.querySelector('#bqInput');
  const res = overlay.querySelector('#bqRes');
  input.oninput = () => pintarResultados(res, p, input.value);
  overlay.querySelector('#bqClose').onclick = cerrarOverlay;
  overlay.onclick = (e) => { if (e.target === overlay) cerrarOverlay(); };
  document.addEventListener('keydown', function esc(e) {
    if (e.key !== 'Escape') return;
    document.removeEventListener('keydown', esc);
    cerrarOverlay();
  });
  input.focus();
}
