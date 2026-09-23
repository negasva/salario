import * as store from '../store.js';
import { gastoPorCategoria, serieMensual } from '../engine/movimientos.js';
import { arcos, segmentosPorCategoria, barras, linea } from '../engine/graficas.js';
import { money, moneySigno, esc, MESES_CORTOS } from '../format.js';
import { selectorMes, enlazarMes, cabeceraMes, mesElegido } from './mes.js';

const R = 64;
const C = Math.round(2 * Math.PI * R * 100) / 100;

function donut(segmentos) {
  const trozos = arcos(segmentos, C);
  if (!trozos.length) {
    return `<svg class="donut" viewBox="0 0 160 160" role="img" aria-label="Sin gastos">
      <circle cx="80" cy="80" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="18"></circle></svg>`;
  }
  return `<svg class="donut" viewBox="0 0 160 160" role="img" aria-label="Gasto por categoría">
    <circle cx="80" cy="80" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="18"></circle>
    ${trozos.map((t) => `<circle cx="80" cy="80" r="${R}" fill="none" stroke="${t.color}" stroke-width="18"
      stroke-dasharray="${t.largo} ${t.resto}" stroke-dashoffset="${t.offset}"><title>${esc(t.nombre)}: ${money(t.monto)} · ${t.pct}%</title></circle>`).join('')}
  </svg>`;
}

function etiquetaMes(per) {
  return MESES_CORTOS[Number(per.slice(5, 7)) - 1];
}

/* Barras de entró contra salió. El mes elegido va a todo color y los de
   atrás más tenues, para que el ojo caiga en el que se está mirando. */
function graficaBarras(serie) {
  const ALTO = 120;
  const b = barras(serie, ALTO);
  const ancho = 48;
  const ult = b.length - 1;
  return `<svg class="barras" viewBox="0 0 ${b.length * ancho} ${ALTO + 22}" role="img" aria-label="Ingresos y gastos de los últimos ${b.length} meses">
    ${[0.25, 0.5, 0.75].map((f) => `<line x1="0" x2="${b.length * ancho}" y1="${ALTO * f}" y2="${ALTO * f}" class="rejilla" />`).join('')}
    <line x1="0" x2="${b.length * ancho}" y1="${ALTO}" y2="${ALTO}" class="base" />
    ${b.map((x, i) => `<g class="${i === ult ? 'actual' : 'pasado'}">
      <rect x="${i * ancho + 9}" y="${ALTO - x.ingresos}" width="14" height="${x.ingresos}" rx="3" fill="var(--pos-fill)"><title>${etiquetaMes(x.periodo)}: entró ${money(serie[i].ingresos)}</title></rect>
      <rect x="${i * ancho + 25}" y="${ALTO - x.gastos}" width="14" height="${x.gastos}" rx="3" fill="var(--neg-fill)"><title>${etiquetaMes(x.periodo)}: salió ${money(serie[i].gastos)}</title></rect>
      <text x="${i * ancho + 24}" y="${ALTO + 16}" text-anchor="middle" class="eje">${etiquetaMes(x.periodo)}</text>
    </g>`).join('')}
  </svg>`;
}

function graficaLinea(serie) {
  const W = 288; const H = 100;
  const { puntos, cero } = linea(serie, W, H);
  const d = puntos.map((pt, i) => `${i ? 'L' : 'M'}${pt.x} ${pt.y}`).join(' ');
  const area = puntos.length ? `${d} L${puntos[puntos.length - 1].x} ${cero} L${puntos[0].x} ${cero} Z` : '';
  return `<svg class="linea" viewBox="-10 -10 ${W + 20} ${H + 38}" role="img" aria-label="Saldo al final de cada mes">
    <path d="${area}" fill="var(--brand)" fill-opacity=".12" />
    <line x1="0" x2="${W}" y1="${cero}" y2="${cero}" class="cero" />
    <path d="${d}" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
    ${puntos.map((pt, i) => `<circle cx="${pt.x}" cy="${pt.y}" r="${i === puntos.length - 1 ? 5.5 : 4}" fill="${pt.final < 0 ? 'var(--neg-fill)' : 'var(--pos-fill)'}" stroke="var(--surface)" stroke-width="2"><title>${etiquetaMes(pt.periodo)}: ${moneySigno(pt.final)}</title></circle>
      <text x="${pt.x}" y="${H + 22}" text-anchor="middle" class="eje ${i === puntos.length - 1 ? 'eje-actual' : ''}">${etiquetaMes(pt.periodo)}</text>`).join('')}
  </svg>`;
}

export function renderInicio(root) {
  const p = store.active();
  const per = mesElegido();
  const porCat = gastoPorCategoria(p.movs, per);
  const segmentos = segmentosPorCategoria(p.cats, porCat);
  const total = segmentos.reduce((t, s) => t + s.monto, 0);
  const serie = serieMensual(p.saldoInicial, p.movs, per, 6, p.arranques);
  const trozos = arcos(segmentos, C);
  const mayor = trozos[0]?.pct || 0;

  root.innerHTML = `
    ${selectorMes('Inicio')}
    ${cabeceraMes(p, per)}
    <div class="grid-2">
      <section class="card">
        <div class="card-head"><h2 class="card-title">Gasto por categoría</h2></div>
        <div class="donut-bloque">
          <div class="donut-wrap">
            ${donut(segmentos)}
            <div class="donut-centro"><span>Salió</span><b class="num">${money(total)}</b></div>
          </div>
          ${trozos.length ? `<ul class="lista-cat">${trozos.map((s) => `<li class="fila-cat">
              <span class="dot" style="background:${s.color}"></span>
              <span class="fc-n">${esc(s.nombre)}</span>
              <span class="num fc-monto">${money(s.monto)}</span>
              <span class="num fc-pct">${s.pct}%</span>
              <span class="fc-barra" aria-hidden="true"><i style="width:${mayor ? (s.pct / mayor) * 100 : 0}%;background:${s.color}"></i></span></li>`).join('')}</ul>`
    : '<div class="empty">Sin gastos este mes.</div>'}
        </div>
      </section>
      <div class="stack">
        <section class="card">
          <div class="card-head"><h2 class="card-title">Entró y salió</h2><span class="card-meta">Últimos 6 meses</span></div>
          ${graficaBarras(serie)}
          <div class="leyenda"><span><i class="dot" style="background:var(--pos-fill)"></i>Entró</span><span><i class="dot" style="background:var(--neg-fill)"></i>Salió</span></div>
        </section>
        <section class="card">
          <div class="card-head"><h2 class="card-title">Con qué terminas cada mes</h2></div>
          ${graficaLinea(serie)}
        </section>
      </div>
    </div>`;

  enlazarMes(root, () => renderInicio(root));
}
