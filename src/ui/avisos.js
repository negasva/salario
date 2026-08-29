import * as store from '../store.js';
import { avisosPendientes, fueVisto } from '../engine/avisos.js';
import { anuncio } from './anuncio.js';
function irA(route) {
  window.dispatchEvent(new CustomEvent('ir-a-vista', { detail: { route } }));
}

/* Todo lo que la app tiene que decir hoy, en un solo sitio. Cada aviso dice en
   qué vistas aparece: en el dashboard y en la que le toca, no en las cinco. */
function avisosDeHoy() {
  const p = store.active();
  if (!p) return [];
  const lista = [];

  // F6 — fin de mes y metas con fecha encima
  avisosPendientes(p).forEach((av) => {
    lista.push({
      ...av,
      acciones: av.accion ? [{
        label: av.accion.label,
        onClick: () => (av.accion.goalId
          ? window.dispatchEvent(new CustomEvent('ir-a-meta', { detail: { goalId: av.accion.goalId } }))
          : irA(av.accion.ruta)),
      }] : [],
    });
  });

  return lista.filter((av) => !fueVisto(p.avisosVistos, av.clave));
}

let pintando = false;

export function pintarAvisos(route) {
  const cont = document.getElementById('content');
  if (!cont || pintando) return;
  pintando = true;
  try {
    cont.querySelectorAll(':scope > .anuncio').forEach((el) => el.remove());
    // se pintan al revés porque cada uno se cuelga arriba del anterior
    avisosDeHoy()
      .filter((av) => av.vistas.includes(route))
      .reverse()
      .forEach((av) => anuncio({ ...av, onDescartar: () => store.descartarAviso(av.clave) }));
  } finally {
    pintando = false;
  }
}

/* ---------- F6.3 — notificación del navegador ---------- */

export function estadoNotificaciones() {
  if (typeof Notification === 'undefined') return 'no-soportado';
  return Notification.permission;
}

// El permiso se pide desde un botón en Ajustes, nunca al cargar la página:
// pedirlo de entrada es cómo se consigue que lo nieguen para siempre.
export async function pedirPermisoNotificaciones() {
  if (typeof Notification === 'undefined') return 'no-soportado';
  return Notification.requestPermission();
}

/* Al arrancar, si hay avisos y el permiso ya está concedido. Si está negado o
   la API no existe, el anuncio en pantalla es el plan B y la app va igual. */
export function notificarPendientes() {
  if (estadoNotificaciones() !== 'granted') return 0;
  let enviados = 0;
  avisosDeHoy().forEach((av) => {
    if (store.avisoEnviado(av.clave)) return;
    try {
      new Notification(av.titulo, { body: av.cuerpo, tag: av.clave });
      store.marcarAvisoEnviado(av.clave);
      enviados++;
    } catch { /* el navegador puede negarse sin avisar, no es motivo de nada */ }
  });
  return enviados;
}
