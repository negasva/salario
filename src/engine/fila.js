import { monthlyToward } from './metas.js';

// F5 — la fila de metas. Dos metas que compiten por un bloque ya no compiten
// para siempre: se ponen una detrás de otra y el dinero de la que termina pasa
// a la que sigue.

export const DIA_MS = 24 * 60 * 60 * 1000;

export function estadoDe(g) {
  return g.estado || 'activa';
}

// El fondo de emergencia vive en orden 0 y no se mueve de ahí.
function ordenDe(g) {
  return g.special ? 0 : Number(g.orden) || 0;
}

export function ordenadas(goals) {
  return goals.slice().sort((a, b) => ordenDe(a) - ordenDe(b));
}

// Renumera de corrido para que no queden huecos ni empates.
export function reasignar(lista) {
  let i = 1;
  lista.forEach((g) => { g.orden = g.special ? 0 : i++; });
  return lista;
}

function recolocar(goals, id, destino) {
  const lista = ordenadas(goals);
  const fijas = lista.filter((g) => g.special);
  const movibles = lista.filter((g) => !g.special);
  const i = movibles.findIndex((g) => g.id === id);
  const j = typeof destino === 'number' ? destino : movibles.findIndex((g) => g.id === destino);
  if (i < 0 || j < 0 || j >= movibles.length || i === j) return false;
  movibles.splice(j, 0, movibles.splice(i, 1)[0]);
  reasignar([...fijas, ...movibles]);
  return true;
}

// flechas arriba/abajo de la tarjeta
export function mover(goals, id, delta) {
  const movibles = ordenadas(goals).filter((g) => !g.special);
  const i = movibles.findIndex((g) => g.id === id);
  return i < 0 ? false : recolocar(goals, id, i + delta);
}

// arrastrar y soltar: `id` queda donde estaba `sobreId`
export function soltar(goals, id, sobreId) {
  return recolocar(goals, id, sobreId);
}

export function siguienteEnFila(goals) {
  return ordenadas(goals).find((g) => estadoDe(g) === 'en_fila') || null;
}

// una meta activa que ya llegó a su objetivo
export function metaCumplida(goals) {
  return ordenadas(goals).find((g) => estadoDe(g) === 'activa' && (g.t || 0) > 0 && (g.s || 0) >= g.t) || null;
}

export function mezclarAsignacion(base, extra) {
  const out = { ...(base || {}) };
  Object.entries(extra || {}).forEach(([k, v]) => {
    out[k] = Math.min(100, (Number(out[k]) || 0) + (Number(v) || 0));
  });
  return out;
}

/* La meta termina y su asignación pasa entera a la que sigue en la fila.
   `aMano` libera el porcentaje sin repartirlo: lo acomoda el usuario. */
export function aplicarTraspaso(desde, hacia, aMano = false) {
  const asignacion = desde.a || {};
  desde.estado = 'completa';
  desde.a = {};
  if (hacia) {
    hacia.estado = 'activa';
    if (!aMano) hacia.a = mezclarAsignacion(hacia.a, asignacion);
  }
  return { desde, hacia };
}

export function traspasoVencido(traspaso, ahora = Date.now()) {
  return !!traspaso && ahora - (traspaso.creado || 0) >= DIA_MS;
}

/* F5.3 — cuándo arranca cada meta de la fila. Una meta en fila hereda la
   asignación de la que tiene delante, así que su plazo se calcula con esa
   plata, no con la que reclama hoy (que es cero mientras espera). */
export function proyeccion(goals, items, income) {
  const out = {};
  let previa = null;
  let libreEn = 0;
  ordenadas(goals).filter((g) => estadoDe(g) !== 'completa').forEach((g) => {
    const enFila = estadoDe(g) === 'en_fila';
    const a = enFila && previa ? mezclarAsignacion(g.a, previa.a) : g.a;
    const empieza = enFila ? libreEn : 0;
    const mensual = monthlyToward({ a }, items, income);
    const falta = Math.max(0, (g.t || 0) - (g.s || 0));
    const dura = mensual > 0 ? Math.ceil(falta / mensual) : null;
    const fin = empieza === null || dura === null ? null : empieza + dura;
    out[g.id] = { empieza, dura, fin, mensual, predecesor: previa };
    previa = { ...g, a };
    libreEn = fin;
  });
  return out;
}
