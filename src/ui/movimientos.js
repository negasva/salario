import * as store from '../store.js';
import { delMes, buscar } from '../engine/movimientos.js';
import { nombreDe, colorDe, deTipo } from '../engine/categorias.js';
import { pendientes } from '../engine/recurrentes.js';
import { money, esc, fechaCorta } from '../format.js';
import { selectorMes, enlazarMes, cabeceraMes, mesElegido } from './mes.js';
import { abrirRegistro } from './registrar.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

let filtro = ''; // '' = todo | catId
let texto = ''; // lo que se está buscando
let todosLosMeses = false; // buscar en toda la historia y no solo en el mes

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
  const faltan = pendientes(p.recurrentes, p.movs, per);
  const grupo = (tipo) => deTipo(p.cats, tipo)
    .map((c) => `<option value="${c.id}" ${filtro === c.id ? 'selected' : ''}>${esc(c.n)}</option>`).join('');

  root.innerHTML = `
    ${selectorMes('Movimientos')}
    ${cabeceraMes(p, per, { compacta: true })}
    ${faltan.length ? `<div class="callout">
      <span class="callout-ic">${icon('campana')}</span>
      <div class="callout-txt"><b>${faltan.length} recurrente${faltan.length === 1 ? '' : 's'} sin ningún pago este mes</b>
        <span class="sub">${esc(faltan.slice(0, 4).map((r) => r.n).join(', '))}${faltan.length > 4 ? '…' : ''}</span></div>
      <button id="mvRec">Ir a pagarlos</button></div>` : ''}
    <div class="toolbar toolbar-mov">
      <label class="buscador">${icon('buscar', 'ic-sm')}<span class="sr-only">Buscar</span>
        <input type="search" id="mvBuscar" placeholder="Buscar: Éxito, D1, 130.000…" value="${esc(texto)}" autocomplete="off" enterkeyhint="search"></label>
      <select id="mvFiltro" aria-label="Filtrar por categoría">
        <option value="">Todas las categorías</option>
        <optgroup label="Gastos">${grupo('gasto')}</optgroup>
        <optgroup label="Ingresos">${grupo('ingreso')}</optgroup>
      </select>
      <label class="check-chip"><input type="checkbox" id="mvTodos" ${todosLosMeses ? 'checked' : ''}> En todos los meses</label>
    </div>
    <div id="mvLista"></div>`;

  const repintar = () => renderMovimientos(root);
  const lista = root.querySelector('#mvLista');
  const pintarLista = () => pintar(lista, p, per, repintar);
  pintarLista();

  enlazarMes(root, repintar);
  root.querySelector('#mvFiltro').onchange = (e) => { filtro = e.target.value; pintarLista(); };
  root.querySelector('#mvBuscar').oninput = (e) => { texto = e.target.value; pintarLista(); };
  root.querySelector('#mvTodos').onchange = (e) => { todosLosMeses = e.target.checked; pintarLista(); };
  // pagarlos es cosa de su pantalla: aquí solo se avisa
  root.querySelector('#mvRec')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('ir-a-vista', { detail: { route: 'recurrentes' } }));
  });
}

function pintar(root, p, per, repintar) {
  const buscando = texto.trim() !== '';
  const base = buscando
    ? buscar(todosLosMeses ? p.movs : delMes(p.movs, per), texto, { cats: p.cats, recurrentes: p.recurrentes })
    : (todosLosMeses ? [...p.movs].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)) : delMes(p.movs, per));
  const lista = base.filter((m) => !filtro || m.catId === filtro);
  const recs = new Map(p.recurrentes.map((r) => [r.id, r]));
  const hoyAnio = String(new Date().getFullYear());

  // agrupados por día, del más reciente al más viejo
  const dias = [];
  lista.forEach((m) => {
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo.fecha === m.fecha) ultimo.movs.push(m); else dias.push({ fecha: m.fecha, movs: [m] });
  });
  const netoDia = (movs) => movs.reduce((t, m) => t + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0);
  const entra = lista.filter((m) => m.tipo === 'ingreso').reduce((t, m) => t + m.monto, 0);
  const sale = lista.filter((m) => m.tipo === 'gasto').reduce((t, m) => t + m.monto, 0);

  root.innerHTML = `
    ${buscando || filtro || todosLosMeses ? `<p class="resultados sub num" role="status">${lista.length} movimiento${lista.length === 1 ? '' : 's'}${todosLosMeses ? ' en todos los meses' : ''}
      ${sale ? ` · salió <b class="neg">${money(sale)}</b>` : ''}${entra ? ` · entró <b class="pos">${money(entra)}</b>` : ''}</p>` : ''}
    ${dias.length ? dias.map((d) => {
    const neto = netoDia(d.movs); // solo se muestra si el día tiene más de uno
    const anio = d.fecha.slice(0, 4);
    return `<section class="dia">
      <h2 class="dia-head"><span class="dia-fecha">${fechaCorta(d.fecha)}${anio !== hoyAnio ? ` ${anio}` : ''}</span><span class="dia-semana">${diaSemana(d.fecha)}</span>
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
      <span class="empty-ic">${icon(buscando ? 'buscar' : 'movimientos')}</span>
      <b>${buscando ? `Nada con “${esc(texto.trim())}”` : filtro ? 'Nada en esta categoría este mes' : 'Nada registrado este mes'}</b>
      <span class="sub">${buscando ? (todosLosMeses ? 'Prueba con otra palabra o un monto.' : 'Prueba con otra palabra, o busca en todos los meses.')
    : filtro ? 'Prueba con otra o vuelve a ver todas.' : 'Toca el + para anotar lo que entra y lo que sale.'}</span>
    </div>`}`;

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
