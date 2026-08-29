import { mountIconSprite } from './ui/icons.js';
import { renderLogin } from './ui/login.js';
import { renderShell, toast } from './ui/shell.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderCategorias } from './ui/categorias.js';
import { renderMetas, abrirMeta } from './ui/metas.js';
import { renderMovimientos } from './ui/movimientos.js';
import { renderHistorial } from './ui/historial.js';
import { renderAnalisis } from './ui/analisis.js';
import { renderAjustes } from './ui/ajustes.js';
import { pintarAvisos, notificarPendientes } from './ui/avisos.js';
import { abrirOnboarding, esCuentaNueva } from './ui/onboarding.js';
import { getSession, onAuthChange } from './auth.js';
import * as store from './store.js';

mountIconSprite();
store.load();

const app = document.getElementById('app');
let route = 'dashboard';

let routeArgs = {};

const ROUTES = {
  dashboard: renderDashboard,
  categorias: renderCategorias,
  metas: renderMetas,
  movimientos: renderMovimientos,
  analisis: renderAnalisis,
  historial: renderHistorial,
  ajustes: renderAjustes,
};

function paintRoute() {
  const content = renderShell(app, route, (r) => { route = r; routeArgs = {}; paintRoute(); });
  ROUTES[route](content, routeArgs);
  pintarAvisos(route);
}

// Categorías enlaza a una meta: se navega a Metas y allí se abre la hoja
window.addEventListener('ir-a-meta', (e) => {
  abrirMeta(e.detail.goalId);
  route = 'metas';
  routeArgs = {};
  paintRoute();
});

window.addEventListener('ir-a-vista', (e) => {
  route = e.detail.route;
  routeArgs = e.detail.args || {};
  paintRoute();
});

/* Las vistas se repintan solas al guardar sin pasar por paintRoute, y al
   hacerlo se llevan por delante el anuncio. El microtask deja que la vista
   termine de montarse y vuelve a colgarlo. */
store.subscribe(() => queueMicrotask(() => pintarAvisos(route)));

async function boot() {
  const session = await getSession();
  if (!session) {
    renderLogin(app, boot);
    return;
  }
  const res = await store.bootAuth(session.user.id);
  if (res?.migrated) toast('Tu presupuesto local se subió a tu cuenta.');
  await store.autoCerrar();
  paintRoute();

  // cuenta recién creada: nombre, ingreso y a repartir
  if (esCuentaNueva()) {
    abrirOnboarding(() => {
      route = 'categorias';
      routeArgs = {};
      paintRoute();
    });
    return;
  }
  notificarPendientes();
}

onAuthChange((session) => {
  if (!session) {
    store.signOutLocal();
    renderLogin(app, boot);
  }
});

boot();

/* PWA: instalable y con cascarón offline. El service worker no cachea datos,
   solo el armazón; los saldos siempre salen de localStorage o de Supabase. */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* sin offline, la app va igual */ });
  });
}
