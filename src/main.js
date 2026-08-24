import { mountIconSprite } from './ui/icons.js';
import { renderLogin } from './ui/login.js';
import { renderShell, toast } from './ui/shell.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderCategorias } from './ui/categorias.js';
import { renderMetas } from './ui/metas.js';
import { renderMovimientos } from './ui/movimientos.js';
import { renderHistorial } from './ui/historial.js';
import { renderAjustes } from './ui/ajustes.js';
import { getSession, onAuthChange } from './auth.js';
import * as store from './store.js';

mountIconSprite();
store.load();

const app = document.getElementById('app');
let route = 'dashboard';

const ROUTES = {
  dashboard: renderDashboard,
  categorias: renderCategorias,
  metas: renderMetas,
  movimientos: renderMovimientos,
  historial: renderHistorial,
  ajustes: renderAjustes,
};

function paintRoute() {
  const content = renderShell(app, route, (r) => { route = r; paintRoute(); });
  ROUTES[route](content);
}

async function boot() {
  const session = await getSession();
  if (!session) {
    renderLogin(app, boot);
    return;
  }
  const res = await store.bootAuth(session.user.id);
  if (res?.migrated) toast('Tu presupuesto local se subió a tu cuenta.');
  paintRoute();
}

onAuthChange((session) => {
  if (!session) {
    store.signOutLocal();
    renderLogin(app, boot);
  }
});

boot();
