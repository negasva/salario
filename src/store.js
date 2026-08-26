import { supabase } from './auth.js';
import { ingresoEfectivo } from './engine/consejo.js';
import { emergencyTarget, emergencyStatus, monthlyToward } from './engine/metas.js';
import {
  ordenadas, reasignar, metaCumplida, siguienteEnFila, mover, soltar,
  aplicarTraspaso as traspasar, traspasoVencido,
} from './engine/fila.js';
import { podar, hoyISO, periodoDe, ingresoReal, aportesAMeta, porLinea } from './engine/movimientos.js';
import { resumenItem } from './engine/pagos.js';
import { fueVisto } from './engine/avisos.js';
import { periodosPendientes, construirSnapshot } from './engine/cierre.js';
import { aplicarPaleta, DEFAULT_PALETA, normalizarPaleta } from './theme.js';

const KEY = 'reparto:v8';
const OLD_KEYS = ['reparto:v7', 'reparto:v6', 'reparto:v5'];

// El porcentaje solo vive aquí, como reparto sugerido para un perfil nuevo:
// en cuanto se crea el perfil se traduce a plata y ya nadie lo vuelve a mirar.
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

const INGRESO_INICIAL = 5500000;

export function freshItems(inc = INGRESO_INICIAL) {
  return BASE_ITEMS.map((o) => ({ id: nid('i'), n: o.n, m: Math.round((inc * o.p) / 100),
    r: o.r, c: o.c, d: o.d, locked: false, L: [] }));
}

export function freshProfile(name) {
  return {
    id: nid('p'),
    name,
    inc: INGRESO_INICIAL,
    cur: 'COP',
    paleta: DEFAULT_PALETA,
    ingresoTipo: 'fijo',
    ingresoHistorial: [],
    tasaInteres: 10,
    fondoMeses: 4,
    metodoDeuda: 'avalancha',
    items: freshItems(INGRESO_INICIAL),
    goals: [],
    movs: [],
    updated: Date.now(),
  };
}

/* Una categoría en automático no tiene monto propio: lo saca de sus conceptos,
   corregido por lo que de verdad pagaste en los que ya cerraste. Se recalcula
   al guardar y al cargar, así que `it.m` siempre está al día y las demás
   vistas lo leen igual, sin saber que vino de una suma. */
export function sincronizarAutomaticas(p, periodo = periodoDe(hoyISO())) {
  if (!p?.items?.some((it) => it.auto)) return;
  const pagados = porLinea(p.movs || [], periodo);
  p.items.forEach((it) => {
    if (it.auto) it.m = Math.round(resumenItem(it, pagados, periodo).costo);
  });
}

/* Cambiar el ingreso del plan cuando el reparto todavía es el de fábrica no
   puede dejarlo descuadrado: los montos se reescalan en la misma proporción.
   Solo se usa en el onboarding; después de eso los montos son tuyos y nadie
   los toca a tus espaldas. */
export function reescalarItems(p, incAnterior) {
  if (!(incAnterior > 0) || !(p.inc > 0)) return;
  const k = p.inc / incAnterior;
  p.items.forEach((it) => { it.m = Math.round((Number(it.m) || 0) * k); });
}

// F18 — ingreso variable: promedio para repartir, minimo para calcular esenciales
/* Lo que de verdad entró este mes: nómina más extra. Mientras no haya un solo
   ingreso registrado se reparte sobre el plan, que es lo único que hay. */
export function ingresoDelMes(p, periodo = periodoDe(hoyISO())) {
  return ingresoReal(p?.movs || [], periodo).total;
}

