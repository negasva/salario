import { describe, it, expect } from 'vitest';
import { digits, money, redondeoVista, fechaCorta } from './format.js';

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

  it('lo que no es número da cero', () => {
    expect(digits('')).toBe(0);
    expect(digits('abc')).toBe(0);
  });
});

describe('redondeo a la centena en pesos', () => {
  it('en COP la vista redondea a la centena más cercana', () => {
    expect(redondeoVista(1479418, 'COP')).toBe(1479400);
    expect(redondeoVista(2475434, 'COP')).toBe(2475400);
    expect(redondeoVista(996016, 'COP')).toBe(996000);
    expect(money(1479418, 'COP')).toBe(money(1479400, 'COP'));
  });

  it('los montos chicos y las monedas con decimales quedan intactos', () => {
    expect(redondeoVista(950, 'COP')).toBe(950);
    expect(redondeoVista(12.34, 'USD')).toBe(12.34);
    expect(money(3108, 'COP', true)).toBe(money(3108, 'COP', true));
    expect(money(3108, 'COP', true)).not.toBe(money(3108, 'COP'));
  });
});

describe('fechaCorta', () => {
  it('escribe el mes en tres letras y sin punto', () => {
    expect(fechaCorta('2026-08-08')).toBe('8 ago');
    expect(fechaCorta('2026-08-23')).toBe('23 ago');
    expect(fechaCorta('2026-01-01')).toBe('1 ene');
    expect(fechaCorta('2026-12-31')).toBe('31 dic');
  });

  it('una fecha que no entiende la devuelve tal cual', () => {
    expect(fechaCorta('')).toBe('');
    expect(fechaCorta('mañana')).toBe('mañana');
  });
});
