import { describe, it, expect } from 'vitest';
import { digits } from './format.js';

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
