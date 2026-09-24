import { describe, it, expect } from 'vitest';
import { aCSV, leerCSV, leerFecha, leerMonto, detectarColumnas, adivinarCategoria, aCandidatos } from './csv.js';

const cats = [
  { id: 'mer', n: 'Mercado', tipo: 'gasto' }, { id: 'tra', n: 'Transporte', tipo: 'gasto' },
  { id: 'sus', n: 'Suscripciones', tipo: 'gasto' }, { id: 'otros', n: 'Otros', tipo: 'gasto' },
  { id: 'sue', n: 'Sueldo', tipo: 'ingreso' }, { id: 'otros-ingreso', n: 'Otros ingresos', tipo: 'ingreso' },
];

describe('exportar', () => {
  it('punto y coma, gastos en negativo y comillas donde hacen falta', () => {
    const csv = aCSV([
      { fecha: '2026-09-03', tipo: 'gasto', monto: 130000, catId: 'mer', nota: 'Éxito; calle 80', recId: 'r1' },
      { fecha: '2026-09-01', tipo: 'ingreso', monto: 3000000, catId: 'sue', nota: 'Nómina' },
    ], cats, [{ id: 'r1', n: 'Mercado' }]);
    expect(csv.split('\r\n')).toEqual([
      'Fecha;Tipo;Categoría;Monto;Nota;Recurrente',
      '2026-09-01;Ingreso;Sueldo;3000000;Nómina;',
      '2026-09-03;Gasto;Mercado;-130000;"Éxito; calle 80";Mercado',
    ]);
  });
});

describe('leer el extracto', () => {
  it('lee CSV con comas, punto y coma, comillas y BOM', () => {
    expect(leerCSV('﻿a;b\r\n"x;y";"di ""hola"""\n')).toEqual([['a', 'b'], ['x;y', 'di "hola"']]);
    expect(leerCSV('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('fechas con el día primero, ISO y pegadas', () => {
    expect(['03/09/2026', '3-9-26', '2026-09-03', '2026/09/03', '20260903'].map(leerFecha)).toEqual(Array(5).fill('2026-09-03'));
    expect(leerFecha('31/13/2026')).toBeNull();
    expect(leerFecha('hola')).toBeNull();
  });

  it('montos con signo en cualquier formato', () => {
    expect(['-130.000,00', '$ 1,200,000.00', '(45.000)', '45.000-', '130000', ''].map(leerMonto))
      .toEqual([-130000, 1200000, -45000, -45000, 130000, null]);
  });

  it('encuentra los encabezados aunque arriba venga el nombre del banco', () => {
    const filas = leerCSV('Banco X;Cuenta 123\n\nFecha;Descripción;Valor;Saldo\n03/09/2026;COMPRA EXITO CALLE 80;-130.000,00;1.000.000\n01/09/2026;PAGO NOMINA;3.000.000,00;1.130.000');
    const mapa = detectarColumnas(filas);
    expect(mapa).toMatchObject({ encabezado: 1, fecha: 0, descripcion: 1, monto: 2 });
    const c = aCandidatos(filas, mapa, { cats, movs: [{ fecha: '2026-09-01', tipo: 'ingreso', monto: 3000000 }] });
    expect(c.map((x) => [x.fecha, x.tipo, x.monto, x.catId, x.duplicado])).toEqual([
      ['2026-09-03', 'gasto', 130000, 'mer', false],
      ['2026-09-01', 'ingreso', 3000000, 'sue', true],
    ]);
  });

  it('débitos y créditos en columnas separadas', () => {
    const filas = leerCSV('Fecha,Concepto,Débito,Crédito\n2026-09-05,UBER TRIP,25000,\n2026-09-06,TRANSFERENCIA,,50000');
    const mapa = detectarColumnas(filas);
    expect(mapa).toMatchObject({ fecha: 0, descripcion: 1, debito: 2, credito: 3 });
    expect(aCandidatos(filas, mapa, { cats }).map((x) => [x.tipo, x.monto, x.catId]))
      .toEqual([['gasto', 25000, 'tra'], ['ingreso', 50000, 'otros-ingreso']]);
  });

  it('sin encabezados adivina por el contenido', () => {
    const filas = leerCSV('03/09/2026;NETFLIX.COM;-38.900\n04/09/2026;TIENDA;-5.000');
    expect(detectarColumnas(filas)).toMatchObject({ encabezado: -1, fecha: 0, descripcion: 1, monto: 2 });
  });
});

describe('adivinar la categoría', () => {
  it('primero por lo que tú has hecho, luego por el comercio', () => {
    const movs = [{ tipo: 'gasto', catId: 'tra', nota: 'Tienda la esquina' }];
    expect(adivinarCategoria('TIENDA LA ESQUINA 2', 'gasto', cats, movs)).toBe('tra');
    expect(adivinarCategoria('COMPRA D1 SUBA', 'gasto', cats)).toBe('mer');
    expect(adivinarCategoria('SPOTIFY P1', 'gasto', cats)).toBe('sus');
    expect(adivinarCategoria('ALGO RARO', 'gasto', cats)).toBe('otros');
  });
});
