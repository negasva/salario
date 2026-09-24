/* Gastos (e ingresos) recurrentes: el arriendo, el internet, la cuota del
   carro, el mercado, el sueldo. Se guardan una vez con su nombre y su
   estimado, y cada mes se va anotando lo que se pagó.

   Están todos activos siempre. Lo que cambia cada mes es cuánto llevas
   pagado de cada uno, y eso se anota a mano: un movimiento que aparece sin
   que lo pidas es un movimiento que nadie revisa.

   Un pago puede ser de una vez (el arriendo) o por partes (el mercado: 130 en
   el Éxito, 200 en el D1, 30 en domicilios). Cada parte es un movimiento con
   su nota y su fecha, así que también sale en Movimientos y en las gráficas.
   El estimado funciona como presupuesto del mes: lo que queda es el estimado
   menos lo que llevas, y el estimado nunca se mueve por lo que pagues.
   Un estimado en cero significa "no sé cuánto, lo voy sumando".

   Una deuda en cuotas (el carro, el celular) es un recurrente con fin:
   `cuotas: { total, desde: 'AAAA-MM' }`. Solo aparece en los meses que le
   tocan, dice qué cuota va y cuánto falta en total.

   Un recurrente es { id, n, monto, catId, tipo, dia, cuotas? }. Sus pagos son
   los movimientos del mes con `recId` igual a su id. */

import { periodoDe, hoyISO, sumarMeses } from './movimientos.js';
import { nuevoId, OTROS } from './categorias.js';

// El día 31 en febrero no existe: se cae al último día del mes.
export function fechaEnPeriodo(periodo, dia) {
  const [a, m] = periodo.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  const d = Math.min(Math.max(1, Number(dia) || 1), ultimo);
  return `${periodo}-${String(d).padStart(2, '0')}`;
}

/* La fecha con la que se abre un pago nuevo: hoy si se está mirando el mes
   en curso, y si no, el día del mes que tiene el recurrente. */
export function fechaSugerida(rec, periodo, hoy = hoyISO()) {
  return periodoDe(hoy) === periodo ? hoy : fechaEnPeriodo(periodo, rec?.dia);
}

export function nuevoRecurrente({ n, monto = 0, catId = OTROS, tipo = 'gasto', dia = 1, cuotas = null } = {}) {
  const r = {
    id: nuevoId(),
    n: String(n || '').trim(),
    monto: Math.max(0, Math.round(Number(monto) || 0)),
    catId: tipo === 'ingreso' ? null : (catId || OTROS),
    tipo: tipo === 'ingreso' ? 'ingreso' : 'gasto',
    dia: Math.min(31, Math.max(1, Math.round(Number(dia) || 1))),
  };
  const c = normalizarCuotas(cuotas);
  if (c) r.cuotas = c;
  return r;
}

/* ---------- deudas en cuotas ---------- */

// { total, desde } válido, o null si no es una deuda.
export function normalizarCuotas(c) {
  const total = Math.round(Number(c?.total) || 0);
  if (!(total > 0) || !/^\d{4}-\d{2}$/.test(String(c?.desde || ''))) return null;
  return { total, desde: c.desde };
}

