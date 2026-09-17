import { describe, it, expect } from 'vitest';
import { arcos, segmentosPorCategoria, barras, linea } from './graficas.js';

describe('donut', () => {
  it('reparte la circunferencia en proporción y los porcentajes suman 100', () => {
    const t = arcos([{ id: 'a', monto: 75 }, { id: 'b', monto: 25 }], 100);
    expect(t.map((x) => x.largo)).toEqual([75, 25]);
    expect(t.map((x) => x.offset)).toEqual([0, -75]);
    expect(t.reduce((s, x) => s + x.pct, 0)).toBe(100);
  });

  it('sin montos no hay trozos', () => {
    expect(arcos([], 100)).toEqual([]);
    expect(arcos([{ id: 'a', monto: 0 }], 100)).toEqual([]);
  });

  it('segmentosPorCategoria pone nombre y color y ordena de mayor a menor', () => {
    const cats = [{ id: 'a', n: 'Mercado', c: '#111' }];
    const s = segmentosPorCategoria(cats, { a: 10, zz: 30 });
    expect(s.map((x) => x.nombre)).toEqual(['Otros', 'Mercado']);
    expect(s[1].color).toBe('#111');
  });
});

describe('barras y línea', () => {
  const serie = [
    { periodo: '2026-07', ingresos: 0, gastos: 0, final: 0 },
    { periodo: '2026-08', ingresos: 1000000, gastos: 1100000, final: -100000 },
    { periodo: '2026-09', ingresos: 1000000, gastos: 0, final: 900000 },
  ];

  it('las barras comparten escala y la más alta toca el tope', () => {
    const b = barras(serie, 100);
    expect(b[1].gastos).toBe(100);
    expect(b[1].ingresos).toBe(91);
    expect(b[0]).toEqual({ periodo: '2026-07', ingresos: 0, gastos: 0 });
  });

  it('la línea baja cuando el saldo es negativo y la línea del cero queda entre medias', () => {
    const { puntos, cero } = linea(serie, 200, 100);
    expect(puntos.map((p) => p.x)).toEqual([0, 100, 200]);
    expect(puntos[1].y).toBeGreaterThan(cero);
    expect(puntos[2].y).toBe(0);
    expect(puntos[1].y).toBe(100);
  });
});
