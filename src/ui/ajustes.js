import * as store from '../store.js';
import { saldoActual } from '../engine/movimientos.js';
import { money, moneySigno, plain, esc, digits } from '../format.js';
import { signOut } from '../auth.js';
import { toast } from './shell.js';

/* Saldo inicial · exportar JSON · salir. Nada más. */
export function renderAjustes(root) {
  const p = store.active();
  root.innerHTML = `
    <div class="card">
      <span class="label">Saldo inicial</span>
      <p class="sub">Con cuánta plata empezaste antes del primer movimiento registrado. Puede ser negativo. Hoy tienes <b class="num">${moneySigno(saldoActual(p.saldoInicial, p.movs, p.arranques))}</b>.</p>
      <div class="prow">
        <input id="ajSaldo" class="num" inputmode="numeric" value="${p.saldoInicial < 0 ? '-' : ''}${plain(Math.abs(p.saldoInicial))}" aria-label="Saldo inicial">
        <button class="btn-primary" id="ajSaldoSave">Guardar</button>
      </div>
    </div>
    <div class="card">
      <span class="label">Nombre</span>
      <div class="prow">
        <input id="ajNombre" value="${esc(p.name)}" aria-label="Nombre del presupuesto">
        <button id="ajNombreSave">Guardar</button>
      </div>
    </div>
    <div class="card">
      <span class="label">Tus datos</span>
      <p class="sub">${p.movs.length} movimientos, ${p.cats.length} categorías y ${p.recurrentes.length} recurrentes. El archivo trae todo lo que la app sabe de ti.</p>
      <button id="ajExportar">Exportar JSON</button>
    </div>
    <div class="card">
      <span class="label">Sesión</span>
      <button id="ajSalir">Cerrar sesión</button>
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
  root.querySelector('#ajSalir').onclick = async () => { await signOut(); location.reload(); };
}
