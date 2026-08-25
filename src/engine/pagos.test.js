import { describe, it, expect } from 'vitest';
import { estadoLinea, resumenItem, resumenMes, fijarPagado, movimientosDeAhorro, ahorroRepartido, promedioVariables } from './pagos.js';

const linea = (id, n, v, extra = {}) => ({ id, n, v, fixed: true, ...extra });
const gasto = (id, lineId, monto, fecha = '2026-08-10') => ({ id, fecha, tipo: 'gasto', monto, itemId: 'i1', lineId });

describe('estadoLinea', () => {
  it('clasifica los cuatro estados', () => {
    expect(estadoLinea(0, 300000, false)).toBe('pendiente');
    expect(estadoLinea(120000, 300000, false)).toBe('parcial');
    expect(estadoLinea(300000, 300000, false)).toBe('pagado');
    expect(estadoLinea(310000, 300000, false)).toBe('excedido');
  });
  it('el toggle cierra el renglon aunque falte plata', () => {
    expect(estadoLinea(120000, 300000, true)).toBe('pagado');
    expect(estadoLinea(0, 0, true)).toBe('pagado');
  });
});

describe('resumen', () => {
  const it1 = { id: 'i1', n: 'Esenciales', L: [linea('l1', 'Servicios', 300000), linea('l2', 'Mercado', 500000), linea('l3', 'Gasolina', 120000)] };

  it('suma plan, pagado y diferencia del item', () => {
    const r = resumenItem(it1, { l1: 280000, l2: 520000 }, '2026-08');
    expect(r.plan).toBe(920000);
    expect(r.pagado).toBe(800000);
    expect(r.diferencia).toBe(120000);
    expect(r.cerradas).toBe(1); // solo l2, que se excedio
    expect(r.filas.map((f) => f.estado)).toEqual(['parcial', 'excedido', 'pendiente']);
  });

  it('cuenta cerradas solo pagado/excedido', () => {
    const r = resumenItem(it1, { l1: 300000, l2: 520000 }, '2026-08');
    expect(r.cerradas).toBe(2);
    expect(r.total).toBe(3);
  });

  it('el mes agrega todas las categorias', () => {
    const r = resumenMes([it1, { id: 'i2', L: [linea('l4', 'Netflix', 40000)] }], { l1: 300000, l4: 40000 }, '2026-08');
    expect(r.plan).toBe(960000);
    expect(r.pagado).toBe(340000);
    expect(r.diferencia).toBe(620000);
  });
});

describe('fijarPagado', () => {
  const item = { id: 'i1' };
  const l = linea('l1', 'Mercado', 500000);

  it('crea el movimiento la primera vez', () => {
    const movs = [];
    expect(fijarPagado(movs, item, l, 465000, '2026-08-12')).toBe(465000);
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ monto: 465000, lineId: 'l1', itemId: 'i1', tipo: 'gasto' });
  });

  it('subir solo agrega la diferencia, sin duplicar', () => {
    const movs = [gasto('m1', 'l1', 200000)];
    expect(fijarPagado(movs, item, l, 500000, '2026-08-12')).toBe(300000);
    expect(movs.reduce((s, m) => s + m.monto, 0)).toBe(500000);
  });

  it('bajar recorta los mas recientes y nunca deja gastos negativos', () => {
    const movs = [gasto('m1', 'l1', 200000, '2026-08-01'), gasto('m2', 'l1', 300000, '2026-08-20')];
    fijarPagado(movs, item, l, 150000, '2026-08-25');
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ id: 'm1', monto: 150000 });
    expect(movs.every((m) => m.monto > 0)).toBe(true);
  });

  it('poner cero borra los pagos del mes', () => {
    const movs = [gasto('m1', 'l1', 200000)];
    fijarPagado(movs, item, l, 0, '2026-08-25');
    expect(movs).toHaveLength(0);
  });

  it('no toca otros meses ni otros renglones', () => {
    const movs = [gasto('m1', 'l1', 100000, '2026-07-10'), gasto('m2', 'l2', 90000)];
    fijarPagado(movs, item, l, 0, '2026-08-25');
    expect(movs).toHaveLength(2);
  });

  it('el mismo valor no ensucia el libro', () => {
    const movs = [gasto('m1', 'l1', 465000)];
    expect(fijarPagado(movs, item, l, 465000, '2026-08-12')).toBe(0);
    expect(movs).toHaveLength(1);
  });
});

describe('ahorro', () => {
  it('reparte a metas y a bloques, y descarta el excedente libre', () => {
    const ms = movimientosDeAhorro([
      { goalId: 'g1', nombre: 'Viaje', monto: 200000 },
      { itemId: 'i9', nombre: 'Ahorros', monto: 100000 },
      { nombre: 'Excedente libre', monto: 0 },
    ], '2026-08', '2026-09-01', 'Ahorro de agosto - Esenciales');
    expect(ms).toHaveLength(2);
    expect(ms[0]).toMatchObject({ goalId: 'g1', monto: 200000, origen: 'ahorro', periodoOrigen: '2026-08' });
    expect(ms[0].nota).toBe('Ahorro de agosto - Esenciales → Viaje');
    expect(ms[1]).toMatchObject({ itemId: 'i9', goalId: null });
  });

  it('el historial recupera lo repartido de ese mes', () => {
    const movs = [{ origen: 'ahorro', periodoOrigen: '2026-08', monto: 1 }, { origen: 'ahorro', periodoOrigen: '2026-07', monto: 2 }, { monto: 3 }];
    expect(ahorroRepartido(movs, '2026-08')).toHaveLength(1);
  });
});

describe('promedioVariables', () => {
  const cierre = (periodo, real) => ({ periodo, snapshot: { lineas: {
    l1: { nombre: 'Mercado', itemId: 'i1', plan: 500000, real, fixed: false },
    l2: { nombre: 'Arriendo', itemId: 'i1', plan: 900000, real: 900000, fixed: true },
  } } });

  it('promedia solo variables y con al menos dos meses', () => {
    const r = promedioVariables([cierre('2026-06', 430000), cierre('2026-07', 500000)]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ nombre: 'Mercado', plan: 500000, promedio: 465000, brecha: 35000, meses: 2 });
  });

  it('un solo mes no da promedio', () => {
    expect(promedioVariables([cierre('2026-07', 430000)])).toHaveLength(0);
  });
});
