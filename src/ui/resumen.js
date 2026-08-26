import { money } from '../format.js';

export function tarjetaResumenFlujo(flujo, cur) {
  const positivo = flujo.saldo >= 0;
  const estado = flujo.saldo === 0 ? 'Saldo del mes' : positivo ? 'Saldo positivo' : 'Saldo negativo';
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
      <b class="num">${money(Math.abs(flujo.saldo), cur)}</b>
    </div>
  </div>`;
}
