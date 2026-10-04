import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VERSION } from './engine/migrar.js';

/* El store habla con Supabase y con el navegador. Aquí los dos son de mentira:
   lo que se prueba es que al abrir la app aparezca lo que había guardado. */

const nube = vi.hoisted(() => ({ supabase: { from: () => ({}) } }));
vi.mock('./auth.js', () => ({ get supabase() { return nube.supabase; } }));

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

describe('sugerencias descartadas', () => {
  it('sobreviven al abrir la app y se limpian al reiniciar', async () => {
    const p = await cargarCon({ 'reparto:v11': JSON.stringify({ ...V9, v: 11, ignoradas: ['gasto|ser|netflix'] }) });
    expect(p.ignoradas).toEqual(['gasto|ser|netflix']);
    store.reiniciar();
    expect(store.active().ignoradas).toEqual([]);
  });

  it('un perfil sin el campo lo recibe vacío', async () => {
    expect((await cargarCon({ 'reparto:v9': JSON.stringify(V9) })).ignoradas).toEqual([]);
  });

  it('se guardan al cambiar y vuelven al recargar', async () => {
    const p = await cargarCon({});
    p.ignoradas.push('gasto|ser|gym');
    store.save();
    const guardado = localStorage.getItem('reparto:v11');
    expect((await cargarCon({ 'reparto:v11': guardado })).ignoradas).toEqual(['gasto|ser|gym']);
  });
});

/* Supabase de mentira: una tabla en memoria con select, update, insert y eq. */
function nubeFalsa(rows, alConsultar) {
  let consultas = 0;
  return {
    from: () => {
      const filtros = [];
      let accion = 'select';
      let carga;
      const b = {
        select: () => b,
        order: () => b,
        update: (c) => { accion = 'update'; carga = c; return b; },
        insert: (c) => { accion = 'insert'; carga = c; return b; },
        eq: (col, v) => { filtros.push([col, v]); return b; },
        then: (ok) => {
          if (accion === 'select') alConsultar?.(consultas++);
          const m = rows.filter((r) => filtros.every(([c, v]) => r[c] === v));
          if (accion === 'insert') { const r = { id: `n${rows.length}`, ...carga }; rows.push(r); return ok({ data: [r], error: null }); }
          if (accion === 'update') m.forEach((r) => Object.assign(r, carga));
          return ok({ data: m, error: null });
        },
      };
      return b;
    },
  };
}

const mv = (id) => ({ id, fecha: '2026-10-01', tipo: 'gasto', monto: 1000, catId: 'otros', nota: id });
const cats = [{ id: 'otros', n: 'Otros', m: 0, c: '#222' }];
const perfilCon = (...ids) => ({ v: VERSION, name: 'Casa', saldoInicial: 0, cats, movs: ids.map(mv), recurrentes: [], arranques: {}, metas: [] });
const fila = (updated_at, ...ids) => ({ id: 'r1', user_id: 'u1', nombre: 'Casa', updated_at, data: perfilCon(...ids) });

async function abrirCon(local, rows) {
  nube.supabase = nubeFalsa(rows);
  await cargarCon({ 'reparto:v11': JSON.stringify({ ...local, remoteId: 'r1' }) });
  await store.bootAuth('u1');
  return store;
}
const ids = (movs) => movs.map((m) => m.id).sort();

