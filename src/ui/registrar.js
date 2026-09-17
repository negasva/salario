import * as store from '../store.js';
import { money, plain, esc, digits } from '../format.js';
import { hoyISO } from '../engine/movimientos.js';
import { OTROS, nuevoId } from '../engine/categorias.js';
import { abrirModal } from './modal.js';
import { toast } from './shell.js';

/* La hoja de registro: Ingreso/Gasto · Monto · Categoría · Fecha · Nota.
   Con `movId` edita uno existente. `alGuardar` repinta la vista de turno. */
export function abrirRegistro({ tipo = 'gasto', movId = null, alGuardar = () => {} } = {}) {
  const p = store.active();
  if (!p) return;
  const previo = movId ? p.movs.find((m) => m.id === movId) : null;
  if (previo) tipo = previo.tipo;

  const { cuerpo, cerrar } = abrirModal({ titulo: previo ? 'Editar movimiento' : 'Registrar' });
  cuerpo.innerHTML = `
    <div class="chips chips-tipo" id="regTipo">
      <button class="chip chip-gasto ${tipo === 'gasto' ? 'on' : ''}" data-tipo="gasto">Gasto</button>
      <button class="chip chip-ingreso ${tipo === 'ingreso' ? 'on' : ''}" data-tipo="ingreso">Ingreso</button>
    </div>
    <div class="fld"><label for="regMonto">Monto</label>
      <input id="regMonto" class="num monto" inputmode="numeric" placeholder="0" value="${previo ? plain(previo.monto) : ''}"></div>
    <div class="fld" id="regCatWrap"><label for="regCat">Categoría</label>
      <select id="regCat">${p.cats.map((c) => `<option value="${c.id}" ${(previo?.catId || OTROS) === c.id ? 'selected' : ''}>${esc(c.n)}</option>`).join('')}</select></div>
    <div class="fld"><label for="regFecha">Fecha</label>
      <input type="date" id="regFecha" value="${previo?.fecha || hoyISO()}"></div>
    <div class="fld"><label for="regNota">Nota <span class="opcional">(opcional)</span></label>
      <input id="regNota" autocomplete="off" placeholder="Qué fue" value="${esc(previo?.nota || '')}"></div>
    <div id="regErr" class="auth-err"></div>
    <button class="wide btn-primary" id="regSave">${previo ? 'Actualizar' : 'Guardar'}</button>`;

  const $ = (s) => cuerpo.querySelector(s);
  function setTipo(t) {
    tipo = t;
    cuerpo.querySelectorAll('#regTipo .chip').forEach((b) => b.classList.toggle('on', b.dataset.tipo === t));
    $('#regCatWrap').hidden = t === 'ingreso';
  }
  function guardar() {
    const monto = Math.round(digits($('#regMonto').value));
    if (monto <= 0) { $('#regErr').textContent = 'Escribe el monto.'; return; }
    const datos = {
      fecha: $('#regFecha').value || hoyISO(),
      tipo,
      monto,
      catId: tipo === 'gasto' ? ($('#regCat').value || OTROS) : null,
      nota: $('#regNota').value.trim(),
    };
    let mov = previo;
    if (previo) Object.assign(previo, datos);
    else { mov = { id: nuevoId(), ...datos }; p.movs.push(mov); }
    store.save();
    cerrar();
    alGuardar(mov);
    toast(`${tipo === 'gasto' ? 'Gasto' : 'Ingreso'} de ${money(monto)} ${previo ? 'actualizado' : 'guardado'}.`);
  }

  $('#regTipo').onclick = (e) => { const b = e.target.closest('.chip'); if (b) setTipo(b.dataset.tipo); };
  $('#regSave').onclick = guardar;
  cuerpo.onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardar(); }
  };
  setTipo(tipo);
  $('#regMonto').focus();
}
