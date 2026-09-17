import * as store from '../store.js';
import { delMes } from '../engine/movimientos.js';
import { money, esc, fechaCorta } from '../format.js';
import { selectorMes, enlazarMes, cabeceraMes, mesElegido } from './mes.js';
import { abrirRegistro } from './registrar.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

let filtro = ''; // '' = todas | 'ingreso' | catId

export function renderMovimientos(root) {
  const p = store.active();
  const per = mesElegido();
  if (filtro && filtro !== 'ingreso' && !p.cats.some((c) => c.id === filtro)) filtro = '';
  const lista = delMes(p.movs, per)
    .filter((m) => !filtro || (filtro === 'ingreso' ? m.tipo === 'ingreso' : m.catId === filtro));

  // agrupados por día, del más reciente al más viejo
  const dias = [];
  lista.forEach((m) => {
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo.fecha === m.fecha) ultimo.movs.push(m); else dias.push({ fecha: m.fecha, movs: [m] });
  });
  const cat = (m) => p.cats.find((c) => c.id === m.catId);

  root.innerHTML = `
    ${selectorMes()}
    ${cabeceraMes(p, per)}
    <div class="prow">
      <select id="mvFiltro" aria-label="Filtrar por categoría">
        <option value="">Todo</option>
        <option value="ingreso" ${filtro === 'ingreso' ? 'selected' : ''}>Solo ingresos</option>
        ${p.cats.map((c) => `<option value="${c.id}" ${filtro === c.id ? 'selected' : ''}>${esc(c.n)}</option>`).join('')}
      </select>
      <button class="btn-primary" id="mvNuevo">+ Registrar</button>
    </div>
    ${dias.length ? dias.map((d) => `<div class="dia">
      <div class="dia-fecha">${fechaCorta(d.fecha)}</div>
      ${d.movs.map((m) => `<div class="mov ${m.tipo}" data-id="${m.id}">
        <span class="dot" style="background:${m.tipo === 'ingreso' ? 'var(--sem-ingreso-2)' : (cat(m)?.c || '#64748B')}"></span>
        <div class="mov-txt">
          <div class="mov-cat">${m.tipo === 'ingreso' ? 'Ingreso' : esc(cat(m)?.n || 'Otros')}</div>
          ${m.nota ? `<div class="mov-nota">${esc(m.nota)}</div>` : ''}
        </div>
        <b class="num mov-monto">${m.tipo === 'ingreso' ? '+' : '−'}${money(m.monto)}</b>
        <button class="btn-icon" data-edit="${m.id}" aria-label="Editar">${icon('lapiz')}</button>
        <button class="btn-icon" data-del="${m.id}" aria-label="Borrar">${icon('cerrar')}</button>
      </div>`).join('')}
    </div>`).join('') : '<div class="empty">Nada registrado este mes. Toca “+ Registrar”.</div>'}`;

  const repintar = () => renderMovimientos(root);
  enlazarMes(root, repintar);
  root.querySelector('#mvFiltro').onchange = (e) => { filtro = e.target.value; repintar(); };
  root.querySelector('#mvNuevo').onclick = () => abrirRegistro({ alGuardar: repintar });
  root.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => abrirRegistro({ movId: b.dataset.edit, alGuardar: repintar });
  });
  root.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => {
      const i = p.movs.findIndex((m) => m.id === b.dataset.del);
      if (i < 0) return;
      const mov = p.movs[i];
      const deshacer = store.borrarConDeshacer(() => p.movs.splice(i, 1), () => p.movs.splice(i, 0, mov));
      repintar();
      toast(`Borrado: ${money(mov.monto)} ${mov.tipo === 'ingreso' ? 'de ingreso' : `en ${cat(mov)?.n || 'Otros'}`}.`, () => { deshacer(); repintar(); });
    };
  });
}
