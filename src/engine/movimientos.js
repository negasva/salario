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

// Flujo real del mes: cada movimiento se cuenta una sola vez.
export function resumenFlujo(movs, periodo) {
  const ingresos = ingresoReal(movs, periodo).total;
  const gastos = gastoTotal(movs, periodo);
  return { ingresos, gastos, saldo: ingresos - gastos };
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

/* Serie mensual de ahorro para la gráfica del dashboard.
   destino: null (todo) | 'meta:<goalId>' | 'item:<itemId>' | 'deuda'.
   Con destino null hay que decirle qué bloques cuentan como ahorro
   (los de rol cor y lar): el movimiento no guarda el rol, solo el itemId.
   Cada movimiento se cuenta una sola vez aunque caiga en dos categorías. */
export function serieAhorro(movs, destino = null, meses = 12, itemsAhorro = [], hoy = new Date()) {
  const periodos = Array.from({ length: meses }, (_, i) => periodoDe(
    hoyISO(new Date(hoy.getFullYear(), hoy.getMonth() - (meses - 1 - i), 1))));
  const cuenta = (m) => {
    if (m.tipo !== 'gasto') return false;
    if (destino === 'deuda') return !!m.abono;
    if (destino?.startsWith('meta:')) return m.goalId === destino.slice(5);
    if (destino?.startsWith('item:')) return m.itemId === destino.slice(5);
    return !!m.goalId || !!m.abono || itemsAhorro.includes(m.itemId);
  };
  const porPeriodo = {};
  movs.filter(cuenta).forEach((m) => {
    const per = periodoDe(m.fecha);
    porPeriodo[per] = (porPeriodo[per] || 0) + m.monto;
  });
  let acumulado = 0;
  return periodos.map((periodo) => {
    const monto = porPeriodo[periodo] || 0;
    acumulado += monto;
    return { periodo, monto, acumulado };
  });
}

/* Tasa de ahorro mes a mes desde el libro, no desde los cierres: así hay
   tendencia desde el primer mes y no desde el tercero. */
export function serieTasaAhorro(movs, itemsAhorro = [], meses = 6, hoy = new Date()) {
  return serieAhorro(movs, null, meses, itemsAhorro, hoy).map(({ periodo, monto }) => {
    const ing = ingresoReal(movs, periodo).total;
    return { periodo, tasa: ing > 0 ? Math.round((monto / ing) * 1000) / 10 : 0 };
  });
}

/* Ritmo del mes: a día 25 gastarse el 95% del bloque no es lo mismo que a día 5.
   Compara lo real contra lo que tocaría llevar a estas alturas. */
export function ritmoDelMes(real, presupuesto, hoy = new Date()) {
  const dias = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const esperado = (presupuesto || 0) * (hoy.getDate() / dias);
  return {
    esperado,
    delta: (real || 0) - esperado,
    pct: esperado > 0 ? Math.round((((real || 0) - esperado) / esperado) * 100) : 0,
  };
}
