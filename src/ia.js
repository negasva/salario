import { supabase } from './auth.js';

/* Cliente de la función de IA. La llave del proveedor vive en Supabase, no
   aquí: una app estática no puede guardar un secreto. Si la función no está
   desplegada, todo devuelve null y la app sigue con el clasificador local. */

let estado = 'sin-probar'; // sin-probar | ok | no-disponible

export function estadoIA() {
  return estado;
}

async function llamar(cuerpo) {
  if (estado === 'no-disponible') return null;
  try {
    const { data, error } = await supabase.functions.invoke('ia', { body: cuerpo });
    if (error || data?.error) {
      estado = 'no-disponible';
      return null;
    }
    estado = 'ok';
    return data;
  } catch {
    estado = 'no-disponible';
    return null;
  }
}

// Devuelve [{ texto, cat, confianza }] o null si la IA no contestó
export async function clasificarConIA(textos) {
  const data = await llamar({ accion: 'clasificar', textos });
  return Array.isArray(data?.resultados) ? data.resultados : null;
}

// Una frase sobre cifras que la app ya calculó. Nunca calcula la IA por su cuenta.
export async function preguntarIA(pregunta, datos) {
  const data = await llamar({ accion: 'preguntar', pregunta, datos });
  return data?.respuesta || null;
}
