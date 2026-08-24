import { describe, it, expect } from 'vitest';
import {
  mesesParaLiquidar, interesTotal, ordenar, plan, minimosCubiertos, deudasDelPerfil,
} from './deudas.js';

describe('amortización de una deuda', () => {
  it('sin intereses es una división', () => {
    expect(mesesParaLiquidar(1000000, 0, 250000)).toBe(4);
    expect(interesTotal(1000000, 0, 250000)).toBe(0);
  });

  it('con intereses tarda más y cobra de más', () => {
    // 5.000.000 al 24% anual (2% mensual), cuota de 300.000
    expect(mesesParaLiquidar(5000000, 24, 300000)).toBe(21);
    expect(interesTotal(5000000, 24, 300000)).toBeGreaterThan(1000000);
  });

  it('una cuota que no cubre ni los intereses nunca la paga', () => {
    // 2% mensual sobre 5.000.000 son 100.000 de puro interés
    expect(mesesParaLiquidar(5000000, 24, 100000)).toBe(null);
    expect(mesesParaLiquidar(5000000, 24, 99000)).toBe(null);
    expect(interesTotal(5000000, 24, 100000)).toBe(null);
  });

  it('una cuota de cero o un saldo de cero no rompen', () => {
    expect(mesesParaLiquidar(5000000, 24, 0)).toBe(null);
    expect(mesesParaLiquidar(0, 24, 300000)).toBe(0);
  });
});

const DEUDAS = [
  { id: 'd1', n: 'Tarjeta', saldo: 3000000, tasa: 32, minimo: 150000 },
  { id: 'd2', n: 'Consumo', saldo: 8000000, tasa: 18, minimo: 300000 },
  { id: 'd3', n: 'Celular', saldo: 900000, tasa: 0, minimo: 90000 },
];

describe('orden de ataque', () => {
  it('avalancha: mayor tasa primero', () => {
    expect(ordenar(DEUDAS, 'avalancha').map((d) => d.id)).toEqual(['d1', 'd2', 'd3']);
  });
  it('bola de nieve: menor saldo primero', () => {
    expect(ordenar(DEUDAS, 'bolaDeNieve').map((d) => d.id)).toEqual(['d3', 'd1', 'd2']);
  });
  it('no muta el arreglo que recibe', () => {
    const copia = [...DEUDAS];
    ordenar(DEUDAS, 'bolaDeNieve');
    expect(DEUDAS).toEqual(copia);
  });
});

describe('mínimos cubiertos', () => {
  it('el peldaño 1 de la escalera', () => {
    expect(minimosCubiertos(DEUDAS, 540000)).toBe(true);
    expect(minimosCubiertos(DEUDAS, 539000)).toBe(false);
    expect(minimosCubiertos([], 0)).toBe(true);
  });
});

describe('plan de pago', () => {
  it('sin deudas no hay nada que hacer', () => {
    expect(plan([], 500000)).toMatchObject({ meses: 0, interes: 0, cubreMinimos: true });
  });

  it('si el presupuesto no cubre los mínimos lo dice', () => {
    expect(plan(DEUDAS, 400000)).toMatchObject({ cubreMinimos: false, meses: null });
  });

  it('la avalancha cuesta menos intereses que la bola de nieve', () => {
    const av = plan(DEUDAS, 900000, 'avalancha');
    const bn = plan(DEUDAS, 900000, 'bolaDeNieve');
    expect(av.interes).toBeLessThan(bn.interes);
    expect(av.meses).toBeGreaterThan(0);
    expect(av.fecha).toMatch(/ de \d{4}$/);
  });

  it('cada deuda trae su mes de liquidación, y la más atacada cae primero', () => {
    const av = plan(DEUDAS, 900000, 'avalancha');
    const tarjeta = av.deudas.find((d) => d.id === 'd1');
    const consumo = av.deudas.find((d) => d.id === 'd2');
    expect(tarjeta.meses).toBeLessThan(consumo.meses);
    expect(av.meses).toBe(Math.max(...av.deudas.map((d) => d.meses)));
  });

  it('la bola de nieve libera primero la deuda chica', () => {
    const bn = plan(DEUDAS, 900000, 'bolaDeNieve');
    expect(bn.deudas.find((d) => d.id === 'd3').meses)
      .toBeLessThanOrEqual(bn.deudas.find((d) => d.id === 'd1').meses);
  });

  it('mínimos que solo cubren intereses no liquidan nunca', () => {
    const eterna = [{ id: 'x', n: 'Tarjeta', saldo: 5000000, tasa: 24, minimo: 100000 }];
    expect(plan(eterna, 100000).meses).toBe(null);
  });
});

describe('deudas del perfil', () => {
  it('saca los renglones con saldo de los bloques de deuda', () => {
    const items = [
      { r: 'ese', L: [{ id: 'l0', n: 'Arriendo', saldo: 999 }] },
      { r: 'deu', L: [{ id: 'l1', n: 'Tarjeta', saldo: 3000000, tasa: 32, minimo: 150000 },
        { id: 'l2', n: 'Sin saldo' }] },
    ];
    expect(deudasDelPerfil(items)).toEqual([
      { id: 'l1', n: 'Tarjeta', saldo: 3000000, tasa: 32, minimo: 150000 },
    ]);
  });
});
