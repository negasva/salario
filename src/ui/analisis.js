import * as store from '../store.js';
import { segmentosPlaneado, segmentosReal, segmentosDeSnapshot, arcos } from '../engine/analisis.js';
import { periodoDe, hoyISO, ingresoReal } from '../engine/movimientos.js';
import { money, esc, MESES } from '../format.js';

/* F6 — análisis por categorías: donut y tabla, en modo Planeado o Real. No hay
   estado guardado: los segmentos se derivan del perfil en cada render, así que
   registrar un gasto o mover un planeado ya cambia el dibujo. Los meses
   cerrados se leen de su snapshot, que es lo único que sobrevive a la poda. */

const R = 60;
const C = Math.round(2 * Math.PI * R * 100) / 100;

let modo = 'planeado';
let mesElegido = null;   // null = el mes en curso
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
    <div class="chips" id="anModo" style="margin-bottom:var(--space-4)">
      <button class="chip ${modo === 'planeado' ? 'on' : ''}" data-modo="planeado">Planeado</button>
      <button class="chip ${modo === 'real' ? 'on' : ''}" data-modo="real">Real</button>
    </div>
    <div class="prow" style="margin-bottom:var(--space-4)">
      <select id="anMes" aria-label="Mes"><option value="">Este mes</option></select>
    </div>
    <div id="anCuerpo"></div>`;

  root.querySelectorAll('#anModo .chip').forEach((b) => {
    b.onclick = () => { modo = b.dataset.modo; renderAnalisis(root); };
  });

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
    segmentos = segmentosDeSnapshot(snap, modo);
    base = modo === 'real' ? (snap?.ingresoReal || snap?.ingresoPlan || 0) : (snap?.ingresoPlan || 0);
    aviso = `Mes cerrado: ${nombreMes(mesElegido)}.`;
  } else if (modo === 'planeado') {
    base = plan;
    segmentos = segmentosPlaneado(p.items, p.goals, base);
  } else {
    base = ing.total > 0 ? ing.total : plan;
    segmentos = segmentosReal(p.items, p.goals, p.movs, periodo, base);
    if (ing.total <= 0) aviso = 'Todavía no registras ingresos este mes: los porcentajes van sobre el ingreso pronosticado.';
  }

  // ni lo que sobra ni el ahorro que la app sugiere son plata que repartiste
  const total = segmentos.filter((s) => !s.sinAsignar && !s.sugerido)
    .reduce((t, s) => t + s.monto, 0);

  box.innerHTML = `
    <div class="card">
      <span class="label">${modo === 'planeado' ? 'Reparto planeado' : 'Gasto real'}</span>
      <div class="donut-wrap">
        ${donut(segmentos)}
        <div class="donut-centro">
          <span class="label">${modo === 'planeado' ? 'Total repartido' : 'Total gastado'}</span>
          <b class="num">${money(total, p.cur)}</b>
        </div>
      </div>
      <div class="sub" style="text-align:center">${base > 0
        ? `Porcentajes sobre ${modo === 'planeado' ? 'el ingreso pronosticado' : 'el ingreso del mes'} (${money(base, p.cur)}).`
        : 'Sin ingreso con qué comparar.'}</div>
      ${aviso ? `<div class="sub" style="text-align:center">${esc(aviso)}</div>` : ''}

      ${segmentos.length ? `<div class="an-tabla">
        ${segmentos.map((s) => `<div class="an-fila ${s.sinAsignar || s.sugerido ? 'an-suelta' : ''}">
          <span class="dot" style="background:${s.color}"></span>
          <span class="an-n">${esc(s.nombre)}</span>
          <span class="num an-pct">${s.pct}%</span>
          <span class="num an-monto">${money(s.monto, p.cur)}</span>
          ${modo === 'real' ? `<span class="num an-dif ${s.diferencia < 0 ? 'over' : 'ok'}">${
            s.diferencia === 0 ? '=' : s.diferencia > 0 ? `−${money(s.diferencia, p.cur)}` : `+${money(-s.diferencia, p.cur)}`}</span>` : ''}
        </div>`).join('')}
      </div>` : `<div class="empty">${modo === 'real'
        ? 'Sin gastos registrados en este mes todavía.'
        : 'Sin nada repartido todavía: asigna montos en Categorías.'}</div>`}
    </div>`;
}
