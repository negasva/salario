import * as store from '../store.js';
import { amount } from '../engine/reparto.js';
import { money } from '../format.js';
import { toast } from './shell.js';

function periodoActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ahorroRate(p) {
  const cor = p.items.find((it) => it.r === 'cor')?.p || 0;
  const lar = p.items.find((it) => it.r === 'lar')?.p || 0;
  return cor + lar;
}

function essentialsShare(p) {
  return p.items.find((it) => it.r === 'ese')?.p || 0;
}

function sparkline(values, w = 280, h = 60) {
  if (values.length < 2) return '';
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none">
    <polyline points="${pts.join(' ')}" fill="none" stroke="var(--mint)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

function barsEssentials(cierres, w = 280) {
  const h = 24 * cierres.length;
  const rows = cierres.map((c, i) => {
    const pct = Math.min(100, c.snapshot.essentialsShare);
    const color = pct <= 50 ? 'var(--green)' : pct <= 65 ? 'var(--amber)' : 'var(--red)';
    return `<div class="hist-row"><span class="sub">${c.periodo}</span>
      <div class="hist-track"><i style="width:${pct}%;background:${color}"></i></div>
      <span class="num sub">${Math.round(pct)}%</span></div>`;
  }).join('');
  return rows;
}

export async function renderHistorial(root) {
  const p = store.active();
  root.innerHTML = '<p class="sub">Cargando historial…</p>';
  const cierres = await store.listarCierres();

  root.innerHTML = `
    <div class="card" style="margin-bottom:var(--sp-4)">
      <span class="label">Este mes</span>
      <div class="sub" style="margin-top:6px">Ahorro ${ahorroRate(p)}% del ingreso · Esenciales ${essentialsShare(p)}%</div>
      <button id="cerrarMes" class="wide btn-primary" style="margin-top:12px">Cerrar mes (${periodoActual()})</button>
    </div>
    <div id="histBody"></div>`;

  root.querySelector('#cerrarMes').onclick = async () => {
    const snapshot = { inc: p.inc, cur: p.cur, essentialsShare: essentialsShare(p), ahorroRate: ahorroRate(p) };
    const { error } = await store.cerrarMes(periodoActual(), snapshot);
    if (error) { toast(error.message || 'No se pudo guardar el cierre'); return; }
    toast('Mes cerrado');
    renderHistorial(root);
  };

  const body = root.querySelector('#histBody');
  if (cierres.length < 2) {
    body.innerHTML = '<div class="card"><div class="empty">Necesito al menos dos meses cerrados.</div></div>';
    return;
  }

  const rates = cierres.map((c) => c.snapshot.ahorroRate);
  const last3 = cierres.slice(-4, -1);
  const avgPrev = last3.length ? last3.reduce((s, c) => s + c.snapshot.ahorroRate, 0) / last3.length : null;
  const currentRate = rates[rates.length - 1];

  body.innerHTML = `
    <div class="card" style="margin-bottom:var(--sp-4)">
      <span class="label">Tasa de ahorro, últimos ${cierres.length} meses</span>
      ${sparkline(rates)}
    </div>
    <div class="card" style="margin-bottom:var(--sp-4)">
      <span class="label">Esenciales como % del ingreso</span>
      <div class="hist-list">${barsEssentials(cierres)}</div>
    </div>
    ${avgPrev !== null ? `<div class="card">
      <span class="label">Este mes vs. promedio de los tres anteriores</span>
      <div class="sub" style="margin-top:6px">Ahora: <b class="num">${currentRate}%</b> · Antes: <b class="num">${Math.round(avgPrev * 10) / 10}%</b>
      ${currentRate >= avgPrev ? ' — mejoraste' : ' — bajaste'}</div>
    </div>` : ''}`;
}
