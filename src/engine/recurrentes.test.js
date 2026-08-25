import { describe, it, expect } from 'vitest';
import { fechaEnPeriodo, yaEstaEnElMes, pendientes, movDesde } from './recurrentes.js';

const rec = { id: 'r1', tipo: 'gasto', monto: 1800000, itemId: 'ese', lineId: 'l1', nota: 'Arriendo', dia: 5 };

describe('recurrentes', () => {
  it('arma la fecha dentro del periodo', () => {
    expect(fechaEnPeriodo('2026-08', 5)).toBe('2026-08-05');
  });

  it('el día 31 cae al último del mes corto', () => {
    expect(fechaEnPeriodo('2026-02', 31)).toBe('2026-02-28');
    expect(fechaEnPeriodo('2026-04', 31)).toBe('2026-04-30');
  });

  it('sabe si ya se registró este mes', () => {
    const movs = [{ id: 'm1', fecha: '2026-08-05', recId: 'r1' }];
    expect(yaEstaEnElMes(rec, movs, '2026-08')).toBe(true);
    expect(yaEstaEnElMes(rec, movs, '2026-09')).toBe(false);
  });

  it('los pendientes son los que faltan del mes', () => {
    const movs = [{ id: 'm1', fecha: '2026-08-05', recId: 'r1' }];
    expect(pendientes([rec, { ...rec, id: 'r2' }], movs, '2026-08').map((r) => r.id)).toEqual(['r2']);
  });

  it('el movimiento nace con la marca del recurrente', () => {
    const m = movDesde(rec, '2026-09', 'm9');
    expect(m).toMatchObject({ id: 'm9', fecha: '2026-09-05', tipo: 'gasto', monto: 1800000, recId: 'r1' });
  });
});
