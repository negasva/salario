import { icon } from './icons.js';

/* Los pocos movimientos con función propia. Cada uno responde a una pregunta:
   ¿se guardó? (confirmarBoton), ¿qué opción está activa? (segmentos),
   ¿esto lo hice a propósito? (mantenerPresionado), ¿cuál es el nuevo? (destacar). */

/* El botón dice "Guardado" un momento y vuelve a lo que era. Cruce con un
   desenfoque corto: sin él se ven los dos textos encimados un instante. */
export function confirmarBoton(btn, texto = 'Guardado') {
  if (btn.dataset.confirmando) return;
  btn.dataset.confirmando = '1';
  const original = btn.innerHTML;
  btn.classList.add('morph');
  btn.innerHTML = `<span class="morph-in">${icon('check', 'ic-sm')}${texto}</span>`;
  setTimeout(() => {
    btn.innerHTML = `<span class="morph-in">${original}</span>`;
    btn.classList.remove('morph');
    delete btn.dataset.confirmando;
  }, 1400);
}

/* Control segmentado con la pastilla que se desliza. `--i` es la posición de
   la opción activa y `--n` cuántas hay; el CSS hace el resto. Si la pantalla se
   dibujó de nuevo, la pastilla arranca donde estaba la vez anterior y viaja. */
const recuerdo = new Map();
export function animarSegmentos(root) {
  root.querySelectorAll('.chips[data-seg]').forEach((el) => {
    const opciones = [...el.querySelectorAll('.chip')];
    const actual = Math.max(0, opciones.findIndex((c) => c.classList.contains('on')));
    const antes = recuerdo.get(el.dataset.seg);
    el.style.setProperty('--n', opciones.length);
    el.style.setProperty('--i', antes ?? actual);
    recuerdo.set(el.dataset.seg, actual);
    if (antes !== undefined && antes !== actual) {
      el.getBoundingClientRect(); // fija el punto de partida antes de moverla
      el.style.setProperty('--i', actual);
    }
  });
}

export function fijarSegmento(el, indice) {
  el.style.setProperty('--n', el.querySelectorAll('.chip').length);
  el.style.setProperty('--i', indice);
  if (el.dataset.seg) recuerdo.set(el.dataset.seg, indice);
}

/* Para lo que no se puede deshacer: el botón se llena mientras se mantiene
   presionado y solo al llegar al final hace la acción. Soltar antes la cancela.
   Funciona con mouse, dedo y teclado (mantener Enter o Espacio). */
export function mantenerPresionado(btn, ms, alConfirmar) {
  btn.classList.add('mantener');
  btn.style.setProperty('--mantener', `${ms}ms`);
  btn.insertAdjacentHTML('afterbegin', '<span class="mantener-relleno" aria-hidden="true"></span>');
  let t = null;
  const empezar = () => {
    if (t) return;
    btn.classList.add('presionando');
    t = setTimeout(() => { t = null; btn.classList.remove('presionando'); alConfirmar(); }, ms);
  };
  const soltar = () => { clearTimeout(t); t = null; btn.classList.remove('presionando'); };
  btn.addEventListener('pointerdown', (e) => { if (e.button === 0 || e.pointerType !== 'mouse') empezar(); });
  ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((ev) => btn.addEventListener(ev, soltar));
  btn.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); empezar(); } });
  btn.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') soltar(); });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// El último movimiento que se guardó, para que su fila destelle al aparecer.
export const destacar = { id: null };
