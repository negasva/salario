/* "Por revisar": movimientos que entraron solos (hoy, los del reporte del
   banco) y todavía no cuentan en ningún saldo ni gráfica. Cada uno se revisa
   —nombre, categoría, monto— y se aprueba; al aprobarse pasa a `movs` como si
   lo hubieras anotado tú, con su fecha y su hora.

   Uno es { id, fecha 'AAAA-MM-DD', hora 'HH:MM' | '', tipo, monto, catId,
   nota, origen (lo que decía el banco) }. */

import { OTROS, OTROS_ING, clave } from './categorias.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/* Al siguiente 100: 26.045,50 → 26.100. Lo que ya es múltiplo de 100 no se
   mueve. Se cuenta en centavos para que 7.900 no salte por un 7.900,0000001. */
export function redondear100(n) {
  const centavos = Math.round((Number(n) || 0) * 100);
  return Math.ceil(centavos / 10000) * 100;
}

export function normalizarStandby(lista) {
  return (Array.isArray(lista) ? lista : [])
    .filter((x) => x && typeof x === 'object' && typeof x.id === 'string' && FECHA.test(x.fecha)
      && (x.tipo === 'ingreso' || x.tipo === 'gasto'))
    .map((x) => ({
      id: x.id,
      fecha: x.fecha,
      hora: HORA.test(x.hora || '') ? x.hora : '',
      tipo: x.tipo,
      monto: Math.max(0, Math.round(Number(x.monto) || 0)),
      catId: typeof x.catId === 'string' && x.catId ? x.catId : (x.tipo === 'ingreso' ? OTROS_ING : OTROS),
      nota: String(x.nota || ''),
      origen: String(x.origen || ''),
    }));
}

/* Mete en `p.standby` las filas de una semilla, una sola vez por perfil: la
   marca queda en `p.semillas`, así que descartar uno no lo trae de vuelta.
   Devuelve los creados. */
export function sembrar(p, semilla, { prefijo = semilla.id } = {}) {
  p.semillas = Array.isArray(p.semillas) ? p.semillas : [];
  p.standby = Array.isArray(p.standby) ? p.standby : [];
  if (p.semillas.includes(semilla.id)) return [];
  p.semillas.push(semilla.id);
  const porNombre = (nombre, tipo) => p.cats.find((c) => c.tipo === tipo && clave(c.n) === clave(nombre))?.id;
  const ya = new Set([...p.movs, ...p.standby].map((m) => m.id));
  const creados = [];
  semilla.filas.forEach(([fecha, hora, t, monto, nota, cat, origen], i) => {
    const id = `${prefijo}-${String(i + 1).padStart(3, '0')}`;
    if (ya.has(id)) return;
    const tipo = t === 'i' ? 'ingreso' : 'gasto';
    creados.push({
      id, fecha, hora, tipo, monto: redondear100(monto), nota, origen,
      catId: porNombre(cat, tipo) || (tipo === 'ingreso' ? OTROS_ING : OTROS),
    });
  });
  p.standby.push(...creados);
  return creados;
}

/* Pasa uno a los movimientos. Sin monto no se puede: devuelve null. Devuelve
   también lo necesario para deshacerlo. */
export function aprobar(p, id) {
  const indice = p.standby.findIndex((x) => x.id === id);
  if (indice < 0 || !(p.standby[indice].monto > 0)) return null;
  const item = p.standby[indice];
  const { origen, ...mov } = item;
  if (!mov.hora) delete mov.hora;
  p.standby.splice(indice, 1);
  p.movs.push(mov);
  return { mov, item, indice };
}

/* Lo contrario de aprobar, para el "Deshacer". */
export function desaprobar(p, { mov, item, indice }) {
  const j = p.movs.findIndex((m) => m.id === mov.id);
  if (j >= 0) p.movs.splice(j, 1);
  p.standby.splice(Math.min(indice, p.standby.length), 0, item);
}
