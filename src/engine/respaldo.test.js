import { describe, it, expect } from 'vitest';
import { estadoRespaldo } from './respaldo.js';

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
