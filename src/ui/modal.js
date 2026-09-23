import { icon } from './icons.js';

let abiertos = 0;

/* Un solo modal para toda la app: hoja que sube desde abajo en el teléfono y
   diálogo centrado en escritorio. Se cierra con la X, tocando fuera o con Esc,
   y devuelve el cuerpo vacío para que cada pantalla escriba lo suyo dentro. */
export function abrirModal({ titulo = '', alCerrar } = {}) {
  const origen = document.activeElement;
  const id = `modal-t-${++abiertos}`;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="${id}">
      <div class="sheet-grip" aria-hidden="true"></div>
      <div class="sheet-head"><h2 id="${id}">${titulo}</h2>
        <button class="btn-icon modal-x" aria-label="Cerrar">${icon('cerrar')}</button></div>
      <div class="modal-body"></div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  function cerrar() {
    if (!overlay.isConnected) return;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    alCerrar?.();
    // el foco vuelve a donde estaba, si ese botón sigue en pantalla
    if (origen?.isConnected) origen.focus({ preventScroll: true });
  }
  function onKey(e) {
    if (e.key === 'Escape') { cerrar(); return; }
    // Tab no se escapa del diálogo
    if (e.key !== 'Tab') return;
    const f = [...overlay.querySelectorAll('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])')]
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!f.length) return;
    const primero = f[0]; const ultimo = f[f.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.modal-x').onclick = cerrar;
  overlay.onclick = (e) => { if (e.target === overlay) cerrar(); };
  return { overlay, cuerpo: overlay.querySelector('.modal-body'), cerrar };
}
