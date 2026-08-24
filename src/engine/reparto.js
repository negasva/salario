export function r2(x) {
  return Math.round(x * 100) / 100;
}

export function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

export function lines(item) {
  return item.L || (item.L = []);
}

export function total(items) {
  return r2(items.reduce((s, it) => s + (Number(it.p) || 0), 0));
}

export function amount(item, income) {
  return (income * (Number(item.p) || 0)) / 100;
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

export function claimedBy(goals, itemId, skip) {
  return goals.reduce((s, g) => (g !== skip ? s + (Number(g.a?.[itemId]) || 0) : s), 0);
}

export function claimedAll(goals, itemId) {
  return claimedBy(goals, itemId, null);
}

export function freeFor(goals, goal, itemId) {
  return r2(clamp(100 - claimedBy(goals, itemId, goal), 0, 100));
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
