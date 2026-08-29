import { r2, fixedVariableSplit } from './reparto.js';

export const MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/* F5 — lo que la meta guarda al mes es una cifra que el usuario escribe, y
   nada más. Antes se armaba repartiéndola entre las categorías, y ese reparto
   era la mitad de la complejidad de la app para una pregunta que se contesta
   con una resta. */
export function monthlyToward(goal) {
  return Math.max(0, Number(goal?.mes) || 0);
}

// La única pregunta de una meta: con lo que guardo al mes, ¿cuándo llego?
export function monthsToGoal(goal) {
  const faltante = Math.max(0, (goal?.t || 0) - (goal?.s || 0));
  const m = monthlyToward(goal);
  if (m <= 0) return null;
  return Math.ceil(faltante / m);
}

export function plazo(n) {
  return `${n} ${n === 1 ? 'mes' : 'meses'}`;
}

export function whenText(months, from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return `${MES[d.getMonth()]} de ${d.getFullYear()}`;
}

// F3 — fondo de emergencia. Objetivo: fijos + 50% de variables, por N meses (F11)
export function emergencyTarget(essentialItems, months = 4) {
  const essentialsMonth = essentialItems.reduce((s, it) => {
    const { fixed, variable } = fixedVariableSplit(it);
    return s + fixed + variable * 0.5;
  }, 0);
  return { oneMonth: essentialsMonth, target: essentialsMonth * months };
}

export function emergencyStatus(saved, oneMonth, target) {
  if (saved < oneMonth) return 'critico';
  if (saved < target) return 'parcial';
  return 'completo';
}

export function escalonActual(estado) {
  if (!estado.minimosDeudaCubiertos) return 1;
  if (estado.fondoEstado === 'critico') return 2;
  if (estado.fondoEstado === 'parcial') return 3;
  if (!estado.tieneMetasActivas) return 4;
  return 5;
}

// F5 — cuanto hay que guardar al mes para llegar en N meses
export function cuotaPorMeses(costo, ahorrado, meses) {
  const faltante = Math.max(0, (costo || 0) - (ahorrado || 0));
  const n = Math.max(0, Math.floor(meses) || 0);
  if (n <= 0) return { meses: 0, cuota: faltante };
  return { meses: n, cuota: r2(faltante / n) };
}

// F5 — lo mismo, pero el plazo sale de una fecha objetivo
export function cuotaPorFecha(costo, ahorrado, fechaObjetivo, hoy = new Date()) {
  const meses = (fechaObjetivo.getFullYear() - hoy.getFullYear()) * 12
    + (fechaObjetivo.getMonth() - hoy.getMonth());
  return cuotaPorMeses(costo, ahorrado, meses);
}
