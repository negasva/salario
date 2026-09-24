import * as store from '../store.js';
import { saldoActual } from '../engine/movimientos.js';
import { money, moneySigno, plain, esc, digits } from '../format.js';
import { icon } from './icons.js';
import { toast, salir } from './shell.js';
import { aCSV } from '../engine/csv.js';
import { calendarioICS } from '../engine/recurrentes.js';
import { abrirImportar } from './importar.js';
import { avisosSoportados, avisosActivos, activarAvisos, desactivarAvisos } from './avisos.js';

function descargar(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const hoyArchivo = () => new Date().toISOString().slice(0, 10);

/* Saldo inicial · nombre · datos (exportar e importar) · avisos · salir. */
export function renderAjustes(root) {
  const p = store.active();
  const hoy = saldoActual(p.saldoInicial, p.movs, p.arranques);
  root.innerHTML = `
    <header class="page-head"><div class="ph-txt"><span class="eyebrow">Tu cuenta</span><h1 class="mes-titulo">Ajustes</h1></div></header>
    <div class="ajustes">
      <section class="card ajuste">
        <div class="ajuste-txt">
          <h2 class="card-title">Saldo inicial</h2>
          <p class="sub">Con cuánta plata empezaste antes del primer movimiento registrado. Puede ser negativo. Hoy tienes <b class="num ${hoy < 0 ? 'neg' : 'pos'}">${moneySigno(hoy)}</b>.</p>
        </div>
        <div class="field-row">
          <input id="ajSaldo" class="num" inputmode="numeric" value="${p.saldoInicial < 0 ? '-' : ''}${plain(Math.abs(p.saldoInicial))}" aria-label="Saldo inicial">
          <button class="btn-primary" id="ajSaldoSave">Guardar</button>
        </div>
      </section>
      <section class="card ajuste">
        <div class="ajuste-txt">
          <h2 class="card-title">Nombre</h2>
          <p class="sub">Cómo se llama este presupuesto.</p>
        </div>
        <div class="field-row">
          <input id="ajNombre" value="${esc(p.name)}" aria-label="Nombre del presupuesto" autocomplete="off">
          <button id="ajNombreSave">Guardar</button>
        </div>
      </section>
      <section class="card ajuste">
        <div class="ajuste-txt">
          <h2 class="card-title">Tus datos</h2>
          <p class="sub">${p.movs.length} movimientos, ${p.cats.length} categorías y ${p.recurrentes.length} recurrentes. Para Excel, el CSV trae tus movimientos; el JSON trae todo lo que la app sabe de ti. Del banco puedes traer el extracto en CSV y revisarlo antes de que entre.</p>
        </div>
        <div class="field-row">
          <button id="ajCSV">${icon('descargar')}Excel (CSV)</button>
          <button id="ajExportar">${icon('descargar')}JSON</button>
          <button class="btn-primary" id="ajImportar">${icon('subir')}Importar extracto</button>
        </div>
      </section>
      <section class="card ajuste">
        <div class="ajuste-txt">
          <h2 class="card-title">Avisos de pagos</h2>
          <p class="sub">${avisosSoportados()
    ? `Un aviso en este dispositivo cuando un recurrente vence hoy o mañana, al abrir la app. ${avisosActivos() ? '<b class="pos">Activos.</b>' : ''}`
    : 'Este navegador no deja mostrar avisos.'} Para que te avise aunque no abras la app, agrega tus pagos al calendario del teléfono: te recuerda la víspera.</p>
        </div>
        <div class="field-row">
          ${avisosSoportados() ? `<button id="ajAvisos">${icon('campana')}${avisosActivos() ? 'Apagar avisos' : 'Activar avisos'}</button>` : ''}
          <button id="ajCalendario" ${p.recurrentes.some((r) => r.tipo === 'gasto') ? '' : 'disabled'}>${icon('calendario')}Al calendario</button>
        </div>
      </section>
      <section class="card ajuste">
        <div class="ajuste-txt">
          <h2 class="card-title">Sesión</h2>
          <p class="sub">Tus datos quedan guardados en tu cuenta.</p>
        </div>
        <div class="field-row"><button class="btn-borrar" id="ajSalir">${icon('salir')}Cerrar sesión</button></div>
      </section>
    </div>`;

  root.querySelector('#ajSaldoSave').onclick = () => {
    p.saldoInicial = Math.round(digits(root.querySelector('#ajSaldo').value));
    store.save();
    renderAjustes(root);
    toast(`Saldo inicial: ${money(p.saldoInicial)}.`);
  };
  root.querySelector('#ajNombreSave').onclick = () => {
    const n = root.querySelector('#ajNombre').value.trim();
    if (!n) return;
    p.name = n;
    store.save();
    toast('Nombre guardado.');
  };
  root.querySelector('#ajExportar').onclick = () => descargar(`reparto-${hoyArchivo()}.json`, store.exportarJSON(), 'application/json');
  // con BOM, para que Excel lea las tildes
  root.querySelector('#ajCSV').onclick = () => descargar(`movimientos-${hoyArchivo()}.csv`,
    `\uFEFF${aCSV(p.movs, p.cats, p.recurrentes)}`, 'text/csv;charset=utf-8');
  root.querySelector('#ajImportar').onclick = () => abrirImportar(() => renderAjustes(root));
  root.querySelector('#ajCalendario').onclick = () => {
    descargar('pagos-del-mes.ics', calendarioICS(p.recurrentes), 'text/calendar;charset=utf-8');
    toast('Abre el archivo para agregar tus pagos al calendario.');
  };
  root.querySelector('#ajAvisos')?.addEventListener('click', async () => {
    if (avisosActivos()) { desactivarAvisos(); toast('Avisos apagados en este dispositivo.'); } else {
      const ok = await activarAvisos();
      toast(ok ? 'Listo: te avisará cuando algo venza hoy o mañana.' : 'El navegador no dio permiso para avisos.');
    }
    renderAjustes(root);
  });
  root.querySelector('#ajSalir').onclick = salir;
}
