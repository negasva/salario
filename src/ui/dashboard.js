import * as store from '../store.js';
import { total, claimedAll, diagnosticoEsenciales } from '../engine/reparto.js';
import { emergencyTarget, emergencyStatus, escalonActual, ESCALERA, monthsToGoal } from '../engine/metas.js';
import { recomendar } from '../engine/consejo.js';
import { money } from '../format.js';

function svgBar(items) {
  const t = total(items);
  const sc = Math.max(100, t);
  let x = 0;
  const segs = items.map((it) => {
    const w = ((Number(it.p) || 0) / sc) * 100;
    const cl = Math.min(100, claimedAll(store.active().goals, it.id));
    const seg = `<rect x="${x}%" y="0" width="${w}%" height="100%" fill="${it.c}"/>` +
      (cl > 0 ? `<rect x="${x}%" y="0" width="${(w * cl) / 100}%" height="100%" fill="rgba(255,255,255,.35)"/>` : '');
    x += w;
    return seg;
  }).join('');
  const gap = t < 99.99 ? `<rect x="${x}%" y="0" width="${((100 - t) / sc) * 100}%" height="100%" fill="var(--amber)" opacity=".3"/>` : '';
  return `<svg class="repartobar" viewBox="0 0 100 100" preserveAspectRatio="none">${segs}${gap}</svg>`;
}

function svgRing(pct, color) {
  const r = 26, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, pct));
  return `<svg width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--card-2)" stroke-width="6"/>
    <circle cx="32" cy="32" r="${r}" fill="none" stroke="${color}" stroke-width="6"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"
      transform="rotate(-90 32 32)"/>
    <text x="32" y="37" text-anchor="middle" font-size="14" font-weight="700" fill="var(--text)">${Math.round(pct * 100)}%</text>
  </svg>`;
}

export function renderDashboard(root) {
  const p = store.active();
  const inc = store.incomeRepartir(p);
  const incEse = store.incomeEsenciales(p);
  const t = total(p.items);
  const diff = Math.round((100 - t) * 100) / 100;

  const ese = p.items.find((it) => it.r === 'ese');
  const diag = ese ? diagnosticoEsenciales(ese, incEse) : null;

  const { oneMonth, target } = emergencyTarget(p.items.filter((it) => it.r === 'ese'), p.fondoMeses);
  const fondoGoal = p.goals.find((g) => g.special === 'emergencia');
  const fondoSaved = fondoGoal ? fondoGoal.s || 0 : 0;
  const fondoEstado = emergencyStatus(fondoSaved, oneMonth, target);

  const escalon = escalonActual({
    minimosDeudaCubiertos: (p.items.find((it) => it.r === 'deu')?.p || 0) > 0,
    fondoEstado,
    tieneMetasActivas: p.goals.some((g) => !g.special),
  });

  const rec = recomendar({ fondoEstado, essentialsShare: diag ? diag.share : 0 });

  root.innerHTML = `
    <div class="grid" style="margin-bottom:var(--sp-4)">
      <div class="card">
        <div class="income-head">
          <span class="label">Ingreso neto del mes</span>
          <select id="dCurrency">
            ${['COP', 'MXN', 'USD', 'ARS', 'CLP', 'PEN', 'EUR'].map((c) => `<option ${c === p.cur ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <input id="dIncome" class="income-input num" type="text" inputmode="numeric" value="${p.inc}">
        ${p.ingresoTipo === 'variable' ? `<div class="sub" style="margin-top:6px">Repartes sobre el promedio: <b class="num">${money(inc, p.cur)}</b></div>` : ''}
        ${svgBar(p.items)}
      </div>
      <div class="card">
        <span class="label">Tu mes</span>
        <div class="kpi ${Math.abs(diff) < 0.01 ? '' : diff > 0 ? '' : ''}">${t}%</div>
        <div class="sub">${Math.abs(diff) < 0.01 ? 'Cuadrado. Repartiste el 100%.' : diff > 0 ? `Quedan ${diff}% libres, ${money(inc * diff / 100, p.cur)} sin asignar.` : `Te pasaste ${Math.abs(diff)}%, son ${money(inc * Math.abs(diff) / 100, p.cur)} que no tienes.`}</div>
      </div>
      <div class="card">
        <span class="label">Fondo de emergencia</span>
        <div class="kpi">${money(fondoSaved, p.cur)}</div>
        <span class="badge ${fondoEstado === 'completo' ? 'ok' : fondoEstado === 'parcial' ? 'warn' : 'bad'}">${fondoEstado}</span>
        <div class="sub">Objetivo ${money(target, p.cur)} (${p.fondoMeses} meses)</div>
      </div>
    </div>

    ${diag && diag.nivel === 'rojo' ? `
    <div class="card" style="border-color:var(--red);margin-bottom:var(--sp-4)">
      <span class="label">Esenciales</span>
      <div class="sub" style="color:var(--red);font-weight:700;margin-top:4px">Esenciales al ${diag.share}% del ingreso, es demasiado.</div>
      <div class="sub" style="margin-top:6px">${diag.top3.map((l) => `${l.n}: ${money(l.v, p.cur)} (${Math.round(l.pct * 10) / 10}% del ingreso)`).join(' · ')}</div>
    </div>` : ''}

    <div class="grid" style="margin-bottom:var(--sp-4)">
      <div class="card">
        <span class="label">Recomendado de ahorro</span>
        <div class="sub" style="margin-top:6px">Corto plazo <b class="num">${rec.corto}%</b> · Largo plazo <b class="num">${rec.largo}%</b></div>
        <div class="sub" style="margin-top:6px">${rec.motivo}.</div>
      </div>
      <div class="card">
        <span class="label">Orden de prioridad</span>
        <div class="escalera">
          ${ESCALERA.map((s, i) => `<div class="peldano ${i + 1 < escalon ? 'done' : ''} ${i + 1 === escalon ? 'on' : ''}">${i + 1 < escalon ? '✓' : i + 1}. ${s}</div>`).join('')}
        </div>
      </div>
    </div>

    <h2 class="section-h">Metas</h2>
    <div class="grid" id="dGoals"></div>`;

  const goalsBox = root.querySelector('#dGoals');
  if (!p.goals.length) {
    goalsBox.innerHTML = '<div class="empty">Sin metas todavía.</div>';
  } else {
    goalsBox.innerHTML = p.goals.map((g) => {
      const pct = g.t > 0 ? Math.min(1, (g.s || 0) / g.t) : 0;
      const n = monthsToGoal(g, p.items, inc);
      return `<div class="card goalcard">
        <div style="display:flex;align-items:center;gap:12px">
          ${svgRing(pct, g.special === 'emergencia' ? 'var(--amber)' : 'var(--blue)')}
          <div style="min-width:0">
            <div style="font-weight:700">${g.n}</div>
            <div class="sub">${money(g.s || 0, p.cur)} de ${money(g.t || 0, p.cur)}</div>
          </div>
        </div>
        <div class="sub" style="margin-top:8px">${n ? `Plazo: ${n} meses` : 'Sin aporte mensual todavía'}</div>
      </div>`;
    }).join('');
  }

  root.querySelector('#dIncome').oninput = (e) => {
    p.inc = Number(String(e.target.value).replace(/\D/g, '')) || 0;
    store.save();
  };
  root.querySelector('#dIncome').onblur = (e) => { e.target.value = p.inc; };
  root.querySelector('#dCurrency').onchange = (e) => { p.cur = e.target.value; store.save(); renderDashboard(root); };
}
