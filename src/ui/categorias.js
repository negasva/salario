import * as store from '../store.js';
import { total, amount, spentInItem, fixedVariableSplit, clamp, r2 } from '../engine/reparto.js';
import { periodoDe, hoyISO, porItem, porLinea, ingresoReal, enPeriodo, ritmoDelMes } from '../engine/movimientos.js';
import { plazo, whenText, metasEnItem } from '../engine/metas.js';
import { mesesParaLiquidar, interesTotal, deudasDelPerfil, plan, saldoVivo } from '../engine/deudas.js';
import { money, plain, esc, digits, MESES } from '../format.js';
import { renglonesSobreTope } from '../engine/alertas.js';
import { icon } from './icons.js';
import { toast } from './shell.js';
import { abrirSelectorExtra } from './movimientos.js';

const PALETTE = ['var(--ink)', 'var(--pink)', 'var(--danger)', 'var(--success)', 'var(--warning)',
  'var(--pink-dark)', 'var(--ink-lighter)', 'var(--pink-light)'];

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
    const d = r2(100 - total(p.items));
    if (Math.abs(d) < 0.01) { toast('Ya está en 100%'); return; }
    const unlocked = p.items.filter((it) => !it.locked);
    if (!unlocked.length) { toast('Todas las categorías están bloqueadas'); return; }
    const e = d / unlocked.length;
    unlocked.forEach((it) => { it.p = r2(clamp(it.p + e, 0, 100)); });
    store.save();
    renderCategorias(root);
  };

  paintList(root);
  paintIngreso(root);
}

/* El reparto ya no se hace sobre un número tecleado: los porcentajes reparten
   lo que de verdad entró este mes, y cada ingreso nuevo mueve el monto de
   todos los bloques. Aquí se ve de dónde sale ese número. */
