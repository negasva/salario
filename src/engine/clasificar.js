/* F11 — categorías de gasto y clasificador local.

   Diez categorías y ni una más: con veinte, nadie clasifica nada. La regla
   difícil es la del pan: "pan, lechuga, salsa de tomate" es mercado, pero
   "comida en Dogger" es comida preparada, y las dos son comida. Por eso el
   diccionario trae marcas y palabras de Colombia, no solo sustantivos.

   Esto corre en el navegador, sin red y sin costo. La IA de `src/ia.js` solo
   se llama para lo que aquí queda en 'otros' o con poca confianza. */

export const CATEGORIAS = [
  { id: 'mercado', n: 'Mercado', ic: 'mercado' },
  { id: 'comida-fuera', n: 'Comida preparada', ic: 'restaurante' },
  { id: 'vivienda', n: 'Vivienda', ic: 'casa' },
  { id: 'servicios', n: 'Servicios', ic: 'servicios' },
  { id: 'transporte', n: 'Transporte', ic: 'transporte' },
  { id: 'salud', n: 'Salud', ic: 'salud' },
  { id: 'ocio', n: 'Ocio', ic: 'ocio' },
  { id: 'suscripciones', n: 'Suscripciones', ic: 'suscripcion' },
  { id: 'educacion', n: 'Educación', ic: 'educacion' },
  { id: 'otros', n: 'Otros', ic: 'etiqueta' },
];

export function nombreCategoria(id) {
  return CATEGORIAS.find((c) => c.id === id)?.n || 'Otros';
}

// Marcas y palabras que mandan sobre cualquier otra pista del texto
const RESTAURANTES = ['dogger', 'frisby', 'corral', 'crepes', 'juan valdez', 'mcdonald', 'burger king',
  'kfc', 'presto', 'sandwich cubano', 'wok', 'archies', 'andres carne', 'sierra nevada', 'tostao',
  'dunkin', 'starbucks', 'papa john', 'domino', 'subway', 'popsy', 'mimos', 'crepes & waffles',
  'rappi', 'didi food', 'ifood', 'domicilio', 'domicilios', 'restaurante', 'almuerzo', 'corrientazo',
  'menu del dia', 'cena', 'desayuno afuera', 'comida en', 'bandeja paisa', 'pizzeria', 'asadero',
  'panaderia', 'cafeteria', 'heladeria', 'bar ', 'cerveza', 'cocteles'];

const MERCADO = ['mercado', 'supermercado', 'exito', 'olimpica', 'jumbo', 'carulla', 'ara', 'd1',
  'justo & bueno', 'makro', 'metro', 'plaza de mercado', 'granero', 'fruver', 'carniceria',
  'pan', 'leche', 'huevos', 'arroz', 'panela', 'lechuga', 'tomate', 'salsa de tomate', 'cebolla',
  'papa', 'platano', 'yuca', 'carne', 'pollo', 'pescado', 'queso', 'cafe molido', 'aceite',
  'azucar', 'sal', 'harina', 'frijol', 'lenteja', 'atun', 'jabon', 'papel higienico', 'detergente',
  'aseo', 'shampoo', 'crema dental', 'pañales', 'verduras', 'frutas', 'abarrotes'];

const VIVIENDA = ['arriendo', 'alquiler', 'administracion', 'hipoteca', 'cuota vivienda', 'predial',
  'reparacion casa', 'muebles', 'ferreteria', 'homecenter'];

const SERVICIOS = ['luz', 'energia', 'agua', 'acueducto', 'gas', 'internet', 'claro', 'movistar',
  'tigo', 'wom', 'etb', 'celular', 'plan de datos', 'recibo', 'factura', 'epm', 'enel', 'vanti',
  'servicios publicos', 'basuras'];

const TRANSPORTE = ['gasolina', 'acpm', 'combustible', 'uber', 'didi', 'cabify', 'taxi', 'bus',
  'transmilenio', 'metro de medellin', 'mio', 'pasaje', 'peaje', 'parqueadero', 'soat',
  'tecnomecanica', 'llantas', 'mecanico', 'lavado de carro', 'moto', 'bicicleta', 'patineta'];

