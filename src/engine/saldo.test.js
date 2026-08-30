import { describe, it, expect } from 'vitest';
import { saldoActual, saldoBase, saldoAFavor, disponibleParaRepartir } from './saldo.js';
import { resumenFlujo } from './movimientos.js';

describe('saldoActual', () => {
  it('suma ingresos y resta gastos sobre el saldo base', () => {
    const movs = [
      { tipo: 'ingreso', monto: 1000 },
      { tipo: 'gasto', monto: 300 },
      { tipo: 'gasto', monto: 200 },
    ];
    expect(saldoActual(500, movs)).toBe(1000);
  });

  it('sin movimientos devuelve el saldo base', () => {
    expect(saldoActual(250, [])).toBe(250);
    expect(saldoActual(undefined, [])).toBe(0);
  });

  it('puede quedar negativo si gastaste más de lo que hay', () => {
    expect(saldoActual(0, [{ tipo: 'gasto', monto: 100 }])).toBe(-100);
  });
});

describe('saldoBase', () => {
  it('lee el saldo de la moneda pedida', () => {
    const p = { cur: 'COP', saldos: { COP: 200000, USD: 50 } };
    expect(saldoBase(p)).toBe(200000);
    expect(saldoBase(p, 'USD')).toBe(50);
    expect(saldoBase(p, 'EUR')).toBe(0);
    expect(saldoBase(null)).toBe(0);
  });
});

describe('saldoAFavor — una sola fórmula', () => {
  const movs = [
    { tipo: 'ingreso', monto: 4000000, fecha: '2026-08-01' },
    { tipo: 'ingreso', monto: 500000, fecha: '2026-08-15', extra: true },
    { tipo: 'gasto', monto: 3766000, fecha: '2026-08-10' },
    { tipo: 'gasto', monto: 900000, fecha: '2026-07-10' }, // otro mes, no cuenta
  ];

  it('es ingresos totales menos gastos pagados de verdad', () => {
    expect(saldoAFavor(movs, '2026-08')).toBe(734000);
  });

  /* El bug: la tarjeta decía 734.000 y el modal de reparto 32.600 porque cada
     uno tenía su propia cuenta. Ahora los dos leen de aquí. */
  it('coincide con la tarjeta "A favor este mes"', () => {
    expect(saldoAFavor(movs, '2026-08')).toBe(resumenFlujo(movs, '2026-08').saldo);
  });

  it('lo repartible nunca es negativo', () => {
    const rojo = [{ tipo: 'ingreso', monto: 100, fecha: '2026-08-01' },
      { tipo: 'gasto', monto: 500, fecha: '2026-08-02' }];
    expect(saldoAFavor(rojo, '2026-08')).toBe(-400);
    expect(disponibleParaRepartir(rojo, '2026-08')).toBe(0);
  });
});
