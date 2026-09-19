/* Gastos (e ingresos) recurrentes: el arriendo, el internet, la cuota del
   carro, el sueldo. Se guardan una vez con su nombre y su estimado, y cada mes
   se marca cuál se pagó y por cuánto.

   Están todos activos siempre. Lo que cambia cada mes es cuáles ya pagaste,
   y eso se marca uno por uno: un movimiento que aparece sin que lo pidas es
   un movimiento que nadie revisa.

   El estimado es solo eso. Hay recibos que no son fijos —el mercado, la luz—
   así que al marcar el pago se escribe lo que de verdad costó y el estimado
   se queda como estaba, para seguir sirviendo de referencia el mes siguiente.
   Un estimado en cero significa "no sé cuánto, lo escribo al pagarlo".

   Un recurrente es { id, n, monto, catId, tipo, dia }. */

import { periodoDe } from './movimientos.js';
import { nuevoId, OTROS } from './categorias.js';

// El día 31 en febrero no existe: se cae al último día del mes.
export function fechaEnPeriodo(periodo, dia) {
  const [a, m] = periodo.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  const d = Math.min(Math.max(1, Number(dia) || 1), ultimo);
  return `${periodo}-${String(d).padStart(2, '0')}`;
}

export function nuevoRecurrente({ n, monto = 0, catId = OTROS, tipo = 'gasto', dia = 1 } = {}) {
  return {
    id: nuevoId(),
    n: String(n || '').trim(),
    monto: Math.max(0, Math.round(Number(monto) || 0)),
    catId: tipo === 'ingreso' ? null : (catId || OTROS),
    tipo: tipo === 'ingreso' ? 'ingreso' : 'gasto',
    dia: Math.min(31, Math.max(1, Math.round(Number(dia) || 1))),
  };
}

// El movimiento con el que se marcó pagado este mes, si ya está.
export function pagoDelMes(rec, movs, periodo) {
  return (movs || []).find((m) => m.recId === rec?.id && periodoDe(m.fecha) === periodo) || null;
}

export function estaPagado(rec, movs, periodo) {
  return !!pagoDelMes(rec, movs, periodo);
}

// Los que todavía no se han marcado en el mes elegido.
export function pendientes(recurrentes, movs, periodo) {
  return (recurrentes || []).filter((r) => !pagoDelMes(r, movs, periodo));
}

export function movDesde(rec, periodo, monto, fecha) {
  return {
    id: nuevoId(),
    fecha: fecha || fechaEnPeriodo(periodo, rec.dia),
    tipo: rec.tipo === 'ingreso' ? 'ingreso' : 'gasto',
    monto: Math.max(0, Math.round(Number(monto ?? rec.monto) || 0)),
    catId: rec.tipo === 'ingreso' ? null : (rec.catId || OTROS),
    nota: rec.n,
    recId: rec.id,
  };
}

/* Marca uno como pagado por lo que de verdad costó. Si ya estaba marcado, se
   corrige ese mismo movimiento en vez de crear otro. Devuelve el movimiento. */
export function marcarPagado(rec, movs, periodo, monto, fecha) {
  const valor = Math.max(0, Math.round(Number(monto ?? rec.monto) || 0));
  if (!(valor > 0)) return null;
  const previo = pagoDelMes(rec, movs, periodo);
  if (previo) {
    previo.monto = valor;
    previo.fecha = fecha || previo.fecha;
    previo.catId = rec.tipo === 'ingreso' ? null : (rec.catId || OTROS);
    return previo;
  }
  const mov = movDesde(rec, periodo, valor, fecha);
  movs.push(mov);
  return mov;
}

// Quita la marca del mes. Devuelve el movimiento que se sacó, para deshacer.
export function quitarPago(rec, movs, periodo) {
  const mov = pagoDelMes(rec, movs, periodo);
  if (!mov) return null;
  movs.splice(movs.indexOf(mov), 1);
  return mov;
}

/* Marca de una vez los que faltan y tienen estimado. Los que no lo tienen se
   quedan: no hay con qué llenarlos sin inventar la cifra. */
export function marcarTodos(recurrentes, movs, periodo, soloIds = null) {
  return pendientes(recurrentes, movs, periodo)
    .filter((r) => (soloIds ? soloIds.includes(r.id) : true))
    .filter((r) => r.monto > 0)
    .map((r) => marcarPagado(r, movs, periodo, r.monto))
    .filter(Boolean);
}

/* Cómo va el mes: cuánto se esperaba, cuánto se lleva pagado y cuántos
   faltan por marcar. */
export function resumen(recurrentes, movs, periodo, tipo = 'gasto') {
  const lista = (recurrentes || []).filter((r) => r.tipo === tipo);
  let estimado = 0;
  let pagado = 0;
  let faltan = 0;
  lista.forEach((r) => {
    estimado += r.monto;
    const mov = pagoDelMes(r, movs, periodo);
    if (mov) pagado += mov.monto; else faltan += 1;
  });
  return { estimado, pagado, faltan, total: lista.length };
}
