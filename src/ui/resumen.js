import { money } from '../format.js';

/* F7 — la cuenta que importa: entró, salió, y si estás a favor o desfasado.
   El saldo disponible arranca del saldo inicial que declaraste, no de cero. */
export function tarjetaResumenFlujo(flujo, cur, disponible = null) {
  const positivo = flujo.saldo >= 0;
  const estado = flujo.saldo === 0 ? 'Cuadrado este mes' : positivo ? 'A favor este mes' : 'Desfasado este mes';
  return `<div class="card resumen-flujo">
    <div class="resumen-flujo-cifra">
      <span class="label">Ingresos totales</span>
      <b class="num">${money(flujo.ingresos, cur)}</b>
    </div>
    <div class="resumen-flujo-cifra">
      <span class="label">Gastos totales</span>
      <b class="num">${money(flujo.gastos, cur)}</b>
    </div>
    <div class="resumen-flujo-cifra ${positivo ? 'positivo' : 'negativo'}">
      <span class="label">${estado}</span>
      <b class="num">${positivo ? '' : '−'}${money(Math.abs(flujo.saldo), cur)}</b>
    </div>
    ${disponible === null ? '' : `<div class="resumen-flujo-cifra ${disponible >= 0 ? 'positivo' : 'negativo'}">
      <span class="label">Disponible total</span>
      <b class="num">${disponible < 0 ? '−' : ''}${money(Math.abs(disponible), cur)}</b>
    </div>`}
  </div>`;
}
