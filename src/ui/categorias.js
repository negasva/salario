import * as store from '../store.js';
import { balance, amount, r2 } from '../engine/reparto.js';
import { periodoDe, hoyISO, porLinea, ingresoReal, resumenFlujo, enPeriodo } from '../engine/movimientos.js';
import { monthsToGoal, monthlyToward, plazo, whenText } from '../engine/metas.js';
import { ordenadas, estadoDe } from '../engine/fila.js';
import { money, plain, esc, digits, MESES } from '../format.js';
import { resumenItem, agregarPago, pagosDeLinea, quitarPago, arrastreDe, planDeLinea,
  pasarAlSiguiente, quitarArrastre, siguientePeriodo, mesAnterior, agregarPagoLibre,
  pagosLibresDeItem, quitarMovsDe, estadoLinea, pctPagado } from '../engine/pagos.js';
import { icon } from './icons.js';
import { abrirModal } from './modal.js';
import { toast } from './shell.js';
import { abrirSelectorExtra } from './registrar.js';
import { tarjetaResumenFlujo } from './resumen.js';

const { PALETTE } = store;

export function renderCategorias(root) {
  const p = store.active();

  root.innerHTML = `
    <div class="vista-head">
      <h2>Planear</h2>
      <span class="sub">Cuánto piensas gastar cada mes en cada cosa. Lo que de verdad pasó se registra en Registrar.</span>
    </div>
    <div id="catDesfase"></div>
    <div id="catIngreso"></div>
    <div class="cats-head">
      <button id="catAdd" class="wide btn-primary">+ Agregar categoría</button>
      <button id="catEqual">Mandar lo que falta a ahorros</button>
    </div>
    <div id="catList"></div>`;

  root.querySelector('#catAdd').onclick = () => openNewCategory(root);
  root.querySelector('#catEqual').onclick = () => {
    const b = balance(p.items, store.incomeRepartir(p), p.goals);
    if (!(b.falta > 0)) { toast('Ya está todo repartido'); return; }
    abrirSelectorExtra(p, b.falta, hoyISO(), (t) => {
      renderCategorias(root);
      toast(t > 0 ? `Mandaste ${money(t, p.cur)} a tus metas.` : 'Nada quedó asignado.');
    });
  };

  paintList(root);
  paintIngreso(root);
  paintDesfases(root);
}

/* F7 — en la vista de planeación se dice en la cara dónde te estás pasando:
   la categoría que ya gastó más de lo asignado, con cuánto. */
