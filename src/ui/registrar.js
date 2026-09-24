import * as store from '../store.js';
import { money, plain, esc, digits } from '../format.js';
import { hoyISO } from '../engine/movimientos.js';
import { deTipo, fallbackDe, nuevoId } from '../engine/categorias.js';
import { abrirModal } from './modal.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

/* La hoja de registro: Ingreso/Gasto · Monto · Categoría · Fecha · Nota.
   Con `movId` edita uno existente; `catId` y `nota` llenan uno nuevo (Ahorrar
   abre con Ahorro puesto). `alGuardar` repinta la vista de turno. */
export function abrirRegistro({ tipo = 'gasto', movId = null, catId = null, nota = '', titulo = '', alGuardar = () => {} } = {}) {
  const p = store.active();
  if (!p) return;
  const previo = movId ? p.movs.find((m) => m.id === movId) : null;
  if (previo) tipo = previo.tipo;

  const { cuerpo, cerrar } = abrirModal({ titulo: previo ? 'Editar movimiento' : (titulo || 'Registrar') });
  const catInicial = previo?.catId || catId;
  const opciones = (t) => deTipo(p.cats, t)
    .map((c) => `<option value="${c.id}" ${catInicial === c.id ? 'selected' : ''}>${esc(c.n)}</option>`).join('');

  cuerpo.innerHTML = `
    <div class="chips chips-tipo" id="regTipo">
      <button class="chip chip-gasto" data-tipo="gasto">${icon('sale', 'ic-sm')}Gasto</button>
      <button class="chip chip-ingreso" data-tipo="ingreso">${icon('entra', 'ic-sm')}Ingreso</button>
    </div>
    <div class="fld"><label for="regMonto">Monto</label>
      <input id="regMonto" class="num monto" inputmode="numeric" placeholder="0" value="${previo ? plain(previo.monto) : ''}"></div>
    <div class="fld"><label for="regCat">Categoría</label>
      <select id="regCat"></select></div>
    <div class="fld"><label for="regFecha">Fecha</label>
      <input type="date" id="regFecha" value="${previo?.fecha || hoyISO()}"></div>
    <div class="fld"><label for="regNota">Nota <span class="opcional">(opcional)</span></label>
      <input id="regNota" autocomplete="off" placeholder="Qué fue" value="${esc(previo?.nota || nota)}"></div>
    <div id="regErr" class="auth-err"></div>
    <button class="wide btn-primary" id="regSave">${previo ? 'Actualizar' : 'Guardar'}</button>`;

  const $ = (s) => cuerpo.querySelector(s);
  function setTipo(t) {
    tipo = t;
    cuerpo.querySelectorAll('#regTipo .chip').forEach((b) => {
      b.classList.toggle('on', b.dataset.tipo === t);
      b.setAttribute('aria-pressed', String(b.dataset.tipo === t));
    });
    // cada tipo tiene sus propias categorías: mercado no es un ingreso
    $('#regCat').innerHTML = opciones(t);
    if (catInicial && deTipo(p.cats, t).some((c) => c.id === catInicial)) $('#regCat').value = catInicial;
  }
  function guardar() {
    const monto = Math.round(digits($('#regMonto').value));
    if (monto <= 0) { $('#regErr').textContent = 'Escribe el monto.'; return; }
    const datos = {
      fecha: $('#regFecha').value || hoyISO(),
      tipo,
      monto,
      catId: $('#regCat').value || fallbackDe(tipo),
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
