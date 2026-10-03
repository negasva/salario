import * as store from '../store.js';
import { sumarMeses, periodoActual, gastoPorCategoria, hoyISO } from '../engine/movimientos.js';
import { segmentosPorCategoria } from '../engine/graficas.js';
import { flujoDiario, acumulado, porDiaSemana, calor, topGastos, resumenReporte,
  tendenciaCategorias, resumenAnual, insights } from '../engine/reportes.js';
import { idsAhorro } from '../engine/ahorro.js';
import { nombreDe, colorDe } from '../engine/categorias.js';
import { money, moneySigno, esc, fechaCorta, nombreMes, MESES } from '../format.js';
import { selectorMes, enlazarMes, mesElegido, setMes } from './mes.js';
import { donutBloque, graficaBarras, graficaNeto, lineaAcumulada, barrasSemana, calendarioCalor,
  sparkline, enlazarTips, responsiva } from './charts.js';
import { icon } from './icons.js';
import { animarSegmentos } from './efectos.js';
import { titulo } from './piezas.js';

/* Reportes: lo que los movimientos dicen más allá del saldo. Dos vistas, el
   mes y el año, con el mismo ritmo: cuatro cifras arriba y las gráficas
   debajo. Se puede imprimir o guardar como PDF desde el navegador. */

let vista = 'mes'; // mes | anio

const dia2 = (n) => String(n).padStart(2, '0');

/* Gastar más es malo: la variación sube en rojo y baja en verde. */
function variacion(actual, antes, etiqueta) {
  if (antes === null || antes === undefined) return '';
  if (antes === 0) return actual === 0 ? '' : `<span class="var mal">${icon('sube', 'ic-sm')}Nuevo ${etiqueta}</span>`;
  const pct = Math.round(((actual - antes) / antes) * 100);
  if (pct === 0) return `<span class="var igual">Igual ${etiqueta}</span>`;
  return `<span class="var ${pct > 0 ? 'mal' : 'bien'}">${icon(pct > 0 ? 'sube' : 'baja', 'ic-sm')}${pct > 0 ? '+' : '−'}${Math.abs(pct)} % ${etiqueta}</span>`;
}

const kpi = (ic, rot, valor, nota, clase = '') => `<div class="kpi">
  <span class="stat-label kpi-rot"><span class="kpi-ic" aria-hidden="true">${icon(ic, 'ic-sm')}</span>${rot}</span><b class="num ${clase}">${valor}</b><span class="kpi-nota">${nota}</span></div>`;

function cabecera(per, anio) {
  const controles = `<div class="rep-barra">
    <div class="chips chips-base" role="group" aria-label="Periodo del reporte" data-seg="rep-vista">
      <button class="chip ${vista === 'mes' ? 'on' : ''}" data-vista="mes" aria-pressed="${vista === 'mes'}">Mes</button>
      <button class="chip ${vista === 'anio' ? 'on' : ''}" data-vista="anio" aria-pressed="${vista === 'anio'}">Año</button>
    </div>
    <button class="mini" id="repImprimir">${icon('imprimir', 'ic-sm')}Imprimir</button>
  </div>`;
  if (vista === 'mes') return selectorMes('Reportes') + controles;
  return `<header class="page-head">
    <div class="ph-txt"><h1 class="mes-titulo"><span class="sr-only">Reportes: </span>${anio}</h1></div>
    <div class="mes-nav" role="group" aria-label="Cambiar de año">
      ${per.slice(0, 4) !== periodoActual().slice(0, 4) ? '<button class="mes-hoy" data-anio-hoy>Hoy</button>' : ''}
      <button class="btn-icon" data-anio="-1" aria-label="Año anterior">${icon('izq')}</button>
      <button class="btn-icon" data-anio="1" aria-label="Año siguiente">${icon('der')}</button>
    </div></header>${controles}`;
}

