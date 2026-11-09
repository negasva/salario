import * as store from '../store.js';
import { deTipo, nombreDe } from '../engine/categorias.js';
import { masReciente } from '../engine/movimientos.js';
import { aprobar, desaprobar } from '../engine/standby.js';
import { cuentaEn, estaPagado } from '../engine/recurrentes.js';
import { periodoDe } from '../engine/movimientos.js';
import { money, esc, fechaCorta, digits } from '../format.js';
import { icon } from './icons.js';
import { toast } from './shell.js';
import { destacar } from './efectos.js';

/* "Por revisar": lo que entró solo y todavía no cuenta en ningún saldo. Cada
   fila se corrige ahí mismo (el nombre es un campo de texto, sin abrir nada) y
   se aprueba con ✓; al aprobarse pasa a Movimientos con su fecha y su hora. */

let abierto = false;
const REC = '__rec'; // opción propia cuando no existe la categoría "Gastos recurrentes"
const sinTildes = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function renderStandby(root, p, repintar) {
  const lista = [...p.standby].sort(masReciente);
  if (!lista.length) { root.innerHTML = ''; return; }
  const sinMonto = lista.filter((x) => !x.monto).length;
  const sinRec = lista.filter((x) => x.monto > 0 && esRec(x) && !x.recId).length;
  const listos = lista.length - sinMonto - sinRec;
  const anioHoy = String(new Date().getFullYear());

  const gastosRec = p.recurrentes.filter((r) => r.tipo === 'gasto');
  const catRec = p.cats.find((c) => c.tipo === 'gasto' && sinTildes(c.n) === 'gastos recurrentes');
  const esRec = (x) => x.tipo === 'gasto' && gastosRec.length > 0 && (Boolean(x.recId) || (catRec && x.catId === catRec.id));
  const opciones = (x) => (x.tipo === 'gasto' && gastosRec.length && !catRec
    ? `<option value="${REC}" ${x.recId ? 'selected' : ''}>Gastos recurrentes</option>` : '')
    + deTipo(p.cats, x.tipo)
      .map((c) => `<option value="${esc(c.id)}" ${c.id === x.catId && !(x.recId && !catRec) ? 'selected' : ''}>${esc(c.n)}</option>`).join('');
  // los recurrentes del mes del movimiento que aún no tienen pago, primero
  const opcionesRec = (x) => {
    const per = periodoDe(x.fecha);
    const falta = gastosRec.filter((r) => cuentaEn(r, per) && !estaPagado(r, p.movs, per));
    const resto = gastosRec.filter((r) => !falta.includes(r));
    const op = (r) => `<option value="${esc(r.id)}" ${r.id === x.recId ? 'selected' : ''}>${esc(r.n)}${r.monto ? ` · ${money(r.monto)}` : ''}</option>`;
    return `<option value="">¿Cuál recurrente?</option>${falta.length ? `<optgroup label="Pendientes de ese mes">${falta.map(op).join('')}</optgroup>` : ''}${resto.length ? `<optgroup label="${falta.length ? 'Los demás' : 'Recurrentes'}">${resto.map(op).join('')}</optgroup>` : ''}`;
  };

  root.innerHTML = `<details class="standby" ${abierto ? 'open' : ''}>
    <summary class="callout">
      <span class="callout-ic">${icon('pendiente')}</span>
      <span class="callout-txt"><b>${lista.length} por revisar</b>
        <span class="sub">No cuentan en tus saldos hasta que los apruebes. Toca para verlos.</span></span>
    </summary>
    <div class="sb-barra">
      <span class="sub">Cambia el nombre, la categoría o el monto aquí mismo y aprueba con ✓.${sinMonto ? ` <b>${sinMonto} sin monto</b>: escríbelo para poder aprobarlo.` : ''}${sinRec ? ` <b>${sinRec} en Gastos recurrentes</b>: elige cuál recurrente es.` : ''}</span>
      <button id="sbTodos" ${listos ? '' : 'disabled'}>Aprobar ${listos} listo${listos === 1 ? '' : 's'}</button>
    </div>
    <ul class="list sb-lista">${lista.map((x) => `<li class="row sb-fila ${x.tipo}" data-id="${esc(x.id)}">
      <div class="row-txt">
        <input class="sb-nombre" value="${esc(x.nota)}" maxlength="80" autocomplete="off" enterkeyhint="done"
          placeholder="${esc(nombreDe(p.cats, x.catId))}" aria-label="Nombre del movimiento">
        <span class="row-s num">${fechaCorta(x.fecha)}${x.fecha.slice(0, 4) !== anioHoy ? ` ${x.fecha.slice(0, 4)}` : ''}${x.hora ? ` · ${x.hora}` : ''}</span>
        <select class="sb-cat" aria-label="Categoría">${opciones(x)}</select>
        ${esRec(x) ? `<select class="sb-rec" aria-label="¿Cuál recurrente?">${opcionesRec(x)}</select>` : ''}
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
    const hechos = lista.filter((x) => x.monto > 0 && !(esRec(x) && !x.recId)).map((x) => aprobar(p, x.id)).filter(Boolean);
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
    li.querySelector('.sb-cat').onchange = (e) => {
      const v = e.target.value;
      if (v === REC) { item.catId = 'otros'; item.recId = gastosRec[0].id; } else { item.catId = v; delete item.recId; }
      store.save();
      abierto = true;
      repintar();
    };
    const recSel = li.querySelector('.sb-rec');
    if (recSel) {
      recSel.onchange = () => {
        const r = gastosRec.find((x) => x.id === recSel.value);
        if (r) { item.recId = r.id; item.catId = r.catId || item.catId; } else delete item.recId;
        store.save();
      };
    }
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
      if (esRec(item) && !item.recId) { toast('Elige cuál recurrente es.'); li.querySelector('.sb-rec')?.focus(); return; }
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
