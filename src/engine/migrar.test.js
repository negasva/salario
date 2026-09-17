import { describe, it, expect } from 'vitest';
import { migrarPerfil, esViejo, recurrentesDesdeViejo, VERSION } from './migrar.js';
import { OTROS, OTROS_ING, clave } from './categorias.js';
import { saldoInicial } from './movimientos.js';

const viejo = {
  id: 'p1', name: 'Casa', inc: 5500000, cur: 'COP', saldos: { COP: 250000 },
  items: [
    { id: 'i1', n: 'Gastos recurrentes', m: 2000000, c: 'var(--ink)', r: 'ese', L: [
      { id: 'l1', n: 'Arriendo', v: 1200000, fixed: true },
      { id: 'l2', n: 'Internet', v: 90000, fixed: true },
      { id: 'l3', n: 'Mercado', v: 0, fixed: false },
    ] },
    { id: 'i2', n: 'Ahorro', m: 500000, c: '#1FA971', r: 'cor', L: [] },
  ],
  goals: [{ id: 'g1', n: 'Viaje', s: 0 }],
  recurrentes: [
    { id: 'r1', tipo: 'gasto', monto: 1200000, itemId: 'i1', lineId: 'l1', nota: 'Arriendo', dia: 5 },
    { id: 'r2', tipo: 'gasto', monto: 45000, itemId: 'i1', lineId: null, nota: 'Gimnasio', dia: 3 },
  ],
  movs: [
    { id: 'm1', fecha: '2026-08-02', tipo: 'ingreso', monto: 5500000, nota: 'Nómina' },
    { id: 'm2', fecha: '2026-08-04', tipo: 'ingreso', monto: 800000, extra: true, nota: 'Prima' },
    { id: 'm3', fecha: '2026-08-05', tipo: 'gasto', monto: 1200000, itemId: 'i1', lineId: 'l1', nota: '' },
    { id: 'm4', fecha: '2026-08-10', tipo: 'gasto', monto: 300000, goalId: 'g1', nota: 'Quincena' },
    { id: 'm5', fecha: '2026-08-12', tipo: 'gasto', monto: 45000, itemId: null, cat: 'restaurantes', nota: 'Almuerzo' },
    { id: 'm6', fecha: '2026-08-13', tipo: 'gasto', monto: 9000, itemId: 'borrada', cat: 'zzz', nota: '' },
  ],
};

const buscar = (p, nombre, tipo = 'gasto') => p.cats.find((c) => c.tipo === tipo && clave(c.n) === clave(nombre));

