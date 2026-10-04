import { diasEntre } from './recurrentes.js';
import { hoyISO } from './movimientos.js';
import { VERSION } from './migrar.js';

/* Qué decir del último respaldo (la fecha 'AAAA-MM-DD' en que se descargó el
   JSON) y si ya toca recordarlo: con datos y más de 30 días sin copia. */
export function estadoRespaldo(ultimo, hayDatos, hoy = hoyISO()) {
  if (!ultimo) return { texto: 'Todavía no has descargado una copia.', avisar: hayDatos };
  const dias = diasEntre(ultimo, hoy);
  const cuando = dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
  return { texto: `Última copia: ${cuando}.`, avisar: hayDatos && dias > 30 };
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const esObjeto = (x) => x && typeof x === 'object' && !Array.isArray(x);

/* ¿Sirve este JSON como copia? Devuelve el motivo del rechazo, o null si sirve.
   Una copia mala pisaría la nube y rompería las pantallas, así que se mira cada
   movimiento y categoría, y que no venga de una versión más nueva que la app. */
export function motivoDeRechazo(datos) {
  if (!esObjeto(datos) || !Array.isArray(datos.movs) || !Array.isArray(datos.cats)) return 'Ese archivo no es una copia de Reparto mensual.';
  if (Number(datos.v) > VERSION) return 'Esa copia es de una versión más nueva de la app. Actualiza y vuelve a intentar.';
  if (!datos.cats.every((c) => esObjeto(c) && typeof c.id === 'string' && typeof c.n === 'string')) return 'La copia tiene categorías dañadas.';
  const ok = (m) => esObjeto(m) && typeof m.id === 'string' && FECHA.test(m.fecha) && Number.isFinite(m.monto)
    && (m.tipo === 'ingreso' || m.tipo === 'gasto');
  const malo = datos.movs.findIndex((m) => !ok(m));
  return malo >= 0 ? `La copia tiene el movimiento ${malo + 1} dañado (fecha, tipo o monto).` : null;
}
