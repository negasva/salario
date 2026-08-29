import { describe, it, expect } from 'vitest';
import { ordenadas, reasignar, mover, soltar } from './fila.js';

function metas() {
  return [
    { id: 'fondo', n: 'Fondo de emergencia', special: 'emergencia', orden: 0, estado: 'activa', t: 4000000, s: 0 },
    { id: 'moto', n: 'Moto', orden: 1, estado: 'activa', t: 24000000, s: 0 },
    { id: 'viaje', n: 'Viaje', orden: 2, estado: 'activa', t: 6000000, s: 0 },
  ];
}

describe('F5.1 orden', () => {
  it('el fondo de emergencia siempre va de primero', () => {
    const gs = metas();
    gs[0].orden = 9;
    expect(ordenadas(gs).map((g) => g.id)).toEqual(['fondo', 'moto', 'viaje']);
  });

  it('reasignar renumera de corrido y deja el fondo en 0', () => {
    const gs = reasignar(ordenadas(metas()));
    expect(gs.map((g) => g.orden)).toEqual([0, 1, 2]);
  });

  it('las flechas mueven la meta dentro de la fila', () => {
    const gs = metas();
    expect(mover(gs, 'viaje', -1)).toBe(true);
    expect(ordenadas(gs).map((g) => g.id)).toEqual(['fondo', 'viaje', 'moto']);
  });

  it('no se puede subir mas alla del primer puesto movible', () => {
    const gs = metas();
    expect(mover(gs, 'moto', -1)).toBe(false);
    expect(ordenadas(gs).map((g) => g.id)).toEqual(['fondo', 'moto', 'viaje']);
  });

  it('el fondo no se mueve de su puesto', () => {
    const gs = metas();
    expect(mover(gs, 'fondo', 1)).toBe(false);
    expect(soltar(gs, 'moto', 'fondo')).toBe(false);
    expect(gs.find((g) => g.id === 'fondo').orden).toBe(0);
  });

  it('soltar deja la meta en el puesto de la otra', () => {
    const gs = metas();
    expect(soltar(gs, 'viaje', 'moto')).toBe(true);
    expect(ordenadas(gs).map((g) => g.id)).toEqual(['fondo', 'viaje', 'moto']);
  });
});
