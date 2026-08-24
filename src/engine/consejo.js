// F2 — recomendado de ahorro con justificación
export function recomendar(estado) {
  let corto;
  let largo;
  let motivo;

  if (estado.fondoEstado === 'critico') {
    corto = 100;
    largo = 0;
    motivo = 'sin colchón, primero el colchón';
  } else if (estado.fondoEstado === 'parcial') {
    corto = 70;
    largo = 30;
    motivo = 'fondo parcial: prioriza terminarlo antes de acelerar el largo plazo';
  } else {
    corto = 30;
    largo = 70;
    motivo = 'fondo completo: el largo plazo hace el trabajo pesado';
  }

  const libre = 0;

  if (estado.essentialsShare > 65) {
    corto = Math.round(corto * 0.5);
    largo = Math.round(largo * 0.5);
    motivo = 'los esenciales pasan el 65% del ingreso: el problema no es ahorrar poco, es que los esenciales pesan demasiado';
  }

  return { corto, largo, libre, motivo };
}

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
