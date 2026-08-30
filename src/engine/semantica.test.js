import { describe, it, expect } from 'vitest';
import { colorDe, colorDeItem, colorCategoria, CATEGORICOS } from './semantica.js';

describe('color con significado', () => {
  it('verde entra, rojo sale, amarillo se guarda', () => {
    expect(colorDe('ingreso')).toBe('var(--sem-ingreso-1)');
    expect(colorDe('gasto')).toBe('var(--sem-gasto-1)');
    expect(colorDe('ahorro')).toBe('var(--sem-ahorro-1)');
  });

  it('una categoría usa siempre el tono que manda, sin escala', () => {
    expect(colorDeItem({ r: 'fij' })).toBe('var(--sem-gasto-1)');
    expect(colorDeItem({ r: 'cor' })).toBe('var(--sem-ahorro-1)');
  });
});

describe('colores del donut', () => {
  it('cada porción sale distinta hasta dar la vuelta', () => {
    const vistos = new Set(Array.from({ length: CATEGORICOS }, (_, i) => colorCategoria(i)));
    expect(vistos.size).toBe(CATEGORICOS);
    expect(colorCategoria(CATEGORICOS)).toBe(colorCategoria(0));
  });

  it('aguanta índices raros sin inventar variables', () => {
    expect(colorCategoria()).toBe('var(--cat-1)');
    expect(colorCategoria(-3)).toBe('var(--cat-4)');
    expect(colorCategoria(1.7)).toBe('var(--cat-2)');
  });
});
