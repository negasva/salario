import * as store from '../store.js';
import { deTipo, nombreDe } from '../engine/categorias.js';
import { masReciente } from '../engine/movimientos.js';
import { aprobar, desaprobar } from '../engine/standby.js';
import { money, esc, fechaCorta, digits } from '../format.js';
import { icon } from './icons.js';
import { toast } from './shell.js';
import { destacar } from './efectos.js';

/* "Por revisar": lo que entró solo y todavía no cuenta en ningún saldo. Cada
   fila se corrige ahí mismo (el nombre es un campo de texto, sin abrir nada) y
   se aprueba con ✓; al aprobarse pasa a Movimientos con su fecha y su hora. */

let abierto = false;

export function renderStandby(root, p, repintar) {
  const lista = [...p.standby].sort(masReciente);
  if (!lista.length) { root.innerHTML = ''; return; }
  const sinMonto = lista.filter((x) => !x.monto).length;
  const listos = lista.length - sinMonto;
  const anioHoy = String(new Date().getFullYear());

  const opciones = (x) => deTipo(p.cats, x.tipo)
    .map((c) => `<option value="${esc(c.id)}" ${c.id === x.catId ? 'selected' : ''}>${esc(c.n)}</option>`).join('');

  root.innerHTML = `<details class="standby" ${abierto ? 'open' : ''}>
    <summary class="callout">
      <span class="callout-ic">${icon('pendiente')}</span>
      <span class="callout-txt"><b>${lista.length} por revisar</b>
        <span class="sub">No cuentan en tus saldos hasta que los apruebes. Toca para verlos.</span></span>
    </summary>
    <div class="sb-barra">
      <span class="sub">Cambia el nombre, la categoría o el monto aquí mismo y aprueba con ✓.${sinMonto ? ` <b>${sinMonto} sin monto</b>: escríbelo para poder aprobarlo.` : ''}</span>
      <button id="sbTodos" ${listos ? '' : 'disabled'}>Aprobar ${listos} listo${listos === 1 ? '' : 's'}</button>
    </div>
    <ul class="list sb-lista">${lista.map((x) => `<li class="row sb-fila ${x.tipo}" data-id="${esc(x.id)}">
      <div class="row-txt">
        <input class="sb-nombre" value="${esc(x.nota)}" maxlength="80" autocomplete="off" enterkeyhint="done"
          placeholder="${esc(nombreDe(p.cats, x.catId))}" aria-label="Nombre del movimiento">
        <span class="row-s num">${fechaCorta(x.fecha)}${x.fecha.slice(0, 4) !== anioHoy ? ` ${x.fecha.slice(0, 4)}` : ''}${x.hora ? ` · ${x.hora}` : ''}</span>
        <select class="sb-cat" aria-label="Categoría">${opciones(x)}</select>
        ${x.origen ? `<span class="row-s sb-origen">Banco: ${esc(x.origen)}</span>` : ''}
      </div>
      ${x.monto
    ? `<b class="num row-monto ${x.tipo === 'ingreso' ? 'pos' : 'neg'}">${x.tipo === 'ingreso' ? '+' : '−'}${money(x.monto)}</b>`
    : '<input class="sb-monto num" inputmode="numeric" placeholder="Monto" aria-label="Monto (el banco no lo detalló)">'}
      <button class="btn-icon sb-ok" aria-label="Aprobar" ${x.monto ? '' : 'disabled'}>${icon('check')}</button>
      <button class="btn-icon btn-icon-danger sb-del" aria-label="Descartar">${icon('basura')}</button>
    </li>`).join('')}</ul>
  </details>`;

  root.querySelector('details').ontoggle = (e) => { abierto = e.target.open; };

  const aprobado = (r) => {
    destacar.id = r[r.length - 1].mov.id;
    store.save();
    repintar();
  };

  root.querySelector('#sbTodos').onclick = () => {
    const hechos = lista.filter((x) => x.monto > 0).map((x) => aprobar(p, x.id)).filter(Boolean);
    if (!hechos.length) return;
    aprobado(hechos);
    toast(`${hechos.length} movimiento${hechos.length === 1 ? '' : 's'} aprobado${hechos.length === 1 ? '' : 's'}.`, () => {
      [...hechos].reverse().forEach((r) => desaprobar(p, r));
      store.save();
      repintar();
    });
  };

  root.querySelectorAll('.sb-fila').forEach((li) => {
    const item = p.standby.find((x) => x.id === li.dataset.id);
    if (!item) return;
    li.querySelector('.sb-nombre').onchange = (e) => { item.nota = e.target.value.trim(); store.save(); };
    li.querySelector('.sb-nombre').onkeydown = (e) => { if (e.key === 'Enter') e.target.blur(); };
    li.querySelector('.sb-cat').onchange = (e) => { item.catId = e.target.value; store.save(); };
    const monto = li.querySelector('.sb-monto');
    if (monto) {
      monto.onchange = () => {
        item.monto = Math.max(0, Math.round(digits(monto.value)));
        store.save();
        abierto = true;
        repintar();
      };
    }
    li.querySelector('.sb-ok').onclick = () => {
      const r = aprobar(p, item.id);
      if (!r) return;
      aprobado([r]);
      toast(`Aprobado: ${money(r.mov.monto)}${r.mov.nota ? ` · ${r.mov.nota}` : ''}.`, () => {
        desaprobar(p, r);
        store.save();
        repintar();
      });
    };
    li.querySelector('.sb-del').onclick = () => {
      const i = p.standby.indexOf(item);
      if (i < 0) return;
      const deshacer = store.borrarConDeshacer(() => p.standby.splice(i, 1), () => p.standby.splice(i, 0, item));
      repintar();
      toast(`Descartado: ${item.nota || nombreDe(p.cats, item.catId)}.`, () => { deshacer(); repintar(); });
    };
  });
}
