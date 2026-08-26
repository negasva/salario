import * as store from '../store.js';
import { plain, digits, esc } from '../format.js';
import { icon } from './icons.js';

/* F12 — los dos datos sin los que la app no dice nada útil: cómo se llama tu
   presupuesto y cuánto entra al mes. Se preguntan de a uno, en una hoja que no
   se puede cerrar sin contestar, y al terminar se cae en Categorías, que es
   donde se reparte. Nada de tour de siete pantallas que todo el mundo salta. */

const MARCA = 'reparto:nuevo';

export function marcarCuentaNueva() {
  try {
    localStorage.setItem(MARCA, '1');
  } catch { /* sin localStorage el onboarding se salta, la app va igual */ }
}

export function esCuentaNueva() {
  try {
    return localStorage.getItem(MARCA) === '1';
  } catch {
    return false;
  }
}

function olvidarMarca() {
  try {
    localStorage.removeItem(MARCA);
  } catch { /* nada que limpiar */ }
}

const PASOS = [
  {
    titulo: '¿Cómo le ponemos a tu presupuesto?',
    ayuda: 'Puedes tener varios: uno personal, uno familiar, uno de prueba. Este es el primero.',
    etiqueta: 'Nombre',
    marcador: 'Mi presupuesto',
    tipo: 'texto',
    boton: 'Siguiente',
  },
  {
    titulo: '¿Cuánto entra al mes?',
    ayuda: 'Lo que te queda después de descuentos. Si cambia mes a mes, pon lo típico: se ajusta cuando registres la nómina real.',
    etiqueta: 'Ingreso mensual',
    marcador: '5.500.000',
    tipo: 'monto',
    boton: 'Empezar a repartir',
  },
];

export function abrirOnboarding(alTerminar) {
  const p = store.active();
  if (!p) return;
  let paso = 0;

  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const pintar = () => {
    const s = PASOS[paso];
    const valor = paso === 0 ? (p.name === 'Mi presupuesto' ? '' : p.name) : '';
    overlay.innerHTML = `
      <div class="sheet ob-sheet">
        <div class="ob-pasos" aria-label="Paso ${paso + 1} de ${PASOS.length}">
          ${PASOS.map((_, i) => `<i class="${i <= paso ? 'on' : ''}"></i>`).join('')}
        </div>
        <div class="sheet-head"><h3>${esc(s.titulo)}</h3></div>
        <p class="sub">${esc(s.ayuda)}</p>
        <div class="fld" style="margin-top:var(--space-4)">
          <label for="obInput">${esc(s.etiqueta)}</label>
          <input id="obInput" value="${esc(valor)}" placeholder="${esc(s.marcador)}"
            ${s.tipo === 'monto' ? 'inputmode="numeric" class="num"' : 'autocomplete="off"'}>
        </div>
        <div id="obErr" class="auth-err"></div>
        <button class="wide btn-primary" id="obNext" style="margin-top:var(--space-4)">
          ${esc(s.boton)} ${icon('flecha-abajo', 'ic-sm')}
        </button>
        ${paso > 0 ? '<button class="wide" id="obBack" style="margin-top:var(--space-2)">Atrás</button>' : ''}
      </div>`;

    const input = overlay.querySelector('#obInput');
    const err = overlay.querySelector('#obErr');

    const seguir = () => {
      if (paso === 0) {
        const nombre = input.value.trim();
        if (!nombre) { err.textContent = 'Ponle un nombre, aunque sea "Mi plata".'; input.focus(); return; }
        store.renameProfile(store.activeId(), nombre);
        paso = 1;
        pintar();
        return;
      }
      const monto = digits(input.value);
      if (monto <= 0) { err.textContent = 'Escribe cuánto entra al mes.'; input.focus(); return; }
      const antes = p.inc;
      p.inc = monto;
      store.reescalarItems(p, antes);
      store.save();
      olvidarMarca();
      overlay.remove();
      document.body.style.overflow = '';
      alTerminar();
    };

    overlay.querySelector('#obNext').onclick = seguir;
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); seguir(); } };
    const atras = overlay.querySelector('#obBack');
    if (atras) atras.onclick = () => { paso = 0; pintar(); };
    input.focus();
  };

  pintar();
}
