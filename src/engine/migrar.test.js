import { describe, it, expect } from 'vitest';
import { migrarPerfil, esViejo, VERSION } from './migrar.js';
import { OTROS } from './categorias.js';
import { saldoInicial } from './movimientos.js';

const viejo = {
  id: 'p1', name: 'Casa', inc: 5500000, cur: 'COP', saldos: { COP: 250000 },
  items: [
    { id: 'i1', n: 'Gastos recurrentes', m: 2000000, c: 'var(--ink)', r: 'ese', L: [{ id: 'l1', n: 'Arriendo' }] },
    { id: 'i2', n: 'Ahorro', m: 500000, c: '#1FA971', r: 'cor', L: [] },
  ],
  goals: [{ id: 'g1', n: 'Viaje', s: 0 }],
  movs: [
    { id: 'm1', fecha: '2026-08-02', tipo: 'ingreso', monto: 5500000, nota: 'Nómina' },
    { id: 'm2', fecha: '2026-08-05', tipo: 'gasto', monto: 1200000, itemId: 'i1', lineId: 'l1', nota: '' },
    { id: 'm3', fecha: '2026-08-10', tipo: 'gasto', monto: 300000, goalId: 'g1', nota: 'Quincena' },
    { id: 'm4', fecha: '2026-08-12', tipo: 'gasto', monto: 45000, itemId: null, cat: 'restaurantes', nota: 'Almuerzo' },
    { id: 'm5', fecha: '2026-08-13', tipo: 'gasto', monto: 9000, itemId: 'borrada', cat: 'zzz', nota: '' },
  ],
};

describe('migración del perfil viejo', () => {
  const p = migrarPerfil(viejo);

  it('reconoce lo viejo y lo nuevo', () => {
    expect(esViejo(viejo)).toBe(true);
    expect(esViejo(p)).toBe(false);
    expect(p.v).toBe(VERSION);
  });

  it('las categorías de presupuesto pasan tal cual, con Otros al final', () => {
    const nombres = p.cats.map((c) => c.n);
    expect(nombres.slice(0, 2)).toEqual(['Gastos recurrentes', 'Ahorro']);
    expect(p.cats[p.cats.length - 1].id).toBe(OTROS);
    expect(p.cats[0].m).toBe(2000000);
    expect(p.cats[0].c).toMatch(/^#/); // el alias var(--ink) no sirve en un svg
    expect(p.cats[1].c).toBe('#1FA971');
  });

  it('el concepto va delante de la nota, el aporte a meta cae en Ahorro', () => {
    const m2 = p.movs.find((m) => m.id === 'm2');
    expect(m2.catId).toBe('i1');
    expect(m2.nota).toBe('Arriendo');
    const m3 = p.movs.find((m) => m.id === 'm3');
    expect(m3.catId).toBe('i2');
    expect(m3.nota).toBe('Aporte a Viaje · Quincena');
  });

  it('un gasto sin categoría se ubica por su tipo automático o en Otros', () => {
    const m4 = p.movs.find((m) => m.id === 'm4');
    expect(p.cats.find((c) => c.id === m4.catId).n).toBe('Restaurantes');
    expect(p.movs.find((m) => m.id === 'm5').catId).toBe(OTROS);
  });

  it('los ingresos no llevan categoría y el saldo base es el saldo inicial', () => {
    expect(p.movs.find((m) => m.id === 'm1')).toMatchObject({ tipo: 'ingreso', catId: null, nota: 'Nómina' });
    expect(p.saldoInicial).toBe(250000);
    expect(saldoInicial(p.saldoInicial, p.movs, '2026-09')).toBe(250000 + 5500000 - 1200000 - 300000 - 45000 - 9000);
  });

  it('un perfil vacío migra a un perfil vacío', () => {
    const v = migrarPerfil({});
    expect(v.cats.map((c) => c.id)).toEqual([OTROS]);
    expect(v.movs).toEqual([]);
    expect(v.saldoInicial).toBe(0);
  });
});
