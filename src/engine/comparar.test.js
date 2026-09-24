import { describe, it, expect } from 'vitest';
import { compararMeses } from './comparar.js';

const cats = [{ id: 'mer', n: 'Mercado', c: '#1', tipo: 'gasto' }, { id: 'tra', n: 'Transporte', c: '#2', tipo: 'gasto' },
  { id: 'sue', n: 'Sueldo', c: '#3', tipo: 'ingreso' }];
const mov = (fecha, tipo, monto, catId) => ({ id: fecha + monto + catId, fecha, tipo, monto, catId });
const movs = [
  mov('2026-06-02', 'gasto', 300000, 'mer'), mov('2026-07-02', 'gasto', 300000, 'mer'), mov('2026-08-02', 'gasto', 300000, 'mer'),
  mov('2026-09-02', 'gasto', 360000, 'mer'), mov('2026-08-03', 'gasto', 100000, 'tra'), mov('2026-09-03', 'gasto', 50000, 'tra'),
  mov('2026-08-01', 'ingreso', 3000000, 'sue'), mov('2026-09-01', 'ingreso', 3000000, 'sue'),
  mov('2026-09-04', 'gasto', 20000, 'otros'),
];

describe('comparar meses', () => {
  it('contra el mes anterior, del cambio más grande al más chico', () => {
    const c = compararMeses(movs, cats, '2026-09');
    expect(c.filas.map((f) => [f.nombre, f.actual, f.antes, f.delta, f.pct])).toEqual([
      ['Mercado', 360000, 300000, 60000, 20],
      ['Transporte', 50000, 100000, -50000, -50],
      ['Otros', 20000, 0, 20000, null],
      ['Sueldo', 3000000, 3000000, 0, 0],
    ]);
    expect(c.gastos).toEqual({ actual: 430000, antes: 400000, delta: 30000, pct: 8 });
    expect(c.ingresos.delta).toBe(0);
  });

  it('contra el promedio de tres meses', () => {
    const c = compararMeses(movs, cats, '2026-09', 'promedio');
    const tra = c.filas.find((f) => f.id === 'tra');
    expect(tra).toMatchObject({ antes: 33333, delta: 16667 });
    expect(c.filas.find((f) => f.id === 'mer')).toMatchObject({ antes: 300000, pct: 20 });
  });
});
