import { money, moneySigno, moneyCorto, compacto, esc, fechaCorta, MESES_CORTOS } from '../format.js';
import { arcos, barras, linea, escala, trazo } from '../engine/graficas.js';

/* Gráficas en SVG a mano. Cada función devuelve el HTML; los textos de ayuda
   van en `data-tip` y `enlazarTips` los muestra con el mouse y con el dedo.
   Las que se leen de un vistazo llevan un `aria-label` con la cifra clave. */

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
let ids = 0;
const mesCorto = (per) => MESES_CORTOS[Number(per.slice(5, 7)) - 1];

/* ---------- el donut y su lista ---------- */

const R = 64;
export const C = Math.round(2 * Math.PI * R * 100) / 100;

function donut(trozos) {
  const fondo = `<circle cx="80" cy="80" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="18"></circle>`;
  if (!trozos.length) return `<svg class="donut" viewBox="0 0 160 160" role="img" aria-label="Sin gastos">${fondo}</svg>`;
  return `<svg class="donut" viewBox="0 0 160 160" role="img" aria-label="Gasto por categoría: ${esc(trozos[0].nombre)} es el ${trozos[0].pct}%">
    ${fondo}
    ${trozos.map((t) => `<circle class="trozo-donut" cx="80" cy="80" r="${R}" fill="none" stroke="${t.color}" stroke-width="18"
      stroke-dasharray="${t.largo} ${t.resto}" stroke-dashoffset="${t.offset}" data-tip="${esc(t.nombre)}\n${money(t.monto)} · ${t.pct}%"></circle>`).join('')}
  </svg>`;
}

export function donutBloque(segmentos, rotulo = 'Salió', { lista = true, limite = Infinity, grafica = true } = {}) {
  const trozos = arcos(segmentos, C);
  const total = segmentos.reduce((t, s) => t + s.monto, 0);
  const mayor = trozos[0]?.pct || 0;
  return `<div class="donut-bloque">
    ${grafica ? `<div class="donut-wrap">${donut(trozos)}<div class="donut-centro"><span>${rotulo}</span><b class="num" title="${money(total)}">${moneyCorto(total, 12)}</b></div></div>` : ''}
    ${!lista ? '' : trozos.length ? `<ul class="lista-cat">${trozos.slice(0, limite).map((s) => `<li class="fila-cat">
        <span class="dot" style="background:${s.color}"></span>
        <span class="fc-n">${esc(s.nombre)}</span>
        <span class="num fc-monto">${money(s.monto)}</span>
        <span class="num fc-pct">${s.pct}%</span>
        <span class="fc-barra" aria-hidden="true"><i style="width:${mayor ? (s.pct / mayor) * 100 : 0}%;background:${s.color}"></i></span></li>`).join('')}</ul>
      ${trozos.length > limite ? `<a class="ver-mas" href="#reportes">${trozos.length - limite} categorías más en Reportes</a>` : ''}`
    : '<div class="empty">Sin gastos en este periodo.</div>'}
  </div>`;
}

/* ---------- barras de entró contra salió ---------- */

/* El mes resaltado va a todo color y los demás más tenues, para que el ojo
   caiga en el que se está mirando. `resaltar` es el índice de la serie. */
