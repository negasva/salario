import * as store from '../store.js';
import { resumenMes, periodoActual, sumarMeses, gastoPorCategoria } from '../engine/movimientos.js';
import { segmentosPorCategoria, franjaReparto } from '../engine/graficas.js';
import { proyeccion } from '../engine/recurrentes.js';
import { money, moneySigno, nombreMes, plain, digits, esc, MESES } from '../format.js';
import { abrirModal } from './modal.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

/* El mes elegido es compartido entre Inicio y Movimientos: cambiar de mes en
   una pantalla y saltar a la otra no lo pierde. */
let periodo = periodoActual();
export function mesElegido() { return periodo; }
export function setMes(per) { periodo = per; }

/* Cabecera de cada pantalla: el mes en grande y sus flechas. Qué pantalla
   es lo dice el menú; el título lo lleva oculto para quien usa lector. `Hoy` aparece solo cuando uno se fue a otro mes. Devuelve el HTML;
   `enlazarMes` cuelga los clics. */
export function selectorMes(pantalla = '') {
  const [a, m] = periodo.split('-');
  const hoy = periodoActual();
  return `<header class="page-head">
    <div class="ph-txt">
      <h1 class="mes-titulo">${pantalla ? `<span class="sr-only">${pantalla}: </span>` : ''}${MESES[Number(m) - 1]} <span class="mes-anio">${a}</span></h1>
    </div>
    <div class="mes-nav" role="group" aria-label="Cambiar de mes">
      ${periodo !== hoy ? '<button class="mes-hoy" data-mes-hoy title="Volver al mes actual">Hoy</button>' : ''}
      <button class="btn-icon" data-mes="-1" aria-label="Mes anterior">${icon('izq')}</button>
      <button class="btn-icon" data-mes="1" aria-label="Mes siguiente">${icon('der')}</button>
    </div>
  </header>`;
}

/* Empezar el mes de nuevo. Pagaste una deuda por fuera, o te sobró plata que
   ya no cuenta: en vez de arrastrar lo de atrás, este mes arranca con la
   cifra que tú digas. Los meses anteriores se quedan como estaban. */
function abrirArranque(per, repintar) {
  const p = store.active();
  const actual = p.arranques?.[per];
  const tiene = actual !== undefined;
  const { cuerpo, cerrar } = abrirModal({ titulo: `Empezar ${nombreMes(per)}` });
  cuerpo.innerHTML = `
    <p class="sub">Borra el arrastre de los meses anteriores y arranca con la cifra que pongas. Lo de atrás no cambia.</p>
    <div class="fld" style="margin-top:var(--space-4)"><label for="arrMonto">Empezar con</label>
      <input id="arrMonto" class="num monto" inputmode="numeric" value="${tiene ? plain(actual) : '0'}"></div>
    <p class="sub">Cero para empezar limpio, negativo si debes.</p>
    <button class="wide btn-primary" id="arrSave" style="margin-top:var(--space-4)">Guardar</button>
    ${tiene ? '<button class="wide" id="arrQuitar" style="margin-top:var(--space-2)">Quitar y volver al arrastre normal</button>' : ''}`;

  cuerpo.querySelector('#arrSave').onclick = () => {
    p.arranques[per] = Math.round(digits(cuerpo.querySelector('#arrMonto').value));
    store.save();
    cerrar();
    repintar();
    toast(`${nombreMes(per)} empieza con ${money(p.arranques[per])}.`);
  };
  cuerpo.querySelector('#arrQuitar')?.addEventListener('click', () => {
    delete p.arranques[per];
    store.save();
    cerrar();
    repintar();
    toast('Vuelve a arrastrarse el saldo del mes anterior.');
  });
  cuerpo.querySelector('#arrMonto').focus();
}

/* El saldo rueda de la cifra que tenías a la nueva cuando cambia (otro mes,
   un movimiento guardado): así se ve cuánto se movió. 450 ms, ease-out, y
   nada con "reducir movimiento". La primera pintada no rueda. */
