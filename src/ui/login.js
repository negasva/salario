import { signIn, signUp, recoverPassword } from '../auth.js';
import { icon, logo } from './icons.js';

let mode = 'login'; // login | registro | recuperar

export function renderLogin(root, onDone) {
  const accion = mode === 'login' ? 'Entrar' : mode === 'registro' ? 'Crear cuenta' : 'Enviar enlace';
  root.innerHTML = `
    <div class="auth">
      <section class="auth-brand">
        <div class="brand">${logo()}<span class="brand-txt">Reparto<small>mensual</small></span></div>
        <div class="auth-pitch">
          <p class="auth-claim">A dónde se va la plata, mes a mes.</p>
          <ul class="auth-puntos">
            <li>${icon('entra')}Lo que entra y lo que sale, con su categoría</li>
            <li>${icon('recurrente')}El saldo se arrastra de un mes al siguiente</li>
            <li>${icon('check')}Los pagos fijos, marcados uno a uno</li>
          </ul>
        </div>
      </section>
      <main class="auth-main">
        <div class="auth-card">
          <div class="auth-logo brand">${logo()}<span class="brand-txt">Reparto<small>mensual</small></span></div>
          <h1 class="auth-title">${mode === 'recuperar' ? 'Recupera tu clave' : mode === 'registro' ? 'Crea tu cuenta' : 'Hola de nuevo'}</h1>
          <p class="sub">${mode === 'recuperar' ? 'Te mandamos un enlace a tu correo para entrar.' : 'Entra con tu correo para ver tus cuentas.'}</p>
          <div class="auth-tabs" role="group" aria-label="Qué quieres hacer">
            <button data-m="login" aria-pressed="${mode === 'login'}" class="${mode === 'login' ? 'on' : ''}">Entrar</button>
            <button data-m="registro" aria-pressed="${mode === 'registro'}" class="${mode === 'registro' ? 'on' : ''}">Crear cuenta</button>
            <button data-m="recuperar" aria-pressed="${mode === 'recuperar'}" class="${mode === 'recuperar' ? 'on' : ''}">Recuperar</button>
          </div>
          <form id="authForm">
            <div class="fld"><label for="authEmail">Correo</label><input id="authEmail" type="email" required autocomplete="email" placeholder="tu@correo.com"></div>
            ${mode !== 'recuperar' ? `<div class="fld"><label for="authPass">Contraseña</label><input id="authPass" type="password" required autocomplete="${mode === 'registro' ? 'new-password' : 'current-password'}" minlength="6"></div>` : ''}
            <div id="authErr" class="auth-err" role="alert"></div>
            <button type="submit" class="wide btn-primary btn-lg">${accion}</button>
          </form>
        </div>
      </main>
    </div>`;

  root.querySelectorAll('.auth-tabs button').forEach((b) => {
    b.onclick = () => { mode = b.dataset.m; renderLogin(root, onDone); };
  });

  root.querySelector('#authForm').onsubmit = async (e) => {
    e.preventDefault();
    const email = root.querySelector('#authEmail').value.trim();
    const pass = root.querySelector('#authPass')?.value;
    const err = root.querySelector('#authErr');
    const enviar = root.querySelector('#authForm [type=submit]');
    err.textContent = '';
    err.classList.remove('ok');
    enviar.disabled = true;
    enviar.textContent = 'Un momento…';
    let res;
    if (mode === 'login') res = await signIn(email, pass);
    else if (mode === 'registro') res = await signUp(email, pass);
    else res = await recoverPassword(email);
    enviar.disabled = false;
    enviar.textContent = accion;
    if (res.error) { err.textContent = res.error.message; return; }
    if (mode === 'recuperar') { err.classList.add('ok'); err.textContent = 'Revisa tu correo.'; return; }
    onDone();
  };
}
