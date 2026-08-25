// F18 — ingreso variable: promedio para repartir, mínimo para calcular esenciales
export function ingresoEfectivo(historial) {
  const vals = historial.filter((v) => v > 0);
  if (!vals.length) return { promedio: 0, minimo: 0 };
  const promedio = vals.reduce((s, v) => s + v, 0) / vals.length;
  const minimo = Math.min(...vals);
  return { promedio, minimo };
}

export function excedente(ingresoMes, ingresoBase) {
  const extra = Math.max(0, ingresoMes - ingresoBase);
  return { total: extra, metasYFondo: extra * 0.7, libre: extra * 0.3 };
}