function paintDesfases(root) {
  const p = store.active();
  const periodo = periodoDe(hoyISO());
  const gastadoLinea = porLinea(p.movs, periodo);
  const pasados = p.items.map((it) => {
    const res = resumenItem(it, gastadoLinea, periodo,
      pagosLibresDeItem(p.movs, it.id, periodo).reduce((s, m) => s + m.monto, 0));
    return { it, exceso: r2(res.pagado - amount(it)) };
  }).filter((x) => amount(x.it) > 0 && x.exceso > 0);

  const box = root.querySelector('#catDesfase');
  if (!pasados.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="card card-desfase">
    <span class="label">Te estás pasando en ${pasados.length} categoría${pasados.length > 1 ? 's' : ''}</span>
    <div class="sub">${pasados.map(({ it, exceso }) => `<b>${esc(it.n)}</b> ${money(exceso, p.cur)} de más`).join(' · ')}</div>
  </div>`;
}

/* Arriba de todo, la cuenta del mes: cuánto entra, cuánto tienes repartido y
   la diferencia con nombre y apellido. Si falta plata por repartir dice cuánta;
   si asignaste más de lo que entra, por cuánto te pasaste. */
function paintIngreso(root) {
  const p = store.active();
  const periodo = periodoDe(hoyISO());
  const ing = ingresoReal(p.movs, periodo);
  const flujo = resumenFlujo(p.movs, periodo);
  const box = root.querySelector('#catIngreso');
  const base = store.incomeRepartir(p);
  /* Lo repartible aparte no es solo el ingreso marcado como extra: cualquier
     peso que entre por encima del plan también está sin dueño hasta que lo
     mandes a una meta. Un ingreso sin marcar contaba como nada y esa era la
     puerta por la que se perdía. */
  const sobrante = Math.max(0, ing.total - p.inc);
  const sinRepartir = Math.max(0, sobrante - aportadoEsteMes(p, periodo));

  box.innerHTML = `${tarjetaResumenFlujo(flujo, p.cur)}<div class="card" style="margin-bottom:var(--space-5)">
    <span class="label">Lo que repartes este mes</span>
    <div class="kpi num">${money(base, p.cur)}</div>
    <div class="prow">
      ${sinRepartir > 0 ? '<button id="catExtra" class="btn-primary">Repartir entre mis metas</button>' : ''}
      ${ing.total > 0 && ing.total !== p.inc ? '<button id="catPlan">Dejar este ingreso como plan</button>' : ''}
    </div>
  </div>`;

  const bExtra = box.querySelector('#catExtra');
  if (bExtra) bExtra.onclick = () => abrirSelectorExtra(p, sinRepartir, hoyISO(), (t) => {
    renderCategorias(root);
    toast(t > 0 ? `Repartiste ${money(t, p.cur)} entre tus metas.` : 'El ingreso extra quedó sin asignar.');
  });
  const bPlan = box.querySelector('#catPlan');
  if (bPlan) bPlan.onclick = () => { p.inc = ing.total; store.save(); renderCategorias(root); };
}

// lo del extra que ya salió hacia metas este mes
function aportadoEsteMes(p, periodo) {
  return enPeriodo(p.movs, periodo)
    .filter((m) => m.tipo === 'gasto' && m.goalId)
    .reduce((s, m) => s + m.monto, 0);
}

function paintList(root) {
  const p = store.active();
  const box = root.querySelector('#catList');
  const periodo = periodoDe(hoyISO());
  const gastadoLinea = porLinea(p.movs, periodo);
  const metas = ordenadas(p.goals).filter((g) => estadoDe(g) !== 'completa');
  box.innerHTML = p.items.map((it) => catCard(it, p, gastadoLinea, periodo)).join('')
    + metas.map((g) => metaCard(g, p)).join('');

  p.items.forEach((it) => wireCard(root, it, p));
  metas.forEach((g) => wireMeta(root, g, p));
}

/* El aporte es un movimiento y nada más: el progreso de la meta se recalcula
   solo al guardar, así que no hay dos sitios que mantener a la par. */
function wireMeta(root, g, p) {
  const card = root.querySelector(`.cat-meta[data-gid="${g.id}"]`);
  if (!card) return;

  card.querySelector('.meta-mes').onchange = (e) => {
    g.mes = digits(e.target.value);
    store.save();
    renderCategorias(root);
  };

  card.querySelector('.meta-abrir').onclick = () =>
    window.dispatchEvent(new CustomEvent('ir-a-meta', { detail: { goalId: g.id } }));

  card.querySelector('.meta-guardar')?.addEventListener('click', () => {
    const monto = monthlyToward(g);
    p.movs.push({ id: 'm' + Math.random().toString(36).slice(2, 9), fecha: hoyISO(), tipo: 'gasto',
      monto, itemId: null, lineId: null, goalId: g.id, nota: `Aporte a ${g.n}`, extra: false });
    store.save();
    renderCategorias(root);
    toast(`${money(monto, p.cur)} a ${g.n}`);
  });

  card.querySelector('.meta-deshacer')?.addEventListener('click', () => {
    const mov = aporteDelMes(p, g.id);
    if (mov) p.movs.splice(p.movs.indexOf(mov), 1);
    store.save();
    renderCategorias(root);
    toast('Aporte deshecho');
  });
}

/* F11 — la categoría es un bloque como sus ítems, pero con su propio color:
   colapsada solo dice nombre, cifras y editar. El resto va al pop-up. */
function catCard(it, p, gastadoLinea, periodo) {
  const pagosLibres = pagosLibresDeItem(p.movs, it.id, periodo);
  const res = resumenItem(it, gastadoLinea, periodo,
    pagosLibres.reduce((s, m) => s + m.monto, 0));
  const budget = amount(it);
  const estado = estadoLinea(res.pagado, budget, false);
  return `
  <div class="cat-card${it.locked ? ' locked' : ''}" data-id="${it.id}">
    <div class="bloque bloque-cat est-${estado}" style="--pct:${pctPagado(res.pagado, budget)}%">
      <span class="dot" style="background:${it.c}"></span>
      <span class="bloque-n">${esc(it.n)}
        ${estado === 'pagado' ? `<span class="bloque-check" title="pagado">${icon('check', 'ic-sm')}</span>` : ''}
        ${it.locked ? `<span title="bloqueada">${icon('candado', 'ic-sm')}</span>` : ''}</span>
      <button class="bloque-ed cat-plus-head" aria-label="Agregar concepto a ${esc(it.n)}">+</button>
      <b class="bloque-m num">${money(budget, p.cur)}</b>
      <button class="bloque-ed" aria-label="Editar ${esc(it.n)}">${icon('lapiz', 'ic-sm')}</button>
      <span class="bloque-cifras">Pagado <b class="num">${money(res.pagado, p.cur)}</b>
        ${res.total ? ` · ${res.cerradas} de ${res.total} al día` : ''}
        ${estado === 'excedido' ? ` · <b class="num over">desfase ${money(r2(res.pagado - budget), p.cur)}</b>` : ''}</span>
    </div>
    <div class="cat-items">
      <div class="lines">${lines(it, p, res)}</div>
      ${tablaPagos(pagosLibres, p)}
      <div class="cat-acciones">
        <button class="mini cat-plus">+ Concepto</button>
        <button class="mini cat-pago-libre" title="Agregar un pago sin concepto">Agregar pago</button>
      </div>
    </div>
  </div>`;
}

/* El pop-up de la categoría: el mismo componente modal que usan los ítems. */
function abrirCatSheet(root, it, p) {
  const { cuerpo, cerrar } = abrirModal({ titulo: 'Categoría', alCerrar: () => renderCategorias(root) });

  const guardar = () => { store.save(); pintar(); };

  function setMonto(v) {
    if (it.locked) { toast('Desbloquea la categoría para cambiarle el monto'); return; }
    it.m = Math.max(0, Math.round(v));
    guardar();
  }

  function pintar() {
    const periodo = periodoDe(hoyISO());
    const res = resumenItem(it, porLinea(p.movs, periodo), periodo,
      pagosLibresDeItem(p.movs, it.id, periodo).reduce((s, m) => s + m.monto, 0));
    const budget = amount(it);
    const b = balance(p.items, store.incomeRepartir(p), p.goals);
    const desajuste = !it.auto && res.costo > 0 && Math.abs(res.costo - budget) >= 1;

    cuerpo.innerHTML = `
      <div class="fieldw"><span>Nombre</span><input class="cs-n" value="${esc(it.n)}" ${it.locked ? 'disabled' : ''}></div>
      <div class="fieldw money-field"><span>${it.auto ? 'Cuesta al mes' : 'Asignas al mes'} · ${p.cur}</span>
        <span class="money-symbol" aria-hidden="true">$</span>
        <input class="cs-m num" type="text" inputmode="numeric" value="${plain(budget, p.cur)}"
          ${it.locked || it.auto ? 'disabled' : ''}></div>
      <div class="chips cs-modo">
        <button class="chip ${it.auto ? '' : 'on'}" data-auto="0" ${it.locked ? 'disabled' : ''}>A mano</button>
        <button class="chip ${it.auto ? 'on' : ''}" data-auto="1" ${it.locked ? 'disabled' : ''}
          title="El monto sale de sus conceptos, corregido con lo que de verdad pagaste">Automático</button>
      </div>
      ${cabeceraPagos(res, p, budget)}
      ${it.auto ? `<div class="sub">${explicacionAuto(res, p)}</div>` : ''}
      ${desajuste ? `<button class="mini cs-ajustar" title="Suma sus conceptos y le resta lo que ahorraste y le suma lo que se pasó, en los renglones que ya pagaste">Igualar a lo que cuesta (${money(res.costo, p.cur)})</button>` : ''}
      ${!it.locked && !it.auto && !b.cuadrado
        ? `<button class="wide mini cs-fix">${b.falta > 0
            ? `Sumar aquí los ${money(b.falta, p.cur)} que faltan`
            : `Quitar de aquí los ${money(b.exceso, p.cur)} de más`}</button>`
        : ''}
      <div class="label">Color</div>
      <div class="cs-colores">${PALETTE.map((c) => `<button class="cs-color${c === it.c ? ' on' : ''}"
        data-c="${c}" style="background:${c}" aria-label="Color ${c}" aria-pressed="${c === it.c}"></button>`).join('')}</div>
      <button class="wide mini cs-lock ${it.locked ? 'on' : ''}" aria-pressed="${!!it.locked}">
        ${icon('candado', 'ic-sm')} ${it.locked ? 'Desbloquear categoría' : 'Bloquear categoría'}</button>
      <button class="wide cs-del danger-action">Borrar categoría</button>`;

    cuerpo.querySelector('.cs-n').onchange = (e) => { it.n = e.target.value; guardar(); };
    cuerpo.querySelector('.cs-m').onchange = (e) => setMonto(digits(e.target.value));
    cuerpo.querySelector('.cs-ajustar')?.addEventListener('click', () => setMonto(res.costo));
    cuerpo.querySelector('.cs-fix')?.addEventListener('click', () => setMonto(budget + b.dif));

    cuerpo.querySelector('.cs-modo').onclick = (e) => {
      const btn = e.target.closest('.chip');
      if (!btn || btn.disabled) return;
      it.auto = btn.dataset.auto === '1';
      guardar();
      toast(it.auto ? 'Esta categoría ya se calcula sola' : 'Ahora le pones el monto tú');
    };

    cuerpo.querySelector('.cs-colores').onclick = (e) => {
      const btn = e.target.closest('.cs-color');
      if (!btn) return;
      it.c = btn.dataset.c;
      guardar();
    };

    cuerpo.querySelector('.cs-lock').onclick = () => { it.locked = !it.locked; guardar(); };

    cuerpo.querySelector('.cs-del').onclick = () => {
      if (p.items.length < 2) { toast('Deja al menos una categoría'); return; }
      if (it.locked) { toast('Desbloquea la categoría antes de borrarla'); return; }
      const idx = p.items.indexOf(it);
      let pagos = [];
      const { undo } = store.stageDelete(
        () => { p.items.splice(idx, 1); pagos = quitarMovsDe(p.movs, 'itemId', it.id); },
        () => { p.items.splice(idx, 0, it); p.movs.push(...pagos); }
      );
      cerrar();
      toast(`"${it.n}" eliminada`, () => { undo(); renderCategorias(root); });
    };
  }

  pintar();
}

/* F5 — cada meta es un bloque más del reparto: mismo tamaño, misma tarjeta,
   con su monto mensual editable y el botón para registrar el aporte del mes. */
function metaCard(g, p) {
  const ap = aporteDelMes(p, g.id);
  const mes = monthlyToward(g);
  const n = monthsToGoal(g);
  const pct = g.t > 0 ? Math.min(100, Math.round(((g.s || 0) / g.t) * 100)) : 0;
  return `
  <div class="card cat-card cat-meta" data-gid="${g.id}">
    <div class="cat-top">
      <span class="dot" style="background:var(--warning)"></span>
      <span class="cat-name-fijo">${esc(g.n)}${g.special ? ' <span class="badge warn">fondo</span>' : ''}</span>
      <button class="mini meta-abrir">Editar</button>
    </div>
    <div class="cat-fields">
      <label class="fieldw money-field"><span>Guardas al mes · ${p.cur}</span>
        <span class="money-symbol" aria-hidden="true">$</span>
        <input class="meta-mes num" type="text" inputmode="numeric" value="${mes ? plain(mes, p.cur) : ''}" placeholder="0"></label>
    </div>
    <div class="hist-track"><i style="width:${pct}%;background:var(--warning)"></i></div>
    <div class="sub">Llevas <b class="num">${money(g.s || 0, p.cur)}</b> de ${money(g.t, p.cur)}.
      ${n ? `La tienes en ${plazo(n)}, hacia ${whenText(n)}.` : 'Sin aporte mensual todavía.'}</div>
    <div class="prow">
      ${ap
        ? `<button class="mini meta-deshacer">${icon('check', 'ic-sm')} Guardado el ${diaCorto(ap.fecha)}</button>`
        : `<button class="mini meta-guardar" ${mes > 0 ? '' : 'disabled'}>Ya lo guardé</button>`}
    </div>
  </div>`;
}

// Un aporte del mes en curso a esta meta, si existe
function aporteDelMes(p, goalId) {
  const per = periodoDe(hoyISO());
  return p.movs.find((m) => m.goalId === goalId && periodoDe(m.fecha) === per);
}

function diaCorto(fecha) {
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} de ${MESES[m - 1]}`;
}

/* En automático el monto no se teclea, así que la tarjeta tiene que decir de
   dónde salió: el plan de los conceptos, menos lo ahorrado y más lo que se
   pasó en los renglones que ya cerraron. */
function explicacionAuto(res, p) {
  if (!res.total) return 'Automático: agrega conceptos abajo y el monto sale solo.';
  const base = `Sale de sus conceptos: <b class="num">${money(res.plan, p.cur)}</b> planeados`;
  if (!res.cerradas) {
    return `${base}. Cuando pagues alguno, se ajusta con lo que de verdad te costó.`;
  }
  const cuales = res.cerradas === 1 ? 'el renglón que ya pagaste' : `los ${res.cerradas} que ya pagaste`;
  const ajustes = [
    res.ahorrado > 0 ? `menos <b class="num">${money(res.ahorrado, p.cur)}</b> que ahorraste` : '',
    res.excedido > 0 ? `más <b class="num">${money(res.excedido, p.cur)}</b> que se pasaron` : '',
  ].filter(Boolean).join(' y ');
  return ajustes
    ? `${base}, ${ajustes} en ${cuales}.`
    : `${base}. ${res.cerradas === 1 ? 'El que ya pagaste quedó' : `Los ${res.cerradas} que ya pagaste quedaron`} clavado al plan.`;
}

/* Encabezado de la categoría: el plan es la asignación mensual que define el
   usuario; los conceptos sirven para desglosarla, no para reemplazarla. */
function cabeceraPagos(res, p, planeado) {
  const diferencia = r2(planeado - res.pagado);
  const ahorro = diferencia >= 0;
  return `<div class="pagos-head">
    <div class="ph-cifra"><span class="label" title="La asignación mensual que esperas gastar">Total planeado</span><b class="num">${money(planeado, p.cur)}</b></div>
    <div class="ph-cifra"><span class="label">Pagado</span><b class="num">${money(res.pagado, p.cur)}</b></div>
    ${planeado > 0 ? `<div class="ph-cifra"><span class="label">${ahorro ? 'Ahorro' : 'Exceso'}</span>
      <b class="num ${ahorro ? 'ok' : 'over'}">${money(Math.abs(diferencia), p.cur)}</b></div>` : ''}
    ${res.total ? `<span class="badge ${res.cerradas === res.total ? 'ok' : ''}">${res.cerradas} de ${res.total} al día</span>` : ''}
  </div>`;
}


/* Cada compra queda a la vista y se borra sola: corregir un pago mal tecleado
   es quitar esa transacción, no recalcular un total a mano. */
function listaPagos(l, p, periodo) {
  return tablaPagos(pagosDeLinea(p.movs, l.id, periodo), p, `data-lid="${l.id}"`);
}

function tablaPagos(pagos, p, attrs = '') {
  if (!pagos.length) return '';
  return `<div class="pagos-tabla" ${attrs}>
    <div class="pago-row pago-head"><span>Monto</span><span>Fecha</span><span>Nota</span><span></span></div>
    ${pagos.map((m) => pagoFila(m, p)).join('')}
  </div>`;
}

function pagoFila(m, p) {
  return `<div class="pago-row" data-mid="${m.id}">
    <b class="num">${money(m.monto, p.cur)}</b>
    <span class="sub">${diaCorto(m.fecha)}</span>
    <span class="sub pago-nota">${!m.lineId && m.nota ? esc(m.nota) : ''}</span>
    <span class="pago-acciones">
      <button class="pago-ed" title="Editar pago" aria-label="Editar pago">⋮</button>
      <button class="pago-x" title="Quitar este pago" aria-label="Quitar pago de ${money(m.monto, p.cur)}">${icon('cerrar', 'ic-sm')}</button>
    </span>
  </div>`;
}

function openPagoEditor(it, p, mov = null, repintar) {
  const line = mov?.lineId ? it.L.find((l) => l.id === mov.lineId) : null;
  const { cuerpo, cerrar } = abrirModal({ titulo: mov ? 'Editar pago' : 'Agregar pago' });
  cuerpo.innerHTML = `
      <div class="pago-form">
        <label class="fieldw"><span>Nombre</span><input id="pagoNombre" value="${esc(mov?.nota || line?.n || '')}" placeholder="Ej. almuerzo"></label>
        <label class="fieldw money-field"><span>Monto</span><span class="money-symbol" aria-hidden="true">$</span><input id="pagoMonto" class="num" inputmode="numeric" value="${mov ? plain(mov.monto, p.cur) : ''}" placeholder="0"></label>
        <label class="fieldw"><span>Fecha</span><input id="pagoFecha" type="date" value="${mov?.fecha || hoyISO()}"></label>
      </div>
      <button class="wide btn-primary" id="pagoSave">${mov ? 'Guardar cambios' : 'Guardar pago'}</button>
      <button class="wide" id="pagoCancel">Cancelar</button>`;

  cuerpo.querySelector('#pagoCancel').onclick = cerrar;
  cuerpo.querySelector('#pagoSave').onclick = () => {
    const monto = digits(cuerpo.querySelector('#pagoMonto').value);
    if (monto <= 0) {
      cuerpo.querySelector('#pagoMonto').focus();
      return;
    }
    const datos = {
      fecha: cuerpo.querySelector('#pagoFecha').value || hoyISO(),
      monto,
      nota: cuerpo.querySelector('#pagoNombre').value.trim() || (line?.n || 'Pago'),
    };
    if (mov) Object.assign(mov, datos);
    else agregarPagoLibre(p.movs, it, datos.monto, datos.fecha, datos.nota);
    store.save();
    cerrar();
    repintar();
    toast(mov ? 'Pago actualizado' : 'Pago guardado');
  };
}

/* F10 — cada concepto es un solo bloque: nombre, monto y editar. El bloque ES
   la barra de progreso —el relleno va detrás del texto— y todo lo demás
   (pagos, toggles, arrastre, borrar) vive en el pop-up. */
function lines(it, p, res) {
  if (!res.total) return '<div class="empty">Sin nada en la lista.</div>';
  return res.filas.map((f) => bloqueItem(f, p)).join('');
}

function bloqueItem({ l, plan, pagado, estado }, p) {
  return `
    <div class="bloque bloque-item est-${estado}" data-lid="${l.id}" style="--pct:${pctPagado(pagado, plan)}%">
      <span class="bloque-pct num">${pctPagado(pagado, plan)}%</span>
      <span class="bloque-n">${esc(l.n || 'Sin nombre')}${estado === 'pagado'
        ? `<span class="bloque-check" title="pagado">${icon('check', 'ic-sm')}</span>` : ''}</span>
      <b class="bloque-m num">${money(plan, p.cur)}</b>
      <button class="bloque-ed" aria-label="Editar ${esc(l.n || 'concepto')}">${icon('lapiz', 'ic-sm')}</button>
    </div>`;
}

/* El pop-up del concepto: todo lo que antes colgaba de la tarjeta. Se repinta
   solo tras cada cambio y la lista de atrás se refresca al cerrar. */
function abrirItemSheet(root, it, l, p) {
  const { cuerpo, cerrar } = abrirModal({ titulo: 'Concepto', alCerrar: () => renderCategorias(root) });

  const guardar = () => { store.save(); pintar(); };

  function pintar() {
    const periodo = periodoDe(hoyISO());
    const plan = planDeLinea(l, periodo);
    const pagado = r2(porLinea(p.movs, periodo)[l.id] || 0);
    const pendiente = Math.max(0, r2(plan - pagado));
    const estado = estadoLinea(pagado, plan, l.pagadoEn === periodo);

    cuerpo.innerHTML = `
      <div class="fieldw"><span>Nombre</span><input class="is-n" value="${esc(l.n)}" placeholder="Concepto"></div>
      <div class="fieldw money-field"><span>Monto planeado · ${p.cur}</span>
        <span class="money-symbol" aria-hidden="true">$</span>
        <input class="is-v num" type="text" inputmode="numeric" value="${l.v ? plain(l.v, p.cur) : ''}" placeholder="0"></div>
      ${filaEstado(estado, r2(plan - pagado), plan, p)}
      ${barraGasto(pagado, plan, p)}
      <div class="line-pago">
        <label class="fieldw money-field"><span>Agregar pago</span><span class="money-symbol" aria-hidden="true">$</span>
          <input class="is-pago num" inputmode="numeric" placeholder="0"></label>
        <label class="fieldw"><span>Fecha</span><input class="is-fecha" type="date" value="${hoyISO()}"></label>
        <button class="mini is-pago-add" title="Sumar este pago al concepto">+</button>
      </div>
      ${listaPagos(l, p, periodo)}
      <div class="line-pago">
        <button class="mini lcerrar is-cerrar ${l.pagadoEn === periodo ? 'on' : ''}"
          aria-pressed="${l.pagadoEn === periodo}">${icon('check', 'ic-sm')} Pagado por completo</button>
      </div>
      ${filaArrastre(l, p, periodo, arrastreDe(l, periodo), pendiente, plan)}
      <button class="wide is-del danger-action">Borrar concepto</button>`;

    cuerpo.querySelector('.is-n').onchange = (e) => { l.n = e.target.value; guardar(); };
    cuerpo.querySelector('.is-v').onchange = (e) => { l.v = digits(e.target.value); guardar(); };

    const campo = cuerpo.querySelector('.is-pago');
    function sumar() {
      const monto = digits(campo.value);
      if (!monto) { campo.focus(); return; }
      agregarPago(p.movs, it, l, monto, cuerpo.querySelector('.is-fecha').value || hoyISO());
      guardar();
    }
    cuerpo.querySelector('.is-pago-add').onclick = sumar;
    campo.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); sumar(); } };

    cuerpo.querySelector('.is-cerrar').onclick = () => {
      if (l.pagadoEn === periodo) {
        l.pagadoEn = null;
      } else {
        // autocompleta solo si todavía no hay ningún pago; con plata puesta, la respeta
        if (!(porLinea(p.movs, periodo)[l.id] || 0)) agregarPago(p.movs, it, l, planDeLinea(l, periodo), hoyISO());
        l.pagadoEn = periodo;
      }
      guardar();
    };

    wirePagos(cuerpo, it, p, guardar);
    wireArrastre(cuerpo, l, p, periodo, guardar);

    cuerpo.querySelector('.is-del').onclick = () => {
      const idx = it.L.indexOf(l);
      let pagos = [];
      const { undo } = store.stageDelete(
        () => { it.L.splice(idx, 1); pagos = quitarMovsDe(p.movs, 'lineId', l.id); },
        () => { it.L.splice(idx, 0, l); p.movs.push(...pagos); }
      );
      cerrar();
      toast('Concepto eliminado', () => { undo(); renderCategorias(root); });
    };
  }

  pintar();
}

