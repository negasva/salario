import { esc } from '../format.js';
import { icon } from './icons.js';

/* F6 — el anuncio grande. No es un modal: un modal se cierra por reflejo sin
   leerlo. Ocupa el ancho del contenido, arriba de todo, y empuja el resto
   hacia abajo hasta que el usuario actúa o lo descarta.
   Es el único lugar donde la app levanta la voz. */
export function anuncio({ titulo, cuerpo, acciones = [], urgente = false, clave, onDescartar }) {
  const cont = document.getElementById('content');
  if (!cont) return null;

  const el = document.createElement('div');
  el.className = `anuncio ${urgente ? 'anuncio-urgente' : ''}`;
  if (clave) el.dataset.clave = clave;
  el.innerHTML = `
    <button class="anuncio-x" aria-label="Descartar">${icon('cerrar', 'ic-sm')}</button>
    <h3>${esc(titulo)}</h3>
    ${cuerpo ? `<p>${esc(cuerpo)}</p>` : ''}
    ${acciones.length ? `<div class="anuncio-acts">
      ${acciones.map((a, i) => `<button class="${i === 0 ? 'an-primary' : ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}
    </div>` : ''}`;
  cont.prepend(el);

  const quitar = () => el.remove();
  el.querySelector('.anuncio-x').onclick = () => { quitar(); onDescartar?.(); };
  el.querySelectorAll('.anuncio-acts button').forEach((b) => {
    b.onclick = () => { quitar(); acciones[Number(b.dataset.i)].onClick(); };
  });
  return quitar;
}
