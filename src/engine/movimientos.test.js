import { describe, it, expect } from 'vitest';
import {
  periodoDe, enPeriodo, porItem, porLinea, ingresoReal, gastoTotal, resumenFlujo, aportesAMeta, podar, hoyISO, serieAhorro, serieTasaAhorro, ritmoDelMes } from './movimientos.js';

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

describe('resumen del flujo mensual', () => {
  it('suma ingresos, gastos y saldo del mismo periodo', () => {
    expect(resumenFlujo(MOVS, '2026-08')).toEqual({ ingresos: 6300000, gastos: 340000, saldo: 5960000 });
  });

  it('puede quedar negativo', () => {
    expect(resumenFlujo([
      { fecha: '2026-08-01', tipo: 'ingreso', monto: 100 },
      { fecha: '2026-08-02', tipo: 'gasto', monto: 250 },
    ], '2026-08')).toEqual({ ingresos: 100, gastos: 250, saldo: -150 });
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

describe('serie de ahorro', () => {
  const hoy = new Date(2026, 7, 15); // agosto 2026

  it('sin movimientos devuelve los meses en cero', () => {
    const s = serieAhorro([], null, 3, [], hoy);
    expect(s.map((r) => r.periodo)).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(s.every((r) => r.monto === 0 && r.acumulado === 0)).toBe(true);
  });

  it('el acumulado es monótono', () => {
    const movs = [
      { id: 'm1', fecha: '2026-06-10', tipo: 'gasto', monto: 100, goalId: 'g1' },
      { id: 'm2', fecha: '2026-08-02', tipo: 'gasto', monto: 50, goalId: 'g1' },
    ];
    const s = serieAhorro(movs, null, 3, [], hoy);
    expect(s.map((r) => r.acumulado)).toEqual([100, 100, 150]);
  });

  it('no cuenta dos veces un aporte a meta cargado a un bloque de ahorro', () => {
    const movs = [{ id: 'm1', fecha: '2026-08-02', tipo: 'gasto', monto: 200, goalId: 'g1', itemId: 'cor' }];
    expect(serieAhorro(movs, null, 1, ['cor'], hoy)[0].monto).toBe(200);
  });

  it('filtra por meta, por bloque y por abonos', () => {
    const movs = [
      { id: 'm1', fecha: '2026-08-02', tipo: 'gasto', monto: 200, goalId: 'g1' },
      { id: 'm2', fecha: '2026-08-03', tipo: 'gasto', monto: 300, itemId: 'cor' },
      { id: 'm3', fecha: '2026-08-04', tipo: 'gasto', monto: 400, lineId: 'l1', abono: true },
    ];
    expect(serieAhorro(movs, 'meta:g1', 1, [], hoy)[0].monto).toBe(200);
    expect(serieAhorro(movs, 'item:cor', 1, [], hoy)[0].monto).toBe(300);
    expect(serieAhorro(movs, 'deuda', 1, [], hoy)[0].monto).toBe(400);
  });
});

describe('tasa de ahorro desde el libro', () => {
  const hoy = new Date(2026, 7, 15);
  it('es lo ahorrado sobre lo que entró, mes a mes', () => {
    const movs = [
      { id: 'i1', fecha: '2026-08-01', tipo: 'ingreso', monto: 5000000 },
      { id: 'g1', fecha: '2026-08-02', tipo: 'gasto', monto: 1000000, itemId: 'cor' },
    ];
    expect(serieTasaAhorro(movs, ['cor'], 1, hoy)).toEqual([{ periodo: '2026-08', tasa: 20 }]);
  });

  it('un mes sin ingresos no divide por cero', () => {
    expect(serieTasaAhorro([], ['cor'], 1, hoy)[0].tasa).toBe(0);
  });
});

describe('ritmo del mes', () => {
  it('a mitad de mes se espera la mitad del bloque', () => {
    const r = ritmoDelMes(600000, 1000000, new Date(2026, 7, 16)); // agosto: 31 días
    expect(Math.round(r.esperado)).toBe(516129);
    expect(r.pct).toBe(16);
  });

  it('sin presupuesto no inventa porcentaje', () => {
    expect(ritmoDelMes(100, 0, new Date(2026, 7, 16)).pct).toBe(0);
  });
});
