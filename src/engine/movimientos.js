/* El libro de movimientos. Todo puro: recibe el array, devuelve datos.
   Un movimiento es { id, fecha 'AAAA-MM-DD', tipo 'ingreso'|'gasto', monto,
   catId, nota }. Los ingresos no llevan categoría. */

export function periodoDe(fecha) {
  return String(fecha).slice(0, 7);
}

// fecha local, no UTC: toISOString() corre el día y al este de Greenwich
// el 1 de mes caería en el periodo anterior
export function hoyISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function periodoActual(d = new Date()) {
  return periodoDe(hoyISO(d));
}

// 'AAAA-MM' desplazado n meses (negativo hacia atrás)
export function sumarMeses(periodo, n) {
  const [a, m] = periodo.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return periodoDe(hoyISO(d));
}

export function enPeriodo(movs, periodo) {
  return movs.filter((m) => periodoDe(m.fecha) === periodo);
}

export function delMes(movs, periodo) {
  return enPeriodo(movs, periodo).slice()
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

function signo(m) {
  return m.tipo === 'ingreso' ? m.monto : -m.monto;
}

// Flujo del mes: lo que entró y lo que salió, cada movimiento contado una vez.
export function resumenFlujo(movs, periodo) {
  let ingresos = 0;
  let gastos = 0;
  enPeriodo(movs, periodo).forEach((m) => {
    if (m.tipo === 'ingreso') ingresos += m.monto; else gastos += m.monto;
  });
  return { ingresos, gastos, saldo: ingresos - gastos };
}

/* El arrastre. Con qué empieza un mes: el saldo inicial declarado más todo
   lo que entró menos todo lo que salió ANTES de ese mes. Agosto que cierra en
   −100.000 hace que septiembre empiece en −100.000. */
export function saldoInicial(base, movs, periodo) {
  return movs.filter((m) => periodoDe(m.fecha) < periodo)
    .reduce((t, m) => t + signo(m), Number(base) || 0);
}

// Saldo acumulado hasta hoy, sin filtro: un saldo es acumulado o no es un saldo.
export function saldoActual(base, movs) {
  return movs.reduce((t, m) => t + signo(m), Number(base) || 0);
}

/* Lo que cada pantalla muestra en su cabecera:
   empezaste con → entró → salió → terminas con. */
export function resumenMes(base, movs, periodo) {
  const inicial = saldoInicial(base, movs, periodo);
  const { ingresos, gastos } = resumenFlujo(movs, periodo);
  return { inicial, ingresos, gastos, final: inicial + ingresos - gastos };
}

// Gasto del mes agrupado por categoría: { catId: monto }
export function gastoPorCategoria(movs, periodo) {
  return enPeriodo(movs, periodo).reduce((acc, m) => {
    if (m.tipo !== 'gasto') return acc;
    const k = m.catId || 'otros';
    acc[k] = (acc[k] || 0) + m.monto;
    return acc;
  }, {});
}

/* Serie de los últimos n meses terminando en `periodo`, para las barras de
   ingreso contra gasto y la línea de saldo. */
export function serieMensual(base, movs, periodo, meses = 6) {
  return Array.from({ length: meses }, (_, i) => {
    const per = sumarMeses(periodo, -(meses - 1 - i));
    return { periodo: per, ...resumenMes(base, movs, per) };
  });
}
