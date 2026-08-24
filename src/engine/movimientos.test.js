import { describe, it, expect } from 'vitest';
import {
  periodoDe, enPeriodo, porItem, porLinea, ingresoReal, gastoTotal, aportesAMeta, podar, hoyISO,
} from './movimientos.js';

const MOVS = [
  { id: 'm1', fecha: '2026-08-03', tipo: 'gasto', monto: 85000, itemId: 'i1', lineId: 'l1' },
  { id: 'm2', fecha: '2026-08-20', tipo: 'gasto', monto: 15000, itemId: 'i1', lineId: 'l1' },
  { id: 'm3', fecha: '2026-08-20', tipo: 'gasto', monto: 40000, itemId: 'i2', lineId: null },
  { id: 'm4', fecha: '2026-07-31', tipo: 'gasto', monto: 999000, itemId: 'i1', lineId: 'l1' },
  { id: 'm5', fecha: '2026-08-01', tipo: 'ingreso', monto: 5500000, extra: false },
  { id: 'm6', fecha: '2026-08-15', tipo: 'ingreso', monto: 800000, extra: true },
  { id: 'm7', fecha: '2026-08-28', tipo: 'gasto', monto: 200000, itemId: 'i3', goalId: 'g1' },
  { id: 'm8', fecha: '2026-09-28', tipo: 'gasto', monto: 300000, itemId: 'i3', goalId: 'g1' },
];

describe('periodo', () => {
  it('saca AAAA-MM de una fecha ISO corta', () => {
    expect(periodoDe('2026-08-24')).toBe('2026-08');
  });
  it('filtra por periodo sin arrastrar el mes vecino', () => {
    expect(enPeriodo(MOVS, '2026-08').map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm5', 'm6', 'm7']);
  });
});

describe('agregados del mes', () => {
  it('porItem suma solo gastos', () => {
    expect(porItem(MOVS, '2026-08')).toEqual({ i1: 100000, i2: 40000, i3: 200000 });
  });
  it('porLinea ignora los movimientos sin renglón', () => {
    expect(porLinea(MOVS, '2026-08')).toEqual({ l1: 100000 });
  });
  it('gastoTotal deja fuera los ingresos', () => {
    expect(gastoTotal(MOVS, '2026-08')).toBe(340000);
  });
  it('un periodo vacío no rompe nada', () => {
    expect(porItem(MOVS, '2026-01')).toEqual({});
    expect(gastoTotal(MOVS, '2026-01')).toBe(0);
    expect(ingresoReal(MOVS, '2026-01')).toEqual({ nomina: 0, extra: 0, total: 0 });
  });
});

describe('ingreso real', () => {
  it('separa nómina de extra', () => {
    expect(ingresoReal(MOVS, '2026-08')).toEqual({ nomina: 5500000, extra: 800000, total: 6300000 });
  });
});

describe('aportes a una meta', () => {
  it('suma total y por periodo, cruzando meses', () => {
    expect(aportesAMeta(MOVS, 'g1')).toEqual({
      total: 500000,
      porPeriodo: { '2026-08': 200000, '2026-09': 300000 },
    });
  });
  it('una meta sin aportes da cero', () => {
    expect(aportesAMeta(MOVS, 'gX')).toEqual({ total: 0, porPeriodo: {} });
  });
});

describe('hoy en local', () => {
  it('no corre el día como lo haría toISOString', () => {
    expect(hoyISO(new Date(2026, 7, 1))).toBe('2026-08-01');
  });
});

describe('poda', () => {
  it('conserva los últimos 24 meses y corta lo anterior', () => {
    const hoy = new Date(2026, 7, 24);
    const viejos = [
      { fecha: '2024-07-31', tipo: 'gasto', monto: 1 },
      { fecha: '2024-08-01', tipo: 'gasto', monto: 2 },
      { fecha: '2026-08-24', tipo: 'gasto', monto: 3 },
    ];
    expect(podar(viejos, 24, hoy).map((m) => m.monto)).toEqual([2, 3]);
  });
});
