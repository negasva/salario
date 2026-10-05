import { describe, it, expect } from 'vitest';
import {
  catAhorro, idsAhorro, ahorroPorMes, ahorroTotal, nuevaMeta, progresoMeta, ritmoMensual, estadoAhorro,
  inicialSugerido, retiro, normalizarSobrante, barrerSobrante,
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

describe('Ahorro y Ahorros', () => {
  const cats = [
    { id: 'aho', n: 'Ahorro', tipo: 'gasto' },
    { id: 'ahos', n: 'Ahorros', tipo: 'gasto' },
    { id: 'x', n: 'Mercado', tipo: 'gasto' },
  ];
  const movs = [
    { id: 1, tipo: 'gasto', catId: 'ahos', monto: 500000, fecha: '2026-10-03' },
    { id: 2, tipo: 'gasto', catId: 'aho', monto: 100000, fecha: '2026-10-04' },
    { id: 3, tipo: 'gasto', catId: 'x', monto: 70000, fecha: '2026-10-05' },
  ];
  it('suma lo guardado en las dos categorías', () => {
    expect(catAhorro(cats).id).toBe('aho');
    expect(idsAhorro(cats)).toEqual(['aho', 'ahos']);
    expect(ahorroTotal(movs, idsAhorro(cats))).toBe(600000);
    expect(estadoAhorro({ cats, movs, metas: [] }, '2026-10').total).toBe(600000);
  });
  it('con solo Ahorros también cuenta', () => {
    const solo = [cats[1]];
    expect(catAhorro(solo).id).toBe('ahos');
    expect(estadoAhorro({ cats: solo, movs, metas: [] }, '2026-10').total).toBe(500000);
  });
});

describe('sobrante del mes', () => {
  const base = () => {
    const p = {
      saldoInicial: 0, arranques: {}, cats: [{ id: 'aho', n: 'Ahorro', tipo: 'gasto' }],
      movs: [
        { id: 'a', fecha: '2026-09-05', tipo: 'ingreso', monto: 1000, catId: 'x', nota: '' },
        { id: 'b', fecha: '2026-09-10', tipo: 'gasto', monto: 300, catId: 'y', nota: '' },
      ],
      sobrante: normalizarSobrante({ activo: true, desde: '2026-09' }),
    };
    return p;
  };

  it('pasa el sobrante a Ahorro el último día, una sola vez', () => {
    const p = base();
    expect(barrerSobrante(p, '2026-09-29')).toEqual([]);
    const [m] = barrerSobrante(p, '2026-09-30');
    expect(m).toMatchObject({ fecha: '2026-09-30', tipo: 'gasto', monto: 700, catId: 'aho', sobrante: true });
    expect(barrerSobrante(p, '2026-10-02')).toEqual([]);
    expect(p.movs.filter((x) => x.sobrante)).toHaveLength(1);
  });

  it('un sobrante borrado a mano no vuelve y el mes siguiente arranca en cero', () => {
    const p = base();
    const [m] = barrerSobrante(p, '2026-10-02');
    p.movs.splice(p.movs.indexOf(m), 1);
    expect(barrerSobrante(p, '2026-10-03')).toEqual([]);
  });

  it('no toca nada si está apagado, no sobra o es antes de activarlo', () => {
    const p = base();
    p.sobrante.activo = false;
    expect(barrerSobrante(p, '2026-10-05')).toEqual([]);
    const q = base();
    q.sobrante.desde = '2026-10';
    expect(barrerSobrante(q, '2026-10-05')).toEqual([]);
    const r = base();
    r.movs.push({ id: 'c', fecha: '2026-09-20', tipo: 'gasto', monto: 900, catId: 'y', nota: '' });
    expect(barrerSobrante(r, '2026-10-05')).toEqual([]);
  });
});
