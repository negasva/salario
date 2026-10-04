import { diasEntre } from './recurrentes.js';
import { hoyISO } from './movimientos.js';

/* Qué decir del último respaldo (la fecha 'AAAA-MM-DD' en que se descargó el
   JSON) y si ya toca recordarlo: con datos y más de 30 días sin copia. */
export function estadoRespaldo(ultimo, hayDatos, hoy = hoyISO()) {
  if (!ultimo) return { texto: 'Todavía no has descargado una copia.', avisar: hayDatos };
  const dias = diasEntre(ultimo, hoy);
  const cuando = dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
  return { texto: `Última copia: ${cuando}.`, avisar: hayDatos && dias > 30 };
}
