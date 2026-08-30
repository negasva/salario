/* El color dice qué es la plata, no de qué categoría es.

   Tres significados y nada más: lo que entra es verde, lo que sale es rojo, lo
   que se guarda es amarillo. Antes el color era decorativo —cada categoría
   sacaba el suyo de una paleta rotatoria— y eso hacía que "Gastos recurrentes"
   pudiera salir verde en el dashboard mientras "Ahorros" salía rojo, que es
   exactamente al revés de lo que significan.

   Dentro de un mismo significado, los tonos se van aclarando para poder
   distinguir varias categorías en un donut sin romper la regla: siguen siendo
   todas rojas, pero se diferencian entre sí. */

export const CLASES = ['ingreso', 'gasto', 'ahorro'];

// Los roles de ahorro del reparto: corto y largo plazo.
const ROLES_AHORRO = ['cor', 'lar'];

export function claseDeItem(it) {
  return ROLES_AHORRO.includes(it?.r) ? 'ahorro' : 'gasto';
}

// Una meta siempre es ahorro: es su definición.
export function claseDeMeta() {
  return 'ahorro';
}

/* Un movimiento hacia una meta es ahorro aunque esté guardado como gasto: en
   el libro sale plata, pero para el usuario eso no es un gasto. */
export function claseDeMovimiento(m) {
  if (m?.tipo === 'ingreso') return 'ingreso';
  return m?.goalId ? 'ahorro' : 'gasto';
}

/* El tono `i` dentro de un significado. Hay cuatro y se repiten en ciclo: con
   más de cuatro categorías del mismo tipo, dos comparten tono, que es mejor
   que inventar un color que ya no signifique nada. */
export const TONOS = 4;

export function colorDe(clase, i = 0) {
  const c = CLASES.includes(clase) ? clase : 'gasto';
  return `var(--sem-${c}-${(Math.abs(i) % TONOS) + 1})`;
}

export function colorDeItem(it, i = 0) {
  return colorDe(claseDeItem(it), i);
}