export function graficaBarras(serie, resaltar = serie.length - 1, W = serie.length * 48) {
  const ALTO = W > 420 ? 160 : 120;
  const b = barras(serie, ALTO);
  const ancho = W / b.length; const bw = Math.min(16, ancho * 0.28);
  return `<svg class="barras" viewBox="0 0 ${W} ${ALTO + 22}" role="img" aria-label="Ingresos y gastos de los últimos ${b.length} meses">
    ${[0.25, 0.5, 0.75].map((f) => `<line x1="0" x2="${W}" y1="${ALTO * f}" y2="${ALTO * f}" class="rejilla" />`).join('')}
    <line x1="0" x2="${W}" y1="${ALTO}" y2="${ALTO}" class="base" />
    ${b.map((x, i) => {
    const cx = i * ancho + ancho / 2;
    return `<g class="hit ${i === resaltar ? 'actual' : 'pasado'}" style="--i:${i}">
      <rect class="barra-in" x="${(cx - bw - 1).toFixed(1)}" y="${ALTO - x.ingresos}" width="${bw.toFixed(1)}" height="${x.ingresos}" rx="3" fill="var(--pos-fill)"></rect>
      <rect class="barra-in" x="${(cx + 1).toFixed(1)}" y="${ALTO - x.gastos}" width="${bw.toFixed(1)}" height="${x.gastos}" rx="3" fill="var(--neg-fill)"></rect>
      <text x="${cx.toFixed(1)}" y="${ALTO + 16}" text-anchor="middle" class="eje">${mesCorto(x.periodo)}</text>
      <rect class="zona" x="${(i * ancho).toFixed(1)}" y="0" width="${ancho.toFixed(1)}" height="${ALTO + 22}" data-tip="${mesCorto(x.periodo)}\nEntró ${money(serie[i].ingresos)}\nSalió ${money(serie[i].gastos)}"></rect>
    </g>`;
  }).join('')}
  </svg>`;
}

/* Lo que sobró (o faltó) cada mes: barras que suben desde el cero si hubo
   superávit y bajan si hubo déficit. */
export function graficaNeto(meses, W = meses.length * 48) {
  const ALTO = W > 420 ? 160 : 120; const mitad = ALTO / 2; const ancho = W / meses.length;
  const max = Math.max(1, ...meses.map((m) => Math.abs(m.neto)));
  const bw = Math.min(22, ancho * 0.42);
  return `<svg class="barras" viewBox="0 0 ${W} ${ALTO + 22}" role="img" aria-label="Lo que sobró o faltó cada mes del año">
    <line x1="0" x2="${W}" y1="${mitad}" y2="${mitad}" class="base" />
    ${meses.map((m, i) => {
    const h = Math.round((Math.abs(m.neto) / max) * mitad);
    const cx = i * ancho + ancho / 2;
    return `<g class="hit actual" style="--i:${i}">
      ${m.activo ? `<rect class="barra-in ${m.neto < 0 ? 'baja' : ''}" x="${(cx - bw / 2).toFixed(1)}" y="${m.neto >= 0 ? mitad - h : mitad}" width="${bw.toFixed(1)}" height="${Math.max(h, 2)}" rx="3" fill="${m.neto >= 0 ? 'var(--pos-fill)' : 'var(--neg-fill)'}"></rect>` : ''}
      <text x="${cx.toFixed(1)}" y="${ALTO + 16}" text-anchor="middle" class="eje">${mesCorto(m.periodo)}</text>
      <rect class="zona" x="${(i * ancho).toFixed(1)}" y="0" width="${ancho.toFixed(1)}" height="${ALTO + 22}" data-tip="${mesCorto(m.periodo)}\n${m.activo ? moneySigno(m.neto) : 'Sin movimientos'}"></rect>
    </g>`;
  }).join('')}
  </svg>`;
}

/* ---------- saldo final de cada mes ---------- */