/* Las frases de arriba: lo accionable primero, sin tener que leer las gráficas. */
function resumenFrases(lista) {
  if (!lista.length) return '';
  return `<section class="card insights" aria-label="Lo que dicen tus números">
    <ul class="ins-lista">${lista.map((i, k) => `<li class="ins ins-${i.tono}" style="--i:${k}">
      <span class="ins-ic" aria-hidden="true">${icon(i.ic, 'ic-sm')}</span><span>${esc(i.texto)}</span></li>`).join('')}</ul></section>`;
}

/* Debajo de las barras de la semana: los datos que se leen sin descifrar la gráfica. */
function datosSemana(t) {
  const total = t.reduce((a, b) => a + b, 0);
  if (!total) return '';
  const nombres = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const mayor = t.indexOf(Math.max(...t));
  const finde = t[5] + t[6];
  const fila = (rot, valor) => `<div class="dato"><dt>${rot}</dt><dd class="num">${valor}</dd></div>`;
  return `<dl class="datos">
    ${fila('Día que más gastas', `${nombres[mayor][0].toUpperCase()}${nombres[mayor].slice(1)}`)}
    ${fila('Fin de semana', `${Math.round((finde / total) * 100)}\u00a0% del gasto`)}
    ${fila('Entre semana', `${money(Math.round((total - finde) / 5))} por día tipo`)}
  </dl>`;
}

