import * as store from '../store.js';
import { balance, amount, shareOf, r2, diagnosticoEsenciales } from '../engine/reparto.js';
import { monthsToGoal, whenText, plazo } from '../engine/metas.js';
import { renglonesQueCrecieron, renglonesSobreTope } from '../engine/alertas.js';
import { porLinea } from '../engine/movimientos.js';
import { pintarResultados } from './buscador.js';
import { preguntarIA, explicar } from '../ia.js';
import { contextoIA } from './preguntar.js';
import { icon } from './icons.js';
import { ordenadas } from '../engine/fila.js';
import { money, plain, esc, digits, MESES } from '../format.js';
import { periodoDe, hoyISO, ingresoReal, resumenFlujo, serieAhorro, serieTasaAhorro } from '../engine/movimientos.js';
import { tarjetaResumenFlujo } from './resumen.js';
import { saldoActual, saldoBase } from '../engine/saldo.js';
import { MONEDAS } from '../engine/moneda.js';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function mesCorto(periodo) {
  const m = Number(String(periodo).split('-')[1]);
  return MESES_CORTOS[m - 1] || periodo;
}

// tasa de ahorro del mes vivo: corto plazo + largo plazo, sobre lo que entra
function tasaAhorro(p, inc) {
  return r2(p.items.filter((it) => it.r === 'cor' || it.r === 'lar')
    .reduce((s, it) => s + shareOf(it, inc), 0));
}

export function sparkline(rates, extras = [], w = 900, h = 220, pad = 34) {
  const min = Math.min(...rates, 0);
  const max = Math.max(...rates);
  const range = max - min || 1;
  const pts = rates.map((v, i) => ({
    x: pad + (i / Math.max(1, rates.length - 1)) * (w - 2 * pad),
    y: h - pad - ((v - min) / range) * (h - 2 * pad),
  }));
  const line = pts.map((pt) => `${pt.x},${pt.y}`).join(' ');
  const area = `M${pts[0].x},${h} L${pts.map((pt) => `${pt.x},${pt.y}`).join(' L')} L${pts[pts.length - 1].x},${h} Z`;
  const guias = [0.25, 0.5, 0.75].map((k) => `<line x1="0" x2="${w}" y1="${pad + k * (h - 2 * pad)}"
    y2="${pad + k * (h - 2 * pad)}" stroke="var(--pink-wash)" stroke-width="1"
    vector-effect="non-scaling-stroke"></line>`).join('');
  const extraMarkers = pts.map((pt, i) => extras[i] ? `<circle cx="${pt.x}" cy="${pt.y}" r="5" fill="var(--success)"></circle>` : '').join('');
  // punto hueco por dato, sólido el último; encima un blanco grande e invisible
  // que es el que recibe el cursor, porque un radio de 4px no se acierta con el ratón
  const puntos = pts.map((pt, i) => `<circle cx="${pt.x}" cy="${pt.y}" r="${i === pts.length - 1 ? 6 : 4}"
    fill="${i === pts.length - 1 ? 'var(--pink-dark)' : 'var(--white)'}" stroke="var(--pink-dark)"
    stroke-width="2" vector-effect="non-scaling-stroke"></circle>`).join('');
  const zonas = pts.map((pt, i) => `<circle class="spark-hit" data-i="${i}" cx="${pt.x}" cy="${pt.y}"
    r="16" fill="transparent"></circle>`).join('');
  return `<svg class="spark-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--pink)" stop-opacity="0.45"></stop>
      <stop offset="100%" stop-color="var(--pink)" stop-opacity="0.02"></stop>
    </linearGradient></defs>
    ${guias}
    <path d="${area}" fill="url(#sparkFill)"></path>
    <polyline points="${line}" fill="none" stroke="var(--pink-dark)" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline>
    ${puntos}
    ${extraMarkers}
    ${zonas}
  </svg>`;
}

function ringSvg(pct, color) {
  const r = 32;
  const c = Math.round(2 * Math.PI * r * 100) / 100;
  const offset = Math.round(c * (1 - pct) * 100) / 100;
  return `<svg viewBox="0 0 80 80">
    <circle cx="40" cy="40" r="${r}" fill="none" stroke="var(--pink-wash)" stroke-width="7"></circle>
    <circle cx="40" cy="40" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${offset}" transform="rotate(-90 40 40)"></circle>
  </svg>`;
}

