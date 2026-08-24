/* Libro de movimientos. Una sola estructura alimenta metas, cierre de mes,
   alertas de renglón e ingreso extra. Todo puro: recibe el array, devuelve datos. */

export function periodoDe(fecha) {
  return String(fecha).slice(0, 7);
}

// fecha local, no UTC: toISOString() corre el día y al este de Greenwich
// el 1 de mes caería en el periodo anterior
export function hoyISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function enPeriodo(movs, periodo) {
  return movs.filter((m) => periodoDe(m.fecha) === periodo);
}

function acumular(movs, campo) {
  return movs.reduce((acc, m) => {
    const k = m[campo];
    if (k) acc[k] = (acc[k] || 0) + m.monto;
    return acc;
  }, {});
}

export function porItem(movs, periodo) {
  return acumular(enPeriodo(movs, periodo).filter((m) => m.tipo === 'gasto'), 'itemId');
}

export function porLinea(movs, periodo) {
  return acumular(enPeriodo(movs, periodo).filter((m) => m.tipo === 'gasto'), 'lineId');
}

export function ingresoReal(movs, periodo) {
  const ing = enPeriodo(movs, periodo).filter((m) => m.tipo === 'ingreso');
  const extra = ing.filter((m) => m.extra).reduce((s, m) => s + m.monto, 0);
  const total = ing.reduce((s, m) => s + m.monto, 0);
  return { nomina: total - extra, extra, total };
}

export function gastoTotal(movs, periodo) {
  return enPeriodo(movs, periodo)
    .filter((m) => m.tipo === 'gasto')
    .reduce((s, m) => s + m.monto, 0);
}

export function aportesAMeta(movs, goalId) {
  const propios = movs.filter((m) => m.goalId === goalId);
  return {
    total: propios.reduce((s, m) => s + m.monto, 0),
    porPeriodo: acumular(propios.map((m) => ({ ...m, per: periodoDe(m.fecha) })), 'per'),
  };
}

// El blob de perfiles crece con cada movimiento, así que dos años es el techo:
// alcanza para la comparación año contra año y mantiene el jsonb en un tamaño sano.
export function podar(movs, meses = 24, hoy = new Date()) {
  const limite = periodoDe(hoyISO(new Date(hoy.getFullYear(), hoy.getMonth() - meses, 1)));
  return movs.filter((m) => periodoDe(m.fecha) >= limite);
}
