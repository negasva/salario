import { describe, it, expect } from 'vitest';
import { total, balance, amount, shareOf, spentInItem, fixedVariableSplit, freeFor, diagnosticoEsenciales } from './reparto.js';

describe('reparto basico', () => {
  it('suma la plata asignada a cada categoria', () => {
    expect(total([{ m: 500000 }, { m: 255000 }])).toBe(755000);
  });

  it('el monto es lo asignado, sin cuentas de por medio', () => {
    expect(amount({ m: 100000 })).toBe(100000);
    expect(amount({})).toBe(0);
  });

  it('el porcentaje es un numero derivado del ingreso', () => {
    expect(shareOf({ m: 100000 }, 1000000)).toBe(10);
    expect(shareOf({ m: 100000 }, 0)).toBe(0);
  });

  it('suma renglones de un bloque', () => {
    expect(spentInItem({ L: [{ v: 100 }, { v: 50 }] })).toBe(150);
  });
});

describe('cuadrar el reparto', () => {
  it('cuando falta plata por repartir dice cuanta', () => {
    const b = balance([{ m: 600000 }, { m: 300000 }], 1000000);
    expect(b.falta).toBe(100000);
    expect(b.exceso).toBe(0);
    expect(b.cuadrado).toBe(false);
  });

  it('cuando te pasaste dice por cuanto', () => {
    const b = balance([{ m: 800000 }, { m: 400000 }], 1000000);
    expect(b.exceso).toBe(200000);
    expect(b.falta).toBe(0);
  });

  it('un peso de diferencia sigue siendo cuadrado', () => {
    expect(balance([{ m: 999999 }], 1000000).cuadrado).toBe(true);
    expect(balance([{ m: 1000000 }], 1000000).cuadrado).toBe(true);
  });

  it('sin ingreso todo lo asignado es exceso', () => {
    expect(balance([{ m: 50000 }], 0).exceso).toBe(50000);
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
  const item = { id: 'i1', m: 1000000 };

  it('el tope baja con la plata que otra meta ya reclamó del bloque', () => {
    const g1 = { a: { i1: 600000 } };
    const g2 = { a: { i1: 0 } };
    expect(freeFor([g1, g2], g2, item)).toBe(400000);
  });

  it('un bloque ya repartido del todo no deja nada libre', () => {
    const g1 = { a: { i1: 1200000 } };
    expect(freeFor([g1], { a: {} }, item)).toBe(0);
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
