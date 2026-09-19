/* Migración del perfil guardado al modelo de hoy.

   Hay dos puntos de partida:

   - v8 y anteriores: categorías de presupuesto con conceptos anidados, metas
     con aportes, 16 "tipos de gasto" automáticos, saldo por moneda.
   - v9: el modelo que dejó la primera pasada de la auditoría, que perdía los
     conceptos. Aquí se le añaden los recurrentes y las categorías de ingreso.
   - v10: los recurrentes se podían apagar. Ya no: están todos activos y lo
     que se marca cada mes es cuál se pagó.

   Lo que un concepto era —un nombre y un precio mensual— es hoy un gasto
   recurrente, que es como se registraba antes y como se vuelve a registrar. */

import {
  OTROS, OTROS_ING, clave, colorPara, completarConBase, nuevoId,
} from './categorias.js';

const NOMBRE_TIPO = {
  vivienda: 'Vivienda', servicios: 'Servicios', mercado: 'Mercado',
  restaurantes: 'Comida fuera', 'comida-fuera': 'Comida fuera',
  transporte: 'Transporte', vehiculo: 'Vehículo', salud: 'Salud',
  cuidado: 'Cuidado', mascotas: 'Mascotas', suscripciones: 'Suscripciones',
  salidas: 'Salidas', ocio: 'Salidas', viajes: 'Viajes', compras: 'Compras',
  ropa: 'Compras', finanzas: 'Finanzas', educacion: 'Educación',
};

const RE_SUELDO = /n[oó]mina|sueldo|salario|quincena|pago mes/i;

export const VERSION = 11;

export function esViejo(p) {
  return !!p && p.v !== VERSION;
}

// 'AAAA-MM-DD' → día del mes
function diaDe(fecha) {
  return Number(String(fecha).slice(8, 10)) || 1;
}

/* Los conceptos de un perfil viejo, convertidos en recurrentes. Cada uno
   conserva su nombre, su precio mensual, su categoría y el día en que solías
   pagarlo. Los que estaban marcados como gasto libre entran sin estimado:
   no tenían precio fijo, así que el monto se escribe al pagarlos. */
export function recurrentesDesdeConceptos(viejo) {
  const p = viejo || {};
  const ultimoDia = {};
  (p.movs || []).forEach((m) => {
    if (m?.lineId && m.fecha) ultimoDia[m.lineId] = diaDe(m.fecha);
  });
  const fuera = [];
  (p.items || []).forEach((it) => {
    (it.L || []).forEach((l) => {
      const n = String(l?.n || '').trim();
      if (!n) return;
      fuera.push({
        id: l.id || nuevoId(),
        n,
        monto: Math.max(0, Math.round(Number(l.v) || 0)),
        catId: it.id || OTROS,
        tipo: 'gasto',
        dia: ultimoDia[l.id] || 1,
      });
    });
  });
  return fuera;
}

/* Los que se guardaron con la casilla "se repite todos los meses". Se saltan
   los que ya entraron por su concepto, para no dejar el arriendo dos veces. */
export function recurrentesDesdePlantillas(viejo, yaHay = []) {
  const p = viejo || {};
  const conceptos = {};
  (p.items || []).forEach((it) => (it.L || []).forEach((l) => { conceptos[l.id] = l.n || ''; }));
  const visto = new Set(yaHay.map((r) => `${clave(r.n)}|${r.monto}`));
  const fuera = [];
  (p.recurrentes || []).forEach((r) => {
    const n = String(r?.nota || conceptos[r?.lineId] || '').trim() || 'Recurrente';
    const monto = Math.max(0, Math.round(Number(r?.monto) || 0));
    const k = `${clave(n)}|${monto}`;
    if (visto.has(k)) return;
    visto.add(k);
    fuera.push({
      id: r.id || nuevoId(),
      n,
      monto,
      catId: r.tipo === 'ingreso' ? null : (r.itemId || OTROS),
      tipo: r.tipo === 'ingreso' ? 'ingreso' : 'gasto',
      dia: Math.min(31, Math.max(1, Number(r.dia) || 1)),
    });
  });
  return fuera;
}

export function recurrentesDesdeViejo(viejo) {
  const conceptos = recurrentesDesdeConceptos(viejo);
  return conceptos.concat(recurrentesDesdePlantillas(viejo, conceptos));
}