describe('sincronizar sin perder lo hecho', () => {
  it('lo registrado sin red sobrevive a cerrar y abrir la app, y luego sube', async () => {
    const rows = [fila('t1')];
    const s = await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: true }, rows);
    expect(ids(s.active().movs)).toEqual(['a']);
    expect(await s.subirYa()).toBe(true);
    expect(ids(rows[0].data.movs)).toEqual(['a']);
    expect(rows[0].updated_at).not.toBe('t1');
  });

  it('si otro dispositivo escribió mientras tanto, se juntan las dos copias', async () => {
    const rows = [fila('t2', 'b')];
    const s = await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: true }, rows);
    expect(ids(s.active().movs)).toEqual(['a', 'b']);
    await s.subirYa();
    expect(ids(rows[0].data.movs)).toEqual(['a', 'b']);
  });

  it('sin cambios pendientes manda la nube', async () => {
    const s = await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: false }, [fila('t2', 'b')]);
    expect(ids(s.active().movs)).toEqual(['b']);
  });

  it('al subir, si la nube cambió, no la pisa: la junta y vuelve a subir', async () => {
    const rows = [fila('t1')];
    const s = await abrirCon({ ...perfilCon(), sello: 't1', pendiente: false }, rows);
    Object.assign(rows[0], { updated_at: 't9', data: perfilCon('b') }); // otro dispositivo
    s.active().movs.push(mv('c'));
    s.save();
    expect(await s.subirYa()).toBe(true);
    expect(ids(rows[0].data.movs)).toEqual(['b', 'c']);
  });

  it('borrar todo se puede deshacer', async () => {
    const s = await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: false }, [fila('t1', 'a')]);
    const antes = s.reiniciar();
    expect(s.active().movs).toHaveLength(0);
    s.restaurar(antes);
    expect(ids(s.active().movs)).toEqual(['a']);
  });

  it('primer login desde dos dispositivos: se junta con la fila que acaba de aparecer, sin duplicarla', async () => {
    const rows = [];
    nube.supabase = nubeFalsa(rows, (n) => { if (n === 1) rows.push(fila('t1', 'b')); });
    await cargarCon({ 'reparto:v11': JSON.stringify({ ...perfilCon('a'), pendiente: true }) });
    await store.bootAuth('u1');
    expect(await store.subirYa()).toBe(true);
    expect(rows).toHaveLength(1);
    expect(ids(rows[0].data.movs)).toEqual(['a', 'b']);
  });

  it('borrar todo no se deshace solo al juntarse con una nube que cambió', async () => {
    const rows = [fila('t1', 'a')];
    const s = await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: false }, rows);
    Object.assign(rows[0], { updated_at: 't9', data: perfilCon('a', 'b') }); // otro dispositivo
    s.reiniciar();
    await s.subirYa();
    expect(rows[0].data.movs).toHaveLength(0);
  });

  it('cerrar sesión con cambios sin subir conserva la copia; otra cuenta no la hereda', async () => {
    const rows = [fila('t1')];
    const s = await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: true, dueno: 'u1' }, rows);
    s.signOutLocal();
    expect(localStorage.getItem('reparto:v11')).not.toBeNull();
    const otra = await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: true, dueno: 'u0' }, [fila('t1')]);
    expect(otra.active().movs).toHaveLength(0);
  });

  it('descartar lo pendiente deja cerrar sesión limpia', async () => {
    const s = await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: true, dueno: 'u1' }, [fila('t1')]);
    s.descartarPendiente();
    s.signOutLocal();
    expect(localStorage.getItem('reparto:v11')).toBeNull();
  });

  it('borrar todo sin red y recargar: sigue siendo un borrado, no se junta con la nube', async () => {
    const rows = [fila('t9', 'b')]; // otro dispositivo escribió
    const s = await abrirCon({ ...perfilCon(), sello: 't1', pendiente: true, reinicio: true }, rows);
    expect(s.active().movs).toHaveLength(0);
    await s.subirYa();
    expect(rows[0].data.movs).toHaveLength(0);
  });

  it('después de cerrar sesión con pendientes, guardar no pisa la copia retenida', async () => {
    const s = await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: true, dueno: 'u1' }, [fila('t1')]);
    s.signOutLocal();
    s.setPersona({ nombre: 'Otro' });
    expect(JSON.parse(localStorage.getItem('reparto:v11')).movs).toHaveLength(1);
  });

  it('los cambios sin subir de una cuenta esperan a que ella vuelva a entrar', async () => {
    await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: true, dueno: 'u1' }, [fila('t1')]);
    store.signOutLocal();
    nube.supabase = nubeFalsa([{ ...fila('t5'), id: 'r2', user_id: 'u2' }]);
    await store.bootAuth('u2'); // entra otra persona: no ve ni hereda lo de u1
    expect(store.active().movs).toHaveLength(0);
    const guardado = { ...localStorage._datos };
    const rows = [fila('t1')];
    await cargarCon(guardado);
    nube.supabase = nubeFalsa(rows);
    await store.bootAuth('u1'); // vuelve u1: recupera lo suyo y lo sube
    await store.subirYa();
    expect(ids(rows[0].data.movs)).toEqual(['a']);
  });

  it('un borrado total no deja la marca colgada: después se junta con la nube', async () => {
    const rows = [fila('t1', 'a')];
    const s = await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: false }, rows);
    s.reiniciar();
    await s.subirYa(); // sube el borrado y apaga la marca
    Object.assign(rows[0], { updated_at: 't9', data: perfilCon('z') }); // otro dispositivo
    s.active().movs.push(mv('n'));
    s.save();
    await s.subirYa();
    expect(ids(rows[0].data.movs)).toEqual(['n', 'z']);
  });

  it('una copia apartada ilegible no estorba al entrar', async () => {
    nube.supabase = nubeFalsa([fila('t1', 'b')]);
    await cargarCon({ 'reparto:retenida:u1': 'basura{' });
    await store.bootAuth('u1');
    expect(ids(store.active().movs)).toEqual(['b']);
    expect(localStorage.getItem('reparto:retenida:u1')).toBeNull();
  });

  it('si al abrir falla la consulta con cambios pendientes, reintenta solo', async () => {
    vi.useFakeTimers();
    try {
      const rows = [fila('t1')];
      const roto = { from: () => { const b = { select: () => b, eq: () => b, order: () => b, then: (ok) => ok({ data: null, error: new Error('sin red') }) }; return b; } };
      nube.supabase = roto;
      await cargarCon({ 'reparto:v11': JSON.stringify({ ...perfilCon('a'), remoteId: 'r1', sello: 't1', pendiente: true }) });
      await store.bootAuth('u1');
      expect(ids(rows[0].data.movs)).toEqual([]);
      nube.supabase = nubeFalsa(rows);
      await vi.advanceTimersByTimeAsync(4000);
      expect(ids(rows[0].data.movs)).toEqual(['a']);
    } finally { vi.useRealTimers(); }
  });
});

