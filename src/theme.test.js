import { describe, it, expect } from 'vitest';
import { DEFAULT_PALETA, PALETAS, normalizarPaleta } from './theme.js';

describe('paletas', () => {
  it('conserva la paleta actual y agrega las tres nuevas', () => {
    expect(Object.keys(PALETAS)).toEqual(['chicle', 'coral', 'pizarra', 'vivo']);
    expect(PALETAS[DEFAULT_PALETA].label).toBe('Rosa chicle');
  });

  it('cae en la paleta actual si el perfil trae un valor desconocido', () => {
    expect(normalizarPaleta('no-existe')).toBe(DEFAULT_PALETA);
    expect(normalizarPaleta(undefined)).toBe(DEFAULT_PALETA);
  });

  it('cada paleta tiene colores visibles para el selector', () => {
    Object.values(PALETAS).forEach((paleta) => {
      expect(paleta.background).toMatch(/^#[0-9A-F]{6}$/i);
      expect(paleta.swatches.length).toBeGreaterThanOrEqual(3);
    });
  });
});
