import * as store from '../store.js';
import { resumenMes, periodoActual, sumarMeses } from '../engine/movimientos.js';
import { money, moneySigno, nombreMes, plain, digits } from '../format.js';
import { abrirModal } from './modal.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

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
  root.querySelector('#mesArranque')?.addEventListener('click', () => abrirArranque(periodo, repintar));
}

/* Empezaste con → entró → salió → terminas con. El arrastre a la vista en
   cada mes, que es lo que la app existe para decir. */
export function cabeceraMes(p, per = periodo) {
  const r = resumenMes(p.saldoInicial, p.movs, per, p.arranques);
  const arrancado = p.arranques?.[per] !== undefined;
  const clase = (v) => (v < 0 ? 'neg' : 'pos');
  return `<div class="card resumen-mes">
    <div class="rm-col"><span class="label">Empezaste con</span><b class="num ${clase(r.inicial)}">${moneySigno(r.inicial)}</b></div>
    <div class="rm-col"><span class="label">Entró</span><b class="num pos">${money(r.ingresos)}</b></div>
    <div class="rm-col"><span class="label">Salió</span><b class="num neg">${money(r.gastos)}</b></div>
    <div class="rm-col rm-final"><span class="label">Terminas con</span><b class="num ${clase(r.final)}">${moneySigno(r.final)}</b></div>
    <button class="mini rm-arranque" id="mesArranque">${arrancado
    ? 'Este mes empieza de nuevo · cambiar'
    : 'Empezar este mes en cero'}</button>
  </div>`;
}
