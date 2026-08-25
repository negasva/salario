import { describe, it, expect } from 'vitest';
import { buscar, totalDeMovimientos } from './buscar.js';

const p = {
  items: [{ id: 'ese', n: 'Esenciales', p: 55, L: [{ id: 'l1', n: 'Mercado' }] }],
  goals: [{ id: 'g1', n: 'Moto' }],
  movs: [
    { id: 'm1', fecha: '2026-08-02', tipo: 'gasto', monto: 40000, itemId: 'ese', nota: 'Rappi del domingo', cat: 'comida-fuera' },
    { id: 'm2', fecha: '2026-07-11', tipo: 'gasto', monto: 60000, itemId: 'ese', nota: 'rappi otra vez' },
    { id: 'm3', fecha: '2026-07-12', tipo: 'gasto', monto: 90000, itemId: 'ese', nota: 'Peluquería' },
  ],
};

describe('buscador', () => {
  it('encuentra movimientos por nota, sin importar tildes ni mayúsculas', () => {
    const r = buscar(p, 'RAPPI');
    expect(r.filter((x) => x.tipo === 'movimiento').map((x) => x.id)).toEqual(['m1', 'm2']);
  });

  it('encuentra metas, bloques y renglones', () => {
    expect(buscar(p, 'moto')[0]).toMatchObject({ tipo: 'meta', ruta: 'metas' });
    expect(buscar(p, 'esencial')[0]).toMatchObject({ tipo: 'categoria' });
    expect(buscar(p, 'mercado')[0]).toMatchObject({ tipo: 'renglon', ruta: 'movimientos' });
  });

  it('busca también por categoría de gasto', () => {
    expect(buscar(p, 'comida preparada').map((x) => x.id)).toContain('m1');
  });

  it('con menos de dos letras no busca', () => {
    expect(buscar(p, 'r')).toEqual([]);
  });

  it('suma lo encontrado', () => {
    expect(totalDeMovimientos(buscar(p, 'rappi'))).toBe(100000);
  });
});
