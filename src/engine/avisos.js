import { MES } from './metas.js';
import { total } from './reparto.js';
import { periodoDe, hoyISO, gastoTotal } from './movimientos.js';
import { money, moneyCorto } from '../format.js';

/* F6 — los dos avisos. El problema de estas apps no es que estén mal hechas,
   es que la gente las abre dos veces y las olvida. Todo puro: recibe el
   perfil y una fecha, devuelve los avisos que tocan hoy. */

export const DIAS_AVISO = 5;

// El cierre avisa tres veces, cada una más corta que la anterior. Clave
// distinta por día para que avisosVistos y avisosEnviados no se pisen.
export const DIAS_CIERRE = [5, 3, 1];

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

// A 5, 3 y 1 días del cierre. Nada entre medias: avisar todos los días es no avisar.
export function avisoFinDeMes(p, hoy = new Date()) {
  const quedan = diasQueQuedan(hoy);
  if (!DIAS_CIERRE.includes(quedan)) return null;
  const periodo = periodoDe(hoyISO(hoy));
  const mes = MES[hoy.getMonth()];
  const registrado = gastoTotal(p.movs || [], periodo);
  const presupuestado = total(p.items || []);
  const texto = {
    5: {
      titulo: `Quedan ${dias(quedan)} de ${mes}`,
      cuerpo: `Llevas ${moneyCorto(registrado, p.cur)} registrados de ${moneyCorto(presupuestado, p.cur)} asignados a categorías.`,
    },
    3: {
      titulo: `Faltan ${dias(quedan)} para el cierre de ${mes}`,
      cuerpo: 'Revisa lo que no registraste.',
    },
    1: {
      titulo: `Mañana cierro ${mes}`,
      cuerpo: 'Última oportunidad de cuadrar el mes.',
    },
  }[quedan];
  return {
    clave: `cierre-${quedan}-${periodo}`,
    ...texto,
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

/* F11 — la mora es más cara que cualquier tasa que calcules, así que el pago
   de una deuda avisa dos días antes y el mismo día. El renglón puede ser una
   deuda indefinida (solo día de corte cada mes) o tener fecha límite. */
export function avisosDeDeudas(p, hoy = new Date()) {
  const periodo = periodoDe(hoyISO(hoy));
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  return (p.items || [])
    .filter((it) => it.r === 'deu')
    .flatMap((it) => (it.L || []).map((l) => ({ it, l })))
    .filter(({ l }) => Number(l.diaPago) > 0 && Number(l.saldo) > 0)
    .map(({ l }) => {
      const dia = Math.min(Number(l.diaPago), ultimo);
      const faltan = dia - hoy.getDate();
      const cuota = Number(l.minimo) || 0;
      const limite = l.fechaLimite ? diasHasta(l.fechaLimite, hoy) : null;
      return { l, faltan, cuota, limite };
    })
    .filter(({ faltan }) => faltan >= 0 && faltan <= 2)
    .map(({ l, faltan, cuota, limite }) => ({
      clave: `deuda-${l.id}-${periodo}`,
      titulo: faltan === 0
        ? `Hoy se paga ${l.n || 'tu deuda'}`
        : `${faltan === 1 ? 'Mañana' : `En ${dias(faltan)}`} se paga ${l.n || 'tu deuda'}`,
      cuerpo: `${cuota > 0 ? `La cuota es ${money(cuota, p.cur)}. ` : ''}`
        + (limite !== null && limite >= 0
          ? `Esta deuda termina el ${l.fechaLimite}, faltan ${dias(limite)}.`
          : 'Pagar tarde cuesta más que cualquier tasa que hayas calculado.'),
      urgente: faltan === 0,
      vistas: ['dashboard', 'categorias'],
      accion: { label: 'Ver el bloque de deudas', ruta: 'categorias' },
    }));
}

export function avisosPendientes(p, hoy = new Date()) {
  return [avisoFinDeMes(p, hoy), ...avisosDeMetas(p, hoy), ...avisosDeDeudas(p, hoy)]
    .filter(Boolean)
    .filter((av) => !fueVisto(p.avisosVistos, av.clave, hoy));
}
