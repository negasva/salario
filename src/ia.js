import { supabase } from './auth.js';
import { normalizarCat, normalizar } from './engine/clasificar.js';

/* Cliente de la función de IA.

   Se llama con fetch y no con supabase.functions.invoke por una razón: invoke
   no deja poner tiempo límite, y una petición que nunca vuelve deja la tarjeta
   en "Pensando…" para siempre. Aquí, a los 30 segundos se corta y se dice por
   qué. La llave del proveedor vive en el servidor; esto solo manda el token de
   la sesión. */

const URL_FUNCION = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ia`;
const LIMITE_MS = 30000;

export const MOTIVOS = {
  'sin-sesion': 'Entra a tu cuenta para usar la IA.',
  'sin-llave': 'Falta la llave del proveedor: supabase secrets set NVIDIA_API_KEY=…',
  'sin-funcion': 'La función de IA no está desplegada: supabase functions deploy ia',
  tardo: 'El proveedor tardó demasiado. Vuelve a intentar.',
  'respuesta-ilegible': 'El modelo contestó algo que no pude leer.',
  red: 'No pude hablar con el servidor de la IA.',
};

export function explicar(error) {
  if (!error) return '';
  if (String(error).startsWith('proveedor-')) {
    const codigo = String(error).slice(10);
    if (codigo === '401' || codigo === '403') return 'La llave del proveedor no sirve o expiró.';
    if (codigo === '404') return 'El modelo de NVIDIA no existe o no está habilitado. Configura IA_MODELO=meta/llama-3.1-8b-instruct y vuelve a desplegar la función.';
    if (codigo === '429') return 'Te pasaste de la cuota del proveedor por ahora.';
    return `El proveedor respondió ${codigo}.`;
  }
  return MOTIVOS[error] || `Error: ${error}`;
}

// Devuelve { datos } o { error }. Nunca lanza y nunca se queda colgado.
async function llamar(cuerpo) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'sin-sesion' };

  try {
    const r = await fetch(URL_FUNCION, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(LIMITE_MS),
    });
    if (r.status === 404) return { error: 'sin-funcion' };
    const datos = await r.json().catch(() => ({}));
    if (!r.ok || datos.error) return { error: datos.error || `http-${r.status}` };
    return { datos };
  } catch (e) {
    return { error: e.name === 'TimeoutError' || e.name === 'AbortError' ? 'tardo' : 'red' };
  }
}

/* [{ texto, cat, confianza }] alineado con `textos`, o null. Clasificar es de
   fondo y no molesta al usuario, así que lo que no se entienda se descarta en
   silencio: una categoría inventada es peor que ninguna.

   El modelo contesta en orden, pero no siempre: si devuelve la misma cantidad
   de elementos se toma por posición, y si no, se busca cada texto por nombre.
   La función desplegada puede ser vieja y contestar 'comida-fuera'; por eso
   todo pasa por `normalizarCat()` antes de tocar un movimiento. */
export async function clasificarConIA(textos) {
  const lote = (textos || []).map((t) => String(t || ''));
  if (!lote.length) return [];
  const { datos } = await llamar({ accion: 'clasificar', textos: lote });
  const crudos = Array.isArray(datos?.resultados) ? datos.resultados : null;
  if (!crudos) return null;

  const porPosicion = crudos.length === lote.length;
  const porTexto = new Map(crudos.map((r) => [normalizar(r?.texto).trim(), r]));
  return lote.map((texto, i) => {
    const r = porPosicion ? crudos[i] : porTexto.get(normalizar(texto).trim());
    const cat = normalizarCat(r?.cat);
    if (!cat) return null;
    const conf = Number(r?.confianza);
    return { texto, cat, confianza: Number.isFinite(conf) ? conf : 0.5 };
  });
}

// { respuesta } o { error }: aquí el usuario está esperando y merece saber qué pasó
export async function preguntarIA(pregunta, datosContexto) {
  const { datos, error } = await llamar({ accion: 'preguntar', pregunta, datos: datosContexto });
  return error ? { error } : { respuesta: datos?.respuesta || '' };
}
