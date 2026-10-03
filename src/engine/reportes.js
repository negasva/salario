/* Reportes: lo que se puede leer de los movimientos más allá del saldo.
   Todo puro, igual que el resto del motor. Un día es 'AAAA-MM-DD' y un mes
   'AAAA-MM'. Los gastos son los movimientos tipo gasto, ahorro incluido: lo
   apartado sale del saldo, así que `tasaAhorro` lo suma de vuelta. */

import { enPeriodo, hoyISO, periodoDe, resumenFlujo, gastoPorCategoria, sumarMeses } from './movimientos.js';
import { compararMeses } from './comparar.js';
import { money } from '../format.js';

export function diasDelMes(periodo) {
  const [a, m] = periodo.split('-').map(Number);
  return new Date(a, m, 0).getDate();
}

// Días que ya pasaron del mes: todos si es pasado, ninguno si es futuro.
export function diasTranscurridos(periodo, hoy = hoyISO()) {
  const actual = periodoDe(hoy);
  if (periodo < actual) return diasDelMes(periodo);
  if (periodo > actual) return 0;
  return Number(hoy.slice(8, 10));
}

// Cada día del mes con lo que salió y lo que entró.
export function flujoDiario(movs, periodo) {
  const dias = Array.from({ length: diasDelMes(periodo) }, (_, i) => ({ dia: i + 1, gasto: 0, ingreso: 0 }));
  enPeriodo(movs, periodo).forEach((m) => {
    const d = dias[Number(m.fecha.slice(8, 10)) - 1];
    if (d) d[m.tipo === 'ingreso' ? 'ingreso' : 'gasto'] += m.monto;
  });
  return dias;
}

// Gasto acumulado día a día; después de `hasta` queda en null para que la línea pare.
export function acumulado(dias, hasta = dias.length) {
  let t = 0;
  return dias.map((d) => (d.dia <= hasta ? (t += d.gasto) : null));
}

const lunesPrimero = (fecha) => {
  const [a, m, d] = fecha.split('-').map(Number);
  return (new Date(a, m - 1, d).getDay() + 6) % 7;
};

/* El gasto de todos los días y no el de las cuotas: lo que sale de un
   recurrente (arriendo, servicios) o va a ahorro es plata que ya estaba
   decidida, y un solo pago grande tapa los hábitos que se quieren ver. */
export const esVariable = (m, ahorroId = null) => m.tipo === 'gasto' && !m.recId && !(ahorroId && m.catId === ahorroId);

// Gasto variable del mes por día de la semana, de lunes (0) a domingo (6).
export function porDiaSemana(movs, periodo, ahorroId = null) {
  const t = Array(7).fill(0);
  enPeriodo(movs, periodo).forEach((m) => { if (esVariable(m, ahorroId)) t[lunesPrimero(m.fecha)] += m.monto; });
  return t;
}

/* Calendario de calor: la rejilla del mes con lunes primero. `nivel` va de 0
   (sin gasto) a 4 y se reparte por cuartiles entre los días con gasto, como
   en el calendario de GitHub: un solo día carísimo no apaga a los demás. Las
   celdas vacías del inicio alinean el día 1 con su día de la semana. */
export function calor(movs, periodo) {
  const dias = flujoDiario(movs, periodo);
  const con = dias.filter((d) => d.gasto > 0).map((d) => d.gasto).sort((a, b) => a - b);
  const nivel = (g) => {
    if (g <= 0) return 0;
    if (con.length === 1) return 4;
    const menores = con.filter((x) => x < g).length;
    return 1 + Math.min(3, Math.floor((menores / (con.length - 1)) * 4));
  };
  return { vacias: lunesPrimero(`${periodo}-01`), celdas: dias.map((d) => ({ ...d, nivel: nivel(d.gasto) })) };
}

export function topGastos(movs, periodo, n = 5) {
  return enPeriodo(movs, periodo).filter((m) => m.tipo === 'gasto')
    .sort((a, b) => b.monto - a.monto).slice(0, n);
}

/* Las cifras del mes. `promedioDiario` es el gasto variable de cada día, sin
   recurrentes ni ahorro. `proyeccion` suma ese ritmo a lo ya gastado hasta fin
   de mes, y solo existe mientras el mes está en curso: lo fijo que falta por
   pagar ya lo cuenta la proyección de Inicio. */
export function resumenReporte(movs, periodo, { hoy = hoyISO(), ahorroId = null } = {}) {
  const dias = flujoDiario(movs, periodo);
  const { ingresos, gastos } = resumenFlujo(movs, periodo);
  const apartado = enPeriodo(movs, periodo)
    .filter((m) => m.tipo === 'gasto' && m.catId === ahorroId).reduce((t, m) => t + m.monto, 0);
  const variable = enPeriodo(movs, periodo).filter((m) => esVariable(m, ahorroId)).reduce((t, m) => t + m.monto, 0);
  const pasados = diasTranscurridos(periodo, hoy);
  const promedioDiario = pasados ? Math.round(variable / pasados) : 0;
  return {
    gastos, ingresos, apartado, variable, pasados, total: dias.length, promedioDiario,
    neto: ingresos - gastos,
    tasaAhorro: ingresos > 0 ? Math.round(((ingresos - gastos + apartado) / ingresos) * 100) : null,
    proyeccion: pasados > 0 && pasados < dias.length ? gastos + promedioDiario * (dias.length - pasados) : null,
    diaMasCaro: dias.reduce((b, d) => (d.gasto > (b?.gasto || 0) ? d : b), null),
    diasConGasto: dias.filter((d) => d.gasto > 0).length,
  };
}

