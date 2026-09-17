import { describe, it, expect } from 'vitest';
import {
  categoriasBase, agregar, borrar, normalizarCats, completarConBase, deTipo,
  OTROS, OTROS_ING, nombreDe, esFija, clave,
} from './categorias.js';

describe('las de fábrica', () => {
  const cats = categoriasBase();

  it('traen gastos e ingresos, cada grupo con su Otros al final', () => {
    const gastos = deTipo(cats, 'gasto');
    const ingresos = deTipo(cats, 'ingreso');
    expect(gastos.map((c) => c.n)).toContain('Mercado');
    expect(gastos.map((c) => c.n)).toContain('Transporte');
    expect(gastos.map((c) => c.n)).toContain('Comida fuera');
    expect(ingresos.map((c) => c.n)).toEqual(['Sueldo', 'Extras', 'Ventas', 'Otros ingresos']);
    expect(gastos[gastos.length - 1].id).toBe(OTROS);
    expect(ingresos[ingresos.length - 1].id).toBe(OTROS_ING);
  });

  it('no repite ids', () => {
    expect(new Set(cats.map((c) => c.id)).size).toBe(cats.length);
  });
});

describe('agregar y borrar', () => {
  it('agregar mete la nueva antes del Otros de su tipo', () => {
    const cats = categoriasBase();
    const c = agregar(cats, '  Gimnasio ', 80000.4);
    expect(c).toMatchObject({ n: 'Gimnasio', m: 80000, tipo: 'gasto' });
    const gastos = deTipo(cats, 'gasto');
    expect(gastos[gastos.length - 2].id).toBe(c.id);
    expect(agregar(cats, '   ')).toBeNull();
  });

  it('una categoría de ingreso nueva va al grupo de ingresos', () => {
    const cats = categoriasBase();
    const c = agregar(cats, 'Arriendos', 0, 'ingreso');
    expect(deTipo(cats, 'ingreso').map((x) => x.id)).toContain(c.id);
    expect(deTipo(cats, 'gasto').map((x) => x.id)).not.toContain(c.id);
  });

  it('borrar mueve movimientos y recurrentes a Otros, sin borrar nada', () => {
    const cats = categoriasBase();
    const id = deTipo(cats, 'gasto')[0].id;
    const movs = [{ id: 'm1', catId: id }, { id: 'm2', catId: 'x' }];
    const recs = [{ id: 'r1', catId: id }];
    expect(borrar(cats, movs, id, recs)).toBe(true);
    expect(movs.map((m) => m.catId)).toEqual([OTROS, 'x']);
    expect(recs[0].catId).toBe(OTROS);
  });

  it('una de ingreso borrada manda lo suyo a Otros ingresos', () => {
    const cats = categoriasBase();
    const id = deTipo(cats, 'ingreso')[0].id;
    const movs = [{ id: 'm1', catId: id }];
    expect(borrar(cats, movs, id)).toBe(true);
    expect(movs[0].catId).toBe(OTROS_ING);
  });

  it('las fijas no se borran', () => {
    const cats = categoriasBase();
    expect(borrar(cats, [], OTROS)).toBe(false);
    expect(borrar(cats, [], OTROS_ING)).toBe(false);
    expect(esFija(OTROS) && esFija(OTROS_ING)).toBe(true);
  });
});

describe('normalizar y completar', () => {
  it('normalizar pone tipo, repone las fijas y arregla colores inválidos', () => {
    const cats = normalizarCats([{ id: 'a', n: 'Vieja', m: '5000', c: 'var(--ink)' }]);
    expect(cats[0]).toMatchObject({ tipo: 'gasto', m: 5000 });
    expect(cats[0].c).toMatch(/^#/);
    expect(cats.some((c) => c.id === OTROS) && cats.some((c) => c.id === OTROS_ING)).toBe(true);
    expect(normalizarCats(null).length).toBe(2);
  });

  it('completar añade las de fábrica que falten sin duplicar por acento', () => {
    const cats = completarConBase([{ id: 'a', n: 'mercado', m: 0, c: '#111' },
      { id: 'b', n: 'Educacion', m: 0, c: '#222' }]);
    expect(cats.filter((c) => clave(c.n) === 'mercado')).toHaveLength(1);
    expect(cats.filter((c) => clave(c.n) === 'educacion')).toHaveLength(1);
    expect(cats.some((c) => c.n === 'Transporte')).toBe(true);
  });

  it('nombreDe cae en el Otros que corresponde', () => {
    expect(nombreDe([], 'no-existe')).toBe('Otros');
    expect(nombreDe([], OTROS_ING)).toBe('Otros ingresos');
  });
});
