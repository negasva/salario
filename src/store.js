import { supabase } from './auth.js';
import { categoriasBase, conOtros } from './engine/categorias.js';
import { VERSION, esViejo, migrarPerfil } from './engine/migrar.js';

/* Un perfil, un blob. localStorage es la caché y Supabase la fuente de verdad:
   la UI nunca espera al servidor. El perfil es
   { v, name, saldoInicial, cats, movs } y nada más. */

const KEY = 'reparto:v9';
const OLD_KEYS = ['reparto:v8', 'reparto:v7', 'reparto:v6', 'reparto:v5'];

let perfil = null;
let remoteId = null;
let userId = null;
let pushPendiente = false;
let pushTimer = null;

const listeners = [];
export function subscribe(cb) {
  listeners.push(cb);
  return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); };
}
function notify() { listeners.forEach((cb) => cb()); }

export function freshProfile(name = 'Mi presupuesto') {
  return { v: VERSION, name, saldoInicial: 0, cats: categoriasBase(), movs: [] };
}

function normalizar(p) {
  const n = esViejo(p) ? migrarPerfil(p) : p;
  n.cats = conOtros(Array.isArray(n.cats) ? n.cats : []);
  n.movs = Array.isArray(n.movs) ? n.movs : [];
  n.saldoInicial = Math.round(Number(n.saldoInicial) || 0);
  n.name = String(n.name || 'Mi presupuesto');
  n.v = VERSION;
  return n;
}

export function active() { return perfil; }

/* ---------- local ---------- */

function leerLocal() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v) return v;
  } catch { /* caché corrupta: se ignora */ }
  for (const k of OLD_KEYS) {
    try {
      const v = JSON.parse(localStorage.getItem(k) || 'null');
      // el blob viejo traía varios perfiles: se queda el activo
      if (v?.profiles?.length) return v.profiles.find((p) => p.id === v.active) || v.profiles[0];
    } catch { /* noop */ }
  }
  return null;
}

function escribirLocal() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...perfil, remoteId })); }
  catch { /* almacenamiento lleno o bloqueado: se sigue en memoria */ }
}

export function load() {
  const v = leerLocal();
  remoteId = v?.remoteId || null;
  perfil = v ? normalizar(v) : freshProfile();
  delete perfil.remoteId;
}

export function save() {
  escribirLocal();
  if (userId) programarPush();
  notify();
}

/* ---------- supabase ---------- */

function programarPush() {
  pushPendiente = true;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flushPush, 2000);
}

async function flushPush() {
  if (!userId || !pushPendiente) return;
  pushPendiente = false;
  const { data, error } = await supabase.from('perfiles').upsert({
    id: remoteId || undefined,
    user_id: userId,
    nombre: perfil.name,
    updated_at: new Date().toISOString(),
    data: perfil,
  }, { onConflict: 'id' }).select().single();
  if (error) { pushPendiente = true; clearTimeout(pushTimer); pushTimer = setTimeout(flushPush, 4000); return; }
  // sin esto cada push insertaría una fila nueva en vez de actualizar la suya
  if (data?.id && remoteId !== data.id) { remoteId = data.id; escribirLocal(); }
}

window.addEventListener('online', () => { if (pushPendiente) flushPush(); });

export async function bootAuth(uid) {
  userId = uid;
  if (!uid) return { migrated: false };
  const { data, error } = await supabase.from('perfiles').select('*').eq('user_id', uid)
    .order('updated_at', { ascending: false });
  if (error) return { migrated: false };
  if (data?.length) {
    /* Un solo perfil: si la cuenta traía varios, manda el que se usó por
       última vez. Las otras filas no se tocan. */
    const fila = data.find((r) => r.id === remoteId) || data[0];
    remoteId = fila.id;
    const migrado = esViejo(fila.data);
    perfil = normalizar({ ...fila.data, name: fila.nombre || fila.data?.name });
    escribirLocal();
    if (migrado) programarPush();
    notify();
    return { migrated: false };
  }
  // sin perfil remoto: lo local se sube como perfil inicial
  const habiaLocal = perfil.movs.length > 0 || perfil.saldoInicial !== 0;
  programarPush();
  await flushPush();
  return { migrated: habiaLocal };
}

export function signOutLocal() {
  userId = null;
  remoteId = null;
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
  perfil = freshProfile();
}

/* ---------- borrado con deshacer ---------- */

export function borrarConDeshacer(quitar, restaurar, segundos = 6) {
  quitar();
  save();
  let vivo = true;
  const timer = setTimeout(() => { vivo = false; }, segundos * 1000);
  return () => {
    if (!vivo) return false;
    clearTimeout(timer);
    vivo = false;
    restaurar();
    save();
    return true;
  };
}

/* ---------- exportar ---------- */

export function exportarJSON() {
  return JSON.stringify(perfil, null, 2);
}
