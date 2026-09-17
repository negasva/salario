/* Un solo sistema de categorías: una lista editable, un nivel, sin conceptos.
   Cada categoría es { id, n, m (presupuesto mensual opcional, 0 = sin), c }.
   'otros' es fija: es donde caen los movimientos de una categoría borrada. */

export const OTROS = 'otros';

export const COLORES = ['#E5484D', '#F5A524', '#1FA971', '#0EA5E9', '#8B5CF6',
  '#EC4899', '#0D9488', '#A16207', '#6366F1', '#B91C1C', '#64748B'];

export const NOMBRES_BASE = ['Vivienda', 'Servicios', 'Mercado', 'Restaurantes',
  'Transporte', 'Salud', 'Suscripciones', 'Salidas', 'Compras', 'Ahorro', 'Otros'];

export function nuevoId() {
  return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 12);
}

export function colorPara(indice) {
  return COLORES[indice % COLORES.length];
}

export function categoriasBase() {
  return NOMBRES_BASE.map((n, i) => ({
    id: n === 'Otros' ? OTROS : nuevoId(), n, m: 0, c: colorPara(i),
  }));
}

export function conOtros(cats) {
  if (cats.some((c) => c.id === OTROS)) return cats;
  return cats.concat([{ id: OTROS, n: 'Otros', m: 0, c: colorPara(cats.length) }]);
}

export function agregar(cats, nombre, presupuesto = 0) {
  const n = String(nombre || '').trim();
  if (!n) return null;
  const cat = { id: nuevoId(), n, m: Math.max(0, Math.round(presupuesto) || 0), c: colorPara(cats.length) };
  // 'Otros' siempre al final
  const i = cats.findIndex((c) => c.id === OTROS);
  if (i >= 0) cats.splice(i, 0, cat); else cats.push(cat);
  return cat;
}

/* Borrar una categoría no borra su historia: sus movimientos pasan a Otros
   y los saldos de todos los meses quedan como estaban. */
export function borrar(cats, movs, id) {
  if (id === OTROS) return false;
  const i = cats.findIndex((c) => c.id === id);
  if (i < 0) return false;
  cats.splice(i, 1);
  movs.forEach((m) => { if (m.catId === id) m.catId = OTROS; });
  return true;
}

export function nombreDe(cats, id) {
  return cats.find((c) => c.id === id)?.n || 'Otros';
}
