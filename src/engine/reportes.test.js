import { describe, it, expect } from 'vitest';
import { diasDelMes, diasTranscurridos, flujoDiario, acumulado, porDiaSemana, calor, topGastos,
  resumenReporte, tendenciaCategorias, resumenAnual } from './reportes.js';

const m = (fecha, tipo, monto, catId = 'x') => ({ id: fecha + monto + tipo, fecha, tipo, monto, catId });
// septiembre 2026 empieza en martes
const movs = [
  m('2026-09-01', 'ingreso', 1000), m('2026-09-01', 'gasto', 100), m('2026-09-01', 'gasto', 50, 'ah'),
  m('2026-09-04', 'gasto', 300), m('2026-09-30', 'gasto', 50),
  m('2026-08-10', 'gasto', 200), m('2026-08-10', 'ingreso', 500),
];

describe('calendario', () => {
  it('días del mes, bisiestos incluidos', () => {
    expect(diasDelMes('2026-09')).toBe(30);
    expect(diasDelMes('2028-02')).toBe(29);
  });
  it('días transcurridos: mes pasado entero, en curso hasta hoy, futuro ninguno', () => {
    expect(diasTranscurridos('2026-08', '2026-09-10')).toBe(31);
    expect(diasTranscurridos('2026-09', '2026-09-10')).toBe(10);
    expect(diasTranscurridos('2026-10', '2026-09-10')).toBe(0);
  });
});

describe('flujo diario', () => {
  const dias = flujoDiario(movs, '2026-09');
  it('suma por día y deja en cero los vacíos', () => {
    expect(dias).toHaveLength(30);
    expect(dias[0]).toEqual({ dia: 1, gasto: 150, ingreso: 1000 });
    expect(dias[1].gasto).toBe(0);
  });
  it('el acumulado corta en `hasta`', () => {
    const a = acumulado(dias, 4);
    expect(a.slice(0, 4)).toEqual([150, 150, 150, 450]);
    expect(a[4]).toBeNull();
  });
});

describe('día de la semana y calor', () => {
  it('lunes es 0 y no cuenta recurrentes ni ahorro', () => {
    const t = porDiaSemana([...movs, { ...m('2026-09-02', 'gasto', 999), recId: 'r1' }], '2026-09', 'ah');
    expect(t[1]).toBe(100); // martes 1: 150 menos los 50 de ahorro
    expect(t[4]).toBe(300); // viernes 4
    expect(t[2]).toBe(50); // miércoles 30; el recurrente del 2 no entra
  });
  it('el calor alinea el día 1 y reparte por cuartiles entre los días con gasto', () => {
    const c = calor(movs, '2026-09');
    expect(c.vacias).toBe(1);
    expect(c.celdas[1].nivel).toBe(0); // día sin gasto
    expect(c.celdas[29].nivel).toBe(1); // el más barato (50)
    expect(c.celdas[3].nivel).toBe(4); // el más caro (300)
    expect(c.celdas[0].nivel).toBe(3); // 150
  });
  it('un mes sin gastos no revienta', () => {
    expect(calor([], '2026-09').celdas.every((x) => x.nivel === 0)).toBe(true);
  });
});

describe('resumen del mes', () => {
  it('promedio, proyección y tasa de ahorro con lo apartado', () => {
    const r = resumenReporte(movs, '2026-09', { hoy: '2026-09-10', ahorroId: 'ah' });
    // variable = 500 menos 50 de ahorro: 45 por día, y faltan 20 días
    expect(r).toMatchObject({ gastos: 500, ingresos: 1000, apartado: 50, variable: 450, pasados: 10, promedioDiario: 45, proyeccion: 1400 });
    expect(r.tasaAhorro).toBe(55); // (1000 - 500 + 50) / 1000
    expect(r.diaMasCaro.dia).toBe(4);
  });
  it('un mes cerrado no proyecta y sin ingresos no hay tasa', () => {
    expect(resumenReporte(movs, '2026-09', { hoy: '2026-10-05' }).proyeccion).toBeNull();
    expect(resumenReporte([m('2026-09-02', 'gasto', 10)], '2026-09').tasaAhorro).toBeNull();
  });
  it('top de gastos de mayor a menor', () => {
    expect(topGastos(movs, '2026-09', 2).map((x) => x.monto)).toEqual([300, 100]);
  });
});

describe('tendencias y año', () => {
  it('serie por categoría con ceros en los meses sin gasto', () => {
    const t = tendenciaCategorias(movs, '2026-09', 3);
    expect(t.x).toEqual([0, 200, 450]);
  });
  it('año: totales, mejor y peor mes', () => {
    const a = resumenAnual(movs, 2026);
    expect(a.meses).toHaveLength(12);
    expect(a).toMatchObject({ ingresos: 1500, gastos: 700, neto: 800 });
    expect(a.mejor.periodo).toBe('2026-09');
    expect(a.peor.periodo).toBe('2026-08');
    expect(a.porCat.x).toBe(650);
  });
  it('año sin movimientos no tiene mejor ni peor', () => {
    expect(resumenAnual([], 2026).mejor).toBeNull();
  });
});
