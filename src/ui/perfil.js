import * as store from '../store.js';
import { usuario, cambiarClave } from '../auth.js';
import { icon } from './icons.js';
import { titulo, avatar } from './piezas.js';
import { toast, salir } from './shell.js';
import { confirmarBoton, mantenerPresionado, animarSegmentos } from './efectos.js';
import { COLORES_AVATAR, textoSobre, iniciales, nombreVisible, desde, fuerzaClave, problemaClave, mensajeClave } from '../engine/persona.js';
import { esc } from '../format.js';

/* Perfil: quién eres para la app (nombre, color, correo), cómo entras
   (contraseña, dispositivos), qué hay guardado y el botón de borrar todo. */

const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const SYNC = {
  'al-dia': { ic: 'nube', t: 'Todo guardado', d: 'Tus datos están en tu cuenta.' },
  subiendo: { ic: 'nube', t: 'Guardando…', d: 'Subiendo los últimos cambios.' },
  'sin-red': { ic: 'nube-no', t: 'Sin conexión', d: 'Se sube al volver la red.' },
  grande: { ic: 'nube-no', t: 'Demasiado grande para la nube', d: 'Pasa de 5 MB. Descarga una copia en Ajustes y borra movimientos viejos.' },
  error: { ic: 'nube-no', t: 'No se pudo guardar', d: 'Sigue intentando. Tus datos están a salvo en este dispositivo.' },
  local: { ic: 'nube-no', t: 'Solo en este dispositivo', d: 'Entra con tu cuenta para guardar en la nube.' },
};

