import { supabase } from './auth.js';
import { categoriasBase, normalizarCats } from './engine/categorias.js';
import { VERSION, esViejo, migrarPerfil, recurrentesDesdeViejo } from './engine/migrar.js';
import { normalizarMetas } from './engine/ahorro.js';
import { normalizarPersona } from './engine/persona.js';
import { fusionar } from './engine/sync.js';

/* Un perfil, un blob. localStorage es la caché y Supabase la fuente de verdad:
   la UI nunca espera al servidor. El perfil es
   { v, name, saldoInicial, cats, movs, recurrentes, arranques, metas }. */

const KEY = 'reparto:v11';
const KEYS_NUEVAS = ['reparto:v10', 'reparto:v9'];
const KEYS_V8 = ['reparto:v8', 'reparto:v7', 'reparto:v6', 'reparto:v5'];

let perfil = null;
let remoteId = null;
let userId = null;
let correoUsuario = '';
let pushPendiente = false;   // hay cambios locales que la nube aún no tiene; se guarda con el perfil
let sello = null;            // el updated_at de la fila de la nube que este dispositivo vio por última vez
let cambios = 0;             // sube con cada edición, para saber si algo cambió mientras se subía
let enVuelo = false;
let conflictos = 0;          // choques seguidos al subir, para no insistir sin fin
let pushTimer = null;

const listeners = [];
export function subscribe(cb) {
  listeners.push(cb);
  return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); };
}
function notify() { listeners.forEach((cb) => cb()); }

export function freshProfile(name = 'Mi presupuesto') {
  return { v: VERSION, name, saldoInicial: 0, cats: categoriasBase(), movs: [], recurrentes: [], arranques: {}, metas: [], ignoradas: [], persona: normalizarPersona() };
}

/* El perfil de antes de la auditoría, si sigue en este navegador. Es de donde
   se recuperan los gastos recurrentes de un perfil que ya pasó por la primera
   migración y los perdió. */
function blobViejo() {
  for (const k of KEYS_V8) {
    try {
      const v = JSON.parse(localStorage.getItem(k) || 'null');
      if (v?.profiles?.length) return v.profiles.find((p) => p.id === v.active) || v.profiles[0];
    } catch { /* caché corrupta: se ignora */ }
  }
  return null;
}

/* Rescate: un perfil que ya venía migrado no trae conceptos, así que sus
   recurrentes salen del blob viejo. Se hace una sola vez y solo añade los que
   no estén ya. */
function recuperarRecurrentes(p) {
  if (p.recRecuperados || p.recurrentes?.length) return p;
  const viejo = blobViejo();
  if (!viejo) return p;
  const ids = new Set(p.cats.map((c) => c.id));
  p.recurrentes = recurrentesDesdeViejo(viejo)
    .map((r) => ({ ...r, catId: r.tipo === 'ingreso' ? null : (ids.has(r.catId) ? r.catId : 'otros') }));
  p.recRecuperados = true;
  return p;
}

function normalizar(p) {
  const n = esViejo(p) ? migrarPerfil(p) : p;
  n.cats = normalizarCats(n.cats);
  n.movs = Array.isArray(n.movs) ? n.movs : [];
  n.recurrentes = Array.isArray(n.recurrentes) ? n.recurrentes : [];
  n.arranques = n.arranques && typeof n.arranques === 'object' ? n.arranques : {};
  n.metas = normalizarMetas(n.metas);
  n.ignoradas = Array.isArray(n.ignoradas) ? n.ignoradas : [];
  n.persona = normalizarPersona(n.persona);
  n.saldoInicial = Math.round(Number(n.saldoInicial) || 0);
  n.name = String(n.name || 'Mi presupuesto');
  n.v = VERSION;
  return recuperarRecurrentes(n);
}

export function active() { return perfil; }

/* ---------- local ---------- */

function leerLocal() {
  for (const k of [KEY, ...KEYS_NUEVAS]) {
    try {
      const v = JSON.parse(localStorage.getItem(k) || 'null');
      if (v) return v;
    } catch { /* caché corrupta: se ignora */ }
  }
  return blobViejo();
}

function escribirLocal() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...perfil, remoteId, sello, pendiente: pushPendiente })); }
  catch { /* almacenamiento lleno o bloqueado: se sigue en memoria */ }
}

export function load() {
  const v = leerLocal();
  remoteId = v?.remoteId || null;
  sello = v?.sello || null;
  pushPendiente = !!v?.pendiente;
  perfil = v ? normalizar(v) : freshProfile();
  delete perfil.remoteId;
  delete perfil.sello;
  delete perfil.pendiente;
}

