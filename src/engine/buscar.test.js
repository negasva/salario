import { describe, it, expect } from 'vitest';
import { buscar, totalDeMovimientos } from './buscar.js';
import { quitarMovsDe, sinHuerfanos } from './pagos.js';

const p = {
  items: [{ id: 'ese', n: 'Esenciales', p: 55, L: [{ id: 'l1', n: 'Mercado' }] }],
  goals: [{ id: 'g1', n: 'Moto' }],
  movs: [
    { id: 'm1', fecha: '2026-08-02', tipo: 'gasto', monto: 40000, itemId: 'ese', nota: 'Rappi del domingo', cat: 'comida-fuera' },
    { id: 'm2', fecha: '2026-07-11', tipo: 'gasto', monto: 60000, itemId: 'ese', nota: 'rappi otra vez' },
    { id: 'm3', fecha: '2026-07-12', tipo: 'gasto', monto: 90000, itemId: 'ese', nota: 'Peluquería' },
  ],
};

describe('buscador', () => {
  it('encuentra movimientos por nota, sin importar tildes ni mayúsculas', () => {
    const r = buscar(p, 'RAPPI');
    expect(r.filter((x) => x.tipo === 'movimiento').map((x) => x.id)).toEqual(['m1', 'm2']);
  });

  it('encuentra metas, bloques y renglones', () => {
    expect(buscar(p, 'moto')[0]).toMatchObject({ tipo: 'meta', ruta: 'metas' });
    expect(buscar(p, 'esencial')[0]).toMatchObject({ tipo: 'categoria' });
    expect(buscar(p, 'mercado')[0]).toMatchObject({ tipo: 'renglon', ruta: 'movimientos' });
  });

  it('busca también por categoría de gasto', () => {
    expect(buscar(p, 'comida preparada').map((x) => x.id)).toContain('m1');
  });

  it('con menos de dos letras no busca', () => {
    expect(buscar(p, 'r')).toEqual([]);
  });

  it('suma lo encontrado', () => {
    expect(totalDeMovimientos(buscar(p, 'rappi'))).toBe(100000);
  });

  /* Bug F9: borrar un renglón dejaba sus pagos sueltos en el libro, así que al
     volver a crearlo con el mismo nombre el buscador mostraba las dos tandas. */
  it('borrar y recrear un renglón deja un solo resultado', () => {
    const q = { items: [{ id: 'i1', n: 'Casa', L: [{ id: 'l1', n: 'Finca Cadavid' }] }], goals: [], movs: [] };
    q.movs.push({ id: 'm1', fecha: '2026-08-23', tipo: 'gasto', monto: 135000, itemId: 'i1', lineId: 'l1', nota: 'Pago Finca Cadavid' });

    // se borra el renglón: sus pagos se van con él
    q.items[0].L = [];
    quitarMovsDe(q.movs, 'lineId', 'l1');

    // y se vuelve a crear con el mismo nombre
    q.items[0].L.push({ id: 'l2', n: 'Finca Cadavid' });
    q.movs.push({ id: 'm2', fecha: '2026-08-26', tipo: 'gasto', monto: 135000, itemId: 'i1', lineId: 'l2', nota: 'Pago Finca Cadavid' });

    const res = buscar(q, 'cadavid');
    const movs = res.filter((r) => r.tipo === 'movimiento');
    expect(movs).toHaveLength(1);
    expect(totalDeMovimientos(res)).toBe(135000);
  });

  it('los pagos huérfanos de perfiles viejos se limpian al cargar', () => {
    const items = [{ id: 'i1', n: 'Casa', L: [{ id: 'l2', n: 'Finca Cadavid' }] }];
    const movs = [
      { id: 'm1', fecha: '2026-08-23', monto: 1, itemId: 'i1', lineId: 'l1' },
      { id: 'm2', fecha: '2026-08-26', monto: 1, itemId: 'i1', lineId: 'l2' },
      { id: 'm3', fecha: '2026-08-26', monto: 1, itemId: 'borrada', lineId: null },
      { id: 'm4', fecha: '2026-08-26', monto: 1, itemId: null, lineId: null, goalId: 'g1' },
    ];
    expect(sinHuerfanos(movs, items).map((m) => m.id)).toEqual(['m2', 'm4']);
  });
});
