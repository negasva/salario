import { r2 } from './reparto.js';

export function renglonesQueCrecieron(cierres, periodoActual, umbral = 15) {
  const validos = cierres
    .filter(c => c.snapshot && c.snapshot.version >= 2 && c.periodo !== periodoActual)
    .sort((a, b) => a.periodo.localeCompare(b.periodo));

  if (validos.length < 2) return [];

  const ultimo = validos[validos.length - 1];
  const anteriores = validos.slice(Math.max(0, validos.length - 4), validos.length - 1);

  const resultados = [];

  for (const [lineId, dataActual] of Object.entries(ultimo.snapshot.lineas || {})) {
    const vals = anteriores.map(c => c.snapshot.lineas?.[lineId]?.real || 0);
    const suma = vals.reduce((a, b) => a + b, 0);
    const promedioAnterior = suma / vals.length;
    const actual = dataActual.real;

    if (promedioAnterior > 0) {
      const delta = actual - promedioAnterior;
      const deltaPct = (delta / promedioAnterior) * 100;

      if (deltaPct > umbral) {
        resultados.push({
          lineId,
          nombre: dataActual.nombre,
          itemId: dataActual.itemId,
          promedioAnterior: r2(promedioAnterior),
          actual,
          deltaPct: Math.round(deltaPct),
          deltaAbs: delta,
          meses: anteriores.length
        });
      }
    }
  }

  return resultados
    .sort((a, b) => b.deltaAbs - a.deltaAbs)
    .map(({ deltaAbs, ...rest }) => rest);
}

/* F11 — tope por renglón. La alerta de arriba avisa el mes siguiente, cuando
   ya gastaste; el tope avisa el mismo día. `l.tope` es el máximo mensual que
   el usuario le puso a ese renglón; sin tope, el renglón no dice nada. */
export function renglonesSobreTope(items, gastadoPorLinea) {
  return items.flatMap((it) => (it.L || [])
    .filter((l) => Number(l.tope) > 0)
    .map((l) => {
      const real = gastadoPorLinea[l.id] || 0;
      const tope = Number(l.tope);
      return {
        lineId: l.id, itemId: it.id, nombre: l.n || 'sin nombre',
        tope, real, resto: r2(tope - real), pct: Math.round((real / tope) * 100),
      };
    })
    .filter((x) => x.pct >= 80));
}