/* Las filas de pago se editan y se borran igual en el pop-up del concepto y en
   los pagos sueltos de la categoría. */
function wirePagos(scope, it, p, repintar) {
  scope.querySelectorAll('.pago-row[data-mid]').forEach((chip) => {
    chip.querySelector('.pago-ed').onclick = () => {
      const mov = p.movs.find((m) => m.id === chip.dataset.mid);
      if (mov) openPagoEditor(it, p, mov, repintar);
    };
    chip.querySelector('.pago-x').onclick = () => {
      const mov = p.movs.find((m) => m.id === chip.dataset.mid);
      const { undo } = store.stageDelete(
        () => quitarPago(p.movs, chip.dataset.mid),
        () => p.movs.push(mov)
      );
      repintar();
      toast(`Pago de ${money(mov.monto, p.cur)} eliminado`, () => { undo(); repintar(); });
    };
  });
}

/* Lo que no alcanzaste a pagar este mes se pasa al siguiente. Es un botón y
   no algo automático a propósito: la app no cierra meses sola cuando estás
   sin conexión, y adivinar deudas ajenas sería peor que preguntarlas. */
function wireArrastre(scope, l, p, periodo, repintar) {
  const el = scope.querySelector('.line-arrastre');
  if (!el) return;
  const siguiente = siguientePeriodo(periodo);

  el.querySelector('.arr-toggle')?.addEventListener('click', () => {
    if (arrastreDe(l, siguiente) > 0) {
      quitarArrastre(l, siguiente);
      repintar();
      toast('Ya no pasa nada al mes siguiente');
      return;
    }
    const falta = Math.max(0, planDeLinea(l, periodo) - (porLinea(p.movs, periodo)[l.id] || 0));
    if (!(falta > 0)) { toast('Este renglón ya está al día'); return; }
    pasarAlSiguiente(l, periodo, falta);
    repintar();
    toast(`${money(falta, p.cur)} pasan al mes siguiente`);
  });

  el.querySelector('.arr-quitar')?.addEventListener('click', () => {
    const monto = arrastreDe(l, periodo);
    quitarArrastre(l, periodo);
    repintar();
    toast(`Quitaste ${money(monto, p.cur)} de deuda vieja`, () => {
      l.arrastre = l.arrastre || {};
      l.arrastre[periodo] = monto;
      repintar();
    });
  });
}

