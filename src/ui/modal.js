import { icon } from './icons.js';

/* Un solo modal para toda la app. Se cierra con la X, tocando fuera o con Esc,
   y devuelve el cuerpo vacío para que cada pantalla escriba lo suyo dentro. */
export function abrirModal({ titulo = '', clase = '', alCerrar } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  overlay.innerHTML = `<div class="sheet ${clase}" role="dialog" aria-modal="true">
      <div class="sheet-head"><h3>${titulo}</h3>
        <button class="btn-del modal-x" aria-label="Cerrar">${icon('cerrar')}</button></div>
      <div class="modal-body"></div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  function cerrar() {
    if (!overlay.isConnected) return;
    overlay.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    alCerrar?.();
  }
  function onKey(e) { if (e.key === 'Escape') cerrar(); }

  document.addEventListener('keydown', onKey);
  overlay.querySelector('.modal-x').onclick = cerrar;
  overlay.onclick = (e) => { if (e.target === overlay) cerrar(); };
  return { overlay, cuerpo: overlay.querySelector('.modal-body'), cerrar };
}
