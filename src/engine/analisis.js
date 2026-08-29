import { amount, r2 } from './reparto.js';
import { enPeriodo } from './movimientos.js';

/* F6 — los segmentos del donut. Todo se deriva del estado en cada llamada:
   nada se guarda, así que registrar un gasto o mover un planeado repinta la
   vista sin que nadie tenga que invalidar un total. */

export const COLOR_SIN_ASIGNAR = 'var(--pink-wash)';
export const COLOR_AHORRO = 'var(--ink-lighter)';
export const PCT_AHORRO_SUGERIDO = 20;

function conPorcentaje(segmentos, base) {
  const b = Number(base) || 0;
  return segmentos.map((s) => ({ ...s, monto: r2(s.monto), pct: b > 0 ? r2((s.monto / b) * 100) : 0 }));
}

/* Planeado: lo que asignaste a cada categoría y a cada meta. Lo que sobra sale
   partido en dos, el ahorro que la app sugiere y lo que de verdad no tiene
   dueño, porque no es lo mismo no haber decidido que haber decidido ahorrar. */
export function segmentosPlaneado(items = [], goals = [], ingreso = 0) {
  const base = Number(ingreso) || 0;
  const segmentos = [
    ...items.map((it) => ({ id: it.id, nombre: it.n, color: it.c, monto: amount(it) })),
    ...goals.filter((g) => g.estado !== 'completa' && (Number(g.mes) || 0) > 0)
      .map((g) => ({ id: g.id, nombre: g.n, color: 'var(--warning)', monto: Number(g.mes) || 0, meta: true })),
  ].filter((s) => s.monto > 0);

  const asignado = segmentos.reduce((s, x) => s + x.monto, 0);
  const libre = Math.max(0, r2(base - asignado));
  if (libre > 0) {
    const sugerido = Math.min(libre, r2((base * PCT_AHORRO_SUGERIDO) / 100));
    if (sugerido > 0) {
      segmentos.push({ id: '_ahorro', nombre: `Ahorro sugerido (${PCT_AHORRO_SUGERIDO}%)`,
        color: COLOR_AHORRO, monto: sugerido, sugerido: true });
    }
    const sinAsignar = r2(libre - sugerido);
    if (sinAsignar > 0) {
      segmentos.push({ id: '_libre', nombre: 'Sin asignar', color: COLOR_SIN_ASIGNAR,
        monto: sinAsignar, sinAsignar: true });
    }
  }
  return conPorcentaje(segmentos, base);
}

/* Real: lo que de verdad salió. Un gasto cuenta en su categoría; un aporte a
   una meta cuenta en la meta y no en la categoría, para no sumarlo dos veces. */
export function segmentosReal(items = [], goals = [], movs = [], periodo, ingreso = 0) {
  const delMes = enPeriodo(movs, periodo).filter((m) => m.tipo === 'gasto');
  const porItem = {};
  const porMeta = {};
  delMes.forEach((m) => {
    if (m.goalId) porMeta[m.goalId] = (porMeta[m.goalId] || 0) + m.monto;
    else if (m.itemId) porItem[m.itemId] = (porItem[m.itemId] || 0) + m.monto;
  });

  const segmentos = [
    ...items.map((it) => ({ id: it.id, nombre: it.n, color: it.c,
      monto: porItem[it.id] || 0, plan: amount(it) })),
    ...goals.map((g) => ({ id: g.id, nombre: g.n, color: 'var(--warning)',
      monto: porMeta[g.id] || 0, plan: Number(g.mes) || 0, meta: true })),
  ].filter((s) => s.monto > 0);

  return conPorcentaje(segmentos, ingreso).map((s) => ({ ...s, diferencia: r2(s.plan - s.monto) }));
}

// Un mes ya cerrado se lee de su snapshot, no del libro: el libro se poda.
export function segmentosDeSnapshot(snapshot, modo = 'real') {
  if (!snapshot || snapshot.version < 2) return [];
  const base = modo === 'real'
    ? (snapshot.ingresoReal || snapshot.ingresoPlan || 0)
    : (snapshot.ingresoPlan || 0);
  const segmentos = [
    ...(snapshot.items || []).map((it) => ({ id: it.itemId, nombre: it.nombre, color: 'var(--pink)',
      monto: modo === 'real' ? it.real : it.plan, plan: it.plan })),
    ...(snapshot.metas || []).filter((g) => g.aportado > 0)
      .map((g) => ({ id: g.goalId, nombre: g.nombre, color: 'var(--warning)', monto: g.aportado, plan: 0, meta: true })),
  ].filter((s) => s.monto > 0);
  return conPorcentaje(segmentos, base).map((s) => ({ ...s, diferencia: r2(s.plan - s.monto) }));
}

/* Arcos del donut sobre un círculo de circunferencia `c`. Cada segmento lleva
   su dasharray y su offset ya calculados: el SVG solo los escribe. */
export function arcos(segmentos, c = 100) {
  let acumulado = 0;
  const suma = segmentos.reduce((s, x) => s + x.monto, 0);
  if (!(suma > 0)) return [];
  return segmentos.map((s) => {
    const largo = (s.monto / suma) * c;
    const arco = { ...s, largo: r2(largo), resto: r2(c - largo), offset: r2(-acumulado) };
    acumulado += largo;
    return arco;
  });
}
