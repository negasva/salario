import * as store from '../store.js';
import { saldoActual } from '../engine/movimientos.js';
import { money, moneySigno, plain, esc, digits } from '../format.js';
import { icon } from './icons.js';
import { toast } from './shell.js';
import { titulo } from './piezas.js';
import { confirmarBoton, animarSegmentos, fijarSegmento } from './efectos.js';
import { aCSV } from '../engine/csv.js';
import { calendarioICS } from '../engine/recurrentes.js';
import { abrirImportar } from './importar.js';
import { tema, elegir } from './tema.js';
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

/* Saldo inicial · apariencia · nombre · datos · avisos. La cuenta y la sesión viven en el perfil. */
export function renderAjustes(root) {
  const p = store.active();
  const hoy = saldoActual(p.saldoInicial, p.movs, p.arranques);
  root.innerHTML = `
    <header class="page-head"><div class="ph-txt"><h1 class="mes-titulo">Ajustes</h1></div></header>
    <div class="ajustes">
      <section class="card ajuste">
        <div class="ajuste-txt">
          ${titulo('billetera', 'Saldo inicial')}
          <p class="sub">Con cuánto empezaste. Hoy tienes <b class="num ${hoy < 0 ? 'neg' : 'pos'}">${moneySigno(hoy)}</b>.</p>
        </div>
        <div class="field-row">
          <input id="ajSaldo" class="num" inputmode="numeric" value="${p.saldoInicial < 0 ? '-' : ''}${plain(Math.abs(p.saldoInicial))}" aria-label="Saldo inicial">
          <button class="btn-primary" id="ajSaldoSave">Guardar</button>
        </div>
      </section>
      <section class="card ajuste">
        <div class="ajuste-txt">
          ${titulo('paleta', 'Apariencia')}
          <p class="sub">Claro, oscuro o el del dispositivo.</p>
        </div>
        <div class="chips chips-3" role="group" aria-label="Tema" data-seg="tema">
          ${[['sistema', 'Sistema'], ['claro', 'Claro'], ['oscuro', 'Oscuro']].map(([v, t]) => `<button class="chip ${tema() === v ? 'on' : ''}" data-tema="${v}" aria-pressed="${tema() === v}">${t}</button>`).join('')}
        </div>
      </section>
      <section class="card ajuste">
        <div class="ajuste-txt">
          ${titulo('lapiz', 'Nombre del presupuesto')}
          <p class="sub">Para distinguirlo en tus archivos.</p>
        </div>
        <div class="field-row">
          <input id="ajNombre" value="${esc(p.name)}" aria-label="Nombre del presupuesto" autocomplete="off">
          <button id="ajNombreSave">Guardar</button>
        </div>
      </section>
      <section class="card ajuste">
        <div class="ajuste-txt">
          ${titulo('datos', 'Tus datos')}
          <p class="sub num">${p.movs.length} movimientos · ${p.cats.length} categorías · ${p.recurrentes.length} recurrentes</p>
        </div>
        <div class="field-row">
          <button id="ajCSV">${icon('descargar')}Excel</button>
          <button id="ajExportar">${icon('descargar')}JSON</button>
          <button class="btn-primary" id="ajImportar">${icon('subir')}Importar</button>
        </div>
      </section>
      <section class="card ajuste">
        <div class="ajuste-txt">
          ${titulo('campana', 'Avisos de pagos')}
          <p class="sub">${avisosSoportados()
    ? `Te avisa cuando algo vence hoy o mañana. ${avisosActivos() ? '<b class="pos">Activos.</b>' : ''}`
    : 'Este navegador no muestra avisos.'}</p>
        </div>
        <div class="field-row">
          ${avisosSoportados() ? `<button id="ajAvisos">${icon('campana')}${avisosActivos() ? 'Apagar' : 'Activar'}</button>` : ''}
          <button id="ajCalendario" ${p.recurrentes.some((r) => r.tipo === 'gasto') ? '' : 'disabled'}>${icon('calendario')}Al calendario</button>
        </div>
      </section>
      <a class="card ajuste-perfil" href="#perfil">
        <span class="ajuste-perfil-txt"><b>Tu perfil</b><small>Nombre, contraseña y sesión</small></span>
        <span class="mas-flecha" aria-hidden="true">${icon('der', 'ic-sm')}</span>
      </a>
    </div>`;

  animarSegmentos(root);
  root.querySelector('#ajSaldoSave').onclick = (e) => {
    p.saldoInicial = Math.round(digits(root.querySelector('#ajSaldo').value));
    store.save();
    const boton = e.currentTarget;
    root.querySelector('.ajuste-txt .sub').innerHTML = `Con cuánto empezaste. Hoy tienes <b class="num ${saldoActual(p.saldoInicial, p.movs, p.arranques) < 0 ? 'neg' : 'pos'}">${moneySigno(saldoActual(p.saldoInicial, p.movs, p.arranques))}</b>.`;
    confirmarBoton(boton);
  };
  root.querySelectorAll('[data-tema]').forEach((b) => {
    b.onclick = () => {
      elegir(b.dataset.tema);
      const todos = [...root.querySelectorAll('[data-tema]')];
      todos.forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      fijarSegmento(b.closest('.chips'), todos.indexOf(b));
    };
  });
  root.querySelector('#ajNombreSave').onclick = (e) => {
    const n = root.querySelector('#ajNombre').value.trim();
    if (!n) return;
    p.name = n;
    store.save();
    confirmarBoton(e.currentTarget);
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
}
