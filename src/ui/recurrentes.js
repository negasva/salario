import * as store from '../store.js';
import {
  pagoDelMes, marcarPagado, quitarPago, marcarTodos, nuevoRecurrente, resumen, fechaEnPeriodo,
} from '../engine/recurrentes.js';
import { deTipo, nombreDe, colorDe, OTROS } from '../engine/categorias.js';
import { money, plain, esc, digits, fechaCorta, nombreMes } from '../format.js';
import { selectorMes, enlazarMes, mesElegido } from './mes.js';
import { abrirModal } from './modal.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

/* Lo que se repite todos los meses. Están todos siempre; lo que cambia es
   cuáles ya pagaste este mes y por cuánto. */

// Editor de la ficha: nombre, estimado, categoría y día.
function editorFicha(rec, alGuardar) {
  const p = store.active();
  const nuevo = !rec;
  const r = rec || nuevoRecurrente({});
  const { cuerpo, cerrar } = abrirModal({ titulo: nuevo ? 'Nuevo recurrente' : 'Editar recurrente' });
  cuerpo.innerHTML = `
    <div class="chips chips-tipo" id="reTipo">
      <button class="chip chip-gasto ${r.tipo === 'gasto' ? 'on' : ''}" data-tipo="gasto">Gasto</button>
      <button class="chip chip-ingreso ${r.tipo === 'ingreso' ? 'on' : ''}" data-tipo="ingreso">Ingreso</button>
    </div>
    <div class="fld"><label for="reNombre">Nombre</label>
      <input id="reNombre" value="${esc(r.n)}" placeholder="Ej: Arriendo, Internet" autocomplete="off"></div>
    <div class="fld"><label for="reMonto">Estimado al mes <span class="opcional">(opcional)</span></label>
      <input id="reMonto" class="num monto" inputmode="numeric" placeholder="0" value="${r.monto ? plain(r.monto) : ''}">
      <p class="sub">Es solo una referencia. Al marcarlo como pagado escribes lo que de verdad costó, y este número se queda igual. Déjalo vacío si nunca es el mismo.</p></div>
    <div class="fld" id="reCatWrap"><label for="reCat">Categoría</label>
      <select id="reCat">${deTipo(p.cats, 'gasto').map((c) => `<option value="${c.id}" ${(r.catId || OTROS) === c.id ? 'selected' : ''}>${esc(c.n)}</option>`).join('')}</select></div>
    <div class="fld"><label for="reDia">Día del mes</label>
      <input id="reDia" class="num" type="number" min="1" max="31" value="${r.dia || 1}"></div>
    <div id="reErr" class="auth-err"></div>
    <button class="wide btn-primary" id="reSave">Guardar</button>
    ${nuevo ? '' : '<button class="wide btn-borrar" id="reBorrar" style="margin-top:var(--space-2)">Borrar recurrente</button>'}`;

  const $ = (s) => cuerpo.querySelector(s);
  let tipo = r.tipo;
  const setTipo = (t) => {
    tipo = t;
    cuerpo.querySelectorAll('#reTipo .chip').forEach((b) => b.classList.toggle('on', b.dataset.tipo === t));
    $('#reCatWrap').hidden = t === 'ingreso';
  };
  const guardar = () => {
    const n = $('#reNombre').value.trim();
    if (!n) { $('#reErr').textContent = 'Escribe el nombre.'; return; }
    Object.assign(r, {
      n,
      monto: Math.max(0, Math.round(digits($('#reMonto').value))),
      tipo,
      catId: tipo === 'ingreso' ? null : ($('#reCat').value || OTROS),
      dia: Math.min(31, Math.max(1, Number($('#reDia').value) || 1)),
    });
    if (nuevo) p.recurrentes.push(r);
    store.save();
    cerrar();
    alGuardar();
  };
  $('#reTipo').onclick = (e) => { const b = e.target.closest('.chip'); if (b) setTipo(b.dataset.tipo); };
  $('#reSave').onclick = guardar;
  $('#reBorrar')?.addEventListener('click', () => {
    const i = p.recurrentes.indexOf(r);
    if (i < 0) return;
    const deshacer = store.borrarConDeshacer(() => p.recurrentes.splice(i, 1), () => p.recurrentes.splice(i, 0, r));
    cerrar();
    alGuardar();
    toast(`${r.n} ya no se repite. Los movimientos que ya registraste quedan.`, () => { deshacer(); alGuardar(); });
  });
  cuerpo.onkeydown = (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardar(); } };
  setTipo(tipo);
  $('#reNombre').focus();
}

