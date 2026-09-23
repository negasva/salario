import * as store from '../store.js';
import { resumenMes, periodoActual, sumarMeses } from '../engine/movimientos.js';
import { money, moneySigno, nombreMes, plain, digits, MESES } from '../format.js';
import { abrirModal } from './modal.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

/* El mes elegido es compartido entre Inicio y Movimientos: cambiar de mes en
   una pantalla y saltar a la otra no lo pierde. */
let periodo = periodoActual();
export function mesElegido() { return periodo; }
export function setMes(per) { periodo = per; }

/* Cabecera de cada pantalla: qué pantalla es, el mes en grande y sus
   flechas. `Hoy` aparece solo cuando uno se fue a otro mes. Devuelve el HTML;
   `enlazarMes` cuelga los clics. */
export function selectorMes(pantalla = '') {
  const [a, m] = periodo.split('-');
  const hoy = periodoActual();
  return `<header class="page-head">
    <div class="ph-txt">
      ${pantalla ? `<span class="eyebrow">${pantalla}</span>` : ''}
      <h1 class="mes-titulo">${MESES[Number(m) - 1]} <span class="mes-anio">${a}</span></h1>
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
    <p class="sub">Borra lo que viene arrastrado de los meses anteriores y arranca este con la cifra que pongas. Sirve cuando pagaste una deuda por fuera o te sobró plata que ya no cuenta. Los meses de atrás quedan como están.</p>
    <div class="fld" style="margin-top:var(--space-4)"><label for="arrMonto">Empezar con</label>
      <input id="arrMonto" class="num monto" inputmode="numeric" value="${tiene ? plain(actual) : '0'}"></div>
    <p class="sub">Déjalo en cero para empezar limpio. Puedes poner un número negativo si arrancas debiendo.</p>
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

export function enlazarMes(root, repintar) {
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
      <span class="hero-label">Terminas con</span>
      <b class="hero-monto num ${clase(r.final)}">${moneySigno(r.final)}</b>
    </div>
    <dl class="hero-cuenta">
      <div class="hc"><dt>${icon('billetera')}Empezaste con</dt><dd class="num ${clase(r.inicial)}">${moneySigno(r.inicial)}</dd></div>
      <div class="hc"><dt>${icon('entra')}Entró</dt><dd class="num ${clase(r.ingresos)}">${moneySigno(r.ingresos)}</dd></div>
      <div class="hc"><dt>${icon('sale')}Salió</dt><dd class="num ${clase(-r.gastos)}">${moneySigno(-r.gastos)}</dd></div>
    </dl>
    <button class="hero-arranque" id="mesArranque">${icon('reiniciar')}${arrancado
    ? 'Este mes empieza de nuevo · cambiar'
    : 'Empezar este mes en cero'}</button>
  </section>`;
}
