import { r2, clamp, amount, lines, fixedVariableSplit } from './reparto.js';

export const MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function monthlyToward(goal, items, income) {
  return items.reduce((s, it) => s + (amount(it, income) * (Number(goal.a?.[it.id]) || 0)) / 100, 0);
}

export function monthsToGoal(goal, items, income) {
  const faltante = Math.max(0, (goal.t || 0) - (goal.s || 0));
  const m = monthlyToward(goal, items, income);
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

// F4 — escalera de prioridad
export const ESCALERA = [
  'Mínimos de deuda',
  'Fondo de emergencia — 1 mes',
  'Fondo de emergencia — completo',
  'Metas',
  'Inversión largo plazo',
];

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

// F6 — plan de recorte. Nunca toca fijos, mínimos de deuda, ni fondo bajo 1 mes.
export function planRecorte(faltanteMensual, { items, income, fondoCompleto }) {
  const recortes = [];

  const libre = items.find((it) => it.r === 'lib');
  if (libre) {
    const actual = amount(libre, income);
    const piso = income * 0.02;
    if (actual > piso) {
      recortes.push({ id: 'r-libre', bloque: 'Gasto libre', monto: r2(actual - piso), costo: 'baja tu gasto libre al 2% del ingreso' });
    }
  }

  items
    .filter((it) => it.r === 'ese')
    .forEach((it) => {
      const { variable } = fixedVariableSplit(it);
      const monto = r2(variable * 0.2);
      if (monto > 0) {
        recortes.push({ id: `r-var-${it.id}`, bloque: it.n, monto, costo: 'recortas 20% de tus renglones variables' });
      }
    });

  const inv = items.find((it) => it.r === 'lar');
  if (inv) {
    const monto = amount(inv, income);
    if (monto > 0) {
      const meses = faltanteMensual > 0 ? Math.ceil(monto / faltanteMensual) : 1;
      recortes.push({ id: 'r-inv', bloque: 'Inversión largo plazo', monto: r2(monto), costo: `pausas la inversión ${plazo(meses)}` });
    }
  }

  if (fondoCompleto) {
    const cor = items.find((it) => it.r === 'cor');
    if (cor) {
      const monto = amount(cor, income);
      if (monto > 0) {
        recortes.push({ id: 'r-corto', bloque: 'Ahorro corto plazo', monto: r2(monto), costo: 'usas el ahorro corto plazo, tu fondo ya está completo' });
      }
    }
  }

  return recortes;
}

// F7 — tres escenarios comparables
export function escenarios(ahorrado, costo, disponibleHoy, recortesDisponibles) {
  const totalRecortes = recortesDisponibles.reduce((s, r) => s + r.monto, 0);
  const plans = [
    { nombre: 'conservador', cuota: disponibleHoy, sacrificio: 'nada, solo lo que hoy tienes disponible' },
    { nombre: 'equilibrado', cuota: disponibleHoy + totalRecortes * 0.5, sacrificio: 'la mitad de los recortes posibles' },
    { nombre: 'agresivo', cuota: disponibleHoy + totalRecortes, sacrificio: 'todos los recortes posibles' },
  ];
  return plans.map((p) => {
    const rest = Math.max(0, costo - ahorrado);
    const meses = p.cuota > 0 ? Math.ceil(rest / p.cuota) : null;
    return { ...p, meses, fecha: meses ? whenText(meses) : null };
  });
}

// F8 — costo de oportunidad
export function valorFuturo(monto, tasaAnualPct, anios) {
  return monto * Math.pow(1 + tasaAnualPct / 100, anios);
}

export function costoOportunidad(monto, tasaAnualPct = 10) {
  return { vf5: r2(valorFuturo(monto, tasaAnualPct, 5)), vf10: r2(valorFuturo(monto, tasaAnualPct, 10)) };
}

// F2.2 — cuánto se lleva cada meta de un bloque, al mes
export function metasEnItem(goals, item, income) {
  const bloque = amount(item, income);
  return goals
    .filter((g) => g.estado !== 'en_fila' && g.estado !== 'completa')
    .map((g) => ({ goal: g, pct: Number(g.a?.[item.id]) || 0 }))
    .filter((x) => x.pct > 0)
    .map((x) => ({ ...x, monto: r2((bloque * x.pct) / 100) }));
}

// F9 — metas en competencia
export function conflictosDeMetas(goals) {
  const map = {};
  goals.filter((g) => !g.special && (g.estado || 'activa') === 'activa').forEach((g) => {
    Object.entries(g.a || {}).forEach(([itemId, pct]) => {
      if (pct > 0) (map[itemId] = map[itemId] || []).push(g);
    });
  });
  return Object.entries(map)
    .filter(([, list]) => list.length > 1)
    .map(([itemId, list]) => ({ itemId, goals: list }));
}

const RANGO = { alta: 0, media: 1, baja: 2 };

export function secuenciaPlazos(goalsEnConflicto, items, income) {
  const orden = goalsEnConflicto
    .slice()
    .sort((a, b) => (RANGO[a.priority] ?? 1) - (RANGO[b.priority] ?? 1));
  let acumulado = 0;
  return {
    paralelo: orden.map((g) => monthsToGoal(g, items, income)),
    secuencia: orden.map((g) => (acumulado += monthsToGoal(g, items, income) || 0)),
  };
}

// F10 — aportes extra
export function aplicarAporte(goal, monto, fecha = new Date()) {
  goal.s = (goal.s || 0) + monto;
  goal.aportes = goal.aportes || [];
  goal.aportes.push({ fecha: fecha.toISOString(), monto });
  return goal;
}