export function graficaLinea(serie, Wtotal = 308) {
  const W = Wtotal - 20; const H = Wtotal > 420 ? 150 : 100;
  const { puntos, cero } = linea(serie, W, H);
  const d = puntos.map((pt, i) => `${i ? 'L' : 'M'}${pt.x} ${pt.y}`).join(' ');
  const area = puntos.length ? `${d} L${puntos[puntos.length - 1].x} ${cero} L${puntos[0].x} ${cero} Z` : '';
  const ult = puntos.length - 1;
  return `<svg class="linea" viewBox="-10 -10 ${W + 20} ${H + 38}" role="img" aria-label="Saldo al final de cada mes: ${moneySigno(puntos[ult]?.final)} en ${mesCorto(puntos[ult]?.periodo || '2000-01')}">
    <path d="${area}" fill="var(--brand)" fill-opacity=".10" class="area-in" />
    <line x1="0" x2="${W}" y1="${cero}" y2="${cero}" class="cero" />
    <path d="${d}" pathLength="1" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" class="trazo-in" />
    ${puntos.map((pt, i) => `<g class="hit"><circle class="punto" cx="${pt.x}" cy="${pt.y}" r="${i === ult ? 5.5 : 4}" fill="${pt.final < 0 ? 'var(--neg-fill)' : 'var(--pos-fill)'}" stroke="var(--surface)" stroke-width="2"></circle>
      <text x="${pt.x}" y="${H + 22}" text-anchor="middle" class="eje ${i === ult ? 'eje-actual' : ''}">${mesCorto(pt.periodo)}</text>
      <circle class="zona" cx="${pt.x}" cy="${pt.y}" r="16" data-tip="${mesCorto(pt.periodo)}\nTerminó con ${moneySigno(pt.final)}"></circle></g>`).join('')}
  </svg>`;
}

/* ---------- gasto acumulado contra el mes anterior ---------- */

/* Lo que llevas gastado día a día, contra lo que llevabas el mes pasado a la
   misma altura. Si el mes sigue en curso, una línea de puntos sigue el ritmo
   actual hasta fin de mes. */