export async function renderPerfil(root) {
  const user = await usuario();
  const p = store.active();
  const correo = user?.email || store.correo() || '';
  const per = p.persona;
  const alta = desde(user?.created_at);
  const verificado = Boolean(user?.email_confirmed_at);
  const sync = SYNC[store.estadoSync()];
  const dato = (ic, n, rot) => `<div class="pf-dato"><span class="pf-dato-ic" aria-hidden="true">${icon(ic, 'ic-sm')}</span><b class="num">${n}</b><span>${rot}</span></div>`;
  const atajo = (txt, ...teclas) => `<div class="atajo"><span>${txt}</span><span class="teclas">${teclas.map((t) => `<kbd>${t}</kbd>`).join('')}</span></div>`;

  root.innerHTML = `
    <header class="page-head"><div class="ph-txt"><h1 class="mes-titulo">Perfil</h1></div></header>

    <section class="card pf-cab">
      <span id="pfAvatar">${avatar(per, correo, 'xl')}</span>
      <div class="pf-cab-txt">
        <h2 class="pf-nombre" id="pfNombreVista">${esc(nombreVisible(per.nombre, correo) || 'Sin nombre')}</h2>
        <span class="pf-correo">${esc(correo || 'Sin correo')}</span>
        <div class="pf-chips">
          ${correo ? (verificado ? `<span class="pf-chip ok">${icon('escudo', 'ic-sm')}Correo verificado</span>` : `<span class="pf-chip aviso">${icon('alerta', 'ic-sm')}Sin verificar</span>`) : ''}
          ${alta ? `<span class="pf-chip">${icon('calendario', 'ic-sm')}Desde ${alta}</span>` : ''}
        </div>
      </div>
    </section>

    <div class="cols-2">
      <div class="stack">
        <section class="card pf-card">
          <div class="pf-head">${titulo('usuario', 'Tu nombre')}<span class="sub">Así te saludamos en Inicio.</span></div>
          <div class="fld"><label for="pfNombre">Nombre</label>
            <input id="pfNombre" value="${esc(per.nombre)}" maxlength="40" autocomplete="name" placeholder="Cómo te llamas"></div>
          <div class="fld"><span class="fld-l" id="pfColL">Color</span>
            <div class="swatches" role="group" aria-labelledby="pfColL">
              ${COLORES_AVATAR.map((c, i) => `<button type="button" class="swatch" style="--sw:${c}" data-color="${i}" aria-label="Color ${i + 1}" aria-pressed="${i === per.color}"></button>`).join('')}
            </div></div>
          <button class="btn-primary" id="pfGuardar">Guardar</button>
        </section>

        <form class="card pf-card" id="pfClaveForm" novalidate>
          <div class="pf-head">${titulo('candado', 'Contraseña')}<span class="sub">Mínimo 8, con letras y números.</span></div>
          <div class="fld"><label for="pfClave">Nueva</label>
            <div class="clave-in"><input id="pfClave" type="password" autocomplete="new-password" enterkeyhint="next">
              <button type="button" class="clave-ojo" id="pfOjo" aria-label="Mostrar contraseña" aria-pressed="false">${icon('ojo')}</button></div>
            <div class="fuerza" aria-live="polite"><span class="fuerza-barra" id="pfFuerza" data-n="0"><i></i><i></i><i></i><i></i></span><span class="fuerza-txt" id="pfFuerzaTxt"></span></div></div>
          <div class="fld"><label for="pfClave2">Repítela</label>
            <input id="pfClave2" type="password" autocomplete="new-password" enterkeyhint="done"></div>
          <div class="auth-err" id="pfClaveErr" role="alert"></div>
          <button class="btn-primary" id="pfClaveGuardar" type="submit">Cambiar contraseña</button>
        </form>
      </div>

      <div class="stack">
        <section class="card pf-card">
          <div class="pf-head">${titulo('datos', 'Tu cuenta')}</div>
          <div class="pf-datos">
            ${dato('movimientos', p.movs.length, 'movimientos')}
            ${dato('categorias', p.cats.length, 'categorías')}
            ${dato('recurrente', p.recurrentes.length, 'recurrentes')}
            ${dato('meta', p.metas.length, 'metas')}
          </div>
          <div class="pf-sync" data-estado="${store.estadoSync()}">
            <span class="pf-sync-ic" aria-hidden="true">${icon(sync.ic)}</span>
            <div><b>${sync.t}</b><span class="sub">${sync.d}</span></div>
          </div>
        </section>

        <section class="card pf-card">
          <div class="pf-head">${titulo('dispositivos', 'Sesión')}<span class="sub">Sales de aquí o de todos tus dispositivos.</span></div>
          <div class="pf-botones">
            <button id="pfSalir">${icon('salir')}Cerrar sesión</button>
            <button id="pfSalirTodos">${icon('dispositivos')}En todos</button>
          </div>
        </section>

        <section class="card pf-card solo-teclado">
          <div class="pf-head">${titulo('teclado', 'Atajos')}</div>
          ${atajo('Buscar o ir a', MAC ? '⌘' : 'Ctrl', 'K')}
          ${atajo('Cerrar una hoja', 'Esc')}
          ${atajo('Recorrer una gráfica', '←', '→')}
          ${atajo('Guardar un formulario', 'Enter')}
        </section>
      </div>
    </div>

    <section class="card pf-card pf-peligro">
      <div class="pf-head">${titulo('alerta', 'Borrar mis datos')}<span class="sub">Vacía movimientos, recurrentes y metas.</span></div>
      <button class="btn-borrar" id="pfBorrar" aria-describedby="pfBorrarAyuda">${icon('basura')}<span>Mantén presionado para borrar</span></button>
      <span class="sub" id="pfBorrarAyuda">Dos segundos. Soltar antes lo cancela.</span>
    </section>

    <p class="pf-pie">Reparto mensual · v${VERSION}</p>`;

  animarSegmentos(root);
  const $ = (s) => root.querySelector(s);
  let color = per.color;

  /* la cabecera sigue lo que escribes y eliges: se ve cómo quedará antes de guardar */
  const vista = () => {
    const fondo = COLORES_AVATAR[color];
    const av = $('#pfAvatar .avatar');
    av.style.setProperty('--av', fondo);
    av.style.setProperty('--av-t', textoSobre(fondo));
    const nombre = $('#pfNombre').value;
    av.textContent = iniciales(nombre, correo);
    $('#pfNombreVista').textContent = nombreVisible(nombre, correo) || 'Sin nombre';
    root.querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.color) === color)));
  };
  vista();
  $('#pfNombre').oninput = vista;
  root.querySelectorAll('.swatch').forEach((b) => { b.onclick = () => { color = Number(b.dataset.color); vista(); }; });
  $('#pfGuardar').onclick = (e) => {
    store.setPersona({ nombre: $('#pfNombre').value, color });
    confirmarBoton(e.currentTarget);
  };
  $('#pfNombre').onkeydown = (e) => { if (e.key === 'Enter') $('#pfGuardar').click(); };

  /* contraseña */
  const fuerza = () => {
    const f = fuerzaClave($('#pfClave').value);
    $('#pfFuerza').dataset.n = f.nivel;
    $('#pfFuerzaTxt').textContent = f.texto;
  };
  $('#pfClave').oninput = fuerza;
  $('#pfOjo').onclick = (e) => {
    const ver = $('#pfClave').type === 'password';
    ['#pfClave', '#pfClave2'].forEach((s) => { $(s).type = ver ? 'text' : 'password'; });
    e.currentTarget.innerHTML = icon(ver ? 'ojo-no' : 'ojo');
    e.currentTarget.setAttribute('aria-pressed', String(ver));
    e.currentTarget.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
  };
  $('#pfClaveForm').onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#pfClaveErr');
    const nueva = $('#pfClave').value;
    const problema = problemaClave(nueva, $('#pfClave2').value);
    err.classList.remove('ok');
    if (problema) { err.textContent = problema; $('#pfClave').focus(); return; }
    err.textContent = '';
    const boton = $('#pfClaveGuardar');
    boton.disabled = true;
    const { error } = await cambiarClave(nueva).catch((x) => ({ error: x }));
    boton.disabled = false;
    if (error) { err.textContent = mensajeClave(error); return; }
    $('#pfClave').value = '';
    $('#pfClave2').value = '';
    fuerza();
    confirmarBoton(boton, 'Contraseña cambiada');
    toast('Contraseña cambiada.');
  };

  $('#pfSalir').onclick = () => salir();
  $('#pfSalirTodos').onclick = () => salir(true);
  mantenerPresionado($('#pfBorrar'), 2000, () => {
    const antes = store.reiniciar();
    toast('Datos borrados. Empiezas de cero.', () => { store.restaurar(antes); toast('Datos recuperados.'); });
    window.dispatchEvent(new CustomEvent('ir-a-vista', { detail: { route: 'inicio' } }));
  });
}
