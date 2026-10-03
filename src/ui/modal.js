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
  /* El teclado del teléfono tapa lo que está pegado abajo de la pantalla. La
     hoja sube lo que mida el teclado (la diferencia entre la ventana y lo que
     realmente se ve) para que el botón de guardar quede a la vista. */
  const vv = window.visualViewport;
  const subirConTeclado = () => overlay.style.setProperty('--teclado', `${Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop))}px`);
  if (vv) { vv.addEventListener('resize', subirConTeclado); vv.addEventListener('scroll', subirConTeclado); subirConTeclado(); }
  /* Sale por donde entró: la hoja baja y el fondo se funde. El estado cambia
     ya (foco, scroll, Esc); lo único que espera es quitar el nodo, con un
     tiempo fijo y no con animationend, que en segundo plano no siempre llega. */
  function cerrar() {
    if (!overlay.isConnected || overlay.classList.contains('saliendo')) return;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (vv) { vv.removeEventListener('resize', subirConTeclado); vv.removeEventListener('scroll', subirConTeclado); }
    overlay.classList.add('saliendo');
    setTimeout(() => overlay.remove(), 200);
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
  /* En el teléfono la hoja se arrastra hacia abajo desde el asa o el título
     para cerrarla, como una nativa: sigue al dedo, y si se suelta pasados 100px
     o con empuje se va; si no, vuelve. En escritorio es un diálogo y no se arrastra. */
  const hoja = overlay.querySelector('.sheet');
  const asa = overlay.querySelectorAll('.sheet-grip, .sheet-head');
  let y0 = null; let dy = 0; let t0 = 0;
  const soltar = () => {
    if (y0 === null) return;
    const empuje = dy / Math.max(1, performance.now() - t0);
    y0 = null;
    hoja.style.transition = '';
    if (dy > 100 || empuje > 0.6) cerrar(); else hoja.style.transform = '';
  };
  asa.forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || matchMedia('(min-width:640px)').matches || e.target.closest('button')) return;
      y0 = e.clientY; dy = 0; t0 = performance.now();
      hoja.style.transition = 'none';
      try { el.setPointerCapture(e.pointerId); } catch { /* sin puntero activo: se sigue igual */ }
    });
    el.addEventListener('pointermove', (e) => {
      if (y0 === null) return;
      dy = Math.max(0, e.clientY - y0);
      hoja.style.transform = `translateY(${dy}px)`;
    });
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
  });
  overlay.querySelector('.modal-x').onclick = cerrar;
  overlay.onclick = (e) => { if (e.target === overlay) cerrar(); };
  return { overlay, cuerpo: overlay.querySelector('.modal-body'), cerrar };
}