/* Marcar el pago del mes. El monto llega con el estimado puesto y se corrige
   con lo que de verdad costó. */
function editorPago(rec, per, alGuardar) {
  const p = store.active();
  const previo = pagoDelMes(rec, p.movs, per);
  const { cuerpo, cerrar } = abrirModal({ titulo: `${previo ? 'Pago de' : 'Pagar'} ${rec.n}` });
  cuerpo.innerHTML = `
    <div class="fld"><label for="pgMonto">¿Cuánto ${previo ? 'fue' : 'te costó este mes'}?</label>
      <input id="pgMonto" class="num monto" inputmode="numeric" placeholder="0" value="${previo ? plain(previo.monto) : (rec.monto ? plain(rec.monto) : '')}">
      ${rec.monto ? `<p class="sub">Estimado: ${money(rec.monto)}. Lo que escribas aquí no lo cambia.</p>` : '<p class="sub">Este no tiene estimado: escribe lo que costó.</p>'}</div>
    <div class="fld"><label for="pgFecha">Fecha</label>
      <input type="date" id="pgFecha" value="${previo?.fecha || fechaEnPeriodo(per, rec.dia)}"></div>
    <div id="pgErr" class="auth-err"></div>
    <button class="wide btn-primary" id="pgSave">${previo ? 'Actualizar' : 'Marcar como pagado'}</button>
    ${previo ? '<button class="wide btn-borrar" id="pgQuitar" style="margin-top:var(--space-2)">Quitar el pago de este mes</button>' : ''}`;

  const guardar = () => {
    const monto = Math.round(digits(cuerpo.querySelector('#pgMonto').value));
    if (monto <= 0) { cuerpo.querySelector('#pgErr').textContent = 'Escribe cuánto costó.'; return; }
    marcarPagado(rec, p.movs, per, monto, cuerpo.querySelector('#pgFecha').value);
    store.save();
    cerrar();
    alGuardar();
    toast(`${rec.n}: ${money(monto)} en ${nombreMes(per)}.`);
  };
  cuerpo.querySelector('#pgSave').onclick = guardar;
  cuerpo.querySelector('#pgQuitar')?.addEventListener('click', () => {
    const mov = quitarPago(rec, p.movs, per);
    store.save();
    cerrar();
    alGuardar();
    toast(`${rec.n} vuelve a quedar pendiente.`, () => {
      if (mov) p.movs.push(mov);
      store.save();
      alGuardar();
    });
  });
  cuerpo.onkeydown = (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardar(); } };
  cuerpo.querySelector('#pgMonto').focus();
  cuerpo.querySelector('#pgMonto').select();
}

