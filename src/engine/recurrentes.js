/* Gastos (e ingresos) recurrentes: el arriendo, el internet, la cuota del
   carro, el sueldo. Se guardan una vez con su nombre y su precio, y cada mes
   se agregan al libro con un botón.

   No se crean solos: un movimiento que aparece sin que lo pidas es un
   movimiento que nadie revisa.

   Un recurrente es { id, n, monto, catId, tipo, dia, activo }. */

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
    activo: true,
  };
}

export function activos(recurrentes) {
  return (recurrentes || []).filter((r) => r.activo !== false);
}

export function yaEstaEnElMes(rec, movs, periodo) {
  return (movs || []).some((m) => m.recId === rec.id && periodoDe(m.fecha) === periodo);
}

// Los que todavía no se han agregado al mes elegido.
export function pendientes(recurrentes, movs, periodo) {
  return activos(recurrentes).filter((r) => !yaEstaEnElMes(r, movs, periodo));
}

export function totalDe(recurrentes, tipo = 'gasto') {
  return activos(recurrentes).filter((r) => r.tipo === tipo).reduce((s, r) => s + r.monto, 0);
}

export function movDesde(rec, periodo) {
  return {
    id: nuevoId(),
    fecha: fechaEnPeriodo(periodo, rec.dia),
    tipo: rec.tipo === 'ingreso' ? 'ingreso' : 'gasto',
    monto: rec.monto,
    catId: rec.tipo === 'ingreso' ? null : (rec.catId || OTROS),
    nota: rec.n,
    recId: rec.id,
  };
}

/* Agrega al libro los recurrentes que falten del mes y devuelve los
   movimientos creados, para poder deshacer. */
export function agregarAlMes(recurrentes, movs, periodo, soloIds = null) {
  const lista = pendientes(recurrentes, movs, periodo)
    .filter((r) => (soloIds ? soloIds.includes(r.id) : true))
    .filter((r) => r.monto > 0);
  const nuevos = lista.map((r) => movDesde(r, periodo));
  movs.push(...nuevos);
  return nuevos;
}
