import { describe, it, expect } from 'vitest';
import { estiloMedio, etiquetaMedio } from './medios.js';

describe('estiloMedio', () => {
  it('reconoce las marcas por nombre, sin importar mayúsculas', () => {
    expect(estiloMedio('Bancolombia').emoji).toBe('🟡');
    expect(estiloMedio('nequi ahorros').emoji).toBe('🟣');
    expect(estiloMedio('Tarjeta de crédito').emoji).toBe('💳');
  });

  it('cada medio conocido trae el ícono de su tipo de entidad', () => {
    expect(estiloMedio('Bancolombia').ic).toBe('banco');
    expect(estiloMedio('Nequi').ic).toBe('celular');
    expect(estiloMedio('Efectivo').ic).toBe('billete');
  });

  it('un medio inventado por el usuario cae en el ícono por defecto con su inicial', () => {
    expect(estiloMedio('Mi bolsillo')).toMatchObject({ emoji: '🏷️', ic: 'etiqueta', inicial: 'M' });
    expect(estiloMedio('')).toMatchObject({ inicial: '·' });
  });

  it('la etiqueta del select antepone el emoji al nombre', () => {
    expect(etiquetaMedio('Efectivo')).toBe('💵 Efectivo');
  });
});
