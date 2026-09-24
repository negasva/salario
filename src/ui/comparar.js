import * as store from '../store.js';
import { compararMeses } from '../engine/comparar.js';
import { catAhorro } from '../engine/ahorro.js';
import { sumarMeses } from '../engine/movimientos.js';
import { money, esc, nombreMes } from '../format.js';
import { selectorMes, enlazarMes, mesElegido } from './mes.js';
import { icon } from './icons.js';

/* Cada categoría contra el mes anterior o contra el promedio de los tres
   anteriores. En gastos subir es malo y en ingresos es bueno, salvo el
   ahorro, que es un gasto que conviene que suba. El color lo dice, y el signo
   y la flecha también, para no depender solo del color. */

let base = 'anterior';

function variacion(c, subirEsBueno) {
  if (!c.delta) return '<span class="var igual">Igual</span>';
  const bueno = subirEsBueno ? c.delta > 0 : c.delta < 0;
  const signo = c.delta > 0 ? '+' : '−';
  return `<span class="var ${bueno ? 'bien' : 'mal'}">${icon(c.delta > 0 ? 'sube' : 'baja', 'ic-sm')}${signo}${money(Math.abs(c.delta))}${c.pct === null ? ' · nuevo' : ` · ${signo}${Math.abs(c.pct)} %`}</span>`;
}

export function renderComparar(root) {
  const p = store.active();
  const per = mesElegido();
  const c = compararMeses(p.movs, p.cats, per, base);
  const contra = base === 'promedio'
    ? `el promedio de ${nombreMes(sumarMeses(per, -3)).split(' de ')[0]} a ${nombreMes(sumarMeses(per, -1)).split(' de ')[0]}`
    : nombreMes(sumarMeses(per, -1));
  const max = Math.max(1, ...c.filas.map((f) => Math.max(f.actual, f.antes)));
  const ahorroId = catAhorro(p.cats)?.id;
  const subirEsBueno = (f) => f.tipo === 'ingreso' || f.id === ahorroId;
  const gastos = c.filas.filter((f) => f.tipo === 'gasto');
  const ingresos = c.filas.filter((f) => f.tipo === 'ingreso');
  // lo que más se movió entre los gastos de verdad: el ahorro no cuenta aquí
  const subio = gastos.filter((f) => f.delta > 0 && f.id !== ahorroId)[0];
  const bajo = gastos.filter((f) => f.delta < 0 && f.id !== ahorroId)[0];

  const fila = (f) => `<li class="cmp">
      <div class="cmp-top"><span class="dot" style="background:${f.color}"></span><span class="cmp-n">${esc(f.nombre)}</span>
        <b class="num">${money(f.actual)}</b></div>
      <div class="cmp-barras" aria-hidden="true">
        <span class="cb antes"><i style="width:${(f.antes / max) * 100}%"></i></span>
        <span class="cb ahora"><i style="width:${(f.actual / max) * 100}%;background:${f.color}"></i></span>
      </div>
      <div class="cmp-pie num"><span class="sub">Antes ${money(f.antes)}</span>${variacion(f, subirEsBueno(f))}</div>
    </li>`;

  const total = (titulo, x, tipo) => `<div class="stat"><span class="stat-label">${titulo}</span><b class="num">${money(x.actual)}</b>
    <span class="sub num">antes ${money(x.antes)}</span>${variacion(x, tipo === 'ingreso')}</div>`;

  root.innerHTML = `
    ${selectorMes('Comparar')}
    <div class="chips chips-base" role="group" aria-label="Comparar contra">
      <button class="chip ${base === 'anterior' ? 'on' : ''}" data-base="anterior" aria-pressed="${base === 'anterior'}">Mes anterior</button>
      <button class="chip ${base === 'promedio' ? 'on' : ''}" data-base="promedio" aria-pressed="${base === 'promedio'}">Promedio 3 meses</button>
    </div>
    <p class="sub intro">Contra ${contra}.</p>
    ${c.filas.length ? `
    <section class="card">
      <div class="stats">${total('Salió', c.gastos, 'gasto')}${total('Entró', c.ingresos, 'ingreso')}</div>
      ${subio || bajo ? `<ul class="cmp-claves">
        ${subio ? `<li>${icon('sube', 'ic-sm')}Lo que más subió: <b>${esc(subio.nombre)}</b>, ${money(subio.delta)} más${subio.pct !== null ? ` (+${subio.pct} %)` : ''}.</li>` : ''}
        ${bajo ? `<li>${icon('baja', 'ic-sm')}Lo que más bajó: <b>${esc(bajo.nombre)}</b>, ${money(-bajo.delta)} menos (${bajo.pct} %).</li>` : ''}
      </ul>` : ''}
    </section>
    ${gastos.length ? `<section class="seccion"><h2 class="seccion-t">Gastos</h2><ul class="cmp-lista">${gastos.map(fila).join('')}</ul></section>` : ''}
    ${ingresos.length ? `<section class="seccion"><h2 class="seccion-t">Ingresos</h2><ul class="cmp-lista">${ingresos.map(fila).join('')}</ul></section>` : ''}
    <div class="leyenda"><span><i class="cb-muestra antes"></i>Antes</span><span><i class="cb-muestra ahora"></i>${nombreMes(per).split(' de ')[0]}</span></div>`
    : `<div class="empty-state">
        <span class="empty-ic">${icon('comparar')}</span>
        <b>Nada que comparar</b>
        <span class="sub">Ni este mes ni el de antes tienen movimientos.</span>
      </div>`}`;

  const repintar = () => renderComparar(root);
  enlazarMes(root, repintar);
  root.querySelectorAll('[data-base]').forEach((b) => {
    b.onclick = () => { base = b.dataset.base; repintar(); };
  });
}
