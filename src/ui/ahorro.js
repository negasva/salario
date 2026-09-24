import * as store from '../store.js';
import {
  estadoAhorro, nuevaMeta, inicialSugerido, retiro,
} from '../engine/ahorro.js';
import { agregar, colorPara } from '../engine/categorias.js';
import { hoyISO } from '../engine/movimientos.js';
import { money, plain, esc, digits, nombreMes, fechaCorta } from '../format.js';
import { selectorMes, enlazarMes, mesElegido } from './mes.js';
import { abrirRegistro } from './registrar.js';
import { abrirModal } from './modal.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

/* El ahorro entero arriba, siempre, y debajo cómo se reparte: cada meta se
   lleva su porcentaje de lo que ahorras y lo demás queda libre. */

const colorMeta = (i) => colorPara(i + 3);

// Nueva meta o editar una: nombre, cuánto es, qué porcentaje del ahorro se lleva.
function editorMeta(meta, e, per, alGuardar) {
  const p = store.active();
  const nueva = !meta;
  const otras = e.metas.filter((x) => !x.meta.usada && !x.completa && x.meta !== meta)
    .reduce((t, x) => t + x.meta.pct, 0);
  const disponible = Math.max(0, 100 - otras);
  const { cuerpo, cerrar } = abrirModal({ titulo: nueva ? 'Nueva meta' : `Editar ${esc(meta.n)}` });
  cuerpo.innerHTML = `
    <div class="fld"><label for="mtNombre">Para qué</label>
      <input id="mtNombre" value="${esc(meta?.n || '')}" placeholder="Ej: Llantas, viaje, colchón" autocomplete="off"></div>
    <div class="fld"><label for="mtObjetivo">Cuánto necesitas</label>
      <input id="mtObjetivo" class="num monto" inputmode="numeric" placeholder="0" value="${meta?.objetivo ? plain(meta.objetivo) : ''}"></div>
    <div class="fld"><label for="mtPct">Qué parte de tu ahorro se lleva</label>
      <div class="pct-campo"><input id="mtPct" class="num" type="number" min="1" max="${disponible}" inputmode="numeric" value="${meta?.pct || Math.min(30, disponible)}"><span>%</span></div>
      <input id="mtRango" type="range" min="0" max="100" value="${meta?.pct || Math.min(30, disponible)}" aria-label="Porcentaje">
      <p class="sub">${otras ? `Tus otras metas se llevan ${otras} %: puedes usar hasta ${disponible} %.` : 'Cada mes, este porcentaje de lo que ahorres va a esta meta.'}</p></div>
    ${nueva ? `<label class="check-chip"><input type="checkbox" id="mtArranca" ${e.libreAntes > 0 ? 'checked' : 'disabled'}> <span id="mtArrancaTxt"></span></label>`
    : `<div class="fld"><label for="mtInicial">Con cuánto arrancó</label>
      <input id="mtInicial" class="num" inputmode="numeric" value="${plain(meta.inicial || 0)}">
      <p class="sub">Lo que tomó de tu ahorro al crearla. Desde ${nombreMes(meta.desde)} suma su porcentaje de cada mes.</p></div>`}
    <p class="sub meta-cuenta" id="mtCuenta"></p>
    <div id="mtErr" class="auth-err"></div>
    <button class="wide btn-primary" id="mtSave">${nueva ? 'Crear meta' : 'Guardar'}</button>
    ${nueva ? '' : '<button class="wide btn-borrar" id="mtBorrar">Borrar meta</button>'}`;

  const $ = (s) => cuerpo.querySelector(s);
  const pct = () => Math.round(Number($('#mtPct').value) || 0);
  const cuenta = () => {
    const v = pct();
    const objetivo = Math.round(digits($('#mtObjetivo').value));
    const inicial = nueva ? ($('#mtArranca').checked ? inicialSugerido(e.libreAntes, v) : 0) : Math.round(digits($('#mtInicial').value));
    if (nueva) {
      $('#mtArrancaTxt').textContent = e.libreAntes > 0
        ? `Arrancar con el ${v} % de lo que ya tenías libre (${money(inicialSugerido(e.libreAntes, v))})`
        : 'No tienes ahorro libre de meses anteriores';
    }
    const aporte = Math.round((e.ritmo * v) / 100);
    const falta = Math.max(0, objetivo - inicial);
    $('#mtCuenta').textContent = objetivo && aporte
      ? `Ahorras unos ${money(e.ritmo)} al mes: el ${v} % son ${money(aporte)}. ${falta ? `Llegas en unos ${Math.ceil(falta / aporte)} meses.` : 'Arranca completa.'}`
      : '';
  };
  $('#mtPct').oninput = () => { $('#mtRango').value = pct(); cuenta(); };
  $('#mtRango').oninput = () => { $('#mtPct').value = $('#mtRango').value; cuenta(); };
  $('#mtObjetivo').oninput = cuenta;
  $('#mtArranca')?.addEventListener('change', cuenta);
  $('#mtInicial')?.addEventListener('input', cuenta);
  cuenta();

  const guardar = () => {
    const n = $('#mtNombre').value.trim();
    const objetivo = Math.round(digits($('#mtObjetivo').value));
    const v = pct();
    if (!n) { $('#mtErr').textContent = 'Escribe para qué es.'; return; }
    if (objetivo <= 0) { $('#mtErr').textContent = 'Escribe cuánto necesitas.'; return; }
    if (v < 1 || v > disponible) { $('#mtErr').textContent = `El porcentaje va de 1 a ${disponible} %.`; return; }
    if (nueva) {
      const inicial = $('#mtArranca').checked ? inicialSugerido(e.libreAntes, v) : 0;
      p.metas.push(nuevaMeta({ n, objetivo, pct: v, desde: per, inicial }));
    } else {
      Object.assign(meta, { n, objetivo, pct: v, inicial: Math.max(0, Math.round(digits($('#mtInicial').value))) });
    }
    store.save();
    cerrar();
    alGuardar();
    toast(nueva ? `${n}: se lleva el ${v} % de lo que ahorres.` : 'Meta guardada.');
  };
  $('#mtSave').onclick = guardar;
  $('#mtBorrar')?.addEventListener('click', () => {
    const i = p.metas.indexOf(meta);
    const deshacer = store.borrarConDeshacer(() => p.metas.splice(i, 1), () => p.metas.splice(i, 0, meta));
    cerrar();
    alGuardar();
    toast(`${meta.n} borrada. Su plata vuelve a quedar libre.`, () => { deshacer(); alGuardar(); });
  });
  cuerpo.onkeydown = (ev) => { if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') { ev.preventDefault(); guardar(); } };
  $('#mtNombre').focus();
}

/* Sacar del ahorro, para una meta (ya compraste las llantas) o de lo libre.
   Vuelve al saldo como ingreso; la compra se registra aparte, como cualquier
   gasto. */
function sacar(x, e, alGuardar) {
  const p = store.active();
  const meta = x?.meta;
  const tope = meta ? x.llevado : Math.max(0, e.libre);
  const { cuerpo, cerrar } = abrirModal({ titulo: meta ? `Usar ${esc(meta.n)}` : 'Sacar del ahorro' });
  cuerpo.innerHTML = `
    <p class="sub">${meta
    ? `Sale de tu ahorro y vuelve a tu saldo del mes. Luego registra la compra como un gasto normal. La meta queda como cumplida.`
    : `Sale de lo que tienes libre (${money(tope)}) y vuelve a tu saldo del mes. Las metas no se tocan.`}</p>
    <div class="fld" style="margin-top:var(--space-4)"><label for="scMonto">Cuánto</label>
      <input id="scMonto" class="num monto" inputmode="numeric" value="${plain(tope)}"></div>
    ${meta ? '' : `<div class="fld"><label for="scNota">Para qué <span class="opcional">(opcional)</span></label>
      <input id="scNota" autocomplete="off" placeholder="Ej: imprevisto"></div>`}
    <div class="fld"><label for="scFecha">Fecha</label><input type="date" id="scFecha" value="${hoyISO()}"></div>
    <div id="scErr" class="auth-err"></div>
    <button class="wide btn-primary" id="scSave">${meta ? 'Usar' : 'Sacar'}</button>`;
  const $ = (s) => cuerpo.querySelector(s);
  $('#scSave').onclick = () => {
    const monto = Math.round(digits($('#scMonto').value));
    if (monto <= 0) { $('#scErr').textContent = 'Escribe cuánto.'; return; }
    if (monto > tope) { $('#scErr').textContent = `Tienes ${money(tope)} ${meta ? 'en esta meta' : 'libres'}.`; return; }
    const fecha = $('#scFecha').value || hoyISO();
    const nota = meta ? `Del ahorro: ${meta.n}` : `Del ahorro${$('#scNota').value.trim() ? `: ${$('#scNota').value.trim()}` : ''}`;
    const mov = retiro(monto, fecha, nota, meta?.id);
    p.movs.push(mov);
    if (meta) meta.usada = { fecha, monto, movId: mov.id };
    store.save();
    cerrar();
    alGuardar();
    toast(`${money(monto)} de vuelta a tu saldo.`, () => {
      const i = p.movs.indexOf(mov);
      if (i >= 0) p.movs.splice(i, 1);
      if (meta) delete meta.usada;
      store.save();
      alGuardar();
    });
  };
  $('#scMonto').focus();
  $('#scMonto').select();
}

export function renderAhorro(root) {
  const p = store.active();
  const per = mesElegido();
  // si borraste en Movimientos el retiro con que usaste una meta, la meta vuelve a estar abierta
  p.metas.forEach((m) => { if (m.usada && !p.movs.some((x) => x.id === m.usada.movId)) delete m.usada; });
  const e = estadoAhorro(p, per);
  const repintar = () => renderAhorro(root);

  if (!e) {
    root.innerHTML = `${selectorMes('Ahorro')}
      <div class="empty-state">
        <span class="empty-ic">${icon('ahorro')}</span>
        <b>Falta la categoría Ahorro</b>
        <span class="sub">Lo que registras en Ahorro es lo que se suma aquí y se reparte en tus metas.</span>
        <button class="btn-primary" id="ahCrear" style="margin-top:var(--space-4)">${icon('mas')}Crear Ahorro</button>
      </div>`;
    enlazarMes(root, repintar);
    root.querySelector('#ahCrear').onclick = () => { agregar(p.cats, 'Ahorro', 0, 'gasto'); store.save(); repintar(); };
    return;
  }

  const abiertas = e.metas.filter((x) => !x.meta.usada);
  const usadas = e.metas.filter((x) => x.meta.usada);
  const trozo = (monto) => (e.total > 0 ? Math.max(0, (monto / e.total) * 100) : 0);
  const libreBarra = Math.max(0, e.libre);

  const tarjeta = (x) => {
    const i = p.metas.indexOf(x.meta);
    const color = colorMeta(i);
    const estado = x.completa
      ? `<span class="pos">${icon('check', 'ic-sm')}Completa: úsala cuando la necesites</span>`
      : `Faltan <b>${money(x.falta)}</b>${x.meses ? ` · a este ritmo llegas en ${x.meses === 1 ? 'un mes' : `${x.meses} meses`} (${nombreMes(x.llega)})` : ' · este mes no ha entrado nada'}`;
    return `<li class="meta-card" style="--c:${color}">
      <button class="meta-main" data-meta="${x.meta.id}"><span class="sr-only">Editar </span>
        <span class="meta-top"><span class="meta-n">${esc(x.meta.n)}</span><span class="meta-pct">${x.meta.pct} %</span></span>
        <span class="meta-cifras num"><b>${money(x.llevado)}</b><span> de ${money(x.meta.objetivo)}</span><span class="meta-avance">${x.pctAvance} %</span></span>
        <span class="barra" aria-hidden="true"><i style="width:${x.pctAvance}%;background:var(--c)"></i></span>
        <span class="sub num">${estado}</span>
        ${x.esteMes ? `<span class="sub num">Este mes: +${money(x.esteMes)}</span>` : ''}
      </button>
      <button class="mini ${x.completa ? 'btn-primary' : ''}" data-usar="${x.meta.id}" ${x.llevado > 0 ? '' : 'disabled'}>Usar</button>
    </li>`;
  };

  root.innerHTML = `
    ${selectorMes('Ahorro')}
    <section class="hero ahorro-hero" aria-label="Tu ahorro">
      <div class="hero-main">
        <span class="hero-label">Ahorro total</span>
        <b class="hero-monto num ${e.total < 0 ? 'neg' : ''}">${money(e.total)}</b>
      </div>
      ${e.total > 0 && abiertas.length ? `<div class="reparto" role="img" aria-label="Cómo se reparte tu ahorro">
        ${abiertas.map((x) => `<i style="width:${trozo(x.llevado)}%;background:${colorMeta(p.metas.indexOf(x.meta))}" title="${esc(x.meta.n)}: ${money(x.llevado)}"></i>`).join('')}
        <i class="libre" style="width:${trozo(libreBarra)}%" title="Libre: ${money(libreBarra)}"></i>
      </div>
      <ul class="reparto-ley">
        ${abiertas.map((x) => `<li><span class="dot" style="background:${colorMeta(p.metas.indexOf(x.meta))}"></span>${esc(x.meta.n)} <b class="num">${money(x.llevado)}</b></li>`).join('')}
        <li><span class="dot libre"></span>Libre <b class="num">${money(e.libre)}</b></li>
      </ul>` : ''}
      <dl class="hero-cuenta">
        <div class="hc"><dt>${icon('entra')}Guardaste en ${nombreMes(per).split(' de ')[0]}</dt><dd class="num">${money(e.esteMes)}</dd></div>
        <div class="hc"><dt>${icon('reloj')}Promedio al mes</dt><dd class="num">${money(e.ritmo)}</dd></div>
        <div class="hc"><dt>${icon('meta')}En metas</dt><dd class="num">${e.pctUsado} %</dd></div>
      </dl>
      <div class="ahorro-acc">
        <button class="btn-primary" id="ahGuardar">${icon('mas')}Ahorrar</button>
        <button id="ahSacar" ${e.libre > 0 ? '' : 'disabled'}>Sacar</button>
      </div>
    </section>

    <section class="seccion">
      <div class="seccion-head"><h2 class="seccion-t">Metas</h2><button class="mini" id="ahNueva" ${e.pctUsado >= 100 ? 'disabled' : ''}>${icon('mas', 'ic-sm')}Nueva meta</button></div>
      ${abiertas.length ? `<p class="sub intro">Cada mes, cada meta se lleva su porcentaje de lo que ahorres. ${100 - e.pctUsado > 0 ? `El ${100 - e.pctUsado} % restante queda libre.` : 'Todo lo que ahorras va a metas.'}</p>
        <ul class="metas">${abiertas.map(tarjeta).join('')}</ul>`
    : `<div class="empty-state">
        <span class="empty-ic">${icon('meta')}</span>
        <b>Ninguna meta todavía</b>
        <span class="sub">Ponle nombre y cifra: “Llantas, 2.000.000, el 30 % de lo que ahorre”. Tu ahorro se sigue viendo entero y la meta va mostrando su avance.</span>
      </div>`}
    </section>
    ${usadas.length ? `<section class="seccion">
      <h2 class="seccion-t">Cumplidas</h2>
      <ul class="list">${usadas.map((x) => `<li class="row">
        <span class="estado pagado" aria-hidden="true">${icon('pagado')}</span>
        <div class="row-txt"><div class="row-t">${esc(x.meta.n)}</div><div class="row-s num">Usaste ${money(x.meta.usada.monto)} el ${fechaCorta(x.meta.usada.fecha)}</div></div>
      </li>`).join('')}</ul>
    </section>` : ''}`;

  enlazarMes(root, repintar);
  root.querySelector('#ahGuardar').onclick = () => abrirRegistro({ catId: e.cat.id, titulo: 'Ahorrar', nota: 'Ahorro', alGuardar: repintar });
  root.querySelector('#ahSacar').onclick = () => sacar(null, e, repintar);
  root.querySelector('#ahNueva').onclick = () => editorMeta(null, e, per, repintar);
  root.querySelectorAll('[data-meta]').forEach((b) => {
    b.onclick = () => editorMeta(p.metas.find((m) => m.id === b.dataset.meta), e, per, repintar);
  });
  root.querySelectorAll('[data-usar]').forEach((b) => {
    b.onclick = () => sacar(e.metas.find((x) => x.meta.id === b.dataset.usar), e, repintar);
  });
}
