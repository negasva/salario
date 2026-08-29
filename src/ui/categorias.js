import * as store from '../store.js';
import { balance, amount, r2 } from '../engine/reparto.js';
import { periodoDe, hoyISO, porLinea, ingresoReal, resumenFlujo, enPeriodo } from '../engine/movimientos.js';
import { metasEnItem } from '../engine/metas.js';
import { money, plain, esc, digits, MESES } from '../format.js';
import { resumenItem, agregarPago, pagosDeLinea, quitarPago, arrastreDe, planDeLinea,
  pasarAlSiguiente, quitarArrastre, siguientePeriodo, mesAnterior, agregarPagoLibre,
  pagosLibresDeItem } from '../engine/pagos.js';
import { icon } from './icons.js';
import { toast } from './shell.js';
import { abrirSelectorExtra } from './movimientos.js';
import { tarjetaResumenFlujo } from './resumen.js';

const { PALETTE } = store;

export function renderCategorias(root) {
  const p = store.active();

  root.innerHTML = `
    <div id="catIngreso"></div>
    <div class="cats-head">
      <button id="catAdd" class="wide btn-primary">+ Agregar categoría</button>
      <button id="catEqual">Repartir lo que falta en partes iguales</button>
    </div>
    <div id="catList"></div>`;

  root.querySelector('#catAdd').onclick = () => openNewCategory(root);
  root.querySelector('#catEqual').onclick = () => {
    const b = balance(p.items, store.incomeRepartir(p));
    if (b.cuadrado) { toast('Ya está todo repartido'); return; }
    const unlocked = p.items.filter((it) => !it.locked && !it.auto);
    if (!unlocked.length) { toast('No hay categorías a las que repartirles'); return; }
    const e = b.dif / unlocked.length;
    unlocked.forEach((it) => { it.m = Math.max(0, Math.round(amount(it) + e)); });
    store.save();
    renderCategorias(root);
  };

  paintList(root);
  paintIngreso(root);
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
  box.innerHTML = p.items.map((it) => catCard(it, p, gastadoLinea, periodo)).join('');

  p.items.forEach((it) => wireCard(root, it, p));
}

function catCard(it, p, gastadoLinea, periodo) {
  const pagosLibres = pagosLibresDeItem(p.movs, it.id, periodo);
  const res = resumenItem(it, gastadoLinea, periodo,
    pagosLibres.reduce((s, m) => s + m.monto, 0));
  const budget = amount(it);
  const metas = metasEnItem(p.goals, it);
  return `
  <div class="card cat-card${it.locked ? ' locked' : ''}" data-id="${it.id}">
    <div class="cat-top">
      <span class="dot" style="background:${it.c}"></span>
      <input class="cat-name" value="${esc(it.n)}" ${it.locked ? 'disabled' : ''}>
      <button class="mini cat-lock ${it.locked ? 'on is-locked' : ''}" aria-pressed="${!!it.locked}"
        title="${it.locked ? 'Bloqueada: desbloquéala para poder editarla' : 'Bloquear para que no se le cambie el monto'}">${icon('candado', 'ic-sm')}</button>
      <button class="mini cat-del">${icon('cerrar', 'ic-sm')}</button>
    </div>
    ${cabeceraPagos(res, p, budget)}
    <div class="cat-fields">
      <label class="fieldw money-field"><span>${it.auto ? 'Cuesta al mes' : 'Asignas al mes'} · ${p.cur}</span>
        <span class="money-symbol" aria-hidden="true">$</span>
        <input class="cat-monto num" type="text" inputmode="numeric" value="${plain(budget, p.cur)}"
          ${it.locked || it.auto ? 'disabled' : ''}></label>
      <div class="chips cat-modo">
        <button class="chip ${it.auto ? '' : 'on'}" data-auto="0" ${it.locked ? 'disabled' : ''}>A mano</button>
        <button class="chip ${it.auto ? 'on' : ''}" data-auto="1" ${it.locked ? 'disabled' : ''}
          title="El monto sale de sus conceptos, corregido con lo que de verdad pagaste">Automático</button>
      </div>
    </div>
    ${(it.auto || (!it.auto && res.costo > 0 && Math.abs(res.costo - budget) >= 1)) ? `<div class="sub cat-share">
      ${it.auto ? `<span>${explicacionAuto(res, p)}</span>` : ''}
      ${!it.auto && res.costo > 0 && Math.abs(res.costo - budget) >= 1
        ? `<button class="mini cat-ajustar" title="Suma sus conceptos y le resta lo que ahorraste y le suma lo que se pasó, en los renglones que ya pagaste">Igualar a lo que cuesta (${money(res.costo, p.cur)})</button>`
        : ''}</div>` : ''}
    <button class="wide mini cat-fix" ${it.locked ? 'disabled' : ''}></button>
    <div class="cat-detail">
      <div class="detail-head"><span class="label">Detalle</span>
        <button class="mini cat-pago-libre" title="Agregar un pago sin concepto">Agregar pago</button>
        <button class="btn-plus cat-plus">+</button></div>
      <div class="lines">${lines(it, p, res)}</div>
      ${pagosLibres.length ? `<div class="pagos-lista pagos-libres">
        ${pagosLibres.map((m) => pagoChip(m, p)).join('')}
      </div>` : ''}
      ${metas.length ? `<div class="detail-head" style="margin:var(--space-4) 0 var(--space-2)">
        <span class="label">Comprometido por metas</span></div>
        <div class="lines">${lineasMeta(metas, it, p)}</div>` : ''}
    </div>
  </div>`;
}

