/* El ahorro y sus metas.

   El ahorro es lo que registras como gasto en la categoría Ahorro: plata que
   sale del saldo del mes y se guarda aparte. Sacar del ahorro es lo contrario,
   un ingreso marcado con `retiro: true` que la devuelve al saldo. El total
   ahorrado es lo guardado menos lo sacado, y siempre se muestra entero.

   Una meta no aparta plata a mano: se lleva un porcentaje de lo que ahorras.
   Llantas al 30 % con objetivo de 2.000.000 arranca con el 30 % de lo que ya
   tenías (si así lo pides) y cada mes se lleva el 30 % de lo que ahorres ese
   mes, hasta completar. Lo que ninguna meta se lleva queda libre.

   Una meta es { id, n, objetivo, pct, desde 'AAAA-MM', inicial, usada? }.
   `usada` ({ fecha, monto, movId }) es cuando ya la gastaste: deja de sumar y
   su plata sale del total. */

import { clave, nuevoId, OTROS_ING } from './categorias.js';
import { periodoDe, sumarMeses } from './movimientos.js';

export function catAhorro(cats) {
  return (cats || []).find((c) => c.tipo === 'gasto' && clave(c.n) === 'ahorro') || null;
}

// Lo guardado cada mes: { 'AAAA-MM': monto }.
export function ahorroPorMes(movs, catId) {
  return (movs || []).reduce((acc, m) => {
    if (m.tipo === 'gasto' && m.catId === catId) {
      const p = periodoDe(m.fecha);
      acc[p] = (acc[p] || 0) + m.monto;
    }
    return acc;
  }, {});
}

export function retiros(movs) {
  return (movs || []).filter((m) => m.retiro);
}

export function ahorroTotal(movs, catId) {
  const guardado = Object.values(ahorroPorMes(movs, catId)).reduce((t, v) => t + v, 0);
  const sacado = retiros(movs).reduce((t, m) => t + m.monto, 0);
  return guardado - sacado;
}

export function nuevaMeta({ n, objetivo = 0, pct = 0, desde, inicial = 0 } = {}) {
  return {
    id: nuevoId(),
    n: String(n || '').trim(),
    objetivo: Math.max(0, Math.round(Number(objetivo) || 0)),
    pct: Math.min(100, Math.max(0, Math.round(Number(pct) || 0))),
    desde,
    inicial: Math.max(0, Math.round(Number(inicial) || 0)),
  };
}

export function normalizarMetas(metas) {
  return (Array.isArray(metas) ? metas : []).map((m) => ({
    ...m,
    objetivo: Math.max(0, Math.round(Number(m.objetivo) || 0)),
    pct: Math.min(100, Math.max(0, Math.round(Number(m.pct) || 0))),
    inicial: Math.max(0, Math.round(Number(m.inicial) || 0)),
  }));
}

/* Cuánto lleva una meta hasta `hasta` (incluido): lo inicial más su
   porcentaje de cada mes desde que se creó, sin pasarse del objetivo. Una
   meta usada se queda con lo que tenía cuando la usaste. */
export function progresoMeta(meta, porMes, hasta) {
  if (meta.usada) return meta.usada.monto;
  let llevado = meta.inicial || 0;
  Object.entries(porMes).forEach(([per, monto]) => {
    if (per >= meta.desde && per <= hasta) llevado += (monto * meta.pct) / 100;
  });
  llevado = Math.round(llevado);
  return meta.objetivo > 0 ? Math.min(meta.objetivo, llevado) : llevado;
}

/* Lo que ahorras al mes, promedio de los últimos `n` meses cerrados (sin
   contar el que va corriendo). Es el ritmo con el que se calcula cuándo
   llega cada meta. */
export function ritmoMensual(porMes, periodo, n = 3) {
  let t = 0;
  for (let i = 1; i <= n; i += 1) t += porMes[sumarMeses(periodo, -i)] || 0;
  return Math.round(t / n);
}

/* Todo lo que la pantalla necesita: total, libre, este mes y cada meta con
   su avance y en cuántos meses llega al ritmo de hoy. */
export function estadoAhorro(p, periodo) {
  const cat = catAhorro(p.cats);
  if (!cat) return null;
  const porMes = ahorroPorMes(p.movs, cat.id);
  const total = ahorroTotal(p.movs, cat.id);
  const ritmo = ritmoMensual(porMes, periodo);
  const metas = (p.metas || []).map((m) => {
    const llevado = progresoMeta(m, porMes, periodo);
    const falta = Math.max(0, m.objetivo - llevado);
    const aporte = Math.round((ritmo * m.pct) / 100);
    const meses = !m.usada && falta > 0 && aporte > 0 ? Math.ceil(falta / aporte) : null;
    return {
      meta: m,
      llevado,
      falta,
      pctAvance: m.objetivo > 0 ? Math.min(100, Math.round((llevado / m.objetivo) * 100)) : 0,
      completa: m.objetivo > 0 && falta === 0,
      esteMes: Math.round(((porMes[periodo] || 0) * m.pct) / 100),
      meses,
      llega: meses ? sumarMeses(periodo, meses) : null,
    };
  });
  const abiertas = metas.filter((x) => !x.meta.usada);
  const asignado = abiertas.reduce((t, x) => t + x.llevado, 0);
  const libre = total - asignado;
  /* Lo libre sin lo que entró libre este mes. Una meta nueva arranca con su
     porcentaje de esto: lo de este mes ya se lo lleva por el reparto mensual,
     y tomarlo también al arrancar lo contaría dos veces. */
  const libreEsteMes = (porMes[periodo] || 0) - abiertas.reduce((t, x) => t + x.esteMes, 0);
  return {
    cat,
    total,
    esteMes: porMes[periodo] || 0,
    ritmo,
    asignado,
    libre,
    libreAntes: Math.max(0, libre - Math.max(0, libreEsteMes)),
    pctUsado: abiertas.filter((x) => !x.completa).reduce((t, x) => t + x.meta.pct, 0),
    metas,
  };
}

// Con cuánto arranca una meta nueva si toma su porcentaje de lo que está libre.
export function inicialSugerido(libre, pct) {
  return Math.max(0, Math.round((Math.max(0, libre) * pct) / 100));
}

/* Sacar plata del ahorro: un ingreso que vuelve al saldo. Si es para una
   meta, la meta queda usada con lo que llevaba. */
export function retiro(monto, fecha, nota, metaId = null) {
  const m = {
    id: nuevoId(), fecha, tipo: 'ingreso', monto: Math.max(0, Math.round(Number(monto) || 0)),
    catId: OTROS_ING, nota, retiro: true,
  };
  if (metaId) m.metaId = metaId;
  return m;
}
