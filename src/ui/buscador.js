import * as store from '../store.js';
import { buscar, totalDeMovimientos } from '../engine/buscar.js';
import { money, esc } from '../format.js';
import { icon } from './icons.js';
import { abrirModal } from './modal.js';

/* Buscador de todo el perfil. Un solo componente para los dos sitios donde se
   pide: el botón de la barra lateral y la tarjeta del dashboard. */

const ICONO = { movimiento: 'movimientos', meta: 'metas', categoria: 'categorias', renglon: 'etiqueta' };

export function pintarResultados(box, p, consulta, alNavegar) {
  const res = buscar(p, consulta);
  if (consulta.trim().length < 2) { box.innerHTML = ''; return; }
  if (!res.length) {
    box.innerHTML = `<div class="empty">Nada con “${esc(consulta)}”.</div>`;
    return;
  }
  const total = totalDeMovimientos(res);
  const cuantos = res.filter((r) => r.tipo === 'movimiento').length;
  box.innerHTML = `
    ${total > 0 ? `<div class="busca-resumen sub">${icon('movimientos', 'ic-sm')}
      ${cuantos === 1 ? '1 movimiento' : `${cuantos} movimientos`}
      <span class="num">${money(total, p.cur)}</span></div>` : ''}
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
        alNavegar?.();
        return;
      }
      window.dispatchEvent(new CustomEvent('ir-a-vista', { detail: { route: r.ruta, args: r.args || {} } }));
      alNavegar?.();
    };
  });
}

export function abrirBuscador() {
  const p = store.active();
  const { cuerpo, cerrar } = abrirModal({ titulo: 'Buscar' });
  cuerpo.innerHTML = `
      <label class="search wide">${icon('buscar', 'ic-sm')}
        <input id="bqInput" placeholder="Un gasto, una meta, un tipo de concepto…" aria-label="Buscar en el perfil"></label>
      <div id="bqRes"></div>`;

  const input = cuerpo.querySelector('#bqInput');
  const res = cuerpo.querySelector('#bqRes');
  input.oninput = () => pintarResultados(res, p, input.value, cerrar);
  input.focus();
}