const SALUD = ['eps', 'medicina prepagada', 'sura', 'sanitas', 'compensar', 'colsanitas', 'droguer',
  'farmacia', 'cruz verde', 'medico', 'odontolog', 'examen', 'laboratorio', 'gimnasio', 'smartfit',
  'bodytech', 'terapia', 'psicolog', 'optica', 'lentes'];

const OCIO = ['cine', 'cinemark', 'cinecolombia', 'concierto', 'boleta', 'viaje', 'hotel', 'airbnb',
  'vuelo', 'avianca', 'latam', 'wingo', 'paseo', 'parque', 'juego', 'videojuego', 'playstation',
  'xbox', 'nintendo', 'regalo', 'fiesta', 'discoteca', 'salida'];

const SUSCRIPCIONES = ['netflix', 'spotify', 'disney', 'hbo', 'max', 'prime video', 'amazon prime',
  'youtube premium', 'apple', 'icloud', 'google one', 'chatgpt', 'openai', 'canva', 'office 365',
  'suscripcion', 'membresia', 'deezer', 'crunchyroll', 'paramount', 'star+'];

const EDUCACION = ['universidad', 'matricula', 'pension colegio', 'colegio', 'curso', 'diplomado',
  'platzi', 'coursera', 'udemy', 'libro', 'libreria', 'utiles', 'semestre', 'icetex'];

const GRUPOS = [
  ['comida-fuera', RESTAURANTES],
  ['mercado', MERCADO],
  ['vivienda', VIVIENDA],
  ['servicios', SERVICIOS],
  ['transporte', TRANSPORTE],
  ['salud', SALUD],
  ['suscripciones', SUSCRIPCIONES],
  ['educacion', EDUCACION],
  ['ocio', OCIO],
];

export function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/* Devuelve { cat, confianza }. La confianza es cuántas pistas encontró: con 0
   el resultado es 'otros' y ahí es donde vale la pena preguntarle a la IA. */
export function clasificarLocal(texto) {
  const t = normalizar(texto);
  if (!t.trim()) return { cat: 'otros', confianza: 0 };

  const puntajes = GRUPOS.map(([cat, palabras]) => {
    const aciertos = palabras.filter((w) => t.includes(w)).length;
    // una marca de restaurante pesa doble: "comida en Dogger" no es mercado
    const peso = cat === 'comida-fuera' ? 2 : 1;
    return { cat, puntos: aciertos * peso };
  }).filter((x) => x.puntos > 0).sort((a, b) => b.puntos - a.puntos);

  if (!puntajes.length) return { cat: 'otros', confianza: 0 };
  return { cat: puntajes[0].cat, confianza: puntajes[0].puntos };
}

/* Una lista de compras es mercado aunque traiga la palabra "pan": se clasifica
   por el conjunto, no renglón por renglón. */
export function clasificarLista(texto) {
  const partes = String(texto || '').split(/[,;\n]|\sy\s/).map((s) => s.trim()).filter(Boolean);
  if (partes.length < 2) return clasificarLocal(texto);
  const votos = {};
  partes.forEach((parte) => {
    const { cat, confianza } = clasificarLocal(parte);
    if (confianza > 0) votos[cat] = (votos[cat] || 0) + confianza;
  });
  const ganador = Object.entries(votos).sort((a, b) => b[1] - a[1])[0];
  return ganador ? { cat: ganador[0], confianza: ganador[1] } : { cat: 'otros', confianza: 0 };
}

// El bloque del reparto al que suele ir cada categoría, para proponer itemId
export const CATEGORIA_A_ROL = {
  mercado: 'ese', vivienda: 'ese', servicios: 'ese', transporte: 'ese', salud: 'ese',
  'comida-fuera': 'lib', ocio: 'lib', suscripciones: 'lib', educacion: 'ese', otros: 'lib',
};
