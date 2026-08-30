import { describe, it, expect } from 'vitest';
import { destinosDeReparto, normalizarReparto, movimientosDeReparto } from './repartoSaldo.js';

const perfil = () => ({
  items: [
    { id: 'i1', n: 'Recurrentes', L: [
      { id: 'l1', n: 'Arriendo', v: 1000000, fixed: true },
      { id: 'l2', n: 'Servicios', v: 200000, fixed: true },
    ] },
    { id: 'i2', n: 'Gasto libre', libre: true, L: [] },
  ],
  goals: [
    { id: 'g1', n: 'Moto', t: 5000000, s: 1000000 },
    { id: 'g2', n: 'Viaje', t: 1000000, s: 1000000 }, // ya llena
    { id: 'g3', n: 'Vieja', t: 100, s: 0, estado: 'completa' },
  ],
  movs: [
    { id: 'm1', fecha: '2026-08-02', tipo: 'gasto', monto: 600000, itemId: 'i1', lineId: 'l1' },
  ],
});

describe('destinosDeReparto', () => {
  const d = destinosDeReparto(perfil(), '2026-08');

  it('trae deudas, gasto libre y metas, en ese orden', () => {
    expect(d.map((x) => x.tipo)).toEqual(['deuda', 'deuda', 'libre', 'meta']);
  });

  it('agrupa por clase de destino, no por categoría', () => {
    expect([...new Set(d.map((x) => x.grupo))])
      .toEqual(['Pagar deuda', 'Gasto libre', 'Metas de ahorro']);
    // de qué categoría sale el concepto va al lado del nombre
    expect(d[0].de).toBe('Recurrentes');
  });

  it('la deuda es lo que le falta al concepto para llegar al plan', () => {
    expect(d[0]).toMatchObject({ nombre: 'Arriendo', lineId: 'l1', tope: 400000 });
    expect(d[1]).toMatchObject({ nombre: 'Servicios', tope: 200000 });
  });

  it('el gasto libre no tiene tope: no tiene plan contra el cual tenerlo', () => {
    expect(d[2]).toMatchObject({ tipo: 'libre', itemId: 'i2', tope: null });
  });

  it('la meta llena y la completa no aparecen', () => {
    expect(d.filter((x) => x.tipo === 'meta').map((x) => x.nombre)).toEqual(['Moto']);
    expect(d.find((x) => x.nombre === 'Moto').tope).toBe(4000000);
  });

  it('un concepto ya pagado no es un destino', () => {
    const p = perfil();
    p.movs.push({ id: 'm2', fecha: '2026-08-03', tipo: 'gasto', monto: 400000, itemId: 'i1', lineId: 'l1' });
    expect(destinosDeReparto(p, '2026-08').some((x) => x.lineId === 'l1')).toBe(false);
  });
});

describe('normalizarReparto', () => {
  const d = destinosDeReparto(perfil(), '2026-08');

  it('reparte lo pedido cuando cabe', () => {
    const r = normalizarReparto(d, { 'l:l1': 400000, 'g:g1': 100000 }, 734000);
    expect(r.total).toBe(500000);
    expect(r.restante).toBe(234000);
  });

  it('recorta al tope de cada destino', () => {
    const r = normalizarReparto(d, { 'l:l1': 999999999 }, 734000);
    expect(r.filas[0].monto).toBe(400000); // no mas de lo que debe
  });

  it('no reparte mas de lo disponible aunque cada fila quepa', () => {
    const r = normalizarReparto(d, { 'l:l1': 400000, 'l:l2': 200000, 'g:g1': 500000 }, 500000);
    expect(r.total).toBe(500000);
    expect(r.restante).toBe(0);
  });

  it('sin saldo no reparte nada', () => {
    expect(normalizarReparto(d, { 'l:l1': 100000 }, 0).total).toBe(0);
    expect(normalizarReparto(d, { 'l:l1': 100000 }, -50).total).toBe(0);
  });

  it('descarta ceros, negativos y basura', () => {
    const r = normalizarReparto(d, { 'l:l1': 0, 'l:l2': -100, 'g:g1': 'x' }, 734000);
    expect(r.filas).toEqual([]);
    expect(r.total).toBe(0);
  });
});

describe('movimientosDeReparto', () => {
  const d = destinosDeReparto(perfil(), '2026-08');
  const { filas } = normalizarReparto(d, { 'l:l1': 400000, 'i:i2': 50000, 'g:g1': 100000 }, 734000);
  const movs = movimientosDeReparto(filas, '2026-08-30');

  it('cada destino genera el movimiento que le toca', () => {
    expect(movs).toHaveLength(3);
    expect(movs[0]).toMatchObject({ itemId: 'i1', lineId: 'l1', goalId: null, monto: 400000 });
    expect(movs[1]).toMatchObject({ itemId: 'i2', lineId: null, goalId: null, monto: 50000 });
    expect(movs[2]).toMatchObject({ itemId: null, lineId: null, goalId: 'g1', monto: 100000 });
  });

  it('son gastos normales con fecha y nombre, no una estructura aparte', () => {
    movs.forEach((m) => {
      expect(m.tipo).toBe('gasto');
      expect(m.fecha).toBe('2026-08-30');
      expect(m.id).toBeTruthy();
    });
    expect(movs[0].nota).toContain('Arriendo');
  });

  it('no repite ids', () => {
    expect(new Set(movs.map((m) => m.id)).size).toBe(3);
  });
});
