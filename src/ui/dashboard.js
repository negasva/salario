import * as store from '../store.js';
import { total, r2, diagnosticoEsenciales } from '../engine/reparto.js';
import { escalonActual, ESCALERA, monthsToGoal, whenText, plazo } from '../engine/metas.js';
import { recomendar } from '../engine/consejo.js';
import { money, plain, esc, digits } from '../format.js';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function nombreMes(periodo) {
  const [a, m] = periodo.split('-');
  const largo = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${largo[Number(m) - 1]}${Number(a) === new Date().getFullYear() ? '' : ` de ${a}`}`;
}

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

export function sparkline(rates, w = 280, h = 90, pad = 6) {
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const range = max - min || 1;
  const pts = rates.map((v, i) => ({
    x: pad + (i / Math.max(1, rates.length - 1)) * (w - 2 * pad),
    y: h - pad - ((v - min) / range) * (h - 2 * pad),
  }));
  const line = pts.map((pt) => `${pt.x},${pt.y}`).join(' ');
  const area = `M${pts[0].x},${h} L${pts.map((pt) => `${pt.x},${pt.y}`).join(' L')} L${pts[pts.length - 1].x},${h} Z`;
  return `<svg width="100%" height="110" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="display:block">
    <path d="${area}" fill="var(--pink-lighter)" opacity="0.55"></path>
    <polyline points="${line}" fill="none" stroke="var(--pink-dark)" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round"></polyline>
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

  const escalon = escalonActual({
    minimosDeudaCubiertos: (p.items.find((it) => it.r === 'deu')?.p || 0) > 0,
    fondoEstado,
    tieneMetasActivas: p.goals.some((g) => !g.special),
  });

  const rec = recomendar({ fondoEstado, essentialsShare: diag ? diag.share : 0 });
  const ahorroHoy = tasaAhorro(p);

  const estadoMes = Math.abs(diff) < 0.01
    ? 'Cuadrado. Repartiste el 100%.'
    : diff > 0
      ? `Quedan ${diff}% libres, ${money(inc * diff / 100, p.cur)} sin asignar.`
      : `Te pasaste ${Math.abs(diff)}%, son ${money(inc * Math.abs(diff) / 100, p.cur)} que no tienes.`;

  const badgeClass = fondoEstado === 'completo' ? 'ok' : fondoEstado === 'parcial' ? 'warn' : 'bad';

  const auto = store.cierresAutomaticos();

  root.innerHTML = `
    ${auto.length ? `<div class="card aviso-cierre">
      <div>
        <span class="label">Cierre automático</span>
        <div class="sub">Cerré ${auto.map(nombreMes).join(', ')} por ti. Revisa que esté completo.</div>
      </div>
      <button class="btn-primary" id="dVerCierre">Ver en Historial</button>
    </div>` : ''}
    <div class="grid-3">
      <div class="card card-pink">
        <div class="income-head">
          <span class="label">Ingreso neto del mes</span>
          <select id="dCurrency" aria-label="Moneda">
            ${['COP', 'MXN', 'USD', 'ARS', 'CLP', 'PEN', 'EUR'].map((c) => `<option ${c === p.cur ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <input id="dIncome" class="income-input num" type="text" inputmode="numeric"
          value="${plain(p.inc, p.cur)}" aria-label="Ingreso neto mensual">
        <div class="sub">${p.ingresoTipo === 'variable'
          ? `Repartes sobre el promedio: <b class="num">${money(inc, p.cur)}</b>`
          : `${p.cur} · ingreso fijo`}</div>
      </div>

      <div class="card card-ink">
        <span class="label">Tu mes</span>
        <div class="kpi num">${t}%</div>
        <div class="sub">${estadoMes}</div>
      </div>

      <div class="card">
        <span class="label">Fondo de emergencia</span>
        <div class="kpi num">${money(fondoSaved, p.cur)}</div>
        <span class="badge ${badgeClass}">${fondoEstado}</span>
        <div class="sub">Objetivo ${money(target, p.cur)} (${plazo(p.fondoMeses)})</div>
      </div>
    </div>

    ${diag && diag.nivel !== 'verde' ? `
    <div class="card" style="border-color:var(--${diag.nivel === 'rojo' ? 'danger' : 'warning'})">
      <span class="label">Esenciales</span>
      <div class="sub" style="color:var(--${diag.nivel === 'rojo' ? 'danger' : 'warning'});font-weight:var(--fw-bold);font-size:var(--text-sm)">
        Tus esenciales suman ${money(diag.sum, p.cur)}, el ${diag.share}% del ingreso.
        ${diag.nivel === 'rojo' ? 'Es demasiado.' : 'Está en el límite.'}
      </div>
      ${diag.top3.length ? `<div class="sub">Lo que más pesa: ${diag.top3.map((l) => `${esc(l.n || 'sin nombre')} ${money(l.v, p.cur)} (${r2(l.pct)}%)`).join(' · ')}</div>` : ''}
    </div>` : ''}

    <div class="grid-2a">
      <div class="card">
        <span class="label">Orden de prioridad</span>
        <div class="escalera">
          ${ESCALERA.map((s, i) => {
            const n = i + 1;
            const state = n < escalon ? 'done' : n === escalon ? 'on' : '';
            return `<div class="peldano ${state}">
              <span class="bub">${n < escalon ? '✓' : n}</span>
              <span class="txt">${s}</span>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="card">
        <div class="spark-head">
          <span class="label">Tasa de ahorro</span>
          <span class="spark-val num">${ahorroHoy}%</span>
        </div>
        <div id="dSpark"><div class="sub">Cargando historial…</div></div>
      </div>
    </div>

    <div class="grid-2b">
      <div class="card">
        <span class="label">Reparto del ingreso</span>
        ${p.items.length ? p.items.map((it) => `
          <div class="repline">
            <span class="dot" style="background:${it.c}"></span>
            <span class="nm" title="${esc(it.n)}">${esc(it.n)}</span>
            <span class="track"><i style="width:${Math.min(100, it.p)}%;background:${it.c}"></i></span>
            <span class="pv num">${it.p}%</span>
          </div>`).join('') : '<div class="empty">Sin categorías.</div>'}
      </div>

      <div class="card" style="display:flex;flex-direction:column">
        <span class="label">Metas</span>
        ${p.goals.length ? `<div class="rings">
          ${p.goals.map((g) => {
            const pct = g.t > 0 ? Math.min(1, (g.s || 0) / g.t) : 0;
            const n = monthsToGoal(g, p.items, inc);
            const title = n ? `${money(g.s || 0, p.cur)} de ${money(g.t, p.cur)} · ${plazo(n)}, hacia ${whenText(n)}` : `${money(g.s || 0, p.cur)} de ${money(g.t, p.cur)} · sin aporte mensual`;
            return `<div class="ring" title="${esc(title)}">
              <div class="wrap">
                ${ringSvg(pct, g.special === 'emergencia' ? 'var(--warning)' : 'var(--pink)')}
                <div class="pct num">${Math.round(pct * 100)}%</div>
              </div>
              <div class="lbl">${esc(g.n)}</div>
            </div>`;
          }).join('')}
        </div>` : '<div class="empty">Sin metas todavía.</div>'}
      </div>
    </div>

    <div class="card" style="background:var(--pink-wash);border-color:var(--pink-lighter)">
      <span class="label">Recomendado de ahorro</span>
      <div class="sub" style="font-size:var(--text-sm);color:var(--ink)">
        Corto plazo <b class="num">${rec.corto}%</b> · Largo plazo <b class="num">${rec.largo}%</b>
      </div>
      <div class="sub">${rec.motivo}.</div>
    </div>`;

  root.querySelector('#dVerCierre')?.addEventListener('click',
    () => window.dispatchEvent(new CustomEvent('ir-a-vista', { detail: { route: 'historial' } })));

  root.querySelector('#dIncome').onchange = (e) => {
    p.inc = digits(e.target.value);
    store.save();
    renderDashboard(root);
  };
  root.querySelector('#dCurrency').onchange = (e) => {
    p.cur = e.target.value;
    store.save();
    renderDashboard(root);
  };

  // el historial viene de Supabase: la UI ya se pintó, esto solo rellena la tarjeta
  paintSpark(root, p, ahorroHoy);
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
  box.innerHTML = `
    <div class="sub" style="margin-top:0">Últimos ${ultimos.length} meses cerrados</div>
    ${sparkline(rates)}
    <div class="spark-months">${ultimos.map((c) => `<span>${mesCorto(c.periodo)}</span>`).join('')}</div>`;
}
