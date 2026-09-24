/* Comparar un mes contra otro, categoría por categoría: cuánto fue, cuánto
   había sido y cuánto cambió. La base puede ser el mes anterior o el promedio
   de los tres meses anteriores, que suaviza un mes raro. */

import { enPeriodo, sumarMeses } from './movimientos.js';

function porCategoria(movs, periodo) {
  return enPeriodo(movs, periodo).reduce((acc, m) => {
    const k = `${m.tipo}:${m.catId || (m.tipo === 'ingreso' ? 'otros-ingreso' : 'otros')}`;
    acc[k] = (acc[k] || 0) + m.monto;
    return acc;
  }, {});
}

function cambio(actual, antes) {
  const delta = actual - antes;
  return { actual, antes, delta, pct: antes > 0 ? Math.round((delta / antes) * 100) : null };
}

export function compararMeses(movs, cats, periodo, base = 'anterior') {
  const meses = base === 'promedio' ? [1, 2, 3] : [1];
  const ahora = porCategoria(movs, periodo);
  const antes = {};
  meses.forEach((i) => {
    Object.entries(porCategoria(movs, sumarMeses(periodo, -i))).forEach(([k, v]) => {
      antes[k] = (antes[k] || 0) + v / meses.length;
    });
  });
  const claves = new Set([...Object.keys(ahora), ...Object.keys(antes)]);
  const filas = [...claves].map((k) => {
    const [tipo, id] = k.split(':');
    const c = (cats || []).find((x) => x.id === id);
    return {
      id, tipo, nombre: c?.n || (tipo === 'ingreso' ? 'Otros ingresos' : 'Otros'), color: c?.c || '#64748B',
      ...cambio(ahora[k] || 0, Math.round(antes[k] || 0)),
    };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const suma = (tipo, campo) => filas.filter((f) => f.tipo === tipo).reduce((t, f) => t + f[campo], 0);
  return {
    filas,
    gastos: cambio(suma('gasto', 'actual'), suma('gasto', 'antes')),
    ingresos: cambio(suma('ingreso', 'actual'), suma('ingreso', 'antes')),
  };
}
