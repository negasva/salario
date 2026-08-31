import { describe, it, expect } from 'vitest';
import { clasificarLocal, clasificarLista, nombreCategoria, CATEGORIAS,
  GRUPOS, MIGRACION_CAT, grupoDe, nombreGrupo, CATEGORIA_A_ROL, normalizarCat,
  esCategoria, iconoCategoria, textoDeMovimiento, sinClasificar,
  clasificarViejos } from './clasificar.js';

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

describe('precisión: una pista calza por palabra, no por pedazo', () => {
  it('no confunde "salida" con la sal del mercado', () => {
    expect(clasificarLocal('Salida Cadavid').cat).toBe('salidas');
  });

  it('no saca pistas de adentro de otra palabra', () => {
    // 'parqueadero' traía 'ara' y 'pan' adentro; 'tostada' no es Tostao
    expect(clasificarLocal('Parqueadero Tesoro').cat).toBe('transporte');
    expect(clasificarLocal('Pago Plan Celular').cat).toBe('servicios');
  });

  it('la frase gana a la palabra suelta', () => {
    expect(clasificarLocal('Pago Seguro Moto Xpulse 200').cat).toBe('vehiculo');
    expect(clasificarLocal('Seguro de vida').cat).toBe('finanzas');
    expect(clasificarLocal('compra en mercado libre').cat).toBe('compras');
    expect(clasificarLocal('papa john').cat).toBe('restaurantes');
    expect(clasificarLocal('amazon prime').cat).toBe('suscripciones');
  });

  it('un prefijo con * cubre las variantes', () => {
    expect(clasificarLocal('drogueria la rebaja').cat).toBe('salud');
    expect(clasificarLocal('cita de odontologia').cat).toBe('salud');
    expect(clasificarLocal('veterinario del gato').cat).toBe('mascotas');
  });

  it('las seis categorías nuevas también se reconocen', () => {
    expect(clasificarLocal('SOAT de la moto').cat).toBe('vehiculo');
    expect(clasificarLocal('corte de pelo').cat).toBe('cuidado');
    expect(clasificarLocal('concentrado para el perro').cat).toBe('mascotas');
    expect(clasificarLocal('hotel en Santa Marta').cat).toBe('viajes');
    expect(clasificarLocal('tenis nuevos').cat).toBe('compras');
    expect(clasificarLocal('cuota tarjeta').cat).toBe('finanzas');
  });

  it('gasolina sigue siendo transporte aunque diga moto', () => {
    expect(clasificarLocal('Gasolina de la moto').cat).toBe('transporte');
  });

  it('una lista sin votos cae al texto completo', () => {
    // partido por comas ninguna parte dice nada, pero el texto entero sí
    expect(clasificarLista('salsa, de, tomate').cat).toBe('mercado');
  });
});

describe('categorías que llegan de afuera', () => {
  it('deja pasar las válidas y traduce las viejas', () => {
    expect(normalizarCat('restaurantes')).toBe('restaurantes');
    expect(normalizarCat('COMIDA-FUERA')).toBe('restaurantes');
    expect(normalizarCat(' ocio ')).toBe('salidas');
  });

  it('descarta lo inventado en vez de guardarlo', () => {
    expect(normalizarCat('gastos varios')).toBe(null);
    expect(normalizarCat('')).toBe(null);
    expect(normalizarCat(undefined)).toBe(null);
  });

  it('sabe qué es categoría y con qué ícono se pinta', () => {
    expect(esCategoria('viajes')).toBe(true);
    expect(esCategoria('inventada')).toBe(false);
    expect(iconoCategoria('mercado')).toBe('mercado');
    expect(iconoCategoria('inventada')).toBe('etiqueta');
  });
});

describe('lo que ya estaba registrado', () => {
  const items = [{ id: 'i1', n: 'Gastos recurrentes', L: [{ id: 'l1', n: 'Gasolina' }] }];

  it('el renglón clasifica cuando la nota no dice nada', () => {
    const mov = { id: 'm1', tipo: 'gasto', itemId: 'i1', lineId: 'l1', nota: '' };
    expect(textoDeMovimiento(mov, items)).toBe('Gasolina');
    expect(clasificarLista(textoDeMovimiento(mov, items)).cat).toBe('transporte');
  });

  it('el nombre del bloque solo entra si no hay nota ni renglón', () => {
    expect(textoDeMovimiento({ itemId: 'i1' }, items)).toBe('Gastos recurrentes');
    expect(textoDeMovimiento({ itemId: 'i1', nota: 'Uber' }, items)).toBe('Uber');
  });

  it('la pasada local le pone categoría a todo gasto sin ella', () => {
    const movs = [
      { id: 'm1', tipo: 'gasto', nota: 'Netflix' },
      { id: 'm2', tipo: 'gasto', nota: 'algo rarísimo' },
      { id: 'm3', tipo: 'ingreso', nota: 'Nómina' },
      { id: 'm4', tipo: 'gasto', nota: 'Uber', cat: 'salud' },
      { id: 'm5', tipo: 'gasto', nota: 'Rappi', catManual: true },
    ];
    expect(clasificarViejos(movs, items)).toBe(2);
    expect(movs[0].cat).toBe('suscripciones');
    expect(movs[1].cat).toBe('otros');
    expect(movs[2].cat).toBeUndefined();
    // ni una categoría ya puesta ni una elegida a mano se tocan
    expect(movs[3].cat).toBe('salud');
    expect(movs[4].cat).toBeUndefined();
    // corre dos veces sin volver a tocar nada
    expect(clasificarViejos(movs, items)).toBe(0);
  });

  it('a la fila de la IA solo van los gastos que quedaron en otros', () => {
    const movs = [
      { id: 'm1', tipo: 'gasto', cat: 'otros' },
      { id: 'm2', tipo: 'gasto' },
      { id: 'm3', tipo: 'gasto', cat: 'mercado' },
      { id: 'm4', tipo: 'gasto', cat: 'otros', catManual: true },
      { id: 'm5', tipo: 'gasto', cat: 'otros', catIA: true },
      { id: 'm6', tipo: 'ingreso' },
    ];
    expect(sinClasificar(movs).map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(sinClasificar()).toEqual([]);
  });
});
