import { colorDe } from './semantica.js';
import { amount, r2 } from './reparto.js';
import { enPeriodo } from './movimientos.js';

/* F6 — los segmentos del donut. Todo se deriva del estado en cada llamada:
   nada se guarda, así que registrar un gasto o mover un planeado repinta la
   vista sin que nadie tenga que invalidar un total. */

function conPorcentaje(segmentos, base) {
  const b = Number(base) || 0;
  return segmentos.map((s) => ({ ...s, monto: r2(s.monto), pct: b > 0 ? r2((s.monto / b) * 100) : 0 }));
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
    ...goals.map((g) => ({ id: g.id, nombre: g.n, color: colorDe('ahorro'),
      monto: porMeta[g.id] || 0, plan: Number(g.mes) || 0, meta: true })),
  ].filter((s) => s.monto > 0);

  return conPorcentaje(segmentos, ingreso).map((s) => ({ ...s, diferencia: r2(s.plan - s.monto) }));
}

// Un mes ya cerrado se lee de su snapshot, no del libro: el libro se poda.
export function segmentosDeSnapshot(snapshot) {
  if (!snapshot || snapshot.version < 2) return [];
  const base = snapshot.ingresoReal || snapshot.ingresoPlan || 0;
  const segmentos = [
    ...(snapshot.items || []).map((it, i) => ({ id: it.itemId, nombre: it.nombre, color: colorDe('gasto', i),
      monto: it.real, plan: it.plan })),
    ...(snapshot.metas || []).filter((g) => g.aportado > 0)
      .map((g) => ({ id: g.goalId, nombre: g.nombre, color: colorDe('ahorro'), monto: g.aportado, plan: 0, meta: true })),
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