let cifraPrevia = null;
function rodarCifra(root) {
  const el = root.querySelector('.hero-monto[data-v]');
  if (!el) return;
  const a = cifraPrevia; const z = Number(el.dataset.v);
  cifraPrevia = z;
  if (a === null || a === z || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const t0 = performance.now();
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / 450);
    el.textContent = moneySigno(Math.round(a + (z - a) * (1 - (1 - k) ** 3)));
    if (k < 1 && el.isConnected) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

export function enlazarMes(root, repintar) {
  rodarCifra(root);
  root.querySelectorAll('[data-mes]').forEach((b) => {
    b.onclick = () => { periodo = sumarMeses(periodo, Number(b.dataset.mes)); repintar(); };
  });
  root.querySelector('[data-mes-hoy]')?.addEventListener('click', () => { periodo = periodoActual(); repintar(); });
  root.querySelector('#mesArranque')?.addEventListener('click', () => abrirArranque(periodo, repintar));
}

/* Empezaste con → entró → salió → terminas con. El arrastre a la vista en
   cada mes, que es lo que la app existe para decir: el saldo final en grande
   y debajo la cuenta que lo explica. `compacta` es la versión para encima de
   una lista. */
export function cabeceraMes(p, per = periodo, { compacta = false } = {}) {
  const r = resumenMes(p.saldoInicial, p.movs, per, p.arranques);
  const arrancado = p.arranques?.[per] !== undefined;
  const clase = (v) => (v < 0 ? 'neg' : v > 0 ? 'pos' : '');
  return `<section class="hero ${compacta ? 'hero-compacta' : ''}" aria-label="Saldo del mes">
    <div class="hero-main">
      <span class="hero-label">${per < periodoActual() ? 'Terminaste con' : 'Terminas con'}</span>
      <b class="hero-monto num ${clase(r.final)}" data-v="${r.final}">${moneySigno(r.final)}</b>
    </div>
    ${compacta ? '' : franjaHTML(p, per, r)}
    <dl class="hero-cuenta">
      <div class="hc"><dt>Empezaste con</dt><dd class="num ${clase(r.inicial)}">${moneySigno(r.inicial)}</dd></div>
      <div class="hc"><dt>Entró</dt><dd class="num ${clase(r.ingresos)}">${moneySigno(r.ingresos)}</dd></div>
      <div class="hc"><dt>Salió</dt><dd class="num ${clase(-r.gastos)}">${moneySigno(-r.gastos)}</dd></div>
    </dl>
    ${proyeccionHTML(p, per, r.final, clase)}
    <button class="hero-arranque" id="mesArranque">${icon('reiniciar')}${arrancado
    ? 'Este mes empieza de nuevo · cambiar'
    : 'Empezar este mes en cero'}</button>
  </section>`;
}

/* La firma de la app: lo que entró este mes partido en lo que se fue a cada
   categoría. Cada tramo mide lo que pesa sobre lo que entró; lo que no se gastó queda
   como tramo vacío al final. Debajo, las tres más grandes con su monto. */
function franjaHTML(p, per, r) {
  const segs = segmentosPorCategoria(p.cats, gastoPorCategoria(p.movs, per));
  const f = franjaReparto(segs, r.ingresos);
  if (!f) return `<div class="reparto reparto-vacio" aria-hidden="true"><i class="libre" style="--w:100;--k:0"></i></div>
  <p class="reparto-pie">Aquí se reparte el mes cuando registres un ingreso y un gasto.</p>`;
  const tramos = [...f.partes, ...(f.libre ? [{ nombre: 'Libre', monto: f.libre.monto, pct: f.libre.pct, libre: true }] : [])];
  const resumen = tramos.map((t) => `${t.nombre} ${money(t.monto)}`).join(', ');
  const leyenda = f.partes.slice(0, 3).concat(f.libre ? [{ nombre: 'Libre', monto: f.libre.monto, libre: true }] : []);
  return `<div class="reparto" role="img" aria-label="Cómo se reparte el mes: ${esc(resumen)}">
    ${tramos.map((t, k) => `<i class="${t.libre ? 'libre' : ''}" data-tip="${esc(t.nombre)}\n${money(t.monto)} · ${String(t.pct).replace('.', ',')} %" style="--w:${t.pct};--k:${k}${t.libre ? '' : `;--c:${t.color}`}"></i>`).join('')}
  </div>
  <ul class="reparto-ley">${leyenda.map((t) => `<li class="${t.libre ? 'libre' : ''}"><i style="${t.libre ? '' : `background:${t.color}`}"></i><span>${esc(t.nombre)}</span><b class="num">${money(t.monto)}</b></li>`).join('')}</ul>
  ${f.exceso ? `<p class="reparto-aviso">Gastaste ${money(f.exceso)} más de lo que entró este mes.</p>` : ''}`;
}

/* Si pagas y recibes lo que falta de los recurrentes, con cuánto terminas.
   Solo en el mes en curso y los que vienen: en uno pasado ya no hay nada
   que pagar a tiempo. */
function proyeccionHTML(p, per, final, clase) {
  if (per < periodoActual()) return '';
  const pr = proyeccion(final, p.recurrentes, p.movs, per);
  if (!pr.porPagar && !pr.porRecibir) return '';
  const partes = [pr.porPagar ? `−${money(pr.porPagar)} por pagar` : '', pr.porRecibir ? `+${money(pr.porRecibir)} por recibir` : '']
    .filter(Boolean).join(' · ');
  return `<a class="hero-proy" href="#recurrentes">
    <span class="hp-txt"><span>Si pagas lo que falta<small class="num">${partes}</small></span></span>
    <b class="num ${clase(pr.final)}">terminas con ${moneySigno(pr.final)}</b>
  </a>`;
}
