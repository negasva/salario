import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convertir, vigente, tasa, TTL } from './moneda.js';

beforeEach(() => {
  const mem = {};
  vi.stubGlobal('localStorage', {
    getItem: (k) => mem[k] ?? null,
    setItem: (k, v) => { mem[k] = String(v); },
  });
});

describe('convertir', () => {
  it('multiplica por la tasa', () => {
    expect(convertir(10, 4000)).toBe(40000);
    expect(convertir(null, 4000)).toBe(0);
    expect(convertir(10, null)).toBe(0);
  });
});

describe('vigente', () => {
  it('vale mientras no pasen 12 horas', () => {
    expect(vigente({ v: 1, t: 1000 }, 1000 + TTL - 1)).toBe(true);
    expect(vigente({ v: 1, t: 1000 }, 1000 + TTL)).toBe(false);
    expect(vigente(undefined, 0)).toBe(false);
  });
});

describe('tasa', () => {
  it('la misma moneda no consulta la red', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await tasa('COP', 'COP')).toBe(1);
    expect(f).not.toHaveBeenCalled();
  });

  it('consulta, cachea y no vuelve a pedir dentro del TTL', async () => {
    const f = vi.fn(async () => ({ json: async () => ({ rates: { COP: 4100 } }) }));
    vi.stubGlobal('fetch', f);
    expect(await tasa('USD', 'COP', 1000)).toBe(4100);
    expect(await tasa('USD', 'COP', 1000 + TTL - 1)).toBe(4100);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('si la red falla cae a la última tasa conocida', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ rates: { COP: 4100 } }) })));
    await tasa('USD', 'COP', 1000);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await tasa('USD', 'COP', 1000 + TTL + 1)).toBe(4100);
  });

  it('sin tasa conocida y sin red devuelve null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await tasa('EUR', 'COP', 1000)).toBe(null);
  });
});
