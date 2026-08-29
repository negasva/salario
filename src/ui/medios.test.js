import { describe, it, expect } from 'vitest';
import { estiloMedio, etiquetaMedio } from './medios.js';

describe('estiloMedio', () => {
  it('reconoce las marcas por nombre, sin importar mayúsculas', () => {
    expect(estiloMedio('Bancolombia').emoji).toBe('🟡');
    expect(estiloMedio('nequi ahorros').emoji).toBe('🟣');
    expect(estiloMedio('Tarjeta de crédito').emoji).toBe('💳');
  });

  it('un medio inventado por el usuario cae en el ícono por defecto con su inicial', () => {
    expect(estiloMedio('Alcancía')).toMatchObject({ emoji: '🏷️', inicial: 'A' });
    expect(estiloMedio('')).toMatchObject({ inicial: '·' });
  });

  it('la etiqueta del select antepone el emoji al nombre', () => {
    expect(etiquetaMedio('Efectivo')).toBe('💵 Efectivo');
  });
});
