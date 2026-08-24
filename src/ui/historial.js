import * as store from '../store.js';
import { periodoDe, hoyISO } from '../engine/movimientos.js';
import { construirSnapshot, brechaDelMes, aportadoEnCierre } from '../engine/cierre.js';
import { money, plain, esc, digits } from '../format.js';
import { toast } from './shell.js';
import { sparkline } from './dashboard.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function nombreMes(periodo) {
  const [a, m] = periodo.split('-');
  return `${MESES[Number(m) - 1]} de ${a}`;
}

// Un snapshot v1 solo trae essentialsShare y ahorroRate
const esRico = (c) => c.snapshot?.version >= 2;

function barsEssentials(cierres) {
  return cierres.map((c) => {
    const pct = Math.min(100, c.snapshot.essentialsShare || 0);
    const color = pct <= 50 ? 'var(--green)' : pct <= 65 ? 'var(--amber)' : 'var(--red)';
    return `<div class="hist-row"><span class="sub">${c.periodo}</span>
      <div class="hist-track"><i style="width:${pct}%;background:${color}"></i></div>
      <span class="num sub">${Math.round(pct)}%</span></div>`;
  }).join('');
}

// Plan contra real en barras enfrentadas, sobre la escala del mayor de los dos
function barrasPlanReal(snapshot, cur) {
  const tope = Math.max(...snapshot.items.flatMap((i) => [i.plan, i.real]), 1);
  return snapshot.items.map((i) => `
    <div class="pr-fila">
      <span class="pr-n" title="${esc(i.nombre)}">${esc(i.nombre)}</span>
      <div class="pr-barras">
        <div class="pr-b"><i style="width:${(i.plan / tope) * 100}%;background:var(--pink-lighter)"></i>
          <span class="num">${money(i.plan, cur)}</span></div>
        <div class="pr-b"><i style="width:${(i.real / tope) * 100}%;background:${i.real > i.plan ? 'var(--danger)' : 'var(--pink)'}"></i>
          <span class="num">${money(i.real, cur)}</span></div>
      </div>
    </div>`).join('');
}

function fraseBrecha(snapshot, cur) {
  const b = brechaDelMes(snapshot);
  if (!b) return '';
  if (b.diferencia > 0) {
    return `Planeaste gastar ${money(b.plan, cur)} y gastaste ${money(b.real, cur)}.
      Te pasaste ${money(b.diferencia, cur)}${b.culpable ? `, casi todo en ${esc(b.culpable.nombre)}` : ''}.`;
  }
  if (b.diferencia < 0) {
    return `Planeaste gastar ${money(b.plan, cur)} y gastaste ${money(b.real, cur)}.
      Te sobraron ${money(-b.diferencia, cur)}.`;
  }
  return `Planeaste gastar ${money(b.plan, cur)} y gastaste exactamente eso.`;
}

export async function renderHistorial(root) {
  const p = store.active();
  root.innerHTML = '<p class="sub">Cargando historial…</p>';
  const cierres = await store.listarCierres();
  const actual = periodoDe(hoyISO());
  const yaCerrado = cierres.some((c) => c.periodo === actual);

  root.innerHTML = `
    <div class="card" style="margin-bottom:var(--sp-4)">
      <span class="label">Este mes</span>
      <div class="sub" style="margin-top:6px">${nombreMes(actual)}${yaCerrado ? ' · ya está cerrado, lo encuentras abajo' : ''}</div>
      <button id="cerrarMes" class="wide btn-primary" style="margin-top:12px">
        ${yaCerrado ? 'Volver a calcular este mes' : `Cerrar ${nombreMes(actual)}`}</button>
    </div>
    <div id="histBody"></div>`;

  root.querySelector('#cerrarMes').onclick = async () => {
    const previo = cierres.find((c) => c.periodo === actual)?.snapshot;
    const snap = construirSnapshot(p, actual, store.incomeRepartir(p),
      previo ? { borrador: previo.borrador, nota: previo.nota } : {});
    const { error } = await store.cerrarMes(actual, snap);
    if (error) { toast(error.message || 'No se pudo guardar el cierre'); return; }
    toast('Mes cerrado');
    renderHistorial(root);
  };

  pintarCuerpo(root, p, cierres);
}

function pintarCuerpo(root, p, cierres) {
  const body = root.querySelector('#histBody');

  const tendencia = cierres.length >= 2 ? (() => {
    const rates = cierres.map((c) => Number(c.snapshot.ahorroRate) || 0);
    const last3 = cierres.slice(-4, -1);
    const avgPrev = last3.length ? last3.reduce((s, c) => s + (Number(c.snapshot.ahorroRate) || 0), 0) / last3.length : null;
    const hoy = rates[rates.length - 1];
    return `
      <div class="card" style="margin-bottom:var(--sp-4)">
        <span class="label">Tasa de ahorro, últimos ${cierres.length} meses</span>
        ${sparkline(rates)}
      </div>
      <div class="card" style="margin-bottom:var(--sp-4)">
        <span class="label">Esenciales como % del ingreso</span>
        <div class="hist-list">${barsEssentials(cierres)}</div>
      </div>
      ${avgPrev !== null ? `<div class="card" style="margin-bottom:var(--sp-4)">
        <span class="label">Este mes vs. promedio de los tres anteriores</span>
        <div class="sub" style="margin-top:6px">Ahora: <b class="num">${hoy}%</b> · Antes: <b class="num">${Math.round(avgPrev * 10) / 10}%</b>
        ${hoy >= avgPrev ? ' — mejoraste' : ' — bajaste'}</div>
      </div>` : ''}`;
  })() : '<div class="card" style="margin-bottom:var(--sp-4)"><div class="empty">Necesito al menos dos meses cerrados para la tendencia.</div></div>';

  if (!cierres.length) {
    body.innerHTML = '<div class="card"><div class="empty">Todavía no has cerrado ningún mes.</div></div>';
    return;
  }

  body.innerHTML = tendencia + [...cierres].reverse().map((c) => tarjetaCierre(c, p)).join('');

  cierres.forEach((c) => wireCierre(root, c, p));
}

