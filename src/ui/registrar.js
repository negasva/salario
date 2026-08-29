import * as store from '../store.js';
import { money, plain, esc, digits } from '../format.js';
import { hoyISO } from '../engine/movimientos.js';
import { CATEGORIAS, CATEGORIA_A_ROL, clasificarLista, nombreCategoria } from '../engine/clasificar.js';
import { MONEDAS, tasa } from '../engine/moneda.js';
import { ordenadas } from '../engine/fila.js';
import { excedente } from '../engine/consejo.js';
import { clasificarConIA } from '../ia.js';
import { anuncio } from './anuncio.js';
import { icon } from './icons.js';
import { etiquetaMedio } from './medios.js';
import { toast } from './shell.js';

/* F3 — un solo formulario de movimientos, en hoja, para toda la app: el botón
   flotante, el libro y la edición de un movimiento entran por aquí. Antes vivía
   pegado arriba de Movimientos y era la única forma de registrar algo. */

const nuevoId = () => 'm' + Math.random().toString(36).slice(2, 9);

function registrarAporteExtra(p, goal, monto, fecha) {
  if (!(monto > 0)) return;
  p.movs.push({
    id: nuevoId(), fecha, tipo: 'gasto', monto,
    itemId: null, lineId: null, goalId: goal.id,
    nota: `Aporte de ingreso extra a ${goal.n}`, extra: false,
  });
}

function metasActivas(p) {
  return ordenadas(p.goals).filter((g) => (g.estado || 'activa') === 'activa');
}

export function abrirSelectorExtra(p, monto, fecha, alTerminar) {
  const metas = metasActivas(p);
  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const cerrar = () => {
    overlay.remove();
    document.body.style.overflow = '';
  };

  overlay.innerHTML = `
    <div class="sheet">
      <div class="sheet-head">
        <h3>Repartir ingreso extra</h3>
        <button class="btn-del" id="extraClose" aria-label="Cerrar">${icon('cerrar')}</button>
      </div>
      <p class="sub">Puedes repartir hasta <b class="num">${money(monto, p.cur)}</b> entre tus metas activas. La lista respeta el orden de la fila.</p>
      <div id="extraAlloc" style="margin-top:var(--space-5)">
        ${metas.length ? metas.map((g) => {
          const restante = g.t > 0 ? Math.max(0, g.t - (g.s || 0)) : monto;
          return `<label class="alloc">
            <span class="alloc-head"><span>${esc(g.n)}</span><span class="sub">${g.t > 0 ? `faltan ${money(restante, p.cur)}` : 'sin tope'}</span></span>
            <input class="extra-amount" data-goal="${g.id}" type="text" inputmode="numeric" placeholder="0" data-max="${restante}" aria-label="Monto para ${esc(g.n)}">
          </label>`;
        }).join('') : '<div class="empty">No hay metas activas para repartir este ingreso.</div>'}
      </div>
      <div id="extraRestante" class="hint"></div>
      <button class="wide btn-primary" id="extraApply" style="margin-top:var(--space-4)" ${metas.length ? '' : 'disabled'}>Aplicar reparto</button>
      <button class="wide" id="extraCancel" style="margin-top:var(--space-2)">Cancelar</button>
    </div>`;

  const inputs = [...overlay.querySelectorAll('.extra-amount')];
  const restante = overlay.querySelector('#extraRestante');
  const actualizarRestante = () => {
    const usado = inputs.reduce((s, input) => s + digits(input.value), 0);
    const libre = monto - usado;
    restante.textContent = libre >= 0
      ? `Quedan ${money(libre, p.cur)} sin repartir.`
      : `Te pasaste ${money(-libre, p.cur)} del monto disponible.`;
    restante.style.color = libre < 0 ? 'var(--danger)' : '';
  };

  inputs.forEach((input) => { input.oninput = actualizarRestante; });
  actualizarRestante();
  overlay.querySelector('#extraClose').onclick = cerrar;
  overlay.querySelector('#extraCancel').onclick = cerrar;
  overlay.querySelector('#extraApply').onclick = () => {
    const repartido = inputs.map((input) => {
      const maximo = Number(input.dataset.max);
      return {
        goal: p.goals.find((g) => g.id === input.dataset.goal),
        monto: Math.min(digits(input.value), Number.isFinite(maximo) ? maximo : monto),
      };
    }).filter((x) => x.goal && x.monto > 0);
    const total = repartido.reduce((s, x) => s + x.monto, 0);
    if (total > monto) {
      restante.textContent = `Te pasaste ${money(total - monto, p.cur)} del monto disponible.`;
      restante.style.color = 'var(--danger)';
      return;
    }
    repartido.forEach(({ goal, monto: cantidad }) => registrarAporteExtra(p, goal, cantidad, fecha));
    store.save();
    cerrar();
    alTerminar(total);
  };
}

