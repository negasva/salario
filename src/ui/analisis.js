import * as store from '../store.js';
import { segmentosReal, segmentosDeSnapshot, arcos } from '../engine/analisis.js';
import { periodoDe, hoyISO, ingresoReal, porLinea } from '../engine/movimientos.js';
import { resumenItem, pagosLibresDeItem, SIN_CONCEPTO } from '../engine/pagos.js';
import { money, esc, MESES } from '../format.js';
import { sinMotion } from './animar.js';
import { colorDe, claseDeItem } from '../engine/semantica.js';

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

/* F7 — cada trozo lleva su etiqueta completa en un <title>: el navegador la
   muestra como globo al pasar el cursor y los lectores de pantalla la leen,
   sin una línea de JavaScript ni una librería de gráficas. */
function donut(segmentos, cur) {
  const trozos = arcos(segmentos, C);
  if (!trozos.length) {
    return `<svg class="donut" viewBox="0 0 160 160" role="img" aria-label="Sin datos">
      <circle cx="80" cy="80" r="${R}" fill="none" stroke="var(--pink-wash)" stroke-width="22"></circle>
    </svg>`;
  }
  /* F9 — cada trozo es pulsable y enfocable. El giro de -90° pasó del atributo
     `transform` a CSS: si se queda como atributo, la clase `.on` no le puede
     añadir la escala sin pisarlo. */
  return `<svg class="donut" viewBox="0 0 160 160" role="group" aria-label="Reparto por categoría">
    ${trozos.map((t) => `<circle class="donut-seg" data-seg="${esc(t.id)}" cx="80" cy="80" r="${R}"
      fill="none" stroke="${t.color}" stroke-width="22" tabindex="0" role="button"
      aria-label="${esc(t.nombre)}: ${money(t.monto, cur)}, ${t.pct}%"
      stroke-dasharray="${t.largo} ${t.resto}" stroke-dashoffset="${t.offset}"
      ><title>${esc(t.nombre)}: ${money(t.monto, cur)} · ${t.pct}%</title></circle>`).join('')}
  </svg>`;
}

/* Pasar el cursor por un ítem de la lista apaga los demás trozos del donut, y
   ahora el click fija esa selección en los dos sentidos: del donut a la lista y
   de la lista al donut. El hover se queda para el ratón, pero no basta —en un
   móvil no hay hover, y ahí el donut era un dibujo y nada más—.

   La selección vive en una variable de módulo y se vuelve a aplicar en cada
   render. Tiene que ser así: al pulsar una fila la vista se repinta entera para
   desplegar su detalle, y una selección guardada solo en el DOM se perdía en
   ese repintado —era justo el caso "de la lista al donut"—. Si el segmento
   elegido ya no existe, no se encuentra y no pasa nada. */
let segSeleccionado = null;