function paintIngreso(root) {
  const p = store.active();
  const periodo = periodoDe(hoyISO());
  const ing = ingresoReal(p.movs, periodo);
  const box = root.querySelector('#catIngreso');
  const base = store.incomeRepartir(p);
  /* Lo repartible aparte no es solo el ingreso marcado como extra: cualquier
     peso que entre por encima del plan también está sin dueño hasta que lo
     mandes a una meta. Un ingreso sin marcar contaba como nada y esa era la
     puerta por la que se perdía. */
  const sobrante = Math.max(0, ing.total - p.inc);
  const sinRepartir = Math.max(0, sobrante - aportadoEsteMes(p, periodo));

  box.innerHTML = `<div class="card" style="margin-bottom:var(--space-5)">
    <span class="label">Lo que repartes este mes</span>
    <div class="kpi num">${money(base, p.cur)}</div>
    <div class="sub">${ing.total > 0
      ? `Nómina ${money(ing.nomina, p.cur)}${ing.extra > 0 ? ` · extra ${money(ing.extra, p.cur)}` : ''}
         · plan ${money(p.inc, p.cur)}. Los porcentajes de abajo reparten este número.`
      : `Todavía no registras ingresos de ${MESES[Number(periodo.split('-')[1]) - 1]}, así que reparto el plan.`}</div>
    ${sobrante > 0 ? `<div class="sub">Entraron <b class="num">${money(sobrante, p.cur)}</b> por encima del plan.
      ${sinRepartir > 0
        ? `Te quedan <b class="num">${money(sinRepartir, p.cur)}</b> sin mandar a ninguna meta.`
        : 'Ya lo mandaste todo a tus metas.'}</div>` : ''}
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
  const gastado = porItem(p.movs, periodoDe(hoyISO()));
  const gastadoLinea = porLinea(p.movs, periodoDe(hoyISO()));
  box.innerHTML = p.items.map((it) => catCard(it, p, gastado, gastadoLinea)).join('');

  p.items.forEach((it) => wireCard(root, it, p));
}

function catCard(it, p, gastado, gastadoLinea) {
  const budget = amount(it, store.incomeRepartir(p));
  const real = gastado[it.id] || 0;
  const sp = spentInItem(it);
  const { fixed, variable } = fixedVariableSplit(it);
  const metas = metasEnItem(p.goals, it, store.incomeRepartir(p));
  // lo ya aportado este mes vive en `real` como gasto: contarlo otra vez como
  // compromiso restaría dos veces el mismo dinero
  const comprometido = metas.reduce((t, m) => t + (aporteDelMes(p, m.goal.id) ? 0 : m.monto), 0);
  const libre = r2(budget - real - comprometido);
  // a día 25 gastarse el 90% del bloque va bien; a día 5 va fatal
  const ritmo = ritmoDelMes(real, budget);
  return `
  <div class="card cat-card" data-id="${it.id}">
    <div class="cat-top">
      <span class="dot" style="background:${it.c}"></span>
      <input class="cat-name" value="${esc(it.n)}" ${it.locked ? 'disabled' : ''}>
      <button class="mini cat-lock" title="${it.locked ? 'Desbloquear' : 'Bloquear'}">${icon('candado', 'ic-sm')}</button>
      <button class="mini cat-del">${icon('cerrar', 'ic-sm')}</button>
    </div>
    <div class="sub cat-desc" contenteditable="${!it.locked}">${esc(it.d || '')}</div>
    <div class="cat-fields">
      <label class="fieldw"><span>${p.cur}</span><input class="cat-monto num" type="text" inputmode="numeric" value="${plain(budget, p.cur)}" ${it.locked ? 'disabled' : ''}></label>
      <label class="fieldw pcent"><input class="cat-pct num" type="text" inputmode="decimal" value="${it.p}" ${it.locked ? 'disabled' : ''}><span>%</span></label>
    </div>
    <input type="range" class="cat-range" min="0" max="100" step="0.5" value="${it.p}" ${it.locked ? 'disabled' : ''}>
    <button class="wide mini cat-fix" ${it.locked ? 'disabled' : ''}></button>
    <div class="cat-detail">
      <div class="detail-head"><span class="label">Detalle</span><button class="btn-plus cat-plus">+</button></div>
      <div class="lines">${lines(it, p, gastadoLinea)}</div>
      ${metas.length ? `<div class="detail-head" style="margin:var(--space-4) 0 var(--space-2)">
        <span class="label">Comprometido por metas</span></div>
        <div class="lines">${lineasMeta(metas, it, p)}</div>` : ''}
      <div class="sub cat-cuenta" style="margin-top:10px">
        Presupuesto <b class="num">${money(budget, p.cur)}</b> ·
        gastos <b class="num">${money(real, p.cur)}</b> ·
        metas <b class="num">${money(comprometido, p.cur)}</b> ·
        libre <b class="num${libre < 0 ? ' over' : ''}">${money(libre, p.cur)}</b>
        ${libre < 0 ? '<b class="over"> Te pasaste del bloque.</b>' : ''}
      </div>
      ${budget > 0 && real > 0 ? `<div class="sub">A estas alturas del mes tocaría llevar
        <b class="num">${money(ritmo.esperado, p.cur)}</b>:
        ${Math.abs(ritmo.pct) < 5
          ? 'vas en el ritmo justo.'
          : ritmo.delta > 0
            ? `<b class="over">vas ${ritmo.pct}% por encima del ritmo</b>, ${money(ritmo.delta, p.cur)} de más.`
            : `vas ${Math.abs(ritmo.pct)}% por debajo, ${money(-ritmo.delta, p.cur)} de margen.`}
      </div>` : ''}
      ${it.r === 'deu' ? tarjetaDeuda(it, p, budget) : ''}
      ${it.L.length ? `<div class="sub">Planeado ${money(sp, p.cur)} · fijo ${money(fixed, p.cur)} · variable ${money(variable, p.cur)}</div>` : ''}
    </div>
  </div>`;
}

// El dinero de una meta no se edita desde aquí: texto plano, sin borrar,
// sin toggle fijo/variable.
function lineasMeta(metas, it, p) {
  return metas.map(({ goal, pct, monto }) => {
    const ap = aporteDelMes(p, goal.id);
    return `<div class="line line-meta ${goal.special ? 'line-fondo' : ''}" data-gid="${goal.id}">
      <span class="lm-n">${esc(goal.n)}${goal.special ? ' <span class="badge warn">fondo</span>' : ''}</span>
      <span class="badge lm-p">${r2(pct)}%</span>
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

function lines(it, p, gastadoLinea) {
  if (!it.L.length) return '<div class="empty">Sin nada en la lista.</div>';
  return it.L.map((l) => {
    const real = gastadoLinea[l.id] || 0;
    const tope = Number(l.tope) || 0;
    return `
    <div class="line" data-lid="${l.id}">
      <input class="ln" value="${esc(l.n)}" placeholder="Concepto">
      <input class="lv num" type="text" inputmode="numeric" value="${l.v ? plain(l.v, p.cur) : ''}" placeholder="0">
      <button class="mini fixedtoggle ${l.fixed ? 'on' : ''}" title="Fijo/variable">${l.fixed ? 'Fijo' : 'Variable'}</button>
      <button class="mini lx">${icon('cerrar', 'ic-sm')}</button>
    </div>
    <div class="line-tope" data-lid="${l.id}">
      <label class="fieldw"><span>Tope del mes</span>
        <input class="ltope num" inputmode="numeric" value="${tope ? plain(tope, p.cur) : ''}" placeholder="sin tope"></label>
      ${barraGasto(real, tope, Number(l.v) || 0, p)}
    </div>
    ${it.r === 'deu' ? filaDeuda(l, p) : ''}`;
  }).join('');
}

/* Cada renglon lleva su barra de lo gastado. Si hay tope, ese manda; si no,
   el valor planeado sirve de referencia. Sin ninguno de los dos solo se
   dice cuanto llevas, que una barra sin base no significa nada. */
function barraGasto(real, tope, planeado, p) {
  const base = tope || planeado;
  if (!base) {
    return real > 0
      ? `<div class="sub">Llevas <b class="num">${money(real, p.cur)}</b> este mes.</div>`
      : '';
  }
  const pct = Math.round((real / base) * 100);
  const color = pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warning)' : 'var(--success)';
  return `<div class="sub linea-barra">
    <span>Llevas <b class="num">${money(real, p.cur)}</b> de ${money(base, p.cur)}${tope ? '' : ' planeado'}</span>
    <span class="hist-track"><i style="width:${Math.min(100, pct)}%;background:${color}"></i></span>
    <span class="${pct >= 100 ? 'over' : ''}"><b>${pct}%</b>${pct >= 100
      ? ' · te pasaste'
      : ` · quedan ${money(r2(base - real), p.cur)}`}</span>
  </div>`;
}

