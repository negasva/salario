import { supabase } from './auth.js';
import { ingresoEfectivo } from './engine/consejo.js';
import { emergencyTarget, emergencyStatus } from './engine/metas.js';
import { podar } from './engine/movimientos.js';
import { periodosPendientes, construirSnapshot } from './engine/cierre.js';

const KEY = 'reparto:v8';
const OLD_KEYS = ['reparto:v7', 'reparto:v6', 'reparto:v5'];

export const BASE_ITEMS = [
  { n: 'Esenciales', p: 55, r: 'ese', c: 'var(--ink)', d: 'Renta, servicios, comida, transporte. Es el techo, no la meta.' },
  { n: 'Gasto libre', p: 5, r: 'lib', c: 'var(--pink)', d: 'Tuyo para gastarlo sin sentir culpa.' },
  { n: 'Deudas', p: 10, r: 'deu', c: 'var(--danger)', d: 'Abono extra cada mes. Sin deudas, este bloque se va a inversión.' },
  { n: 'Ahorro corto plazo', p: 15, r: 'cor', c: 'var(--success)', d: 'Enganche, viaje, imprevistos.' },
  { n: 'Inversión largo plazo', p: 15, r: 'lar', c: 'var(--warning)', d: 'Dinero que trabaja y no tocas.' },
];

export const PLANTILLAS = {
  ese: ['Arriendo', 'Servicios', 'Mercado', 'Transporte', 'Internet', 'Celular', 'Salud'],
  deu: ['Tarjeta', 'Crédito de consumo', 'Vehículo'],
  lib: ['Comidas fuera', 'Streaming', 'Salidas'],
  cor: ['Fondo de emergencia', 'Imprevistos'],
};

let seq = 1;
let db = { active: null, profiles: [] };
let userId = null;
let pendingPush = new Set();
let pushTimer = null;

const listeners = [];
export function subscribe(cb) {
  listeners.push(cb);
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };
}
function notify() {
  listeners.forEach((cb) => cb());
}

function nid(prefix) {
  return prefix + seq++;
}

export function freshItems() {
  return BASE_ITEMS.map((o) => ({ id: nid('i'), n: o.n, p: o.p, r: o.r, c: o.c, d: o.d, locked: false, L: [] }));
}

export function freshProfile(name) {
  return {
    id: nid('p'),
    name,
    inc: 5500000,
    cur: 'COP',
    ingresoTipo: 'fijo',
    ingresoHistorial: [],
    tasaInteres: 10,
    fondoMeses: 4,
    metodoDeuda: 'avalancha',
    items: freshItems(),
    goals: [],
    movs: [],
    updated: Date.now(),
  };
}

// F18 — ingreso variable: promedio para repartir, minimo para calcular esenciales
export function incomeRepartir(p) {
  if (p.ingresoTipo !== 'variable') return p.inc;
  const { promedio } = ingresoEfectivo(p.ingresoHistorial || []);
  return promedio || p.inc;
}

export function incomeEsenciales(p) {
  if (p.ingresoTipo !== 'variable') return p.inc;
  const { minimo } = ingresoEfectivo(p.ingresoHistorial || []);
  return minimo || p.inc;
}

/* El fondo de emergencia es una meta fija. Se crea y se recalcula desde
   cualquier vista, no solo al abrir Metas, para que el dashboard no muestre
   un fondo que todavia no existe como meta. */
export function ensureFondoGoal(p) {
  const { oneMonth, target } = emergencyTarget(p.items.filter((it) => it.r === 'ese'), p.fondoMeses);
  let goal = p.goals.find((g) => g.special === 'emergencia');
  let creado = false;
  if (!goal) {
    goal = { id: nid('g'), n: 'Fondo de emergencia', t: target, s: 0, a: {},
      priority: 'alta', modo: 'monto', aportes: [], special: 'emergencia' };
    p.goals.unshift(goal);
    creado = true;
  } else if (!goal.manual && target > 0 && goal.t !== target) {
    goal.t = target;
    creado = true;
  }
  return { goal, oneMonth, target: goal.t, saved: goal.s || 0, creado,
    estado: emergencyStatus(goal.s || 0, oneMonth, goal.t) };
}