// Meses de `a` a `b` ('AAAA-MM'): de agosto a octubre son 2.
export function mesesEntre(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

// Qué cuota toca en el mes (1 es la primera), o null si no es una deuda.
export function numeroCuota(rec, periodo) {
  if (!rec?.cuotas) return null;
  return mesesEntre(rec.cuotas.desde, periodo) + 1;
}

// El mes de la última cuota.
export function mesFinal(rec) {
  return rec?.cuotas ? sumarMeses(rec.cuotas.desde, rec.cuotas.total - 1) : null;
}

// Un recurrente normal va todos los meses; una deuda, solo en los suyos.
export function activoEn(rec, periodo) {
  const n = numeroCuota(rec, periodo);
  return n === null || (n >= 1 && n <= rec.cuotas.total);
}

/* Cómo va una deuda: cuánto era en total (cuotas × estimado), cuánto llevas
   pagado sumando todos sus meses y cuánto falta. Contar lo pagado de verdad,
   y no las cuotas, hace que un abono extra o una cuota a medias se vean. */
export function estadoDeuda(rec, movs, periodo) {
  if (!rec?.cuotas) return null;
  const { total, desde } = rec.cuotas;
  const fin = mesFinal(rec);
  const deuda = total * (rec.monto || 0);
  const pagado = (movs || [])
    .filter((m) => m.recId === rec.id && periodoDe(m.fecha) >= desde && periodoDe(m.fecha) <= fin)
    .reduce((t, m) => t + m.monto, 0);
  const falta = Math.max(0, deuda - pagado);
  const n = numeroCuota(rec, periodo);
  const cuota = Math.min(total, Math.max(0, n));
  let estado = 'en curso';
  if (n < 1) estado = 'por empezar';
  else if (falta === 0 && deuda > 0) estado = 'pagada';
  else if (n > total) estado = 'vencida';
  return { total, cuota, deuda, pagado, falta, fin, estado };
}

const entero = (v) => Math.max(0, Math.round(Number(v) || 0));

// Los pagos de este mes, del primero al último.
export function pagosDelMes(rec, movs, periodo) {
  return (movs || [])
    .filter((m) => m.recId === rec?.id && periodoDe(m.fecha) === periodo)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

export function estaPagado(rec, movs, periodo) {
  return pagosDelMes(rec, movs, periodo).length > 0;
}

/* Cómo va uno en el mes. `estado` es 'pendiente' (nada todavía), 'parcial'
   (lleva algo pero no llega al estimado) o 'pagado'. Sin estimado, con un
   pago ya cuenta como pagado: no hay contra qué medir lo que falta. */
export function estadoDelMes(rec, movs, periodo) {
  const pagos = pagosDelMes(rec, movs, periodo);
  const pagado = pagos.reduce((t, m) => t + m.monto, 0);
  const estimado = rec?.monto || 0;
  const queda = estimado > 0 ? Math.max(0, estimado - pagado) : 0;
  const pasado = estimado > 0 ? Math.max(0, pagado - estimado) : 0;
  let estado = 'pagado';
  if (!pagos.length) estado = 'pendiente';
  else if (queda > 0) estado = 'parcial';
  return { pagos, pagado, queda, pasado, estado };
}

// Los que tocan en el mes elegido y todavía no tienen ni un pago.
export function pendientes(recurrentes, movs, periodo) {
  return (recurrentes || []).filter((r) => activoEn(r, periodo) && !estaPagado(r, movs, periodo));
}

function notaDe(rec, nota) {
  return String(nota ?? '').trim() || rec.n;
}

export function movDesde(rec, periodo, monto, fecha, nota) {
  return {
    id: nuevoId(),
    fecha: fecha || fechaEnPeriodo(periodo, rec.dia),
    tipo: rec.tipo === 'ingreso' ? 'ingreso' : 'gasto',
    monto: entero(monto ?? rec.monto),
    catId: rec.tipo === 'ingreso' ? null : (rec.catId || OTROS),
    nota: notaDe(rec, nota),
    recId: rec.id,
  };
}

/* Anota un pago (completo o una parte). Siempre crea un movimiento nuevo:
   dos idas al supermercado son dos pagos. La nota es dónde o en qué; sin
   nota se usa el nombre del recurrente. Devuelve el movimiento. */
export function abonar(rec, movs, periodo, monto, { fecha, nota } = {}) {
  const valor = entero(monto);
  if (!(valor > 0)) return null;
  const mov = movDesde(rec, periodo, valor, fecha, nota);
  movs.push(mov);
  return mov;
}

// Paga de una vez lo que le falta para llegar al estimado.
export function pagarLoQueFalta(rec, movs, periodo, opciones = {}) {
  const { queda } = estadoDelMes(rec, movs, periodo);
  return queda > 0 ? abonar(rec, movs, periodo, queda, opciones) : null;
}

// Corrige un pago ya anotado. La categoría sigue a la del recurrente.
export function editarAbono(rec, mov, { monto, fecha, nota } = {}) {
  const valor = entero(monto ?? mov?.monto);
  if (!mov || !(valor > 0)) return null;
  mov.monto = valor;
  if (fecha) mov.fecha = fecha;
  if (nota !== undefined) mov.nota = notaDe(rec, nota);
  mov.catId = rec.tipo === 'ingreso' ? null : (rec.catId || OTROS);
  return mov;
}

// Saca un pago. Devuelve dónde estaba, para poder deshacer.
export function quitarAbono(mov, movs) {
  const i = movs.indexOf(mov);
  if (i >= 0) movs.splice(i, 1);
  return i;
}

/* Las notas que ya se usaron en este recurrente, de la más reciente a la más
   vieja y sin repetir: el Éxito, el D1, domicilios. Sirven de atajo. */
export function notasUsadas(rec, movs, limite = 6) {
  const vistas = new Set();
  return (movs || [])
    .filter((m) => m.recId === rec?.id && m.nota && m.nota !== rec.n)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
    .map((m) => m.nota)
    .filter((n) => { const k = n.toLowerCase(); if (vistas.has(k)) return false; vistas.add(k); return true; })
    .slice(0, limite);
}

/* Paga de una vez, por su estimado, los que no tienen ni un pago. Los que no
   tienen estimado se quedan: no hay con qué llenarlos sin inventar la cifra. */
export function marcarTodos(recurrentes, movs, periodo, soloIds = null) {
  return pendientes(recurrentes, movs, periodo)
    .filter((r) => (soloIds ? soloIds.includes(r.id) : true))
    .filter((r) => r.monto > 0)
    .map((r) => abonar(r, movs, periodo, r.monto))
    .filter(Boolean);
}

/* Cómo va el mes: cuánto se esperaba, cuánto se lleva pagado, cuánto queda
   por pagar de los que tienen estimado y cuántos no tienen ni un pago. */
export function resumen(recurrentes, movs, periodo, tipo = 'gasto') {
  const lista = (recurrentes || []).filter((r) => r.tipo === tipo && activoEn(r, periodo));
  let estimado = 0;
  let pagado = 0;
  let queda = 0;
  let faltan = 0;
  lista.forEach((r) => {
    const e = estadoDelMes(r, movs, periodo);
    estimado += r.monto;
    pagado += e.pagado;
    queda += e.queda;
    if (e.estado === 'pendiente') faltan += 1;
  });
  return { estimado, pagado, queda, faltan, total: lista.length };
}

/* ---------- lo que viene ---------- */

// Días de `a` a `b` ('AAAA-MM-DD'), negativo si `b` ya pasó.
export function diasEntre(a, b) {
  const f = (x) => { const [y, m, d] = x.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((f(b) - f(a)) / 86400000);
}

/* Los gastos que vencen pronto y no tienen ni un pago: los de este mes que
   ya pasaron (vencidos) y los que caen en los próximos `dias`, aunque sean
   del mes siguiente. Del más urgente al más lejano. */
export function vencimientos(recurrentes, movs, hoy = hoyISO(), dias = 7) {
  const actual = periodoDe(hoy);
  const lista = [];
  [actual, sumarMeses(actual, 1)].forEach((per) => {
    (recurrentes || []).forEach((rec) => {
      if (rec.tipo !== 'gasto' || !activoEn(rec, per) || estaPagado(rec, movs, per)) return;
      const fecha = fechaEnPeriodo(per, rec.dia);
      const en = diasEntre(hoy, fecha);
      if (en > dias || (per !== actual && en < 0)) return;
      lista.push({ rec, periodo: per, fecha, en, monto: rec.monto });
    });
  });
  return lista.sort((a, b) => a.en - b.en);
}

// 'vence hoy', 'vence mañana', 'vence en 3 días', 'venció hace 2 días'
export function cuandoVence(en) {
  if (en === 0) return 'vence hoy';
  if (en === 1) return 'vence mañana';
  if (en > 1) return `vence en ${en} días`;
  if (en === -1) return 'venció ayer';
  return `venció hace ${-en} días`;
}

/* Si pagas (y recibes) lo que falta de los recurrentes, con cuánto terminas
   el mes. Parte del "terminas con" de hoy. */
export function proyeccion(final, recurrentes, movs, periodo) {
  const g = resumen(recurrentes, movs, periodo, 'gasto');
  const i = resumen(recurrentes, movs, periodo, 'ingreso');
  return { final: final - g.queda + i.queda, porPagar: g.queda, porRecibir: i.queda };
}

/* Los recurrentes como calendario (.ics): un evento cada mes el día que toca,
   con aviso la víspera a las 9 de la mañana. El 31 cae en el último día de
   los meses cortos. Una deuda solo repite las cuotas que le faltan. */
export function calendarioICS(recurrentes, hoy = hoyISO(), sello = new Date()) {
  const esc = (t) => String(t).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const plata = (v) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(v);
  const dtstamp = sello.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const actual = periodoDe(hoy);
  const eventos = (recurrentes || []).filter((r) => r.tipo === 'gasto').map((r) => {
    let per = actual;
    let count = '';
    if (r.cuotas) {
      if (actual < r.cuotas.desde) per = r.cuotas.desde;
      const quedan = r.cuotas.total - (numeroCuota(r, per) - 1);
      if (quedan <= 0) return null;
      count = `;COUNT=${quedan}`;
    }
    const inicio = fechaEnPeriodo(per, r.dia).replace(/-/g, '');
    const dias = r.dia > 28 ? `${Array.from({ length: r.dia - 27 }, (_, i) => 28 + i).join(',')};BYSETPOS=-1` : String(r.dia);
    return [
      'BEGIN:VEVENT',
      `UID:${r.id}@reparto-mensual`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${inicio}`,
      `RRULE:FREQ=MONTHLY;BYMONTHDAY=${dias}${count}`,
      `SUMMARY:${esc(`Pagar ${r.n}${r.monto ? ` ($ ${plata(r.monto)})` : ''}`)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`Mañana: ${r.n}`)}`,
      'TRIGGER:-PT15H',
      'END:VALARM',
      'END:VEVENT',
    ].join('\r\n');
  }).filter(Boolean);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Reparto mensual//ES', 'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Pagos del mes', ...eventos, 'END:VCALENDAR'].join('\r\n');
}
