import { resumenMes, periodoActual, sumarMeses } from '../engine/movimientos.js';
import { money, moneySigno, nombreMes } from '../format.js';
import { icon } from './icons.js';

/* El mes elegido es compartido entre Inicio y Movimientos: cambiar de mes en
   una pantalla y saltar a la otra no lo pierde. */
let periodo = periodoActual();
export function mesElegido() { return periodo; }
export function setMes(per) { periodo = per; }

// Flechas del mes. Devuelve el HTML; `enlazarMes` cuelga los clics.
export function selectorMes() {
  return `<div class="mes-nav">
    <button class="btn-icon" data-mes="-1" aria-label="Mes anterior">${icon('izq')}</button>
    <h2 class="mes-titulo">${nombreMes(periodo)}</h2>
    <button class="btn-icon" data-mes="1" aria-label="Mes siguiente">${icon('der')}</button>
  </div>`;
}

export function enlazarMes(root, repintar) {
  root.querySelectorAll('[data-mes]').forEach((b) => {
    b.onclick = () => { periodo = sumarMeses(periodo, Number(b.dataset.mes)); repintar(); };
  });
}

/* Empezaste con → entró → salió → terminas con. El arrastre a la vista en
   cada mes, que es lo que la app existe para decir. */
export function cabeceraMes(p, per = periodo) {
  const r = resumenMes(p.saldoInicial, p.movs, per);
  const clase = (v) => (v < 0 ? 'neg' : 'pos');
  return `<div class="card resumen-mes">
    <div class="rm-col"><span class="label">Empezaste con</span><b class="num ${clase(r.inicial)}">${moneySigno(r.inicial)}</b></div>
    <div class="rm-col"><span class="label">Entró</span><b class="num pos">${money(r.ingresos)}</b></div>
    <div class="rm-col"><span class="label">Salió</span><b class="num neg">${money(r.gastos)}</b></div>
    <div class="rm-col rm-final"><span class="label">Terminas con</span><b class="num ${clase(r.final)}">${moneySigno(r.final)}</b></div>
  </div>`;
}
