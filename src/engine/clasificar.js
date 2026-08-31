/* F11 — categorías de gasto y clasificador local.

   Dos niveles: 15 subcategorías repartidas en 6 grupos, más 'otros'. El
   movimiento guarda la subcategoría; el grupo se deriva, nunca se guarda. La
   regla difícil sigue siendo la del pan: "pan, lechuga, salsa de tomate" es
   mercado, pero "comida en Dogger" es restaurante, y las dos son comida. Por
   eso el diccionario trae marcas y palabras de Colombia, no solo sustantivos.

   Se busca por palabra completa, no por pedazo de palabra. Con `includes` a
   secas, "Salida Cadavid" caía en mercado porque adentro está la "sal", y
   "Parqueadero" arrastraba media docena de pistas falsas. Ahora el texto se
   parte en palabras y una pista solo cuenta si calza entera; las que terminan
   en `*` calzan por prefijo, que es como se cubre "droguer*" (droguería,
   droguerías, drogueria la rebaja).

   Una pista de varias palabras pesa más que una suelta, y las marcas pesan
   triple: "seguro moto" gana a "seguro", "mercado libre" gana a "mercado" y
   "papa john" gana a "papa". Ahí es donde se juega la precisión.

   Esto corre en el navegador, sin red y sin costo. La IA de `src/ia.js` solo
   se llama para lo que aquí queda en 'otros'. */

export const GRUPOS = [
  { id: 'hogar', n: 'Hogar' },
  { id: 'alimentacion', n: 'Alimentación' },
  { id: 'transporte', n: 'Transporte' },
  { id: 'bienestar', n: 'Bienestar' },
  { id: 'ocio', n: 'Ocio' },
  { id: 'obligaciones', n: 'Obligaciones' },
];

export const CATEGORIAS = [
  { id: 'vivienda', n: 'Vivienda', ic: 'casa', grupo: 'hogar' },
  { id: 'servicios', n: 'Servicios', ic: 'servicios', grupo: 'hogar' },
  { id: 'mercado', n: 'Mercado', ic: 'mercado', grupo: 'alimentacion' },
  { id: 'restaurantes', n: 'Restaurantes', ic: 'restaurante', grupo: 'alimentacion' },
  { id: 'transporte', n: 'Transporte', ic: 'transporte', grupo: 'transporte' },
  { id: 'vehiculo', n: 'Vehículo', ic: 'etiqueta', grupo: 'transporte' },
  { id: 'salud', n: 'Salud', ic: 'salud', grupo: 'bienestar' },
  { id: 'cuidado', n: 'Cuidado', ic: 'etiqueta', grupo: 'bienestar' },
  { id: 'mascotas', n: 'Mascotas', ic: 'etiqueta', grupo: 'bienestar' },
  { id: 'suscripciones', n: 'Suscripciones', ic: 'suscripcion', grupo: 'ocio' },
  { id: 'salidas', n: 'Salidas', ic: 'ocio', grupo: 'ocio' },
  { id: 'viajes', n: 'Viajes', ic: 'etiqueta', grupo: 'ocio' },
  { id: 'compras', n: 'Compras', ic: 'ropa', grupo: 'ocio' },
  { id: 'finanzas', n: 'Finanzas', ic: 'banco', grupo: 'obligaciones' },
  { id: 'educacion', n: 'Educación', ic: 'educacion', grupo: 'obligaciones' },
  { id: 'otros', n: 'Otros', ic: 'etiqueta', grupo: '' },
];

/* Las 10 categorías viejas mapeadas a la taxonomía nueva. Ninguna se pierde:
   la migración de `normalizeProfile()` la aplica una sola vez. La IA también
   pasa por aquí, porque un modelo puede contestar con el nombre viejo. */
