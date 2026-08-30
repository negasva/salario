/* Función de IA. Vive en el servidor por una razón: la llave del proveedor no
   puede estar en el navegador, donde cualquiera la saca del bundle.

   Despliegue:
     supabase secrets set NVIDIA_API_KEY=...
     supabase functions deploy ia
   Sin ella la app funciona igual: el clasificador local es el plan A y esto
   solo afina lo que quedó en 'otros'.

   Dos acciones y ninguna más: 'clasificar' devuelve JSON, 'preguntar' devuelve
   una frase corta sobre números que le manda la app ya calculados. */

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODELO = Deno.env.get('IA_MODELO') || 'meta/llama-3.1-8b-instruct';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ORIGEN_PERMITIDO') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/* Las mismas 16 categorías de `src/engine/clasificar.js`. Si esta lista y la
   del navegador se separan, la app descarta lo que conteste el modelo y el
   gasto se queda en 'otros': por eso van juntas y por eso se validan abajo. */
const CATS = ['vivienda', 'servicios', 'mercado', 'restaurantes', 'transporte', 'vehiculo',
  'salud', 'cuidado', 'mascotas', 'suscripciones', 'salidas', 'viajes', 'compras',
  'finanzas', 'educacion', 'otros'];

// nombres viejos que un modelo puede contestar de memoria
const VIEJAS: Record<string, string> = { 'comida-fuera': 'restaurantes', 'comida fuera': 'restaurantes',
  ocio: 'salidas', restaurante: 'restaurantes', mercados: 'mercado', suscripcion: 'suscripciones',
  educación: 'educacion', vehículo: 'vehiculo', transportes: 'transporte' };

const PROMPT_CLASIFICAR = `Eres un clasificador de gastos personales en Colombia.
Devuelves SOLO un array JSON, sin explicaciones ni markdown, con UN elemento por
cada texto que te dan y EN EL MISMO ORDEN.

Categorías válidas (usa el id exacto, en minúscula y sin tilde):
- vivienda: arriendo, administración, hipoteca, predial, arreglos y muebles de la casa.
- servicios: energía, agua, gas, internet, plan de celular, TV. EPM, Enel, Vanti, Afinia,
  Emcali, Claro, Movistar, Tigo, WOM, ETB.
- mercado: comida cruda y productos de supermercado o tienda. Éxito, D1, Ara, Olímpica,
  Jumbo, Carulla, Makro, la plaza, el granero. Pan, lechuga, salsa de tomate, arroz,
  jabón, papel higiénico y pañales son mercado aunque sean comida o aseo.
- restaurantes: comida ya preparada, domicilios, cafeterías, panaderías de consumo.
  Dogger, Frisby, El Corral, Crepes & Waffles, Juan Valdez, Tostao, Presto, Sierra Nevada,
  Archies, Andrés Carne de Res, Popsy, Mimos, Rappi, DiDi Food, iFood. Un corrientazo, un
  almuerzo ejecutivo, un menú del día, unos tacos o una pizza son restaurantes.
- transporte: moverse. Gasolina, ACPM, Uber, DiDi, inDriver, taxi, bus, TransMilenio,
  metro, peajes, parqueadero, pasajes urbanos.
- vehiculo: tener el carro o la moto. SOAT, tecnomecánica, seguro del vehículo, impuesto
  vehicular, llantas, mecánico, taller, repuestos, cambio de aceite, cuota del vehículo.
- salud: EPS, medicina prepagada, Sura, Sanitas, droguería, farmacia, médico, odontología,
  exámenes, terapias, lentes, medicamentos.
- cuidado: cuidado personal. Peluquería, barbería, manicure, spa, depilación, maquillaje,
  gimnasio, Smart Fit, Bodytech, yoga.
- mascotas: veterinario, concentrado, guardería o peluquería canina, accesorios del animal.
- suscripciones: cobros mensuales de plataformas. Netflix, Spotify, Disney+, HBO Max,
  Prime Video, YouTube Premium, iCloud, Google One, ChatGPT, Canva, Office 365.
- salidas: cine, conciertos, bares, discotecas, boletas, fiestas, parques, eventos, tragos.
- viajes: hoteles, Airbnb, vuelos (Avianca, LATAM, Wingo), tiquetes, pasadías, fincas, tours.
- compras: ropa, zapatos, tecnología, electrodomésticos, regalos, juguetes, Mercado Libre,
  Amazon, Shein, Temu, Falabella, Alkosto, Ktronix.
- finanzas: cuotas de tarjeta y créditos, intereses, cuota de manejo, seguros de vida,
  pólizas, avances, 4x1000.
- educacion: universidad, matrícula, colegio, cursos, diplomados, Platzi, Coursera, Udemy,
  útiles, libros de estudio, ICETEX.
- otros: SOLO cuando el texto de verdad no alcanza para decidir.

Reglas que importan:
- Comida cruda es mercado; comida preparada es restaurantes. "Comida en Dogger" es
  restaurantes, no mercado; "pan, lechuga, salsa de tomate" es mercado, no restaurantes.
- Gasolina y peajes son transporte; SOAT, seguro y mantenimiento del vehículo son vehiculo.
- Un pago mensual de plataforma es suscripciones; un aparato o ropa que se compra una vez
  es compras.
- Si no estás seguro, contesta la categoría más probable con confianza baja, no "otros".

Formato de cada elemento: {"texto": "...", "cat": "...", "confianza": 0.0-1.0}`;