/* Un perfil v8 o anterior. */
function migrarV8(viejo) {
  const p = viejo || {};
  const cats = (p.items || []).map((it, i) => ({
    id: it.id || nuevoId(),
    n: String(it.n || 'Sin nombre'),
    m: Math.max(0, Math.round(Number(it.m) || 0)),
    c: /^#/.test(it.c || '') ? it.c : colorPara(i),
    tipo: 'gasto',
  }));
  const conBase = completarConBase(cats);
  const porNombre = (nombre, tipo = 'gasto') => conBase.find((c) => c.tipo === tipo && clave(c.n) === clave(nombre))?.id;

  const conceptos = {};
  (p.items || []).forEach((it) => (it.L || []).forEach((l) => { conceptos[l.id] = l.n || ''; }));
  const metas = {};
  (p.goals || []).forEach((g) => { metas[g.id] = g.n || ''; });

  const movs = (p.movs || []).filter((m) => m && m.monto > 0 && m.fecha).map((m) => {
    const nota = [conceptos[m.lineId], m.goalId ? `Aporte a ${metas[m.goalId] || 'meta'}` : '', m.nota]
      .filter((s) => s && String(s).trim()).join(' · ');
    let catId;
    if (m.tipo === 'ingreso') {
      // en el modelo viejo el ingreso que no era extra era la nómina
      catId = porNombre(m.extra ? 'Extras' : 'Sueldo', 'ingreso');
    } else if (m.goalId) catId = porNombre('Ahorro') || OTROS;
    else if (m.itemId && cats.some((c) => c.id === m.itemId)) catId = m.itemId;
    else if (NOMBRE_TIPO[m.cat]) catId = porNombre(NOMBRE_TIPO[m.cat]) || OTROS;
    else catId = OTROS;
    const base = {
      id: m.id || nuevoId(),
      fecha: String(m.fecha).slice(0, 10),
      tipo: m.tipo === 'ingreso' ? 'ingreso' : 'gasto',
      monto: Math.round(Number(m.monto) || 0),
      catId: catId || (m.tipo === 'ingreso' ? OTROS_ING : OTROS),
      nota,
    };
    // el concepto que lo originó es hoy su recurrente: el mes ya cuenta como agregado
    if (m.lineId) base.recId = m.lineId;
    else if (m.recId) base.recId = m.recId;
    return base;
  });

  const cur = p.cur || 'COP';
  return {
    v: VERSION,
    name: String(p.name || 'Mi presupuesto'),
    saldoInicial: Math.round(Number(p.saldoInicial ?? p.saldos?.[cur]) || 0),
    cats: conBase,
    movs,
    recurrentes: recurrentesDesdeViejo(p),
  };
}

/* Un perfil v9: ya tiene cats y movs con la forma de hoy, pero todas sus
   categorías son de gasto y no hay recurrentes. Los conceptos no están: se
   recuperan aparte, desde el blob viejo, con `recurrentesDesdeViejo`. */
function migrarV9(p) {
  const cats = completarConBase(p.cats);
  const idPorNombre = (n, tipo) => cats.find((c) => c.tipo === tipo && clave(c.n) === clave(n))?.id;
  const movs = (p.movs || []).map((m) => {
    if (m.tipo !== 'ingreso') return { ...m, catId: m.catId || OTROS };
    const catId = m.catId || (RE_SUELDO.test(m.nota || '') ? idPorNombre('Sueldo', 'ingreso') : OTROS_ING);
    return { ...m, catId: catId || OTROS_ING };
  });
  return { ...p, v: VERSION, cats, movs, recurrentes: p.recurrentes || [] };
}

/* El último paso por el que pasan todos los caminos: la forma de hoy.
   `activo` desaparece —están todos activos— y `arranques` guarda los meses
   que se empezaron de nuevo. */
function finalizar(p) {
  p.recurrentes = (p.recurrentes || []).map((r) => {
    const { activo, ...resto } = r;
    return resto;
  });
  p.arranques = p.arranques && typeof p.arranques === 'object' ? p.arranques : {};
  p.v = VERSION;
  return p;
}

export function migrarPerfil(viejo) {
  const p = viejo || {};
  if (p.v >= 10) return finalizar({ ...p });
  return finalizar(p.v >= 9 ? migrarV9(p) : migrarV8(p));
}
