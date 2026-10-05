import * as store from '../store.js';
import { money, plain, esc, digits, nombreMes } from '../format.js';
import { hoyISO, periodoDe } from '../engine/movimientos.js';
import { cuentaEn, estaPagado } from '../engine/recurrentes.js';
import { deTipo, fallbackDe, nuevoId } from '../engine/categorias.js';
import { abrirModal } from './modal.js';
import { icon } from './icons.js';
import { toast } from './shell.js';
import { fijarSegmento, destacar } from './efectos.js';

// Una opción propia al principio de las categorías de gasto: lleva a elegir un recurrente.
const REC = '__rec';
const sinTildes = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

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
  const gastosRec = p.recurrentes.filter((r) => r.tipo === 'gasto');
  const recPrevio = previo?.recId ? gastosRec.find((r) => r.id === previo.recId) : null;
  /* "Gastos recurrentes" es una categoría que ya existe en algunos perfiles: elegirla
     funciona igual que la opción propia. */
  const esRec = (v) => v === REC || (gastosRec.length > 0 && sinTildes(p.cats.find((c) => c.id === v)?.n) === 'gastos recurrentes');
  const opciones = (t) => (t === 'gasto' && gastosRec.length && !p.cats.some((c) => esRec(c.id))
    ? `<option value="${REC}" ${recPrevio ? 'selected' : ''}>Gastos recurrentes</option>` : '') + deTipo(p.cats, t)
    .map((c) => `<option value="${esc(c.id)}" ${catInicial === c.id ? 'selected' : ''}>${esc(c.n)}</option>`).join('');

  cuerpo.innerHTML = `
    <div class="chips chips-tipo" id="regTipo" data-seg="reg-tipo" data-v="gasto">
      <button class="chip chip-gasto" data-tipo="gasto">${icon('sale', 'ic-sm')}Gasto</button>
      <button class="chip chip-ingreso" data-tipo="ingreso">${icon('entra', 'ic-sm')}Ingreso</button>
    </div>
    <div class="fld"><label for="regMonto">Monto</label>
      <input id="regMonto" class="num monto" inputmode="numeric" placeholder="0" value="${previo ? plain(previo.monto) : ''}"></div>
    <div class="fld"><label for="regCat">Categoría</label>
      <select id="regCat"></select></div>
    <div class="fld" id="regRecWrap" hidden><label for="regRec">¿Cuál recurrente?</label>
      <select id="regRec"></select></div>
    <div class="fld"><label for="regFecha">Fecha</label>
      <input type="date" id="regFecha" value="${previo?.fecha || hoyISO()}"></div>
    <div class="fld"><label for="regNota">Nota <span class="opcional">(opcional)</span></label>
      <input id="regNota" autocomplete="off" placeholder="Qué fue" value="${esc(previo?.nota || nota)}"></div>
    <div id="regErr" class="auth-err"></div>
    <button class="wide btn-primary" id="regSave">${previo ? 'Actualizar' : 'Guardar'}</button>`;

  const $ = (s) => cuerpo.querySelector(s);
  function setTipo(t) {
    tipo = t;
    $('#regTipo').dataset.v = t;
    fijarSegmento($('#regTipo'), t === 'ingreso' ? 1 : 0);
    cuerpo.querySelectorAll('#regTipo .chip').forEach((b) => {
      b.classList.toggle('on', b.dataset.tipo === t);
      b.setAttribute('aria-pressed', String(b.dataset.tipo === t));
    });
    // cada tipo tiene sus propias categorías: mercado no es un ingreso
    $('#regCat').innerHTML = opciones(t);
    if (catInicial && deTipo(p.cats, t).some((c) => c.id === catInicial)) $('#regCat').value = catInicial;
    if (t === 'gasto' && recPrevio && $('#regCat').querySelector(`option[value="${REC}"]`)) $('#regCat').value = REC;
    else if (t === 'gasto' && recPrevio) { const c = p.cats.find((x) => esRec(x.id)); if (c) $('#regCat').value = c.id; }
    pintaRec();
  }
  // los recurrentes de gasto, con los del mes que aún no tienen pago primero
  function pintaRec() {
    const visible = tipo === 'gasto' && esRec($('#regCat').value);
    $('#regRecWrap').hidden = !visible;
    if (!visible) return;
    const per = periodoDe($('#regFecha').value || hoyISO());
    const antes = $('#regRec').value || recPrevio?.id;
    const falta = gastosRec.filter((r) => cuentaEn(r, per) && !estaPagado(r, p.movs, per));
    const resto = gastosRec.filter((r) => !falta.includes(r));
    const op = (r) => `<option value="${esc(r.id)}">${esc(r.n)}${r.monto ? ` · ${money(r.monto)}` : ''}</option>`;
    $('#regRec').innerHTML = `${falta.length ? `<optgroup label="Pendientes de ${nombreMes(per)}">${falta.map(op).join('')}</optgroup>` : ''}${resto.length ? `<optgroup label="${falta.length ? 'Los demás' : 'Recurrentes'}">${resto.map(op).join('')}</optgroup>` : ''}`;
    if (antes && gastosRec.some((r) => r.id === antes)) $('#regRec').value = antes;
    // al elegir uno se sugiere su estimado si el monto está vacío
    if (!$('#regMonto').value) { const r = gastosRec.find((x) => x.id === $('#regRec').value); if (r?.monto) $('#regMonto').placeholder = plain(r.monto); }
  }
  function guardar() {
    const monto = Math.round(digits($('#regMonto').value));
    if (monto <= 0) { $('#regErr').textContent = 'Escribe el monto.'; return; }
    const rec = tipo === 'gasto' && esRec($('#regCat').value) ? gastosRec.find((r) => r.id === $('#regRec').value) : null;
    const datos = {
      fecha: $('#regFecha').value || hoyISO(),
      tipo,
      monto,
      catId: rec ? (rec.catId || fallbackDe(tipo)) : ($('#regCat').value || fallbackDe(tipo)),
      nota: $('#regNota').value.trim() || (rec ? rec.n : ''),
    };
    if (rec) datos.recId = rec.id;
    else if (previo) delete previo.recId;
    let mov = previo;
    if (previo) Object.assign(previo, datos);
    else { mov = { id: nuevoId(), ...datos }; p.movs.push(mov); }
    destacar.id = mov.id;
    store.save();
    cerrar();
    alGuardar(mov);
    toast(`${tipo === 'gasto' ? 'Gasto' : 'Ingreso'} de ${money(monto)} ${previo ? 'actualizado' : 'guardado'}.`);
  }

  $('#regTipo').onclick = (e) => { const b = e.target.closest('.chip'); if (b) setTipo(b.dataset.tipo); };
  $('#regCat').onchange = pintaRec;
  $('#regFecha').addEventListener('change', pintaRec);
  $('#regRec').onchange = () => { if (!$('#regMonto').value) pintaRec(); };
  $('#regSave').onclick = guardar;
  cuerpo.onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardar(); }
  };
  setTipo(tipo);
  $('#regMonto').focus();
}
