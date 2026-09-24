import { describe, it, expect } from 'vitest';
import {
  saldoInicial, saldoActual, resumenMes, resumenFlujo, gastoPorCategoria,
  serieMensual, sumarMeses, periodoDe, delMes, arranqueVigente, buscar,
} from './movimientos.js';

const mov = (fecha, tipo, monto, catId = null) => ({ id: fecha + monto, fecha, tipo, monto, catId, nota: '' });

// El caso de la auditoría: agosto entra 1.000.000 y salen 1.100.000;
// septiembre entra 1.000.000. Septiembre empieza en −100.000.
const libro = [
  mov('2026-08-01', 'ingreso', 1000000),
  mov('2026-08-15', 'gasto', 700000, 'a'),
  mov('2026-08-20', 'gasto', 400000, 'b'),
  mov('2026-09-01', 'ingreso', 1000000),
];

describe('arrastre mes a mes', () => {
  it('septiembre empieza con lo que dejó agosto', () => {
    expect(saldoInicial(0, libro, '2026-08')).toBe(0);
    expect(saldoInicial(0, libro, '2026-09')).toBe(-100000);
    expect(saldoInicial(0, libro, '2026-10')).toBe(900000);
  });

  it('la cabecera del mes dice empezaste, entró, salió, terminas', () => {
    expect(resumenMes(0, libro, '2026-08')).toEqual({ inicial: 0, ingresos: 1000000, gastos: 1100000, final: -100000 });
    expect(resumenMes(0, libro, '2026-09')).toEqual({ inicial: -100000, ingresos: 1000000, gastos: 0, final: 900000 });
  });

  it('el saldo inicial declarado entra en la cuenta', () => {
    expect(saldoInicial(250000, libro, '2026-09')).toBe(150000);
    expect(saldoActual(250000, libro)).toBe(1150000);
  });

  it('un mes sin movimientos arrastra igual', () => {
    expect(resumenMes(0, libro, '2026-12')).toEqual({ inicial: 900000, ingresos: 0, gastos: 0, final: 900000 });
  });
});

describe('flujo y categorías', () => {
  it('resumenFlujo cuenta cada movimiento una vez', () => {
    expect(resumenFlujo(libro, '2026-08')).toEqual({ ingresos: 1000000, gastos: 1100000, saldo: -100000 });
  });

  it('gastoPorCategoria agrupa solo gastos y manda lo suelto a otros', () => {
    const conSuelto = libro.concat([mov('2026-08-21', 'gasto', 5000)]);
    expect(gastoPorCategoria(conSuelto, '2026-08')).toEqual({ a: 700000, b: 400000, otros: 5000 });
    expect(gastoPorCategoria(conSuelto, '2026-09')).toEqual({});
  });

  it('delMes ordena del más reciente al más viejo', () => {
    expect(delMes(libro, '2026-08').map((m) => m.fecha)).toEqual(['2026-08-20', '2026-08-15', '2026-08-01']);
  });
});

describe('empezar el mes de nuevo', () => {
  // pagó la deuda por fuera: octubre arranca en cero y no hereda los −100.000
  const arranques = { '2026-10': 0 };

  it('el mes del arranque empieza con la cifra puesta', () => {
    expect(saldoInicial(0, libro, '2026-10', { '2026-10': 0 })).toBe(0);
    expect(saldoInicial(0, libro, '2026-10', { '2026-10': -50000 })).toBe(-50000);
  });

  it('los meses anteriores se quedan como estaban', () => {
    expect(saldoInicial(0, libro, '2026-08', arranques)).toBe(0);
    expect(resumenMes(0, libro, '2026-09', arranques).final).toBe(900000);
  });

  it('desde el arranque solo cuenta lo que pasó de ahí en adelante', () => {
    const conOctubre = libro.concat([mov('2026-10-03', 'gasto', 30000, 'a')]);
    expect(resumenMes(0, conOctubre, '2026-10', arranques))
      .toEqual({ inicial: 0, ingresos: 0, gastos: 30000, final: -30000 });
    expect(saldoInicial(0, conOctubre, '2026-11', arranques)).toBe(-30000);
  });

  it('manda el arranque más reciente que no sea posterior al mes', () => {
    const varios = { '2026-02': 1000, '2026-10': 0 };
    expect(arranqueVigente(varios, '2026-09')).toBe('2026-02');
    expect(arranqueVigente(varios, '2026-10')).toBe('2026-10');
    expect(arranqueVigente(varios, '2026-01')).toBeNull();
    expect(arranqueVigente(undefined, '2026-09')).toBeNull();
  });

  it('el saldo de hoy también arranca desde ahí', () => {
    const hoy = new Date(2026, 8, 20); // septiembre
    expect(saldoActual(0, libro, {}, hoy)).toBe(900000);
    expect(saldoActual(0, libro, { '2026-09': 0 }, hoy)).toBe(1000000);
  });
});

describe('serie mensual', () => {
  it('sumarMeses cruza el año', () => {
    expect(sumarMeses('2026-01', -1)).toBe('2025-12');
    expect(sumarMeses('2026-12', 1)).toBe('2027-01');
    expect(periodoDe('2026-09-16')).toBe('2026-09');
  });

  it('serieMensual devuelve n meses terminando en el elegido, con arrastre', () => {
    const s = serieMensual(0, libro, '2026-09', 3);
    expect(s.map((x) => x.periodo)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(s.map((x) => x.final)).toEqual([0, -100000, 900000]);
  });
});

describe('búsqueda', () => {
  const cats = [{ id: 'mer', n: 'Mercado' }];
  const recurrentes = [{ id: 'r1', n: 'Mercado del mes' }];
  const movs = [
    { id: 'a', fecha: '2026-08-10', tipo: 'gasto', monto: 200000, catId: 'mer', nota: 'D1', recId: 'r1' },
    { id: 'b', fecha: '2026-09-03', tipo: 'gasto', monto: 130000, catId: 'mer', nota: 'Éxito calle 80' },
    { id: 'c', fecha: '2026-09-04', tipo: 'gasto', monto: 45000, catId: 'otros', nota: 'Droguería' },
  ];

  it('sin tildes ni mayúsculas, en nota, categoría y recurrente, del más nuevo al más viejo', () => {
    expect(buscar(movs, 'exito', { cats, recurrentes }).map((m) => m.id)).toEqual(['b']);
    expect(buscar(movs, 'MERCADO', { cats, recurrentes }).map((m) => m.id)).toEqual(['b', 'a']);
    expect(buscar(movs, 'del mes', { cats, recurrentes }).map((m) => m.id)).toEqual(['a']);
    expect(buscar(movs, 'drogueria', { cats }).map((m) => m.id)).toEqual(['c']);
  });

  it('un número encuentra el monto', () => {
    expect(buscar(movs, '130.000', { cats }).map((m) => m.id)).toEqual(['b']);
    expect(buscar(movs, '', { cats })).toEqual([]);
  });
});
