import { mountIconSprite } from './ui/icons.js';
import { renderLogin } from './ui/login.js';
import { renderShell, toast } from './ui/shell.js';
import { renderInicio } from './ui/inicio.js';
import { renderMovimientos } from './ui/movimientos.js';
import { renderRecurrentes } from './ui/recurrentes.js';
import { renderCategorias } from './ui/categorias.js';
import { renderAjustes } from './ui/ajustes.js';
import { renderAhorro } from './ui/ahorro.js';
import { renderComparar } from './ui/comparar.js';
import { renderMas } from './ui/mas.js';
import { avisarVencimientos } from './ui/avisos.js';
import { getSession, onAuthChange } from './auth.js';
import * as store from './store.js';

mountIconSprite();
store.load();

const app = document.getElementById('app');

const ROUTES = {
  inicio: renderInicio,
  movimientos: renderMovimientos,
  recurrentes: renderRecurrentes,
  ahorro: renderAhorro,
  comparar: renderComparar,
  categorias: renderCategorias,
  ajustes: renderAjustes,
  mas: renderMas,
};

// La pantalla vive en el # de la dirección: atrás funciona y se puede enlazar.
const deHash = () => (ROUTES[location.hash.slice(1)] ? location.hash.slice(1) : 'inicio');
let route = deHash();
let conSesion = false;

function paintRoute() {
  const content = renderShell(app, route, navegar);
  ROUTES[route](content);
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
  paintRoute();
  if (route !== antes) window.scrollTo(0, 0);
});

// una pantalla pide saltar a otra (el aviso de recurrentes en Movimientos)
window.addEventListener('ir-a-vista', (e) => navegar(e.detail?.route));

async function boot() {
  const session = await getSession();
  if (!session) { conSesion = false; renderLogin(app, boot); return; }
  const res = await store.bootAuth(session.user.id);
  if (res?.migrated) toast('Tus datos locales se subieron a tu cuenta.');
  conSesion = true;
  route = deHash();
  paintRoute();
  avisarVencimientos();
}

// al volver a la app (el teléfono la tenía en segundo plano) se revisa otra vez
document.addEventListener('visibilitychange', () => {
  if (conSesion && document.visibilityState === 'visible') avisarVencimientos();
});

onAuthChange((session) => {
  if (!session) { conSesion = false; store.signOutLocal(); renderLogin(app, boot); }
});

boot();

/* PWA: instalable y con cascarón offline. El service worker no cachea datos,
   solo el armazón; los saldos siempre salen de localStorage o de Supabase. */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* sin offline, la app va igual */ });
  });
}
