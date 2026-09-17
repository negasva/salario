import { describe, it, expect } from 'vitest';
import { categoriasBase, agregar, borrar, conOtros, OTROS, nombreDe } from './categorias.js';

describe('categorías', () => {
  it('las de fábrica son 11 y terminan en Otros', () => {
    const cats = categoriasBase();
    expect(cats).toHaveLength(11);
    expect(cats[cats.length - 1].id).toBe(OTROS);
    expect(new Set(cats.map((c) => c.id)).size).toBe(11);
  });

  it('agregar mete la nueva antes de Otros y con presupuesto entero', () => {
    const cats = categoriasBase();
    const c = agregar(cats, '  Mascotas ', 120000.4);
    expect(c.n).toBe('Mascotas');
    expect(c.m).toBe(120000);
    expect(cats[cats.length - 2]).toBe(c);
    expect(agregar(cats, '   ')).toBeNull();
  });

  it('borrar mueve los movimientos a Otros en vez de borrarlos', () => {
    const cats = categoriasBase();
    const id = cats[0].id;
    const movs = [{ id: 'm1', catId: id, monto: 10 }, { id: 'm2', catId: 'x', monto: 5 }];
    expect(borrar(cats, movs, id)).toBe(true);
    expect(cats.some((c) => c.id === id)).toBe(false);
    expect(movs).toEqual([{ id: 'm1', catId: OTROS, monto: 10 }, { id: 'm2', catId: 'x', monto: 5 }]);
  });

  it('Otros no se puede borrar y conOtros la repone', () => {
    const cats = categoriasBase();
    expect(borrar(cats, [], OTROS)).toBe(false);
    expect(conOtros([]).map((c) => c.id)).toEqual([OTROS]);
    expect(nombreDe(cats, 'no-existe')).toBe('Otros');
  });
});