export const MIGRACION_CAT = {
  mercado: 'mercado',
  'comida-fuera': 'restaurantes',
  vivienda: 'vivienda',
  servicios: 'servicios',
  transporte: 'transporte',
  salud: 'salud',
  ocio: 'salidas',
  suscripciones: 'suscripciones',
  educacion: 'educacion',
  otros: 'otros',
};

export function esCategoria(id) {
  return CATEGORIAS.some((c) => c.id === id);
}

/* Deja pasar un id válido, traduce uno viejo y descarta lo demás. Lo que
   contesta la IA entra por aquí antes de tocar un movimiento. */
export function normalizarCat(id) {
  const limpio = String(id || '').trim().toLowerCase();
  if (esCategoria(limpio)) return limpio;
  return MIGRACION_CAT[limpio] || null;
}

export function nombreCategoria(id) {
  return CATEGORIAS.find((c) => c.id === id)?.n || 'Otros';
}

export function iconoCategoria(id) {
  return CATEGORIAS.find((c) => c.id === id)?.ic || 'etiqueta';
}

export function grupoDe(catId) {
  return CATEGORIAS.find((c) => c.id === catId)?.grupo || '';
}

export function nombreGrupo(grupoId) {
  return GRUPOS.find((g) => g.id === grupoId)?.n || '';
}

/* Las pistas de cada categoría. `fuertes` son marcas y frases que casi no se
   equivocan; `normales` son sustantivos que solo deciden cuando no hay nada
   mejor. Una categoría sin pistas —'otros'— nunca gana por diccionario. */
