/* Pagos reales por renglón. No hay estructura nueva: lo pagado sale del mismo
   libro de movimientos que ya alimenta el cierre, las alertas y el dashboard.
   Un campo "Pagado" es la suma del mes; escribirlo ajusta el libro. */

import { r2 } from './reparto.js';
import { periodoDe } from './movimientos.js';

export function estadoLinea(pagado, plan, cerrado) {
  if (plan > 0 && pagado > plan) return 'excedido';
  if (cerrado || (plan > 0 && pagado >= plan)) return 'pagado';
  return pagado > 0 ? 'parcial' : 'pendiente';
}

const CERRADAS = ['pagado', 'excedido'];

export function resumenItem(it, pagadoPorLinea = {}, periodo) {
  const filas = (it.L || []).map((l) => {
    const plan = Number(l.v) || 0;
    const pagado = r2(pagadoPorLinea[l.id] || 0);
    return { l, plan, pagado, diferencia: r2(plan - pagado),
      estado: estadoLinea(pagado, plan, l.pagadoEn === periodo) };
  });
  const plan = r2(filas.reduce((s, f) => s + f.plan, 0));
  const pagado = r2(filas.reduce((s, f) => s + f.pagado, 0));
  return { periodo, filas, plan, pagado, diferencia: r2(plan - pagado),
    cerradas: filas.filter((f) => CERRADAS.includes(f.estado)).length, total: filas.length };
}

export function resumenMes(items, pagadoPorLinea = {}, periodo) {
  const cats = items.map((it) => ({ it, ...resumenItem(it, pagadoPorLinea, periodo) }));
  const plan = r2(cats.reduce((s, c) => s + c.plan, 0));
  const pagado = r2(cats.reduce((s, c) => s + c.pagado, 0));
  return { cats, plan, pagado, diferencia: r2(plan - pagado) };
}

function nid() {
  return 'm' + Math.random().toString(36).slice(2, 9);
}

/* Deja el pagado del renglón en `nuevo`. Subir agrega un movimiento; bajar
   recorta los más recientes, porque un gasto negativo en el libro
   descuadraría el ingreso y el cierre. Devuelve la diferencia aplicada. */
export function fijarPagado(movs, it, l, nuevo, fecha) {
  const periodo = periodoDe(fecha);
  const propios = movs.filter((m) => m.tipo === 'gasto' && m.lineId === l.id && periodoDe(m.fecha) === periodo);
  const actual = propios.reduce((s, m) => s + m.monto, 0);
  const d = r2(Math.max(0, nuevo) - actual);
  if (Math.abs(d) < 0.01) return 0;
  if (d > 0) {
    movs.push({ id: nid(), fecha, tipo: 'gasto', monto: d, itemId: it.id, lineId: l.id,
      goalId: null, nota: `Pago ${l.n || 'sin nombre'}`, extra: false });
    return d;
  }
  let falta = -d;
  for (const m of [...propios].reverse()) {
    const quita = Math.min(m.monto, falta);
    m.monto = r2(m.monto - quita);
    falta = r2(falta - quita);
    if (m.monto <= 0) movs.splice(movs.indexOf(m), 1);
    if (falta <= 0) break;
  }
  return d;
}

/* El ahorro repartido son movimientos normales con goalId o itemId: así el
   historial, las metas y la gráfica lo ven sin saber que vino de un cierre.
   Lo que se deja como excedente libre no genera movimiento, por definición. */
export function movimientosDeAhorro(repartos, periodo, fecha, etiqueta) {
  return repartos.filter((r) => r.monto > 0).map((r) => ({
    id: nid(), fecha, tipo: 'gasto', monto: r2(r.monto),
    itemId: r.itemId || null, lineId: null, goalId: r.goalId || null,
    nota: `${etiqueta} → ${r.nombre}`, extra: false,
    origen: 'ahorro', periodoOrigen: periodo,
  }));
}

export function ahorroRepartido(movs, periodo) {
  return movs.filter((m) => m.origen === 'ahorro' && m.periodoOrigen === periodo);
}

/* Promedio real de los renglones variables contra su plan, para ajustar el
   presupuesto con datos y no de memoria. Con un solo mes no hay promedio. */
export function promedioVariables(cierres, minimoMeses = 2) {
  const acc = {};
  cierres.forEach((c) => Object.entries(c.snapshot?.lineas || {}).forEach(([id, l]) => {
    if (l.fixed) return;
    const a = acc[id] || (acc[id] = { nombre: l.nombre, meses: 0, real: 0, plan: 0 });
    a.meses += 1;
    a.real += l.real || 0;
    a.plan = l.plan ?? a.plan;
    a.nombre = l.nombre || a.nombre;
  }));
  return Object.entries(acc)
    .map(([id, a]) => ({ id, nombre: a.nombre, plan: a.plan, meses: a.meses,
      promedio: r2(a.real / a.meses), brecha: r2(a.plan - r2(a.real / a.meses)) }))
    .filter((x) => x.meses >= minimoMeses)
    .sort((a, b) => Math.abs(b.brecha) - Math.abs(a.brecha));
}