describe('privacidad: no quedan datos viejos en el navegador', () => {
  const viejas = () => ({ 'reparto:v9': JSON.stringify(V9), 'reparto:v8': JSON.stringify(V8) });
  const quedan = () => ['reparto:v10', 'reparto:v9', 'reparto:v8', 'reparto:v7', 'reparto:v6', 'reparto:v5']
    .filter((k) => localStorage.getItem(k) !== null);

  it('cerrar sesión borra la copia actual y las de versiones anteriores', async () => {
    await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: false }, [fila('t1', 'a')]);
    localStorage.setItem('reparto:v8', JSON.stringify(V8));
    store.signOutLocal();
    expect(localStorage.getItem('reparto:v11')).toBeNull();
    expect(quedan()).toEqual([]);
  });

  it('borrar todo no hace volver los recurrentes del perfil viejo', async () => {
    const p = await cargarCon(viejas());
    expect(p.recurrentes.length).toBeGreaterThan(0);
    store.reiniciar();
    expect(quedan()).toEqual([]);
    expect((await cargarCon({ ...localStorage._datos })).recurrentes).toEqual([]);
  });

  it('la primera subida correcta borra las copias viejas, que ya no hacen falta', async () => {
    const rows = [fila('t1')];
    nube.supabase = nubeFalsa(rows);
    await cargarCon({ ...viejas(), 'reparto:v11': JSON.stringify({ ...perfilCon('a'), remoteId: 'r1', sello: 't1', pendiente: true }) });
    await store.bootAuth('u1');
    await store.subirYa();
    expect(quedan()).toEqual([]);
  });

  it('otra cuenta en el mismo navegador no hereda los recurrentes viejos de la anterior', async () => {
    nube.supabase = nubeFalsa([{ ...fila('t5'), id: 'r2', user_id: 'u2' }]);
    await cargarCon({ ...viejas(), 'reparto:v11': JSON.stringify({ ...perfilCon('a'), dueno: 'u1' }) });
    await store.bootAuth('u2');
    expect(store.active().recurrentes).toEqual([]);
  });

  it('cerrar sesión con cambios sin subir también borra las copias viejas', async () => {
    await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: true, dueno: 'u1' }, [fila('t1')]);
    localStorage.setItem('reparto:v8', JSON.stringify(V8));
    store.signOutLocal();
    expect(localStorage.getItem('reparto:v8')).toBeNull();
    expect(localStorage.getItem('reparto:v11')).not.toBeNull(); // la copia con cambios sin subir se conserva
  });
});

describe('respaldo y restauración', () => {
  it('restaura una copia JSON y se puede deshacer', async () => {
    const s = await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: false }, [fila('t1', 'a')]);
    const copia = JSON.stringify(perfilCon('x', 'y'));
    const antes = s.restaurarDesdeJSON(copia);
    expect(ids(s.active().movs)).toEqual(['x', 'y']);
    s.restaurar(antes);
    expect(ids(s.active().movs)).toEqual(['a']);
  });

  it('la copia restaurada pisa la nube, no se junta con ella', async () => {
    const rows = [fila('t1', 'a')];
    const s = await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: false }, rows);
    Object.assign(rows[0], { updated_at: 't9', data: perfilCon('a', 'b') });
    s.restaurarDesdeJSON(JSON.stringify(perfilCon('x')));
    await s.subirYa();
    expect(ids(rows[0].data.movs)).toEqual(['x']);
  });

  it('rechaza un archivo que no es una copia y no toca nada', async () => {
    const s = await abrirCon({ ...perfilCon('a'), sello: 't1', pendiente: false }, [fila('t1', 'a')]);
    expect(() => s.restaurarDesdeJSON('no es json')).toThrow(/no es una copia/);
    expect(() => s.restaurarDesdeJSON('{"movs": 3}')).toThrow(/no es una copia/);
    expect(ids(s.active().movs)).toEqual(['a']);
  });

  it('recuerda el día de la última copia', async () => {
    await cargarCon({});
    expect(store.ultimoRespaldo()).toBeNull();
    store.marcarRespaldo('2026-10-04');
    expect(store.ultimoRespaldo()).toBe('2026-10-04');
  });
});

