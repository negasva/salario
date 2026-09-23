import * as store from '../store.js';
import { saldoActual } from '../engine/movimientos.js';
import { money, moneySigno, plain, esc, digits } from '../format.js';
import { icon } from './icons.js';
import { toast, salir } from './shell.js';

/* Saldo inicial · exportar JSON · salir. Nada más. */
export function renderAjustes(root) {
  const p = store.active();
  const hoy = saldoActual(p.saldoInicial, p.movs, p.arranques);
  root.innerHTML = `
    <header class="page-head"><div class="ph-txt"><span class="eyebrow">Tu cuenta</span><h1 class="mes-titulo">Ajustes</h1></div></header>
    <div class="ajustes">
      <section class="card ajuste">
        <div class="ajuste-txt">
          <h2 class="card-title">Saldo inicial</h2>
          <p class="sub">Con cuánta plata empezaste antes del primer movimiento registrado. Puede ser negativo. Hoy tienes <b class="num ${hoy < 0 ? 'neg' : 'pos'}">${moneySigno(hoy)}</b>.</p>
        </div>
        <div class="field-row">
          <input id="ajSaldo" class="num" inputmode="numeric" value="${p.saldoInicial < 0 ? '-' : ''}${plain(Math.abs(p.saldoInicial))}" aria-label="Saldo inicial">
          <button class="btn-primary" id="ajSaldoSave">Guardar</button>
        </div>
      </section>
      <section class="card ajuste">
        <div class="ajuste-txt">
          <h2 class="card-title">Nombre</h2>
          <p class="sub">Cómo se llama este presupuesto.</p>
        </div>
        <div class="field-row">
          <input id="ajNombre" value="${esc(p.name)}" aria-label="Nombre del presupuesto" autocomplete="off">
          <button id="ajNombreSave">Guardar</button>
        </div>
      </section>
      <section class="card ajuste">
        <div class="ajuste-txt">
          <h2 class="card-title">Tus datos</h2>
          <p class="sub">${p.movs.length} movimientos, ${p.cats.length} categorías y ${p.recurrentes.length} recurrentes. El archivo trae todo lo que la app sabe de ti.</p>
        </div>
        <div class="field-row"><button id="ajExportar">${icon('descargar')}Exportar JSON</button></div>
      </section>
      <section class="card ajuste">
        <div class="ajuste-txt">
          <h2 class="card-title">Sesión</h2>
          <p class="sub">Tus datos quedan guardados en tu cuenta.</p>
        </div>
        <div class="field-row"><button class="btn-borrar" id="ajSalir">${icon('salir')}Cerrar sesión</button></div>
      </section>
    </div>`;

  root.querySelector('#ajSaldoSave').onclick = () => {
    p.saldoInicial = Math.round(digits(root.querySelector('#ajSaldo').value));
    store.save();
    renderAjustes(root);
    toast(`Saldo inicial: ${money(p.saldoInicial)}.`);
  };
  root.querySelector('#ajNombreSave').onclick = () => {
    const n = root.querySelector('#ajNombre').value.trim();
    if (!n) return;
    p.name = n;
    store.save();
    toast('Nombre guardado.');
  };
  root.querySelector('#ajExportar').onclick = () => {
    const blob = new Blob([store.exportarJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reparto-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  root.querySelector('#ajSalir').onclick = salir;
}