// El dinero de una meta no se edita desde aquí: texto plano, sin borrar,
// sin toggle fijo/variable.
function lineasMeta(metas, it, p) {
  return metas.map(({ goal, monto }) => {
    const ap = aporteDelMes(p, goal.id);
    return `<div class="line line-meta ${goal.special ? 'line-fondo' : ''}" data-gid="${goal.id}">
      <span class="lm-n">${esc(goal.n)}${goal.special ? ' <span class="badge warn">fondo</span>' : ''}</span>
      <span class="num lm-v">${money(monto, p.cur)}</span>
      ${ap
        ? `<button class="mini lm-ok" title="Deshacer el aporte">${icon('check', 'ic-sm')} Guardado el ${diaCorto(ap.fecha)}</button>`
        : '<button class="mini lm-pagar">Ya lo guardé</button>'}
    </div>`;
  }).join('');
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
  </div>`;
}


/* Cada compra queda a la vista y se borra sola: corregir un pago mal tecleado
   es quitar esa transacción, no recalcular un total a mano. */
function listaPagos(l, p, periodo) {
  const pagos = pagosDeLinea(p.movs, l.id, periodo);
  if (!pagos.length) return '';
  return `<div class="pagos-lista" data-lid="${l.id}">
    ${pagos.map((m) => pagoChip(m, p)).join('')}
  </div>`;
}

function pagoChip(m, p) {
  return `<span class="pago-chip" data-mid="${m.id}">
    <b class="num">${money(m.monto, p.cur)}</b>
    <span class="sub">${diaCorto(m.fecha)}</span>
    ${!m.lineId && m.nota ? `<span class="sub pago-nota">${esc(m.nota)}</span>` : ''}
    <button class="pago-ed" title="Editar pago" aria-label="Editar pago">⋮</button>
    <button class="pago-x" title="Quitar este pago" aria-label="Quitar pago de ${money(m.monto, p.cur)}">${icon('cerrar', 'ic-sm')}</button>
  </span>`;
}

function openPagoEditor(root, it, p, mov = null) {
  const line = mov?.lineId ? it.L.find((l) => l.id === mov.lineId) : null;
  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  overlay.innerHTML = `
    <div class="sheet pago-sheet">
      <div class="sheet-head">
        <h3>${mov ? 'Editar pago' : 'Agregar pago'}</h3>
        <button class="btn-del" id="pagoClose" aria-label="Cerrar">${icon('cerrar')}</button>
      </div>
      <div class="pago-form">
        <label class="fieldw"><span>Nombre</span><input id="pagoNombre" value="${esc(mov?.nota || line?.n || '')}" placeholder="Ej. almuerzo"></label>
        <label class="fieldw money-field"><span>Monto</span><span class="money-symbol" aria-hidden="true">$</span><input id="pagoMonto" class="num" inputmode="numeric" value="${mov ? plain(mov.monto, p.cur) : ''}" placeholder="0"></label>
        <label class="fieldw"><span>Fecha</span><input id="pagoFecha" type="date" value="${mov?.fecha || hoyISO()}"></label>
      </div>
      <button class="wide btn-primary" id="pagoSave">${mov ? 'Guardar cambios' : 'Guardar pago'}</button>
      <button class="wide" id="pagoCancel">Cancelar</button>
    </div>`;

  const close = () => {
    overlay.remove();
    document.body.style.overflow = '';
  };
  overlay.querySelector('#pagoClose').onclick = close;
  overlay.querySelector('#pagoCancel').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#pagoSave').onclick = () => {
    const monto = digits(overlay.querySelector('#pagoMonto').value);
    if (monto <= 0) {
      overlay.querySelector('#pagoMonto').focus();
      return;
    }
    const datos = {
      fecha: overlay.querySelector('#pagoFecha').value || hoyISO(),
      monto,
      nota: overlay.querySelector('#pagoNombre').value.trim() || (line?.n || 'Pago'),
    };
    if (mov) Object.assign(mov, datos);
    else agregarPagoLibre(p.movs, it, datos.monto, datos.fecha, datos.nota);
    store.save();
    close();
    renderCategorias(root);
    toast(mov ? 'Pago actualizado' : 'Pago guardado');
  };
}

function lines(it, p, res) {
  if (!res.total) return '<div class="empty">Sin nada en la lista.</div>';
  return res.filas.map(({ l, plan, pagado, arrastre, pendiente }) => {
    return `
    <div class="concepto-card" data-lid="${l.id}">
      <div class="line">
        <input class="ln" value="${esc(l.n)}" placeholder="Concepto">
        <label class="money-input" title="Monto planeado">
          <span class="money-symbol" aria-hidden="true">$</span>
          <input class="lv num" type="text" inputmode="numeric" value="${l.v ? plain(l.v, p.cur) : ''}" placeholder="0">
        </label>
        <button class="mini lx" title="Eliminar concepto" aria-label="Eliminar concepto">${icon('cerrar', 'ic-sm')}</button>
      </div>
      <div class="line-pago" data-lid="${l.id}">
        <label class="fieldw money-field"><span>Agregar pago</span><span class="money-symbol" aria-hidden="true">$</span>
          <input class="lpag num" inputmode="numeric" placeholder="0"></label>
        <button class="mini lpag-add" title="Sumar este pago al renglón">+</button>
        <button class="mini lcerrar ${l.pagadoEn === res.periodo ? 'on' : ''}"
          aria-pressed="${l.pagadoEn === res.periodo}">${icon('check', 'ic-sm')} Pagado por completo</button>
      </div>
      ${listaPagos(l, p, res.periodo)}
      ${barraGasto(pagado, plan, p)}
      ${filaArrastre(l, p, res.periodo, arrastre, pendiente, plan)}
    </div>`;
  }).join('');
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
    ${pendiente > 0 && esDeuda
      ? `<button class="mini arr-pasar danger-action">Pasar los ${money(pendiente, p.cur)} que faltan a ${mes(siguientePeriodo(periodo))}</button>`
      : ''}
    ${yaPasado > 0
      ? `<span class="sub">Ya pasaste <b class="num">${money(yaPasado, p.cur)}</b> a ${mes(siguientePeriodo(periodo))}.</span>
         <button class="mini arr-deshacer">Deshacer</button>`
      : ''}
  </div>`;
}

