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
const MODELO = Deno.env.get('IA_MODELO') || 'deepseek-ai/deepseek-v4-flash-0731';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ORIGEN_PERMITIDO') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROMPT_CLASIFICAR = `Eres un clasificador de gastos personales en Colombia.
Devuelves SOLO un array JSON, sin explicaciones ni markdown.

Categorías válidas: mercado, comida-fuera, vivienda, servicios, transporte, salud,
ocio, suscripciones, educacion, otros.

Reglas que importan:
- Ingredientes o productos de supermercado (pan, lechuga, salsa de tomate, arroz,
  jabón, papel higiénico) son "mercado", aunque sean comida.
- Comida ya preparada, restaurantes, domicilios y cafeterías son "comida-fuera".
  Conoce las marcas colombianas: Dogger, Frisby, El Corral, Crepes & Waffles,
  Juan Valdez, Tostao, Presto, Sierra Nevada, Archies, Andrés Carne de Res, Popsy,
  Mimos, Rappi, DiDi Food. "Comida en Dogger" es comida-fuera, no mercado.
- Un corrientazo, un almuerzo ejecutivo o un menú del día son comida-fuera.
- Recibos de energía, agua, gas, internet y celular (EPM, Enel, Vanti, Claro,
  Movistar, Tigo, ETB, WOM) son "servicios".
- Arriendo, administración y predial son "vivienda".
- Gasolina, peajes, SOAT, tecnomecánica, Uber, DiDi y transporte público son "transporte".

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
    const textos = (cuerpo.textos || []).slice(0, 25).map((t: string) => String(t).slice(0, 120));
    if (!textos.length) return json({ resultados: [] });
    const { texto, error } = await nvidia([
      { role: 'system', content: PROMPT_CLASIFICAR },
      { role: 'user', content: JSON.stringify(textos) },
    ], 1200);
    if (error) return json({ error }, 503);
    const resultados = soloJSON(texto);
    return resultados ? json({ resultados }) : json({ error: 'respuesta-ilegible' }, 502);
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
