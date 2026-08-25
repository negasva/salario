import { describe, it, expect } from 'vitest';
import {
  emergencyTarget,
  emergencyStatus,
  escalonActual,
  cuotaPorFecha,
  cuotaPorMeses,
  planRecorte,
  valorFuturo,
  conflictosDeMetas,
  aplicarRecorte,
  plazo,
  secuenciaPlazos,
  metasEnItem,
} from './metas.js';

describe('F3 fondo de emergencia', () => {
  it('objetivo = fijos + 50% variables, por N meses', () => {
    const essentials = [{ L: [{ v: 400000, fixed: true }, { v: 100000, fixed: false }] }];
    const { oneMonth, target } = emergencyTarget(essentials, 4);
    expect(oneMonth).toBe(450000);
    expect(target).toBe(1800000);
  });

  it('estado critico bajo 1 mes', () => {
    expect(emergencyStatus(100000, 450000, 1800000)).toBe('critico');
  });
  it('estado parcial entre 1 mes y objetivo', () => {
    expect(emergencyStatus(500000, 450000, 1800000)).toBe('parcial');
  });
  it('estado completo', () => {
    expect(emergencyStatus(1800000, 450000, 1800000)).toBe('completo');
  });
});

describe('F4 escalera', () => {
  it('escalon 1 si no cubre minimos de deuda', () => {
    expect(escalonActual({ minimosDeudaCubiertos: false })).toBe(1);
  });
  it('escalon 4 si el fondo esta completo pero no hay metas', () => {
    expect(escalonActual({ minimosDeudaCubiertos: true, fondoEstado: 'completo', tieneMetasActivas: false })).toBe(4);
  });
});

describe('plazo en singular y plural', () => {
  it('un mes va en singular', () => {
    expect(plazo(1)).toBe('1 mes');
  });
  it('el resto en plural', () => {
    expect(plazo(4)).toBe('4 meses');
  });
});

describe('F5 meta por fecha', () => {
  it('calcula cuota mensual necesaria', () => {
    const r = cuotaPorFecha(1200000, 0, new Date(2027, 0, 1), new Date(2026, 8, 1));
    expect(r.meses).toBe(4);
    expect(r.cuota).toBe(300000);
  });
  it('una fecha ya pasada deja el faltante completo', () => {
    const r = cuotaPorFecha(1200000, 200000, new Date(2026, 0, 1), new Date(2026, 8, 1));
    expect(r.meses).toBe(0);
    expect(r.cuota).toBe(1000000);
  });
});

describe('F5 meta por plazo en meses', () => {
  it('reparte el faltante, no el costo total', () => {
    const r = cuotaPorMeses(1200000, 400000, 8);
    expect(r.meses).toBe(8);
    expect(r.cuota).toBe(100000);
  });
  it('si ya esta cubierta la cuota es cero', () => {
    expect(cuotaPorMeses(500000, 500000, 6).cuota).toBe(0);
  });
  it('cero o negativo no divide por cero', () => {
    expect(cuotaPorMeses(600000, 0, 0)).toEqual({ meses: 0, cuota: 600000 });
    expect(cuotaPorMeses(600000, 0, -3)).toEqual({ meses: 0, cuota: 600000 });
  });
  it('redondea a dos decimales', () => {
    expect(cuotaPorMeses(1000, 0, 3).cuota).toBe(333.33);
  });
});

describe('F6 plan de recorte', () => {
  it('nunca toca renglones fijos ni bloques que no existen', () => {
    const items = [
      { r: 'lib', m: 100000 },
      { r: 'ese', m: 500000, L: [{ v: 100000, fixed: false }] },
      { r: 'lar', m: 150000 },
    ];
    const recortes = planRecorte(50000, { items, income: 1000000, fondoCompleto: false });
    expect(recortes.find((r) => r.id === 'r-corto')).toBeUndefined();
    expect(recortes.find((r) => r.id.startsWith('r-var'))).toBeTruthy();
  });
});

