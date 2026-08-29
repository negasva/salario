import { describe, it, expect } from 'vitest';
import {
  estadoLinea, resumenItem, resumenMes, agregarPago, agregarPagoLibre, pagosDeLinea,
  pagosLibresDeItem, quitarPago,
  movimientosDeAhorro, ahorroRepartido, promedioVariables, precargarFijos,
  arrastreDe, planDeLinea, pasarAlSiguiente, quitarArrastre, siguientePeriodo, mesAnterior,
} from './pagos.js';

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

  it('suma pagos libres al pagado del bloque', () => {
    const r = resumenItem(it1, { l1: 280000 }, '2026-08', 40000);
    expect(r.plan).toBe(920000);
    expect(r.pagado).toBe(320000);
  });

  it('el mes agrega todas las categorias', () => {
    const r = resumenMes([it1, { id: 'i2', L: [linea('l4', 'Netflix', 40000)] }], { l1: 300000, l4: 40000 }, '2026-08');
    expect(r.plan).toBe(960000);
    expect(r.pagado).toBe(340000);
    expect(r.diferencia).toBe(620000);
  });
});

describe('pagos por transacción', () => {
  const item = { id: 'i1' };
  const l = linea('l1', 'Mercado', 500000);

  it('cada compra es su propio movimiento y se suman', () => {
    const movs = [];
    agregarPago(movs, item, l, 120000, '2026-08-03');
    agregarPago(movs, item, l, 85000, '2026-08-11');
    agregarPago(movs, item, l, 260000, '2026-08-24');
    expect(movs).toHaveLength(3);
    expect(movs.reduce((s, m) => s + m.monto, 0)).toBe(465000);
    expect(movs[0]).toMatchObject({ tipo: 'gasto', itemId: 'i1', lineId: 'l1', goalId: null });
  });

  it('cada pago lleva su propio id, para poder borrar solo ese', () => {
    const movs = [];
    agregarPago(movs, item, l, 100000, '2026-08-03');
    agregarPago(movs, item, l, 100000, '2026-08-03');
    expect(movs[0].id).not.toBe(movs[1].id);
  });

  it('acepta una nota para saber de dónde salió la compra', () => {
    const movs = [];
    agregarPago(movs, item, l, 90000, '2026-08-03', 'D1');
    expect(movs[0].nota).toBe('D1');
    agregarPago(movs, item, l, 90000, '2026-08-04');
    expect(movs[1].nota).toBe('Pago Mercado');
  });

  it('cero o negativo no ensucia el libro', () => {
    const movs = [];
    expect(agregarPago(movs, item, l, 0, '2026-08-03')).toBe(null);
    expect(agregarPago(movs, item, l, -5000, '2026-08-03')).toBe(null);
    expect(movs).toHaveLength(0);
  });

  it('permite pagos sin concepto y los filtra por bloque y mes', () => {
    const movs = [];
    const item = { id: 'i1' };
    agregarPagoLibre(movs, item, 70000, '2026-08-03', 'Taxi');
    agregarPagoLibre(movs, item, 50000, '2026-07-03', 'Anterior');
    expect(pagosLibresDeItem(movs, 'i1', '2026-08').map((m) => m.nota)).toEqual(['Taxi']);
    expect(movs[0]).toMatchObject({ itemId: 'i1', lineId: null, nota: 'Taxi' });
  });

  it('lista solo los pagos de ese renglón y ese mes, en orden', () => {
    const movs = [
      gasto('m1', 'l1', 260000, '2026-08-24'),
      gasto('m2', 'l1', 120000, '2026-08-03'),
      gasto('m3', 'l2', 999, '2026-08-05'),
      gasto('m4', 'l1', 777, '2026-07-05'),
    ];
    expect(pagosDeLinea(movs, 'l1', '2026-08').map((m) => m.id)).toEqual(['m2', 'm1']);
  });

  it('quitar un pago borra solo ese y deja los demás', () => {
    const movs = [gasto('m1', 'l1', 120000), gasto('m2', 'l1', 85000)];
    expect(quitarPago(movs, 'm1')).toBe(true);
    expect(movs.map((m) => m.id)).toEqual(['m2']);
    expect(quitarPago(movs, 'noexiste')).toBe(false);
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


describe('arrastre de un mes al siguiente', () => {
  it('sabe cuál es el mes de antes y el de después, con el salto de año', () => {
    expect(siguientePeriodo('2026-08')).toBe('2026-09');
    expect(siguientePeriodo('2026-12')).toBe('2027-01');
    expect(mesAnterior('2026-08')).toBe('2026-07');
    expect(mesAnterior('2026-01')).toBe('2025-12');
  });

  it('sin arrastre el renglón vale su plan de siempre', () => {
    expect(planDeLinea({ v: 480000 }, '2026-08')).toBe(480000);
    expect(arrastreDe({ v: 480000 }, '2026-08')).toBe(0);
  });

  it('lo que no se pagó se pasa al mes siguiente y allá el renglón vale el doble', () => {
    const l = { id: 'l1', v: 480000 };
    pasarAlSiguiente(l, '2026-08', 480000);
    expect(planDeLinea(l, '2026-09')).toBe(960000);
    expect(planDeLinea(l, '2026-08')).toBe(480000);
  });

  it('dos meses seguidos sin pagar se acumulan', () => {
    const l = { id: 'l1', v: 480000 };
    pasarAlSiguiente(l, '2026-08', 480000);
    pasarAlSiguiente(l, '2026-08', 200000);
    expect(arrastreDe(l, '2026-09')).toBe(680000);
  });

  it('pasar cero o negativo no hace nada', () => {
    const l = { id: 'l1', v: 480000 };
    expect(pasarAlSiguiente(l, '2026-08', 0)).toBe(0);
    expect(arrastreDe(l, '2026-09')).toBe(0);
  });

  it('un arrastre puesto por error se puede quitar', () => {
    const l = { id: 'l1', v: 480000 };
    pasarAlSiguiente(l, '2026-08', 480000);
    quitarArrastre(l, '2026-09');
    expect(planDeLinea(l, '2026-09')).toBe(480000);
  });

  it('el resumen del mes cobra el arrastre y dice cuánto falta', () => {
    const l = { id: 'l1', n: 'Administración', v: 480000, arrastre: { '2026-09': 480000 } };
    const [fila] = resumenItem({ L: [l] }, { l1: 300000 }, '2026-09').filas;
    expect(fila.plan).toBe(960000);
    expect(fila.arrastre).toBe(480000);
    expect(fila.pendiente).toBe(660000);
    expect(fila.estado).toBe('parcial');
  });
});


describe('lo que la categoria cuesta de verdad', () => {
  const it2 = (extra) => ({ L: [
    linea('l1', 'Arriendo', 1000000),
    linea('l2', 'Mercado', 600000),
    linea('l3', 'Internet', 100000),
    ...extra,
  ] });

  it('sin pagos el costo es el plan entero', () => {
    const r = resumenItem(it2([]), {}, '2026-08');
    expect(r.costo).toBe(1700000);
    expect(r.ahorrado).toBe(0);
    expect(r.excedido).toBe(0);
  });

  it('un renglon cerrado por debajo del plan baja el costo', () => {
    // el arriendo se cierra con 900.000: 100.000 ahorrados
    const item = it2([]);
    item.L[0].pagadoEn = '2026-08';
    const r = resumenItem(item, { l1: 900000 }, '2026-08');
    expect(r.ahorrado).toBe(100000);
    expect(r.costo).toBe(1600000);
  });

  it('un renglon cerrado por encima del plan sube el costo', () => {
    const r = resumenItem(it2([]), { l1: 1200000 }, '2026-08');
    expect(r.excedido).toBe(200000);
    expect(r.costo).toBe(1900000);
  });

  it('un renglon a medio pagar todavia cuenta por su plan', () => {
    const r = resumenItem(it2([]), { l2: 200000 }, '2026-08');
    expect(r.ahorrado).toBe(0);
    expect(r.costo).toBe(1700000);
  });

  it('mezcla ahorros y excesos en la misma categoria', () => {
    const item = it2([]);
    item.L[0].pagadoEn = '2026-08';
    const r = resumenItem(item, { l1: 900000, l3: 130000 }, '2026-08');
    expect(r.ahorrado).toBe(100000);
    expect(r.excedido).toBe(30000);
    expect(r.costo).toBe(1630000);
  });

  it('la deuda arrastrada entra en el plan y por tanto en el costo', () => {
    const item = it2([]);
    item.L[0].arrastre = { '2026-08': 1000000 };
    expect(resumenItem(item, {}, '2026-08').costo).toBe(2700000);
  });
});

describe('precargarFijos', () => {
  const perfil = () => ({
    items: [{ id: 'i1', L: [
      { id: 'l1', n: 'Arriendo', v: 1200000, fixed: true, autoPagar: true },
      { id: 'l2', n: 'Mercado', v: 600000, fixed: false, autoPagar: true },
      { id: 'l3', n: 'Internet', v: 100000, fixed: true },
    ] }],
    movs: [],
  });

  it('paga los fijos marcados y los deja cerrados', () => {
    const p = perfil();
    expect(precargarFijos(p.items, p.movs, '2026-09', '2026-09-01')).toBe(1);
    expect(p.movs).toHaveLength(1);
    expect(p.movs[0]).toMatchObject({ lineId: 'l1', monto: 1200000, tipo: 'gasto' });
    expect(p.items[0].L[0].pagadoEn).toBe('2026-09');
  });

  it('no precarga dos veces el mismo mes', () => {
    const p = perfil();
    precargarFijos(p.items, p.movs, '2026-09', '2026-09-01');
    expect(precargarFijos(p.items, p.movs, '2026-09', '2026-09-02')).toBe(0);
    expect(p.movs).toHaveLength(1);
  });

  it('respeta un renglón que ya tiene pagos del mes', () => {
    const p = perfil();
    p.movs.push({ id: 'm9', fecha: '2026-09-03', tipo: 'gasto', monto: 500000, lineId: 'l1', itemId: 'i1' });
    expect(precargarFijos(p.items, p.movs, '2026-09', '2026-09-05')).toBe(0);
  });

  it('un mes nuevo vuelve a precargar', () => {
    const p = perfil();
    precargarFijos(p.items, p.movs, '2026-09', '2026-09-01');
    expect(precargarFijos(p.items, p.movs, '2026-10', '2026-10-01')).toBe(1);
    expect(p.movs).toHaveLength(2);
  });
});
