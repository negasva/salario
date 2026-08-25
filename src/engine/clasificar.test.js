import { describe, it, expect } from 'vitest';
import { clasificarLocal, clasificarLista, nombreCategoria, CATEGORIAS } from './clasificar.js';

describe('clasificador local', () => {
  it('son diez categorías', () => {
    expect(CATEGORIAS).toHaveLength(10);
  });

  it('la comida de mercado es mercado', () => {
    expect(clasificarLocal('pan, lechuga, salsa de tomate').cat).toBe('mercado');
    expect(clasificarLocal('Mercado en el D1').cat).toBe('mercado');
  });

  it('la comida preparada no es mercado', () => {
    expect(clasificarLocal('Comida en Dogger').cat).toBe('comida-fuera');
    expect(clasificarLocal('almuerzo corrientazo').cat).toBe('comida-fuera');
    expect(clasificarLocal('Frisby con la familia').cat).toBe('comida-fuera');
    expect(clasificarLocal('domicilio de rappi').cat).toBe('comida-fuera');
  });

  it('reconoce servicios, transporte y suscripciones', () => {
    expect(clasificarLocal('Recibo de energía EPM').cat).toBe('servicios');
    expect(clasificarLocal('Gasolina de la moto').cat).toBe('transporte');
    expect(clasificarLocal('Netflix').cat).toBe('suscripciones');
    expect(clasificarLocal('Arriendo de agosto').cat).toBe('vivienda');
  });

  it('sin pistas devuelve otros y confianza cero', () => {
    expect(clasificarLocal('zzz')).toEqual({ cat: 'otros', confianza: 0 });
    expect(clasificarLocal('')).toEqual({ cat: 'otros', confianza: 0 });
  });

  it('una lista de compras vota en conjunto', () => {
    expect(clasificarLista('pan, lechuga, huevos, arroz').cat).toBe('mercado');
  });

  it('nombra la categoría en español', () => {
    expect(nombreCategoria('comida-fuera')).toBe('Comida preparada');
    expect(nombreCategoria('inventada')).toBe('Otros');
  });
});