describe('F8 costo de oportunidad', () => {
  it('valor futuro compuesto anual', () => {
    expect(valorFuturo(1000, 10, 1)).toBe(1100);
  });
});

describe('F2.2 metas que reclaman un bloque', () => {
  const item = { id: 'i1', m: 1000000 };   // un millón asignado al mes

  it('devuelve una fila por meta, con su monto mensual', () => {
    const moto = { id: 'g1', n: 'Moto', a: { i1: 88 } };
    const fondo = { id: 'g2', n: 'Fondo', special: 'emergencia', a: { i1: 12 } };
    expect(metasEnItem([moto, fondo], item)).toEqual([
      { goal: moto, pct: 88, monto: 880000 },
      { goal: fondo, pct: 12, monto: 120000 },
    ]);
  });

  it('un bloque sin metas devuelve vacío', () => {
    expect(metasEnItem([{ id: 'g1', a: { otro: 50 } }], item)).toEqual([]);
  });

  it('un pct de 0 no aparece', () => {
    expect(metasEnItem([{ id: 'g1', a: { i1: 0 } }, { id: 'g2', a: {} }], item)).toEqual([]);
  });
});

describe('F9 metas en competencia', () => {
  it('detecta cuando dos metas reclaman el mismo bloque', () => {
    const g1 = { id: 'g1', a: { i1: 50 } };
    const g2 = { id: 'g2', a: { i1: 30 } };
    const conf = conflictosDeMetas([g1, g2]);
    expect(conf).toHaveLength(1);
    expect(conf[0].itemId).toBe('i1');
  });
});

describe('F9 orden por prioridad', () => {
  const items = [{ id: 'i1', m: 1000000 }];
  const mk = (id, priority) => ({ id, priority, t: 100000, s: 0, a: { i1: 100 } });

  it('ordena alta, media, baja sin importar el orden de entrada', () => {
    const baja = { ...mk('baja', 'baja'), t: 300000 };
    const media = { ...mk('media', 'media'), t: 200000 };
    const alta = { ...mk('alta', 'alta'), t: 100000 };
    // el bloque i1 aporta 1.000.000 al mes: 1 mes por cada millon
    const a = secuenciaPlazos([baja, media, alta], items);
    const b = secuenciaPlazos([alta, baja, media], items);
    expect(a.paralelo).toEqual([1, 1, 1]);
    expect(a.secuencia).toEqual([1, 2, 3]);
    expect(b).toEqual(a);
  });

  it('el fondo de emergencia no cuenta como competencia', () => {
    const fondo = { id: 'f', special: 'emergencia', a: { i1: 60 } };
    const moto = { id: 'm', a: { i1: 40 } };
    expect(conflictosDeMetas([fondo, moto])).toHaveLength(0);
  });
});

describe('F7.2 aplicar un recorte', () => {
  const base = () => [
    { id: 'lib', r: 'lib', m: 500000 },
    { id: 'cor', r: 'cor', m: 750000 },
    { id: 'lar', r: 'lar', m: 750000 },
  ];

  it('pasa la plata del bloque de origen al de la meta', () => {
    const items = base();
    const ok = aplicarRecorte({ id: 'r-libre', monto: 400000 }, items, { a: { cor: 90 } });
    expect(ok).toBe(true);
    expect(items[0].m).toBe(100000);
    expect(items[1].m).toBe(1150000);
  });

  it('no baja un bloque por debajo de cero', () => {
    const items = base();
    aplicarRecorte({ id: 'r-inv', monto: 99000000 }, items, { a: { cor: 100 } });
    expect(items[2].m).toBe(0);
    expect(items[1].m).toBe(1500000); // solo se mueve lo que de verdad había
  });

  it('no hace nada si el origen es el destino', () => {
    const items = base();
    expect(aplicarRecorte({ id: 'r-corto', monto: 100000 }, items, { a: { cor: 100 } })).toBe(false);
  });
});
