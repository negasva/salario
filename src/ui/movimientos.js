import * as store from '../store.js';
import { amount, r2 } from '../engine/reparto.js';
import { periodoDe, hoyISO, visiblesDelMes, porItem, ingresoReal, gastoTotal } from '../engine/movimientos.js';
import { money, esc, MESES } from '../format.js';
import { pendientes, movDesde } from '../engine/recurrentes.js';
import { CATEGORIAS, nombreCategoria } from '../engine/clasificar.js';
import { abrirRegistro } from './registrar.js';
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

export function renderMovimientos(root, args = {}) {
  const p = store.active();
  let periodo = periodoDe(hoyISO());
  // F3 — el filtro por renglón llega desde Categorías. Se ve y se quita: si no,
  // registras un movimiento que no encaja y parece que no se guardó.
  let filtroLinea = args.lineId || null;

  root.innerHTML = `
    <div class="vista-head">
      <h2>Registrar</h2>
      <span class="sub">Lo que de verdad entró y salió. El plan del mes se define en Planear.</span>
    </div>
    <div class="prow mov-acciones">
      <button class="btn-primary" id="mvNuevoGasto">+ Registrar egreso</button>
      <button id="mvNuevoIngreso">+ Registrar ingreso</button>
    </div>

    <div class="mov-head">
      <button class="mini" id="mvPrev" aria-label="Mes anterior">←</button>
      <span class="label" id="mvPeriodo"></span>
      <button class="mini" id="mvNext" aria-label="Mes siguiente">→</button>
    </div>

    <div id="mvFiltro"></div>
    <div id="mvRecurrentes"></div>
    <div id="mvResumen"></div>
    <div id="mvLista"></div>`;

  const $ = (sel) => root.querySelector(sel);

  const registrar = (tipo, movId) => abrirRegistro({
    tipo,
    movId,
    alGuardar: (mov) => {
      // lo que acabas de registrar tiene que verse: se salta el filtro y el mes
      if (mov) {
        periodo = periodoDe(mov.fecha);
        if (filtroLinea && mov.lineId !== filtroLinea) filtroLinea = null;
      }
      pintarCuerpo();
    },
  });

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

  function pintarFiltro() {
    const box = $('#mvFiltro');
    if (!filtroLinea) { box.innerHTML = ''; return; }
    const it = p.items.find((x) => x.L?.some((l) => l.id === filtroLinea));
    const l = it?.L?.find((x) => x.id === filtroLinea);
    box.innerHTML = `<div class="card mov-filtro">
      <span class="sub" style="margin:0">Viendo solo <b>${esc(l?.n || 'un tipo de concepto')}</b>.</span>
      <button class="mini" id="mvVerTodo">Ver todos</button>
    </div>`;
    box.querySelector('#mvVerTodo').onclick = () => { filtroLinea = null; pintarCuerpo(); };
  }

  function pintarCuerpo() {
    $('#mvPeriodo').textContent = nombrePeriodo(periodo);
    pintarFiltro();
    pintarRecurrentes();
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

    const delMes = visiblesDelMes(p.movs, periodo, filtroLinea);

    const lista = $('#mvLista');
    if (!delMes.length) {
      lista.innerHTML = '<div class="card"><div class="empty">' + (filtroLinea ? 'Sin movimientos para este tipo de concepto en este mes.' : 'Sin movimientos en este mes.') + '</div></div>';
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
              ${m.nota || m.medio ? `<span class="sub">${esc([m.nota, m.medio].filter(Boolean).join(' · '))}</span>` : ''}
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
      el.querySelector('.mov-ed').onclick = () => registrar(m.tipo, m.id);
      el.querySelector('.mov-del').onclick = () => {
        const idx = p.movs.indexOf(m);
        const { undo } = store.stageDelete(() => p.movs.splice(idx, 1), () => p.movs.splice(idx, 0, m));
        pintarCuerpo();
        toast('Movimiento eliminado', () => { undo(); pintarCuerpo(); });
      };
    });
  }

  $('#mvPrev').onclick = () => { periodo = correrMes(periodo, -1); pintarCuerpo(); };
  $('#mvNext').onclick = () => { periodo = correrMes(periodo, 1); pintarCuerpo(); };
  $('#mvNuevoGasto').onclick = () => registrar('gasto');
  $('#mvNuevoIngreso').onclick = () => registrar('ingreso');

  pintarCuerpo();
}
