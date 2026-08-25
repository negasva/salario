import * as store from '../store.js';
import { amount, r2 } from '../engine/reparto.js';
import { periodoDe, hoyISO, enPeriodo, porItem, ingresoReal, gastoTotal } from '../engine/movimientos.js';
import { money, plain, esc, digits, MESES } from '../format.js';
import { excedente } from '../engine/consejo.js';
import { ordenadas } from '../engine/fila.js';
import { pendientes, movDesde } from '../engine/recurrentes.js';
import { CATEGORIAS, CATEGORIA_A_ROL, clasificarLista, nombreCategoria } from '../engine/clasificar.js';
import { clasificarConIA } from '../ia.js';
import { anuncio } from './anuncio.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

function nombrePeriodo(per) {
  const [a, m] = per.split('-');
  return `${MESES[Number(m) - 1]} de ${a}`;
}

function correrMes(per, delta) {
  const [a, m] = per.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function diaLargo(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

function nuevoId() {
  return 'm' + Math.random().toString(36).slice(2, 9);
}

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

export function renderMovimientos(root, args = {}) {
  const p = store.active();
  let periodo = periodoDe(hoyISO());
  let tipo = 'gasto';
  let editId = null;

  root.innerHTML = `
    <div class="card mov-form">
      <div class="chips" id="mvTipo">
        <button class="chip on" data-tipo="gasto">Gasto</button>
        <button class="chip" data-tipo="ingreso">Ingreso</button>
      </div>
      <div class="mov-row">
        <input id="mvMonto" class="num" inputmode="numeric" placeholder="0" aria-label="Monto">
        <select id="mvItem" aria-label="Categoría">
          ${p.items.map((it) => `<option value="${it.id}">${esc(it.n)}</option>`).join('')}
        </select>
        <label class="mov-check" id="mvExtraWrap" hidden>
          <input type="checkbox" id="mvExtra"> es un ingreso extra (prima, bono, trabajo suelto)
        </label>
        <button id="mvSave" class="btn-primary">Guardar</button>
      </div>
      <button id="mvMas" class="mini mov-mas">Más detalle</button>
      <div class="mov-detalle" id="mvDetalle" hidden>
        <label class="fieldw"><span>Fecha</span><input type="date" id="mvFecha" value="${hoyISO()}"></label>
        <select id="mvLine" aria-label="Renglón"></select>
        <select id="mvGoal" aria-label="Meta"><option value="">Sin meta</option>
          ${p.goals.map((g) => `<option value="${g.id}">${esc(g.n)}</option>`).join('')}
        </select>
        <input id="mvNota" placeholder="Nota: qué compraste" aria-label="Nota">
        <select id="mvCat" aria-label="Categoría del gasto">
          <option value="">Categoría automática</option>
          ${CATEGORIAS.map((c) => `<option value="${c.id}">${c.n}</option>`).join('')}
        </select>
        <label class="mov-check" id="mvRecWrap">
          <input type="checkbox" id="mvRec"> Se repite todos los meses
        </label>
        <label class="mov-check" id="mvAbonoWrap" hidden>
          <input type="checkbox" id="mvAbono"> Es un abono a la deuda
        </label>
      </div>
    </div>

    <div class="mov-head">
      <button class="mini" id="mvPrev" aria-label="Mes anterior">←</button>
      <span class="label" id="mvPeriodo"></span>
      <button class="mini" id="mvNext" aria-label="Mes siguiente">→</button>
    </div>

    <div id="mvRecurrentes"></div>
    <div id="mvResumen"></div>
    <div id="mvLista"></div>`;

  const $ = (sel) => root.querySelector(sel);
  const montoEl = $('#mvMonto');
  const itemEl = $('#mvItem');
  const lineEl = $('#mvLine');
  const goalEl = $('#mvGoal');
  const notaEl = $('#mvNota');
  const fechaEl = $('#mvFecha');
  const extraEl = $('#mvExtra');
  const abonoEl = $('#mvAbono');
  const recEl = $('#mvRec');
  const catEl = $('#mvCat');
  let itemTocado = false;
  const saveEl = $('#mvSave');

  function pintarRenglones() {
    const it = p.items.find((x) => x.id === itemEl.value);
    lineEl.innerHTML = `<option value="">Sin renglón</option>${(it?.L || [])
      .map((l) => `<option value="${l.id}">${esc(l.n || 'sin nombre')}</option>`).join('')}`;
    pintarAbono();
  }

  // El abono solo tiene sentido en un gasto contra un renglón de un bloque de deuda
  function pintarAbono() {
    const it = p.items.find((x) => x.id === itemEl.value);
    const vale = tipo === 'gasto' && it?.r === 'deu' && !!lineEl.value;
    $('#mvAbonoWrap').hidden = !vale;
    if (!vale) abonoEl.checked = false;
  }

  function setTipo(t) {
    tipo = t;
    root.querySelectorAll('#mvTipo .chip').forEach((b) => b.classList.toggle('on', b.dataset.tipo === t));
    itemEl.hidden = t === 'ingreso';
    lineEl.hidden = t === 'ingreso';
    goalEl.hidden = t === 'ingreso';
    $('#mvExtraWrap').hidden = t === 'gasto';
    pintarAbono();
  }

  function limpiar() {
    editId = null;
    itemTocado = false;
    montoEl.value = '';
    notaEl.value = '';
    goalEl.value = '';
    lineEl.value = '';
    extraEl.checked = false;
    abonoEl.checked = false;
    recEl.checked = false;
    catEl.value = '';
    $('#mvAbonoWrap').hidden = true;
    saveEl.textContent = 'Guardar';
    montoEl.focus();
  }

  function guardar() {
    const monto = digits(montoEl.value);
    if (monto <= 0) { montoEl.focus(); return; }
    // se lee antes de limpiar el formulario, que apaga la casilla
    const esRecurrente = recEl.checked;
    const datos = {
      fecha: fechaEl.value || hoyISO(),
      tipo,
      monto,
      itemId: tipo === 'gasto' ? itemEl.value : null,
      lineId: tipo === 'gasto' ? (lineEl.value || null) : null,
      goalId: tipo === 'gasto' ? (goalEl.value || null) : null,
      nota: notaEl.value.trim(),
      extra: tipo === 'ingreso' && extraEl.checked,
      abono: tipo === 'gasto' && !$('#mvAbonoWrap').hidden && abonoEl.checked,
      cat: tipo === 'gasto' ? (catEl.value || clasificarLista(notaEl.value).cat) : null,
    };
    const previo = editId && p.movs.find((m) => m.id === editId);
    const textoOriginal = notaEl.value;
    const catManual = !!catEl.value;
    const mov = previo || { id: nuevoId(), ...datos };
    if (previo) Object.assign(previo, datos);
    else p.movs.push(mov);
    // el movimiento que estrena el recurrente ya cuenta como el de este mes
    if (esRecurrente) mov.recId = guardarRecurrente(datos);
    // lo que el diccionario no reconoce se le pregunta a la IA, si está puesta.
    // Llega después: el movimiento ya quedó guardado y la lista se repinta sola.
    if (!catManual && datos.tipo === 'gasto' && datos.cat === 'otros' && textoOriginal.trim()) {
      afinarConIA(mov, textoOriginal);
    }
    store.save();
    periodo = periodoDe(datos.fecha);
    limpiar();
    pintarCuerpo();

    if (datos.extra && !previo) {
      const exc = excedente(monto, 0);
      anuncio({
        titulo: 'Ingreso extra registrado',
        cuerpo: `Entraron ${money(monto, p.cur)} de prima o ingreso extra. Sugerido: ${money(exc.metasYFondo, p.cur)} a metas y fondo, ${money(exc.libre, p.cur)} libre.`,
        urgente: false,
        acciones: [
          {
            label: 'Aplicar sugerencia',
            onClick: () => {
              let plata = exc.metasYFondo;
              const activas = metasActivas(p);
              for (const g of activas) {
                if (plata <= 0) break;
                if (g.t && (g.s || 0) < g.t) {
                  const falta = g.t - (g.s || 0);
                  const m = Math.min(plata, falta);
                  registrarAporteExtra(p, g, m, datos.fecha);
                  plata -= m;
                } else if (!g.t) {
                  registrarAporteExtra(p, g, plata, datos.fecha);
                  plata = 0;
                }
              }
              store.save();
              pintarCuerpo();
              toast(plata > 0
                ? `Sugerencia aplicada; quedaron ${money(plata, p.cur)} sin asignar.`
                : 'Sugerencia aplicada a las metas en orden.');
            }
          },
          {
            label: 'Repartir a mano',
            onClick: () => abrirSelectorExtra(p, exc.metasYFondo, datos.fecha, (total) => {
              pintarCuerpo();
              toast(total > 0 ? `Repartiste ${money(total, p.cur)} entre tus metas.` : 'El ingreso extra quedó sin asignar.');
            }),
          },
          {
            label: 'Dejarlo sin asignar',
            onClick: () => {}
          }
        ]
      });
    }
  }

  /* Un recurrente es la plantilla, no el movimiento: guarda el día del mes y
     cada mes se agrega con un clic. Nada se crea solo. */
  function guardarRecurrente(datos) {
    const id = 'r' + Math.random().toString(36).slice(2, 9);
    p.recurrentes.push({
      id,
      tipo: datos.tipo, monto: datos.monto, itemId: datos.itemId, lineId: datos.lineId,
      goalId: datos.goalId, nota: datos.nota, abono: datos.abono,
      dia: Number(datos.fecha.slice(8, 10)),
    });
    store.save();
    toast('Guardado como recurrente. Cada mes lo agregas con un clic.');
    return id;
  }

  function nombreRecurrente(r) {
    if (r.nota) return r.nota;
    const it = p.items.find((x) => x.id === r.itemId);
    const l = it?.L?.find((x) => x.id === r.lineId);
    return l?.n || it?.n || (r.tipo === 'ingreso' ? 'Ingreso' : 'Gasto');
  }

  function pintarRecurrentes() {
    const box = $('#mvRecurrentes');
    if (!p.recurrentes.length) { box.innerHTML = ''; return; }
    const faltan = pendientes(p.recurrentes, p.movs, periodo);
    box.innerHTML = `<div class="card" style="margin-bottom:var(--sp-4)">
      <div class="spark-head">
        <span class="label">Se repiten cada mes</span>
        ${faltan.length > 1 ? '<button class="mini" id="mvRecTodos">Agregar los que faltan</button>' : ''}
      </div>
      <div class="rec-list">
        ${p.recurrentes.map((r) => {
          const falta = faltan.some((x) => x.id === r.id);
          return `<div class="rec-item">
            <span class="nm">${icon('recurrente', 'ic-sm')} ${esc(nombreRecurrente(r))}</span>
            <span class="sub">día ${r.dia}</span>
            <span class="num">${money(r.monto, p.cur)}</span>
            ${falta
              ? `<button class="mini rec-add" data-r="${r.id}">Agregar a ${nombrePeriodo(periodo).split(' de ')[0]}</button>`
              : '<span class="badge ok">ya está</span>'}
            <button class="mini rec-del" data-r="${r.id}" aria-label="Quitar recurrente">${icon('cerrar', 'ic-sm')}</button>
          </div>`;
        }).join('')}
      </div>
    </div>`;

    const agregar = (rec) => p.movs.push(movDesde(rec, periodo, nuevoId()));
    box.querySelectorAll('.rec-add').forEach((b) => {
      b.onclick = () => {
        agregar(p.recurrentes.find((r) => r.id === b.dataset.r));
        store.save();
        pintarCuerpo();
      };
    });
    const todos = box.querySelector('#mvRecTodos');
    if (todos) todos.onclick = () => {
      pendientes(p.recurrentes, p.movs, periodo).forEach(agregar);
      store.save();
      pintarCuerpo();
      toast('Listo, los recurrentes del mes quedaron registrados.');
    };
    box.querySelectorAll('.rec-del').forEach((b) => {
      b.onclick = () => {
        const i = p.recurrentes.findIndex((r) => r.id === b.dataset.r);
        const [fuera] = p.recurrentes.splice(i, 1);
        store.save();
        pintarCuerpo();
        toast('Recurrente quitado', () => {
          p.recurrentes.splice(i, 0, fuera);
          store.save();
          pintarCuerpo();
        });
      };
    });
  }

  async function afinarConIA(mov, texto) {
    const [r] = (await clasificarConIA([texto])) || [];
    const valida = r && CATEGORIAS.some((c) => c.id === r.cat);
    if (!valida || r.cat === mov.cat) return;
    mov.cat = r.cat;
    store.save();
    pintarCuerpo();
    toast(`Lo puse en ${nombreCategoria(r.cat)}`);
  }

  function editar(m) {
    editId = m.id;
    setTipo(m.tipo);
    montoEl.value = plain(m.monto, p.cur);
    fechaEl.value = m.fecha;
    if (m.itemId) { itemEl.value = m.itemId; pintarRenglones(); lineEl.value = m.lineId || ''; }
    goalEl.value = m.goalId || '';
    notaEl.value = m.nota || '';
    extraEl.checked = !!m.extra;
    catEl.value = m.cat || '';
    pintarAbono();
    abonoEl.checked = !!m.abono;
    $('#mvDetalle').hidden = false;
    saveEl.textContent = 'Actualizar';
    montoEl.focus();
  }

  function pintarCuerpo() {
    $('#mvPeriodo').textContent = nombrePeriodo(periodo);
    pintarRecurrentes();
    const inc = store.incomeRepartir(p);
    const gastado = porItem(p.movs, periodo);
    const ing = ingresoReal(p.movs, periodo);
    const total = gastoTotal(p.movs, periodo);

    $('#mvResumen').innerHTML = `
      <div class="card" style="margin-bottom:var(--sp-4)">
        <span class="label">Gastado este mes</span>
        <div class="kpi num">${money(total, p.cur)}</div>
        <div class="sub">${ing.total > 0
          ? `<div>Nómina: <b class="num">${money(ing.nomina, p.cur)}</b></div>
             ${ing.extra > 0 ? `<div style="margin-top:4px">Ingreso extra: <b class="num">${money(ing.extra, p.cur)}</b></div>` : ''}`
          : 'Sin ingresos registrados todavía este mes.'}</div>
      </div>
      <div class="card" style="margin-bottom:var(--sp-4)">
        <span class="label">Presupuesto contra real</span>
        <div class="hist-list">
          ${p.items.map((it) => {
            const pres = amount(it);
            const real = gastado[it.id] || 0;
            const pct = pres > 0 ? Math.min(100, (real / pres) * 100) : (real > 0 ? 100 : 0);
            const pasado = real > pres;
            const dif = Math.abs(r2(pres - real));
            return `<div class="mov-res">
              <span class="dot" style="background:${it.c}"></span>
              <span class="nm" title="${esc(it.n)}">${esc(it.n)}</span>
              <span class="hist-track"><i style="width:${pct}%;background:${pasado ? 'var(--danger)' : it.c}"></i></span>
              <span class="mov-res-n num">${money(real, p.cur)} <span class="sub">de ${money(pres, p.cur)}</span></span>
              <span class="mov-res-d num ${pasado ? 'over' : ''}">${pasado ? `+${money(dif, p.cur)}` : money(dif, p.cur)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;

    let delMes = enPeriodo(p.movs, periodo).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
    if (args.lineId) delMes = delMes.filter((m) => m.lineId === args.lineId);

    const lista = $('#mvLista');
    if (!delMes.length) {
      lista.innerHTML = '<div class="card"><div class="empty">' + (args.lineId ? 'Sin movimientos para este renglón en este mes.' : 'Sin movimientos en este mes.') + '</div></div>';
      return;
    }

    const dias = [...new Set(delMes.map((m) => m.fecha))];
    lista.innerHTML = dias.map((f) => `
      <div class="card mov-dia">
        <span class="label">${diaLargo(f)}</span>
        ${delMes.filter((m) => m.fecha === f).map((m) => {
          const it = p.items.find((x) => x.id === m.itemId);
          const g = p.goals.find((x) => x.id === m.goalId);
          const etiqueta = m.tipo === 'ingreso' ? (m.extra ? 'Ingreso extra' : 'Ingreso') : (it?.n || 'sin categoría');
          return `<div class="mov-line" data-id="${m.id}">
            <span class="dot" style="background:${m.tipo === 'ingreso' ? 'var(--success)' : (it?.c || 'var(--line)')}"></span>
            <span class="mov-line-txt">
              <b>${esc(etiqueta)}</b>${g ? ` <span class="badge warn">${esc(g.n)}</span>` : ''}${m.abono ? ' <span class="badge">abono</span>' : ''}${m.recId ? ` <span class="badge">${icon('recurrente', 'ic-sm')} cada mes</span>` : ''}${m.cat && m.cat !== 'otros' ? ` <span class="badge">${icon(CATEGORIAS.find((c) => c.id === m.cat)?.ic || 'etiqueta', 'ic-sm')} ${esc(nombreCategoria(m.cat))}</span>` : ''}
              ${m.nota ? `<span class="sub">${esc(m.nota)}</span>` : ''}
            </span>
            <span class="num mov-line-n ${m.tipo === 'ingreso' ? 'in' : ''}">${m.tipo === 'ingreso' ? '+' : '−'}${money(m.monto, p.cur)}</span>
            <button class="mini mov-ed">Editar</button>
            <button class="mini mov-del">${icon('cerrar', 'ic-sm')}</button>
          </div>`;
        }).join('')}
      </div>`).join('');

    lista.querySelectorAll('.mov-line').forEach((el) => {
      const m = p.movs.find((x) => x.id === el.dataset.id);
      if (!m) return;
      el.querySelector('.mov-ed').onclick = () => editar(m);
      el.querySelector('.mov-del').onclick = () => {
        const idx = p.movs.indexOf(m);
        const { undo } = store.stageDelete(() => p.movs.splice(idx, 1), () => p.movs.splice(idx, 0, m));
        if (editId === m.id) limpiar();
        pintarCuerpo();
        toast('Movimiento eliminado', () => { undo(); pintarCuerpo(); });
      };
    });
  }

  root.querySelector('#mvTipo').onclick = (e) => {
    const b = e.target.closest('.chip');
    if (b) setTipo(b.dataset.tipo);
  };
  itemEl.onchange = () => { itemTocado = true; pintarRenglones(); };
  /* Mientras el usuario escribe la nota se propone el bloque que suele pagar
     esa categoría. Si él ya eligió uno a mano, no se le mueve nada. */
  notaEl.oninput = () => {
    if (itemTocado || tipo !== 'gasto') return;
    const { cat, confianza } = clasificarLista(notaEl.value);
    if (!confianza) return;
    const rol = CATEGORIA_A_ROL[cat];
    const destino = p.items.find((it) => it.r === rol);
    if (destino && itemEl.value !== destino.id) {
      itemEl.value = destino.id;
      pintarRenglones();
    }
  };
  lineEl.onchange = pintarAbono;
  saveEl.onclick = guardar;
  // Enter guarda y limpia sin soltar el foco: sirve para meter varios seguidos
  root.querySelector('.mov-form').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); guardar(); } };
  $('#mvMas').onclick = () => { const d = $('#mvDetalle'); d.hidden = !d.hidden; };
  $('#mvPrev').onclick = () => { periodo = correrMes(periodo, -1); pintarCuerpo(); };
  $('#mvNext').onclick = () => { periodo = correrMes(periodo, 1); pintarCuerpo(); };

  pintarRenglones();
  setTipo('gasto');
  pintarCuerpo();
  montoEl.focus();
}
