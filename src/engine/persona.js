/* La persona detrás de la cuenta: cómo se llama, qué iniciales lleva su
   avatar y con qué color. Todo puro; el correo y la fecha de alta vienen del
   usuario de Supabase y el nombre y el color viven en el perfil. */

import { nombreMes } from '../format.js';

export const COLORES_AVATAR = ['#FC90B6', '#7C8CFF', '#F5B25A', '#3FC7B0', '#B28CFF', '#FF7A66', '#8CCB6B', '#C9A2B5'];

export function normalizarPersona(x) {
  const color = Number(x?.color);
  return {
    nombre: String(x?.nombre || '').trim().slice(0, 40),
    color: Number.isInteger(color) && color >= 0 && color < COLORES_AVATAR.length ? color : 0,
  };
}

// camila.perez@correo.co → "Camila Perez" cuando todavía no hay nombre
function delCorreo(correo) {
  return String(correo || '').split('@')[0].replace(/[._-]+/g, ' ').trim()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

export function nombreVisible(nombre, correo) {
  return String(nombre || '').trim() || delCorreo(correo);
}

export function iniciales(nombre, correo = '') {
  const partes = nombreVisible(nombre, correo).split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const dos = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : partes[0][0];
  return dos.toUpperCase();
}

// Texto oscuro o blanco, el que más contraste dé sobre el color del avatar.
export function textoSobre(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? '#0A0A0A' : '#FFFFFF';
}

export const saludo = (hora) => (hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches');

// '2026-03-02T10:00:00Z' → 'marzo de 2026'
export function desde(iso) {
  const f = String(iso || '').slice(0, 7);
  return /^\d{4}-\d{2}$/.test(f) ? nombreMes(f) : '';
}

/* Fuerza de una contraseña de 0 a 4: largo y variedad. No promete seguridad,
   solo le dice a quien escribe si va por buen camino. */
export function fuerzaClave(c) {
  const t = String(c || '');
  if (!t) return { nivel: 0, texto: '' };
  let n = 0;
  if (t.length >= 8) n += 1;
  if (t.length >= 12) n += 1;
  if (/[a-z]/.test(t) && /[A-Z]/.test(t)) n += 1;
  if (/\d/.test(t) && /[^\p{L}\d]/u.test(t)) n += 1;
  else if (/\d/.test(t) || /[^\p{L}\d]/u.test(t)) n += 0.5;
  const nivel = Math.max(1, Math.min(4, Math.floor(n)));
  return { nivel, texto: ['', 'Débil', 'Regular', 'Buena', 'Fuerte'][nivel] };
}

// Qué le falta a una contraseña nueva para poder guardarse; '' si está bien.
export function problemaClave(clave, repetida) {
  if (clave.length < 8) return 'Mínimo 8 caracteres.';
  if (!/\d/.test(clave) || !/\p{L}/u.test(clave)) return 'Mezcla letras y números.';
  if (clave !== repetida) return 'Las dos no coinciden.';
  return '';
}

// Los mensajes de Supabase vienen en inglés: se traducen los que una persona puede resolver.
export function mensajeClave(error, porEnlace = false) {
  const m = String(error?.message || '');
  if (/same|different/i.test(m)) return 'Usa una contraseña distinta a la actual.';
  if (/weak|short|least|characters/i.test(m)) return 'Esa contraseña es muy débil.';
  if (/reauth|recent|session|expired|jwt/i.test(m)) return porEnlace ? 'El enlace venció. Pide otro.' : 'Vuelve a entrar y prueba de nuevo.';
  return 'No se pudo cambiar. Intenta de nuevo.';
}

// Lo mismo para el envío del enlace de recuperación.
export function mensajeEnlace(error) {
  const m = String(error?.message || '');
  if (/rate|seconds|too many|limit/i.test(m)) return 'Pediste muchos enlaces. Espera unos minutos.';
  if (/invalid|valid email/i.test(m)) return 'Revisa que el correo esté bien escrito.';
  return 'No pudimos enviarlo. Intenta de nuevo.';
}

// Qué trae el # de la URL al volver de un enlace del correo: 'nueva' (enlace bueno),
// 'vencido' (Supabase lo rechazó) o '' (nada que ver con recuperar).
export function enlaceDeCorreo(hash, search = '') {
  const h = new URLSearchParams(String(hash).replace(/^#/, ''));
  if (h.get('error') || h.get('error_code')) return 'vencido';
  if (h.get('type') === 'recovery') return 'nueva';
  const q = new URLSearchParams(search);
  if (q.get('error') || q.get('error_code')) return 'vencido';
  return '';
}