export function active() {
  return db.profiles.find((p) => p.id === db.active) || db.profiles[0];
}
export function profiles() {
  return db.profiles;
}
export function activeId() {
  return db.active;
}

function normalizeProfile(p) {
  p.items = p.items || [];
  p.items.forEach((it) => {
    it.L = it.L || [];
    it.L.forEach((l) => { if (l.fixed === undefined) l.fixed = true; });
    if (it.locked === undefined) it.locked = false;
  });
  p.goals = p.goals || [];
  p.goals.forEach((g) => {
    g.a = g.a || {};
    if (!g.priority) g.priority = 'media';
    // dateMode era booleano; ahora el modo tiene tres estados
    if (!g.modo) g.modo = g.dateMode ? 'fecha' : 'monto';
    if (!g.aportes) g.aportes = [];
  });
  // al arrancar se podan los movimientos viejos: el blob de perfiles no crece sin techo
  p.movs = podar(p.movs ?? []);
  p.metodoDeuda ??= 'avalancha';
  p.ingresoTipo ??= 'fijo';
  p.ingresoHistorial ??= [];
  p.tasaInteres ??= 10;
  p.fondoMeses ??= 4;
  return p;
}

function readLocal() {
  let v = null;
  try { v = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* ponytail: cache corrupto, se ignora */ }
  if (!v) {
    for (const k of OLD_KEYS) {
      try { v = JSON.parse(localStorage.getItem(k) || 'null'); } catch { /* noop */ }
      if (v) break;
    }
  }
  return v;
}

export function load() {
  const v = readLocal();
  if (v && v.profiles && v.profiles.length) {
    db = { active: v.active, profiles: v.profiles.map(normalizeProfile) };
    seq = v.seq || 100;
    if (!active()) db.active = db.profiles[0].id;
  } else {
    const p = freshProfile('Mi presupuesto');
    db = { active: p.id, profiles: [p] };
  }
}

function writeLocal() {
  try { localStorage.setItem(KEY, JSON.stringify({ active: db.active, profiles: db.profiles, seq })); }
  catch { /* almacenamiento lleno o bloqueado, se sigue solo en memoria */ }
}

function schedulePush(profileId) {
  pendingPush.add(profileId);
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flushPush, 2000);
}

async function flushPush() {
  if (!userId) return;
  const ids = [...pendingPush];
  pendingPush.clear();
  for (const id of ids) {
    const p = db.profiles.find((x) => x.id === id);
    if (!p) continue;
    const { data, error } = await supabase.from('perfiles').upsert({
      id: p.remoteId || undefined,
      user_id: userId,
      nombre: p.name,
      updated_at: new Date().toISOString(),
      data: {
        inc: p.inc, cur: p.cur, ingresoTipo: p.ingresoTipo, ingresoHistorial: p.ingresoHistorial,
        tasaInteres: p.tasaInteres, fondoMeses: p.fondoMeses, metodoDeuda: p.metodoDeuda,
        items: p.items, goals: p.goals,
        movs: p.movs, localId: p.id,
      },
    }, { onConflict: 'id' }).select().single();
    if (error) { pendingPush.add(id); clearTimeout(pushTimer); pushTimer = setTimeout(flushPush, 4000); return; }
    // sin esto cada push insertaria una fila nueva en vez de actualizar la suya
    if (data?.id && p.remoteId !== data.id) { p.remoteId = data.id; writeLocal(); }
  }
}

window.addEventListener('online', () => { if (pendingPush.size) flushPush(); });

export function save() {
  const p = active();
  if (p) p.updated = Date.now();
  writeLocal();
  if (p && userId) schedulePush(p.id);
  notify();
}

export function setActive(id) {
  db.active = id;
  writeLocal();
  notify();
}

export function addProfile(name, copyCurrent) {
  let p;
  if (copyCurrent) {
    const cur = active();
    p = { ...freshProfile(name), inc: cur.inc, cur: cur.cur, ingresoTipo: cur.ingresoTipo,
      ingresoHistorial: [...cur.ingresoHistorial], tasaInteres: cur.tasaInteres, fondoMeses: cur.fondoMeses,
      items: JSON.parse(JSON.stringify(cur.items)), goals: JSON.parse(JSON.stringify(cur.goals)),
      movs: JSON.parse(JSON.stringify(cur.movs)) };
  } else {
    p = freshProfile(name);
  }
  db.profiles.push(p);
  db.active = p.id;
  save();
  return p;
}

