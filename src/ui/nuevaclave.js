import { cambiarClave } from '../auth.js';
import { fuerzaClave, problemaClave, mensajeClave } from '../engine/persona.js';
import { icon } from './icons.js';
import { marcoAuth } from './login.js';

// Pantalla a la que llega el enlace del correo: elegir la contraseña nueva.
// `listo` entra a la app; `cancelar` cierra esa sesión de recuperación y vuelve al login.
export function renderNuevaClave(root, { listo, cancelar }) {
  root.innerHTML = marcoAuth(`
    <div class="auth-sello" aria-hidden="true">${icon('candado')}</div>
    <h1 class="auth-title">Elige tu nueva contraseña</h1>
    <p class="sub">Mínimo 8, con letras y números.</p>
    <form id="authForm" class="auth-form-gap" novalidate>
      <div class="fld"><label for="ncClave">Nueva</label>
        <div class="clave-in"><input id="ncClave" type="password" autocomplete="new-password" enterkeyhint="next">
          <button type="button" class="clave-ojo" id="ncOjo" aria-label="Mostrar contraseña" aria-pressed="false">${icon('ojo')}</button></div>
        <div class="fuerza" aria-live="polite"><span class="fuerza-barra" id="ncFuerza" data-n="0"><i></i><i></i><i></i><i></i></span><span class="fuerza-txt" id="ncFuerzaTxt"></span></div></div>
      <div class="fld"><label for="ncClave2">Repítela</label>
        <input id="ncClave2" type="password" autocomplete="new-password" enterkeyhint="done"></div>
      <div id="authErr" class="auth-err" role="alert"></div>
      <button type="submit" class="wide btn-primary btn-lg" id="ncGuardar">Guardar y entrar</button>
    </form>
    <button type="button" class="auth-volver auth-volver-fin" id="ncCancelar">${icon('izq')}Cancelar</button>`);

  const $ = (s) => root.querySelector(s);
  $('#ncClave').focus();
  $('#ncClave').oninput = () => {
    const f = fuerzaClave($('#ncClave').value);
    $('#ncFuerza').dataset.n = f.nivel;
    $('#ncFuerzaTxt').textContent = f.texto;
  };
  $('#ncOjo').onclick = (e) => {
    const ver = $('#ncClave').type === 'password';
    ['#ncClave', '#ncClave2'].forEach((s) => { $(s).type = ver ? 'text' : 'password'; });
    e.currentTarget.innerHTML = icon(ver ? 'ojo-no' : 'ojo');
    e.currentTarget.setAttribute('aria-pressed', String(ver));
    e.currentTarget.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
  };
  $('#ncCancelar').onclick = cancelar;
  $('#authForm').onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#authErr');
    const nueva = $('#ncClave').value;
    const problema = problemaClave(nueva, $('#ncClave2').value);
    if (problema) { err.textContent = problema; $('#ncClave').focus(); return; }
    err.textContent = '';
    const boton = $('#ncGuardar');
    boton.disabled = true;
    boton.textContent = 'Guardando…';
    const { error } = await cambiarClave(nueva).catch((x) => ({ error: x }));
    boton.disabled = false;
    boton.textContent = 'Guardar y entrar';
    if (error) { err.textContent = mensajeClave(error, true); return; }
    listo();
  };
}
