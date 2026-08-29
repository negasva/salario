import { describe, it, expect } from 'vitest';
import {
  emergencyTarget, emergencyStatus, escalonActual, plazo,
  cuotaPorFecha, cuotaPorMeses, monthlyToward, monthsToGoal,
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

describe('F5 lo que la meta guarda al mes', () => {
  it('es la cifra que escribió el usuario', () => {
    expect(monthlyToward({ mes: 500000 })).toBe(500000);
    expect(monthlyToward({})).toBe(0);
    expect(monthlyToward({ mes: -10 })).toBe(0);
  });

  it('los meses salen de lo que falta entre lo que guardas', () => {
    expect(monthsToGoal({ t: 1000000, s: 250000, mes: 250000 })).toBe(3);
    expect(monthsToGoal({ t: 1000000, s: 0, mes: 300000 })).toBe(4);
  });

  it('sin aporte mensual no hay plazo', () => {
    expect(monthsToGoal({ t: 1000000, s: 0, mes: 0 })).toBe(null);
  });

  it('una meta ya cumplida está a cero meses', () => {
    expect(monthsToGoal({ t: 1000000, s: 1000000, mes: 100000 })).toBe(0);
  });
});
