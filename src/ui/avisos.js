import * as store from '../store.js';
import { vencimientos, cuandoVence } from '../engine/recurrentes.js';
import { hoyISO } from '../engine/movimientos.js';
import { money } from '../format.js';

/* Avisos de vencimiento con las notificaciones del sistema. Sin servidor de
   push, el aviso sale cuando abres la app o vuelves a ella, una vez al día y
   solo si lo activaste en este dispositivo. Para avisos aunque no abras la
   app está el calendario (.ics), que los pone en el calendario del teléfono. */

const PREF = 'reparto:avisos';
const ULTIMO = 'reparto:avisos-dia';

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

export function avisosSoportados() {
  return 'Notification' in window;
}

export function avisosActivos() {
  return avisosSoportados() && Notification.permission === 'granted' && leer(PREF) === '1';
}

export async function activarAvisos() {
  if (!avisosSoportados()) return false;
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return false;
  escribir(PREF, '1');
  escribir(ULTIMO, '');
  avisarVencimientos();
  return true;
}

export function desactivarAvisos() {
  escribir(PREF, '0');
}

export async function avisarVencimientos() {
  const p = store.active();
  if (!p || !avisosActivos()) return;
  const hoy = hoyISO();
  if (leer(ULTIMO) === hoy) return;
  // hoy, mañana y los vencidos: lo de más adelante ya se ve en Inicio
  const lista = vencimientos(p.recurrentes, p.movs, hoy, 1);
  escribir(ULTIMO, hoy);
  if (!lista.length) return;
  const titulo = lista.length === 1
    ? `${lista[0].rec.n} ${cuandoVence(lista[0].en)}`
    : `${lista.length} pagos por hacer`;
  const cuerpo = lista.slice(0, 4).map((v) => `${v.rec.n}: ${cuandoVence(v.en)}${v.monto ? ` · ${money(v.monto)}` : ''}`).join('\n');
  const opciones = { body: cuerpo, icon: '/icono.svg', tag: 'vencimientos', data: { url: '/#recurrentes' } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(titulo, opciones);
    else new Notification(titulo, opciones);
  } catch { /* el navegador no dejó: el aviso sigue en Inicio */ }
}
