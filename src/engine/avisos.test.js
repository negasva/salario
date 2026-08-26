import { describe, it, expect } from 'vitest';
import {
  DIAS_AVISO, DIAS_CIERRE, diasQueQuedan, diasHasta, fueVisto,
  avisoFinDeMes, avisosDeMetas, avisosPendientes, avisosDeDeudas,
} from './avisos.js';


function perfil(extra = {}) {
  return {
    cur: 'COP',
    items: [
      { id: 'ese', n: 'Esenciales', m: 2750000, r: 'ese', L: [] },
      { id: 'cor', n: 'Corto', m: 750000, r: 'cor', L: [] },
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
  const hoy = new Date(2026, 7, 26); // quedan 5

  // Intl separa con espacios duros, no con el espacio de la tecla
  const plano = (t) => t.replace(/[\u00a0\u202f]/g, ' ');

  it('solo sale a 5, 3 y 1 días', () => {
    [25, 27, 29, 31].forEach((d) => {
      expect(avisoFinDeMes(perfil(), new Date(2026, 7, d))).toBe(null);
    });
    [26, 28, 30].forEach((d) => {
      expect(avisoFinDeMes(perfil(), new Date(2026, 7, d))).not.toBe(null);
    });
  });

  it('a cinco días dice cuánto llevas registrado de cuánto presupuestado', () => {
    const p = perfil({ movs: [{ fecha: '2026-08-03', tipo: 'gasto', monto: 3200000, itemId: 'ese' }] });
    const av = avisoFinDeMes(p, hoy);
    expect(av.titulo).toBe('Quedan 5 días de agosto');
    expect(plano(av.cuerpo)).toContain('$3,2 M registrados');
    expect(plano(av.cuerpo)).toContain('$3,5 M presupuestados'); // 2,75 M + 0,75 M asignados
    expect(av.clave).toBe('cierre-5-2026-08');
    expect(av.vistas).toEqual(['dashboard', 'movimientos']);
  });

  it('a tres días manda a revisar y no repite las cifras', () => {
    const av = avisoFinDeMes(perfil(), new Date(2026, 7, 28));
    expect(av.titulo).toBe('Faltan 3 días para el cierre de agosto');
    expect(av.cuerpo).toBe('Revisa lo que no registraste.');
    expect(av.clave).toBe('cierre-3-2026-08');
  });

  it('a un día es urgente y tiene su propia clave', () => {
    const av = avisoFinDeMes(perfil(), new Date(2026, 7, 30));
    expect(av.titulo).toBe('Mañana cierro agosto');
    expect(av.cuerpo).toBe('Última oportunidad de cuadrar el mes.');
    expect(av.urgente).toBe(true);
    expect(av.clave).toBe('cierre-1-2026-08');
  });

  it('solo cuenta los gastos del mes vivo', () => {
    const p = perfil({ movs: [
      { fecha: '2026-07-30', tipo: 'gasto', monto: 9000000, itemId: 'ese' },
      { fecha: '2026-08-03', tipo: 'gasto', monto: 1000000, itemId: 'ese' },
    ] });
    expect(plano(avisoFinDeMes(p, hoy).cuerpo)).toContain('$1 M registrados');
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
    const p = perfil({ avisosVistos: { 'cierre-5-2026-08': '2026-08-26' } });
    expect(avisosPendientes(p, hoy)).toEqual([]);
    p.avisosVistos = { 'cierre-5-2026-08': '2026-08-25' };
    expect(avisosPendientes(p, hoy).length).toBe(1);
  });

  it('cinco dias es el umbral del aviso de meta', () => {
    expect(DIAS_AVISO).toBe(5);
  });

  it('descartar el de cinco no tapa el de tres', () => {
    const p = perfil({ avisosVistos: { 'cierre-5-2026-08': '2026-08-28' } });
    expect(avisosPendientes(p, new Date(2026, 7, 28)).length).toBe(1);
  });

  it('el cierre avisa a 5, 3 y 1 días', () => {
    expect(DIAS_CIERRE).toEqual([5, 3, 1]);
  });
});

describe('F11 aviso de pago de deuda', () => {
  const conDeuda = (extra = {}) => perfil({ items: [
    { id: 'deu', n: 'Deudas', m: 500000, r: 'deu', L: [
      { id: 'd1', n: 'Tarjeta', saldo: 3000000, minimo: 150000, diaPago: 20, ...extra },
    ] },
  ] });

  it('avisa dos días antes, el día antes y el mismo día', () => {
    [18, 19, 20].forEach((d) => {
      expect(avisosDeDeudas(conDeuda(), new Date(2026, 7, d))).toHaveLength(1);
    });
  });

  it('calla lejos de la fecha y después de pasada', () => {
    expect(avisosDeDeudas(conDeuda(), new Date(2026, 7, 10))).toEqual([]);
    expect(avisosDeDeudas(conDeuda(), new Date(2026, 7, 21))).toEqual([]);
  });

  it('el día del pago es urgente y dice la cuota', () => {
    const [av] = avisosDeDeudas(conDeuda(), new Date(2026, 7, 20));
    expect(av.titulo).toBe('Hoy se paga Tarjeta');
    expect(av.urgente).toBe(true);
    expect(av.clave).toBe('deuda-d1-2026-08');
  });

  it('una deuda con fecha límite dice cuánto le queda', () => {
    const [av] = avisosDeDeudas(conDeuda({ fechaLimite: '2026-12-20' }), new Date(2026, 7, 19));
    expect(av.cuerpo).toContain('2026-12-20');
  });

  it('un renglón sin día de pago o ya pagado no avisa', () => {
    expect(avisosDeDeudas(conDeuda({ diaPago: 0 }), new Date(2026, 7, 20))).toEqual([]);
    expect(avisosDeDeudas(conDeuda({ saldo: 0 }), new Date(2026, 7, 20))).toEqual([]);
  });
});