// Un renglón de deuda gana tres campos. Vacíos, se comporta como cualquier otro.
function filaDeuda(l, p) {
  const cuota = Number(l.minimo) || 0;
  const declarado = Number(l.saldo) || 0;
  const saldo = saldoVivo(l, p.movs);
  const abonadoMes = p.movs
    .filter((m) => m.abono && m.lineId === l.id && periodoDe(m.fecha) === periodoDe(hoyISO()))
    .reduce((s, m) => s + m.monto, 0);
  const meses = saldo > 0 ? mesesParaLiquidar(saldo, l.tasa, cuota) : null;
  const intereses = meses ? interesTotal(saldo, l.tasa, cuota) : null;
  return `<div class="deu-fila" data-lid="${l.id}">
    <label class="fieldw"><span>Saldo</span><input class="dv num" data-k="saldo" inputmode="numeric" value="${saldo ? plain(saldo, p.cur) : ''}" placeholder="0"></label>
    <label class="fieldw"><span>Tasa %</span><input class="dv num" data-k="tasa" inputmode="decimal" value="${l.tasa ?? ''}" placeholder="0"></label>
    <label class="fieldw"><span>Mínimo</span><input class="dv num" data-k="minimo" inputmode="numeric" value="${cuota ? plain(cuota, p.cur) : ''}" placeholder="0"></label>
    <label class="fieldw"><span>Día de pago</span><input class="dv num" data-k="diaPago" inputmode="numeric" value="${l.diaPago || ''}" placeholder="—"></label>
    <div class="chips deu-plazo-tipo">
      <button class="mini deu-tipo ${l.fechaLimite ? '' : 'on'}" data-lid="${l.id}" data-tipo="indefinida">Sin fecha final</button>
      <button class="mini deu-tipo ${l.fechaLimite ? 'on' : ''}" data-lid="${l.id}" data-tipo="fecha">Con fecha límite</button>
      ${l.fechaLimite ? `<input type="date" class="deu-fecha" data-lid="${l.id}" value="${l.fechaLimite}">` : ''}
    </div>
    ${declarado > 0 ? `<div class="sub deu-plazo">Saldo ${money(declarado, p.cur)} · abonado este mes ${money(abonadoMes, p.cur)} · quedan ${money(saldo, p.cur)}</div>` : ''}
    ${saldo > 0 ? `<div class="sub deu-plazo">${meses
      ? `Se liquida en ${plazo(meses)}, hacia ${whenText(meses)}. Intereses: ${money(intereses, p.cur)}.`
      : '<b class="over">Esta cuota nunca la paga: no cubre ni los intereses.</b>'}</div>` : ''}
  </div>`;
}