export function incomeRepartir(p) {
  const real = ingresoDelMes(p);
  if (real > 0) return real;
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
      priority: 'alta', modo: 'monto', base: 0, special: 'emergencia',
      orden: 0, estado: 'activa' };
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
    /* Migración: los perfiles viejos guardaban el reparto en porcentaje. Se
       traduce una sola vez a plata sobre el ingreso del plan y el porcentaje
       se borra, para que no queden dos números diciendo cosas distintas. */
    if (typeof it.m !== 'number') it.m = Math.round(((p.inc || 0) * (Number(it.p) || 0)) / 100);
    delete it.p;
    it.L = it.L || [];
    it.L.forEach((l) => { if (l.fixed === undefined) l.fixed = true; });
    if (it.locked === undefined) it.locked = false;
  });
  p.goals = p.goals || [];
  /* Migración: lo que una meta reclamaba de un bloque era un porcentaje de ese
     bloque; ahora es plata. Se traduce una sola vez con el monto que el bloque
     tiene hoy, y la marca queda en el perfil para no volver a convertir. */
  const metasEnPorcentaje = !p.metasEnPlata;
  p.goals.forEach((g, i) => {
    g.a = g.a || {};
    if (metasEnPorcentaje) {
      Object.entries(g.a).forEach(([itemId, pct]) => {
        const it = p.items.find((x) => x.id === itemId);
        g.a[itemId] = it ? Math.round(((Number(it.m) || 0) * (Number(pct) || 0)) / 100) : 0;
      });
    }
    if (!g.priority) g.priority = 'media';
    // dateMode era booleano; ahora el modo tiene tres estados
    if (!g.modo) g.modo = g.dateMode ? 'fecha' : 'monto';

    // F5 — las metas de antes de la fila entran todas activas y en el orden en que estaban
    if (!g.estado) g.estado = 'activa';
    if (typeof g.orden !== 'number') g.orden = g.special ? 0 : i + 1;
  });
  p.metasEnPlata = true;
  reasignar(ordenadas(p.goals));
  // primero se fija la base con todos los movimientos, y lo que la poda se lleve
  // se suma a esa base: podar dos años de libro no puede borrar tu progreso
  sincronizarMetas(p);
  const antes = p.movs ?? [];
  p.movs = podar(antes);
  const podados = antes.filter((m) => !p.movs.includes(m));
  if (podados.length) {
    p.goals.forEach((g) => {
      g.base += podados.filter((m) => m.goalId === g.id).reduce((t, m) => t + m.monto, 0);
    });
    sincronizarMetas(p);
  }
  p.metodoDeuda ??= 'avalancha';
  p.paleta = normalizarPaleta(p.paleta);
  p.ingresoTipo ??= 'fijo';
  p.ingresoHistorial ??= [];
  p.tasaInteres ??= 10;
  p.fondoMeses ??= 4;
  sincronizarAutomaticas(p);
  p.recurrentes ??= [];
  p.avisosVistos ??= {};
  p.avisosEnviados ??= {};
  p.alertasSilenciadas ??= {};
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
    aplicarPaleta(active()?.paleta);
  } else {
    const p = freshProfile('Mi presupuesto');
    db = { active: p.id, profiles: [p] };
    aplicarPaleta(p.paleta);
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
        inc: p.inc, cur: p.cur, paleta: p.paleta, ingresoTipo: p.ingresoTipo, ingresoHistorial: p.ingresoHistorial,
        tasaInteres: p.tasaInteres, fondoMeses: p.fondoMeses, metodoDeuda: p.metodoDeuda,
        items: p.items, goals: p.goals, metasEnPlata: true, traspaso: p.traspaso || null,
        avisosVistos: p.avisosVistos, avisosEnviados: p.avisosEnviados,
        alertasSilenciadas: p.alertasSilenciadas, dashLayout: p.dashLayout || null,
        recurrentes: p.recurrentes || [],
        movs: p.movs, localId: p.id,
      },
    }, { onConflict: 'id' }).select().single();
    if (error) { pendingPush.add(id); clearTimeout(pushTimer); pushTimer = setTimeout(flushPush, 4000); return; }
    // sin esto cada push insertaria una fila nueva en vez de actualizar la suya
    if (data?.id && p.remoteId !== data.id) { p.remoteId = data.id; writeLocal(); }
  }
}

window.addEventListener('online', () => { if (pendingPush.size) flushPush(); });

/* El progreso de una meta tiene una sola fuente: los movimientos con su goalId.
   `g.base` es lo que ya tenías antes de empezar a registrarlos y `g.s` queda
   como número derivado, para que todas las vistas lo sigan leyendo igual. */
export function sincronizarMetas(p) {
  (p?.goals || []).forEach((g) => {
    const aportado = aportesAMeta(p.movs || [], g.id).total;
    if (typeof g.base !== 'number') g.base = Math.max(0, (g.s || 0) - aportado);
    delete g.aportes;
    g.s = g.base + aportado;
  });
}

export function save() {
  const p = active();
  if (p) { p.updated = Date.now(); sincronizarAutomaticas(p); sincronizarMetas(p); }
  writeLocal();
  if (p && userId) schedulePush(p.id);
  notify();
}

export function setActive(id) {
  db.active = id;
  aplicarPaleta(active()?.paleta);
  writeLocal();
  notify();
}

export function setPalette(id) {
  const p = active();
  if (!p) return;
  p.paleta = normalizarPaleta(id);
  aplicarPaleta(p.paleta);
  save();
}

