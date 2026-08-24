import { describe, it, expect } from 'vitest';
import { total, amount, spentInItem, fixedVariableSplit, freeFor, diagnosticoEsenciales } from './reparto.js';

describe('reparto basico', () => {
  it('suma porcentajes', () => {
    expect(total([{ p: 50 }, { p: 25.5 }])).toBe(75.5);
  });

  it('calcula monto desde porcentaje', () => {
    expect(amount({ p: 10 }, 1000000)).toBe(100000);
  });

  it('suma renglones de un bloque', () => {
    expect(spentInItem({ L: [{ v: 100 }, { v: 50 }] })).toBe(150);
  });
});

describe('fijo/variable', () => {
  it('sin renglones no hay nada que recortar', () => {
    expect(fixedVariableSplit({ L: [] })).toEqual({ fixed: 0, variable: 0 });
  });

  it('separa por bandera fixed', () => {
    const item = { L: [{ v: 100, fixed: true }, { v: 40, fixed: false }] };
    expect(fixedVariableSplit(item)).toEqual({ fixed: 100, variable: 40 });
  });
});

describe('metas en competencia (freeFor)', () => {
  it('el tope baja cuando otra meta ya reclamó parte del bloque', () => {
    const g1 = { a: { i1: 60 } };
    const g2 = { a: { i1: 0 } };
    expect(freeFor([g1, g2], g2, 'i1')).toBe(40);
  });
});

describe('diagnostico de esenciales', () => {
  it('semaforo verde bajo 50%', () => {
    const r = diagnosticoEsenciales({ L: [{ n: 'arriendo', v: 400000 }] }, 1000000);
    expect(r.nivel).toBe('verde');
  });
  it('semaforo rojo sobre 65% y lista los top 3', () => {
    const item = {
      L: [
        { n: 'arriendo', v: 400000 },
        { n: 'mercado', v: 200000 },
        { n: 'transporte', v: 100000 },
        { n: 'internet', v: 50000 },
      ],
    };
    const r = diagnosticoEsenciales(item, 1000000);
    expect(r.nivel).toBe('rojo');
    expect(r.top3).toHaveLength(3);
    expect(r.top3[0].n).toBe('arriendo');
  });
});