export function renderRecurrentes(root) {
  const p = store.active();
  const per = mesElegido();
  const gastos = resumen(p.recurrentes, p.movs, per, 'gasto');
  const ingresos = resumen(p.recurrentes, p.movs, per, 'ingreso');
  const faltan = gastos.faltan + ingresos.faltan;
  const conEstimado = p.recurrentes.filter((r) => r.monto > 0 && !pagoDelMes(r, p.movs, per)).length;

  const fila = (r) => {
    const mov = pagoDelMes(r, p.movs, per);
    const detalle = mov
      ? `${money(mov.monto)} el ${fechaCorta(mov.fecha)}${r.monto && mov.monto !== r.monto ? ` · estimado ${money(r.monto)}` : ''}`
      : `${r.monto ? `estimado ${money(r.monto)}` : 'sin estimado'} · día ${r.dia}`;
    return `<div class="cat rec ${mov ? 'pagado' : ''}" data-id="${r.id}">
      <span class="dot" style="background:${r.tipo === 'ingreso' ? 'var(--sem-ingreso-2)' : colorDe(p.cats, r.catId)}"></span>
      <div class="cat-txt">
        <div class="cat-n">${esc(r.n)}</div>
        <div class="cat-sub num">${detalle} · ${r.tipo === 'ingreso' ? 'Ingreso' : esc(nombreDe(p.cats, r.catId))}</div>
      </div>
      <button class="${mov ? 'mini pagado-btn' : 'mini btn-primary'}" data-pago="${r.id}">${mov ? `${icon('check', 'ic-sm')} Pagado` : 'Pagar'}</button>
      <button class="btn-icon" data-edit="${r.id}" aria-label="Editar ${esc(r.n)}">${icon('lapiz')}</button>
    </div>`;
  };

  const lista = (tipo) => p.recurrentes.filter((r) => r.tipo === tipo);

  root.innerHTML = `
    ${selectorMes()}
    <div class="card resumen-mes">
      <div class="rm-col"><span class="label">Pagado este mes</span><b class="num neg">${money(gastos.pagado)}</b></div>
      <div class="rm-col"><span class="label">Estimado del mes</span><b class="num">${money(gastos.estimado)}</b></div>
      ${ingresos.total ? `<div class="rm-col"><span class="label">Ingresos fijos recibidos</span><b class="num pos">${money(ingresos.pagado)}</b></div>
      <div class="rm-col"><span class="label">Estimado</span><b class="num">${money(ingresos.estimado)}</b></div>` : ''}
    </div>
    ${faltan ? `<div class="card aviso">
      <div><b>Faltan ${faltan} por marcar</b>
        <div class="sub">Marca cada uno con lo que de verdad costó.</div></div>
      ${conEstimado ? `<button id="reTodos">Marcar ${conEstimado} con su estimado</button>` : ''}
    </div>` : (p.recurrentes.length ? '<div class="card aviso"><div class="sub">Ya marcaste todos los de este mes.</div></div>' : '')}
    <div class="prow"><span class="sub">Cada uno guarda su nombre y su estimado. Al pagarlo escribes lo que costó de verdad.</span>
      <button class="btn-primary" id="reNuevo">+ Nuevo</button></div>
    ${p.recurrentes.length ? `
      <div class="seccion">
        <div class="seccion-head"><span class="label">Gastos</span></div>
        <div class="cats">${lista('gasto').map(fila).join('') || '<div class="empty">Ninguno todavía.</div>'}</div>
      </div>
      ${lista('ingreso').length ? `<div class="seccion">
        <div class="seccion-head"><span class="label">Ingresos</span></div>
        <div class="cats">${lista('ingreso').map(fila).join('')}</div>
      </div>` : ''}`
    : '<div class="empty">Todavía no tienes recurrentes. Toca “+ Nuevo”.</div>'}`;

  const repintar = () => renderRecurrentes(root);
  enlazarMes(root, repintar);
  root.querySelector('#reNuevo').onclick = () => editorFicha(null, repintar);
  root.querySelectorAll('[data-pago]').forEach((b) => {
    b.onclick = () => editorPago(p.recurrentes.find((r) => r.id === b.dataset.pago), per, repintar);
  });
  root.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => editorFicha(p.recurrentes.find((r) => r.id === b.dataset.edit), repintar);
  });
  root.querySelector('#reTodos')?.addEventListener('click', () => {
    const nuevos = marcarTodos(p.recurrentes, p.movs, per);
    if (!nuevos.length) return;
    store.save();
    repintar();
    toast(`${nuevos.length} marcado${nuevos.length === 1 ? '' : 's'} con su estimado. Corrige el que no haya dado igual.`, () => {
      nuevos.forEach((m) => { const i = p.movs.indexOf(m); if (i >= 0) p.movs.splice(i, 1); });
      store.save();
      repintar();
    });
  });
}
