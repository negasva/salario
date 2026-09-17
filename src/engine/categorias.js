/* Un solo sistema de categorías: una lista editable, de un nivel, sin
   conceptos. Hay categorías de gasto y categorías de ingreso, y cada
   movimiento lleva la suya.

   Una categoría es { id, n, m (presupuesto mensual opcional, 0 = sin), c, tipo }.
   'otros' y 'otros-ingreso' son fijas: ahí caen los movimientos de una
   categoría borrada. */

export const OTROS = 'otros';
export const OTROS_ING = 'otros-ingreso';

export const COLORES = ['#E5484D', '#F5A524', '#1FA971', '#0EA5E9', '#8B5CF6',
  '#EC4899', '#0D9488', '#A16207', '#6366F1', '#B91C1C', '#64748B'];

// Las de fábrica, en el orden en que se muestran.
export const BASE_GASTO = ['Vivienda', 'Servicios', 'Mercado', 'Comida fuera', 'Transporte',
  'Salud', 'Suscripciones', 'Salidas', 'Compras', 'Educación', 'Mascotas', 'Ahorro'];
export const BASE_INGRESO = ['Sueldo', 'Extras', 'Ventas'];

export function nuevoId() {
  return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 12);
}

export function colorPara(indice) {
  return COLORES[indice % COLORES.length];
}

export function fallbackDe(tipo) {
  return tipo === 'ingreso' ? OTROS_ING : OTROS;
}

export function esFija(id) {
  return id === OTROS || id === OTROS_ING;
}

function cat(n, tipo, i) {
  return { id: nuevoId(), n, m: 0, c: colorPara(i), tipo };
}

export function categoriasBase() {
  return [
    ...BASE_GASTO.map((n, i) => cat(n, 'gasto', i)),
    { id: OTROS, n: 'Otros', m: 0, c: colorPara(BASE_GASTO.length), tipo: 'gasto' },
    ...BASE_INGRESO.map((n, i) => cat(n, 'ingreso', i)),
    { id: OTROS_ING, n: 'Otros ingresos', m: 0, c: colorPara(BASE_INGRESO.length), tipo: 'ingreso' },
  ];
}

// Toda categoría lleva tipo y las dos fijas siempre existen.
export function normalizarCats(cats) {
  const lista = (Array.isArray(cats) ? cats : []).map((c, i) => ({
    ...c,
    tipo: c.tipo === 'ingreso' ? 'ingreso' : 'gasto',
    m: Math.max(0, Math.round(Number(c.m) || 0)),
    c: /^#/.test(c.c || '') ? c.c : colorPara(i),
  }));
  if (!lista.some((c) => c.id === OTROS)) {
    lista.push({ id: OTROS, n: 'Otros', m: 0, c: colorPara(lista.length), tipo: 'gasto' });
  }
  if (!lista.some((c) => c.id === OTROS_ING)) {
    lista.push({ id: OTROS_ING, n: 'Otros ingresos', m: 0, c: colorPara(lista.length), tipo: 'ingreso' });
  }
  return lista;
}

export function deTipo(cats, tipo = 'gasto') {
  const t = tipo === 'ingreso' ? 'ingreso' : 'gasto';
  // la fija va al final, que es donde se busca
  return (cats || []).filter((c) => c.tipo === t).sort((a, b) => (esFija(a.id) ? 1 : 0) - (esFija(b.id) ? 1 : 0));
}

/* Completa la lista con las de fábrica que falten, comparando por nombre sin
   acentos ni mayúsculas. Es lo que le devuelve Mercado y Transporte a un
   perfil que venía de las categorías de presupuesto. */
export function clave(nombre) {
  return String(nombre || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function completarConBase(cats) {
  const lista = normalizarCats(cats);
  const tiene = (n, tipo) => lista.some((c) => c.tipo === tipo && clave(c.n) === clave(n));
  const agregarFaltantes = (nombres, tipo) => nombres.forEach((n) => {
    if (!tiene(n, tipo)) lista.push(cat(n, tipo, lista.length));
  });
  agregarFaltantes(BASE_GASTO, 'gasto');
  agregarFaltantes(BASE_INGRESO, 'ingreso');
  return lista;
}

export function agregar(cats, nombre, presupuesto = 0, tipo = 'gasto') {
  const n = String(nombre || '').trim();
  if (!n) return null;
  const nueva = { ...cat(n, tipo, cats.length), m: Math.max(0, Math.round(presupuesto) || 0) };
  const i = cats.findIndex((c) => c.id === fallbackDe(tipo));
  if (i >= 0) cats.splice(i, 0, nueva); else cats.push(nueva);
  return nueva;
}

/* Borrar una categoría no borra su historia: sus movimientos y sus
   recurrentes pasan a Otros y los saldos de todos los meses quedan igual. */
export function borrar(cats, movs, id, recurrentes = []) {
  if (esFija(id)) return false;
  const i = cats.findIndex((c) => c.id === id);
  if (i < 0) return false;
  const destino = fallbackDe(cats[i].tipo);
  cats.splice(i, 1);
  movs.forEach((m) => { if (m.catId === id) m.catId = destino; });
  recurrentes.forEach((r) => { if (r.catId === id) r.catId = destino; });
  return true;
}

export function nombreDe(cats, id) {
  const c = (cats || []).find((x) => x.id === id);
  if (c) return c.n;
  return id === OTROS_ING ? 'Otros ingresos' : 'Otros';
}

export function colorDe(cats, id) {
  return (cats || []).find((x) => x.id === id)?.c || '#64748B';
}