function wireCard(root, it, p) {
  const card = root.querySelector(`.cat-card[data-id="${it.id}"]`);
  if (!card) return;

  // la plata asignada es lo único que se edita: el porcentaje sale de ella
  function setMonto(v) {
    it.m = Math.max(0, Math.round(v));
    store.save();
    renderCategorias(root);
  }

  card.querySelector('.cat-name').oninput = (e) => { it.n = e.target.value; store.save(); };
  card.querySelector('.cat-monto').onchange = (e) => setMonto(digits(e.target.value));

  // el plan de renglones ya está sumado abajo: un clic lo sube al presupuesto
  card.querySelector('.cat-ajustar')?.addEventListener('click', () => {
    if (it.locked) { toast('Desbloquea la categoría para cambiarle el monto'); return; }
    setMonto(resumenItem(it, porLinea(p.movs, periodoDe(hoyISO())), periodoDe(hoyISO())).costo);
  });

  card.querySelector('.cat-modo').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn || btn.disabled) return;
    it.auto = btn.dataset.auto === '1';
    store.save();
    renderCategorias(root);
    toast(it.auto ? 'Esta categoría ya se calcula sola' : 'Ahora le pones el monto tú');
  });

  const fixBtn = card.querySelector('.cat-fix');
  const b = balance(p.items, store.incomeRepartir(p));
  if (!it.locked && !it.auto && !b.cuadrado) {
    fixBtn.textContent = b.falta > 0
      ? `Sumar aquí los ${money(b.falta, p.cur)} que faltan`
      : `Quitar de aquí los ${money(b.exceso, p.cur)} de más`;
    fixBtn.onclick = () => setMonto(amount(it) + b.dif);
  } else {
    fixBtn.textContent = b.cuadrado ? 'Cuadrado' : it.auto ? 'Se calcula sola' : 'Bloqueada';
    fixBtn.disabled = true;
  }

  card.querySelector('.cat-lock').onclick = () => { it.locked = !it.locked; store.save(); renderCategorias(root); };

  card.querySelector('.cat-del').onclick = () => {
    if (p.items.length < 2) { toast('Deja al menos una categoría'); return; }
    if (it.locked) { toast('Desbloquea la categoría antes de borrarla'); return; }
    const idx = p.items.indexOf(it);
    const reclamos = p.goals.filter((g) => g.a[it.id] !== undefined).map((g) => ({ g, pct: g.a[it.id] }));
    const { undo } = store.stageDelete(
      () => { p.items.splice(idx, 1); p.goals.forEach((g) => { delete g.a[it.id]; }); },
      () => { p.items.splice(idx, 0, it); reclamos.forEach(({ g, pct }) => { g.a[it.id] = pct; }); }
    );
    renderCategorias(root);
    toast(`"${it.n}" eliminada`, () => { undo(); renderCategorias(root); });
  };

  card.querySelector('.cat-plus').onclick = () => {
    it.L.push({ id: 'l' + Math.random().toString(36).slice(2, 8), n: '', v: 0, fixed: true });
    store.save();
    renderCategorias(root);
  };
  card.querySelector('.cat-pago-libre').onclick = () => openPagoEditor(root, it, p);

  // El aporte es un movimiento y nada más: el progreso de la meta se recalcula
  // solo al guardar, así que no hay dos sitios que mantener a la par.
  function anotarAporte(goal, monto) {
    const fecha = hoyISO();
    p.movs.push({ id: 'm' + Math.random().toString(36).slice(2, 9), fecha, tipo: 'gasto',
      monto, itemId: it.id, lineId: null, goalId: goal.id, nota: `Aporte a ${goal.n}`, extra: false });
  }

  function borrarAporte(goal, mov) {
    p.movs.splice(p.movs.indexOf(mov), 1);
  }

  card.querySelectorAll('.line-meta').forEach((el) => {
    const goal = p.goals.find((g) => g.id === el.dataset.gid);
    if (!goal) return;
    const { monto } = metasEnItem([goal], it)[0] || {};

    el.querySelector('.lm-pagar')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!monto) { toast('Esta meta no reclama nada de este bloque'); return; }
      anotarAporte(goal, monto);
      store.save();
      renderCategorias(root);
      toast(`${money(monto, p.cur)} a ${goal.n}`, () => {
        borrarAporte(goal, aporteDelMes(p, goal.id));
        store.save();
        renderCategorias(root);
      });
    });

    el.querySelector('.lm-ok')?.addEventListener('click', (e) => {
      e.stopPropagation();
      borrarAporte(goal, aporteDelMes(p, goal.id));
      store.save();
      renderCategorias(root);
      toast('Aporte deshecho');
    });

    // la fila entera, fuera del botón, lleva a la hoja de la meta
    el.onclick = () => window.dispatchEvent(new CustomEvent('ir-a-meta', { detail: { goalId: goal.id } }));
  });

  card.querySelectorAll('.deu-fila').forEach((el) => {
    const l = it.L.find((x) => x.id === el.dataset.lid);
    if (!l) return;
    el.querySelectorAll('.dv').forEach((inp) => {
      inp.onchange = (e) => {
        const k = inp.dataset.k;
        l[k] = k === 'tasa' ? Number(String(e.target.value).replace(',', '.')) || 0
          : k === 'diaPago' ? Math.min(31, Math.max(0, digits(e.target.value)))
            : digits(e.target.value);
        store.save();
        renderCategorias(root);
      };
    });
    // una deuda es indefinida (solo día de corte) o tiene fecha final
    el.querySelectorAll('.deu-tipo').forEach((b) => {
      b.onclick = () => {
        l.fechaLimite = b.dataset.tipo === 'fecha' ? (l.fechaLimite || hoyISO()) : null;
        store.save();
        renderCategorias(root);
      };
    });
    const fecha = el.querySelector('.deu-fecha');
    if (fecha) fecha.onchange = (e) => { l.fechaLimite = e.target.value || null; store.save(); renderCategorias(root); };
  });

  /* El pago real. El campo es el total del mes: escribirlo ajusta el libro de
     movimientos, que es el único sitio donde vive lo pagado. El toggle solo
     autocompleta si el campo está vacío; con plata escrita, respeta el número. */
  const periodo = periodoDe(hoyISO());
  card.querySelectorAll('.line-pago').forEach((el) => {
    const l = it.L.find((x) => x.id === el.dataset.lid);
    if (!l) return;

    const campo = el.querySelector('.lpag');
    function sumar() {
      const monto = digits(campo.value);
      if (!monto) { campo.focus(); return; }
      agregarPago(p.movs, it, l, monto, hoyISO());
      store.save();
      renderCategorias(root);
    }
    el.querySelector('.lpag-add').onclick = sumar;
    // Enter suma sin soltar el teclado: son varias compras seguidas, no una
    campo.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); sumar(); } };

    el.querySelector('.lcerrar').onclick = () => {
      if (l.pagadoEn === periodo) {
        l.pagadoEn = null;
      } else {
        // autocompleta solo si todavía no hay ningún pago; con plata puesta, la respeta
        if (!(porLinea(p.movs, periodo)[l.id] || 0)) agregarPago(p.movs, it, l, planDeLinea(l, periodo), hoyISO());
        l.pagadoEn = periodo;
      }
      store.save();
      renderCategorias(root);
    };
  });

  card.querySelectorAll('.pagos-lista').forEach((el) => {
    const linea = it.L.find((x) => x.id === el.dataset.lid);
    el.querySelectorAll('.pago-chip').forEach((chip) => {
      chip.querySelector('.pago-ed').onclick = () => {
        const mov = p.movs.find((m) => m.id === chip.dataset.mid);
        if (mov) openPagoEditor(root, it, p, mov);
      };
      chip.querySelector('.pago-x').onclick = () => {
        const mov = p.movs.find((m) => m.id === chip.dataset.mid);
        const { undo } = store.stageDelete(
          () => quitarPago(p.movs, chip.dataset.mid),
          () => p.movs.push(mov)
        );
        renderCategorias(root);
        toast(`Pago de ${money(mov.monto, p.cur)} eliminado`, () => { undo(); renderCategorias(root); });
      };
    });
  });

  /* Lo que no alcanzaste a pagar este mes se pasa al siguiente. Es un botón y
     no algo automático a propósito: la app no cierra meses sola cuando estás
     sin conexión, y adivinar deudas ajenas sería peor que preguntarlas. */
  card.querySelectorAll('.line-arrastre').forEach((el) => {
    const l = it.L.find((x) => x.id === el.dataset.lid);
    if (!l) return;
    const siguiente = siguientePeriodo(periodo);

    el.querySelector('.arr-pasar')?.addEventListener('click', () => {
      const pagados = porLinea(p.movs, periodo);
      const falta = Math.max(0, planDeLinea(l, periodo) - (pagados[l.id] || 0));
      if (!(falta > 0)) { toast('Este renglón ya está al día'); return; }
      pasarAlSiguiente(l, periodo, falta);
      store.save();
      renderCategorias(root);
      toast(`${money(falta, p.cur)} pasan al mes siguiente`, () => {
        quitarArrastre(l, siguiente);
        store.save();
        renderCategorias(root);
      });
    });

    el.querySelector('.arr-deshacer')?.addEventListener('click', () => {
      quitarArrastre(l, siguiente);
      store.save();
      renderCategorias(root);
      toast('Ya no pasa nada al mes siguiente');
    });

    el.querySelector('.arr-quitar')?.addEventListener('click', () => {
      const monto = arrastreDe(l, periodo);
      quitarArrastre(l, periodo);
      store.save();
      renderCategorias(root);
      toast(`Quitaste ${money(monto, p.cur)} de deuda vieja`, () => {
        l.arrastre = l.arrastre || {};
        l.arrastre[periodo] = monto;
        store.save();
        renderCategorias(root);
      });
    });
  });

  card.querySelector('.deu-metodo')?.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    p.metodoDeuda = b.dataset.m;
    store.save();
    renderCategorias(root);
  });

  card.querySelectorAll('.line:not(.line-meta)').forEach((lineEl) => {
    const lid = lineEl.dataset.lid || lineEl.closest('.concepto-card')?.dataset.lid;
    const l = it.L.find((x) => x.id === lid);
    if (!l) return;
    lineEl.querySelector('.ln').oninput = (e) => { l.n = e.target.value; store.save(); };
    lineEl.querySelector('.lv').onchange = (e) => { l.v = digits(e.target.value); store.save(); renderCategorias(root); };
    lineEl.querySelector('.lx').onclick = () => {
      const idx = it.L.indexOf(l);
      const { undo } = store.stageDelete(() => it.L.splice(idx, 1), () => it.L.splice(idx, 0, l));
      renderCategorias(root);
      toast('Renglón eliminado', () => { undo(); renderCategorias(root); });
    };
  });
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
      monto = balance(p.items, store.incomeRepartir(p)).falta;
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