/* F4 — cómo va el renglón en una línea: el estado y, cuando ya está cerrado,
   si ahorraste o te pasaste. Un renglón abierto todavía no dice nada. */
const ETIQUETA_ESTADO = { pendiente: 'pendiente', parcial: 'parcial', pagado: 'pagado', excedido: 'excedido' };

function filaEstado(estado, diferencia, plan, p) {
  const clase = estado === 'excedido' ? 'bad' : estado === 'pagado' ? 'ok' : estado === 'parcial' ? 'warn' : '';
  const cerrado = estado === 'pagado' || estado === 'excedido';
  const dif = r2(diferencia);
  const texto = !cerrado || !(plan > 0) ? ''
    : dif > 0 ? `<b class="num ok">ahorraste ${money(dif, p.cur)}</b>`
    : dif < 0 ? `<b class="num over">te pasaste ${money(-dif, p.cur)}</b>`
    : '<span class="sub">clavado al plan</span>';
  return `<div class="line-estado"><span class="badge ${clase}">${ETIQUETA_ESTADO[estado]}</span>${texto}</div>`;
}

function barraGasto(pagado, plan, p) {
  const porcentaje = plan > 0 ? Math.round((pagado / plan) * 100) : pagado > 0 ? 100 : 0;
  const ancho = Math.min(100, Math.max(0, porcentaje));
  const color = plan > 0 && pagado > plan ? 'var(--danger)' : 'var(--pink)';
  return `<div class="line-progreso">
    <div class="line-progreso-head">
      <span class="sub">Gastado <b class="num">${money(pagado, p.cur)}</b>${plan > 0 ? ` de <b class="num">${money(plan, p.cur)}</b>` : ''}</span>
      <b class="num ${plan > 0 && pagado > plan ? 'over' : ''}">${porcentaje}%</b>
    </div>
    <div class="hist-track"><i style="width:${ancho}%;background:${color}"></i></div>
  </div>`;
}

