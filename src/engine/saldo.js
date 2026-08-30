import { resumenFlujo } from './movimientos.js';
import { r2 } from './reparto.js';

/* F1 — saldo disponible: el saldo base que declaraste al abrir la cuenta,
   más todo lo que entró, menos todo lo que salió. Sin filtro de periodo:
   un saldo es acumulado o no es un saldo. */
export function saldoActual(base, movs = []) {
  return movs.reduce((t, m) => t + (m.tipo === 'ingreso' ? m.monto : -m.monto), Number(base) || 0);
}

// El saldo base vive por moneda: un perfil puede tener pesos y dólares a la vez.
export function saldoBase(p, cur = p?.cur) {
  return Number(p?.saldos?.[cur]) || 0;
}

/* Saldo a favor del mes: lo que entró menos lo que de verdad salió. Fuente
   única — la tarjeta "A favor este mes" y el modal de reparto leen de aquí.
   Antes el modal usaba su propia cuenta (ingreso − plan − aportes a metas) y
   por eso decía $ 32.600 donde la tarjeta decía $ 734.000. Un saldo no se
   calcula dos veces. */
export function saldoAFavor(movs = [], periodo) {
  const { ingresos, gastos } = resumenFlujo(movs, periodo);
  return r2(ingresos - gastos);
}

// Lo repartible nunca es negativo: si te desfasaste, no hay nada que repartir.
export function disponibleParaRepartir(movs = [], periodo) {
  return Math.max(0, saldoAFavor(movs, periodo));
}