describe('migración desde el perfil viejo', () => {
  const p = migrarPerfil(viejo);

  it('reconoce lo viejo y lo nuevo', () => {
    expect(esViejo(viejo)).toBe(true);
    expect(esViejo(p)).toBe(false);
    expect(p.v).toBe(VERSION);
  });

  it('los conceptos vuelven como recurrentes, con su nombre y su precio', () => {
    const arriendo = p.recurrentes.find((r) => r.n === 'Arriendo');
    expect(arriendo).toMatchObject({ monto: 1200000, catId: 'i1', tipo: 'gasto', activo: true });
    expect(arriendo.dia).toBe(5); // el día del último pago registrado
    expect(p.recurrentes.find((r) => r.n === 'Internet')).toMatchObject({ monto: 90000, activo: true });
  });

  it('un concepto de gasto libre vuelve apagado: no tenía precio fijo', () => {
    expect(p.recurrentes.find((r) => r.n === 'Mercado')).toMatchObject({ monto: 0, activo: false });
  });

  it('las plantillas viejas entran, sin duplicar el concepto que ya estaba', () => {
    expect(p.recurrentes.filter((r) => r.n === 'Arriendo')).toHaveLength(1);
    expect(p.recurrentes.find((r) => r.n === 'Gimnasio')).toMatchObject({ monto: 45000, dia: 3 });
  });

  it('las categorías de presupuesto se quedan y se completan con las de fábrica', () => {
    expect(buscar(p, 'Gastos recurrentes').m).toBe(2000000);
    ['Mercado', 'Transporte', 'Comida fuera', 'Vivienda'].forEach((n) => expect(buscar(p, n)).toBeTruthy());
    ['Sueldo', 'Extras'].forEach((n) => expect(buscar(p, n, 'ingreso')).toBeTruthy());
    expect(p.cats.some((c) => c.id === OTROS)).toBe(true);
    expect(p.cats.some((c) => c.id === OTROS_ING)).toBe(true);
    expect(p.cats.every((c) => /^#/.test(c.c))).toBe(true); // var(--ink) no sirve en un svg
  });

  it('los ingresos quedan clasificados: nómina a Sueldo y la prima a Extras', () => {
    expect(p.movs.find((m) => m.id === 'm1').catId).toBe(buscar(p, 'Sueldo', 'ingreso').id);
    expect(p.movs.find((m) => m.id === 'm2').catId).toBe(buscar(p, 'Extras', 'ingreso').id);
  });

  it('los gastos conservan categoría, concepto en la nota y el vínculo al recurrente', () => {
    const m3 = p.movs.find((m) => m.id === 'm3');
    expect(m3).toMatchObject({ catId: 'i1', nota: 'Arriendo', recId: 'l1' });
    expect(p.movs.find((m) => m.id === 'm4')).toMatchObject({ catId: 'i2', nota: 'Aporte a Viaje · Quincena' });
    expect(p.movs.find((m) => m.id === 'm5').catId).toBe(buscar(p, 'Comida fuera').id);
    expect(p.movs.find((m) => m.id === 'm6').catId).toBe(OTROS);
  });

  it('el saldo no se mueve', () => {
    expect(p.saldoInicial).toBe(250000);
    expect(saldoInicial(p.saldoInicial, p.movs, '2026-09'))
      .toBe(250000 + 5500000 + 800000 - 1200000 - 300000 - 45000 - 9000);
  });
});

describe('rescate de un perfil que ya pasó por la primera migración', () => {
  it('un perfil v9 gana categorías de ingreso y un hueco para recurrentes', () => {
    const v9 = {
      v: 9, name: 'Casa', saldoInicial: 0,
      cats: [{ id: 'i1', n: 'Gastos recurrentes', m: 2000000, c: '#111' }, { id: OTROS, n: 'Otros', m: 0, c: '#222' }],
      movs: [
        { id: 'm1', fecha: '2026-08-02', tipo: 'ingreso', monto: 5500000, catId: null, nota: 'Nómina' },
        { id: 'm2', fecha: '2026-08-03', tipo: 'ingreso', monto: 100000, catId: null, nota: 'Vendí la bici' },
        { id: 'm3', fecha: '2026-08-05', tipo: 'gasto', monto: 10000, catId: 'i1', nota: '' },
      ],
    };
    const p = migrarPerfil(v9);
    expect(p.v).toBe(VERSION);
    expect(p.recurrentes).toEqual([]);
    expect(buscar(p, 'Mercado')).toBeTruthy();
    expect(p.movs.find((m) => m.id === 'm1').catId).toBe(buscar(p, 'Sueldo', 'ingreso').id);
    expect(p.movs.find((m) => m.id === 'm2').catId).toBe(OTROS_ING);
    expect(p.movs.find((m) => m.id === 'm3').catId).toBe('i1');
    expect(p.cats.find((c) => c.id === 'i1').tipo).toBe('gasto');
  });

  it('los recurrentes se sacan del blob viejo aunque el perfil ya esté migrado', () => {
    const rec = recurrentesDesdeViejo(viejo);
    expect(rec.map((r) => r.n)).toEqual(['Arriendo', 'Internet', 'Mercado', 'Gimnasio']);
    expect(rec.find((r) => r.n === 'Internet').monto).toBe(90000);
  });

  it('un perfil vacío migra a un perfil vacío', () => {
    const v = migrarPerfil({});
    expect(v.movs).toEqual([]);
    expect(v.recurrentes).toEqual([]);
    expect(v.saldoInicial).toBe(0);
    expect(buscar(v, 'Transporte')).toBeTruthy();
  });
});