/* El mes que no alcanzó. Si al renglón le falta plata por pagar, un botón lo
   pasa al mes siguiente: allá el renglón vale su plan más lo que quedó
   debiendo. Y cuando la deuda llega, se dice de dónde viene y se puede
   devolver, que un arrastre puesto por error no puede quedar amarrado. */
function filaArrastre(l, p, periodo, arrastre, pendiente, plan) {
  const yaPasado = arrastreDe(l, siguientePeriodo(periodo));
  /* Solo los renglones fijos generan deuda: un arriendo sin pagar se debe, un
     mercado en el que gastaste menos no. Lo que ya viene arrastrado sí se
     puede seguir moviendo, sea del tipo que sea. */
  const esDeuda = l.fixed !== false || arrastre > 0;
  if (!arrastre && !yaPasado && !(pendiente > 0 && esDeuda)) return '';
  const mes = (per) => `${MESES[Number(per.split('-')[1]) - 1]}`;
  return `<div class="line-arrastre" data-lid="${l.id}">
    ${arrastre > 0
      ? `<span class="sub">Vienen <b class="num">${money(arrastre, p.cur)}</b> sin pagar de ${mes(mesAnterior(periodo))}:
         este mes el renglón vale <b class="num">${money(plan, p.cur)}</b>.</span>
         <button class="mini arr-quitar">Quitar esa deuda</button>`
      : ''}
    ${yaPasado > 0
      ? '<button class="mini arr-toggle on" aria-pressed="true">DEUDA PASADA AL SIGUIENTE MES</button>'
      : pendiente > 0 && esDeuda
      ? `<button class="mini arr-toggle danger-action" aria-pressed="false">Pasar los ${money(pendiente, p.cur)} que faltan a ${mes(siguientePeriodo(periodo))}</button>`
      : ''}
  </div>`;
}

