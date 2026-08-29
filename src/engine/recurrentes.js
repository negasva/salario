import { periodoDe } from './movimientos.js';

/* F10 — movimientos recurrentes. El arriendo, la suscripción y la cuota del
   carro son los mismos doce veces al año: se guardan una vez y cada mes se
   agregan con un clic. No se crean solos: un movimiento que aparece sin que lo
   pidas es un movimiento que nadie revisa. */

// El día 31 en febrero no existe: se cae al último día del mes
export function fechaEnPeriodo(periodo, dia) {
  const [a, m] = periodo.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  const d = Math.min(Math.max(1, Number(dia) || 1), ultimo);
  return `${periodo}-${String(d).padStart(2, '0')}`;
}

export function yaEstaEnElMes(rec, movs, periodo) {
  return (movs || []).some((m) => m.recId === rec.id && periodoDe(m.fecha) === periodo);
}

export function pendientes(recurrentes, movs, periodo) {
  return (recurrentes || []).filter((r) => !yaEstaEnElMes(r, movs, periodo));
}

export function movDesde(rec, periodo, id) {
  return {
    id,
    fecha: fechaEnPeriodo(periodo, rec.dia),
    tipo: rec.tipo || 'gasto',
    monto: rec.monto,
    itemId: rec.itemId || null,
    lineId: rec.lineId || null,
    goalId: rec.goalId || null,
    nota: rec.nota || '',
    medio: rec.medio || null,
    extra: false,
    abono: !!rec.abono,
    cat: rec.cat || null,
    recId: rec.id,
  };
}
