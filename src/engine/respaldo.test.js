import { describe, it, expect } from 'vitest';
import { estadoRespaldo, motivoDeRechazo } from './respaldo.js';
import { VERSION } from './migrar.js';

describe('estado del respaldo', () => {
  it('sin copia, avisa solo si hay datos', () => {
    expect(estadoRespaldo(null, true, '2026-10-04')).toEqual({ texto: 'Todavía no has descargado una copia.', avisar: true });
    expect(estadoRespaldo(null, false, '2026-10-04').avisar).toBe(false);
  });

  it('dice hoy, ayer o hace N días, y avisa pasados 30', () => {
    expect(estadoRespaldo('2026-10-04', true, '2026-10-04')).toEqual({ texto: 'Última copia: hoy.', avisar: false });
    expect(estadoRespaldo('2026-10-03', true, '2026-10-04').texto).toBe('Última copia: ayer.');
    expect(estadoRespaldo('2026-09-04', true, '2026-10-04')).toEqual({ texto: 'Última copia: hace 30 días.', avisar: false });
    expect(estadoRespaldo('2026-09-03', true, '2026-10-04').avisar).toBe(true);
  });
});

describe('motivo de rechazo de una copia', () => {
  const mov = { id: 'a', fecha: '2026-10-01', tipo: 'gasto', monto: 100 };
  const copia = (extra = {}) => ({ v: VERSION, cats: [{ id: 'otros', n: 'Otros' }], movs: [mov], ...extra });

  it('acepta una copia sana', () => {
    expect(motivoDeRechazo(copia())).toBeNull();
  });

  it('rechaza lo que no es una copia', () => {
    expect(motivoDeRechazo(null)).toMatch(/no es una copia/);
    expect(motivoDeRechazo([])).toMatch(/no es una copia/);
    expect(motivoDeRechazo({ movs: 3, cats: [] })).toMatch(/no es una copia/);
  });

  it('rechaza movimientos dañados y dice cuál', () => {
    expect(motivoDeRechazo(copia({ movs: [mov, null] }))).toMatch(/movimiento 2 dañado/);
    expect(motivoDeRechazo(copia({ movs: [{ ...mov, monto: NaN }] }))).toMatch(/movimiento 1/);
    expect(motivoDeRechazo(copia({ movs: [{ ...mov, monto: '100' }] }))).toMatch(/movimiento 1/);
    expect(motivoDeRechazo(copia({ movs: [{ ...mov, fecha: 'ayer' }] }))).toMatch(/movimiento 1/);
    expect(motivoDeRechazo(copia({ movs: [{ ...mov, tipo: 'otro' }] }))).toMatch(/movimiento 1/);
  });

  it('rechaza categorías dañadas y copias de una versión más nueva', () => {
    expect(motivoDeRechazo(copia({ cats: [null] }))).toMatch(/categorías/);
    expect(motivoDeRechazo(copia({ v: VERSION + 1 }))).toMatch(/versión más nueva/);
  });
});
