import { signIn, signUp, recoverPassword } from '../auth.js';
import { marcarCuentaNueva } from './onboarding.js';

let mode = 'login'; // login | registro | recuperar

export function renderLogin(root, onDone) {
  root.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card card">
        <h1 class="auth-title">Reparto mensual</h1>
        <p class="sub">Entra con tu correo para ver tu presupuesto.</p>
        <div class="auth-tabs">
          <button data-m="login" class="${mode === 'login' ? 'on' : ''}">Entrar</button>
          <button data-m="registro" class="${mode === 'registro' ? 'on' : ''}">Crear cuenta</button>
          <button data-m="recuperar" class="${mode === 'recuperar' ? 'on' : ''}">Recuperar</button>
        </div>
        <form id="authForm">
          <div class="fld"><label>Correo</label><input id="authEmail" type="email" required autocomplete="email"></div>
          ${mode !== 'recuperar' ? '<div class="fld"><label>Contraseña</label><input id="authPass" type="password" required autocomplete="current-password" minlength="6"></div>' : ''}
          <div id="authErr" class="auth-err"></div>
          <button type="submit" class="wide btn-primary">${mode === 'login' ? 'Entrar' : mode === 'registro' ? 'Crear cuenta' : 'Enviar enlace'}</button>
        </form>
      </div>
    </div>`;

  root.querySelectorAll('.auth-tabs button').forEach((b) => {
    b.onclick = () => { mode = b.dataset.m; renderLogin(root, onDone); };
  });

  const form = root.querySelector('#authForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = root.querySelector('#authEmail').value.trim();
    const pass = root.querySelector('#authPass')?.value;
    const err = root.querySelector('#authErr');
    err.textContent = '';
    let res;
    if (mode === 'login') res = await signIn(email, pass);
    else if (mode === 'registro') res = await signUp(email, pass);
    else res = await recoverPassword(email);
    if (res.error) { err.textContent = res.error.message; return; }
    if (mode === 'recuperar') { err.style.color = 'var(--success-texto)'; err.textContent = 'Revisa tu correo.'; return; }
    // la marca vive en localStorage y no en la sesión: si el correo pide
    // confirmación, la cuenta entra más tarde y el paso a paso la espera
    if (mode === 'registro') marcarCuentaNueva();
    onDone();
  };
}
