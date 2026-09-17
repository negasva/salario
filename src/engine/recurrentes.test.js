import { describe, it, expect } from 'vitest';
import {
  fechaEnPeriodo, nuevoRecurrente, pendientes, agregarAlMes, totalDe, activos,
} from './recurrentes.js';

const arriendo = nuevoRecurrente({ n: 'Arriendo', monto: 1200000, catId: 'viv', dia: 5 });
const internet = nuevoRecurrente({ n: 'Internet', monto: 90000, catId: 'serv', dia: 12 });
const sueldo = nuevoRecurrente({ n: 'Sueldo', monto: 3000000, tipo: 'ingreso', dia: 30 });

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
  it('guarda nombre y precio, y un ingreso no lleva categoría', () => {
    expect(arriendo).toMatchObject({ n: 'Arriendo', monto: 1200000, catId: 'viv', tipo: 'gasto', activo: true });
    expect(sueldo.catId).toBeNull();
    expect(nuevoRecurrente({ n: '  Luz  ', monto: '90.000' }).n).toBe('Luz');
  });

  it('los totales separan gasto de ingreso y saltan los apagados', () => {
    const lista = [arriendo, internet, sueldo, { ...internet, id: 'x', activo: false }];
    expect(totalDe(lista, 'gasto')).toBe(1290000);
    expect(totalDe(lista, 'ingreso')).toBe(3000000);
    expect(activos(lista)).toHaveLength(3);
  });
});

describe('agregar al mes', () => {
  it('lo pendiente es lo que todavía no está en ese mes', () => {
    const movs = [{ id: 'm1', fecha: '2026-09-05', tipo: 'gasto', monto: 1200000, recId: arriendo.id }];
    expect(pendientes([arriendo, internet], movs, '2026-09').map((r) => r.n)).toEqual(['Internet']);
    // en otro mes siguen faltando los dos
    expect(pendientes([arriendo, internet], movs, '2026-10')).toHaveLength(2);
  });

  it('agrega los que faltan y no repite al volver a llamarlo', () => {
    const movs = [];
    const lista = [arriendo, internet, sueldo];
    const nuevos = agregarAlMes(lista, movs, '2026-09');
    expect(nuevos).toHaveLength(3);
    expect(movs).toHaveLength(3);
    expect(nuevos.find((m) => m.nota === 'Arriendo')).toMatchObject({ fecha: '2026-09-05', tipo: 'gasto', catId: 'viv' });
    expect(nuevos.find((m) => m.nota === 'Sueldo')).toMatchObject({ tipo: 'ingreso', catId: null });
    expect(agregarAlMes(lista, movs, '2026-09')).toHaveLength(0);
    expect(movs).toHaveLength(3);
  });

  it('no agrega los apagados ni los que no tienen precio', () => {
    const movs = [];
    agregarAlMes([{ ...arriendo, activo: false }, nuevoRecurrente({ n: 'Sin precio', monto: 0 })], movs, '2026-09');
    expect(movs).toEqual([]);
  });

  it('con una lista de ids agrega solo esos', () => {
    const movs = [];
    agregarAlMes([arriendo, internet], movs, '2026-09', [internet.id]);
    expect(movs.map((m) => m.nota)).toEqual(['Internet']);
  });
});
