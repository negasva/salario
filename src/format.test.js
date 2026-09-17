import { describe, it, expect } from 'vitest';
import { digits, money, moneySigno, fechaCorta, nombreMes } from './format.js';

describe('digits', () => {
  it('lee montos con separador de miles', () => {
    expect(digits('5.500.000')).toBe(5500000);
    expect(digits('5,500,000')).toBe(5500000);
    expect(digits('$ 1.800.000')).toBe(1800000);
  });

  it('respeta los decimales', () => {
    expect(digits('85,000.50')).toBe(85000.5);
    expect(digits('85.000,50')).toBe(85000.5);
    expect(digits('12,5')).toBe(12.5);
  });

  it('tres cifras tras el separador son miles, no decimales', () => {
    expect(digits('1,500')).toBe(1500);
    expect(digits('1.500')).toBe(1500);
  });

  it('respeta el signo menos, para el saldo inicial', () => {
    expect(digits('-100.000')).toBe(-100000);
    expect(digits('−100.000')).toBe(-100000);
  });

  it('lo que no es número da cero', () => {
    expect(digits('')).toBe(0);
    expect(digits('abc')).toBe(0);
  });
});

describe('money', () => {
  it('siempre en pesos y sin decimales', () => {
    expect(money(1479418)).toBe(money(1479418.4));
    expect(money(0)).toMatch(/0/);
  });

  it('moneySigno lleva el signo explícito', () => {
    expect(moneySigno(-100000).startsWith('−')).toBe(true);
    expect(moneySigno(900000).startsWith('+')).toBe(true);
    expect(moneySigno(0).startsWith('+')).toBe(false);
  });
});

describe('fechas', () => {
  it('fechaCorta escribe el mes en tres letras y sin punto', () => {
    expect(fechaCorta('2026-08-08')).toBe('8 ago');
    expect(fechaCorta('2026-12-31')).toBe('31 dic');
    expect(fechaCorta('mañana')).toBe('mañana');
  });

  it('nombreMes escribe el mes completo', () => {
    expect(nombreMes('2026-09')).toBe('septiembre de 2026');
  });
});