export function lineaAcumulada({ periodo, actual, previo, proyeccion }, W = 640) {
  const H = W < 520 ? 210 : 240; const ML = 46; const MR = 14; const MT = 14; const MB = 28;
  const iw = W - ML - MR; const ih = H - MT - MB;
  const n = Math.max(actual.length, previo.length);
  const llenos = actual.filter((v) => v !== null);
  const { max, ticks } = escala(Math.max(0, ...llenos, ...previo, proyeccion || 0));
  const X = (i) => ML + (n > 1 ? (i * iw) / (n - 1) : 0);
  const Y = (v) => MT + (1 - v / max) * ih;
  const pts = (vals) => vals.map((v, i) => (v === null ? null : [X(i).toFixed(1), Y(v).toFixed(1)])).filter(Boolean);
  const camino = (p) => (p.length ? `M${p.map((q) => q.join(' ')).join(' L')}` : '');
  const pa = pts(actual); const pp = pts(previo);
  const ult = llenos.length - 1;
  const gid = `g-acum-${++ids}`;
  const paso = n > 1 ? iw / (n - 1) : iw;
  const cols = Array.from({ length: n }, (_, i) => {
    const dia = `${periodo}-${String(i + 1).padStart(2, '0')}`;
    const a = actual[i] ?? null;
    const txt = `${fechaCorta(dia)}\nEste mes ${a === null ? 'sin llegar' : money(a)}\nMes anterior ${previo[i] === undefined ? 'sin día' : money(previo[i])}`;
    return `<g class="hit"><line class="guia" x1="${X(i).toFixed(1)}" x2="${X(i).toFixed(1)}" y1="${MT}" y2="${MT + ih}"></line>
      ${a === null ? '' : `<circle class="punto-h" cx="${X(i).toFixed(1)}" cy="${Y(a).toFixed(1)}" r="4.5" fill="var(--brand)" stroke="var(--surface)" stroke-width="2"></circle>`}
      <rect class="zona" x="${(X(i) - paso / 2).toFixed(1)}" y="${MT}" width="${paso.toFixed(1)}" height="${ih}" data-tip="${txt}"></rect></g>`;
  }).join('');
  const marcas = Array.from({ length: n }, (_, i) => i + 1).filter((d) => d === 1 || d % 5 === 0);
  const resumen = ult >= 0 ? `Llevas ${money(llenos[ult])} gastado; el mes anterior a esta altura llevabas ${money(previo[Math.min(ult, previo.length - 1)] ?? 0)}` : 'Sin gastos todavía';
  return `<svg class="linea-acum" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gasto acumulado del mes. ${resumen}">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--brand);stop-opacity:.22"/><stop offset="1" style="stop-color:var(--brand);stop-opacity:0"/></linearGradient></defs>
    ${ticks.map((t) => `<line x1="${ML}" x2="${W - MR}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" class="${t === 0 ? 'base' : 'rejilla'}"></line>
      <text x="${ML - 8}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end" class="eje">${compacto(t)}</text>`).join('')}
    ${marcas.map((d) => `<text x="${X(d - 1).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="eje">${d}</text>`).join('')}
    <path d="${camino(pp)}" pathLength="1" fill="none" class="previo" stroke-width="2" stroke-dasharray="5 5" stroke-linecap="round"></path>
    ${pa.length ? `<path d="${camino(pa)} L${pa[pa.length - 1][0]} ${MT + ih} L${pa[0][0]} ${MT + ih} Z" fill="url(#${gid})" class="area-in"></path>` : ''}
    ${proyeccion !== null && ult >= 0 && ult < n - 1 ? `<path d="M${pa[pa.length - 1].join(' ')} L${X(n - 1).toFixed(1)} ${Y(proyeccion).toFixed(1)}" class="proy" fill="none" stroke-width="2" stroke-dasharray="1 6" stroke-linecap="round"></path>` : ''}
    <path d="${camino(pa)}" pathLength="1" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" class="trazo-in"></path>
    ${cols}
  </svg>`;
}

/* ---------- por día de la semana ---------- */

export function barrasSemana(totales, W = 336) {
  const ALTO = 112; const ancho = W / 7; const bw = Math.min(30, ancho * 0.5);
  const max = Math.max(...totales, 0);
  const ab = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const mayor = max > 0 ? totales.indexOf(max) : -1;
  return `<svg class="barras" viewBox="0 0 ${W} ${ALTO + 40}" role="img" aria-label="Gasto por día de la semana${mayor >= 0 ? `: gastas más los ${DIAS[mayor]}` : ''}">
    <line x1="0" x2="${W}" y1="${ALTO + 14}" y2="${ALTO + 14}" class="base"></line>
    ${totales.map((t, i) => {
    const h = max ? Math.max(Math.round((t / max) * ALTO), t > 0 ? 3 : 0) : 0;
    const x = i * ancho + ancho / 2;
    return `<g class="hit ${i === mayor ? 'actual' : 'pasado'}" style="--i:${i}">
      <rect class="barra-in ${i === mayor ? 'mayor' : 'resto'}" x="${(x - bw / 2).toFixed(1)}" y="${ALTO + 14 - h}" width="${bw.toFixed(1)}" height="${h}" rx="5"></rect>
      ${i === mayor ? `<text x="${x.toFixed(1)}" y="${ALTO + 14 - h - 6}" text-anchor="middle" class="eje eje-actual">${compacto(t)}</text>` : ''}
      <text x="${x.toFixed(1)}" y="${ALTO + 32}" text-anchor="middle" class="eje ${i === mayor ? 'eje-actual' : ''}">${ab[i]}</text>
      <rect class="zona" x="${(i * ancho).toFixed(1)}" y="0" width="${ancho.toFixed(1)}" height="${ALTO + 40}" data-tip="${DIAS[i][0].toUpperCase() + DIAS[i].slice(1)}\n${money(t)}"></rect>
    </g>`;
  }).join('')}
  </svg>`;
}

/* ---------- calendario de calor ---------- */

export function calendarioCalor({ periodo, vacias, celdas }, hoyDia = 0) {
  return `<div class="cal" role="group" aria-label="Gasto de cada día del mes">
    ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l) => `<span class="cal-h" aria-hidden="true">${l}</span>`).join('')}
    ${'<span class="cal-d vacio" aria-hidden="true"></span>'.repeat(vacias)}
    ${celdas.map((c) => {
    const fecha = fechaCorta(`${periodo}-${String(c.dia).padStart(2, '0')}`);
    const txt = c.gasto ? `${fecha}\nSalió ${money(c.gasto)}` : `${fecha}\nSin gastos`;
    return `<span class="cal-d n${c.nivel} ${c.dia === hoyDia ? 'hoy' : ''}" role="img" aria-label="${txt.replace('\n', ': ')}" data-tip="${txt}" style="--i:${c.dia}"><i>${c.dia}</i></span>`;
  }).join('')}
  </div>`;
}

/* ---------- línea pequeña de tendencia ---------- */

export function sparkline(valores, color) {
  const W = 72; const H = 24;
  const max = Math.max(...valores, 1);
  const p = trazo(valores, W - 6, H - 6, max).map((q) => [q.x + 3, q.y + 3]);
  const ult = p[p.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <path d="M${p.map((q) => q.join(' ')).join(' L')}" fill="none" stroke="${color}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" opacity=".9"></path>
    <circle cx="${ult[0]}" cy="${ult[1]}" r="2.5" fill="${color}"></circle></svg>`;
}

