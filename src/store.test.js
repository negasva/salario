import { describe, it, expect, beforeEach, vi } from 'vitest';

/* El store habla con Supabase y con el navegador. Aquí los dos son de mentira:
   lo que se prueba es que al abrir la app aparezca lo que había guardado. */

vi.mock('./auth.js', () => ({ supabase: { from: () => ({}) } }));

function falsoLocalStorage(inicial = {}) {
  const datos = { ...inicial };
  return {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v); },
    removeItem: (k) => { delete datos[k]; },
    _datos: datos,
  };
}

const V8 = {
  active: 'p1',
  profiles: [{
    id: 'p1', name: 'Casa', cur: 'COP', saldos: { COP: 120000 },
    items: [
      { id: 'i1', n: 'Gastos recurrentes', m: 2000000, c: '#111', L: [
        { id: 'l1', n: 'Arriendo', v: 1200000, fixed: true },
        { id: 'l2', n: 'Internet', v: 90000, fixed: true },
      ] },
    ],
    goals: [],
    recurrentes: [{ id: 'r1', tipo: 'gasto', monto: 45000, itemId: 'i1', nota: 'Gimnasio', dia: 3 }],
    movs: [{ id: 'm1', fecha: '2026-08-02', tipo: 'ingreso', monto: 1000000, nota: 'Nómina' }],
  }],
};

// el perfil tal como lo dejó la primera migración: sin conceptos ni recurrentes
const V9 = {
  v: 9, name: 'Casa', saldoInicial: 120000,
  cats: [{ id: 'i1', n: 'Gastos recurrentes', m: 2000000, c: '#111' }, { id: 'otros', n: 'Otros', m: 0, c: '#222' }],
  movs: [{ id: 'm1', fecha: '2026-08-02', tipo: 'ingreso', monto: 1000000, catId: null, nota: 'Nómina' }],
};

let store;

async function cargarCon(claves) {
  vi.stubGlobal('localStorage', falsoLocalStorage(claves));
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.resetModules();
  store = await import('./store.js');
  store.load();
  return store.active();
}

beforeEach(() => { vi.unstubAllGlobals(); });

describe('abrir la app con datos guardados', () => {
  it('desde el perfil viejo: vuelven los recurrentes con su precio', async () => {
    const p = await cargarCon({ 'reparto:v8': JSON.stringify(V8) });
    expect(p.recurrentes.map((r) => [r.n, r.monto])).toEqual([
      ['Arriendo', 1200000], ['Internet', 90000], ['Gimnasio', 45000],
    ]);
    expect(p.saldoInicial).toBe(120000);
    expect(p.movs).toHaveLength(1);
  });

  it('desde un perfil ya migrado, los recurrentes se rescatan del blob viejo', async () => {
    const p = await cargarCon({
      'reparto:v9': JSON.stringify(V9),
      'reparto:v8': JSON.stringify(V8),
    });
    expect(p.recurrentes.map((r) => r.n)).toEqual(['Arriendo', 'Internet', 'Gimnasio']);
    // los que apuntaban a una categoría que sigue existiendo la conservan
    expect(p.recurrentes[0].catId).toBe('i1');
    expect(p.movs).toHaveLength(1);
    expect(p.cats.some((c) => c.n === 'Mercado')).toBe(true);
    expect(p.cats.some((c) => c.tipo === 'ingreso')).toBe(true);
  });

  it('el rescate no se repite ni pisa lo que el usuario ya tenga', async () => {
    const yaMigrado = { ...V9, v: 11, recurrentes: [{ id: 'x', n: 'Solo este', monto: 1, catId: 'otros', tipo: 'gasto', dia: 1 }] };
    const p = await cargarCon({
      'reparto:v11': JSON.stringify(yaMigrado),
      'reparto:v8': JSON.stringify(V8),
    });
    expect(p.recurrentes.map((r) => r.n)).toEqual(['Solo este']);
  });

  it('un perfil v10 se abre sin la marca de apagado y con los arranques listos', async () => {
    const v10 = { ...V9, v: 10, arranques: { '2026-09': 0 },
      recurrentes: [{ id: 'r1', n: 'Luz', monto: 90000, catId: 'otros', tipo: 'gasto', dia: 5, activo: false }] };
    const p = await cargarCon({ 'reparto:v10': JSON.stringify(v10) });
    expect(p.v).toBe(11);
    expect('activo' in p.recurrentes[0]).toBe(false);
    expect(p.arranques).toEqual({ '2026-09': 0 });
  });

  it('sin nada guardado arranca en blanco, con las categorías de fábrica', async () => {
    const p = await cargarCon({});
    expect(p.movs).toEqual([]);
    expect(p.recurrentes).toEqual([]);
    expect(p.cats.some((c) => c.n === 'Mercado')).toBe(true);
    expect(p.cats.some((c) => c.n === 'Sueldo')).toBe(true);
  });

  it('una caché corrupta no tumba la app', async () => {
    const p = await cargarCon({ 'reparto:v11': '{roto', 'reparto:v8': JSON.stringify(V8) });
    expect(p.recurrentes.map((r) => r.n)).toContain('Arriendo');
  });
});

describe('guardar', () => {
  it('escribe en la caché lo que se acaba de cambiar', async () => {
    const p = await cargarCon({ 'reparto:v8': JSON.stringify(V8) });
    p.recurrentes.push({ id: 'z', n: 'Netflix', monto: 26900, catId: 'otros', tipo: 'gasto', dia: 8 });
    store.save();
    const guardado = JSON.parse(localStorage.getItem('reparto:v11'));
    expect(guardado.recurrentes.map((r) => r.n)).toContain('Netflix');
    expect(guardado.v).toBe(11);
  });

  it('guarda el mes que se empezó de nuevo', async () => {
    const p = await cargarCon({ 'reparto:v8': JSON.stringify(V8) });
    p.arranques['2026-10'] = 0;
    store.save();
    expect(JSON.parse(localStorage.getItem('reparto:v11')).arranques).toEqual({ '2026-10': 0 });
  });
});
