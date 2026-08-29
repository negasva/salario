/* Pagos reales por renglón. No hay estructura nueva: lo pagado sale del mismo
   libro de movimientos que ya alimenta el cierre, las alertas y el dashboard.
   Un campo "Pagado" es la suma del mes; escribirlo ajusta el libro. */

import { r2 } from './reparto.js';
import { periodoDe } from './movimientos.js';

/* Un mes que no alcanzó para pagar un renglón no se borra: lo que quedó
   debiendo se pasa al mes siguiente y ahí el renglón vale el doble. `l.arrastre`
   guarda, por periodo, cuánta plata llega arrastrada de atrás. */
export function siguientePeriodo(periodo) {
  const [a, m] = String(periodo).split('-').map(Number);
  return m >= 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

export function mesAnterior(periodo) {
  const [a, m] = String(periodo).split('-').map(Number);
  return m <= 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

export function arrastreDe(l, periodo) {
  return Number(l?.arrastre?.[periodo]) || 0;
}

// Lo que ese renglón cuesta este mes: su plan de siempre más lo que viene debiendo
export function planDeLinea(l, periodo) {
  return r2((Number(l?.v) || 0) + arrastreDe(l, periodo));
}

export function pasarAlSiguiente(l, periodo, monto) {
  const m = r2(monto);
  if (!(m > 0)) return 0;
  l.arrastre = l.arrastre || {};
  const destino = siguientePeriodo(periodo);
  l.arrastre[destino] = r2(arrastreDe(l, destino) + m);
  return l.arrastre[destino];
}

export function quitarArrastre(l, periodo) {
  if (!l?.arrastre) return false;
  delete l.arrastre[periodo];
  return true;
}

export function estadoLinea(pagado, plan, cerrado) {
  if (plan > 0 && pagado > plan) return 'excedido';
  if (cerrado || (plan > 0 && pagado >= plan)) return 'pagado';
  return pagado > 0 ? 'parcial' : 'pendiente';
}

/* Cuánto se llena el bloque: lo pagado sobre lo planeado, tope 100. Pasarse
   no pinta más del 100%, se marca con el color de exceso. */
export function pctPagado(pagado, plan) {
  const pct = plan > 0 ? (pagado / plan) * 100 : pagado > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

const CERRADAS = ['pagado', 'excedido'];

export function resumenItem(it, pagadoPorLinea = {}, periodo, pagadoLibre = 0) {
  const filas = (it.L || []).map((l) => {
    const arrastre = arrastreDe(l, periodo);
    const plan = planDeLinea(l, periodo);
    const pagado = r2(pagadoPorLinea[l.id] || 0);
    return { l, plan, arrastre, pagado, diferencia: r2(plan - pagado),
      pendiente: Math.max(0, r2(plan - pagado)),
      estado: estadoLinea(pagado, plan, l.pagadoEn === periodo) };
  });
  const plan = r2(filas.reduce((s, f) => s + f.plan, 0));
  const pagado = r2(filas.reduce((s, f) => s + f.pagado, 0) + (Number(pagadoLibre) || 0));
  /* Un gasto variable (mercado, gasolina) casi nunca cae justo en el plan:
     contarlo como pendiente porque le faltaron mil pesos es ruido. Con
     cualquier pago del mes ya está al día. Los fijos siguen con la regla dura. */
  const cerradas = filas.filter((f) => (f.l.fixed === false
    ? f.pagado > 0 || f.l.pagadoEn === periodo
    : CERRADAS.includes(f.estado)));

  /* Lo que la categoría cuesta de verdad este mes: el plan de cada renglón
     corregido por la realidad en los que ya se cerraron. Un renglón pagado
     aporta lo que pagaste —de menos o de más—; uno que sigue abierto aporta
     lo planeado, porque de ese todavía no hay noticia. Sale igual que
     plan − lo ahorrado + lo que se pasó, contando solo los ya pagados. */
  const ahorrado = r2(cerradas.reduce((s, f) => s + Math.max(0, f.diferencia), 0));
  const excedido = r2(cerradas.reduce((s, f) => s + Math.max(0, -f.diferencia), 0));

  return { periodo, filas, plan, pagado, diferencia: r2(plan - pagado),
    ahorrado, excedido, costo: r2(plan - ahorrado + excedido),
    cerradas: cerradas.length, total: filas.length };
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

/* Un renglón como "Mercado" se paga en varias compras y en varios sitios. Cada
   una entra como su propio movimiento y la suma del mes es lo pagado: por eso
   no hay un campo total que sobreescribir, solo pagos que se agregan y se
   borran uno por uno. */
export function agregarPago(movs, it, l, monto, fecha, nota) {
  const m = r2(monto);
  if (!(m > 0)) return null;
  const mov = { id: nid(), fecha, tipo: 'gasto', monto: m, itemId: it.id, lineId: l.id,
    goalId: null, nota: nota || `Pago ${l.n || 'sin nombre'}`, extra: false };
  movs.push(mov);
  return mov;
}

export function agregarPagoLibre(movs, it, monto, fecha, nota) {
  const m = r2(monto);
  if (!(m > 0)) return null;
  const mov = { id: nid(), fecha, tipo: 'gasto', monto: m, itemId: it.id, lineId: null,
    goalId: null, nota: nota || 'Pago', extra: false };
  movs.push(mov);
  return mov;
}

export function pagosLibresDeItem(movs, itemId, periodo) {
  return movs
    .filter((m) => m.tipo === 'gasto' && m.itemId === itemId && !m.lineId && !m.goalId && periodoDe(m.fecha) === periodo)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Los pagos de ese renglón en ese mes, del más viejo al más nuevo
export function pagosDeLinea(movs, lineId, periodo) {
  return movs
    .filter((m) => m.tipo === 'gasto' && m.lineId === lineId && periodoDe(m.fecha) === periodo)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function quitarPago(movs, id) {
  const i = movs.findIndex((m) => m.id === id);
  if (i < 0) return false;
  movs.splice(i, 1);
  return true;
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

/* Borrar un renglón o una categoría se lleva sus pagos. Si no, quedan
   movimientos huérfanos: el buscador los sigue encontrando y, al recrear el
   gasto con el mismo nombre, salen las dos versiones. Devuelve lo quitado
   para poder deshacer. */
export function quitarMovsDe(movs, campo, id) {
  const fuera = movs.filter((m) => m[campo] === id);
  fuera.forEach((m) => movs.splice(movs.indexOf(m), 1));
  return fuera;
}

/* Perfiles viejos ya traen pagos huérfanos de renglones y categorías borrados
   antes de que el borrado se los llevara. Se limpian al cargar, una vez. */
export function sinHuerfanos(movs = [], items = []) {
  const itemIds = new Set(items.map((it) => it.id));
  const lineIds = new Set(items.flatMap((it) => (it.L || []).map((l) => l.id)));
  return movs.filter((m) => (!m.itemId || itemIds.has(m.itemId)) && (!m.lineId || lineIds.has(m.lineId)));
}
