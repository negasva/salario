import { describe, it, expect } from 'vitest';
import { saldoActual, saldoBase } from './saldo.js';

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
