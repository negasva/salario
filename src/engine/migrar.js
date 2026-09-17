/* Migración única del perfil viejo (v8 y anteriores) al modelo nuevo.

   Antes: categorías de presupuesto con conceptos anidados, metas con aportes,
   16 "tipos de gasto" automáticos, saldo por moneda. Ahora: una lista de
   categorías de un nivel y un libro con { fecha, tipo, monto, catId, nota }.

   Reglas:
   - cada categoría vieja pasa tal cual (mismo id, nombre, presupuesto, color);
   - el concepto de un gasto se guarda delante de la nota, que es lo único que
     lo podía distinguir;
   - los aportes a metas eran gastos con goalId: pasan a la categoría Ahorro;
   - un gasto sin categoría se ubica por su "tipo de gasto" automático, o en Otros;
   - el saldo inicial es el saldo base de la moneda del perfil. */

import { OTROS, colorPara, conOtros, nuevoId } from './categorias.js';

const NOMBRE_TIPO = {
  vivienda: 'Vivienda', servicios: 'Servicios', mercado: 'Mercado', restaurantes: 'Restaurantes',
  'comida-fuera': 'Restaurantes', transporte: 'Transporte', vehiculo: 'Vehículo', salud: 'Salud',
  cuidado: 'Cuidado', mascotas: 'Mascotas', suscripciones: 'Suscripciones', salidas: 'Salidas',
  ocio: 'Salidas', viajes: 'Viajes', compras: 'Compras', ropa: 'Compras', finanzas: 'Finanzas',
  educacion: 'Educación',
};

export const VERSION = 9;

export function esViejo(p) {
  return !!p && p.v !== VERSION;
}

export function migrarPerfil(viejo) {
  const p = viejo || {};
  const cats = (p.items || []).map((it, i) => ({
    id: it.id || nuevoId(), n: String(it.n || 'Sin nombre'), m: Math.max(0, Math.round(Number(it.m) || 0)),
    c: /^#/.test(it.c || '') ? it.c : colorPara(i),
  }));
  const porNombre = (nombre) => {
    let c = cats.find((x) => x.n.toLowerCase() === nombre.toLowerCase());
    if (!c) { c = { id: nuevoId(), n: nombre, m: 0, c: colorPara(cats.length) }; cats.push(c); }
    return c.id;
  };
  const conceptos = {};
  (p.items || []).forEach((it) => (it.L || []).forEach((l) => { conceptos[l.id] = l.n || ''; }));
  const metas = {};
  (p.goals || []).forEach((g) => { metas[g.id] = g.n || ''; });

  const movs = (p.movs || []).filter((m) => m && m.monto > 0 && m.fecha).map((m) => {
    const nota = [conceptos[m.lineId], m.goalId ? `Aporte a ${metas[m.goalId] || 'meta'}` : '', m.nota]
      .filter((s) => s && String(s).trim()).join(' · ');
    let catId = null;
    if (m.tipo === 'gasto') {
      if (m.goalId) catId = porNombre('Ahorro');
      else if (m.itemId && cats.some((c) => c.id === m.itemId)) catId = m.itemId;
      else if (NOMBRE_TIPO[m.cat]) catId = porNombre(NOMBRE_TIPO[m.cat]);
      else catId = OTROS;
    }
    return { id: m.id || nuevoId(), fecha: String(m.fecha).slice(0, 10), tipo: m.tipo === 'ingreso' ? 'ingreso' : 'gasto',
      monto: Math.round(Number(m.monto) || 0), catId, nota };
  });

  const cur = p.cur || 'COP';
  return {
    v: VERSION,
    name: String(p.name || 'Mi presupuesto'),
    saldoInicial: Math.round(Number(p.saldoInicial ?? p.saldos?.[cur]) || 0),
    cats: conOtros(cats),
    movs,
  };
}