function tarjetaCierre(c, p) {
  const s = c.snapshot;
  const cur = s.cur || p.cur;
  if (!esRico(c)) {
    return `<div class="card cierre" data-per="${c.periodo}" style="margin-bottom:var(--sp-4)">
      <div class="cierre-head"><span class="label">${nombreMes(c.periodo)}</span>
        <span class="badge">solo plan</span></div>
      <div class="sub">Ahorro ${s.ahorroRate}% · Esenciales ${s.essentialsShare}%. Este cierre es viejo y no guarda el gasto real.</div>
    </div>`;
  }
  const aportado = aportadoEnCierre(s);
  return `
  <div class="card cierre" data-per="${c.periodo}" style="margin-bottom:var(--sp-4)">
    <div class="cierre-head">
      <span class="label">${nombreMes(c.periodo)}</span>
      <span class="badge ${s.borrador ? 'warn' : 'ok'}">${s.borrador ? 'borrador' : 'confirmado'}</span>
    </div>
    <div class="sub cierre-frase">${fraseBrecha(s, cur)}</div>
    <div class="sub">Entraron ${money(s.ingresoReal, cur)}${s.ingresoExtra > 0 ? ` (${money(s.ingresoExtra, cur)} de extras)` : ''} contra ${money(s.ingresoPlan, cur)} planeados.</div>
    ${aportado > 0 ? `<div class="sub">A metas fueron <b class="num">${money(aportado, cur)}</b>.</div>` : ''}
    <div class="pr-lista">${barrasPlanReal(s, cur)}</div>
    ${s.nota ? `<div class="sub cierre-nota">${esc(s.nota)}</div>` : ''}
    <button class="mini cierre-edit" style="margin-top:10px">${s.borrador ? 'Revisar y confirmar' : 'Volver a editar'}</button>
    <div class="cierre-form" hidden></div>
  </div>`;
}

function wireCierre(root, c, p) {
  const card = root.querySelector(`.cierre[data-per="${c.periodo}"]`);
  const btn = card?.querySelector('.cierre-edit');
  if (!btn) return;
  btn.onclick = () => {
    const box = card.querySelector('.cierre-form');
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    pintarForm(root, box, c, p);
  };
}

/* Editar el cierre: el real llega precargado con la suma de movimientos, pero
   se corrige a mano. Así un gasto que no se alcanzó a registrar se cuadra aquí
   en vez de inventar un movimiento con fecha falsa. */
function pintarForm(root, box, c, p) {
  const s = c.snapshot;
  const cur = s.cur || p.cur;
  box.innerHTML = `
    <div class="divider"></div>
    <div class="cf-fila cf-cab"><span></span><span class="label">Planeado</span><span class="label">Real</span></div>
    <div class="cf-fila">
      <span class="cf-n">Ingreso</span>
      <span class="num sub">${money(s.ingresoPlan, cur)}</span>
      <input class="num cf-ing" inputmode="numeric" value="${plain(s.ingresoReal, cur)}">
    </div>
    ${s.items.map((i) => `
      <div class="cf-fila" data-item="${i.itemId}">
        <span class="cf-n" title="${esc(i.nombre)}">${esc(i.nombre)}</span>
        <span class="num sub">${money(i.plan, cur)}</span>
        <input class="num cf-real" inputmode="numeric" value="${plain(i.real, cur)}">
      </div>`).join('')}
    <div class="fld" style="margin-top:12px"><label>Nota del mes</label>
      <input class="cf-nota" value="${esc(s.nota || '')}" placeholder="Por qué el mes se salió de madre"></div>
    <button class="wide btn-primary cf-ok" style="margin-top:12px">
      ${s.borrador ? 'Confirmar cierre' : 'Guardar cambios'}</button>`;

  box.querySelector('.cf-ok').onclick = async () => {
    const editado = {
      ...s,
      ingresoReal: digits(box.querySelector('.cf-ing').value),
      items: s.items.map((i) => ({
        ...i,
        real: digits(box.querySelector(`.cf-fila[data-item="${i.itemId}"] .cf-real`).value),
      })),
      nota: box.querySelector('.cf-nota').value.trim(),
      borrador: false,
    };
    const { error } = await store.cerrarMes(c.periodo, editado);
    if (error) { toast(error.message || 'No se pudo guardar'); return; }
    toast(s.borrador ? 'Cierre confirmado' : 'Cierre actualizado');
    renderHistorial(root);
  };
}
