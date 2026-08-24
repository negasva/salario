import { mountIconSprite } from './ui/icons.js';
import { renderLogin } from './ui/login.js';
import { renderShell, toast } from './ui/shell.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderCategorias } from './ui/categorias.js';
import { renderMetas, abrirMeta } from './ui/metas.js';
import { renderMovimientos } from './ui/movimientos.js';
import { renderHistorial } from './ui/historial.js';
import { renderAjustes } from './ui/ajustes.js';
import { anuncio } from './ui/anuncio.js';
import { getSession, onAuthChange } from './auth.js';
import { money } from './format.js';
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

// Categorías enlaza a una meta: se navega a Metas y allí se abre la hoja
window.addEventListener('ir-a-meta', (e) => {
  abrirMeta(e.detail.goalId);
  route = 'metas';
  paintRoute();
});

window.addEventListener('ir-a-vista', (e) => { route = e.detail.route; paintRoute(); });

/* F5 — una meta terminó y su plata pasa a la que sigue en la fila. No se hace
   en silencio: se anuncia y espera, y si nadie contesta en 24 horas se aplica
   sola (eso lo resuelve store.revisarFila). */
let anuncioAbierto = false;
function revisarFila() {
  // la bandera se levanta antes de mirar: revisarFila guarda, guardar avisa a
  // los suscriptores, y sin esto el aviso se abriría dos veces
  if (anuncioAbierto) return;
  anuncioAbierto = true;
  const t = store.revisarFila();
  if (!t) { anuncioAbierto = false; return; }
  const p = store.active();
  anuncioAbierto = true;
  anuncio({
    titulo: `Terminaste la meta ${t.desde.n}`,
    cuerpo: `Los ${money(t.monto, p.cur)} al mes pasan ahora a ${t.hacia.n}.`,
    aceptar: {
      label: 'Aceptar',
      onClick: () => {
        anuncioAbierto = false;
        store.aplicarTraspasoPendiente();
        toast(`${money(t.monto, p.cur)} al mes van a ${t.hacia.n}`);
        paintRoute();
      },
    },
    secundario: {
      label: 'Repartirlo a mano',
      onClick: () => {
        anuncioAbierto = false;
        // se libera el bloque sin repartirlo y se abre la meta que sigue
        store.aplicarTraspasoPendiente(true);
        abrirMeta(t.hacia.id);
        route = 'metas';
        paintRoute();
      },
    },
  });
}
store.subscribe(revisarFila);

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
  revisarFila();
}

onAuthChange((session) => {
  if (!session) {
    store.signOutLocal();
    renderLogin(app, boot);
  }
});

boot();
