import { describe, it, expect } from 'vitest';
import {
  catAhorro, ahorroPorMes, ahorroTotal, nuevaMeta, progresoMeta, ritmoMensual, estadoAhorro,
  inicialSugerido, retiro,
} from './ahorro.js';

const cats = [
  { id: 'aho', n: 'Ahorro', tipo: 'gasto' },
  { id: 'mer', n: 'Mercado', tipo: 'gasto' },
];
const guardar = (fecha, monto) => ({ id: fecha + monto, fecha, tipo: 'gasto', monto, catId: 'aho' });

describe('el ahorro', () => {
  it('es lo guardado en la categoría Ahorro menos lo que se sacó', () => {
    const movs = [guardar('2026-07-05', 400000), guardar('2026-08-05', 600000),
      { id: 'x', fecha: '2026-08-06', tipo: 'gasto', monto: 99, catId: 'mer' },
      retiro(150000, '2026-08-20', 'Del ahorro')];
    expect(catAhorro(cats).id).toBe('aho');
    expect(catAhorro([{ id: 'a', n: 'AHORRO', tipo: 'ingreso' }])).toBeNull();
    expect(ahorroPorMes(movs, 'aho')).toEqual({ '2026-07': 400000, '2026-08': 600000 });
    expect(ahorroTotal(movs, 'aho')).toBe(850000);
  });

  it('el ritmo es el promedio de los tres meses cerrados', () => {
    expect(ritmoMensual({ '2026-06': 300000, '2026-07': 300000, '2026-08': 600000, '2026-09': 1 }, '2026-09')).toBe(400000);
  });
});

describe('metas', () => {
  it('llantas al 30 %: arranca con el 30 % de lo que tenías y suma el 30 % de cada mes', () => {
    const llantas = nuevaMeta({ n: 'Llantas', objetivo: 2000000, pct: 30, desde: '2026-09', inicial: inicialSugerido(1000000, 30) });
    expect(llantas.inicial).toBe(300000);
    const porMes = { '2026-08': 1000000, '2026-09': 500000, '2026-10': 500000 };
    expect(progresoMeta(llantas, porMes, '2026-09')).toBe(450000);
    expect(progresoMeta(llantas, porMes, '2026-10')).toBe(600000);
  });

  it('no se pasa del objetivo y una meta usada se queda con lo que tenía', () => {
    const m = nuevaMeta({ n: 'Viaje', objetivo: 100000, pct: 50, desde: '2026-01' });
    expect(progresoMeta(m, { '2026-01': 1000000 }, '2026-12')).toBe(100000);
    expect(progresoMeta({ ...m, usada: { monto: 80000 } }, { '2026-01': 1000000 }, '2026-12')).toBe(80000);
  });

  it('el total se sigue viendo entero y lo que no va a metas queda libre', () => {
    const movs = [guardar('2026-06-05', 1000000), guardar('2026-07-05', 1000000), guardar('2026-08-05', 1000000),
      guardar('2026-09-05', 1000000)];
    const metas = [nuevaMeta({ n: 'Llantas', objetivo: 2000000, pct: 30, desde: '2026-09', inicial: 900000 })];
    const e = estadoAhorro({ cats, movs, metas }, '2026-09');
    expect(e).toMatchObject({ total: 4000000, esteMes: 1000000, ritmo: 1000000, asignado: 1200000, libre: 2800000, pctUsado: 30 });
    // de lo libre, 700.000 entraron este mes: una meta nueva arranca con su parte de lo de antes
    expect(e.libreAntes).toBe(2100000);
    expect(e.metas[0]).toMatchObject({ llevado: 1200000, falta: 800000, pctAvance: 60, esteMes: 300000, meses: 3, llega: '2026-12', completa: false });
  });

  it('una meta usada sale del total y deja de contar como asignada', () => {
    const r = retiro(2000000, '2026-10-01', 'Del ahorro: Llantas', 'm1');
    const movs = [guardar('2026-09-05', 5000000), r];
    const metas = [{ ...nuevaMeta({ n: 'Llantas', objetivo: 2000000, pct: 30, desde: '2026-09' }), id: 'm1', usada: { fecha: '2026-10-01', monto: 2000000, movId: r.id } }];
    const e = estadoAhorro({ cats, movs, metas }, '2026-10');
    expect(e).toMatchObject({ total: 3000000, asignado: 0, libre: 3000000, pctUsado: 0 });
    expect(r).toMatchObject({ tipo: 'ingreso', retiro: true, metaId: 'm1', catId: 'otros-ingreso' });
  });

  it('sin metas, una nueva arranca con lo ahorrado antes de este mes', () => {
    const movs = [guardar('2026-08-05', 1000000), guardar('2026-09-05', 400000)];
    expect(estadoAhorro({ cats, movs, metas: [] }, '2026-09')).toMatchObject({ total: 1400000, libre: 1400000, libreAntes: 1000000 });
  });

  it('sin categoría Ahorro no hay estado', () => {
    expect(estadoAhorro({ cats: [], movs: [], metas: [] }, '2026-09')).toBeNull();
  });
});