function enlazarResalte(box) {
  const pares = [...box.querySelectorAll('.an-fila[data-seg]')].map((fila) => {
    const grupo = fila.closest('.an-detalle') || box;
    const svg = grupo.querySelector('.donut');
    const trozo = svg?.querySelector(`.donut-seg[data-seg="${CSS.escape(fila.dataset.seg)}"]`);
    return trozo ? { fila, svg, trozo } : null;
  }).filter(Boolean);

  const limpiar = (svg) => {
    svg.classList.remove('atenuado');
    svg.querySelectorAll('.donut-seg').forEach((c) => c.classList.remove('sel', 'on'));
  };

  function pintar({ fila, svg, trozo }, conResalte) {
    svg.classList.add('atenuado');
    trozo.classList.add('sel', 'on');
    if (!conResalte) return;
    fila.classList.remove('resaltada');
    void fila.offsetWidth; // reinicia el destello si ya venía encendido
    fila.classList.add('resaltada');
    fila.scrollIntoView({ block: 'nearest', behavior: sinMotion() ? 'auto' : 'smooth' });
  }

  function seleccionar(par) {
    const yaEstaba = segSeleccionado === par.fila.dataset.seg;
    limpiar(par.svg);
    segSeleccionado = yaEstaba ? null : par.fila.dataset.seg; // segundo click deselecciona
    if (!yaEstaba) pintar(par, true);
  }

  // se vuelve a pintar lo que estuviera elegido antes del repintado, sin
  // destello ni scroll: el usuario no ha vuelto a pulsar nada
  const previo = pares.find((par) => par.fila.dataset.seg === segSeleccionado);
  if (previo) pintar(previo, false); else segSeleccionado = null;

  pares.forEach((par) => {
    const { fila, svg, trozo } = par;
    // el hover solo pinta si no hay nada fijado: si no, se pelea con la selección
    fila.onmouseenter = () => {
      if (svg.querySelector('.donut-seg.sel')) return;
      svg.classList.add('atenuado');
      trozo.classList.add('on');
    };
    fila.onmouseleave = () => {
      if (svg.querySelector('.donut-seg.sel')) return;
      svg.classList.remove('atenuado');
      trozo.classList.remove('on');
    };
    trozo.onclick = () => seleccionar(par);
    trozo.onkeydown = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      seleccionar(par);
    };
    /* La fila ya tenía su propio click para desplegar el detalle; el resalte se
       cuelga aparte para no quitárselo. */
    fila.addEventListener('click', () => seleccionar(par));
  });
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
        ${donut(segmentos, p.cur)}
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
        ${segmentos.map((s) => `<div class="an-fila" data-seg="${esc(s.id)}" data-item-id="${s.meta ? '' : s.id}">
          <span class="dot" style="background:${s.color}"></span>
          <span class="an-n">${esc(s.nombre)}</span>
          <span class="num an-pct">${s.pct}%</span>
          <span class="num an-monto">${money(s.monto, p.cur)}</span>
          <span class="num an-dif ${s.diferencia < 0 ? 'over' : 'ok'}">${
            s.diferencia === 0 ? '=' : s.diferencia > 0 ? `−${money(s.diferencia, p.cur)}` : `+${money(-s.diferencia, p.cur)}`}</span>
        </div>${detalleAbierto === s.id ? detalleCategoria(p, s.id, periodo) : ''}`).join('')}
      </div>` : '<div class="empty">Sin gastos registrados en este mes todavía.</div>'}
    </div>`;

  enlazarResalte(box);

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
  /* El color sale de la posición del concepto dentro de la categoría, no de su
     puesto en la lista filtrada: así un concepto conserva su color aunque otro
     se quede sin pagos ese mes. */
  const segmentos = res.filas
    .map((f, i) => ({ id: f.l.id, nombre: f.l.n || 'Sin nombre',
      color: colorDe(claseDeItem(it), i), monto: f.pagado }))
    .filter((seg) => seg.monto > 0);
  /* F8 — lo pagado sin concepto es la misma plata que ya cuenta en el total de
     la categoría: si no entra aquí, la gráfica dice que no hay pagos mientras
     la fila de arriba muestra el monto. Misma fuente para el total y el donut. */
  if (res.libre > 0) {
    segmentos.push({ id: `${itemId}-libre`, nombre: SIN_CONCEPTO,
      color: colorDe(claseDeItem(it), res.filas.length), monto: res.libre });
  }
  if (!segmentos.length) return '<div class="an-detalle empty">Sin pagos en esta categoría todavía.</div>';
  const total = segmentos.reduce((t, seg) => t + seg.monto, 0);
  return `<div class="an-detalle">
    ${donut(segmentos.map((seg) => ({ ...seg, pct: Math.round((seg.monto / total) * 1000) / 10 })), p.cur)}
    <div class="an-detalle-lista">
      ${segmentos.map((seg) => `<div class="an-fila" data-seg="${esc(seg.id)}">
        <span class="dot" style="background:${seg.color}"></span>
        <span class="an-n">${esc(seg.nombre)}</span>
        <span class="num an-monto">${money(seg.monto, p.cur)}</span></div>`).join('')}
    </div>
  </div>`;
}