function vistaMes(p, per) {
  const hoy = hoyISO();
  const ahorroId = idsAhorro(p.cats);
  const r = resumenReporte(p.movs, per, { hoy, ahorroId });
  if (!r.gastos && !r.ingresos) {
    return { montar() {}, html: `<div class="empty-state"><span class="empty-ic">${icon('reportes')}</span>
      <b>Sin movimientos en ${nombreMes(per).split(' de ')[0]}</b>
      <span class="sub">Registra algo y aquí aparece tu reporte.</span></div>` };
  }
  const prev = sumarMeses(per, -1);
  const dias = flujoDiario(p.movs, per);
  const diasPrev = flujoDiario(p.movs, prev);
  const acum = acumulado(dias, r.pasados);
  const acumPrev = acumulado(diasPrev);
  const i = Math.max(0, Math.min(r.pasados, diasPrev.length) - 1);
  const antes = r.pasados ? acumPrev[i] : null;
  const rPrev = resumenReporte(p.movs, prev, { hoy, ahorroId });

  const porCat = gastoPorCategoria(p.movs, per);
  const segs = segmentosPorCategoria(p.cats, porCat);
  const tend = tendenciaCategorias(p.movs, per, 6);
  const totalCat = segs.reduce((t, s) => t + s.monto, 0);
  const top = topGastos(p.movs, per, 5);
  const semana = porDiaSemana(p.movs, per, ahorroId);
  const frases = insights(p.movs, per, { cats: p.cats, hoy, ahorroId });
  const fila = (s) => {
    const prevMonto = (tend[s.id] || [])[4] ?? 0;
    const tope = p.cats.find((c) => c.id === s.id)?.m || 0;
    const usado = tope ? Math.round((s.monto / tope) * 100) : 0;
    return `<li class="rep-cat">
      <span class="dot" style="background:${s.color}"></span>
      <span class="rep-cat-n">${esc(s.nombre)}</span>
      ${sparkline(tend[s.id] || [0, 0], s.color)}
      <span class="num rep-cat-m">${money(s.monto)}</span>
      <span class="num fc-pct">${totalCat ? Math.round((s.monto / totalCat) * 100) : 0}%</span>
      <span class="rep-cat-v">${variacion(s.monto, prevMonto, 'vs mes anterior')}${tope ? `<span class="var ${usado > 100 ? 'mal' : 'igual'}">${usado}\u00a0% del presupuesto</span>` : ''}</span>
      ${tope ? `<span class="barra rep-cat-b" role="progressbar" aria-label="Presupuesto de ${esc(s.nombre)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(usado, 100)}"><i style="width:${Math.min(usado, 100)}%;background:${usado > 100 ? 'var(--neg-fill)' : s.color}"></i></span>` : ''}</li>`;
  };

  const html = `
    <div class="kpis">
      ${kpi('sale', 'Gastaste', money(r.gastos), variacion(r.gastos, r.pasados < r.total ? antes : rPrev.gastos, r.pasados < r.total ? 'a esta altura' : 'vs mes anterior') || `${r.diasConGasto} días con gasto`)}
      ${kpi('reloj', 'Gasto por día', money(r.promedioDiario), r.proyeccion !== null ? `Cierras el mes en ${money(r.proyeccion)}` : 'Sin recurrentes ni ahorro')}
      ${kpi('ahorro', 'Tasa de ahorro', r.tasaAhorro === null ? 'Sin ingresos' : `${r.tasaAhorro} %`, r.tasaAhorro === null ? 'No entró plata este mes' : r.apartado ? `Apartaste ${money(r.apartado)}` : r.neto >= 0 ? `Te sobró ${money(r.neto)}` : `Te faltó ${money(-r.neto)}`, r.tasaAhorro !== null && r.tasaAhorro < 0 ? 'neg' : '')}
      ${kpi('calendario', 'Día más caro', r.diaMasCaro ? fechaCorta(`${per}-${dia2(r.diaMasCaro.dia)}`) : 'Ninguno', r.diaMasCaro ? `Salieron ${money(r.diaMasCaro.gasto)}` : 'Sin gastos este mes')}
    </div>

    ${resumenFrases(frases)}

    <section class="card">
      <div class="card-head">${titulo('sube', 'Gasto acumulado')}<span class="card-meta">Contra el mes anterior</span></div>
      <div class="graf" id="gAcum"></div>
      <div class="leyenda"><span><i class="raya" style="background:var(--brand)"></i>Este mes</span><span><i class="raya raya-previo"></i>Mes anterior</span>${r.proyeccion !== null ? '<span><i class="raya raya-proy"></i>Ritmo actual</span>' : ''}</div>
    </section>

    <div class="grid-2">
      <section class="card">
        <div class="card-head">${titulo('calendario', 'Calendario de gasto')}<span class="card-meta">Más oscuro, más gasto</span></div>
        ${calendarioCalor(calor(p.movs, per), per === periodoActual() ? Number(hoy.slice(8, 10)) : 0)}
      </section>
      <section class="card">
        <div class="card-head">${titulo('reloj', 'Por día de la semana')}<span class="card-meta">Sin recurrentes ni ahorro</span></div>
        <div class="graf" id="gSemana"></div>
        ${datosSemana(semana)}
      </section>
    </div>

    <section class="card">
      <div class="card-head">${titulo('categorias', 'A dónde se fue')}<span class="card-meta">Tendencia de 6 meses</span></div>
      <div class="rep-cats-card">
        ${donutBloque(segs, 'Salió', { lista: false })}
        ${segs.length ? `<ul class="rep-cats">${segs.slice(0, 8).map(fila).join('')}</ul>` : '<div class="empty">Sin gastos este mes.</div>'}
      </div>
    </section>

    <section class="seccion">
      <h2 class="seccion-t">Mayores gastos</h2>
      ${top.length ? `<ul class="list">${top.map((m) => `<li class="row mov gasto">
        <span class="av" style="--c:${colorDe(p.cats, m.catId)}" aria-hidden="true"></span>
        <span class="row-txt"><span class="row-t">${esc(nombreDe(p.cats, m.catId))}</span>
          <span class="row-s">${fechaCorta(m.fecha)}${m.nota ? ` · ${esc(m.nota)}` : ''}</span></span>
        <b class="num row-monto">−${money(m.monto)}</b></li>`).join('')}</ul>` : '<div class="empty">Sin gastos este mes.</div>'}
    </section>`;

  return {
    html,
    montar(root) {
      responsiva(root.querySelector('#gAcum'), (w) => lineaAcumulada({ periodo: per, actual: acum, previo: acumPrev, proyeccion: r.proyeccion }, w));
      responsiva(root.querySelector('#gSemana'), (w) => barrasSemana(semana, w));
    },
  };
}

