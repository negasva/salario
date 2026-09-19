import { describe, it, expect } from 'vitest';
import {
  fechaEnPeriodo, nuevoRecurrente, pendientes, pagoDelMes, estaPagado,
  marcarPagado, quitarPago, marcarTodos, resumen,
} from './recurrentes.js';

const nuevo = (n, monto, extra = {}) => nuevoRecurrente({ n, monto, catId: 'viv', dia: 5, ...extra });

describe('fecha del recurrente', () => {
  it('el día 31 se cae al último del mes', () => {
    expect(fechaEnPeriodo('2026-02', 31)).toBe('2026-02-28');
    expect(fechaEnPeriodo('2024-02', 31)).toBe('2024-02-29');
    expect(fechaEnPeriodo('2026-09', 5)).toBe('2026-09-05');
  });

  it('un día inválido cae el primero', () => {
    expect(fechaEnPeriodo('2026-09', 0)).toBe('2026-09-01');
    expect(fechaEnPeriodo('2026-09', undefined)).toBe('2026-09-01');
  });
});

describe('modelo', () => {
  it('guarda nombre y estimado, sin marca de apagado', () => {
    const r = nuevo('Arriendo', 1200000);
    expect(r).toMatchObject({ n: 'Arriendo', monto: 1200000, catId: 'viv', tipo: 'gasto' });
    expect('activo' in r).toBe(false);
  });

  it('un ingreso no lleva categoría y el estimado puede ir vacío', () => {
    expect(nuevoRecurrente({ n: 'Sueldo', monto: 3000000, tipo: 'ingreso' }).catId).toBeNull();
    expect(nuevo('Mercado', 0).monto).toBe(0);
  });
});

describe('marcar el pago del mes', () => {
  it('se marca con lo que de verdad costó y el estimado no se toca', () => {
    const luz = nuevo('Luz', 90000);
    const movs = [];
    const mov = marcarPagado(luz, movs, '2026-09', 87400);
    expect(mov).toMatchObject({ monto: 87400, fecha: '2026-09-05', tipo: 'gasto', catId: 'viv', nota: 'Luz', recId: luz.id });
    expect(luz.monto).toBe(90000);
    expect(estaPagado(luz, movs, '2026-09')).toBe(true);
    expect(estaPagado(luz, movs, '2026-10')).toBe(false);
  });

  it('sin estimado se marca con el monto que se escriba', () => {
    const mercado = nuevo('Mercado', 0);
    const movs = [];
    expect(marcarPagado(mercado, movs, '2026-09', 240000).monto).toBe(240000);
    expect(marcarPagado(nuevo('Nada', 0), [], '2026-09')).toBeNull();
  });

  it('volver a marcarlo corrige el mismo movimiento, no crea otro', () => {
    const luz = nuevo('Luz', 90000);
    const movs = [];
    const primero = marcarPagado(luz, movs, '2026-09', 87400);
    const segundo = marcarPagado(luz, movs, '2026-09', 91200, '2026-09-07');
    expect(movs).toHaveLength(1);
    expect(segundo).toBe(primero);
    expect(movs[0]).toMatchObject({ monto: 91200, fecha: '2026-09-07' });
  });

  it('quitar el pago lo devuelve a pendiente', () => {
    const luz = nuevo('Luz', 90000);
    const movs = [];
    marcarPagado(luz, movs, '2026-09', 87400);
    const fuera = quitarPago(luz, movs, '2026-09');
    expect(fuera.monto).toBe(87400);
    expect(movs).toEqual([]);
    expect(quitarPago(luz, movs, '2026-09')).toBeNull();
  });

  it('lo pendiente incluye a los que no tienen estimado', () => {
    const arriendo = nuevo('Arriendo', 1200000);
    const mercado = nuevo('Mercado', 0);
    const movs = [];
    expect(pendientes([arriendo, mercado], movs, '2026-09').map((r) => r.n)).toEqual(['Arriendo', 'Mercado']);
    marcarPagado(arriendo, movs, '2026-09', 1200000);
    expect(pendientes([arriendo, mercado], movs, '2026-09').map((r) => r.n)).toEqual(['Mercado']);
    expect(pagoDelMes(mercado, movs, '2026-09')).toBeNull();
  });
});

describe('marcar de una vez', () => {
  it('marca los que faltan y tienen estimado, y no repite', () => {
    const arriendo = nuevo('Arriendo', 1200000);
    const internet = nuevo('Internet', 90000);
    const mercado = nuevo('Mercado', 0);
    const movs = [];
    const hechos = marcarTodos([arriendo, internet, mercado], movs, '2026-09');
    expect(hechos.map((m) => m.nota)).toEqual(['Arriendo', 'Internet']);
    expect(marcarTodos([arriendo, internet, mercado], movs, '2026-09')).toEqual([]);
    expect(movs).toHaveLength(2);
  });

  it('con una lista de ids marca solo esos', () => {
    const arriendo = nuevo('Arriendo', 1200000);
    const internet = nuevo('Internet', 90000);
    const movs = [];
    marcarTodos([arriendo, internet], movs, '2026-09', [internet.id]);
    expect(movs.map((m) => m.nota)).toEqual(['Internet']);
  });
});

describe('resumen del mes', () => {
  it('separa lo estimado de lo pagado y cuenta los que faltan', () => {
    const arriendo = nuevo('Arriendo', 1200000);
    const luz = nuevo('Luz', 90000);
    const sueldo = nuevoRecurrente({ n: 'Sueldo', monto: 3000000, tipo: 'ingreso' });
    const movs = [];
    marcarPagado(luz, movs, '2026-09', 87400);
    expect(resumen([arriendo, luz, sueldo], movs, '2026-09', 'gasto'))
      .toEqual({ estimado: 1290000, pagado: 87400, faltan: 1, total: 2 });
    expect(resumen([arriendo, luz, sueldo], movs, '2026-09', 'ingreso'))
      .toEqual({ estimado: 3000000, pagado: 0, faltan: 1, total: 1 });
  });
});
