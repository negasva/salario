/* Entrar y sacar movimientos en CSV.

   Exportar: un CSV con punto y coma y BOM, que Excel en español abre directo
   con las columnas en su sitio y las tildes bien.

   Importar: el extracto del banco en CSV. Cada banco lo arma distinto, así
   que aquí se adivina qué columna es la fecha, cuál la descripción y cuál el
   valor (o débitos y créditos por separado), y la persona lo revisa antes de
   que entre nada. */

import { clave, nombreDe, fallbackDe } from './categorias.js';

/* ---------- exportar ---------- */

function celda(v) {
  const t = String(v ?? '');
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function aCSV(movs, cats, recurrentes = []) {
  const rec = new Map(recurrentes.map((r) => [r.id, r.n]));
  const filas = [...movs].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)).map((m) => [
    m.fecha,
    m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto',
    nombreDe(cats, m.catId || fallbackDe(m.tipo)),
    m.tipo === 'ingreso' ? m.monto : -m.monto,
    m.nota || '',
    rec.get(m.recId) || '',
  ]);
  return [['Fecha', 'Tipo', 'Categoría', 'Monto', 'Nota', 'Recurrente'], ...filas]
    .map((f) => f.map(celda).join(';')).join('\r\n');
}

/* ---------- leer ---------- */

// Filas de un CSV con comillas; el separador se adivina de la primera línea con datos.
export function leerCSV(texto) {
  const limpio = String(texto || '').replace(/^﻿/, '');
  const muestra = limpio.split(/\r?\n/).slice(0, 15).join('\n');
  const cuenta = (c) => (muestra.match(new RegExp(c === '\t' ? '\t' : `\\${c}`, 'g')) || []).length;
  const sep = [';', ',', '\t', '|'].sort((a, b) => cuenta(b) - cuenta(a))[0];
  const filas = [];
  let fila = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < limpio.length; i += 1) {
    const c = limpio[i];
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i += 1; } else if (c === '"') comillas = false; else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo.trim()); campo = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i += 1;
      fila.push(campo.trim()); campo = '';
      if (fila.some((x) => x !== '')) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo.trim());
  if (fila.some((x) => x !== '')) filas.push(fila);
  return filas;
}

/* Una fecha como la escriben los bancos, a 'AAAA-MM-DD'. En Colombia el día
   va primero: 03/09/2026 es 3 de septiembre. */