function vistaAnio(p, anio) {
  const a = resumenAnual(p.movs, anio);
  if (!a.mejor) {
    return { montar() {}, html: `<div class="empty-state"><span class="empty-ic">${icon('reportes')}</span>
      <b>Sin movimientos en ${anio}</b><span class="sub">Prueba con otro año.</span></div>` };
  }
  const nombre = (m) => MESES[Number(m.periodo.slice(5, 7)) - 1];
  const segs = segmentosPorCategoria(p.cats, a.porCat);
  const tasa = a.ingresos > 0 ? Math.round((a.neto / a.ingresos) * 100) : null;
  const idx = Number(mesElegido().slice(0, 4)) === anio ? Number(mesElegido().slice(5, 7)) - 1 : -1;
  const html = `
    <div class="kpis">
      ${kpi('entra', 'Entró en el año', money(a.ingresos), `${a.meses.filter((m) => m.ingresos > 0).length} meses con ingresos`, 'pos')}
      ${kpi('sale', 'Salió en el año', money(a.gastos), `Promedio de ${money(Math.round(a.gastos / Math.max(1, a.meses.filter((m) => m.activo).length)))} al mes`, 'neg')}
      ${kpi('billetera', 'Te quedó', moneySigno(a.neto), tasa === null ? 'Sin ingresos' : `${tasa} % de lo que entró`, a.neto < 0 ? 'neg' : 'pos')}
      ${kpi('sube', 'Mejor mes', nombre(a.mejor), `${moneySigno(a.mejor.neto)} · el peor fue ${nombre(a.peor)}`)}
    </div>
    <div class="grid-2">
      <section class="card">
        <div class="card-head">${titulo('comparar', 'Entró y salió')}<span class="card-meta">${anio}</span></div>
        <div class="graf" id="gAnio"></div>
        <div class="leyenda"><span><i class="dot" style="background:var(--pos-fill)"></i>Entró</span><span><i class="dot" style="background:var(--neg-fill)"></i>Salió</span></div>
      </section>
      <section class="card">
        <div class="card-head">${titulo('billetera', 'Lo que sobró cada mes')}<span class="card-meta">${anio}</span></div>
        <div class="graf" id="gNeto"></div>
        <div class="leyenda"><span><i class="dot" style="background:var(--pos-fill)"></i>Sobró</span><span><i class="dot" style="background:var(--neg-fill)"></i>Faltó</span></div>
      </section>
    </div>
    <section class="card">
      <div class="card-head">${titulo('categorias', 'A dónde se fue el año')}</div>
      ${donutBloque(segs)}
    </section>`;

  return {
    html,
    montar(root) {
      responsiva(root.querySelector('#gAnio'), (w) => graficaBarras(a.meses, idx, w));
      responsiva(root.querySelector('#gNeto'), (w) => graficaNeto(a.meses, w));
    },
  };
}

export function renderReportes(root) {
  const p = store.active();
  const per = mesElegido();
  const anio = Number(per.slice(0, 4));
  const cuerpo = vista === 'mes' ? vistaMes(p, per) : vistaAnio(p, anio);
  root.innerHTML = `
    <div class="solo-print"><b>Reparto mensual</b> · Reporte de ${vista === 'mes' ? nombreMes(per) : anio}</div>
    ${cabecera(per, anio)}
    ${cuerpo.html}`;
  root.classList.add('anima');
  cuerpo.montar(root);

  animarSegmentos(root);
  const repintar = () => renderReportes(root);
  enlazarMes(root, repintar);
  enlazarTips(root);
  root.querySelectorAll('[data-vista]').forEach((b) => { b.onclick = () => { vista = b.dataset.vista; repintar(); }; });
  root.querySelectorAll('[data-anio]').forEach((b) => { b.onclick = () => { setMes(sumarMeses(per, 12 * Number(b.dataset.anio))); repintar(); }; });
  root.querySelector('[data-anio-hoy]')?.addEventListener('click', () => { setMes(periodoActual()); repintar(); });
  root.querySelector('#repImprimir').onclick = () => window.print();
}
