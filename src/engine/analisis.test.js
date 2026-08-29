import { describe, it, expect } from 'vitest';
import { segmentosReal, segmentosDeSnapshot, arcos } from './analisis.js';

const items = [
  { id: 'i1', n: 'Arriendo', c: 'red', m: 1200000 },
  { id: 'i2', n: 'Mercado', c: 'orange', m: 600000 },
  { id: 'i3', n: 'Vacío', c: 'gray', m: 0 },
];
const goals = [{ id: 'g1', n: 'Moto', mes: 500000 }, { id: 'g2', n: 'Vieja', mes: 100000, estado: 'completa' }];

describe('segmentosReal', () => {
  const movs = [
    { fecha: '2026-08-02', tipo: 'gasto', monto: 1200000, itemId: 'i1' },
    { fecha: '2026-08-05', tipo: 'gasto', monto: 300000, itemId: 'i2' },
    { fecha: '2026-08-06', tipo: 'gasto', monto: 500000, itemId: 'i2', goalId: 'g1' },
    { fecha: '2026-08-07', tipo: 'ingreso', monto: 5000000 },
    { fecha: '2026-07-07', tipo: 'gasto', monto: 999, itemId: 'i1' },
  ];

  it('un aporte a meta cuenta en la meta, no en la categoría', () => {
    const s = segmentosReal(items, goals, movs, '2026-08', 5000000);
    expect(s.find((x) => x.nombre === 'Mercado').monto).toBe(300000);
    expect(s.find((x) => x.nombre === 'Moto').monto).toBe(500000);
  });

  it('ignora otros meses y los ingresos', () => {
    const s = segmentosReal(items, goals, movs, '2026-08', 5000000);
    expect(s.find((x) => x.nombre === 'Arriendo').monto).toBe(1200000);
    expect(s.reduce((t, x) => t + x.monto, 0)).toBe(2000000);
  });

  it('trae la diferencia contra el planeado', () => {
    const s = segmentosReal(items, goals, movs, '2026-08', 5000000);
    expect(s.find((x) => x.nombre === 'Mercado').diferencia).toBe(300000);
    expect(s.find((x) => x.nombre === 'Arriendo').diferencia).toBe(0);
  });

  it('un mes sin gastos devuelve vacío', () => {
    expect(segmentosReal(items, goals, movs, '2026-01', 5000000)).toEqual([]);
  });
});

describe('segmentosDeSnapshot', () => {
  const snap = {
    version: 2, ingresoPlan: 5000000, ingresoReal: 4000000,
    items: [{ itemId: 'i1', nombre: 'Arriendo', plan: 1200000, real: 1000000 }],
    metas: [{ goalId: 'g1', nombre: 'Moto', aportado: 200000 }],
  };

  it('lee el real del mes cerrado sobre el ingreso real', () => {
    const s = segmentosDeSnapshot(snap);
    expect(s[0].monto).toBe(1000000);
    expect(s[0].pct).toBe(25);
    expect(s[1].nombre).toBe('Moto');
  });

  it('un snapshot viejo no tiene con qué', () => {
    expect(segmentosDeSnapshot({ ahorroRate: 12 })).toEqual([]);
  });
});

describe('arcos', () => {
  it('reparte la circunferencia en proporción y encadena los offsets', () => {
    const a = arcos([{ monto: 75 }, { monto: 25 }], 100);
    expect(a[0].largo).toBe(75);
    expect(a[0].offset).toBe(-0);
    expect(a[1].largo).toBe(25);
    expect(a[1].offset).toBe(-75);
  });

  it('sin montos no hay arcos', () => {
    expect(arcos([], 100)).toEqual([]);
    expect(arcos([{ monto: 0 }], 100)).toEqual([]);
  });
});