/* Una gráfica que se dibuja al ancho real de su contenedor, para que el texto
   de los ejes mida siempre lo mismo y no se estire con la pantalla. */
export function responsiva(el, dibujar) {
  let w = 0;
  const pintar = () => {
    const nuevo = Math.round(el.clientWidth);
    if (!nuevo || Math.abs(nuevo - w) < 24) return;
    w = nuevo;
    el.innerHTML = dibujar(nuevo);
  };
  new ResizeObserver(pintar).observe(el);
  pintar();
}

/* ---------- ayuda al pasar el mouse o tocar ---------- */

/* Un solo globo por pantalla, que sigue al puntero. Con el dedo aparece al
   tocar y se va al tocar en otro lado. Los saltos entre columnas son
   instantáneos: un globo que se anima cada vez estorba al leer. */
let alScroll = null;
window.addEventListener('scroll', () => alScroll?.(), { passive: true });

export function enlazarTips(root) {
  let porTeclado = false;
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'status');
  root.appendChild(tip);
  const ocultar = () => {
    tip.classList.remove('on');
    root.querySelectorAll('.hit.activo').forEach((g) => g.classList.remove('activo'));
  };
  const mostrar = (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (!t) { ocultar(); return; }
    root.querySelectorAll('.hit.activo').forEach((g) => g.classList.remove('activo'));
    t.closest('.hit')?.classList.add('activo');
    tip.textContent = t.dataset.tip;
    tip.classList.add('on');
    const { width: w, height: h } = tip.getBoundingClientRect();
    const x = e.clientX + 14 + w > innerWidth - 8 ? e.clientX - w - 14 : e.clientX + 14;
    const y = e.clientY - h - 14 < 8 ? e.clientY + 18 : e.clientY - h - 14;
    tip.style.transform = `translate(${Math.max(8, x)}px,${y}px)`;
  };
  // con teclado: la gráfica toma el foco y las flechas recorren sus datos
  root.querySelectorAll('.graf').forEach((g) => {
    const zonas = () => [...g.querySelectorAll('[data-tip]')];
    if (!zonas().length) return;
    g.tabIndex = 0;
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', `${g.querySelector('svg')?.getAttribute('aria-label') || 'Gráfica'}. Flechas para recorrer los datos.`);
    let i = -1;
    g.addEventListener('keydown', (e) => {
      porTeclado = true;
      const z = zonas();
      const paso = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = z.length - 1;
      else if (paso) i = Math.min(z.length - 1, Math.max(0, i + paso));
      else { if (e.key === 'Escape') ocultar(); return; }
      e.preventDefault();
      const b = z[i].getBoundingClientRect();
      mostrar({ target: z[i], clientX: b.left + b.width / 2, clientY: b.top + b.height / 3 });
    });
    g.addEventListener('blur', () => { porTeclado = false; ocultar(); });
  });
  root.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') mostrar(e); });
  root.addEventListener('pointerdown', mostrar);
  // con el dedo el globo se queda hasta que se toca otra cosa; con el mouse se va al salir
  root.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') ocultar(); });
  alScroll = () => { if (!porTeclado) ocultar(); };
}
