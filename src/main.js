import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import { mountIconSprite } from './ui/icons.js';
import { renderLogin } from './ui/login.js';
import { renderNuevaClave } from './ui/nuevaclave.js';
import { renderShell, toast } from './ui/shell.js';
import { renderInicio } from './ui/inicio.js';
import { renderMovimientos } from './ui/movimientos.js';
import { renderRecurrentes } from './ui/recurrentes.js';
import { renderCategorias } from './ui/categorias.js';
import { renderAjustes } from './ui/ajustes.js';
import { renderAhorro } from './ui/ahorro.js';
import { renderReportes } from './ui/reportes.js';
import { renderPerfil } from './ui/perfil.js';
import { renderMas } from './ui/mas.js';
import { avisarVencimientos } from './ui/avisos.js';
import { getSession, onAuthChange, enlaceInicial, signOut, sinConfiguracion, sesionGuardada } from './auth.js';
import * as store from './store.js';
import { montarTema } from './ui/tema.js';
import { montarPaleta } from './ui/paleta.js';
import { salir } from './ui/shell.js';

mountIconSprite();
montarTema();
store.load();

const app = document.getElementById('app');

const ROUTES = {
  inicio: renderInicio,
  movimientos: renderMovimientos,
  recurrentes: renderRecurrentes,
  ahorro: renderAhorro,
  reportes: renderReportes,
  perfil: renderPerfil,
  categorias: renderCategorias,
  ajustes: renderAjustes,
  mas: renderMas,
};

// La pantalla vive en el # de la dirección: atrás funciona y se puede enlazar.
// pantallas que ya no existen y a dónde llevan los enlaces y accesos directos viejos
const RUTAS_VIEJAS = { comparar: 'reportes' };
const deHash = () => {
  const h = location.hash.slice(1);
  const ruta = RUTAS_VIEJAS[h] || h;
  return ROUTES[ruta] ? ruta : 'inicio';
};
let route = deHash();
let conSesion = false;

const TITULOS = { inicio: 'Inicio', movimientos: 'Movimientos', recurrentes: 'Recurrentes', ahorro: 'Ahorro',
  reportes: 'Reportes', perfil: 'Perfil', categorias: 'Categorías', ajustes: 'Ajustes', mas: 'Más' };

function paintRoute({ entrada = false } = {}) {
  const content = renderShell(app, route, navegar);
  ROUTES[route](content);
  document.title = `${TITULOS[route]} · Reparto mensual`;
  if (!entrada) return;
  content.classList.add('entrada');
  // solo la primera pintada: repintar dentro de la pantalla no vuelve a entrar
  setTimeout(() => content.classList.remove('entrada'), 700);
}

function navegar(r) {
  if (!ROUTES[r]) return;
  if (location.hash.slice(1) === r) { route = r; paintRoute(); return; }
  location.hash = r; // hashchange pinta
}

window.addEventListener('hashchange', () => {
  // un # que no es pantalla (el enlace de recuperar clave) no mueve nada
  if (!conSesion || !ROUTES[location.hash.slice(1)]) return;
  const antes = route;
  route = deHash();
  // al perfil se llega pocas veces al día y desde un toque: entra en cascada, como al abrir la app
  paintRoute({ entrada: route === 'perfil' && antes !== 'perfil' });
  if (route !== antes) window.scrollTo(0, 0);
});

// una pantalla pide saltar a otra (el aviso de recurrentes en Movimientos)
window.addEventListener('ir-a-vista', (e) => navegar(e.detail?.route));
montarPaleta({ activa: () => conSesion, salir });

// El enlace del correo no es una pantalla: se limpia la URL y se pide la contraseña nueva.
let recuperando = enlaceInicial === 'nueva';
let vencido = enlaceInicial === 'vencido';
const limpiarUrl = () => history.replaceState(null, '', location.pathname);

function pedirNuevaClave() {
  recuperando = true;
  conSesion = false;
  limpiarUrl();
  renderNuevaClave(app, {
    listo: async () => { recuperando = false; await boot(); toast('Contraseña cambiada.'); },
    cancelar: async () => { recuperando = false; await signOut(); },
  });
}

/* Con datos de esta cuenta en el dispositivo se pinta de una vez y la nube se
   consulta por detrás: sin conexión, esperarla dejaba la pantalla en blanco
   (con el token vencido, más de ocho segundos). Lo que traiga se junta con lo
   que se haya hecho mientras tanto (store.bootAuth) y se repinta solo si cambió. */
function arrancarConLoGuardado(user) {
  store.setCorreo(user.email);
  conSesion = true;
  route = deHash();
  paintRoute({ entrada: true });
  avisarVencimientos();
  const antes = JSON.stringify(store.active());
  store.bootAuth(user.id).then((res) => {
    if (res?.migrated) toast('Tus datos locales se subieron a tu cuenta.');
    repintarSiCambio(antes);
  }).catch(() => { /* sin red: se queda con lo guardado */ });
  getSession().catch(() => { /* idem: si la sesión ya no sirve, onAuthChange manda al ingreso */ });
}

/* Repinta con lo que trajo la nube, pero sin quitarle la pantalla a quien ya
   la está usando: con una hoja abierta o un campo con el cursor, espera. */
const ocupado = () => Boolean(document.querySelector('.overlay')) || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
function repintarSiCambio(antes, intentos = 0) {
  if (!conSesion || JSON.stringify(store.active()) === antes) return;
  if (ocupado() && intentos < 40) { setTimeout(() => repintarSiCambio(antes, intentos + 1), 1500); return; }
  paintRoute();
}

async function boot() {
  if (vencido) {
    vencido = false;
    limpiarUrl();
    renderLogin(app, boot, 'El enlace venció. Pide otro.', true);
    return;
  }
  const guardada = recuperando ? null : sesionGuardada()?.user;
  if (guardada && store.esDe(guardada.id)) { arrancarConLoGuardado(guardada); return; }
  const session = await getSession();
  if (session && recuperando) { pedirNuevaClave(); return; }
  if (!session) { conSesion = false; renderLogin(app, boot); return; }
  store.setCorreo(session.user.email);
  const res = await store.bootAuth(session.user.id);
  if (res?.migrated) toast('Tus datos locales se subieron a tu cuenta.');
  conSesion = true;
  route = deHash();
  paintRoute({ entrada: true });
  avisarVencimientos();
}

// al volver a la app (el teléfono la tenía en segundo plano) se revisa otra vez
document.addEventListener('visibilitychange', () => {
  if (conSesion && document.visibilityState === 'visible') avisarVencimientos();
});

onAuthChange((session, evento) => {
  if (evento === 'PASSWORD_RECOVERY') { pedirNuevaClave(); return; }
  if (!session && recuperando) return;
  if (!session && evento === 'SIGNED_OUT') { conSesion = false; store.signOutLocal(); renderLogin(app, boot); }
});

if (sinConfiguracion) {
  app.innerHTML = `<main class="content"><div class="content-in"><div class="empty-state">
    <b>Falta configurar Supabase</b>
    <span class="sub">Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver el README) y vuelve a desplegar.</span>
  </div></div></main>`;
} else {
  boot();
}

/* PWA: instalable y con cascarón offline. El service worker no cachea datos,
   solo el armazón; los saldos siempre salen de localStorage o de Supabase. */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* sin offline, la app va igual */ });
  });
}