const PISTAS = {
  vivienda: {
    fuertes: ['arriendo', 'alquiler', 'hipoteca', 'predial', 'cuota vivienda', 'administracion',
      'homecenter', 'sodimac', 'cuota apartamento', 'impuesto predial', 'mudanza'],
    normales: ['canon', 'reparacion casa', 'muebles', 'ferreteria', 'pintura casa', 'plomero',
      'electricista', 'cerrajero', 'colchon', 'celaduria', 'porteria', 'deposito'],
  },
  servicios: {
    fuertes: ['epm', 'enel', 'vanti', 'afinia', 'emcali', 'air-e', 'claro', 'movistar', 'tigo',
      'wom', 'etb', 'une', 'servicios publicos', 'plan celular', 'plan de datos', 'claro hogar',
      'acueducto', 'alcantarillado', 'aseo publico'],
    normales: ['luz', 'energia', 'agua', 'gas', 'internet', 'celular', 'recibo', 'factura',
      'basuras', 'recarga', 'minutos', 'wifi', 'fibra', 'telefono'],
  },
  mercado: {
    fuertes: ['mercado', 'supermercado', 'exito', 'olimpica', 'jumbo', 'carulla', 'ara', 'd1',
      'justo y bueno', 'justo bueno', 'makro', 'plaza de mercado', 'euro', 'zapatoca',
      'la vaquita', 'consumo', 'granero', 'fruver', 'carniceria', 'abarrotes'],
    normales: ['pan', 'leche', 'huevos', 'arroz', 'panela', 'lechuga', 'tomate', 'salsa de tomate',
      'cebolla', 'papa', 'platano', 'yuca', 'carne', 'pollo', 'pescado', 'queso', 'cafe molido',
      'aceite', 'azucar', 'sal', 'harina', 'frijol', 'lenteja', 'atun', 'jabon', 'papel higienico',
      'detergente', 'aseo', 'shampoo', 'crema dental', 'panales', 'verduras', 'frutas', 'mantequilla',
      'yogurt', 'cereal', 'galletas', 'arepas de maiz', 'tienda', 'metro'],
  },
  restaurantes: {
    fuertes: ['dogger', 'frisby', 'el corral', 'corral', 'crepes', 'crepes y waffles', 'juan valdez',
      'mcdonald', 'mcdonalds', 'burger king', 'kfc', 'presto', 'wok', 'archies', 'andres carne',
      'sierra nevada', 'tostao', 'dunkin', 'starbucks', 'papa john', 'domino', 'dominos', 'subway',
      'popsy', 'mimos', 'rappi', 'didi food', 'ifood', 'restaurante', 'corrientazo', 'menu del dia',
      'almuerzo ejecutivo', 'comida rapida', 'taqueria', 'tacos', 'pizzeria', 'pizza', 'sushi',
      'hamburguesa', 'asadero', 'panaderia', 'cafeteria', 'heladeria', 'domicilio', 'domicilios',
      'bandeja paisa', 'sancocho', 'empanadas', 'salchipapa', 'perro caliente', 'sandwich cubano'],
    normales: ['almuerzo', 'cena', 'desayuno', 'comida', 'onces', 'postre', 'helado', 'cafe',
      'jugo', 'malteada', 'chuzo', 'asado', 'buffet'],
  },
  transporte: {
    fuertes: ['gasolina', 'acpm', 'combustible', 'uber', 'didi', 'indriver', 'cabify', 'taxi',
      'transmilenio', 'metro de medellin', 'metroplus', 'peaje', 'parqueadero', 'parqueo',
      'transporte', 'pasaje', 'pasajes', 'sitp', 'cable'],
    normales: ['bus', 'buseta', 'colectivo', 'mio', 'tren', 'patineta', 'bicicleta', 'cicla',
      'terminal', 'flota'],
  },
  vehiculo: {
    fuertes: ['soat', 'tecnomecanica', 'revision tecnomecanica', 'seguro moto', 'seguro carro',
      'seguro del carro', 'seguro de la moto', 'poliza vehiculo', 'impuesto vehicular', 'llantas',
      'mecanico', 'taller', 'lavado de carro', 'lavada de carro', 'cambio de aceite', 'repuestos',
      'cuota moto', 'cuota carro', 'matricula vehiculo', 'grua', 'sincronizacion'],
    normales: ['moto', 'carro', 'vehiculo', 'frenos', 'bateria', 'alineacion', 'motor',
      'casco', 'kit de arrastre', 'espejos'],
  },
  salud: {
    fuertes: ['eps', 'medicina prepagada', 'sura', 'sanitas', 'colsanitas', 'compensar', 'coomeva',
      'nueva eps', 'famisanar', 'droguer*', 'farmacia', 'cruz verde', 'la rebaja', 'locatel',
      'cita medica', 'odontolog*', 'ortodoncia', 'psicolog*', 'laboratorio clinico', 'radiografia',
      'urgencias', 'hospital', 'clinica'],
    normales: ['medico', 'doctor', 'examen', 'laboratorio', 'terapia', 'optica', 'lentes', 'gafas',
      'medicamentos', 'pastillas', 'vacuna', 'consulta', 'incapacidad', 'nutricionista'],
  },
  cuidado: {
    fuertes: ['peluqueria', 'barberia', 'salon de belleza', 'corte de pelo', 'manicure', 'pedicure',
      'gimnasio', 'smartfit', 'smart fit', 'bodytech', 'crossfit', 'depilacion', 'maquillaje'],
    normales: ['spa', 'masaje', 'cejas', 'pestanas', 'perfume', 'cosmeticos', 'gym', 'yoga',
      'pilates', 'tinte', 'keratina'],
  },
  mascotas: {
    fuertes: ['veterinari*', 'concentrado', 'purina', 'dog chow', 'chunky', 'mascota', 'mascotas',
      'peluqueria canina', 'guarderia canina', 'arena para gato', 'agility'],
    normales: ['perro', 'gato', 'croquetas', 'garrapatas', 'desparasitante', 'juguete para perro'],
  },
  suscripciones: {
    fuertes: ['netflix', 'spotify', 'disney', 'disney plus', 'hbo', 'hbo max', 'prime video',
      'amazon prime', 'youtube premium', 'icloud', 'google one', 'chatgpt', 'openai', 'claude',
      'canva', 'office 365', 'microsoft 365', 'adobe', 'deezer', 'crunchyroll', 'paramount',
      'star plus', 'vix', 'suscripcion', 'membresia', 'plan mensual'],
    normales: ['apple', 'plataforma', 'renovacion'],
  },
  salidas: {
    fuertes: ['cine', 'cinemark', 'cine colombia', 'cinecolombia', 'procinal', 'concierto',
      'discoteca', 'rumba', 'karaoke', 'boleta', 'boletas', 'teatro', 'festival', 'salida',
      'bolos', 'billar', 'tejo', 'micheladas', 'michelada'],
    normales: ['bar', 'cerveza', 'cervezas', 'trago', 'tragos', 'aguardiente', 'ron', 'coctel',
      'cocteles', 'fiesta', 'parque', 'museo', 'evento', 'paseo'],
  },
  viajes: {
    fuertes: ['viaje', 'viajes', 'hotel', 'hostal', 'airbnb', 'booking', 'vuelo', 'vuelos',
      'tiquete', 'tiquetes', 'avianca', 'latam', 'wingo', 'satena', 'copa airlines', 'pasadia',
      'excursion', 'crucero', 'tour'],
    normales: ['finca', 'camping', 'maleta', 'hospedaje', 'aeropuerto', 'equipaje'],
  },
  compras: {
    fuertes: ['ropa', 'zapatos', 'tenis', 'zara', 'falabella', 'mercado libre', 'mercadolibre',
      'amazon', 'shein', 'temu', 'alkosto', 'ktronix', 'computador', 'portatil', 'audifonos',
      'televisor', 'electrodomestico', 'playstation', 'xbox', 'nintendo', 'steam', 'videojuego',
      'regalo', 'celular nuevo'],
    normales: ['camisa', 'pantalon', 'vestido', 'chaqueta', 'bolso', 'reloj', 'juguete',
      'decoracion', 'accesorios', 'gorra'],
  },
  finanzas: {
    fuertes: ['cuota tarjeta', 'pago tarjeta', 'tarjeta de credito', 'prestamo', 'credito',
      'cuota credito', 'cuota de manejo', '4x1000', 'seguro', 'seguro de vida', 'poliza',
      'libranza', 'avance', 'datacredito', 'gota gota', 'refinanciacion'],
    normales: ['interes', 'intereses', 'banco', 'mora', 'cdt', 'inversion', 'ahorro programado',
      'comision', 'cuota'],
  },
  educacion: {
    fuertes: ['universidad', 'matricula', 'pension colegio', 'colegio', 'curso', 'diplomado',
      'platzi', 'coursera', 'udemy', 'duolingo', 'icetex', 'semestre', 'posgrado', 'maestria',
      'utiles escolares', 'guarderia'],
    normales: ['libro', 'libros', 'libreria', 'utiles', 'academia', 'ingles', 'clases',
      'seminario', 'certificacion'],
  },
};

