/* F8 — repartir el saldo a favor. Antes solo se podía mandar a metas, así que
   el mes que te sobraba plata teniendo el arriendo a medias la app te ofrecía
   guardarla y no pagarlo. Los destinos son de tres clases y se tratan igual:

   - `libre`: una categoría de gasto libre. No tiene tope, porque no tiene plan.
   - `deuda`: un concepto al que le falta plata para llegar a lo planeado.
   - `meta`:  una meta de ahorro sin completar.

   Todo aquí es puro: recibe el perfil, devuelve destinos y movimientos. Quien
   los mete en el libro es la vista. */

import { r2 } from './reparto.js';
import { esGastoLibre, planDeLinea } from './pagos.js';
import { porLinea } from './movimientos.js';

/* Los destinos posibles, en el orden en que tiene sentido mirarlos: primero lo
   que se debe, después lo que se gasta, y de último lo que se guarda. Pagar
   antes que ahorrar no es una opinión: la deuda tiene fecha y el ahorro no. */
export function destinosDeReparto(p, periodo) {
  const pagado = porLinea(p.movs || [], periodo);
  const deudas = (p.items || []).flatMap((it) => (esGastoLibre(it) ? [] : (it.L || [])
    .map((l) => {
      const plan = planDeLinea(l, periodo);
      const pendiente = r2(plan - r2(pagado[l.id] || 0));
      /* Los grupos son por clase de destino y no por categoría: lo que se
         decide aquí es "¿pago, gasto o guardo?", y con un grupo por categoría
         esa pregunta quedaba repartida en seis títulos. De qué categoría sale
         cada concepto va al lado del nombre, que es donde hace falta. */
      return { tipo: 'deuda', id: `l:${l.id}`, itemId: it.id, lineId: l.id,
        nombre: l.n || 'Sin nombre', de: it.n, grupo: 'Pagar deuda', tope: pendiente };
    })
    .filter((d) => d.tope > 0)));

  const libres = (p.items || []).filter(esGastoLibre)
    .map((it) => ({ tipo: 'libre', id: `i:${it.id}`, itemId: it.id, lineId: null,
      nombre: it.n, grupo: 'Gasto libre', tope: null, contexto: 'sin tope' }));

  const metas = (p.goals || []).filter((g) => g.estado !== 'completa')
    .map((g) => {
      const falta = g.t > 0 ? Math.max(0, r2(g.t - (g.s || 0))) : null;
      return { tipo: 'meta', id: `g:${g.id}`, goalId: g.id, nombre: g.n, de: '',
        grupo: 'Metas de ahorro', tope: falta };
    })
    .filter((d) => d.tope === null || d.tope > 0);

  return [...deudas, ...libres, ...metas];
}

/* Lo repartido nunca puede pasar de lo disponible ni del tope de cada destino.
   Se recorta aquí y no en la vista para que la regla sea una sola: un input
   tecleado a mano y un botón de "todo lo que falta" pasan por el mismo sitio. */
export function normalizarReparto(destinos, montos = {}, disponible) {
  let queda = Math.max(0, r2(disponible));
  const filas = destinos.map((d) => {
    const pedido = Math.max(0, r2(Number(montos[d.id]) || 0));
    const tope = d.tope === null ? queda : Math.min(d.tope, queda);
    const monto = Math.min(pedido, tope);
    queda = r2(queda - monto);
    return { destino: d, monto };
  }).filter((f) => f.monto > 0);
  const total = r2(filas.reduce((s, f) => s + f.monto, 0));
  return { filas, total, restante: r2(Math.max(0, disponible) - total) };
}

let n = 0;
function nid() {
  return `r${Date.now().toString(36)}${(n += 1).toString(36)}`;
}

/* Cada destino genera el movimiento que le corresponde, del mismo tipo que
   generaría hacerlo a mano: un pago al concepto, un pago suelto a la categoría
   o un aporte a la meta. Nada de una estructura nueva de "reparto" que después
   el historial y el donut no sepan leer. */
export function movimientosDeReparto(filas, fecha) {
  return filas.map(({ destino: d, monto }) => ({
    id: nid(), fecha, tipo: 'gasto', monto: r2(monto),
    itemId: d.itemId || null, lineId: d.lineId || null, goalId: d.goalId || null,
    nombre: 'Reparto de saldo a favor', nota: `Reparto de saldo a favor → ${d.nombre}`,
    extra: false,
  }));
}