function wireCard(root, it, p) {
  const card = root.querySelector(`.cat-card[data-id="${it.id}"]`);
  if (!card) return;

  // el bloque entero abre su pop-up; el lápiz es solo la señal de que se puede
  card.querySelector('.bloque-cat').onclick = () => abrirCatSheet(root, it, p);

  card.querySelectorAll('.bloque-item').forEach((el) => {
    const l = it.L.find((x) => x.id === el.dataset.lid);
    if (l) el.onclick = () => abrirItemSheet(root, it, l, p);
  });

  const nuevoConcepto = () => {
    const l = { id: 'l' + Math.random().toString(36).slice(2, 8), n: '', v: 0, fixed: true };
    it.L.push(l);
    store.save();
    renderCategorias(root);
    abrirItemSheet(root, it, l, p);
  };
  card.querySelector('.cat-plus').onclick = nuevoConcepto;
  // el bloque-cat entero abre el pop-up de categoría: el + no debe dispararlo
  card.querySelector('.cat-plus-head').onclick = (e) => { e.stopPropagation(); nuevoConcepto(); };

  card.querySelector('.cat-pago-libre').onclick = () => openPagoEditor(it, p, null, () => renderCategorias(root));

  // los pagos sueltos de la categoría: los del concepto viven en su pop-up
  wirePagos(card, it, p, () => renderCategorias(root));
}

