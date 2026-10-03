/* Tema: sistema, claro u oscuro. La elección vive en localStorage y se aplica
   antes de pintar (hay un script igual en index.html para que no parpadee). */

const KEY = 'reparto:tema';
export const TEMAS = ['sistema', 'claro', 'oscuro'];

export function tema() {
  try { const t = localStorage.getItem(KEY); return TEMAS.includes(t) ? t : 'sistema'; } catch { return 'sistema'; }
}

export function aplicar(t = tema()) {
  const claro = t === 'claro' || (t === 'sistema' && !matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = claro ? 'light' : 'dark';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', claro ? '#FBF3F6' : '#100B0E');
}

export function elegir(t) {
  try { localStorage.setItem(KEY, t); } catch { /* sin almacenamiento: dura hasta cerrar */ }
  aplicar(t);
}

export const siguiente = () => TEMAS[(TEMAS.indexOf(tema()) + 1) % TEMAS.length];

export function montarTema() {
  aplicar();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (tema() === 'sistema') aplicar(); });
  // en papel siempre claro, y al volver se restaura
  window.addEventListener('beforeprint', () => { document.documentElement.dataset.theme = 'light'; });
  window.addEventListener('afterprint', () => aplicar());
}
