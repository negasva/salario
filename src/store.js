import { supabase } from './auth.js';
import { categoriasBase, normalizarCats } from './engine/categorias.js';
import { VERSION, esViejo, migrarPerfil, recurrentesDesdeViejo } from './engine/migrar.js';
import { normalizarMetas, normalizarSobrante } from './engine/ahorro.js';
import { normalizarPersona } from './engine/persona.js';
import { fusionar } from './engine/sync.js';
import { motivoDeRechazo } from './engine/respaldo.js';

/* Un perfil, un blob. localStorage es la caché y Supabase la fuente de verdad:
   la UI nunca espera al servidor. El perfil es
   { v, name, saldoInicial, cats, movs, recurrentes, arranques, metas }. */

const KEY = 'reparto:v11';
const RETENIDA = 'reparto:retenida:'; // copias con cambios sin subir de otra cuenta, por dueño
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
let fallos = 0;              // fallos seguidos al subir: espera creciente y aviso en el perfil
let rechazado = false;       // la base no aceptó el perfil por grande: no se insiste hasta que cambie algo
let reinicio = false;        // tras "borrar todo" la nube se sobrescribe, no se fusiona
let duenoLocal = null;       // de quién es la copia local: otra cuenta no hereda cambios ajenos
let conflictos = 0;          // choques seguidos al subir, para no insistir sin fin
let pushTimer = null;

const listeners = [];
export function subscribe(cb) {
  listeners.push(cb);
  return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); };
}
function notify() { listeners.forEach((cb) => cb()); }

export function freshProfile(name = 'Mi presupuesto') {
  return { v: VERSION, name, saldoInicial: 0, cats: categoriasBase(), movs: [], recurrentes: [], arranques: {}, metas: [], sobrante: normalizarSobrante(), ignoradas: [], persona: normalizarPersona() };
}

/* Las copias de versiones anteriores guardan los datos en claro y ya no hacen
   falta una vez que lo suyo está en la nube: se borran al cerrar sesión, al
   borrar todo, al entrar otra cuenta y tras la primera subida correcta. */
function limpiarViejas() {
  for (const k of [...KEYS_NUEVAS, ...KEYS_V8]) {
    try { localStorage.removeItem(k); } catch { /* noop */ }
  }
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
  n.sobrante = normalizarSobrante(n.sobrante);
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
  if (!userId && pushPendiente) return; // copia con cambios sin subir de una sesión cerrada: no se pisa
  try { localStorage.setItem(KEY, JSON.stringify({ ...perfil, remoteId, sello, pendiente: pushPendiente, reinicio, dueno: userId || duenoLocal })); }
  catch { /* almacenamiento lleno o bloqueado: se sigue en memoria */ }
}

/* Cambia lo que contiene el perfil sin cambiar el objeto. Lo que llega de la
   nube mientras la persona ya usa la app no debe dejar a una hoja abierta
   escribiendo en un perfil viejo: sigue teniendo en la mano el vigente. */
function fijarPerfil(nuevo) {
  if (!perfil || perfil === nuevo) { perfil = nuevo; return; }
  Object.keys(perfil).forEach((k) => delete perfil[k]);
  Object.assign(perfil, nuevo);
}

function aplicarBlob(v) {
  remoteId = v?.remoteId || null;
  sello = v?.sello || null;
  duenoLocal = v?.dueno || null;
  pushPendiente = !!v?.pendiente;
  reinicio = !!v?.reinicio;
  fijarPerfil(v ? normalizar(v) : freshProfile());
  ['remoteId', 'sello', 'pendiente', 'reinicio', 'dueno'].forEach((k) => delete perfil[k]);
}

export function load() { aplicarBlob(leerLocal()); }

export function save() {
  if (userId) programarPush();
  escribirLocal();
  notify();
}

/* ---------- supabase ---------- */