export function leerFecha(t) {
  const s = String(t || '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return armar(m[1], m[2], m[3]);
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return armar(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) return armar(m[3].length === 2 ? `20${m[3]}` : m[3], m[2], m[1]);
  return null;
}

function armar(a, m, d) {
  const mes = Number(m); const dia = Number(d);
  if (!(mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31)) return null;
  return `${a}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/* Un valor con su signo: "-130.000,00", "$ 1,200,000.00", "(45.000)". La
   regla de los decimales es la misma de la app: tres cifras después del
   último separador son miles, una o dos son centavos. */
export function leerMonto(t) {
  const s = String(t || '').trim();
  if (!/\d/.test(s)) return null;
  // en un valor, un guion en cualquier lado o los paréntesis contables son negativo
  const negativo = /^\(.*\)$/.test(s) || /[-−]/.test(s);
  const limpio = s.replace(/[^\d.,]/g, '');
  const ultimo = Math.max(limpio.lastIndexOf('.'), limpio.lastIndexOf(','));
  const decimales = ultimo >= 0 ? limpio.length - ultimo - 1 : 0;
  let n;
  if (ultimo >= 0 && decimales > 0 && decimales < 3) {
    n = Number(`${limpio.slice(0, ultimo).replace(/[.,]/g, '') || 0}.${limpio.slice(ultimo + 1)}`);
  } else n = Number(limpio.replace(/[.,]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(negativo ? -n : n);
}

/* ---------- qué columna es qué ---------- */

const PISTAS = {
  fecha: /fecha|date|dia\b/,
  descripcion: /descrip|concepto|detalle|movimiento|referencia|transacc|comercio|nombre/,
  debito: /debito|cargo|retiro|egreso|salida|debit/,
  credito: /credito|abono|deposito|ingreso|entrada|credit/,
  monto: /valor|monto|importe|amount|cantidad/,
};

/* Busca la fila de encabezados entre las primeras (los extractos suelen
   traer el nombre del banco y la cuenta arriba) y devuelve el índice de cada
   columna. Si no hay encabezados, lo adivina por el contenido. */
export function detectarColumnas(filas) {
  for (let i = 0; i < Math.min(filas.length, 15); i += 1) {
    const mapa = { encabezado: i, fecha: -1, descripcion: -1, monto: -1, debito: -1, credito: -1 };
    filas[i].forEach((c, j) => {
      const k = clave(c);
      for (const campo of ['fecha', 'debito', 'credito', 'monto', 'descripcion']) {
        if (mapa[campo] < 0 && PISTAS[campo].test(k)) { mapa[campo] = j; break; }
      }
    });
    const tieneValor = mapa.monto >= 0 || mapa.debito >= 0 || mapa.credito >= 0;
    if (mapa.fecha >= 0 && tieneValor) return mapa;
  }
  // sin encabezados: la primera columna con fechas, la última con números, la más larga de texto
  const datos = filas.slice(0, 20);
  const cols = Math.max(0, ...datos.map((f) => f.length));
  const puntaje = (j, fn) => datos.filter((f) => fn(f[j])).length;
  const idx = [...Array(cols).keys()];
  const fecha = idx.find((j) => puntaje(j, leerFecha) > datos.length / 2) ?? -1;
  const numericas = idx.filter((j) => j !== fecha && puntaje(j, (v) => /^[-−(]?\s*\$?\s*[\d.,]+\)?$/.test(String(v || '').trim())) > datos.length / 2);
  const monto = numericas.length ? numericas[0] : -1;
  const largo = (j) => datos.reduce((t, f) => t + String(f[j] || '').length, 0);
  const descripcion = idx.filter((j) => j !== fecha && !numericas.includes(j)).sort((a, b) => largo(b) - largo(a))[0] ?? -1;
  return { encabezado: -1, fecha, descripcion, monto, debito: -1, credito: -1 };
}

/* ---------- categoría ---------- */

// Comercios que en Colombia casi siempre son lo mismo. Apuntan a categorías por nombre.
const REGLAS = [
  [/exito|carulla|jumbo|olimpica|d1\b|ara\b|isimo|makro|metro\b|surtimax|colsubsidio merc|mercado|supermerc|fruver/, 'mercado'],
  [/rappi|ifood|domicilio|restaur|crepes|frisby|kfc|mcdonald|burger|el corral|juan valdez|starbucks|pizza|dominos/, 'comida fuera'],
  [/uber|didi|cabify|indriver|taxi|terpel|primax|texaco|biomax|peaje|parqueadero|transmilenio|tullave|metro de medellin|civica|gasolin/, 'transporte'],
  [/netflix|spotify|disney|hbo|max\.com|prime video|amazon prime|youtube|apple\.com|icloud|google|chatgpt|openai|claude|deezer|crunchyroll/, 'suscripciones'],
  [/epm|codensa|enel|vanti|gas natural|acueducto|claro|movistar|tigo|etb|une\b|wom\b|energia|aseo/, 'servicios'],
  [/drogueria|farmacia|cruz verde|farmatodo|locatel|eps|sura|colsanitas|medic|clinica|odont|laboratorio/, 'salud'],
  [/arriendo|administracion|arrendamiento|inmobiliaria/, 'vivienda'],
  [/cine|cinecolombia|cinemark|procinal|bar\b|discoteca|tiquet|eticket|boleta/, 'salidas'],
  [/falabella|zara|h&m|arturo calle|mercadolibre|mercado libre|amazon|tennis|studio f|alkosto|ktronix|homecenter/, 'compras'],
  [/universidad|colegio|curso|platzi|udemy|coursera|matricula/, 'educacion'],
  [/veterin|mascota|pet|laika/, 'mascotas'],
];
const REGLAS_INGRESO = [[/nomina|sueldo|salario|pago nom|quincena/, 'sueldo']];

/* Adivina la categoría de un movimiento importado: primero por lo que tú
   mismo has hecho con descripciones parecidas, luego por las reglas de
   comercios, y si nada, Otros. */
export function adivinarCategoria(nota, tipo, cats, movs = []) {
  const n = clave(nota);
  const deTipo = (cats || []).filter((c) => c.tipo === tipo);
  const porNombre = (nombre) => deTipo.find((c) => clave(c.n) === nombre)?.id;
  // las dos primeras palabras con sustancia: "COMPRA EXITO CALLE 80" → compra, exito
  const palabras = n.split(/[^a-z0-9]+/).filter((w) => w.length > 2).slice(0, 2);
  if (palabras.length) {
    const conteo = {};
    movs.forEach((m) => {
      const otra = clave(m.nota);
      if (m.tipo === tipo && m.catId && palabras.every((w) => otra.includes(w))) conteo[m.catId] = (conteo[m.catId] || 0) + 1;
    });
    const mejor = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];
    if (mejor && deTipo.some((c) => c.id === mejor[0])) return mejor[0];
  }
  for (const [re, nombre] of tipo === 'ingreso' ? REGLAS_INGRESO : REGLAS) {
    if (re.test(n) && porNombre(nombre)) return porNombre(nombre);
  }
  return fallbackDe(tipo);
}

/* ---------- filas a movimientos ---------- */

/* Convierte las filas en candidatos a movimiento. Los montos negativos (o
   los de la columna de débitos) son gastos. `duplicado` marca los que ya
   están: misma fecha, mismo tipo y mismo monto. */
export function aCandidatos(filas, mapa, { cats = [], movs = [] } = {}) {
  const ya = new Set(movs.map((m) => `${m.fecha}|${m.tipo}|${m.monto}`));
  return filas.slice(mapa.encabezado + 1).map((f, i) => {
    const fecha = leerFecha(f[mapa.fecha]);
    let valor = null;
    if (mapa.debito >= 0 || mapa.credito >= 0) {
      const deb = mapa.debito >= 0 ? leerMonto(f[mapa.debito]) : null;
      const cre = mapa.credito >= 0 ? leerMonto(f[mapa.credito]) : null;
      if (deb) valor = -Math.abs(deb); else if (cre) valor = Math.abs(cre);
    }
    if (valor === null && mapa.monto >= 0) valor = leerMonto(f[mapa.monto]);
    if (!fecha || !valor) return null;
    const tipo = valor < 0 ? 'gasto' : 'ingreso';
    const monto = Math.abs(valor);
    const nota = String(f[mapa.descripcion] ?? '').replace(/\s+/g, ' ').trim();
    return {
      id: `fila-${i}`, fecha, tipo, monto, nota,
      catId: adivinarCategoria(nota, tipo, cats, movs),
      duplicado: ya.has(`${fecha}|${tipo}|${monto}`),
    };
  }).filter(Boolean);
}
