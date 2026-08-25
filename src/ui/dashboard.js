import * as store from '../store.js';
import { total, r2, diagnosticoEsenciales } from '../engine/reparto.js';
import { monthsToGoal, whenText, plazo } from '../engine/metas.js';
import { renglonesQueCrecieron } from '../engine/alertas.js';
import { ordenadas, estadoDe, proyeccion } from '../engine/fila.js';
import { money, plain, esc, digits, MESES } from '../format.js';
import { periodoDe, hoyISO, ingresoReal, serieAhorro } from '../engine/movimientos.js';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function mesCorto(periodo) {
  const m = Number(String(periodo).split('-')[1]);
  return MESES_CORTOS[m - 1] || periodo;
}

// tasa de ahorro del mes vivo: corto plazo + largo plazo
function tasaAhorro(p) {
  const cor = p.items.find((it) => it.r === 'cor')?.p || 0;
  const lar = p.items.find((it) => it.r === 'lar')?.p || 0;
  return r2(cor + lar);
}

export function sparkline(rates, extras = [], w = 280, h = 90, pad = 6) {
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const range = max - min || 1;
  const pts = rates.map((v, i) => ({
    x: pad + (i / Math.max(1, rates.length - 1)) * (w - 2 * pad),
    y: h - pad - ((v - min) / range) * (h - 2 * pad),
  }));
  const line = pts.map((pt) => `${pt.x},${pt.y}`).join(' ');
  const area = `M${pts[0].x},${h} L${pts.map((pt) => `${pt.x},${pt.y}`).join(' L')} L${pts[pts.length - 1].x},${h} Z`;
  const extraMarkers = pts.map((pt, i) => extras[i] ? `<circle cx="${pt.x}" cy="${pt.y}" r="4" fill="var(--success)"></circle>` : '').join('');
  // el punto por dato hace legible una serie con meses en cero, que si no es una raya
  const puntos = pts.map((pt) => `<circle cx="${pt.x}" cy="${pt.y}" r="3" fill="var(--pink-dark)"
    vector-effect="non-scaling-stroke"></circle>`).join('');
  return `<svg class="spark-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <path d="${area}" fill="var(--pink-lighter)" opacity="0.55"></path>
    <polyline points="${line}" fill="none" stroke="var(--pink-dark)" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline>
    ${puntos}
    ${extraMarkers}
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
const WIDGETS = ['ingreso', 'mes', 'fondo', 'esenciales', 'alertas', 'tasa', 'ahorro', 'reparto', 'metas'];
const ANCHO_DEFECTO = { esenciales: 2, alertas: 2, tasa: 2, ahorro: 2 };

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

function guardarLayout(p, orden) {
  p.dashLayout = Object.fromEntries(orden.map((id, i) => [id, { orden: i, ancho: anchoDe(p, id) }]));
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
  const t = total(p.items);
  const diff = r2(100 - t);

  const ese = p.items.find((it) => it.r === 'ese');
  const diag = ese ? diagnosticoEsenciales(ese, incEse) : null;

  const { target, saved: fondoSaved, estado: fondoEstado, creado } = store.ensureFondoGoal(p);
  if (creado) store.save();

  const ahorroHoy = tasaAhorro(p);

  const estadoMes = Math.abs(diff) < 0.01
    ? 'Cuadrado. Repartiste el 100%.'
    : diff > 0
      ? `Quedan ${diff}% libres, ${money(inc * diff / 100, p.cur)} sin asignar.`
      : `Te pasaste ${Math.abs(diff)}%, son ${money(inc * Math.abs(diff) / 100, p.cur)} que no tienes.`;

  const periodo = periodoDe(hoyISO());
  const ing = ingresoReal(p.movs, periodo);
  const hayNomina = ing.nomina > 0;
  const brecha = p.inc > 0 ? (ing.nomina - p.inc) / p.inc : 0;
  const [anio, mes] = periodo.split('-');
  const tituloIngreso = `Ingreso neto · ${MESES[Number(mes) - 1]} ${anio}`;

  const proy = proyeccion(p.goals, p.items, inc);

  const badgeClass = fondoEstado === 'completo' ? 'ok' : fondoEstado === 'parcial' ? 'warn' : 'bad';

  const bloques = {
    ingreso: `<div class="card card-pink">
        <div class="income-head">
          <span class="label">${tituloIngreso}</span>
          <select id="dCurrency" aria-label="Moneda">
            ${['COP', 'MXN', 'USD', 'ARS', 'CLP', 'PEN', 'EUR'].map((c) => `<option ${c === p.cur ? 'selected' : ''}>${c}</option>`).join('')}
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
        <div class="kpi num">${t}%</div>
        <div class="sub">${estadoMes}</div>
      </div>`,

    fondo: `<div class="card">
        <span class="label">Fondo de emergencia</span>
        <div class="kpi num">${money(fondoSaved, p.cur)}</div>
        <span class="badge ${badgeClass}">${fondoEstado}</span>
        <div class="sub">Objetivo ${money(target, p.cur)} (${plazo(p.fondoMeses)})</div>
      </div>`,

    esenciales: diag && diag.nivel !== 'verde' ? `<div class="card" style="border-color:var(--${diag.nivel === 'rojo' ? 'danger' : 'warning'})">
        <span class="label">Esenciales</span>
        <div class="sub" style="color:var(--${diag.nivel === 'rojo' ? 'danger' : 'warning'});font-weight:var(--fw-bold);font-size:var(--text-sm)">
          Tus esenciales suman ${money(diag.sum, p.cur)}, el ${diag.share}% del ingreso.
          ${diag.nivel === 'rojo' ? 'Es demasiado.' : 'Está en el límite.'}
        </div>
        ${diag.top3.length ? `<div class="sub">Lo que más pesa: ${diag.top3.map((l) => `${esc(l.n || 'sin nombre')} ${money(l.v, p.cur)} (${r2(l.pct)}%)`).join(' · ')}</div>` : ''}
      </div>` : '',

    alertas: '<div id="dAlertas"></div>',

    tasa: `<div class="card">
        <div class="spark-head">
          <span class="label">Tasa de ahorro</span>
          <span class="spark-val num">${ahorroHoy}%</span>
        </div>
        <div id="dSpark"><div class="sub">Cargando historial…</div></div>
      </div>`,

    ahorro: '<div class="card" id="dAhorro"></div>',

    reparto: `<div class="card">
        <span class="label">Reparto del ingreso</span>
        ${p.items.length ? p.items.map((it) => `
          <div class="repline">
            <span class="dot" style="background:${it.c}"></span>
            <span class="nm" title="${esc(it.n)}">${esc(it.n)}</span>
            <span class="track"><i style="width:${Math.min(100, it.p)}%;background:${it.c}"></i></span>
            <span class="pv num">${it.p}%</span>
          </div>`).join('') : '<div class="empty">Sin categorías.</div>'}
      </div>`,

    metas: `<div class="card" style="display:flex;flex-direction:column">
        <span class="label">Metas</span>
        ${p.goals.length ? `<div class="rings">
          ${ordenadas(p.goals).map((g) => {
            const pct = g.t > 0 ? Math.min(1, (g.s || 0) / g.t) : 0;
            const est = estadoDe(g);
            const n = monthsToGoal(g, p.items, inc);
            const antes = proy[g.id]?.predecesor;
            const segunda = est === 'en_fila'
              ? (antes ? `Empieza cuando termines la ${esc(antes.n)}` : 'En fila')
              : n ? `faltan ${plazo(n)} · hacia ${whenText(n)}` : 'sin aporte mensual';
            return `<div class="ring${est === 'en_fila' ? ' ring-fila' : ''}">
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
  root.innerHTML = `
    <div class="dash-tools">
      <button class="mini" id="dAcomodar">${edicion ? 'Listo' : 'Acomodar'}</button>
      ${edicion ? '<button class="mini" id="dReset">Restablecer</button>' : ''}
    </div>
    <div class="dash-grid${edicion ? ' dash-edit' : ''}" id="dashGrid">
      ${orden.map((id) => `<div class="dash-w${anchoDe(p, id) === 2 ? ' w2' : ''}" data-w="${id}"
        ${edicion ? 'draggable="true"' : ''}>
        ${edicion ? `<div class="dash-w-tools">
          <span class="mini asa" draggable="true" title="Arrastrar">⠿ Mover</span>
          <button class="mini ancho" data-w="${id}">${anchoDe(p, id) === 2 ? 'Angosta' : 'Ancha'}</button>
          <button class="mini mv" data-mv="-1" data-w="${id}" aria-label="Subir">↑</button>
          <button class="mini mv" data-mv="1" data-w="${id}" aria-label="Bajar">↓</button>
        </div>` : ''}
        ${bloques[id]}
      </div>`).join('')}
    </div>`;

  cablearLayout(root, p, orden);

  root.querySelector('#dIncome').onchange = (e) => {
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
  root.querySelector('#dCurrency').onchange = (e) => {
    p.cur = e.target.value;
    store.save();
    renderDashboard(root);
  };

  pintarAhorro(root, p);

  // el historial viene de Supabase: la UI ya se pintó, esto solo rellena la tarjeta
  paintSpark(root, p, ahorroHoy);
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
    ${sparkline(serie.map((r) => r.acumulado))}
    <div class="spark-months">${serie.map((r) => `<span>${mesCorto(r.periodo)}</span>`).join('')}</div>
    <div class="hist-list">
      <div class="mov-res sub"><span class="nm">Mes</span><span>Aportado</span><span>Acumulado</span></div>
      ${filas.map((r) => `<div class="mov-res">
        <span class="nm">${mesCorto(r.periodo)} ${r.periodo.slice(0, 4)}</span>
        <span class="num">${money(r.monto, p.cur)}</span>
        <span class="num mov-res-d">${money(r.acumulado, p.cur)}</span>
      </div>`).join('')}
    </div>`;

  const filtro = box.querySelector('#dAhorroFiltro');
  filtro.value = destino || '';
  filtro.onchange = () => pintarAhorro(root, p, filtro.value || null);
}

async function paintSpark(root, p, ahorroHoy) {
  const box = root.querySelector('#dSpark');
  if (!box) return;
  let cierres = [];
  try {
    cierres = await store.listarCierres();
  } catch {
    box.innerHTML = '<div class="sub">No pude leer el historial.</div>';
    return;
  }
  if (!root.querySelector('#dSpark')) return; // el usuario cambió de vista

  if (cierres.length < 2) {
    const cor = p.items.find((it) => it.r === 'cor');
    const lar = p.items.find((it) => it.r === 'lar');
    const inc = store.incomeRepartir(p);
    const filas = [
      cor && { n: cor.n, p: cor.p, c: cor.c },
      lar && { n: lar.n, p: lar.p, c: lar.c },
    ].filter(Boolean);
    box.innerHTML = `
      ${filas.map((f) => `
        <div class="repline">
          <span class="dot" style="background:${f.c}"></span>
          <span class="nm" title="${esc(f.n)}">${esc(f.n)}</span>
          <span class="track"><i style="width:${Math.min(100, f.p)}%;background:${f.c}"></i></span>
          <span class="pv num">${money(inc * f.p / 100, p.cur)}</span>
        </div>`).join('')}
      <div class="sub">Para ver la tendencia mes a mes necesito al menos dos meses cerrados; llevas ${cierres.length}.</div>`;
    return;
  }

  const ultimos = cierres.slice(-6);
  const rates = ultimos.map((c) => Number(c.snapshot.ahorroRate) || 0);
  const extras = ultimos.map((c) => c.snapshot.ingresoExtra > 0);
  box.innerHTML = `
    <div class="sub" style="margin-top:0">Últimos ${ultimos.length} meses cerrados</div>
    ${sparkline(rates, extras)}
    <div class="spark-months">${ultimos.map((c) => `<span>${mesCorto(c.periodo)}</span>`).join('')}</div>`;

  const dAlertas = root.querySelector('#dAlertas');
  if (dAlertas) {
    const alertas = renglonesQueCrecieron(cierres, null, 15)
      .filter((a) => !store.alertaEstaSilenciada(a.lineId));
      
    if (alertas.length > 0) {
      dAlertas.innerHTML = alertas.map((a) => `
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
    } else {
      dAlertas.innerHTML = '';
    }
  }
}
