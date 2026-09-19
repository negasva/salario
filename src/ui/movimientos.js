import * as store from '../store.js';
import { delMes } from '../engine/movimientos.js';
import { nombreDe, colorDe, deTipo } from '../engine/categorias.js';
import { pendientes } from '../engine/recurrentes.js';
import { money, esc, fechaCorta } from '../format.js';
import { selectorMes, enlazarMes, cabeceraMes, mesElegido } from './mes.js';
import { abrirRegistro } from './registrar.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

let filtro = ''; // '' = todo | catId

export function renderMovimientos(root) {
  const p = store.active();
  const per = mesElegido();
  if (filtro && !p.cats.some((c) => c.id === filtro)) filtro = '';
  const lista = delMes(p.movs, per).filter((m) => !filtro || m.catId === filtro);
  const faltan = pendientes(p.recurrentes, p.movs, per);

  // agrupados por día, del más reciente al más viejo
  const dias = [];
  lista.forEach((m) => {
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo.fecha === m.fecha) ultimo.movs.push(m); else dias.push({ fecha: m.fecha, movs: [m] });
  });
  const grupo = (tipo) => deTipo(p.cats, tipo)
    .map((c) => `<option value="${c.id}" ${filtro === c.id ? 'selected' : ''}>${esc(c.n)}</option>`).join('');

  root.innerHTML = `
    ${selectorMes()}
    ${cabeceraMes(p, per)}
    ${faltan.length ? `<div class="card aviso">
      <div><b>Te faltan ${faltan.length} recurrente${faltan.length === 1 ? '' : 's'} de este mes</b>
        <div class="sub">${esc(faltan.slice(0, 4).map((r) => r.n).join(', '))}${faltan.length > 4 ? '…' : ''}</div></div>
      <button class="btn-primary" id="mvRec">Marcarlos</button></div>` : ''}
    <div class="prow">
      <select id="mvFiltro" aria-label="Filtrar por categoría">
        <option value="">Todo</option>
        <optgroup label="Gastos">${grupo('gasto')}</optgroup>
        <optgroup label="Ingresos">${grupo('ingreso')}</optgroup>
      </select>
      <button class="btn-primary" id="mvNuevo">+ Registrar</button>
    </div>
    ${dias.length ? dias.map((d) => `<div class="dia">
      <div class="dia-fecha">${fechaCorta(d.fecha)}</div>
      ${d.movs.map((m) => `<div class="mov ${m.tipo}" data-id="${m.id}">
        <span class="dot" style="background:${colorDe(p.cats, m.catId)}"></span>
        <div class="mov-txt">
          <div class="mov-cat">${esc(nombreDe(p.cats, m.catId))}</div>
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
  // marcarlos uno a uno es cosa de su pantalla: aquí solo se avisa
  root.querySelector('#mvRec')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('ir-a-vista', { detail: { route: 'recurrentes' } }));
  });
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
      toast(`Borrado: ${money(mov.monto)} en ${nombreDe(p.cats, mov.catId)}.`, () => { deshacer(); repintar(); });
    };
  });
}
