import { describe, it, expect } from 'vitest';
import { redondear100, sembrar, aprobar, desaprobar, normalizarStandby } from './standby.js';
import { categoriasBase } from './categorias.js';
import { resumenFlujo, delMes } from './movimientos.js';
import { fusionar } from './sync.js';
import { REPORTE_2026_11 as R } from '../data/reporte-2026-11.js';

const perfil = () => ({ cats: categoriasBase(), movs: [], standby: [], semillas: [] });
const suma = (filas, t, pred = () => true) => filas.filter((f) => f[2] === t && pred(f)).reduce((a, f) => a + f[3], 0);

describe('redondear al siguiente 100', () => {
  it('sube al siguiente 100 y deja quieto lo que ya es múltiplo', () => {
    expect(redondear100(26045.5)).toBe(26100);
    expect(redondear100(73908.71)).toBe(74000);
    expect(redondear100(278)).toBe(300);
    expect(redondear100(7900)).toBe(7900);
    expect(redondear100(5000)).toBe(5000);
    expect(redondear100(0)).toBe(0);
  });
});

describe('el reporte del banco', () => {
  it('trae todas las filas del PDF: 14 + 45 egresos y 6 ingresos', () => {
    const g = R.filas.filter((f) => f[2] === 'g');
    expect(g.filter((f) => f[0].startsWith('2026-11'))).toHaveLength(14);
    expect(g.filter((f) => f[0].startsWith('2026-10'))).toHaveLength(45);
    expect(R.filas.filter((f) => f[2] === 'i')).toHaveLength(6);
  });

  it('los ingresos suman lo que dice el reporte (el giro del exterior no trae monto)', () => {
    expect(suma(R.filas, 'i')).toBe(70000 + 392398);
    expect(R.filas.filter((f) => f[3] === 0)).toHaveLength(1);
  });

  it('todas las filas son válidas y tienen hora', () => {
    R.filas.forEach(([fecha, hora, t]) => {
      expect(fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(hora).toMatch(/^\d{2}:\d{2}$/);
      expect(['g', 'i']).toContain(t);
    });
  });
});

describe('sembrar', () => {
  it('deja todo en standby, redondeado, sin tocar los saldos', () => {
    const p = perfil();
    const creados = sembrar(p, R);
    expect(creados).toHaveLength(R.filas.length);
    expect(p.movs).toHaveLength(0);
    expect(creados.every((m) => m.monto % 100 === 0)).toBe(true);
    expect(resumenFlujo(p.movs, '2026-10')).toEqual({ ingresos: 0, gastos: 0, saldo: 0 });
    expect(normalizarStandby(p.standby)).toHaveLength(R.filas.length);
  });

  it('pone la categoría por nombre y cae en Otros si no existe', () => {
    const p = perfil();
    p.cats = p.cats.filter((c) => c.n !== 'Compras');
    const m = sembrar(p, R).find((x) => x.origen === 'www.gamivo.com');
    expect(m.catId).toBe('otros');
    expect(p.standby.find((x) => x.origen === 'RAPPI COLOMBIA*DL').catId)
      .toBe(p.cats.find((c) => c.n === 'Comida fuera').id);
  });

  it('solo una vez por perfil, aunque se descarte uno', () => {
    const p = perfil();
    sembrar(p, R);
    p.standby.shift();
    expect(sembrar(p, R)).toEqual([]);
    expect(p.standby).toHaveLength(R.filas.length - 1);
  });
});

describe('aprobar', () => {
  it('pasa a movimientos con su fecha y su hora, y se puede deshacer', () => {
    const p = perfil();
    sembrar(p, R);
    const id = p.standby.find((x) => x.origen === 'ANTHROPIC* CLAUDE SU').id;
    const r = aprobar(p, id);
    expect(r.mov).toMatchObject({ fecha: '2026-10-25', hora: '00:27', tipo: 'gasto', monto: 64400 });
    expect(r.mov.origen).toBeUndefined();
    expect(resumenFlujo(p.movs, '2026-10').gastos).toBe(64400);
    desaprobar(p, r);
    expect(p.movs).toHaveLength(0);
    expect(p.standby.map((x) => x.id)).toContain(id);
  });

  it('sin monto no se aprueba', () => {
    const p = perfil();
    sembrar(p, R);
    const giro = p.standby.find((x) => x.monto === 0);
    expect(aprobar(p, giro.id)).toBeNull();
    giro.monto = 150000;
    expect(aprobar(p, giro.id)).not.toBeNull();
  });

  it('la lista del mes ordena por hora dentro del día', () => {
    const p = perfil();
    sembrar(p, R);
    p.standby.forEach((x) => aprobar(p, x.id));
    const dia = delMes(p.movs, '2026-10').filter((m) => m.fecha === '2026-10-31').map((m) => m.hora);
    expect(dia).toEqual([...dia].sort().reverse());
  });
});

describe('fusionar con standby', () => {
  it('lo aprobado en una copia no vuelve a Por revisar desde la otra', () => {
    const a = { id: 'x', fecha: '2026-10-01', tipo: 'gasto', monto: 100, catId: 'otros', nota: '', origen: '' };
    const local = { movs: [{ ...a }], standby: [], semillas: ['s'] };
    const remoto = { movs: [], standby: [a, { ...a, id: 'y' }], semillas: [] };
    const f = fusionar(local, remoto);
    expect(f.standby.map((x) => x.id)).toEqual(['y']);
    expect(f.semillas).toEqual(['s']);
  });
});
