import { signIn, signUp, recoverPassword } from '../auth.js';
import { mensajeEnlace } from '../engine/persona.js';
import { icon, logo } from './icons.js';

let mode = 'login'; // login | registro | recuperar

const PUNTOS = `
  <li>${icon('entra')}Lo que entra y lo que sale, con su categoría</li>
  <li>${icon('recurrente')}El saldo se arrastra de un mes al siguiente</li>
  <li>${icon('check')}Los pagos fijos, marcados uno a uno</li>`;

// El marco de las pantallas de acceso: marca a un lado, la tarjeta al otro.
export function marcoAuth(tarjeta) {
  const marca = `<div class="brand">${logo()}<span class="brand-txt">Reparto<small>mensual</small></span></div>`;
  return `
    <div class="auth">
      <section class="auth-brand">
        ${marca}
        <div class="auth-pitch">
          <p class="auth-claim">A dónde se va la plata, mes a mes.</p>
          <ul class="auth-puntos">${PUNTOS}</ul>
        </div>
      </section>
      <main class="auth-main">
        <div class="auth-card">
          <div class="auth-logo">${marca}</div>
          ${tarjeta}
        </div>
      </main>
    </div>`;
}

export function renderLogin(root, onDone, aviso = '', alRecuperar = false) {
  if (alRecuperar) mode = 'recuperar';
  if (mode === 'recuperar') return renderRecuperar(root, onDone, '', aviso);
  const accion = mode === 'login' ? 'Entrar' : 'Crear cuenta';
  root.innerHTML = marcoAuth(`
    <h1 class="auth-title">${mode === 'registro' ? 'Crea tu cuenta' : 'Hola de nuevo'}</h1>
    <p class="sub">Entra con tu correo para ver tus cuentas.</p>
    <div class="auth-tabs" role="group" aria-label="Qué quieres hacer">
      <button data-m="login" aria-pressed="${mode === 'login'}" class="${mode === 'login' ? 'on' : ''}">Entrar</button>
      <button data-m="registro" aria-pressed="${mode === 'registro'}" class="${mode === 'registro' ? 'on' : ''}">Crear cuenta</button>
    </div>
    <form id="authForm">
      <div class="fld"><label for="authEmail">Correo</label><input id="authEmail" type="email" required autocomplete="email" placeholder="tu@correo.com"></div>
      <div class="fld"><label for="authPass">Contraseña</label><input id="authPass" type="password" required autocomplete="${mode === 'registro' ? 'new-password' : 'current-password'}" minlength="6"></div>
      ${mode === 'login' ? '<button type="button" class="auth-olvide" id="authOlvide">¿Olvidaste tu contraseña?</button>' : ''}
      <div id="authErr" class="auth-err" role="alert">${aviso}</div>
      <button type="submit" class="wide btn-primary btn-lg">${accion}</button>
    </form>`);

  root.querySelectorAll('.auth-tabs button').forEach((b) => {
    b.onclick = () => { mode = b.dataset.m; renderLogin(root, onDone); };
  });
  const olvide = root.querySelector('#authOlvide');
  if (olvide) olvide.onclick = () => { mode = 'recuperar'; renderLogin(root, onDone); };

  root.querySelector('#authForm').onsubmit = async (e) => {
    e.preventDefault();
    const email = root.querySelector('#authEmail').value.trim();
    const pass = root.querySelector('#authPass').value;
    const err = root.querySelector('#authErr');
    const enviar = root.querySelector('#authForm [type=submit]');
    err.textContent = '';
    enviar.disabled = true;
    enviar.textContent = 'Un momento…';
    const res = mode === 'login' ? await signIn(email, pass) : await signUp(email, pass);
    enviar.disabled = false;
    enviar.textContent = accion;
    if (res.error) { err.textContent = res.error.message; return; }
    onDone();
  };
}

const ESPERA = 30; // segundos antes de poder pedir otro enlace

// Pedir el enlace. Al enviarlo, la misma tarjeta pasa a "revisa tu correo" con reenvío.
function renderRecuperar(root, onDone, enviadoA = '', aviso = '') {
  const volver = () => { mode = 'login'; renderLogin(root, onDone); };
  if (enviadoA) return renderEnviado(root, enviadoA, volver);
  root.innerHTML = marcoAuth(`
    <button type="button" class="auth-volver" id="authVolver">${icon('izq')}Volver a entrar</button>
    <h1 class="auth-title">Recupera tu contraseña</h1>
    <p class="sub">Escribe tu correo y te mandamos un enlace para elegir una nueva.</p>
    <form id="authForm" class="auth-form-gap">
      <div class="fld"><label for="authEmail">Correo</label><input id="authEmail" type="email" required autocomplete="email" placeholder="tu@correo.com"></div>
      <div id="authErr" class="auth-err" role="alert">${aviso}</div>
      <button type="submit" class="wide btn-primary btn-lg">Enviar enlace</button>
    </form>`);
  root.querySelector('#authVolver').onclick = volver;
  root.querySelector('#authEmail').focus();
  root.querySelector('#authForm').onsubmit = async (e) => {
    e.preventDefault();
    const email = root.querySelector('#authEmail').value.trim();
    const err = root.querySelector('#authErr');
    const enviar = root.querySelector('#authForm [type=submit]');
    err.textContent = '';
    enviar.disabled = true;
    enviar.textContent = 'Enviando…';
    const { error } = await recoverPassword(email).catch((x) => ({ error: x }));
    if (error) {
      enviar.disabled = false;
      enviar.textContent = 'Enviar enlace';
      err.textContent = mensajeEnlace(error);
      return;
    }
    renderRecuperar(root, onDone, email);
  };
}

function renderEnviado(root, email, volver) {
  root.innerHTML = marcoAuth(`
    <div class="auth-sello" aria-hidden="true">${icon('correo')}</div>
    <h1 class="auth-title">Revisa tu correo</h1>
    <p class="sub">Si <b>${email.replace(/[<>&"]/g, '')}</b> tiene cuenta, ahí va el enlace. Vale por una hora; mira también en spam.</p>
    <div id="authErr" class="auth-err ok" role="status"></div>
    <button type="button" class="wide btn-lg" id="authReenviar" disabled></button>
    <button type="button" class="auth-volver auth-volver-fin" id="authVolver">${icon('izq')}Volver a entrar</button>`);
  root.querySelector('#authVolver').onclick = volver;
  const boton = root.querySelector('#authReenviar');
  const err = root.querySelector('#authErr');
  let falta = 0;
  let reloj = 0;
  const pinta = () => {
    boton.disabled = falta > 0;
    boton.textContent = falta > 0 ? `Reenviar en ${falta} s` : 'Reenviar el enlace';
  };
  const esperar = () => {
    clearInterval(reloj);
    falta = ESPERA;
    pinta();
    reloj = setInterval(() => {
      if (!boton.isConnected) { clearInterval(reloj); return; }
      falta -= 1;
      pinta();
      if (falta <= 0) clearInterval(reloj);
    }, 1000);
  };
  esperar();
  boton.onclick = async () => {
    boton.disabled = true;
    boton.textContent = 'Enviando…';
    err.classList.remove('ok');
    const { error } = await recoverPassword(email).catch((x) => ({ error: x }));
    if (error) { err.textContent = mensajeEnlace(error); clearInterval(reloj); falta = 0; pinta(); return; }
    err.classList.add('ok');
    err.textContent = 'Enlace reenviado.';
    esperar();
  };
}