// La bola de nieve cuesta más plata y el usuario tiene derecho a elegirla igual
function tarjetaDeuda(it, p, budget) {
  const deudas = deudasDelPerfil([it], p.movs);
  if (!deudas.length) return '';
  const av = plan(deudas, budget, 'avalancha');
  const bn = plan(deudas, budget, 'bolaDeNieve');
  if (!av.cubreMinimos) {
    return `<div class="card-2 deu-comp"><span class="label">Salir de deudas</span>
      <div class="sub"><b class="over">El bloque no alcanza para los mínimos.</b>
      Súbelo o renegocia antes de pensar en el orden de ataque.</div></div>`;
  }
  const linea = (r) => (r.meses
    ? `libre en ${plazo(r.meses)}, pagas ${money(r.interes, p.cur)} de intereses`
    : `con ${money(budget, p.cur)} al mes no se liquida nunca`);
  return `<div class="card-2 deu-comp">
    <span class="label">Salir de deudas</span>
    <div class="sub"><b>Avalancha</b> (mayor tasa primero): ${linea(av)}.</div>
    <div class="sub"><b>Bola de nieve</b> (menor saldo primero): ${linea(bn)}.</div>
    ${av.meses && bn.meses && bn.interes > av.interes
      ? `<div class="sub">La bola de nieve te cuesta ${money(r2(bn.interes - av.interes), p.cur)} más. Se elige por cabeza, no por plata, y eso también cuenta.</div>`
      : ''}
    <div class="chips deu-metodo" style="margin-top:10px">
      <button class="chip ${p.metodoDeuda !== 'bolaDeNieve' ? 'on' : ''}" data-m="avalancha">Avalancha</button>
      <button class="chip ${p.metodoDeuda === 'bolaDeNieve' ? 'on' : ''}" data-m="bolaDeNieve">Bola de nieve</button>
    </div>
    <div class="sub">${(p.metodoDeuda === 'bolaDeNieve' ? bn : av).deudas
      .map((d) => `${esc(d.n || 'sin nombre')}: ${d.fecha || 'no se liquida'}`).join(' · ')}</div>
  </div>`;
}

