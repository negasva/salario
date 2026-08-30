import { colorDe, claseDeMovimiento, claseDeItem } from '../engine/semantica.js';
import * as store from '../store.js';
import { amount, r2 } from '../engine/reparto.js';
import { periodoDe, hoyISO, visiblesDelMes, porItem, ingresoReal, gastoTotal } from '../engine/movimientos.js';
import { money, esc, MESES } from '../format.js';
import { pendientes, movDesde } from '../engine/recurrentes.js';
import { sinClasificar, textoDeMovimiento } from '../engine/clasificar.js';
import { clasificarConIA } from '../ia.js';
import { abrirRegistro } from './registrar.js';
import { badgeCategoria, abrirCategoria } from './categoria.js';
import { tablaPagos } from './categorias.js';
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
  // el detalle de ingresos se abre desde la tarjeta de presupuesto contra real
  let verIngresos = false;

  root.innerHTML = `
    <div class="vista-head vista-head-row">
      <div>
        <h2>Registrar</h2>
        <span class="sub">Lo que de verdad entró y salió. El plan del mes se define en Planear.</span>
      </div>
      <div class="mov-head">
        <button class="mini" id="mvPrev" aria-label="Mes anterior">←</button>
        <span class="label" id="mvPeriodo"></span>
        <button class="mini" id="mvNext" aria-label="Mes siguiente">→</button>
      </div>
    </div>
    <div class="prow mov-acciones">
      <button class="btn-primary" id="mvNuevoGasto">+ Registrar egreso</button>
      <button id="mvNuevoIngreso">+ Registrar ingreso</button>
    </div>

    <div id="mvFiltro"></div>
    <div id="mvPendientes"></div>
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

  /* F11 — lo que ya estaba registrado antes de que existieran las categorías.
     El diccionario local ya corrió al cargar el perfil y dejó en 'otros' lo que
     no reconoció; esto es el segundo intento, con la IA, y va por lotes porque
     el proveedor tiene límite de texto por llamada. Un gasto que ya pasó por
     aquí no vuelve, acierte o no: para eso está el botón de la etiqueta. */
  const LOTE_IA = 25;
  const TOPE_IA = 200;

  async function pasarIA(btn) {
    const faltan = sinClasificar(p.movs).slice(0, TOPE_IA);
    if (!faltan.length) return;
    btn.disabled = true;
    let listos = 0;
    let corto = false;
    for (let i = 0; i < faltan.length; i += LOTE_IA) {
      const lote = faltan.slice(i, i + LOTE_IA);
      // eslint-disable-next-line no-await-in-loop -- en serie a propósito: el proveedor tiene cuota
      const res = await clasificarConIA(lote.map((m) => textoDeMovimiento(m, p.items)));
      if (!res) { corto = true; break; }
      lote.forEach((m, j) => {
        m.catIA = true;
        if (res[j]?.cat) m.cat = res[j].cat;
        else m.cat = m.cat || 'otros';
      });
      listos += lote.length;
      store.save();
      btn.textContent = `Clasificando… ${listos} de ${faltan.length}`;
    }
    pintarCuerpo();
    if (corto && !listos) toast('No pude hablar con la IA. Puedes ponerles categoría a mano desde la etiqueta.');
    else if (corto) toast(`Alcancé a clasificar ${listos}; la IA dejó de responder.`);
    else toast(`Listo: ${listos} movimientos quedaron con categoría.`);
  }

  function pintarPendientes() {
    const box = $('#mvPendientes');
    const faltan = sinClasificar(p.movs);
    if (!faltan.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="card" style="margin-bottom:var(--sp-4)">
      <div class="spark-head">
        <span class="label">Sin categoría</span>
        <button class="mini" id="mvClasIA">${icon('ia', 'ic-sm')} Clasificar con IA</button>
      </div>
      <div class="sub">${faltan.length === 1
        ? 'Queda 1 gasto que el diccionario no reconoció.'
        : `Quedan ${faltan.length} gastos que el diccionario no reconoció.`} La IA los mira de a ${LOTE_IA}${faltan.length > TOPE_IA ? `, hasta ${TOPE_IA} por vez` : ''}. También puedes tocar la etiqueta de cualquiera y elegirla tú.</div>
    </div>`;
    box.querySelector('#mvClasIA').onclick = (e) => pasarIA(e.currentTarget);
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
    pintarPendientes();
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
        <div class="spark-head">
          <span class="label">Presupuesto contra real</span>
          <button class="mov-ing" id="mvIngBtn" aria-expanded="${verIngresos}" aria-controls="mvIngTabla">
            Ingresó <b class="num">${money(ing.total, p.cur)}</b>
          </button>
        </div>
        <div id="mvIngTabla" ${verIngresos ? '' : 'hidden'}></div>
        <div class="hist-list">
          ${p.items.map((it) => {
            const pres = amount(it);
            const real = gastado[it.id] || 0;
            const pct = pres > 0 ? Math.min(100, (real / pres) * 100) : (real > 0 ? 100 : 0);
            const pasado = real > pres;
            const dif = Math.abs(r2(pres - real));
            return `<div class="mov-res">
              <span class="dot" style="background:${colorDe(claseDeItem(it))}"></span>
              <span class="nm" title="${esc(it.n)}">${esc(it.n)}</span>
              <span class="hist-track"><i style="width:${pct}%;background:${colorDe(claseDeItem(it))}"></i></span>
              <span class="mov-res-n num">${money(real, p.cur)} <span class="sub">de ${money(pres, p.cur)}</span></span>
              <span class="mov-res-d num ${pasado ? 'over' : ''}">${pasado ? `+${money(dif, p.cur)}` : money(dif, p.cur)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;

    if (verIngresos) {
      // sin nota el ingreso se llamaría "Pago" en la tabla: se nombra como en el libro
      const ingresos = visiblesDelMes(p.movs, periodo)
        .filter((m) => m.tipo === 'ingreso')
        .map((m) => ({ ...m, nombre: m.nombre || m.nota || (m.extra ? 'Ingreso extra' : 'Nómina') }));
      const caja = $('#mvIngTabla');
      caja.innerHTML = ingresos.length
        ? tablaPagos(ingresos, p)
        : '<div class="empty">Sin ingresos registrados este mes.</div>';
      caja.querySelectorAll('.pago-row').forEach((tr) => {
        const m = p.movs.find((x) => x.id === tr.dataset.mid);
        if (!m) return;
        tr.querySelector('.pago-ed').onclick = () => registrar('ingreso', m.id);
        tr.querySelector('.pago-x').onclick = () => {
          const idx = p.movs.indexOf(m);
          const { undo } = store.stageDelete(() => p.movs.splice(idx, 1), () => p.movs.splice(idx, 0, m));
          pintarCuerpo();
          toast('Ingreso eliminado', () => { undo(); pintarCuerpo(); });
        };
      });
    }
    $('#mvIngBtn').onclick = () => { verIngresos = !verIngresos; pintarCuerpo(); };

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
            <span class="dot" style="background:${colorDe(claseDeMovimiento(m), 0)}"></span>
            <span class="mov-line-txt">
              <b>${esc(etiqueta)}</b>${g ? ` <span class="badge warn">${esc(g.n)}</span>` : ''}${m.abono ? ' <span class="badge">abono</span>' : ''}${m.recId ? ` <span class="badge">${icon('recurrente', 'ic-sm')} cada mes</span>` : ''}${m.tipo === 'gasto' ? ` ${badgeCategoria(m.cat)}` : ''}
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
      // la etiqueta de categoría se corrige donde se ve, sin abrir el movimiento entero
      el.querySelector('.badge-cat')?.addEventListener('click', () => abrirCategoria(m, pintarCuerpo));
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