export function addProfile(name, copyCurrent) {
  let p;
  if (copyCurrent) {
    const cur = active();
    p = { ...freshProfile(name), inc: cur.inc, cur: cur.cur, paleta: cur.paleta, ingresoTipo: cur.ingresoTipo,
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

export function renameProfile(id, nombre) {
  const p = db.profiles.find((x) => x.id === id);
  const n = String(nombre || '').trim();
  if (!p || !n) return false;
  p.name = n;
  save();
  return true;
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
      inc: row.data.inc, cur: row.data.cur, paleta: row.data.paleta, ingresoTipo: row.data.ingresoTipo,
      ingresoHistorial: row.data.ingresoHistorial || [], tasaInteres: row.data.tasaInteres || 10,
      fondoMeses: row.data.fondoMeses || 4, items: row.data.items || [], goals: row.data.goals || [],
      movs: row.data.movs || [], metodoDeuda: row.data.metodoDeuda, traspaso: row.data.traspaso || null,
      metasEnPlata: row.data.metasEnPlata,
      avisosVistos: row.data.avisosVistos, avisosEnviados: row.data.avisosEnviados,
      alertasSilenciadas: row.data.alertasSilenciadas,
      updated: new Date(row.updated_at).getTime(),
    }));
    if (!db.profiles.some((x) => x.id === db.active)) db.active = db.profiles[0].id;
    aplicarPaleta(active()?.paleta);
    writeLocal();
    notify();
    return { migrated: false };
  }
  // sin perfiles remotos: si hay algo local, se sube como perfil inicial (migracion)
  const hadLocal = db.profiles.length && db.profiles.some((p) => p.items?.some((it) => it.L?.length) || p.goals?.length || p.inc !== INGRESO_INICIAL);
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
    const { error } = await cerrarMes(periodo, construirSnapshot(p, periodo, ingresoDelMes(p, periodo) || incomeRepartir(p)));
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

/* ---------- F5 — la fila de metas ---------- */

/* La fila se revisa en cada guardado. Si una meta activa llegó a su objetivo se
   arma el traspaso, se anuncia y ahí se queda esperando. Si nadie lo acepta en
   24 horas se aplica solo: el dinero no se queda sin dueño. Como no hay cron,
   el reloj se mira cuando la app está abierta, igual que el cierre de mes. */
export function revisarFila(ahora = Date.now()) {
  const p = active();
  if (!p) return null;

  if (!p.traspaso) {
    const desde = metaCumplida(p.goals);
    if (!desde) return null;
    // sin nadie esperando no hay nada que traspasar: la meta sigue como está
    // y el anuncio saldrá el día que pongas otra meta en la fila
    const hacia = siguienteEnFila(p.goals);
    if (!hacia) return null;
    p.traspaso = {
      desdeId: desde.id,
      haciaId: hacia.id,
      monto: monthlyToward(desde, p.items),
      creado: ahora,
    };
    save();
  }

  if (traspasoVencido(p.traspaso, ahora)) {
    aplicarTraspasoPendiente();
    return null;
  }
  return traspasoPendiente();
}

export function traspasoPendiente() {
  const p = active();
  const t = p?.traspaso;
  if (!t) return null;
  const desde = p.goals.find((g) => g.id === t.desdeId);
  const hacia = p.goals.find((g) => g.id === t.haciaId);
  if (!desde || !hacia) { p.traspaso = null; return null; }
  return { ...t, desde, hacia };
}

export function aplicarTraspasoPendiente(aMano = false) {
  const p = active();
  const t = traspasoPendiente();
  p.traspaso = null;
  if (!t) { save(); return null; }
  traspasar(t.desde, t.hacia, aMano, p.items);
  save();
  return t;
}

export function moverMeta(id, delta) {
  const p = active();
  if (!mover(p.goals, id, delta)) return false;
  save();
  return true;
}

export function soltarMeta(id, sobreId) {
  const p = active();
  if (!soltar(p.goals, id, sobreId)) return false;
  save();
  return true;
}

export function cambiarEstadoMeta(goal, estado) {
  goal.estado = estado;
  // una meta que vuelve a la fila deja de reclamar, pero su reparto se guarda
  save();
}

/* ---------- F6 — marcas de los avisos ---------- */

/* Una marca solo sirve el día que se puso, así que al escribirla se botan las
   viejas: el blob del perfil no se llena de claves muertas. */
function marcar(mapa, clave) {
  const hoy = hoyISO();
  const limpio = Object.fromEntries(Object.entries(mapa || {}).filter(([, f]) => f === hoy));
  limpio[clave] = hoy;
  return limpio;
}

export function descartarAviso(clave) {
  const p = active();
  p.avisosVistos = marcar(p.avisosVistos, clave);
  save();
}

export function avisoEnviado(clave) {
  return fueVisto(active()?.avisosEnviados, clave);
}

export function marcarAvisoEnviado(clave) {
  const p = active();
  p.avisosEnviados = marcar(p.avisosEnviados, clave);
  save();
}

/* ---------- alertas silenciadas (F7) ---------- */

export function silenciarAlerta(lineId) {
  const p = active();
  if (!p.alertasSilenciadas) p.alertasSilenciadas = {};
  // 6 meses en milisegundos = 6 * 30 * 24 * 60 * 60 * 1000 = 15552000000
  p.alertasSilenciadas[lineId] = Date.now() + 15552000000;
  save();
}

export function alertaEstaSilenciada(lineId) {
  const p = active();
  const v = p?.alertasSilenciadas?.[lineId];
  if (!v) return false;
  if (Date.now() > v) {
    delete p.alertasSilenciadas[lineId];
    save();
    return false;
  }
  return true;
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
