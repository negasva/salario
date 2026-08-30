import { describe, it, expect } from 'vitest';
import { clasificarLocal, clasificarLista, nombreCategoria, CATEGORIAS,
  GRUPOS, MIGRACION_CAT, grupoDe, nombreGrupo, CATEGORIA_A_ROL } from './clasificar.js';

describe('clasificador local', () => {
  it('son dieciséis categorías en seis grupos', () => {
    expect(CATEGORIAS).toHaveLength(16);
    expect(GRUPOS).toHaveLength(6);
  });

  it('la comida de mercado es mercado', () => {
    expect(clasificarLocal('pan, lechuga, salsa de tomate').cat).toBe('mercado');
    expect(clasificarLocal('Mercado en el D1').cat).toBe('mercado');
  });

  it('la comida preparada no es mercado', () => {
    expect(clasificarLocal('Comida en Dogger').cat).toBe('restaurantes');
    expect(clasificarLocal('almuerzo corrientazo').cat).toBe('restaurantes');
    expect(clasificarLocal('Frisby con la familia').cat).toBe('restaurantes');
    expect(clasificarLocal('domicilio de rappi').cat).toBe('restaurantes');
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
    expect(nombreCategoria('restaurantes')).toBe('Restaurantes');
    expect(nombreCategoria('inventada')).toBe('Otros');
  });
});

describe('taxonomía de dos niveles', () => {
  it('cada categoría cae en un grupo conocido, salvo otros', () => {
    CATEGORIAS.forEach((c) => {
      if (c.id === 'otros') return expect(c.grupo).toBe('');
      expect(GRUPOS.some((g) => g.id === c.grupo)).toBe(true);
    });
  });

  it('deriva el grupo de la subcategoría', () => {
    expect(grupoDe('restaurantes')).toBe('alimentacion');
    expect(grupoDe('vehiculo')).toBe('transporte');
    expect(nombreGrupo('bienestar')).toBe('Bienestar');
    expect(grupoDe('inventada')).toBe('');
    expect(nombreGrupo('inventado')).toBe('');
  });

  it('cada categoría tiene rol de reparto', () => {
    CATEGORIAS.forEach((c) => expect(CATEGORIA_A_ROL[c.id]).toBeTruthy());
  });
});

describe('migración de las diez viejas', () => {
  const VIEJAS = ['mercado', 'comida-fuera', 'vivienda', 'servicios', 'transporte',
    'salud', 'ocio', 'suscripciones', 'educacion', 'otros'];

  it('toda categoría vieja llega a una nueva válida', () => {
    VIEJAS.forEach((vieja) => {
      const nueva = MIGRACION_CAT[vieja];
      expect(nueva, vieja).toBeTruthy();
      expect(CATEGORIAS.some((c) => c.id === nueva), nueva).toBe(true);
    });
  });

  it('las renombradas apuntan a su id nuevo', () => {
    expect(MIGRACION_CAT['comida-fuera']).toBe('restaurantes');
    expect(MIGRACION_CAT.ocio).toBe('salidas');
    expect(MIGRACION_CAT.mercado).toBe('mercado');
  });

  it('ningún movimiento queda con cat inválido', () => {
    const movs = VIEJAS.map((cat, i) => ({ id: 'm' + i, cat }));
    movs.push({ id: 'mx', cat: 'basura-inventada' }, { id: 'my' });
    movs.forEach((m) => { if (m.cat) m.cat = MIGRACION_CAT[m.cat] || 'otros'; });
    movs.forEach((m) => {
      if (!m.cat) return;
      expect(CATEGORIAS.some((c) => c.id === m.cat), m.id).toBe(true);
    });
    expect(movs.find((m) => m.id === 'mx').cat).toBe('otros');
  });
});