function wireCard(root, it, p) {
  const card = root.querySelector(`.cat-card[data-id="${it.id}"]`);
  if (!card) return;

  function setPct(v) {
    it.p = r2(clamp(v, 0, 100));
    store.save();
    renderCategorias(root);
  }

  // el arrastre solo actualiza los campos visibles, sin re-render ni guardado en cada tick
  function liveDrag(v) {
    it.p = r2(clamp(v, 0, 100));
    const pctEl = card.querySelector('.cat-pct');
    const montoEl = card.querySelector('.cat-monto');
    if (document.activeElement !== pctEl) pctEl.value = it.p;
    if (document.activeElement !== montoEl) montoEl.value = plain(amount(it, store.incomeRepartir(p)), p.cur);
  }

  card.querySelector('.cat-name').oninput = (e) => { it.n = e.target.value; store.save(); };
  card.querySelector('.cat-desc').oninput = (e) => { it.d = e.target.textContent; store.save(); };
  card.querySelector('.cat-range').oninput = (e) => liveDrag(Number(e.target.value));
  card.querySelector('.cat-range').onchange = (e) => setPct(Number(e.target.value));
  card.querySelector('.cat-pct').onchange = (e) => setPct(Number(String(e.target.value).replace(',', '.')) || 0);
  card.querySelector('.cat-monto').onchange = (e) => {
    const inc = store.incomeRepartir(p);
    setPct(inc > 0 ? (digits(e.target.value) / inc) * 100 : 0);
  };

  const fixBtn = card.querySelector('.cat-fix');
  const diff = r2(100 - total(p.items));
  if (!it.locked && Math.abs(diff) >= 0.01) {
    fixBtn.textContent = diff > 0 ? `Sumar ${diff}% aquí` : `Quitar ${Math.abs(diff)}% de aquí`;
    fixBtn.onclick = () => setPct(it.p + diff);
  } else {
    fixBtn.textContent = 'Cuadrado';
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
    const { monto } = metasEnItem([goal], it, store.incomeRepartir(p))[0] || {};

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

  // el tope vive fuera de la fila del renglón, en su propia línea
  card.querySelectorAll('.line-tope').forEach((el) => {
    const l = it.L.find((x) => x.id === el.dataset.lid);
    if (!l) return;
    el.querySelector('.ltope').onchange = (e) => {
      l.tope = digits(e.target.value);
      store.save();
      renderCategorias(root);
    };
  });

  card.querySelector('.deu-metodo')?.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    p.metodoDeuda = b.dataset.m;
    store.save();
    renderCategorias(root);
  });

  card.querySelectorAll('.line:not(.line-meta)').forEach((lineEl) => {
    const lid = lineEl.dataset.lid;
    const l = it.L.find((x) => x.id === lid);
    if (!l) return;
    lineEl.querySelector('.ln').oninput = (e) => { l.n = e.target.value; store.save(); };
    lineEl.querySelector('.lv').onchange = (e) => { l.v = digits(e.target.value); store.save(); renderCategorias(root); };
    lineEl.querySelector('.fixedtoggle').onclick = () => { l.fixed = !l.fixed; store.save(); renderCategorias(root); };
    lineEl.querySelector('.lx').onclick = () => {
      const idx = it.L.indexOf(l);
      const { undo } = store.stageDelete(() => it.L.splice(idx, 1), () => it.L.splice(idx, 0, l));
      renderCategorias(root);
      toast('Renglón eliminado', () => { undo(); renderCategorias(root); });
    };
  });
}

// F12 — plantillas + F16 — de donde sale el porcentaje de una categoria nueva
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
        <button class="chip" data-r="ese">Esenciales</button>
        <button class="chip" data-r="deu">Deudas</button>
        <button class="chip" data-r="lib">Gasto libre</button>
        <button class="chip" data-r="cor">Ahorro corto</button>
        <button class="chip on" data-r="">Saltar plantilla</button>
      </div>
      <div class="label" style="margin:14px 0 8px">De dónde sale el porcentaje</div>
      <div class="chips" id="ncSrc">
        <button class="chip on" data-s="sobra">Lo que sobra sin asignar</button>
        <button class="chip" data-s="prop">Proporcional de bloques desbloqueados</button>
        <button class="chip" data-s="bloque">De un bloque específico</button>
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

    let pct = 0;
    if (src === 'sobra') {
      pct = Math.max(0, r2(100 - total(p.items)));
    } else if (src === 'prop') {
      const unlocked = p.items.filter((it) => !it.locked);
      const t = total(unlocked);
      pct = t > 0 ? r2(t * 0.1) : 5; // ponytail: 10% proporcional simple, ajustable a mano despues
      unlocked.forEach((it) => { it.p = r2(it.p * 0.9); });
    } else if (src === 'bloque') {
      const id = overlay.querySelector('#ncBloque').value;
      const donor = p.items.find((it) => it.id === id);
      if (donor && !donor.locked) { pct = Math.min(10, donor.p); donor.p = r2(donor.p - pct); }
    }

    p.items.push({ id: 'i' + Math.random().toString(36).slice(2, 8), n: name, p: pct, r: tpl || null,
      c: PALETTE[p.items.length % PALETTE.length], d: '', locked: false, L: lines2 });
    store.save();
    close();
    renderCategorias(root);
  };
}
