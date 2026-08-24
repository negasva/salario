import { describe, it, expect } from 'vitest';
import {
  DIAS_AVISO, diasQueQuedan, diasHasta, fueVisto,
  avisoFinDeMes, avisosDeMetas, avisosPendientes,
} from './avisos.js';

const INC = 5000000;

function perfil(extra = {}) {
  return {
    cur: 'COP',
    items: [
      { id: 'ese', n: 'Esenciales', p: 55, r: 'ese', L: [] },
      { id: 'cor', n: 'Corto', p: 15, r: 'cor', L: [] },
    ],
    goals: [],
    movs: [],
    avisosVistos: {},
    ...extra,
  };
}

describe('F6 cuentas de días', () => {
  it('cuenta lo que falta para fin de mes', () => {
    expect(diasQueQuedan(new Date(2026, 7, 26))).toBe(5); // agosto tiene 31
    expect(diasQueQuedan(new Date(2026, 7, 31))).toBe(0);
    expect(diasQueQuedan(new Date(2026, 1, 24))).toBe(4); // febrero de 2026, 28 días
  });

  it('cuenta lo que falta para una fecha', () => {
    expect(diasHasta('2026-08-31', new Date(2026, 7, 26))).toBe(5);
    expect(diasHasta('2026-08-26', new Date(2026, 7, 26))).toBe(0);
    expect(diasHasta('2026-08-20', new Date(2026, 7, 26))).toBe(-6);
    expect(diasHasta('', new Date(2026, 7, 26))).toBe(null);
  });
});

describe('F6.1 aviso de fin de mes', () => {
  const hoy = new Date(2026, 7, 26);

  it('no sale antes de los cinco días', () => {
    expect(avisoFinDeMes(perfil(), INC, new Date(2026, 7, 25))).toBe(null);
  });

  // Intl separa con espacios duros, no con el espacio de la tecla
  const plano = (t) => t.replace(/[\u00a0\u202f]/g, ' ');

  it('dice cuánto llevas registrado de cuánto presupuestado', () => {
    const p = perfil({ movs: [{ fecha: '2026-08-03', tipo: 'gasto', monto: 3200000, itemId: 'ese' }] });
    const av = avisoFinDeMes(p, INC, hoy);
    expect(av.titulo).toBe('Quedan 5 días de agosto');
    expect(plano(av.cuerpo)).toContain('$3,2 M registrados');
    expect(plano(av.cuerpo)).toContain('$3,5 M presupuestados'); // 70% de 5.000.000
    expect(av.clave).toBe('cierre-2026-08');
    expect(av.vistas).toEqual(['dashboard', 'movimientos']);
  });

  it('el último día no dice "quedan 0 días" y es urgente', () => {
    const av = avisoFinDeMes(perfil(), INC, new Date(2026, 7, 31));
    expect(av.titulo).toBe('Hoy es el último día de agosto');
    expect(av.urgente).toBe(true);
  });

  it('solo cuenta los gastos del mes vivo', () => {
    const p = perfil({ movs: [
      { fecha: '2026-07-30', tipo: 'gasto', monto: 9000000, itemId: 'ese' },
      { fecha: '2026-08-03', tipo: 'gasto', monto: 1000000, itemId: 'ese' },
    ] });
    expect(plano(avisoFinDeMes(p, INC, hoy).cuerpo)).toContain('$1 M registrados');
  });
});

describe('F6.1 aviso de meta con fecha', () => {
  const hoy = new Date(2026, 7, 26);
  const moto = { id: 'g1', n: 'Moto', t: 24000000, s: 18720000, dueDate: '2026-08-31', estado: 'activa' };

  it('avisa con el porcentaje que llevas', () => {
    const [av] = avisosDeMetas(perfil({ goals: [moto] }), hoy);
    expect(av.titulo).toBe('Faltan 5 días para tu fecha de Moto y llevas el 78%');
    expect(av.vistas).toEqual(['dashboard', 'metas']);
    expect(av.accion.goalId).toBe('g1');
  });

  it('no avisa si la fecha esta lejos o ya paso', () => {
    expect(avisosDeMetas(perfil({ goals: [moto] }), new Date(2026, 7, 20))).toEqual([]);
    expect(avisosDeMetas(perfil({ goals: [moto] }), new Date(2026, 8, 2))).toEqual([]);
  });

  it('una meta sin fecha o en fila no avisa', () => {
    expect(avisosDeMetas(perfil({ goals: [{ ...moto, dueDate: null }] }), hoy)).toEqual([]);
    expect(avisosDeMetas(perfil({ goals: [{ ...moto, estado: 'en_fila' }] }), hoy)).toEqual([]);
  });

  it('si ya la alcanzaste lo dice y no es urgente', () => {
    const [av] = avisosDeMetas(perfil({ goals: [{ ...moto, s: 24000000 }] }), new Date(2026, 7, 30));
    expect(av.titulo).toContain('llevas el 100%');
    expect(av.cuerpo).toContain('Ya la alcanzaste');
    expect(av.urgente).toBe(false);
  });
});

describe('F6.2 descartar no repite el mismo día', () => {
  const hoy = new Date(2026, 7, 26);

  it('fueVisto compara contra la fecha de hoy', () => {
    expect(fueVisto({ x: '2026-08-26' }, 'x', hoy)).toBe(true);
    expect(fueVisto({ x: '2026-08-25' }, 'x', hoy)).toBe(false);
    expect(fueVisto(null, 'x', hoy)).toBe(false);
  });

  it('el aviso descartado hoy no vuelve a salir hoy', () => {
    const p = perfil({ avisosVistos: { 'cierre-2026-08': '2026-08-26' } });
    expect(avisosPendientes(p, INC, hoy)).toEqual([]);
    p.avisosVistos = { 'cierre-2026-08': '2026-08-25' };
    expect(avisosPendientes(p, INC, hoy).length).toBe(1);
  });

  it('cinco dias es el umbral de los dos avisos', () => {
    expect(DIAS_AVISO).toBe(5);
  });
});
