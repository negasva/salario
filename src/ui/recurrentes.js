import * as store from '../store.js';
import { pendientes, agregarAlMes, nuevoRecurrente, totalDe } from '../engine/recurrentes.js';
import { deTipo, nombreDe, colorDe, OTROS } from '../engine/categorias.js';
import { money, plain, esc, digits } from '../format.js';
import { selectorMes, enlazarMes, mesElegido } from './mes.js';
import { abrirModal } from './modal.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

/* Lo que se repite todos los meses, con su nombre y su precio. No se agregan
   solos: un movimiento que aparece sin que lo pidas es uno que nadie revisa. */

function editor(rec, alGuardar) {
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
    <div class="fld"><label for="reMonto">Precio al mes</label>
      <input id="reMonto" class="num monto" inputmode="numeric" placeholder="0" value="${r.monto ? plain(r.monto) : ''}"></div>
    <div class="fld" id="reCatWrap"><label for="reCat">Categoría</label>
      <select id="reCat">${deTipo(p.cats, 'gasto').map((c) => `<option value="${c.id}" ${(r.catId || OTROS) === c.id ? 'selected' : ''}>${esc(c.n)}</option>`).join('')}</select></div>
    <div class="fld"><label for="reDia">Día del mes</label>
      <input id="reDia" class="num" type="number" min="1" max="31" value="${r.dia || 1}"></div>
    <label class="check"><input type="checkbox" id="reActivo" ${r.activo !== false ? 'checked' : ''}> Activo</label>
    <div id="reErr" class="auth-err"></div>
    <button class="wide btn-primary" id="reSave">Guardar</button>`;

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
      activo: $('#reActivo').checked,
    });
    if (nuevo) p.recurrentes.push(r);
    store.save();
    cerrar();
    alGuardar();
  };
  $('#reTipo').onclick = (e) => { const b = e.target.closest('.chip'); if (b) setTipo(b.dataset.tipo); };
  $('#reSave').onclick = guardar;
  cuerpo.onkeydown = (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardar(); } };
  setTipo(tipo);
  $('#reNombre').focus();
}

export function renderRecurrentes(root) {
  const p = store.active();
  const per = mesElegido();
  const faltan = pendientes(p.recurrentes, p.movs, per);
  const lista = p.recurrentes;
  const totalGasto = totalDe(p.recurrentes, 'gasto');
  const totalIngreso = totalDe(p.recurrentes, 'ingreso');

  root.innerHTML = `
    ${selectorMes()}
    <div class="card resumen-mes">
      <div class="rm-col"><span class="label">Gastos fijos al mes</span><b class="num neg">${money(totalGasto)}</b></div>
      <div class="rm-col"><span class="label">Ingresos fijos al mes</span><b class="num pos">${money(totalIngreso)}</b></div>
    </div>
    ${faltan.length ? `<div class="card aviso">
      <div><b>${faltan.length} sin agregar a este mes</b>
        <div class="sub">${esc(faltan.slice(0, 4).map((r) => r.n).join(', '))}${faltan.length > 4 ? '…' : ''}</div></div>
      <button class="btn-primary" id="reTodos">Agregar los de este mes</button>
    </div>` : (lista.length ? '<div class="card aviso"><div class="sub">Todos los de este mes ya están registrados.</div></div>' : '')}
    <div class="prow"><span class="sub">Cada uno se guarda con su nombre y su precio, y se agrega al mes cuando tú lo digas.</span>
      <button class="btn-primary" id="reNuevo">+ Nuevo</button></div>
    <div class="cats">
      ${lista.length ? lista.map((r) => {
    const ya = !faltan.includes(r) && r.activo !== false;
    return `<div class="cat ${r.activo === false ? 'apagado' : ''}" data-id="${r.id}">
        <span class="dot" style="background:${r.tipo === 'ingreso' ? 'var(--sem-ingreso-2)' : colorDe(p.cats, r.catId)}"></span>
        <div class="cat-txt">
          <div class="cat-n">${esc(r.n)}</div>
          <div class="cat-sub num">${money(r.monto)} · día ${r.dia} · ${r.tipo === 'ingreso' ? 'Ingreso' : esc(nombreDe(p.cats, r.catId))}${r.activo === false ? ' · apagado' : ''}</div>
        </div>
        ${r.activo === false ? '' : ya
    ? '<span class="pill ok">Ya está</span>'
    : `<button class="mini" data-add="${r.id}">Agregar</button>`}
        <button class="btn-icon" data-del="${r.id}" aria-label="Borrar ${esc(r.n)}">${icon('cerrar')}</button>
      </div>`;
  }).join('') : '<div class="empty">Todavía no tienes recurrentes. Toca “+ Nuevo”.</div>'}
    </div>`;

  const repintar = () => renderRecurrentes(root);
  enlazarMes(root, repintar);
  root.querySelector('#reNuevo').onclick = () => editor(null, repintar);

  const agregar = (ids) => {
    const nuevos = agregarAlMes(p.recurrentes, p.movs, per, ids);
    if (!nuevos.length) { toast('No había nada con precio para agregar.'); return; }
    store.save();
    repintar();
    const total = nuevos.reduce((s, m) => s + (m.tipo === 'gasto' ? m.monto : -m.monto), 0);
    toast(`${nuevos.length} movimiento${nuevos.length === 1 ? '' : 's'} por ${money(Math.abs(total))}.`, () => {
      nuevos.forEach((m) => { const i = p.movs.indexOf(m); if (i >= 0) p.movs.splice(i, 1); });
      store.save();
      repintar();
    });
  };

  root.querySelector('#reTodos')?.addEventListener('click', () => agregar(null));
  root.querySelectorAll('[data-add]').forEach((b) => { b.onclick = () => agregar([b.dataset.add]); });
  root.querySelectorAll('.cat').forEach((el) => {
    el.onclick = (e) => {
      if (e.target.closest('[data-del],[data-add]')) return;
      editor(lista.find((r) => r.id === el.dataset.id), repintar);
    };
  });
  root.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => {
      const i = lista.findIndex((r) => r.id === b.dataset.del);
      if (i < 0) return;
      const rec = lista[i];
      const deshacer = store.borrarConDeshacer(() => lista.splice(i, 1), () => lista.splice(i, 0, rec));
      repintar();
      toast(`${rec.n} ya no se repite. Los movimientos que ya registraste quedan.`, () => { deshacer(); repintar(); });
    };
  });
}
