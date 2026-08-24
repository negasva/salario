import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

let currentSession = null;
const listeners = [];

supabase.auth.onAuthStateChange((_event, session) => {
  currentSession = session;
  listeners.forEach((cb) => cb(session));
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

export function recoverPassword(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
}
