import { MES } from './metas.js';
import { amount } from './reparto.js';
import { periodoDe, hoyISO, gastoTotal } from './movimientos.js';
import { money, moneyCorto } from '../format.js';

/* F6 — los dos avisos. El problema de estas apps no es que estén mal hechas,
   es que la gente las abre dos veces y las olvida. Todo puro: recibe el
   perfil y una fecha, devuelve los avisos que tocan hoy. */

export const DIAS_AVISO = 5;

export function diasQueQuedan(hoy = new Date()) {
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  return ultimo - hoy.getDate();
}

// se compara a mediodía para que el cambio de horario no corra un día
export function diasHasta(fechaISO, hoy = new Date()) {
  const [a, m, d] = String(fechaISO).split('-').map(Number);
  if (!a || !m || !d) return null;
  const objetivo = new Date(a, m - 1, d, 12);
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12);
  return Math.round((objetivo - base) / 86400000);
}

function dias(n) {
  return `${n} ${n === 1 ? 'día' : 'días'}`;
}

export function fueVisto(marcas, clave, hoy = new Date()) {
  return (marcas || {})[clave] === hoyISO(hoy);
}

// A cinco días del cierre: lo registrado contra lo presupuestado.
export function avisoFinDeMes(p, income, hoy = new Date()) {
  const quedan = diasQueQuedan(hoy);
  if (quedan > DIAS_AVISO) return null;
  const periodo = periodoDe(hoyISO(hoy));
  const registrado = gastoTotal(p.movs || [], periodo);
  const presupuestado = (p.items || []).reduce((s, it) => s + amount(it, income), 0);
  return {
    clave: `cierre-${periodo}`,
    titulo: quedan === 0
      ? `Hoy es el último día de ${MES[hoy.getMonth()]}`
      : `Quedan ${dias(quedan)} de ${MES[hoy.getMonth()]}`,
    cuerpo: `Llevas ${moneyCorto(registrado, p.cur)} registrados de ${moneyCorto(presupuestado, p.cur)} presupuestados. `
      + 'Recuerda revisar y registrar lo que falte antes del cierre automático.',
    urgente: quedan <= 1,
    vistas: ['dashboard', 'movimientos'],
    accion: { label: 'Registrar lo que falta', ruta: 'movimientos' },
  };
}

// A cinco días de la fecha objetivo de una meta, con el porcentaje que lleva.
export function avisosDeMetas(p, hoy = new Date()) {
  return (p.goals || [])
    .filter((g) => g.dueDate && (g.estado || 'activa') === 'activa')
    .map((g) => ({ g, faltan: diasHasta(g.dueDate, hoy) }))
    .filter(({ faltan }) => faltan !== null && faltan >= 0 && faltan <= DIAS_AVISO)
    .map(({ g, faltan }) => {
      const pct = g.t > 0 ? Math.min(100, Math.round(((g.s || 0) / g.t) * 100)) : 0;
      return {
        clave: `meta-${g.id}-${g.dueDate}`,
        titulo: faltan === 0
          ? `Hoy es tu fecha de ${g.n} y llevas el ${pct}%`
          : `Faltan ${dias(faltan)} para tu fecha de ${g.n} y llevas el ${pct}%`,
        cuerpo: `Tienes ${money(g.s || 0, p.cur)} de ${money(g.t || 0, p.cur)}. `
          + (pct >= 100 ? 'Ya la alcanzaste.' : `Te faltan ${money(Math.max(0, (g.t || 0) - (g.s || 0)), p.cur)}.`),
        urgente: faltan <= 1 && pct < 100,
        vistas: ['dashboard', 'metas'],
        accion: { label: 'Ver la meta', ruta: 'metas', goalId: g.id },
      };
    });
}

export function avisosPendientes(p, income, hoy = new Date()) {
  return [avisoFinDeMes(p, income, hoy), ...avisosDeMetas(p, hoy)]
    .filter(Boolean)
    .filter((av) => !fueVisto(p.avisosVistos, av.clave, hoy));
}
