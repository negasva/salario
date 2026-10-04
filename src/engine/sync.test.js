import { describe, it, expect } from 'vitest';
import { fusionar } from './sync.js';

const mov = (id, monto = 1) => ({ id, fecha: '2026-10-01', tipo: 'gasto', monto, catId: 'otros', nota: id });

describe('fusionar dos copias del perfil', () => {
  it('conserva lo de las dos y, con el mismo id, gana lo local', () => {
    const local = { movs: [mov('a', 5), mov('b')], cats: [], recurrentes: [], metas: [], arranques: { '2026-10': 7 } };
    const remoto = { movs: [mov('a', 1), mov('c')], cats: [], recurrentes: [], metas: [], arranques: { '2026-09': 3 }, saldoInicial: 100, name: 'Nube' };
    const f = fusionar(local, remoto);
    expect(f.movs.map((m) => m.id).sort()).toEqual(['a', 'b', 'c']);
    expect(f.movs.find((m) => m.id === 'a').monto).toBe(5);
    expect(f.arranques).toEqual({ '2026-09': 3, '2026-10': 7 });
    expect(f).toMatchObject({ saldoInicial: 100, name: 'Nube' });
  });

  it('une también recurrentes, metas y descartadas sin repetir', () => {
    const f = fusionar(
      { recurrentes: [{ id: 'r1' }], metas: [], ignoradas: ['x'] },
      { recurrentes: [{ id: 'r2' }], metas: [{ id: 'm1' }], ignoradas: ['x', 'y'] },
    );
    expect(f.recurrentes).toHaveLength(2);
    expect(f.metas).toHaveLength(1);
    expect(f.ignoradas).toEqual(['x', 'y']);
  });
});
