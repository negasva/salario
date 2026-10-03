import { createClient } from '@supabase/supabase-js';
import { enlaceDeCorreo } from './engine/persona.js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

let currentSession = null;
const listeners = [];

// Qué trajo el enlace del correo, leído antes de que el cliente limpie la URL.
export const enlaceInicial = enlaceDeCorreo(window.location.hash, window.location.search);

supabase.auth.onAuthStateChange((event, session) => {
  currentSession = session;
  listeners.forEach((cb) => cb(session, event));
});

export function onAuthChange(cb) {
  listeners.push(cb);
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export async function getSession() {
  if (currentSession) return currentSession;
  const { data } = await supabase.auth.getSession();
  currentSession = data.session;
  return currentSession;
}

export function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
}

export function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function signOut() {
  return supabase.auth.signOut();
}

// El enlace del correo vuelve a la app. VITE_SITE_URL fija el dominio de producción
// (así un correo pedido desde una vista previa de Vercel no apunta a otra dirección);
// Supabase solo respeta esta URL si está en Authentication → URL Configuration → Redirect URLs.
export function urlDeLaApp() {
  return (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/+$/, '');
}

export function recoverPassword(email) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: urlDeLaApp() });
}

// El usuario de la sesión: correo, fecha de alta y si confirmó el correo.
export async function usuario() {
  const sesion = await getSession();
  return sesion?.user || null;
}

export function cambiarClave(clave) {
  return supabase.auth.updateUser({ password: clave });
}

// Cierra la sesión en este y en todos los demás dispositivos.
export function cerrarEnTodos() {
  return supabase.auth.signOut({ scope: 'global' });
}