export function save() {
  if (userId) programarPush();
  escribirLocal();
  notify();
}

/* ---------- supabase ---------- */

function programarPush() {
  pushPendiente = true;
  cambios++;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flushPush, 2000);
}

const reintentar = (ms) => { clearTimeout(pushTimer); pushTimer = setTimeout(flushPush, ms); };

/* Sube el perfil solo si la nube sigue como este dispositivo la vio: si otro
   dispositivo escribió entre medias, no se pisa; se trae lo suyo, se junta con
   lo local y se vuelve a subir. Un fallo (sin red) deja la marca de pendiente
   guardada en el disco, así que sobrevive a cerrar la app. */
async function flushPush() {
  if (!userId || !pushPendiente || enVuelo) return;
  enVuelo = true;
  const version = cambios;
  const fila = { user_id: userId, nombre: perfil.name, updated_at: new Date().toISOString(), data: perfil };
  try {
    const q = supabase.from('perfiles');
    const { data, error } = remoteId
      ? await q.update(fila).eq('id', remoteId).eq('updated_at', sello).select()
      : await q.insert(fila).select();
    if (error) throw error;
    if (!data?.length) { await juntarConLaNube(); return; }
    conflictos = 0;
    remoteId = data[0].id;
    sello = data[0].updated_at;
    if (version === cambios) pushPendiente = false;
    escribirLocal();
    if (pushPendiente) reintentar(2000);
  } catch {
    reintentar(4000);
  } finally {
    enVuelo = false;
  }
}

// La nube cambió desde la última vez que se vio: se junta con lo local y se vuelve a subir.
async function juntarConLaNube() {
  const { data, error } = await supabase.from('perfiles').select('*').eq('id', remoteId);
  if (error) throw error;
  const fila = data?.[0];
  if (fila) {
    perfil = normalizar(fusionar(perfil, normalizar({ ...fila.data, name: fila.nombre || fila.data?.name })));
    sello = fila.updated_at;
  } else {
    remoteId = null; // la fila ya no existe: se vuelve a crear
  }
  cambios++;
  escribirLocal();
  notify();
  reintentar(++conflictos > 3 ? 30000 : 0);
}

// Sube ya lo que esté esperando. Devuelve false si quedó algo sin subir (sin red).
export async function subirYa() {
  for (let i = 0; i < 3 && pushPendiente; i++) {
    clearTimeout(pushTimer);
    while (enVuelo) await new Promise((r) => setTimeout(r, 20));
    await flushPush();
  }
  return !pushPendiente;
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
    const remoto = normalizar({ ...fila.data, name: fila.nombre || fila.data?.name });
    const antes = fila.data?.recurrentes?.length || 0;
    /* Con cambios locales sin subir la nube no pisa: si nadie más escribió
       (mismo sello) gana lo local; si alguien escribió, se juntan las dos. */
    if (pushPendiente) {
      if (fila.id !== remoteId || fila.updated_at !== sello) perfil = normalizar(fusionar(perfil, remoto));
      remoteId = fila.id;
      sello = fila.updated_at;
      escribirLocal();
      programarPush();
      notify();
      return { migrated: false, recuperados: 0 };
    }
    remoteId = fila.id;
    sello = fila.updated_at;
    perfil = remoto;
    escribirLocal();
    // se sube si la migración o el rescate cambiaron algo
    if (esViejo(fila.data) || perfil.recurrentes.length !== antes) programarPush();
    notify();
    return { migrated: false, recuperados: perfil.recurrentes.length - antes };
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

/* ---------- la persona ---------- */

export const persona = () => perfil.persona;

export function setPersona(cambios) {
  perfil.persona = normalizarPersona({ ...perfil.persona, ...cambios });
  save();
}

// Si lo último ya subió, si hay cambios esperando, o si esta cuenta no tiene nube todavía.
export function estadoSync() {
  if (!userId) return 'local';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'sin-red';
  return pushPendiente ? 'subiendo' : 'al-dia';
}

/* Borra todo lo que se registró y deja la cuenta como nueva. Se queda el
   nombre de la persona y el del presupuesto: lo que se vacía son los números. */
export function reiniciar() {
  const antes = perfil;
  perfil = { ...freshProfile(perfil.name), persona: perfil.persona };
  save();
  return antes;
}

// Devuelve el perfil que había antes de reiniciar (el deshacer de "borrar todos los datos").
export function restaurar(antes) {
  perfil = antes;
  save();
}

// El correo de quien entró: lo guarda main al abrir la sesión y lo leen Inicio y el perfil.
export const correo = () => correoUsuario;
export function setCorreo(c) { correoUsuario = String(c || ''); }
