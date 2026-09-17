import { describe, it, expect } from 'vitest';
import {
  saldoInicial, saldoActual, resumenMes, resumenFlujo, gastoPorCategoria,
  serieMensual, sumarMeses, periodoDe, delMes,
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