function programarPush() {
  pushPendiente = true;
  rechazado = false;
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
  if (!userId || !pushPendiente || enVuelo || rechazado) return;
  enVuelo = true;
  const version = cambios;
  const uid = userId;
  const fila = { user_id: userId, nombre: perfil.name, updated_at: new Date().toISOString(), data: perfil };
  try {
    if (!remoteId) {
      // otro dispositivo pudo crear la fila hace un instante: se junta con ella en vez de duplicarla
      const { data: ya, error: e } = await supabase.from('perfiles').select('*').eq('user_id', userId);
      if (e) throw e;
      if (ya?.length) { remoteId = ya[0].id; await juntarConLaNube(); return; }
    }
    const q = supabase.from('perfiles');
    const { data, error } = remoteId
      ? await q.update(fila).eq('id', remoteId).eq('updated_at', sello).select()
      : await q.insert(fila).select();
    // la base permite una fila por cuenta: si otro dispositivo la creó hace un instante, la próxima vuelta la encuentra y se junta con ella
    if (error?.code === '23505') { reintentar(++conflictos > 3 ? 30000 : 0); return; }
    // la base limita cada perfil a 5 MB: reintentar no lo arregla; se avisa en el perfil y se espera a que algo cambie
    if (error?.code === '23514') { rechazado = true; notify(); return; }
    if (error) throw error;
    if (userId !== uid) return; // se cerró la sesión (o entró otra cuenta) mientras subía
    if (!data?.length) { await juntarConLaNube(); return; }
    conflictos = 0;
    fallos = 0;
    remoteId = data[0].id;
    sello = data[0].updated_at;
    if (version === cambios) { pushPendiente = false; reinicio = false; limpiarViejas(); }
    escribirLocal();
    if (pushPendiente) reintentar(2000);
  } catch {
    reintentar(Math.min(60000, 4000 * 2 ** fallos++));
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
    if (!reinicio) fijarPerfil(normalizar(fusionar(perfil, normalizar({ ...fila.data, name: fila.nombre || fila.data?.name }))));
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
  try {
    const mia = localStorage.getItem(KEY);
    if (duenoLocal && duenoLocal !== uid) {
      // la copia local es de otra cuenta: no se mezcla con esta; si traía cambios sin subir, se aparta para cuando vuelva
      if (pushPendiente && mia) localStorage.setItem(`${RETENIDA}${duenoLocal}`, mia);
      limpiarViejas();
      perfil = freshProfile();
      remoteId = null; sello = null; pushPendiente = false; reinicio = false;
    }
    const apartada = localStorage.getItem(`${RETENIDA}${uid}`);
    if (apartada) {
      localStorage.removeItem(`${RETENIDA}${uid}`); // se usa una vez; si venía ilegible, no vuelve a estorbar
      if (!pushPendiente) aplicarBlob(JSON.parse(apartada)); // con cambios propios más nuevos, la apartada ya es vieja
    }
  } catch { /* almacenamiento bloqueado o copia ilegible: se sigue con la nube */ }
  duenoLocal = uid;
  fallos = 0;
  conflictos = 0;
  rechazado = false;
  const { data, error } = await supabase.from('perfiles').select('*').eq('user_id', uid)
    .order('updated_at', { ascending: false });
  if (error) { if (pushPendiente) reintentar(4000); return { migrated: false }; }
  if (data?.length) {
    /* Un solo perfil: si la cuenta traía varios, manda el que se usó por
       última vez. Las otras filas no se tocan. */
    const fila = data.find((r) => r.id === remoteId) || data[0];
    const remoto = normalizar({ ...fila.data, name: fila.nombre || fila.data?.name });
    const antes = fila.data?.recurrentes?.length || 0;
    /* Con cambios locales sin subir la nube no pisa: si nadie más escribió
       (mismo sello) gana lo local; si alguien escribió, se juntan las dos. */
    if (pushPendiente) {
      if (!reinicio && (fila.id !== remoteId || fila.updated_at !== sello)) fijarPerfil(normalizar(fusionar(perfil, remoto)));
      remoteId = fila.id;
      sello = fila.updated_at;
      escribirLocal();
      programarPush();
      notify();
      return { migrated: false, recuperados: 0 };
    }
    reinicio = false;
    remoteId = fila.id;
    sello = fila.updated_at;
    fijarPerfil(remoto);
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

/* Cerrar sesión borra la copia local, salvo que tenga cambios sin subir (por
   ejemplo, la sesión caducó sin red): esos se guardan para subirlos al volver
   a entrar con la misma cuenta. */
// ¿Lo guardado en este dispositivo es de esta cuenta? Entonces se puede mostrar ya, sin esperar a la nube.
export const esDe = (uid) => Boolean(uid) && duenoLocal === uid;

export function signOutLocal() {
  clearTimeout(pushTimer);
  userId = null;
  fallos = 0;
  conflictos = 0;
  rechazado = false;
  if (!pushPendiente) {
    remoteId = null;
    sello = null;
    duenoLocal = null;
    reinicio = false;
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
  }
  limpiarViejas(); // si hay una copia con cambios sin subir, ya lleva todo lo que estas tenían
  perfil = freshProfile();
}

// Quien cierra sesión sabiendo que hay cambios sin subir los descarta.
export function descartarPendiente() { pushPendiente = false; reinicio = false; }

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

const KEY_RESPALDO = 'reparto:respaldo';

// Anota el día de la última copia descargada, para recordar cuándo toca otra.
export function marcarRespaldo(dia) {
  try { localStorage.setItem(KEY_RESPALDO, dia); } catch { /* noop */ }
}
export function ultimoRespaldo() {
  try { return localStorage.getItem(KEY_RESPALDO); } catch { return null; }
}

/* Reemplaza todo por una copia JSON descargada antes. Se parece a "borrar todo"
   en que la nube se sobrescribe (no se junta, o volvería lo que no estaba en la
   copia). Devuelve el perfil anterior para poder deshacer con `restaurar`. */
export function restaurarDesdeJSON(texto) {
  let datos;
  try { datos = JSON.parse(texto); } catch { datos = null; }
  const motivo = motivoDeRechazo(datos);
  if (motivo) throw new Error(motivo);
  const antes = perfil;
  reinicio = true;
  perfil = normalizar({ ...datos, recRecuperados: true });
  save();
  return antes;
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
  if (pushPendiente && rechazado) return 'grande';
  if (pushPendiente && fallos >= 3) return 'error';
  return pushPendiente ? 'subiendo' : 'al-dia';
}

/* Borra todo lo que se registró y deja la cuenta como nueva. Se queda el
   nombre de la persona y el del presupuesto: lo que se vacía son los números. */
export function reiniciar() {
  const antes = perfil;
  reinicio = true;
  limpiarViejas();
  perfil = { ...freshProfile(perfil.name), persona: perfil.persona, recRecuperados: true };
  save();
  return antes;
}

// Devuelve el perfil que había antes de reiniciar (el deshacer de "borrar todos los datos").
export function restaurar(antes) {
  reinicio = false;
  perfil = antes;
  save();
}

// El correo de quien entró: lo guarda main al abrir la sesión y lo leen Inicio y el perfil.
export const correo = () => correoUsuario;
export function setCorreo(c) { correoUsuario = String(c || ''); }
