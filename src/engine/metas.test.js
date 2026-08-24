import { describe, it, expect } from 'vitest';
import {
  emergencyTarget,
  emergencyStatus,
  escalonActual,
  cuotaPorFecha,
  planRecorte,
  valorFuturo,
  conflictosDeMetas,
  aplicarAporte,
  plazo,
} from './metas.js';
import { recomendar } from './consejo.js';

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
});

describe('F6 plan de recorte', () => {
  it('nunca toca renglones fijos ni bloques que no existen', () => {
    const items = [
      { r: 'lib', p: 10 },
      { r: 'ese', p: 50, L: [{ v: 100000, fixed: false }] },
      { r: 'lar', p: 15 },
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

describe('F9 metas en competencia', () => {
  it('detecta cuando dos metas reclaman el mismo bloque', () => {
    const g1 = { id: 'g1', a: { i1: 50 } };
    const g2 = { id: 'g2', a: { i1: 30 } };
    const conf = conflictosDeMetas([g1, g2]);
    expect(conf).toHaveLength(1);
    expect(conf[0].itemId).toBe('i1');
  });
});

describe('F10 aportes extra', () => {
  it('suma al ahorrado y guarda historial', () => {
    const g = { s: 100 };
    aplicarAporte(g, 50, new Date(2026, 0, 1));
    expect(g.s).toBe(150);
    expect(g.aportes).toHaveLength(1);
  });
});

describe('F2 recomendado de ahorro', () => {
  it('todo a corto plazo si el fondo esta critico', () => {
    const r = recomendar({ fondoEstado: 'critico', essentialsShare: 40 });
    expect(r.corto).toBe(100);
    expect(r.motivo).toMatch(/colchón/);
  });
  it('baja el ahorro sugerido si esenciales pasan 65%', () => {
    const r = recomendar({ fondoEstado: 'completo', essentialsShare: 70 });
    expect(r.corto).toBe(15);
    expect(r.motivo).toMatch(/esenciales/);
  });
});
