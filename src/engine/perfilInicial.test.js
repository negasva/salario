import { describe, it, expect } from 'vitest';
import { gastosSugeridos, gastoMaximoSugerido, RANGOS } from './perfilInicial.js';

describe('gastosSugeridos', () => {
  it('devuelve los cinco gastos con su monto sobre el ingreso', () => {
    const g = gastosSugeridos(5000000);
    expect(g.map((x) => x.n)).toEqual(['Arriendo', 'Mercado', 'Salud', 'Gasolina', 'Inversión']);
    expect(g[0].m).toBe(1500000);
    expect(g[1].m).toBe(750000);
  });

  it('sin ingreso deja los montos en cero', () => {
    expect(gastosSugeridos(0).every((g) => g.m === 0)).toBe(true);
  });
});

describe('gastoMaximoSugerido', () => {
  it('baja el tope cuando el ingreso es alto', () => {
    expect(gastoMaximoSugerido(35, 10000000)).toBe(65);
    expect(gastoMaximoSugerido(35, 5000000)).toBe(70);
    expect(gastoMaximoSugerido(35, 3000000)).toBe(75);
    expect(gastoMaximoSugerido(35, 1500000)).toBe(85);
  });

  it('el joven ahorra más y el mayor tiene más obligaciones', () => {
    expect(gastoMaximoSugerido(25, 5000000)).toBe(65);
    expect(gastoMaximoSugerido(55, 5000000)).toBe(75);
  });

  it('nunca se sale de 50 a 90', () => {
    expect(gastoMaximoSugerido(60, 1500000)).toBe(90);
    expect(gastoMaximoSugerido(0, 0)).toBe(85);
  });
});

describe('RANGOS', () => {
  it('cubre desde cero hasta infinito sin huecos', () => {
    RANGOS.forEach((r, i) => { if (i) expect(r.min).toBe(RANGOS[i - 1].max); });
    expect(RANGOS[0].min).toBe(0);
    expect(RANGOS.at(-1).max).toBe(Infinity);
  });
});