// F12 — plantillas + F16 — de dónde sale la plata de una categoría nueva
function openNewCategory(root) {
  const p = store.active();
  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  overlay.innerHTML = `
    <div class="sheet">
      <div class="sheet-head"><h3>Nueva categoría</h3><button class="btn-del" id="ncClose">${icon('cerrar')}</button></div>
      <div class="fld"><label>Nombre</label><input id="ncName" placeholder="Ej: Mascotas"></div>
      <div class="label" style="margin:14px 0 8px">Plantilla de conceptos</div>
      <div class="chips" id="ncTpl">
        <button class="chip" data-r="ese">Gastos recurrentes</button>
        <button class="chip" data-r="deu">Deudas</button>
        <button class="chip" data-r="lib">Gasto libre</button>
        <button class="chip" data-r="cor">Ahorro corto</button>
        <button class="chip on" data-r="">Saltar plantilla</button>
      </div>
      <div class="label" style="margin:14px 0 8px">De dónde sale la plata</div>
      <div class="chips" id="ncSrc">
        <button class="chip on" data-s="sobra">Lo que falta por repartir</button>
        <button class="chip" data-s="prop">Un 10% de cada categoría desbloqueada</button>
        <button class="chip" data-s="bloque">De una categoría específica</button>
      </div>
      <select id="ncBloque" style="margin-top:8px;display:none;width:100%">
        ${p.items.map((it) => `<option value="${it.id}">${esc(it.n)}</option>`).join('')}
      </select>
      <button id="ncCreate" class="wide" style="margin-top:16px">Crear categoría</button>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  let tpl = '';
  let src = 'sobra';
  overlay.querySelector('#ncTpl').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    overlay.querySelectorAll('#ncTpl .chip').forEach((x) => x.classList.remove('on'));
    b.classList.add('on'); tpl = b.dataset.r;
  });
  overlay.querySelector('#ncSrc').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    overlay.querySelectorAll('#ncSrc .chip').forEach((x) => x.classList.remove('on'));
    b.classList.add('on'); src = b.dataset.s;
    overlay.querySelector('#ncBloque').style.display = src === 'bloque' ? '' : 'none';
  });

  function close() { overlay.remove(); document.body.style.overflow = ''; }
  overlay.querySelector('#ncClose').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#ncCreate').onclick = () => {
    const name = overlay.querySelector('#ncName').value.trim() || 'Nueva categoría';
    const lines2 = (store.PLANTILLAS[tpl] || []).map((n) => ({ id: 'l' + Math.random().toString(36).slice(2, 8), n, v: 0, fixed: true }));

    let monto = 0;
    if (src === 'sobra') {
      monto = balance(p.items, store.incomeRepartir(p), p.goals).falta;
    } else if (src === 'prop') {
      const unlocked = p.items.filter((it) => !it.locked);
      // ponytail: 10% de cada una, simple y ajustable a mano después
      unlocked.forEach((it) => {
        const cede = Math.round(amount(it) * 0.1);
        it.m = amount(it) - cede;
        monto += cede;
      });
    } else if (src === 'bloque') {
      const id = overlay.querySelector('#ncBloque').value;
      const donor = p.items.find((it) => it.id === id);
      if (donor && !donor.locked) { monto = Math.round(amount(donor) * 0.1); donor.m = amount(donor) - monto; }
    }

    p.items.push({ id: 'i' + Math.random().toString(36).slice(2, 8), n: name, m: Math.round(monto), r: tpl || null,
      c: PALETTE[p.items.length % PALETTE.length], d: '', locked: false, L: lines2 });
    store.save();
    close();
    renderCategorias(root);
  };
}
