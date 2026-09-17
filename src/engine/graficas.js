/* Geometría de las gráficas. Sin librería: el SVG lo escribe la vista y aquí
   solo se calculan los números. */

// Trozos del donut: [{ id, nombre, color, monto, pct, largo, resto, offset }]
export function arcos(segmentos, circunferencia) {
  const total = segmentos.reduce((t, s) => t + s.monto, 0);
  if (total <= 0) return [];
  let acumulado = 0;
  return segmentos.filter((s) => s.monto > 0).map((s) => {
    const largo = (s.monto / total) * circunferencia;
    const trozo = {
      ...s,
      pct: Math.round((s.monto / total) * 1000) / 10,
      largo: Math.round(largo * 100) / 100,
      resto: Math.round((circunferencia - largo) * 100) / 100,
      offset: -Math.round(acumulado * 100) / 100 || 0, // sin -0
    };
    acumulado += largo;
    return trozo;
  });
}

// Gasto por categoría convertido en segmentos con nombre y color, de mayor a menor.
export function segmentosPorCategoria(cats, porCat) {
  return Object.entries(porCat)
    .map(([id, monto]) => {
      const c = cats.find((x) => x.id === id);
      return { id, nombre: c?.n || 'Otros', color: c?.c || '#64748B', monto };
    })
    .filter((s) => s.monto > 0)
    .sort((a, b) => b.monto - a.monto);
}

/* Barras de ingreso contra gasto: alto de cada barra en píxeles sobre el
   máximo de la serie, para que las dos escalas sean la misma. */
export function barras(serie, alto) {
  const max = Math.max(1, ...serie.flatMap((s) => [s.ingresos, s.gastos]));
  return serie.map((s) => ({
    periodo: s.periodo,
    ingresos: Math.round((s.ingresos / max) * alto),
    gastos: Math.round((s.gastos / max) * alto),
  }));
}

/* Línea del saldo final mes a mes. Los puntos van entre 0 y `alto`, y la
   línea del cero se devuelve aparte para dibujarla cuando hay negativos. */
export function linea(serie, ancho, alto) {
  const valores = serie.map((s) => s.final);
  const max = Math.max(0, ...valores);
  const min = Math.min(0, ...valores);
  const rango = max - min || 1;
  const y = (v) => Math.round((1 - (v - min) / rango) * alto);
  const paso = serie.length > 1 ? ancho / (serie.length - 1) : 0;
  return {
    puntos: serie.map((s, i) => ({ periodo: s.periodo, x: Math.round(i * paso), y: y(s.final), final: s.final })),
    cero: y(0),
  };
}
