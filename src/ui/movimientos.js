import * as store from '../store.js';
import { delMes } from '../engine/movimientos.js';
import { nombreDe, colorDe, deTipo } from '../engine/categorias.js';
import { pendientes } from '../engine/recurrentes.js';
import { money, esc, fechaCorta } from '../format.js';
import { selectorMes, enlazarMes, cabeceraMes, mesElegido } from './mes.js';
import { abrirRegistro } from './registrar.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

let filtro = ''; // '' = todo | catId

// '2026-09-08' → 'lunes'
function diaSemana(fecha) {
  const [a, m, d] = String(fecha).split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('es-CO', { weekday: 'long' });
}

export function renderMovimientos(root) {
  const p = store.active();
  const per = mesElegido();
  if (filtro && !p.cats.some((c) => c.id === filtro)) filtro = '';
  const lista = delMes(p.movs, per).filter((m) => !filtro || m.catId === filtro);
  const faltan = pendientes(p.recurrentes, p.movs, per);
  const recs = new Map(p.recurrentes.map((r) => [r.id, r]));

  // agrupados por día, del más reciente al más viejo
  const dias = [];
  lista.forEach((m) => {
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo.fecha === m.fecha) ultimo.movs.push(m); else dias.push({ fecha: m.fecha, movs: [m] });
  });
  const grupo = (tipo) => deTipo(p.cats, tipo)
    .map((c) => `<option value="${c.id}" ${filtro === c.id ? 'selected' : ''}>${esc(c.n)}</option>`).join('');

  const netoDia = (movs) => movs.reduce((t, m) => t + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0);

  root.innerHTML = `
    ${selectorMes('Movimientos')}
    ${cabeceraMes(p, per, { compacta: true })}
    ${faltan.length ? `<div class="callout">
      <span class="callout-ic">${icon('campana')}</span>
      <div class="callout-txt"><b>${faltan.length} recurrente${faltan.length === 1 ? '' : 's'} sin ningún pago este mes</b>
        <span class="sub">${esc(faltan.slice(0, 4).map((r) => r.n).join(', '))}${faltan.length > 4 ? '…' : ''}</span></div>
      <button id="mvRec">Marcarlos</button></div>` : ''}
    <div class="toolbar">
      <select id="mvFiltro" aria-label="Filtrar por categoría">
        <option value="">Todas las categorías</option>
        <optgroup label="Gastos">${grupo('gasto')}</optgroup>
        <optgroup label="Ingresos">${grupo('ingreso')}</optgroup>
      </select>
    </div>
    ${dias.length ? dias.map((d) => {
    const neto = netoDia(d.movs); // solo se muestra si el día tiene más de uno
    return `<section class="dia">
      <h2 class="dia-head"><span class="dia-fecha">${fechaCorta(d.fecha)}</span><span class="dia-semana">${diaSemana(d.fecha)}</span>
        ${d.movs.length > 1 ? `<span class="dia-neto num ${neto < 0 ? 'neg' : 'pos'}">${neto < 0 ? '−' : '+'}${money(Math.abs(neto))}</span>` : ''}</h2>
      <ul class="list">
      ${d.movs.map((m) => {
    const nombre = nombreDe(p.cats, m.catId);
    // un pago por partes dice de qué recurrente es: "Mercado · Éxito"
    const rec = m.recId && recs.get(m.recId);
    const nota = rec && m.nota && m.nota !== rec.n ? `${rec.n} · ${m.nota}` : m.nota;
    return `<li class="row row-link mov ${m.tipo}">
        <button class="row-main" data-edit="${m.id}"><span class="sr-only">Editar </span>
          <span class="av" style="--c:${colorDe(p.cats, m.catId)}" aria-hidden="true">${esc(nombre.trim().charAt(0).toUpperCase())}</span>
          <span class="row-txt">
            <span class="row-t">${esc(nombre)}</span>
            ${nota ? `<span class="row-s">${esc(nota)}</span>` : ''}
          </span>
          <b class="num row-monto">${m.tipo === 'ingreso' ? '+' : '−'}${money(m.monto)}</b>
        </button>
        <button class="btn-icon btn-icon-danger" data-del="${m.id}" aria-label="Borrar ${esc(nombre)} de ${money(m.monto)}">${icon('basura')}</button>
      </li>`;
  }).join('')}
      </ul>
    </section>`;
  }).join('') : `<div class="empty-state">
      <span class="empty-ic">${icon('movimientos')}</span>
      <b>${filtro ? 'Nada en esta categoría este mes' : 'Nada registrado este mes'}</b>
      <span class="sub">${filtro ? 'Prueba con otra o vuelve a ver todas.' : 'Toca el + para anotar lo que entra y lo que sale.'}</span>
    </div>`}`;

  const repintar = () => renderMovimientos(root);
  enlazarMes(root, repintar);
  root.querySelector('#mvFiltro').onchange = (e) => { filtro = e.target.value; repintar(); };
  // marcarlos uno a uno es cosa de su pantalla: aquí solo se avisa
  root.querySelector('#mvRec')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('ir-a-vista', { detail: { route: 'recurrentes' } }));
  });
  root.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => abrirRegistro({ movId: b.dataset.edit, alGuardar: repintar });
  });
  root.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => {
      const i = p.movs.findIndex((m) => m.id === b.dataset.del);
      if (i < 0) return;
      const mov = p.movs[i];
      const deshacer = store.borrarConDeshacer(() => p.movs.splice(i, 1), () => p.movs.splice(i, 0, mov));
      repintar();
      toast(`Borrado: ${money(mov.monto)} en ${nombreDe(p.cats, mov.catId)}.`, () => { deshacer(); repintar(); });
    };
  });
}
