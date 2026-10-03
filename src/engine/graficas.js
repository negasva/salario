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

/* La franja de reparto: lo que entró en el mes partido en lo que se fue a cada categoría y lo que queda.
   Si se gastó más de lo que había, la franja es solo el gasto y `exceso` dice
   cuánto. Los porcentajes salen sobre la franja entera. */
export function franjaReparto(segmentos, disponible) {
  const gastado = segmentos.reduce((t, s) => t + s.monto, 0);
  const base = Math.max(disponible, gastado);
  if (base <= 0) return null;
  const pct = (m) => Math.round((m / base) * 1000) / 10;
  return {
    partes: segmentos.map((s) => ({ ...s, pct: pct(s.monto) })),
    libre: disponible > gastado ? { monto: disponible - gastado, pct: pct(disponible - gastado) } : null,
    exceso: gastado > disponible ? gastado - Math.max(disponible, 0) : 0,
  };
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

/* Escala "bonita" para un eje: el máximo sube al siguiente paso redondo
   (1, 2, 5 por potencia de diez) para que las líneas de guía caigan en cifras
   limpias. Devuelve { max, ticks } con ticks desde 0. */
export function escala(maxReal, cuantos = 4) {
  if (!(maxReal > 0)) return { max: 1, ticks: [0, 1] };
  const crudo = maxReal / cuantos;
  const pot = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 5, 10].map((m) => m * pot).find((p) => p >= crudo);
  const n = Math.ceil(maxReal / paso);
  return { max: n * paso, ticks: Array.from({ length: n + 1 }, (_, i) => i * paso) };
}

/* Puntos de una serie sobre una caja de ancho × alto. Los null cortan la
   línea (sirve para el mes en curso, que no tiene futuro). */
export function trazo(valores, ancho, alto, max) {
  const paso = valores.length > 1 ? ancho / (valores.length - 1) : 0;
  return valores.map((v, i) => (v === null ? null : { x: Math.round(i * paso * 10) / 10, y: Math.round((1 - v / max) * alto * 10) / 10 }));
}
