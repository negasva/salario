import * as store from '../store.js';
import { amount, r2 } from '../engine/reparto.js';
import { periodoDe, hoyISO, enPeriodo, porItem, ingresoReal, gastoTotal } from '../engine/movimientos.js';
import { money, plain, esc, digits } from '../format.js';
import { excedente } from '../engine/consejo.js';
import { ordenadas } from '../engine/fila.js';
import { anuncio } from './anuncio.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

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
        <input id="mvNota" placeholder="Nota" aria-label="Nota">
      </div>
    </div>

    <div class="mov-head">
      <button class="mini" id="mvPrev" aria-label="Mes anterior">←</button>
      <span class="label" id="mvPeriodo"></span>
      <button class="mini" id="mvNext" aria-label="Mes siguiente">→</button>
    </div>

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
  const saveEl = $('#mvSave');

  function pintarRenglones() {
    const it = p.items.find((x) => x.id === itemEl.value);
    lineEl.innerHTML = `<option value="">Sin renglón</option>${(it?.L || [])
      .map((l) => `<option value="${l.id}">${esc(l.n || 'sin nombre')}</option>`).join('')}`;
  }

  function setTipo(t) {
    tipo = t;
    root.querySelectorAll('#mvTipo .chip').forEach((b) => b.classList.toggle('on', b.dataset.tipo === t));
    itemEl.hidden = t === 'ingreso';
    lineEl.hidden = t === 'ingreso';
    goalEl.hidden = t === 'ingreso';
    $('#mvExtraWrap').hidden = t === 'gasto';
  }

  function limpiar() {
    editId = null;
    montoEl.value = '';
    notaEl.value = '';
    goalEl.value = '';
    lineEl.value = '';
    extraEl.checked = false;
    saveEl.textContent = 'Guardar';
    montoEl.focus();
  }

  function guardar() {
    const monto = digits(montoEl.value);
    if (monto <= 0) { montoEl.focus(); return; }
    const datos = {
      fecha: fechaEl.value || hoyISO(),
      tipo,
      monto,
      itemId: tipo === 'gasto' ? itemEl.value : null,
      lineId: tipo === 'gasto' ? (lineEl.value || null) : null,
      goalId: tipo === 'gasto' ? (goalEl.value || null) : null,
      nota: notaEl.value.trim(),
      extra: tipo === 'ingreso' && extraEl.checked,
    };
    const previo = editId && p.movs.find((m) => m.id === editId);
    if (previo) Object.assign(previo, datos);
    else p.movs.push({ id: 'm' + Math.random().toString(36).slice(2, 9), ...datos });
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
              const activas = ordenadas(p.goals).filter(g => (g.estado || 'activa') === 'activa');
              for (const g of activas) {
                if (plata <= 0) break;
                if (g.t && (g.s || 0) < g.t) {
                  const falta = g.t - (g.s || 0);
                  const m = Math.min(plata, falta);
                  p.movs.push({
                    id: 'm' + Math.random().toString(36).slice(2, 9),
                    fecha: datos.fecha,
                    tipo: 'gasto',
                    monto: m,
                    itemId: null, // No bloque para no afectar Categorías
                    goalId: g.id,
                    nota: 'Sugerencia de ingreso extra'
                  });
                  g.s = (g.s || 0) + m;
                  plata -= m;
                } else if (!g.t) {
                  p.movs.push({
                    id: 'm' + Math.random().toString(36).slice(2, 9),
                    fecha: datos.fecha,
                    tipo: 'gasto',
                    monto: plata,
                    itemId: null,
                    goalId: g.id,
                    nota: 'Sugerencia de ingreso extra'
                  });
                  g.s = (g.s || 0) + plata;
                  plata = 0;
                }
              }
              store.save();
              pintarCuerpo();
              toast('Sugerencia aplicada a las metas en orden.');
            }
          },
          {
            label: 'Repartir a mano',
            onClick: () => window.dispatchEvent(new CustomEvent('ir-a-vista', { detail: { route: 'metas' } })) // El usuario puede ir a Metas a mover sus ahorros
          },
          {
            label: 'Dejarlo sin asignar',
            onClick: () => {}
          }
        ]
      });
    }
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
    $('#mvDetalle').hidden = false;
    saveEl.textContent = 'Actualizar';
    montoEl.focus();
  }

  function pintarCuerpo() {
    $('#mvPeriodo').textContent = nombrePeriodo(periodo);
    const inc = store.incomeRepartir(p);
    const gastado = porItem(p.movs, periodo);
    const ing = ingresoReal(p.movs, periodo);
    const total = gastoTotal(p.movs, periodo);

    $('#mvResumen').innerHTML = `
      <div class="card" style="margin-bottom:var(--sp-4)">
        <span class="label">Gastado este mes</span>
        <div class="kpi num">${money(total, p.cur)}</div>
        <div class="sub">${ing.total > 0
          ? `Nómina: <b class="num">${money(ing.nomina, p.cur)}</b>${ing.extra > 0 ? ` · Extra: <b class="num">${money(ing.extra, p.cur)}</b>` : ''}`
          : 'Sin ingresos registrados todavía este mes.'}</div>
      </div>
      <div class="card" style="margin-bottom:var(--sp-4)">
        <span class="label">Presupuesto contra real</span>
        <div class="hist-list">
          ${p.items.map((it) => {
            const pres = amount(it, inc);
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
              <b>${esc(etiqueta)}</b>${g ? ` <span class="badge warn">${esc(g.n)}</span>` : ''}
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
  itemEl.onchange = pintarRenglones;
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