export function importProfiles(incoming, replace) {
  const normalized = incoming.map((p) => normalizeProfile({ ...p, id: replace ? p.id : nid('p') }));
  if (replace) {
    db.profiles = normalized;
  } else {
    db.profiles = db.profiles.concat(normalized);
  }
  db.active = db.profiles[0].id;
  save();
}

export function removeProfile(id) {
  if (db.profiles.length < 2) return false;
  db.profiles = db.profiles.filter((p) => p.id !== id);
  if (db.active === id) db.active = db.profiles[0].id;
  save();
  return true;
}

/* ---------- sincronizacion con supabase ---------- */

export async function bootAuth(uid) {
  userId = uid;
  if (!uid) return;
  const { data, error } = await supabase.from('perfiles').select('*').eq('user_id', uid);
  if (error) return;
  if (data && data.length) {
    db.profiles = data.map((row) => normalizeProfile({
      id: row.data.localId || row.id, remoteId: row.id, name: row.nombre,
      inc: row.data.inc, cur: row.data.cur, ingresoTipo: row.data.ingresoTipo,
      ingresoHistorial: row.data.ingresoHistorial || [], tasaInteres: row.data.tasaInteres || 10,
      fondoMeses: row.data.fondoMeses || 4, items: row.data.items || [], goals: row.data.goals || [],
      movs: row.data.movs || [], metodoDeuda: row.data.metodoDeuda,
      updated: new Date(row.updated_at).getTime(),
    }));
    if (!db.profiles.some((x) => x.id === db.active)) db.active = db.profiles[0].id;
    writeLocal();
    notify();
    return { migrated: false };
  }
  // sin perfiles remotos: si hay algo local, se sube como perfil inicial (migracion)
  const hadLocal = db.profiles.length && db.profiles.some((p) => p.items?.some((it) => it.L?.length) || p.goals?.length || p.inc !== 5500000);
  for (const p of db.profiles) schedulePush(p.id);
  await flushPush();
  return { migrated: hadLocal };
}

export function signOutLocal() {
  userId = null;
}

/* ---------- cierres (F13) ---------- */

export async function cerrarMes(periodo, snapshot) {
  const p = active();
  if (!userId || !p?.remoteId) return { error: 'sin sesion' };
  return supabase.from('cierres').upsert({
    user_id: userId, perfil_id: p.remoteId, periodo, snapshot,
  }, { onConflict: 'perfil_id,periodo' });
}

/* Cierre automático: no hay cron ni servidor, la app cierra los meses
   pendientes la primera vez que se abre después del día 1. */
let cerradosAuto = [];
export function cierresAutomaticos() { return cerradosAuto; }

export async function autoCerrar() {
  cerradosAuto = [];
  const p = active();
  if (!userId || !p?.remoteId) return cerradosAuto;
  const cierres = await listarCierres();
  const pendientes = periodosPendientes(cierres.map((c) => c.periodo), p.movs);
  for (const periodo of pendientes) {
    const { error } = await cerrarMes(periodo, construirSnapshot(p, periodo, incomeRepartir(p)));
    if (error) break;
    cerradosAuto.push(periodo);
  }
  return cerradosAuto;
}

export async function listarCierres() {
  const p = active();
  if (!userId || !p?.remoteId) return [];
  const { data } = await supabase.from('cierres').select('*').eq('perfil_id', p.remoteId).order('periodo', { ascending: true });
  return data || [];
}

/* ---------- borrado con deshacer, F15 ---------- */

const pendingDeletes = new Map();

export function stageDelete(remove, restore, seconds = 6) {
  const token = nid('del');
  remove();
  save();
  const timer = setTimeout(() => { pendingDeletes.delete(token); }, seconds * 1000);
  pendingDeletes.set(token, { restore, timer });
  return {
    token,
    undo() {
      const entry = pendingDeletes.get(token);
      if (!entry) return false;
      clearTimeout(entry.timer);
      pendingDeletes.delete(token);
      entry.restore();
      save();
      return true;
    },
  };
}