async function afinarConIA(mov, texto, alTerminar) {
  const [r] = (await clasificarConIA([texto])) || [];
  const valida = r && CATEGORIAS.some((c) => c.id === r.cat);
  if (!valida || r.cat === mov.cat) return;
  mov.cat = r.cat;
  store.save();
  alTerminar();
  toast(`Lo puse en ${nombreCategoria(r.cat)}`);
}

/* Abre la hoja de registro. `tipo` es 'gasto' o 'ingreso'; con `movId` edita
   uno existente. `alGuardar` repinta la vista de turno. */
export function abrirRegistro({ tipo = 'gasto', movId = null, alGuardar = () => {} } = {}) {
  const p = store.active();
  if (!p) return;
  const previo = movId ? p.movs.find((m) => m.id === movId) : null;
  if (previo) tipo = previo.tipo;

  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const cerrar = () => { overlay.remove(); document.body.style.overflow = ''; };

  overlay.innerHTML = `
    <div class="sheet reg-sheet">
      <div class="sheet-head">
        <h3>${previo ? 'Editar movimiento' : 'Registrar movimiento'}</h3>
        <button class="btn-del" id="regClose" aria-label="Cerrar">${icon('cerrar')}</button>
      </div>
      <div class="chips" id="regTipo">
        <button class="chip ${tipo === 'gasto' ? 'on' : ''}" data-tipo="gasto">Egreso</button>
        <button class="chip ${tipo === 'ingreso' ? 'on' : ''}" data-tipo="ingreso">Ingreso</button>
      </div>

      <div class="fld"><label for="regNota">Descripción</label>
        <input id="regNota" autocomplete="off" placeholder="Qué fue" value="${esc(previo?.nota || '')}"></div>

      <div class="reg-row">
        <div class="fld"><label for="regMonto">Monto</label>
          <input id="regMonto" class="num" inputmode="numeric" placeholder="0" value="${previo ? plain(previo.montoOrig ?? previo.monto, previo.curOrig || p.cur) : ''}"></div>
        <div class="fld"><label for="regCur">Moneda</label>
          <select id="regCur">${MONEDAS.map((m) => `<option value="${m}" ${(previo?.curOrig || p.cur) === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      </div>

      <div class="reg-row">
        <div class="fld"><label for="regFecha">Fecha</label>
          <input type="date" id="regFecha" value="${previo?.fecha || hoyISO()}"></div>
        <div class="fld"><label for="regMedio">Medio de pago</label>
          <select id="regMedio"><option value="">Sin medio</option>
            ${(p.medios || []).map((m) => `<option value="${esc(m)}" ${previo?.medio === m ? 'selected' : ''}>${esc(etiquetaMedio(m))}</option>`).join('')}
          </select></div>
      </div>

      <div class="reg-row" id="regCatWrap">
        <div class="fld"><label for="regItem">Categoría</label>
          <span class="sel-color"><i class="sel-dot" id="regItemDot" aria-hidden="true"></i>
          <select id="regItem">${p.items.length
            ? p.items.map((it) => `<option value="${it.id}" data-c="${it.c}" style="color:${it.c}" ${previo?.itemId === it.id ? 'selected' : ''}>● ${esc(it.n)}</option>`).join('')
            : '<option value="">Sin categorías todavía</option>'}</select></span></div>
        <div class="fld"><label for="regLine">Tipo de concepto</label>
          <select id="regLine"></select></div>
      </div>

      <button id="regMas" class="mini">Más detalle</button>
      <div id="regDetalle" hidden>
        <div class="reg-row">
          <div class="fld"><label for="regGoal">Meta</label>
            <select id="regGoal"><option value="">Sin meta</option>
              ${p.goals.map((g) => `<option value="${g.id}" ${previo?.goalId === g.id ? 'selected' : ''}>${esc(g.n)}</option>`).join('')}
            </select></div>
          <div class="fld"><label for="regCat">Tipo de gasto</label>
            <select id="regCat"><option value="">Automática</option>
              ${CATEGORIAS.map((c) => `<option value="${c.id}" ${previo?.cat === c.id ? 'selected' : ''}>${c.n}</option>`).join('')}
            </select></div>
        </div>
        <label class="mov-check" id="regExtraWrap"><input type="checkbox" id="regExtra" ${previo?.extra ? 'checked' : ''}> Es un ingreso extra (prima, bono, trabajo suelto)</label>
        <label class="mov-check" id="regAbonoWrap" hidden><input type="checkbox" id="regAbono" ${previo?.abono ? 'checked' : ''}> Es un abono a la deuda</label>
        <label class="mov-check" id="regRecWrap"><input type="checkbox" id="regRec"> Se repite todos los meses</label>
      </div>

      <div id="regErr" class="auth-err"></div>
      <button class="wide btn-primary" id="regSave">${previo ? 'Actualizar' : 'Guardar'}</button>
    </div>`;

  const $ = (s) => overlay.querySelector(s);
  const itemEl = $('#regItem');
  const lineEl = $('#regLine');
  const notaEl = $('#regNota');
  const err = $('#regErr');
  let itemTocado = !!previo;

  /* F3 — el <option> nativo solo deja pintar el texto, así que el color va en el
     bullet de cada opción y, para el estado cerrado, en este punto de al lado. */
  function pintarPuntoItem() {
    const it = p.items.find((x) => x.id === itemEl.value);
    $('#regItemDot').style.background = it?.c || 'transparent';
  }

  function pintarRenglones() {
    const it = p.items.find((x) => x.id === itemEl.value);
    lineEl.innerHTML = `<option value="">Sin tipo de concepto</option>${(it?.L || [])
      .map((l) => `<option value="${l.id}" ${previo?.lineId === l.id ? 'selected' : ''}>${esc(l.n || 'sin nombre')}</option>`).join('')}`;
    pintarPuntoItem();
    pintarAbono();
  }

  function pintarAbono() {
    const it = p.items.find((x) => x.id === itemEl.value);
    const vale = tipo === 'gasto' && it?.r === 'deu' && !!lineEl.value;
    $('#regAbonoWrap').hidden = !vale;
    if (!vale) $('#regAbono').checked = false;
  }

  function setTipo(t) {
    tipo = t;
    overlay.querySelectorAll('#regTipo .chip').forEach((b) => b.classList.toggle('on', b.dataset.tipo === t));
    $('#regCatWrap').hidden = t === 'ingreso';
    $('#regGoal').closest('.fld').hidden = t === 'ingreso';
    $('#regExtraWrap').hidden = t === 'gasto';
    pintarAbono();
  }

  let guardando = false;
  async function guardar() {
    // pedir la tasa toma un viaje a la red: dos Enter seguidos creaban dos movimientos
    if (guardando) return;
    guardando = true;
    try {
      await guardarAhora();
    } finally {
      guardando = false;
    }
  }

  async function guardarAhora() {
    const cur = $('#regCur').value;
    const montoEscrito = digits($('#regMonto').value);
    if (montoEscrito <= 0) { err.textContent = 'Escribe el monto.'; return; }

    // el libro entero vive en la moneda del perfil: se convierte al guardar y
    // se recuerda en qué moneda lo escribiste
    let monto = montoEscrito;
    if (cur !== p.cur) {
      const t = await tasa(cur, p.cur);
      if (!t) { err.textContent = `No hay tasa de ${cur} a ${p.cur}. Prueba de nuevo con internet o registra en ${p.cur}.`; return; }
      monto = Math.round(montoEscrito * t);
    }

    const esRecurrente = $('#regRec').checked;
    const textoOriginal = notaEl.value;
    const catManual = !!$('#regCat').value;
    const datos = {
      fecha: $('#regFecha').value || hoyISO(),
      tipo,
      monto,
      montoOrig: cur === p.cur ? null : montoEscrito,
      curOrig: cur === p.cur ? null : cur,
      itemId: tipo === 'gasto' ? (itemEl.value || null) : null,
      lineId: tipo === 'gasto' ? (lineEl.value || null) : null,
      goalId: tipo === 'gasto' ? ($('#regGoal').value || null) : null,
      nota: notaEl.value.trim(),
      medio: $('#regMedio').value || null,
      extra: tipo === 'ingreso' && $('#regExtra').checked,
      abono: tipo === 'gasto' && !$('#regAbonoWrap').hidden && $('#regAbono').checked,
      cat: tipo === 'gasto' ? ($('#regCat').value || clasificarLista(notaEl.value).cat) : null,
    };

    const mov = previo || { id: nuevoId(), ...datos };
    if (previo) Object.assign(previo, datos);
    else p.movs.push(mov);
    if (esRecurrente) mov.recId = guardarRecurrente(datos);
    if (!catManual && datos.tipo === 'gasto' && datos.cat === 'otros' && textoOriginal.trim()) {
      afinarConIA(mov, textoOriginal, alGuardar);
    }
    store.save();
    cerrar();
    alGuardar(mov);

    if (datos.extra && !previo) anunciarExtra(datos);
  }

  function guardarRecurrente(datos) {
    const id = 'r' + Math.random().toString(36).slice(2, 9);
    p.recurrentes.push({
      id, tipo: datos.tipo, monto: datos.monto, itemId: datos.itemId, lineId: datos.lineId,
      goalId: datos.goalId, nota: datos.nota, abono: datos.abono, medio: datos.medio,
      cur: datos.curOrig, dia: Number(datos.fecha.slice(8, 10)),
    });
    toast('Guardado como recurrente. Cada mes lo agregas con un clic.');
    return id;
  }

  function anunciarExtra(datos) {
    const exc = excedente(datos.monto, 0);
    anuncio({
      titulo: 'Ingreso extra registrado',
      cuerpo: `Entraron ${money(datos.monto, p.cur)} de prima o ingreso extra. Sugerido: ${money(exc.metasYFondo, p.cur)} a metas y fondo, ${money(exc.libre, p.cur)} libre.`,
      urgente: false,
      acciones: [
        {
          label: 'Aplicar sugerencia',
          onClick: () => {
            let plata = exc.metasYFondo;
            for (const g of metasActivas(p)) {
              if (plata <= 0) break;
              if (g.t && (g.s || 0) < g.t) {
                const m = Math.min(plata, g.t - (g.s || 0));
                registrarAporteExtra(p, g, m, datos.fecha);
                plata -= m;
              } else if (!g.t) {
                registrarAporteExtra(p, g, plata, datos.fecha);
                plata = 0;
              }
            }
            store.save();
            alGuardar();
            toast(plata > 0
              ? `Sugerencia aplicada; quedaron ${money(plata, p.cur)} sin asignar.`
              : 'Sugerencia aplicada a las metas en orden.');
          },
        },
        {
          label: 'Repartir a mano',
          onClick: () => abrirSelectorExtra(p, exc.metasYFondo, datos.fecha, (total) => {
            alGuardar();
            toast(total > 0 ? `Repartiste ${money(total, p.cur)} entre tus metas.` : 'El ingreso extra quedó sin asignar.');
          }),
        },
        { label: 'Dejarlo sin asignar', onClick: () => {} },
      ],
    });
  }

  $('#regClose').onclick = cerrar;
  overlay.onclick = (e) => { if (e.target === overlay) cerrar(); };
  $('#regTipo').onclick = (e) => {
    const b = e.target.closest('.chip');
    if (b) setTipo(b.dataset.tipo);
  };
  itemEl.onchange = () => { itemTocado = true; pintarRenglones(); };
  lineEl.onchange = pintarAbono;
  // mientras escribes se propone el bloque que suele pagar eso, salvo que ya elegiste
  notaEl.oninput = () => {
    if (itemTocado || tipo !== 'gasto') return;
    const { cat, confianza } = clasificarLista(notaEl.value);
    if (!confianza) return;
    const destino = p.items.find((it) => it.r === CATEGORIA_A_ROL[cat]);
    if (destino && itemEl.value !== destino.id) { itemEl.value = destino.id; pintarRenglones(); }
  };
  $('#regMas').onclick = () => { const d = $('#regDetalle'); d.hidden = !d.hidden; };
  $('#regSave').onclick = guardar;
  overlay.querySelector('.sheet').onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardar(); }
  };

  if (previo?.itemId) itemEl.value = previo.itemId;
  pintarRenglones();
  if (previo?.lineId) { lineEl.value = previo.lineId; pintarAbono(); }
  setTipo(tipo);
  $('#regMonto').focus();
}
