import * as store from '../store.js';
import { gastoPorCategoria, serieMensual } from '../engine/movimientos.js';
import { arcos, segmentosPorCategoria, barras, linea } from '../engine/graficas.js';
import { money, moneySigno, esc, MESES_CORTOS } from '../format.js';
import { selectorMes, enlazarMes, cabeceraMes, mesElegido } from './mes.js';

const R = 60;
const C = Math.round(2 * Math.PI * R * 100) / 100;

function donut(segmentos) {
  const trozos = arcos(segmentos, C);
  if (!trozos.length) {
    return `<svg class="donut" viewBox="0 0 160 160" role="img" aria-label="Sin gastos">
      <circle cx="80" cy="80" r="${R}" fill="none" stroke="var(--pink-wash)" stroke-width="22"></circle></svg>`;
  }
  return `<svg class="donut" viewBox="0 0 160 160" role="img" aria-label="Gasto por categoría">
    ${trozos.map((t) => `<circle cx="80" cy="80" r="${R}" fill="none" stroke="${t.color}" stroke-width="22"
      stroke-dasharray="${t.largo} ${t.resto}" stroke-dashoffset="${t.offset}"><title>${esc(t.nombre)}: ${money(t.monto)} · ${t.pct}%</title></circle>`).join('')}
  </svg>`;
}

function etiquetaMes(per) {
  return MESES_CORTOS[Number(per.slice(5, 7)) - 1];
}

function graficaBarras(serie) {
  const ALTO = 120;
  const b = barras(serie, ALTO);
  const ancho = 40;
  return `<svg class="barras" viewBox="0 0 ${b.length * ancho} ${ALTO + 20}" role="img" aria-label="Ingresos y gastos de los últimos ${b.length} meses">
    ${b.map((x, i) => `<g>
      <rect x="${i * ancho + 6}" y="${ALTO - x.ingresos}" width="12" height="${x.ingresos}" rx="2" fill="var(--sem-ingreso-2)"><title>${etiquetaMes(x.periodo)}: entró ${money(serie[i].ingresos)}</title></rect>
      <rect x="${i * ancho + 22}" y="${ALTO - x.gastos}" width="12" height="${x.gastos}" rx="2" fill="var(--sem-gasto-2)"><title>${etiquetaMes(x.periodo)}: salió ${money(serie[i].gastos)}</title></rect>
      <text x="${i * ancho + 20}" y="${ALTO + 14}" text-anchor="middle" class="eje">${etiquetaMes(x.periodo)}</text>
    </g>`).join('')}
  </svg>`;
}

function graficaLinea(serie) {
  const W = 240; const H = 100;
  const { puntos, cero } = linea(serie, W, H);
  const d = puntos.map((pt, i) => `${i ? 'L' : 'M'}${pt.x} ${pt.y}`).join(' ');
  return `<svg class="linea" viewBox="-8 -8 ${W + 16} ${H + 36}" role="img" aria-label="Saldo al final de cada mes">
    <line x1="0" x2="${W}" y1="${cero}" y2="${cero}" stroke="var(--line)" stroke-dasharray="4 4" />
    <path d="${d}" fill="none" stroke="var(--ink)" stroke-width="2" />
    ${puntos.map((pt) => `<circle cx="${pt.x}" cy="${pt.y}" r="4" fill="${pt.final < 0 ? 'var(--sem-gasto-2)' : 'var(--sem-ingreso-2)'}"><title>${etiquetaMes(pt.periodo)}: ${moneySigno(pt.final)}</title></circle>
      <text x="${pt.x}" y="${H + 20}" text-anchor="middle" class="eje">${etiquetaMes(pt.periodo)}</text>`).join('')}
  </svg>`;
}

export function renderInicio(root) {
  const p = store.active();
  const per = mesElegido();
  const porCat = gastoPorCategoria(p.movs, per);
  const segmentos = segmentosPorCategoria(p.cats, porCat);
  const total = segmentos.reduce((t, s) => t + s.monto, 0);
  const serie = serieMensual(p.saldoInicial, p.movs, per, 6, p.arranques);

  root.innerHTML = `
    ${selectorMes()}
    ${cabeceraMes(p, per)}
    <div class="grid-2">
      <div class="card">
        <span class="label">Gasto por categoría</span>
        <div class="donut-wrap">
          ${donut(segmentos)}
          <div class="donut-centro"><span class="label">Total</span><b class="num">${money(total)}</b></div>
        </div>
        ${segmentos.length ? `<div class="lista-cat">${arcos(segmentos, C).map((s) => `<div class="fila-cat">
            <span class="dot" style="background:${s.color}"></span>
            <span class="fc-n">${esc(s.nombre)}</span>
            <span class="num fc-pct">${s.pct}%</span>
            <span class="num fc-monto">${money(s.monto)}</span></div>`).join('')}</div>`
    : '<div class="empty">Sin gastos este mes.</div>'}
      </div>
      <div class="card">
        <span class="label">Entró y salió, últimos 6 meses</span>
        ${graficaBarras(serie)}
        <div class="leyenda"><span><i class="dot" style="background:var(--sem-ingreso-2)"></i> Entró</span><span><i class="dot" style="background:var(--sem-gasto-2)"></i> Salió</span></div>
        <span class="label" style="margin-top:var(--space-4)">Con qué terminas cada mes</span>
        ${graficaLinea(serie)}
      </div>
    </div>`;

  enlazarMes(root, () => renderInicio(root));
}