/* F9.5 — cuadrícula acomodable. Dos columnas con grid-auto-flow:dense, así que
   basta con guardar orden y ancho: nadie ve un hueco raro y no hay coordenadas
   que mantener. Fuera del modo edición nada se arrastra, para no mover una
   tarjeta sin querer al hacer scroll. */
const WIDGETS = ['ingreso', 'mes', 'tope', 'fondo', 'esenciales', 'alertas', 'buscar', 'pregunta', 'tasa', 'ahorro', 'reparto', 'metas'];
const ANCHO_DEFECTO = { esenciales: 2, alertas: 2, tasa: 2, ahorro: 2, buscar: 1, pregunta: 1 };
const NOMBRES = {
  ingreso: 'Ingreso del mes', mes: 'Tu mes', fondo: 'Fondo de emergencia',
  tope: 'Gasto máximo', esenciales: 'Aviso de gastos recurrentes', alertas: 'Alertas de tipo de concepto', tasa: 'Tasa de ahorro',
  ahorro: 'Ahorro acumulado', reparto: 'Reparto del ingreso', metas: 'Metas',
  buscar: 'Buscador', pregunta: 'Pregúntale a tus números',
};

let edicion = false;

function ordenWidgets(p) {
  const lay = p.dashLayout || {};
  // un widget nuevo entra al final, en el orden en que está declarado
  return WIDGETS.slice().sort((a, b) =>
    (lay[a]?.orden ?? 1000 + WIDGETS.indexOf(a)) - (lay[b]?.orden ?? 1000 + WIDGETS.indexOf(b)));
}

function anchoDe(p, id) {
  return p.dashLayout?.[id]?.ancho ?? ANCHO_DEFECTO[id] ?? 1;
}

function ocultoDe(p, id) {
  return !!p.dashLayout?.[id]?.oculto;
}

function guardarLayout(p, orden) {
  p.dashLayout = Object.fromEntries(orden.map((id, i) => [id, { orden: i, ancho: anchoDe(p, id), oculto: ocultoDe(p, id) }]));
  store.save();
}

function cablearLayout(root, p, orden) {
  root.querySelector('#dAcomodar').onclick = () => { edicion = !edicion; renderDashboard(root); };
  const reset = root.querySelector('#dReset');
  if (reset) reset.onclick = () => { delete p.dashLayout; store.save(); renderDashboard(root); };
  if (!edicion) return;

  const mover = (id, delta) => {
    const lista = orden.slice();
    const i = lista.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    lista.splice(j, 0, lista.splice(i, 1)[0]);
    guardarLayout(p, lista);
    renderDashboard(root);
  };

  root.querySelectorAll('.dash-w-tools .mv').forEach((b) => {
    b.onclick = () => mover(b.dataset.w, Number(b.dataset.mv));
  });
  root.querySelectorAll('.dash-w-tools .ver').forEach((b) => {
    b.onclick = () => {
      guardarLayout(p, orden);
      p.dashLayout[b.dataset.w].oculto = !ocultoDe(p, b.dataset.w);
      store.save();
      renderDashboard(root);
    };
  });
  root.querySelectorAll('.dash-w-tools .ancho').forEach((b) => {
    b.onclick = () => {
      guardarLayout(p, orden);
      p.dashLayout[b.dataset.w].ancho = anchoDe(p, b.dataset.w) === 2 ? 1 : 2;
      store.save();
      renderDashboard(root);
    };
  });

  // arrastrar y soltar nativo; se guarda al soltar, no en cada dragover
  const grid = root.querySelector('#dashGrid');
  let arrastrado = null;
  grid.querySelectorAll('.dash-w').forEach((el) => {
    el.ondragstart = (e) => {
      arrastrado = el.dataset.w;
      e.dataTransfer.effectAllowed = 'move';
      // sin setData Firefox y Safari no arrancan el arrastre
      e.dataTransfer.setData('text/plain', el.dataset.w);
    };
    el.ondragover = (e) => e.preventDefault();
    el.ondrop = (e) => {
      e.preventDefault();
      if (!arrastrado || arrastrado === el.dataset.w) return;
      const lista = orden.filter((id) => id !== arrastrado);
      lista.splice(lista.indexOf(el.dataset.w), 0, arrastrado);
      guardarLayout(p, lista);
      renderDashboard(root);
    };
  });
}

