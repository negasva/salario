import * as store from '../store.js';
import { gastoPorCategoria, enPeriodo } from '../engine/movimientos.js';
import { agregar, borrar, deTipo, esFija } from '../engine/categorias.js';
import { money, plain, esc, digits } from '../format.js';
import { selectorMes, enlazarMes, mesElegido } from './mes.js';
import { abrirModal } from './modal.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

/* Una categoría es un nombre y, en gastos, un presupuesto mensual opcional.
   La barra muestra lo gastado en el mes elegido contra ese presupuesto. */

function editor(cat, tipoNuevo, alGuardar) {
  const p = store.active();
  const tipo = cat ? cat.tipo : tipoNuevo;
  const fija = cat && esFija(cat.id);
  const { cuerpo, cerrar } = abrirModal({
    titulo: cat ? 'Editar categoría' : `Nueva categoría de ${tipo === 'ingreso' ? 'ingreso' : 'gasto'}`,
  });
  cuerpo.innerHTML = `
    <div class="fld"><label for="catNombre">Nombre</label>
      <input id="catNombre" value="${esc(cat?.n || '')}" ${fija ? 'disabled' : ''} autocomplete="off"></div>
    ${tipo === 'gasto' ? `<div class="fld"><label for="catPres">Presupuesto mensual <span class="opcional">(opcional)</span></label>
      <input id="catPres" class="num" inputmode="numeric" placeholder="0" value="${cat?.m ? plain(cat.m) : ''}"></div>` : ''}
    <div id="catErr" class="auth-err"></div>
    <button class="wide btn-primary" id="catSave">Guardar</button>`;
  const guardar = () => {
    const n = cuerpo.querySelector('#catNombre').value.trim();
    const m = Math.max(0, Math.round(digits(cuerpo.querySelector('#catPres')?.value || 0)));
    if (!n && !fija) { cuerpo.querySelector('#catErr').textContent = 'Escribe el nombre.'; return; }
    if (cat) { if (!fija) cat.n = n; cat.m = m; } else agregar(p.cats, n, m, tipo);
    store.save();
    cerrar();
    alGuardar();
  };
  cuerpo.querySelector('#catSave').onclick = guardar;
  cuerpo.onkeydown = (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardar(); } };
  cuerpo.querySelector(fija ? '#catPres' : '#catNombre')?.focus();
}

export function renderCategorias(root) {
  const p = store.active();
  const per = mesElegido();
  const gasto = gastoPorCategoria(p.movs, per);
  const ingreso = enPeriodo(p.movs, per).reduce((acc, m) => {
    if (m.tipo === 'ingreso') acc[m.catId] = (acc[m.catId] || 0) + m.monto;
    return acc;
  }, {});

  const fila = (c) => {
    const total = (c.tipo === 'ingreso' ? ingreso : gasto)[c.id] || 0;
    const pct = c.m > 0 ? Math.min(100, Math.round((total / c.m) * 100)) : 0;
    const pasado = c.m > 0 && total > c.m;
    return `<li class="row row-link cat ${pasado ? 'over' : ''}">
      <button class="row-main" data-id="${c.id}"><span class="sr-only">Editar </span>
        <span class="av" style="--c:${c.c}" aria-hidden="true">${esc(c.n.trim().charAt(0).toUpperCase())}</span>
        <span class="row-txt">
          <span class="row-top">
            <span class="row-t">${esc(c.n)}</span>
            <span class="num row-monto">${money(total)}</span>
          </span>
          ${c.m > 0 ? `<span class="barra ${pasado ? 'barra-over' : ''}"><i style="width:${pct}%;background:${pasado ? 'var(--neg-fill)' : c.c}"></i></span>
          <span class="row-s num">${pasado
    ? `<span class="neg">${icon('alerta', 'ic-sm')}Te pasaste ${money(total - c.m)}</span><span class="trozo">de ${money(c.m)}</span>`
    : `<span class="trozo">Quedan ${money(c.m - total)}</span><span class="trozo">de ${money(c.m)}</span>`}</span>`
    : `<span class="row-s">${c.tipo === 'gasto' ? 'Sin presupuesto' : 'Este mes'}</span>`}
        </span>
      </button>
      ${esFija(c.id) ? '<span class="row-acc-vacio"></span>' : `<button class="btn-icon btn-icon-danger" data-del="${c.id}" aria-label="Borrar ${esc(c.n)}">${icon('basura')}</button>`}
    </li>`;
  };

  root.innerHTML = `
    ${selectorMes('Categorías')}
    <p class="sub intro">Toca una para editarla. Borrar una pasa sus movimientos a Otros.</p>
    <section class="seccion">
      <div class="seccion-head"><h2 class="seccion-t">Gastos</h2><button class="mini" data-nueva="gasto">${icon('mas', 'ic-sm')}Nueva</button></div>
      <ul class="list">${deTipo(p.cats, 'gasto').map(fila).join('')}</ul>
    </section>
    <section class="seccion">
      <div class="seccion-head"><h2 class="seccion-t">Ingresos</h2><button class="mini" data-nueva="ingreso">${icon('mas', 'ic-sm')}Nueva</button></div>
      <ul class="list">${deTipo(p.cats, 'ingreso').map(fila).join('')}</ul>
    </section>`;

  const repintar = () => renderCategorias(root);
  enlazarMes(root, repintar);
  root.querySelectorAll('[data-nueva]').forEach((b) => {
    b.onclick = () => editor(null, b.dataset.nueva, repintar);
  });
  root.querySelectorAll('.row-main').forEach((b) => {
    b.onclick = () => editor(p.cats.find((c) => c.id === b.dataset.id), null, repintar);
  });
  root.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => {
      const cat = p.cats.find((c) => c.id === b.dataset.del);
      if (!cat) return;
      const movsAfectados = p.movs.filter((m) => m.catId === cat.id).map((m) => m.id);
      const recAfectados = p.recurrentes.filter((r) => r.catId === cat.id).map((r) => r.id);
      const indice = p.cats.indexOf(cat);
      const deshacer = store.borrarConDeshacer(
        () => borrar(p.cats, p.movs, cat.id, p.recurrentes),
        () => {
          p.cats.splice(indice, 0, cat);
          p.movs.forEach((m) => { if (movsAfectados.includes(m.id)) m.catId = cat.id; });
          p.recurrentes.forEach((r) => { if (recAfectados.includes(r.id)) r.catId = cat.id; });
        },
      );
      repintar();
      toast(movsAfectados.length
        ? `${cat.n} borrada; ${movsAfectados.length} movimiento${movsAfectados.length === 1 ? '' : 's'} pasaron a Otros.`
        : `${cat.n} borrada.`, () => { deshacer(); repintar(); });
    };
  });
}
