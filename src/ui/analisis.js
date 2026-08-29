import * as store from '../store.js';
import { segmentosReal, segmentosDeSnapshot, arcos } from '../engine/analisis.js';
import { periodoDe, hoyISO, ingresoReal, porLinea } from '../engine/movimientos.js';
import { resumenItem, pagosLibresDeItem } from '../engine/pagos.js';
import { money, esc, MESES } from '../format.js';

/* F6 — análisis por categorías: donut y tabla del gasto real. No hay estado
   guardado: los segmentos se derivan del perfil en cada render, así que
   registrar un gasto ya cambia el dibujo. Los meses cerrados se leen de su
   snapshot, que es lo único que sobrevive a la poda. */

const R = 60;
const C = Math.round(2 * Math.PI * R * 100) / 100;

let mesElegido = null;   // null = el mes en curso
let detalleAbierto = null;  // id de la categoría con su desglose desplegado
let cierres = [];

function nombreMes(per) {
  const [a, m] = per.split('-');
  return `${MESES[Number(m) - 1]} de ${a}`;
}

function donut(segmentos) {
  const trozos = arcos(segmentos, C);
  if (!trozos.length) {
    return `<svg class="donut" viewBox="0 0 160 160" role="img" aria-label="Sin datos">
      <circle cx="80" cy="80" r="${R}" fill="none" stroke="var(--pink-wash)" stroke-width="22"></circle>
    </svg>`;
  }
  return `<svg class="donut" viewBox="0 0 160 160" role="img" aria-label="Reparto por categoría">
    ${trozos.map((t) => `<circle cx="80" cy="80" r="${R}" fill="none" stroke="${t.color}" stroke-width="22"
      stroke-dasharray="${t.largo} ${t.resto}" stroke-dashoffset="${t.offset}"
      transform="rotate(-90 80 80)"><title>${esc(t.nombre)}: ${t.pct}%</title></circle>`).join('')}
  </svg>`;
}

export function renderAnalisis(root) {
  const p = store.active();

  root.innerHTML = `
    <div class="prow" style="margin-bottom:var(--space-4)">
      <select id="anMes" aria-label="Mes"><option value="">Este mes</option></select>
    </div>
    <div id="anCuerpo"></div>`;

  pintar(root, p);

  // los meses cerrados llegan de la red: la vista ya está pintada sin ellos
  store.listarCierres().then((lista) => {
    cierres = lista;
    const sel = root.querySelector('#anMes');
    if (!sel) return;
    sel.innerHTML = '<option value="">Este mes</option>'
      + cierres.map((c) => `<option value="${c.periodo}" ${mesElegido === c.periodo ? 'selected' : ''}>${nombreMes(c.periodo)}</option>`).join('');
    sel.onchange = () => { mesElegido = sel.value || null; pintar(root, p); };
  });
}

function pintar(root, p) {
  const box = root.querySelector('#anCuerpo');
  const periodo = periodoDe(hoyISO());
  const ing = ingresoReal(p.movs, periodo);
  const plan = store.incomeRepartir(p);

  let segmentos;
  let base;
  let aviso = '';

  if (mesElegido) {
    const snap = cierres.find((c) => c.periodo === mesElegido)?.snapshot;
    segmentos = segmentosDeSnapshot(snap);
    base = snap?.ingresoReal || snap?.ingresoPlan || 0;
    aviso = `Mes cerrado: ${nombreMes(mesElegido)}.`;
  } else {
    base = ing.total > 0 ? ing.total : plan;
    segmentos = segmentosReal(p.items, p.goals, p.movs, periodo, base);
    if (ing.total <= 0) aviso = 'Todavía no registras ingresos este mes: los porcentajes van sobre el ingreso pronosticado.';
  }

  const total = segmentos.reduce((t, s) => t + s.monto, 0);

  box.innerHTML = `
    <div class="card">
      <span class="label">Gasto real</span>
      <div class="donut-wrap">
        ${donut(segmentos)}
        <div class="donut-centro">
          <span class="label">Total gastado</span>
          <b class="num">${money(total, p.cur)}</b>
        </div>
      </div>
      <div class="sub" style="text-align:center">${base > 0
        ? `Porcentajes sobre el ingreso del mes (${money(base, p.cur)}).`
        : 'Sin ingreso con qué comparar.'}</div>
      ${aviso ? `<div class="sub" style="text-align:center">${esc(aviso)}</div>` : ''}

      ${segmentos.length ? `<div class="an-tabla">
        ${segmentos.map((s) => `<div class="an-fila" data-item-id="${s.meta ? '' : s.id}">
          <span class="dot" style="background:${s.color}"></span>
          <span class="an-n">${esc(s.nombre)}</span>
          <span class="num an-pct">${s.pct}%</span>
          <span class="num an-monto">${money(s.monto, p.cur)}</span>
          <span class="num an-dif ${s.diferencia < 0 ? 'over' : 'ok'}">${
            s.diferencia === 0 ? '=' : s.diferencia > 0 ? `−${money(s.diferencia, p.cur)}` : `+${money(-s.diferencia, p.cur)}`}</span>
        </div>${detalleAbierto === s.id ? detalleCategoria(p, s.id, periodo) : ''}`).join('')}
      </div>` : '<div class="empty">Sin gastos registrados en este mes todavía.</div>'}
    </div>`;

  /* El desglose interno solo tiene sentido con el libro del mes en curso: un
     mes cerrado ya no tiene los movimientos, solo el snapshot por categoría. */
  box.querySelectorAll('.an-fila[data-item-id]:not([data-item-id=""])').forEach((fila) => {
    if (mesElegido) return;
    fila.style.cursor = 'pointer';
    fila.onclick = () => {
      detalleAbierto = detalleAbierto === fila.dataset.itemId ? null : fila.dataset.itemId;
      pintar(root, p);
    };
  });
}

// Los conceptos de una categoría, con lo pagado en cada uno
function detalleCategoria(p, itemId, periodo) {
  const it = p.items.find((x) => x.id === itemId);
  if (!it) return '';
  const res = resumenItem(it, porLinea(p.movs, periodo), periodo,
    pagosLibresDeItem(p.movs, it.id, periodo).reduce((s, m) => s + m.monto, 0));
  const segmentos = res.filas.filter((f) => f.pagado > 0)
    .map((f, i) => ({ id: f.l.id, nombre: f.l.n || 'Sin nombre',
      color: store.PALETTE[i % store.PALETTE.length], monto: f.pagado }));
  if (!segmentos.length) return '<div class="an-detalle empty">Sin pagos en esta categoría todavía.</div>';
  return `<div class="an-detalle">
    ${donut(segmentos)}
    <div class="an-detalle-lista">
      ${segmentos.map((s) => `<div class="an-fila"><span class="an-n">${esc(s.nombre)}</span>
        <span class="num an-monto">${money(s.monto, p.cur)}</span></div>`).join('')}
    </div>
  </div>`;
}
