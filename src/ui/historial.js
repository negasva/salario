import * as store from '../store.js';
import { periodoDe, hoyISO, porLinea } from '../engine/movimientos.js';
import { r2 } from '../engine/reparto.js';
import { construirSnapshot, brechaDelMes, aportadoEnCierre } from '../engine/cierre.js';
import { resumenMes, movimientosDeAhorro, ahorroRepartido, promedioVariables } from '../engine/pagos.js';
import { icon } from './icons.js';
import { money, plain, esc, digits, MESES } from '../format.js';
import { toast } from './shell.js';
import { sparkline } from './dashboard.js';

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

  root.querySelector('#cerrarMes').onclick = () => abrirCierre(root, p, actual, cierres);

  pintarCuerpo(root, p, cierres);
}


/* Cierre de mes: primero se ve el consolidado planeado / pagado / ahorro con
   su desglose, y solo si sobró plata se pregunta a dónde va. El reparto se
   guarda como movimientos normales, así el historial y las metas lo ven sin
   estructura nueva. Lo que no se reparte queda como excedente libre. */
function abrirCierre(root, p, periodo, cierres) {
  const res = resumenMes(p.items, porLinea(p.movs, periodo), periodo);
  const ahorro = Math.max(0, res.diferencia);
  const destinos = [
    ...p.goals.filter((g) => g.estado !== 'archivada').map((g) => ({ k: `g:${g.id}`, goalId: g.id, nombre: g.n })),
    ...p.items.filter((it) => it.r === 'cor' || it.r === 'lar').map((it) => ({ k: `i:${it.id}`, itemId: it.id, nombre: it.n })),
  ];
  const reparto = {};

  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  overlay.innerHTML = `
    <div class="sheet">
      <div class="sheet-head"><h3>Cerrar ${nombreMes(periodo)}</h3>
        <button class="btn-del" id="ccClose">${icon('cerrar')}</button></div>
      <div class="cc-tot">
        <div class="ph-cifra"><span class="label">Planeado</span><b class="num">${money(res.plan, p.cur)}</b></div>
        <div class="ph-cifra"><span class="label">Pagado</span><b class="num">${money(res.pagado, p.cur)}</b></div>
        <div class="ph-cifra"><span class="label">${res.diferencia >= 0 ? 'Ahorro' : 'Exceso'}</span>
          <b class="num ${res.diferencia >= 0 ? 'ok' : 'over'}">${money(Math.abs(res.diferencia), p.cur)}</b></div>
      </div>
      <div class="label" style="margin:14px 0 8px">Por categoría</div>
      ${res.cats.filter((c) => c.total).map((c) => `<div class="sub cc-cat">
        <span class="cc-n">${esc(c.it.n)}</span>
        <span class="num">${money(c.plan, p.cur)} → ${money(c.pagado, p.cur)}</span>
        <b class="num ${c.diferencia >= 0 ? 'ok' : 'over'}">${c.diferencia >= 0 ? '+' : '−'}${money(Math.abs(c.diferencia), p.cur)}</b>
      </div>`).join('') || '<div class="empty">Ninguna categoría tiene renglones.</div>'}
      ${ahorro > 0 ? `
        <div class="label" style="margin:16px 0 8px">Repartir el ahorro</div>
        <div class="sub">Sobraron <b class="num ok">${money(ahorro, p.cur)}</b>. Repártelos entre los destinos que quieras;
          lo que dejes sin asignar se queda como excedente libre.</div>
        <div id="ccDest">${destinos.map((d) => `<div class="cc-dest" data-k="${d.k}">
          <span class="cc-n">${esc(d.nombre)}</span>
          <label class="fieldw"><span>${p.cur}</span>
            <input class="num cc-monto" inputmode="numeric" placeholder="0"></label>
        </div>`).join('')}</div>
        <div class="sub cc-resto" style="margin-top:10px"></div>` : ''}
      <button id="ccOk" class="wide btn-primary" style="margin-top:16px">Cerrar el mes</button>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  function close() { overlay.remove(); document.body.style.overflow = ''; }
  overlay.querySelector('#ccClose').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const resto = overlay.querySelector('.cc-resto');
  function pintarResto() {
    const usado = Object.values(reparto).reduce((s2, v) => s2 + v, 0);
    const libre = r2(ahorro - usado);
    resto.innerHTML = libre < 0
      ? `<b class="over">Estás repartiendo ${money(-libre, p.cur)} más de lo que ahorraste.</b>`
      : `Quedan <b class="num">${money(libre, p.cur)}</b> como excedente libre.`;
  }
  overlay.querySelectorAll('.cc-dest').forEach((el) => {
    el.querySelector('.cc-monto').oninput = (e) => {
      reparto[el.dataset.k] = digits(e.target.value);
      pintarResto();
    };
  });
  if (ahorro > 0) pintarResto();

  overlay.querySelector('#ccOk').onclick = async () => {
    const usado = Object.values(reparto).reduce((s2, v) => s2 + v, 0);
    if (usado > ahorro + 0.01) { toast('No puedes repartir más de lo que ahorraste'); return; }

    const previo = cierres.find((c) => c.periodo === periodo)?.snapshot;
    const snap = construirSnapshot(p, periodo, store.incomeRepartir(p),
      previo ? { borrador: previo.borrador, nota: previo.nota } : {});
    const { error } = await store.cerrarMes(periodo, snap);
    if (error) { toast(error.message || 'No se pudo guardar el cierre'); return; }

    const nuevos = movimientosDeAhorro(
      destinos.map((d) => ({ ...d, monto: reparto[d.k] || 0 })),
      periodo, hoyISO(), `Ahorro de ${nombreMes(periodo)}`);
    if (nuevos.length) { p.movs.push(...nuevos); store.save(); }

    close();
    toast(usado > 0 ? `Mes cerrado. Moviste ${money(usado, p.cur)} de ahorro.` : 'Mes cerrado');
    renderHistorial(root);
  };
}

function pintarCuerpo(root, p, cierres) {
  const body = root.querySelector('#histBody');

  const tendencia = cierres.length >= 2 ? (() => {
    const rates = cierres.map((c) => Number(c.snapshot.ahorroRate) || 0);
    const extras = cierres.map((c) => c.snapshot.ingresoExtra > 0);
    const last3 = cierres.slice(-4, -1);
    const avgPrev = last3.length ? last3.reduce((s, c) => s + (Number(c.snapshot.ahorroRate) || 0), 0) / last3.length : null;
    const hoy = rates[rates.length - 1];
    return `
      <div class="card" style="margin-bottom:var(--sp-4)">
        <span class="label">Tasa de ahorro, últimos ${cierres.length} meses</span>
        ${sparkline(rates, extras)}
        <div class="sub historial-leyenda">● Mes con ingreso extra</div>
        <div class="spark-months">${cierres.map((c, i) => `<span class="${extras[i] ? 'spark-extra' : ''}" title="${extras[i] ? 'Tuvo ingreso extra' : 'Sin ingreso extra'}">${extras[i] ? '● ' : ''}${c.periodo}</span>`).join('')}</div>
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

  body.innerHTML = tendencia + tarjetaPromedios(cierres, p) + [...cierres].reverse().map((c) => tarjetaCierre(c, p)).join('');

  cierres.forEach((c) => wireCierre(root, c, p));
}


