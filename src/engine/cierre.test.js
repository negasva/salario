import { describe, it, expect } from 'vitest';
import { periodoAnterior, periodosPendientes, construirSnapshot, brechaDelMes, aportadoEnCierre } from './cierre.js';

const perfil = () => ({
  inc: 1000000,
  cur: 'COP',
  items: [
    { id: 'i1', n: 'Esenciales', r: 'ese', p: 50, L: [{ id: 'l1', n: 'Arriendo' }, { id: 'l2', n: 'Mercado' }] },
    { id: 'i2', n: 'Gasto libre', r: 'lib', p: 10, L: [] },
    { id: 'i3', n: 'Ahorro corto', r: 'cor', p: 25, L: [] },
    { id: 'i4', n: 'Inversión', r: 'lar', p: 15, L: [] },
  ],
  goals: [{ id: 'g1', n: 'Moto', s: 900000 }],
  movs: [
    { fecha: '2026-08-05', tipo: 'gasto', monto: 400000, itemId: 'i1', lineId: 'l1' },
    { fecha: '2026-08-09', tipo: 'gasto', monto: 150000, itemId: 'i1', lineId: 'l2' },
    { fecha: '2026-08-11', tipo: 'gasto', monto: 250000, itemId: 'i2' },
    { fecha: '2026-08-20', tipo: 'gasto', monto: 200000, itemId: 'i3', goalId: 'g1' },
    { fecha: '2026-08-01', tipo: 'ingreso', monto: 1000000 },
    { fecha: '2026-08-18', tipo: 'ingreso', monto: 300000, extra: true },
    { fecha: '2026-07-04', tipo: 'gasto', monto: 999999, itemId: 'i1' },
  ],
});

describe('periodos', () => {
  it('el anterior cruza el año', () => {
    expect(periodoAnterior('2026-01')).toBe('2025-12');
    expect(periodoAnterior('2026-09')).toBe('2026-08');
  });

  const vividos = ['2026-06', '2026-07', '2026-08'].map((per) => ({ fecha: `${per}-15` }));

  it('sin cierres pendientes devuelve vacío', () => {
    expect(periodosPendientes(['2026-08'], vividos, new Date(2026, 8, 3))).toEqual([]);
  });

  it('tres meses sin abrir la app se cierran en orden', () => {
    expect(periodosPendientes(['2026-05'], vividos, new Date(2026, 8, 3)))
      .toEqual(['2026-06', '2026-07', '2026-08']);
  });

  it('un mes sin movimientos no se cierra: cuenta nueva, historial en blanco', () => {
    expect(periodosPendientes([], [], new Date(2026, 8, 3))).toEqual([]);
    expect(periodosPendientes([], [{ fecha: '2026-07-02' }], new Date(2026, 8, 3))).toEqual(['2026-07']);
  });
});

describe('snapshot version 2', () => {
  const snap = construirSnapshot(perfil(), '2026-08', 1000000);

  it('separa plan de real por bloque, sin arrastrar julio', () => {
    expect(snap.items).toEqual([
      { itemId: 'i1', nombre: 'Esenciales', pct: 50, plan: 500000, real: 550000 },
      { itemId: 'i2', nombre: 'Gasto libre', pct: 10, plan: 100000, real: 250000 },
      { itemId: 'i3', nombre: 'Ahorro corto', pct: 25, plan: 250000, real: 200000 },
      { itemId: 'i4', nombre: 'Inversión', pct: 15, plan: 150000, real: 0 },
    ]);
  });

  it('guarda los renglones con su plan y si son fijos', () => {
    expect(snap.lineas).toEqual({
      l1: { nombre: 'Arriendo', itemId: 'i1', plan: 0, fixed: true, real: 400000 },
      l2: { nombre: 'Mercado', itemId: 'i1', plan: 0, fixed: true, real: 150000 },
    });
  });

  it('separa ingreso real de extra', () => {
    expect(snap.ingresoReal).toBe(1300000);
    expect(snap.ingresoExtra).toBe(300000);
    expect(snap.ingresoPlan).toBe(1000000);
  });

  it('registra lo aportado a cada meta ese mes', () => {
    expect(snap.metas).toEqual([{ goalId: 'g1', nombre: 'Moto', aportado: 200000, acumulado: 900000 }]);
  });

  it('conserva los dos campos que lee el historial viejo', () => {
    expect(snap.essentialsShare).toBe(50);
    expect(snap.ahorroRate).toBe(40);
  });

  it('nace en borrador y respeta lo que ya venía editado', () => {
    expect(snap.borrador).toBe(true);
    expect(construirSnapshot(perfil(), '2026-08', 1000000, { borrador: false, nota: 'ojo' }))
      .toMatchObject({ borrador: false, nota: 'ojo' });
  });
});

describe('la brecha del mes', () => {
  it('suma plan y real y señala al bloque que más se pasó', () => {
    const b = brechaDelMes(construirSnapshot(perfil(), '2026-08', 1000000));
    expect(b).toEqual({ plan: 1000000, real: 1000000, diferencia: 0, culpable: { nombre: 'Gasto libre', exceso: 150000 } });
  });

  it('un snapshot viejo no revienta, devuelve null', () => {
    expect(brechaDelMes({ essentialsShare: 55, ahorroRate: 30 })).toBe(null);
    expect(aportadoEnCierre({ essentialsShare: 55 })).toBe(0);
  });

  it('suma lo aportado a metas', () => {
    expect(aportadoEnCierre(construirSnapshot(perfil(), '2026-08', 1000000))).toBe(200000);
  });
});
