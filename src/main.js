import { mountIconSprite } from './ui/icons.js';
import { renderLogin } from './ui/login.js';
import { renderShell, toast } from './ui/shell.js';
import { renderInicio } from './ui/inicio.js';
import { renderMovimientos } from './ui/movimientos.js';
import { renderRecurrentes } from './ui/recurrentes.js';
import { renderCategorias } from './ui/categorias.js';
import { renderAjustes } from './ui/ajustes.js';
import { getSession, onAuthChange } from './auth.js';
import * as store from './store.js';

mountIconSprite();
store.load();

const app = document.getElementById('app');
let route = 'inicio';

const ROUTES = {
  inicio: renderInicio,
  movimientos: renderMovimientos,
  recurrentes: renderRecurrentes,
  categorias: renderCategorias,
  ajustes: renderAjustes,
};

function paintRoute() {
  const content = renderShell(app, route, (r) => { route = r; paintRoute(); });
  ROUTES[route](content);
}

async function boot() {
  const session = await getSession();
  if (!session) { renderLogin(app, boot); return; }
  const res = await store.bootAuth(session.user.id);
  if (res?.migrated) toast('Tus datos locales se subieron a tu cuenta.');
  paintRoute();
}

onAuthChange((session) => {
  if (!session) { store.signOutLocal(); renderLogin(app, boot); }
});

boot();

/* PWA: instalable y con cascarón offline. El service worker no cachea datos,
   solo el armazón; los saldos siempre salen de localStorage o de Supabase. */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* sin offline, la app va igual */ });
  });
}
