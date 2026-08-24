import { esc } from '../format.js';
import { icon } from './icons.js';

/* Anuncio grande, el de las cosas que no pueden pasar en silencio: tapa la
   vista, no se cierra por fuera y siempre sale por uno de sus dos botones. */
export function anuncio({ titulo, cuerpo, aceptar, secundario }) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  overlay.innerHTML = `
    <div class="sheet anuncio" role="alertdialog" aria-modal="true">
      <div class="anuncio-ic">${icon('check')}</div>
      <h2>${esc(titulo)}</h2>
      <p>${esc(cuerpo)}</p>
      <button class="wide btn-primary" id="anOk">${esc(aceptar.label)}</button>
      ${secundario ? `<button class="wide" id="anAlt" style="margin-top:8px">${esc(secundario.label)}</button>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  function cerrar() {
    overlay.remove();
    document.body.style.overflow = '';
  }
  overlay.querySelector('#anOk').onclick = () => { cerrar(); aceptar.onClick(); };
  overlay.querySelector('#anAlt')?.addEventListener('click', () => { cerrar(); secundario.onClick(); });
  overlay.querySelector('#anOk').focus();
  return cerrar;
}