const PESO_FUERTE = 3;
const PESO_NORMAL = 1;

export function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/* El texto queda como ' palabra palabra ', para poder preguntar por palabras
   completas con un `includes` y sin armar una expresión regular por pista. */
function enPalabras(texto) {
  return ` ${normalizar(texto).replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

function calza(txt, pista) {
  if (pista.endsWith('*')) return txt.includes(` ${normalizar(pista.slice(0, -1))}`);
  return txt.includes(enPalabras(pista));
}

// Una frase de varias palabras dice más que la misma pista suelta
function pesoDe(pista, base) {
  return base + (pista.trim().split(/\s+/).length - 1);
}

/* Devuelve { cat, confianza }. La confianza es el peso de las pistas que
   encontró: con 0 el resultado es 'otros' y ahí es donde vale la pena
   preguntarle a la IA. */
export function clasificarLocal(texto) {
  const txt = enPalabras(texto);
  if (txt.trim().length < 2) return { cat: 'otros', confianza: 0 };

  const puntajes = Object.entries(PISTAS).map(([cat, { fuertes = [], normales = [] }]) => {
    let puntos = 0;
    let mejor = 0;
    const sumar = (lista, base) => lista.forEach((pista) => {
      if (!calza(txt, pista)) return;
      puntos += pesoDe(pista, base);
      mejor = Math.max(mejor, pista.length);
    });
    sumar(fuertes, PESO_FUERTE);
    sumar(normales, PESO_NORMAL);
    return { cat, puntos, mejor };
  }).filter((x) => x.puntos > 0)
    // a igual puntaje gana la pista más larga: 'seguro moto' antes que 'seguro'
    .sort((a, b) => b.puntos - a.puntos || b.mejor - a.mejor);

  if (!puntajes.length) return { cat: 'otros', confianza: 0 };
  return { cat: puntajes[0].cat, confianza: puntajes[0].puntos };
}

/* Una lista de compras es mercado aunque traiga la palabra "pan": se clasifica
   por el conjunto, no renglón por renglón. */
export function clasificarLista(texto) {
  const partes = String(texto || '').split(/[,;\n·]|\sy\s/).map((s) => s.trim()).filter(Boolean);
  if (partes.length < 2) return clasificarLocal(texto);
  const votos = {};
  partes.forEach((parte) => {
    const { cat, confianza } = clasificarLocal(parte);
    if (confianza > 0) votos[cat] = (votos[cat] || 0) + confianza;
  });
  const ganador = Object.entries(votos).sort((a, b) => b[1] - a[1])[0];
  // el conjunto puede no decir nada y el texto entero sí: "salsa de tomate" partido en dos
  return ganador ? { cat: ganador[0], confianza: ganador[1] } : clasificarLocal(texto);
}

/* El texto con el que se clasifica un movimiento viejo. La nota manda; el
   renglón —Arriendo, Gasolina, Mercado— es la mejor pista después de ella. El
   nombre del bloque solo entra cuando no hay nada más, porque suele ser un
   rótulo de reparto ("Gastos recurrentes") y no dice qué se compró. */
export function textoDeMovimiento(mov, items = []) {
  const it = items.find((x) => x.id === mov.itemId);
  const linea = it?.L?.find((l) => l.id === mov.lineId);
  const partes = [mov.nota, linea?.n].filter(Boolean);
  if (!partes.length && it?.n) partes.push(it.n);
  return partes.join(' · ');
}

/* Los gastos a los que todavía les falta una categoría de verdad. Lo que el
   usuario eligió a mano (`catManual`) y lo que la IA ya miró (`catIA`) no
   vuelven a la fila, aunque hayan quedado en 'otros'. */
export function sinClasificar(movs = []) {
  return movs.filter((m) => m.tipo === 'gasto' && !m.catManual && !m.catIA
    && (!m.cat || m.cat === 'otros'));
}

/* Pasada local sobre lo ya registrado: todo gasto sin `cat` recibe una, aunque
   sea 'otros'. Es gratis, sin red, y corre al cargar el perfil. Devuelve
   cuántos movimientos tocó. */
export function clasificarViejos(movs = [], items = []) {
  let n = 0;
  movs.forEach((m) => {
    if (m.tipo !== 'gasto' || m.cat || m.catManual) return;
    m.cat = clasificarLista(textoDeMovimiento(m, items)).cat;
    n++;
  });
  return n;
}

// El bloque del reparto al que suele ir cada categoría, para proponer itemId
export const CATEGORIA_A_ROL = {
  vivienda: 'ese', servicios: 'ese', mercado: 'ese', transporte: 'ese', vehiculo: 'ese',
  salud: 'ese', educacion: 'ese', finanzas: 'deu', mascotas: 'ese',
  restaurantes: 'lib', cuidado: 'lib', suscripciones: 'lib', salidas: 'lib',
  viajes: 'lib', compras: 'lib', otros: 'lib',
};