export async function renderDashboard(root) {
  const p = store.active();
  const inc = store.incomeRepartir(p);
  const incEse = store.incomeEsenciales(p);
  const b = balance(p.items, inc, p.goals);

  const ese = p.items.find((it) => it.r === 'ese');
  const diag = ese ? diagnosticoEsenciales(ese, incEse) : null;

  const { target, saved: fondoSaved, estado: fondoEstado, creado } = store.ensureFondoGoal(p);
  if (creado) store.save();


  const estadoMes = b.cuadrado
    ? 'Cuadrado. Repartiste todo lo que entra.'
    : b.falta > 0
      ? `Te falta repartir ${money(b.falta, p.cur)}.`
      : `Te pasaste por ${money(b.exceso, p.cur)}: asignaste plata que no tienes.`;

  const periodo = periodoDe(hoyISO());
  const ing = ingresoReal(p.movs, periodo);
  const flujo = resumenFlujo(p.movs, periodo);
  const hayNomina = ing.nomina > 0;
  const brecha = p.inc > 0 ? (ing.nomina - p.inc) / p.inc : 0;
  const [anio, mes] = periodo.split('-');
  const tituloIngreso = `Ingreso neto · ${MESES[Number(mes) - 1]} ${anio}`;

  const bloquesAhorro = p.items.filter((it) => it.r === 'cor' || it.r === 'lar').map((it) => it.id);
  const tasaReal = serieTasaAhorro(p.movs, bloquesAhorro, 1).at(-1)?.tasa ?? 0;
  const planAhorro = tasaAhorro(p, inc);
  const ahorroHoy = ing.total > 0 ? tasaReal : planAhorro;

  const badgeClass = fondoEstado === 'completo' ? 'ok' : fondoEstado === 'parcial' ? 'warn' : 'bad';

  const bloques = {
    ingreso: `<div class="card card-pink">
        <div class="income-head">
          <span class="label">${tituloIngreso}</span>
          <select id="dCurrency" aria-label="Moneda">
            ${MONEDAS.map((c) => `<option ${c === p.cur ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        ${hayNomina ? `<div class="kpi num">${money(ing.nomina, p.cur)}</div>` : ''}
        <input id="dIncome" class="income-input num" type="text" inputmode="numeric"
          value="${plain(p.inc, p.cur)}" aria-label="Ingreso neto mensual" ${hayNomina ? 'hidden' : ''}>
        <div class="sub">${hayNomina
          ? `Registrado en Movimientos · plan <b class="num">${money(p.inc, p.cur)}</b>
             <button class="mini" id="dPlanEdit">Editar el plan</button>`
          : 'Planeado · aún sin nómina registrada'}</div>
        ${ing.extra > 0 ? `<div class="sub">Extra este mes <b class="num">${money(ing.extra, p.cur)}</b></div>` : ''}
        ${hayNomina && Math.abs(brecha) > 0.05 ? `<div class="sub">
          Tu nómina real va ${money(Math.abs(ing.nomina - p.inc), p.cur)} por ${brecha > 0 ? 'encima' : 'debajo'} del plan.
          <button class="mini" id="dUsarReal">Usar el real como plan</button>
        </div>` : ''}
        <div class="sub">${p.ingresoTipo === 'variable'
          ? `Repartes sobre el promedio: <b class="num">${money(inc, p.cur)}</b>`
          : `${p.cur} · ingreso fijo`}</div>
      </div>`,

    mes: `<div class="card card-ink">
        <span class="label">Tu mes</span>
        <div class="kpi num">${money(b.asignado, p.cur)}</div>
        <div class="sub">${estadoMes}</div>
      </div>`,

    fondo: `<div class="card">
        <span class="label">Fondo de emergencia</span>
        <div class="kpi num">${money(fondoSaved, p.cur)}</div>
        <span class="badge ${badgeClass}">${fondoEstado}</span>
        <div class="sub">Objetivo ${money(target, p.cur)} (${plazo(p.fondoMeses)})</div>
      </div>`,

    esenciales: diag && diag.nivel !== 'verde' ? `<div class="card" style="border-color:var(--${diag.nivel === 'rojo' ? 'danger' : 'warning'})">
        <span class="label">Gastos recurrentes</span>
        <div class="sub" style="color:var(--${diag.nivel === 'rojo' ? 'danger' : 'warning'});font-weight:var(--fw-bold);font-size:var(--text-sm)">
          Tus gastos recurrentes suman ${money(diag.sum, p.cur)}, el ${diag.share}% del ingreso.
          ${diag.nivel === 'rojo' ? 'Es demasiado.' : 'Está en el límite.'}
        </div>
        ${diag.top3.length ? `<div class="sub">Lo que más pesa: ${diag.top3.map((l) => `${esc(l.n || 'sin nombre')} ${money(l.v, p.cur)} (${r2(l.pct)}%)`).join(' · ')}</div>` : ''}
      </div>` : '',

    tope: (() => {
      const tope = Number(p.gastoMaximo) || 0;
      const techo = Math.round((inc * tope) / 100);
      const gastado = flujo.gastos;
      const pct = techo > 0 ? Math.round((gastado / techo) * 100) : 0;
      const pasado = techo > 0 && gastado > techo;
      return `<div class="card">
        <span class="label">Gasto máximo recomendado</span>
        <div class="kpi num">${money(techo, p.cur)}</div>
        <div class="sub">Es el ${tope}% de lo que entra. Llevas gastado <b class="num ${pasado ? 'over' : ''}">${money(gastado, p.cur)}</b>${techo > 0 ? ` (${pct}%)` : ''}.</div>
        <div class="hist-track" style="margin-top:var(--space-2)"><i style="width:${Math.min(100, pct)}%;background:${pasado ? 'var(--danger)' : 'var(--success)'}"></i></div>
        <div class="sub">${pasado
          ? `Te pasaste por ${money(gastado - techo, p.cur)}.`
          : `Te quedan ${money(Math.max(0, techo - gastado), p.cur)} antes de pasarte.`}
          <button class="mini" id="dTopeEdit">Cambiar el tope</button></div>
      </div>`;
    })(),

    alertas: '<div id="dAlertas"></div>',

    buscar: `<div class="card">
        <span class="label">Buscar</span>
        <label class="search wide" style="margin-top:var(--space-3)">${icon('buscar', 'ic-sm')}
          <input id="dBuscar" placeholder="Un gasto, una meta, un tipo de concepto…" aria-label="Buscar en el perfil"></label>
        <div id="dBuscarRes"></div>
      </div>`,

    pregunta: `<div class="card">
        <span class="label" style="display:inline-flex;align-items:center;gap:6px">${icon('ia', 'ic-sm')} Pregúntale a tus números</span>
        <div class="sub">Ejemplo: ¿cuánto me queda libre este mes si sigo así?</div>
        <label class="search wide" style="margin-top:var(--space-3)">
          <input id="dPregunta" placeholder="Escribe tu pregunta" aria-label="Pregunta sobre tus números"></label>
        <div class="prow"><button class="mini" id="dPreguntaBtn">Preguntar</button></div>
        <div id="dRespuesta" class="sub"></div>
      </div>`,

    tasa: `<div class="card">
        <div class="spark-head">
          <span class="label">Tasa de ahorro</span>
          <span class="spark-val num">${ahorroHoy}%</span>
        </div>
        <div class="sub" style="margin-top:0">${ing.total > 0
          ? `De verdad este mes · plan ${planAhorro}%`
          : `Planeado · aún sin ingresos del mes`}</div>
        <div id="dSpark"><div class="sub">Cargando historial…</div></div>
      </div>`,

    ahorro: '<div class="card" id="dAhorro"></div>',

    reparto: `<div class="card">
        <span class="label">Reparto del ingreso</span>
        ${p.items.length ? p.items.map((it) => `
          <div class="repline">
            <span class="dot" style="background:${it.c}"></span>
            <span class="nm" title="${esc(it.n)}">${esc(it.n)}</span>
            <span class="track"><i style="width:${Math.min(100, shareOf(it, inc))}%;background:${it.c}"></i></span>
            <span class="pv num">${money(amount(it), p.cur)}</span>
          </div>`).join('') : '<div class="empty">Sin categorías.</div>'}
      </div>`,

    metas: `<div class="card" style="display:flex;flex-direction:column">
        <span class="label">Metas</span>
        ${p.goals.length ? `<div class="rings">
          ${ordenadas(p.goals).map((g) => {
            const pct = g.t > 0 ? Math.min(1, (g.s || 0) / g.t) : 0;
            const n = monthsToGoal(g);
            const segunda = n ? `faltan ${plazo(n)} · hacia ${whenText(n)}` : 'sin aporte mensual';
            return `<div class="ring">
              <div class="wrap">
                ${ringSvg(pct, g.special === 'emergencia' ? 'var(--warning)' : 'var(--pink)')}
                <div class="pct num">${Math.round(pct * 100)}%</div>
              </div>
              <div class="lbl">${esc(g.n)}</div>
              <div class="sub num">${money(g.s || 0, p.cur)} de ${money(g.t, p.cur)}</div>
              <div class="sub">${segunda}</div>
            </div>`;
          }).join('')}
        </div>` : '<div class="empty">Sin metas todavía.</div>'}
      </div>`,
  };

  const orden = ordenWidgets(p);
  // fuera del modo edición un widget oculto no existe; dentro se ve apagado,
  // que es la única forma de poder volver a encenderlo
  const visibles = edicion ? orden : orden.filter((id) => !ocultoDe(p, id));
  root.innerHTML = `
    ${tarjetaResumenFlujo(flujo, p.cur, saldoActual(saldoBase(p), p.movs))}
    <div class="dash-tools">
      <button class="mini" id="dAcomodar">${edicion ? 'Listo' : 'Acomodar'}</button>
      ${edicion ? '<button class="mini" id="dReset">Restablecer</button>' : ''}
    </div>
    <div class="dash-grid${edicion ? ' dash-edit' : ''}" id="dashGrid">
      ${visibles.map((id) => `<div class="dash-w${anchoDe(p, id) === 2 ? ' w2' : ''}${ocultoDe(p, id) ? ' dash-off' : ''}" data-w="${id}"
        ${edicion ? 'draggable="true"' : ''}>
        ${edicion ? `<div class="dash-w-tools">
          <span class="mini asa" draggable="true" title="Arrastrar">⠿ Mover</span>
          <button class="mini ver" data-w="${id}">${ocultoDe(p, id) ? 'Mostrar' : 'Quitar'}</button>
          <button class="mini ancho" data-w="${id}">${anchoDe(p, id) === 2 ? 'Angosta' : 'Ancha'}</button>
          <button class="mini mv" data-mv="-1" data-w="${id}" aria-label="Subir">↑</button>
          <button class="mini mv" data-mv="1" data-w="${id}" aria-label="Bajar">↓</button>
        </div>` : ''}
        ${ocultoDe(p, id) ? `<div class="card"><div class="empty">${NOMBRES[id]} — quitado del dashboard</div></div>` : bloques[id]}
      </div>`).join('')}
    </div>`;

  cablearLayout(root, p, orden);
  cablearBuscador(root, p);
  cablearPregunta(root, p, { inc, ing, ahorroHoy, fondoSaved, target, diag });

  // el widget del ingreso se puede haber quitado del dashboard
  const incomeEl = root.querySelector('#dIncome');
  if (incomeEl) incomeEl.onchange = (e) => {
    p.inc = digits(e.target.value);
    store.save();
    renderDashboard(root);
  };
  // el plan sigue siendo lo que reparte: cambiarlo es un clic, nunca automático
  const editar = root.querySelector('#dPlanEdit');
  if (editar) editar.onclick = () => {
    const input = root.querySelector('#dIncome');
    input.hidden = false;
    input.focus();
  };
  const usarReal = root.querySelector('#dUsarReal');
  if (usarReal) usarReal.onclick = () => {
    p.inc = ing.nomina;
    store.save();
    renderDashboard(root);
  };
  // el tope se ajusta donde se ve, sin ir a Ajustes
  const topeEdit = root.querySelector('#dTopeEdit');
  if (topeEdit) topeEdit.onclick = () => {
    const campo = document.createElement('input');
    campo.type = 'number';
    campo.min = '10';
    campo.max = '100';
    campo.value = String(p.gastoMaximo || 70);
    campo.className = 'num';
    topeEdit.replaceWith(campo);
    campo.focus();
    campo.onchange = () => {
      p.gastoMaximo = Math.min(100, Math.max(10, Number(campo.value) || 70));
      store.save();
      renderDashboard(root);
    };
  };

  const curEl = root.querySelector('#dCurrency');
  if (curEl) curEl.onchange = (e) => {
    p.cur = e.target.value;
    store.save();
    renderDashboard(root);
  };

  pintarAhorro(root, p);

  pintarTasa(root, p);
  pintarTopes(root, p);
  // las alertas de renglón sí necesitan los cierres, que viven en Supabase
  paintAlertas(root, p);
}

function cablearBuscador(root, p) {
  const input = root.querySelector('#dBuscar');
  if (!input) return;
  const res = root.querySelector('#dBuscarRes');
  input.oninput = () => pintarResultados(res, p, input.value);
}

/* La IA no calcula: la app le pasa las cifras ya hechas y ella solo las cuenta
   en español. Sin la función desplegada, lo dice en vez de fingir. */
function cablearPregunta(root, p, datos) {
  const btn = root.querySelector('#dPreguntaBtn');
  if (!btn) return;
  const input = root.querySelector('#dPregunta');
  const salida = root.querySelector('#dRespuesta');

  const preguntar = async () => {
    const q = input.value.trim();
    if (q.length < 4) return;
    salida.textContent = 'Pensando…';
    const contexto = contextoIA(p, {
      tasaDeAhorro: `${datos.ahorroHoy}%`,
      fondoDeEmergencia: `${datos.fondoSaved} de ${datos.target}`,
      gastosRecurrentesPctDelIngreso: datos.diag ? datos.diag.share : null,
    });
    const { respuesta, error } = await preguntarIA(q, contexto);
    salida.textContent = error ? explicar(error) : (respuesta || 'El modelo no contestó nada.');
  };

  btn.onclick = preguntar;
  input.onkeydown = (e) => { if (e.key === 'Enter') preguntar(); };
}

/* La gráfica se alimenta del libro, no de los cierres: así hay datos desde el
   primer mes. Al cambiar el filtro solo se repinta esta tarjeta. */
function pintarAhorro(root, p, destino = null) {
  const box = root.querySelector('#dAhorro');
  if (!box) return;
  if (!p.movs.length) {
    box.innerHTML = `<span class="label">Ahorro acumulado</span>
      <div class="empty">Registra tus primeros movimientos y aquí verás cómo crece tu ahorro.</div>`;
    return;
  }
  const bloques = p.items.filter((it) => it.r === 'cor' || it.r === 'lar');
  const serie = serieAhorro(p.movs, destino, 12, bloques.map((it) => it.id));
  const filas = serie.slice().reverse();

  box.innerHTML = `
    <div class="spark-head">
      <span class="label">Ahorro acumulado</span>
      <select id="dAhorroFiltro" aria-label="Qué ahorro">
        <option value="">Todo</option>
        ${ordenadas(p.goals).length ? `<optgroup label="Metas">
          ${ordenadas(p.goals).map((g) => `<option value="meta:${g.id}">${esc(g.n)}</option>`).join('')}
        </optgroup>` : ''}
        ${bloques.length ? `<optgroup label="Bloques">
          ${bloques.map((it) => `<option value="item:${it.id}">${esc(it.n)}</option>`).join('')}
        </optgroup>` : ''}
        <option value="deuda">Pago de deudas</option>
      </select>
    </div>
    <div class="kpi num">${money(serie[serie.length - 1].acumulado, p.cur)}</div>
    <div class="spark-wrap">
      ${sparkline(serie.map((r) => r.acumulado))}
      <div class="spark-tip" hidden></div>
    </div>
    <div class="spark-months">${serie.map((r) => `<span>${mesCorto(r.periodo)}</span>`).join('')}</div>
    <div class="hist-list">
      <div class="mov-res sub"><span class="nm">Mes</span><span>Aportado</span><span>Acumulado</span></div>
      ${filas.map((r) => `<div class="mov-res">
        <span class="nm">${mesCorto(r.periodo)} ${r.periodo.slice(0, 4)}</span>
        <span class="num">${money(r.monto, p.cur)}</span>
        <span class="num mov-res-d">${money(r.acumulado, p.cur)}</span>
      </div>`).join('')}
    </div>`;

  // el globo con la cifra del punto que tiene el cursor encima
  const wrap = box.querySelector('.spark-wrap');
  const tip = box.querySelector('.spark-tip');
  wrap.querySelectorAll('.spark-hit').forEach((hit) => {
    hit.onmouseenter = () => {
      const r = serie[Number(hit.dataset.i)];
      const caja = wrap.getBoundingClientRect();
      const punto = hit.getBoundingClientRect();
      tip.innerHTML = `<b>${mesCorto(r.periodo)} ${r.periodo.slice(0, 4)}</b>
        <span class="num">${money(r.acumulado, p.cur)} acumulado</span>
        <span class="num sub">${r.monto > 0 ? `+${money(r.monto, p.cur)} ese mes` : 'sin aportes ese mes'}</span>`;
      tip.hidden = false;
      tip.style.left = `${Math.min(caja.width - tip.offsetWidth - 4, Math.max(4, punto.left - caja.left + punto.width / 2 - tip.offsetWidth / 2))}px`;
      tip.style.top = `${Math.max(4, punto.top - caja.top - tip.offsetHeight - 8)}px`;
    };
    hit.onmouseleave = () => { tip.hidden = true; };
  });

  const filtro = box.querySelector('#dAhorroFiltro');
  filtro.value = destino || '';
  filtro.onchange = () => pintarAhorro(root, p, filtro.value || null);
}

/* La tasa sale del libro, igual que la gráfica de ahorro: hay tendencia desde
   el primer mes registrado y no desde el tercer cierre. */
function pintarTasa(root, p) {
  const box = root.querySelector('#dSpark');
  if (!box) return;
  const bloques = p.items.filter((it) => it.r === 'cor' || it.r === 'lar').map((it) => it.id);
  const serie = serieTasaAhorro(p.movs, bloques, 6);
  if (!p.movs.length) {
    box.innerHTML = '<div class="sub">Registra ingresos y ahorro y aquí verás tu tasa mes a mes.</div>';
    return;
  }
  box.innerHTML = `
    <div class="sub" style="margin-top:0">Últimos ${serie.length} meses, según lo registrado</div>
    ${sparkline(serie.map((r) => r.tasa))}
    <div class="spark-months">${serie.map((r) => `<span>${mesCorto(r.periodo)}</span>`).join('')}</div>`;
}

/* El tope avisa el mismo mes; la alerta de renglón que creció avisa el mes
   siguiente. Las dos viven en la misma tarjeta. */
function pintarTopes(root, p) {
  const box = root.querySelector('#dAlertas');
  if (!box) return;
  const sobre = renglonesSobreTope(p.items, porLinea(p.movs, periodoDe(hoyISO())));
  if (!sobre.length) return;
  box.innerHTML = sobre.map((t) => `
    <div class="card" style="border-color:var(--${t.pct >= 100 ? 'danger' : 'warning'})">
      <span class="label">Tope de ${esc(t.nombre)}</span>
      <div class="sub" style="color:var(--ink);font-weight:var(--fw-bold);font-size:var(--text-sm)">
        ${t.pct >= 100
          ? `Te pasaste del tope: llevas ${money(t.real, p.cur)} de ${money(t.tope, p.cur)}.`
          : `Vas en el ${t.pct}% del tope: quedan ${money(t.resto, p.cur)} para el resto del mes.`}
      </div>
    </div>`).join('') + box.innerHTML;
}

async function paintAlertas(root, p) {
  let cierres = [];
  try {
    cierres = await store.listarCierres();
  } catch {
    return;
  }
  const dAlertas = root.querySelector('#dAlertas');
  if (dAlertas) {
    const alertas = renglonesQueCrecieron(cierres, null, 15)
      .filter((a) => !store.alertaEstaSilenciada(a.lineId));
      
    if (alertas.length > 0) {
      dAlertas.innerHTML += alertas.map((a) => `
        <div class="card" style="border-color:var(--warning)">
          <span class="label">Atención</span>
          <div class="sub" style="color:var(--ink);font-weight:var(--fw-bold);font-size:var(--text-sm)">
            Tu ${esc(a.nombre)} pasó de ${money(a.promedioAnterior, p.cur)} a ${money(a.actual, p.cur)} en ${a.meses} meses. Es un ${a.deltaPct}% más.
          </div>
          <div style="margin-top:var(--sp-4);display:flex;gap:var(--sp-2)">
            <button class="btn-primary" data-line="${a.lineId}">Ver movimientos</button>
            <button class="btn-secondary" data-silenciar="${a.lineId}">Está bien, es a propósito</button>
          </div>
        </div>
      `).join('');
      
      dAlertas.querySelectorAll('.btn-primary').forEach((btn) => {
        btn.onclick = () => window.dispatchEvent(new CustomEvent('ir-a-vista', { detail: { route: 'movimientos', args: { lineId: btn.dataset.line } } }));
      });
      dAlertas.querySelectorAll('.btn-secondary').forEach((btn) => {
        btn.onclick = () => {
          store.silenciarAlerta(btn.dataset.silenciar);
          renderDashboard(root); // re-render para ocultar
        };
      });
    }
  }
}