const PROMPT_PREGUNTAR = `Eres el asistente de una app de presupuesto personal
colombiana. Te llegan cifras ya calculadas por la app y una pregunta del usuario.
Responde en español de Colombia, en dos o tres frases, con las cifras que te dieron.
No inventes números que no estén en los datos. No uses markdown ni listas.`;

// 25 segundos y ni uno más: sin esto, un proveedor lento deja la tarjeta de la
// app en "Pensando…" hasta que el usuario se aburra
const LIMITE_MS = 25000;

async function nvidia(messages: unknown[], maxTokens: number) {
  const key = Deno.env.get('NVIDIA_API_KEY');
  if (!key) return { error: 'sin-llave' };
  let r: Response;
  try {
    r = await fetch(NVIDIA_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODELO, messages, temperature: 0.2, top_p: 0.95, max_tokens: maxTokens, stream: false }),
      signal: AbortSignal.timeout(LIMITE_MS),
    });
  } catch (e) {
    console.error('proveedor', e instanceof Error ? e.name : e);
    return { error: e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError') ? 'tardo' : 'red' };
  }
  if (!r.ok) {
    console.error('proveedor', r.status, (await r.text()).slice(0, 300));
    return { error: `proveedor-${r.status}` };
  }
  const data = await r.json();
  const m = data.choices?.[0]?.message ?? {};
  // algunos modelos de razonamiento mandan el texto en reasoning_content
  return { texto: m.content || m.reasoning_content || '' };
}

function soloJSON(texto: string) {
  const i = texto.indexOf('[');
  const j = texto.lastIndexOf(']');
  if (i < 0 || j < i) return null;
  try {
    return JSON.parse(texto.slice(i, j + 1));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  // sin sesión no se contesta: la función gasta cuota del proveedor
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'sin-sesion' }, 401);

  let cuerpo;
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: 'cuerpo-invalido' }, 400);
  }

  if (cuerpo.accion === 'clasificar') {
    const textos = (cuerpo.textos || []).slice(0, 30).map((t: string) => String(t).slice(0, 120));
    if (!textos.length) return json({ resultados: [] });
    const { texto, error } = await nvidia([
      { role: 'system', content: PROMPT_CLASIFICAR },
      { role: 'user', content: JSON.stringify(textos) },
    ], 2000);
    if (error) return json({ error }, 503);
    const crudos = soloJSON(texto);
    if (!Array.isArray(crudos)) return json({ error: 'respuesta-ilegible' }, 502);
    /* El modelo contesta lo que quiere: aquí se le exige una categoría de la
       lista y, si no la da, el gasto vuelve a 'otros' en vez de guardar basura
       que la app tendría que descartar después. */
    const resultados = crudos.map((r: Record<string, unknown>, i: number) => {
      const bruto = String(r?.cat ?? '').trim().toLowerCase();
      const cat = CATS.includes(bruto) ? bruto : (VIEJAS[bruto] || 'otros');
      const conf = Number(r?.confianza);
      return {
        texto: typeof r?.texto === 'string' ? r.texto : textos[i],
        cat,
        confianza: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.5,
      };
    });
    return json({ resultados });
  }

  if (cuerpo.accion === 'preguntar') {
    const t0 = Date.now();
    const { texto, error } = await nvidia([
      { role: 'system', content: PROMPT_PREGUNTAR },
      { role: 'user', content: `Datos: ${JSON.stringify(cuerpo.datos ?? {})}\nPregunta: ${String(cuerpo.pregunta || '').slice(0, 400)}` },
    ], 600);
    console.log('preguntar', MODELO, `${Date.now() - t0}ms`, error || 'ok');
    if (error) return json({ error }, 503);
    return json({ respuesta: texto.trim() });
  }

  return json({ error: 'accion-desconocida' }, 400);
});