// Gasto mensual por categoría en los últimos n meses: { catId: [mes1 … mesN] }.
export function tendenciaCategorias(movs, periodo, meses = 6) {
  const serie = Array.from({ length: meses }, (_, i) => gastoPorCategoria(movs, sumarMeses(periodo, -(meses - 1 - i))));
  const ids = new Set(serie.flatMap((s) => Object.keys(s)));
  return Object.fromEntries([...ids].map((id) => [id, serie.map((s) => s[id] || 0)]));
}

/* El año completo: doce meses con lo que entró, lo que salió y lo que sobró,
   el mejor y el peor mes, y de dónde se fue la plata. */
export function resumenAnual(movs, anio) {
  const meses = Array.from({ length: 12 }, (_, i) => {
    const periodo = `${anio}-${String(i + 1).padStart(2, '0')}`;
    const f = resumenFlujo(movs, periodo);
    return { periodo, ingresos: f.ingresos, gastos: f.gastos, neto: f.saldo, activo: f.ingresos + f.gastos > 0 };
  });
  const activos = meses.filter((m) => m.activo);
  const suma = (k) => meses.reduce((t, m) => t + m[k], 0);
  const porCat = {};
  movs.forEach((m) => {
    if (m.tipo === 'gasto' && m.fecha.startsWith(`${anio}-`)) porCat[m.catId || 'otros'] = (porCat[m.catId || 'otros'] || 0) + m.monto;
  });
  return {
    meses, porCat,
    ingresos: suma('ingresos'), gastos: suma('gastos'), neto: suma('neto'),
    mejor: activos.reduce((b, m) => (!b || m.neto > b.neto ? m : b), null),
    peor: activos.reduce((b, m) => (!b || m.neto < b.neto ? m : b), null),
  };
}

/* Lo que se le diría a alguien mirando el mes, en frases. Cada una lleva un
   `tono` ('mal' si cuesta plata, 'bien' si la ahorra, 'info') y un `ic` para
   la vista. Salen primero los avisos de presupuesto, que son lo accionable. */
export function insights(movs, periodo, { cats = [], hoy = hoyISO(), ahorroId = null } = {}) {
  const r = resumenReporte(movs, periodo, { hoy, ahorroId });
  if (!r.gastos && !r.ingresos) return [];
  const out = [];
  const porCat = gastoPorCategoria(movs, periodo);
  cats.filter((c) => c.tipo === 'gasto' && c.m > 0).forEach((c) => {
    const gastado = porCat[c.id] || 0;
    if (gastado > c.m) out.push({ tono: 'mal', ic: 'alerta', texto: `Te pasaste del presupuesto de ${c.n} por ${money(gastado - c.m)}.` });
    else if (gastado >= c.m * 0.8) out.push({ tono: 'info', ic: 'meta', texto: `${c.n} ya va en ${Math.round((gastado / c.m) * 100)} % de su presupuesto.` });
  });
  const prev = sumarMeses(periodo, -1);
  const enCurso = r.pasados > 0 && r.pasados < r.total;
  const acPrev = acumulado(flujoDiario(movs, prev));
  const antes = r.pasados ? acPrev[Math.min(r.pasados, acPrev.length) - 1] : 0;
  if (antes > 0 && r.pasados > 0) {
    const pct = Math.round(((r.gastos - antes) / antes) * 100);
    out.push(pct > 0 ? { tono: 'mal', ic: 'sube', texto: `Llevas ${pct} % más gastado que el mes pasado${enCurso ? ' a esta altura' : ''}.` }
      : pct < 0 ? { tono: 'bien', ic: 'baja', texto: `Llevas ${-pct} % menos gastado que el mes pasado${enCurso ? ' a esta altura' : ''}.` }
        : { tono: 'info', ic: 'meta', texto: `Vas igual que el mes pasado${enCurso ? ' a esta altura' : ''}.` });
  }
  const c = compararMeses(movs, cats, periodo, 'anterior', { hastaDia: enCurso ? r.pasados : 31 });
  const sube = c.filas.find((f) => f.tipo === 'gasto' && f.id !== ahorroId && f.delta > 0);
  if (sube) out.push({ tono: 'mal', ic: 'sube', texto: `Lo que más subió fue ${sube.nombre}: ${money(sube.delta)} más${sube.pct !== null ? ` (+${sube.pct} %)` : ''}.` });
  const rPrev = resumenReporte(movs, prev, { hoy, ahorroId });
  if (r.proyeccion !== null && rPrev.gastos > 0) {
    const d = r.proyeccion - rPrev.gastos;
    out.push({ tono: d > 0 ? 'mal' : 'bien', ic: d > 0 ? 'sube' : 'baja', texto: `Al ritmo de hoy cerrarías ${money(Math.abs(d))} ${d > 0 ? 'por encima' : 'por debajo'} del mes pasado.` });
  }
  return out.slice(0, 4);
}
