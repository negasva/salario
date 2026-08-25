import { amount, r2 } from './reparto.js';
import { periodoDe, hoyISO, porItem, porLinea, ingresoReal, aportesAMeta } from './movimientos.js';

/* El cierre de mes. Los snapshots viejos traen cuatro campos y no llevan
   `version`: todo lo que lea los campos ricos tiene que mirar version >= 2. */

export function periodoAnterior(periodo) {
  const [a, m] = periodo.split('-').map(Number);
  const d = new Date(a, m - 2, 1);
  return periodoDe(hoyISO(d));
}

// Los meses cerrados que faltan, del más viejo al más nuevo. Si el usuario no
// abre la app en tres meses, al volver se cierran los tres de una.
export function periodosPendientes(periodosCerrados, movs = [], hoy = new Date(), maximo = 12) {
  const actual = periodoDe(hoyISO(hoy));
  const hechos = new Set(periodosCerrados);
  // solo meses en los que el usuario registró algo: una cuenta recién abierta
  // no tiene por qué llenarse de cierres vacíos hacia atrás
  const vividos = new Set(movs.map((m) => periodoDe(m.fecha)));
  const faltan = [];
  let per = periodoAnterior(actual);
  // el tope cuenta meses recorridos, no meses empujados: contando empujados,
  // un historial sin movimientos nunca saldría del bucle
  for (let i = 0; i < maximo && !hechos.has(per); i++) {
    if (vividos.has(per)) faltan.push(per);
    per = periodoAnterior(per);
  }
  return faltan.reverse();
}

export function construirSnapshot(p, periodo, income, previo = {}) {
  const gastos = porItem(p.movs, periodo);
  const lineas = porLinea(p.movs, periodo);
  const ing = ingresoReal(p.movs, periodo);
  const ese = p.items.find((it) => it.r === 'ese');
  const cor = p.items.find((it) => it.r === 'cor');
  const lar = p.items.find((it) => it.r === 'lar');

  return {
    version: 2,
    inc: p.inc,
    cur: p.cur,
    ingresoPlan: income,
    ingresoReal: ing.total,
    ingresoExtra: ing.extra,
    items: p.items.map((it) => ({
      itemId: it.id, nombre: it.n, pct: it.p,
      plan: r2(amount(it, income)), real: r2(gastos[it.id] || 0),
    })),
    // se guarda el renglon aunque no se haya pagado: un mes en cero tambien
    // cuenta para el promedio, y sin `plan` no hay contra que compararlo
    lineas: Object.fromEntries(p.items.flatMap((it) => (it.L || [])
      .filter((l) => lineas[l.id] || Number(l.v) > 0)
      .map((l) => [l.id, { nombre: l.n, itemId: it.id, plan: Number(l.v) || 0,
        fixed: l.fixed !== false, real: r2(lineas[l.id] || 0) }]))),
    metas: p.goals.map((g) => ({
      goalId: g.id, nombre: g.n,
      aportado: r2(aportesAMeta(p.movs, g.id).porPeriodo[periodo] || 0),
      acumulado: r2(g.s || 0),
    })),
    essentialsShare: ese?.p || 0,
    ahorroRate: r2((cor?.p || 0) + (lar?.p || 0)),
    borrador: true,
    nota: '',
    cerradoEn: new Date().toISOString(),
    ...previo,
  };
}

// La frase del mes: cuánto se planeó, cuánto se gastó, y quién se pasó más.
export function brechaDelMes(snapshot) {
  if (snapshot?.version < 2 || !snapshot?.items) return null;
  const plan = r2(snapshot.items.reduce((s, i) => s + i.plan, 0));
  const real = r2(snapshot.items.reduce((s, i) => s + i.real, 0));
  const excesos = snapshot.items
    .map((i) => ({ nombre: i.nombre, exceso: r2(i.real - i.plan) }))
    .filter((i) => i.exceso > 0)
    .sort((a, b) => b.exceso - a.exceso);
  return { plan, real, diferencia: r2(real - plan), culpable: excesos[0] || null };
}

export function aportadoEnCierre(snapshot) {
  if (snapshot?.version < 2 || !snapshot?.metas) return 0;
  return r2(snapshot.metas.reduce((s, m) => s + m.aportado, 0));
}
