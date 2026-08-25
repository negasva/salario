export function r2(x) {
  return Math.round(x * 100) / 100;
}

export function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

export function lines(item) {
  return item.L || (item.L = []);
}

/* El reparto se define en plata, no en porcentajes: `it.m` es lo que asignas
   a la categoría este mes y es la única fuente de verdad. El porcentaje sigue
   existiendo, pero como número derivado para leer de un vistazo. */
export function amount(item) {
  return Number(item?.m) || 0;
}

export function total(items) {
  return r2(items.reduce((s, it) => s + amount(it), 0));
}

export function shareOf(item, income) {
  return income > 0 ? r2((amount(item) / income) * 100) : 0;
}

/* La cuenta del mes: lo repartido contra lo que entra. Si sobra, dice cuánto
   falta por repartir; si no alcanza, por cuánto te pasaste. Un peso de
   diferencia no es un descuadre, así que el margen es de una unidad. */
export function balance(items, income) {
  const asignado = total(items);
  const dif = r2((Number(income) || 0) - asignado);
  return {
    asignado,
    ingreso: Number(income) || 0,
    dif,
    falta: Math.max(0, dif),
    exceso: Math.max(0, -dif),
    cuadrado: Math.abs(dif) <= 1,
  };
}

export function spentInItem(item) {
  return lines(item).reduce((s, l) => s + (Number(l.v) || 0), 0);
}

export function spentAll(items) {
  return items.reduce((s, it) => s + spentInItem(it), 0);
}

// ponytail: sin renglones el bloque completo cuenta como fijo, es el default seguro
export function fixedVariableSplit(item) {
  const ls = lines(item);
  const fixed = ls.filter((l) => l.fixed !== false).reduce((s, l) => s + (Number(l.v) || 0), 0);
  const variable = ls.filter((l) => l.fixed === false).reduce((s, l) => s + (Number(l.v) || 0), 0);
  return { fixed, variable };
}

/* F5.2 — una meta en fila guarda su `a` pero no consume el bloque: no le baja
   el tope a las que sí están corriendo. Lo que guarda `a` es plata: cuántos
   pesos de esa categoría se lleva la meta cada mes. */
export function claimedBy(goals, itemId, skip) {
  return goals.reduce((s, g) => (g !== skip && g.estado !== 'en_fila' ? s + (Number(g.a?.[itemId]) || 0) : s), 0);
}

export function claimedAll(goals, itemId) {
  return claimedBy(goals, itemId, null);
}

export function freeFor(goals, goal, item) {
  const tope = amount(item);
  return r2(clamp(tope - claimedBy(goals, item.id, goal), 0, tope));
}

// F1 — diagnóstico de esenciales
export function diagnosticoEsenciales(item, income) {
  const sum = spentInItem(item);
  const share = income > 0 ? (sum / income) * 100 : 0;
  const nivel = share <= 50 ? 'verde' : share <= 65 ? 'ambar' : 'rojo';
  const top3 =
    nivel === 'rojo'
      ? [...lines(item)]
          .sort((a, b) => (b.v || 0) - (a.v || 0))
          .slice(0, 3)
          .map((l) => ({ n: l.n, v: l.v, pct: income > 0 ? (l.v / income) * 100 : 0 }))
      : [];
  return { sum, share: r2(share), nivel, top3 };
}
