import * as store from '../store.js';
import { gastoPorCategoria } from '../engine/movimientos.js';
import { OTROS, agregar, borrar } from '../engine/categorias.js';
import { money, plain, esc, digits } from '../format.js';
import { selectorMes, enlazarMes, mesElegido } from './mes.js';
import { abrirModal } from './modal.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

/* Una categoría es un nombre y un presupuesto mensual opcional. La barra
   muestra lo gastado en el mes elegido contra ese presupuesto. */

function editor(cat, alGuardar) {
  const p = store.active();
  const { cuerpo, cerrar } = abrirModal({ titulo: cat ? 'Editar categoría' : 'Nueva categoría' });
  cuerpo.innerHTML = `
    <div class="fld"><label for="catNombre">Nombre</label>
      <input id="catNombre" value="${esc(cat?.n || '')}" ${cat?.id === OTROS ? 'disabled' : ''} autocomplete="off"></div>
    <div class="fld"><label for="catPres">Presupuesto mensual <span class="opcional">(opcional)</span></label>
      <input id="catPres" class="num" inputmode="numeric" placeholder="0" value="${cat?.m ? plain(cat.m) : ''}"></div>
    <div id="catErr" class="auth-err"></div>
    <button class="wide btn-primary" id="catSave">Guardar</button>`;
  const guardar = () => {
    const n = cuerpo.querySelector('#catNombre').value.trim();
    const m = Math.max(0, Math.round(digits(cuerpo.querySelector('#catPres').value)));
    if (!n) { cuerpo.querySelector('#catErr').textContent = 'Escribe el nombre.'; return; }
    if (cat) { if (cat.id !== OTROS) cat.n = n; cat.m = m; } else agregar(p.cats, n, m);
    store.save();
    cerrar();
    alGuardar();
  };
  cuerpo.querySelector('#catSave').onclick = guardar;
  cuerpo.onkeydown = (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardar(); } };
  cuerpo.querySelector(cat?.id === OTROS ? '#catPres' : '#catNombre').focus();
}

export function renderCategorias(root) {
  const p = store.active();
  const per = mesElegido();
  const gasto = gastoPorCategoria(p.movs, per);

  root.innerHTML = `
    ${selectorMes()}
    <div class="prow"><span class="sub">Toca una categoría para editarla. Borrar una pasa sus movimientos a Otros.</span>
      <button class="btn-primary" id="catNueva">+ Nueva</button></div>
    <div class="cats">
      ${p.cats.map((c) => {
    const g = gasto[c.id] || 0;
    const pct = c.m > 0 ? Math.min(100, Math.round((g / c.m) * 100)) : 0;
    const pasado = c.m > 0 && g > c.m;
    return `<div class="cat ${pasado ? 'over' : ''}" data-id="${c.id}">
        <span class="dot" style="background:${c.c}"></span>
        <div class="cat-txt">
          <div class="cat-n">${esc(c.n)}</div>
          <div class="cat-sub num">${money(g)}${c.m > 0 ? ` de ${money(c.m)}${pasado ? ` · te pasaste ${money(g - c.m)}` : ''}` : ''}</div>
          ${c.m > 0 ? `<div class="barra"><i style="width:${pct}%;background:${pasado ? 'var(--sem-gasto-2)' : c.c}"></i></div>` : ''}
        </div>
        ${c.id !== OTROS ? `<button class="btn-icon" data-del="${c.id}" aria-label="Borrar ${esc(c.n)}">${icon('cerrar')}</button>` : ''}
      </div>`;
  }).join('')}
    </div>`;

  const repintar = () => renderCategorias(root);
  enlazarMes(root, repintar);
  root.querySelector('#catNueva').onclick = () => editor(null, repintar);
  root.querySelectorAll('.cat').forEach((el) => {
    el.onclick = (e) => {
      if (e.target.closest('[data-del]')) return;
      editor(p.cats.find((c) => c.id === el.dataset.id), repintar);
    };
  });
  root.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => {
      const cat = p.cats.find((c) => c.id === b.dataset.del);
      if (!cat) return;
      const afectados = p.movs.filter((m) => m.catId === cat.id).map((m) => m.id);
      const indice = p.cats.indexOf(cat);
      const deshacer = store.borrarConDeshacer(
        () => borrar(p.cats, p.movs, cat.id),
        () => { p.cats.splice(indice, 0, cat); p.movs.forEach((m) => { if (afectados.includes(m.id)) m.catId = cat.id; }); },
      );
      repintar();
      toast(afectados.length
        ? `${cat.n} borrada; ${afectados.length} movimiento${afectados.length === 1 ? '' : 's'} pasaron a Otros.`
        : `${cat.n} borrada.`, () => { deshacer(); repintar(); });
    };
  });
}
