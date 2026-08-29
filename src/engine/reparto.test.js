import { describe, it, expect } from 'vitest';
import {
  amount, total, shareOf, balance, spentInItem, fixedVariableSplit,
  totalMetas, diagnosticoEsenciales,
} from './reparto.js';

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

describe('las metas cuentan en el reparto', () => {
  it('suma lo que cada meta guarda al mes', () => {
    expect(totalMetas([{ mes: 300000 }, { mes: 200000 }])).toBe(500000);
  });

  it('una meta completa ya no consume nada', () => {
    expect(totalMetas([{ mes: 300000, estado: 'completa' }, { mes: 200000 }])).toBe(200000);
  });

  it('el balance cuenta categorías y metas juntas', () => {
    const b = balance([{ m: 3000000 }], 5000000, [{ mes: 500000 }]);
    expect(b.asignado).toBe(3500000);
    expect(b.falta).toBe(1500000);
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