/* Lo que de verdad cuesta cada renglón variable, para ajustar el plan con
   datos. Ordenado por la brecha, que es lo único accionable de la tabla. */
function tarjetaPromedios(cierres, p) {
  const filas = promedioVariables(cierres);
  if (!filas.length) return '';
  return `<div class="card" style="margin-bottom:var(--sp-4)">
    <span class="label">Gasto real promedio de tus renglones variables</span>
    <div class="hist-list" style="margin-top:8px">${filas.map((f) => `
      <div class="sub cc-cat">
        <span class="cc-n">${esc(f.nombre || 'sin nombre')}</span>
        <span class="num">promedio ${money(f.promedio, p.cur)} vs ${money(f.plan, p.cur)} planeado</span>
        <b class="num ${f.brecha >= 0 ? 'ok' : 'over'}">${f.brecha >= 0 ? 'sobra' : 'falta'} ${money(Math.abs(f.brecha), p.cur)}</b>
      </div>`).join('')}</div>
    <div class="sub" style="margin-top:8px">Promedios de ${filas[0].meses} mes${filas[0].meses > 1 ? 'es' : ''} cerrados.
      Si un renglón sobra todos los meses, bájale el plan y manda la diferencia a una meta.</div>
  </div>`;
}

// A dónde se fue el ahorro de ese mes. Sale del libro, no del snapshot.
function destinosDelAhorro(periodo, p) {
  const movs = ahorroRepartido(p.movs, periodo);
  if (!movs.length) return '';
  const total = r2(movs.reduce((s2, m) => s2 + m.monto, 0));
  const nombre = (m) => (m.goalId ? p.goals.find((g) => g.id === m.goalId)?.n : p.items.find((i) => i.id === m.itemId)?.n) || 'destino borrado';
  return `<div class="sub">Del ahorro moviste <b class="num ok">${money(total, p.cur)}</b>:
    ${movs.map((m) => `${esc(nombre(m))} ${money(m.monto, p.cur)}`).join(' · ')}.</div>`;
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
    ${destinosDelAhorro(c.periodo, p)}
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
