import * as store from '../store.js';
import { gastoPorCategoria, serieMensual } from '../engine/movimientos.js';
import { segmentosPorCategoria } from '../engine/graficas.js';
import { resumenReporte } from '../engine/reportes.js';
import { catAhorro, estadoAhorro } from '../engine/ahorro.js';
import { colorPara } from '../engine/categorias.js';
import { money, esc, fechaCorta } from '../format.js';
import { abrirRegistro } from './registrar.js';
import { donutBloque, graficaBarras, graficaLinea, enlazarTips, responsiva } from './charts.js';
import { selectorMes, enlazarMes, cabeceraMes, mesElegido } from './mes.js';
import { vencimientos, cuandoVence } from '../engine/recurrentes.js';
import { icon } from './icons.js';

/* Lo que vence en la próxima semana y lo que ya se pasó sin pagar. */
function proximos(p) {
  const lista = vencimientos(p.recurrentes, p.movs);
  if (!lista.length) return '';
  return `<section class="card proximos">
    <div class="card-head"><h2 class="card-title">Próximos pagos</h2><a class="card-meta" href="#recurrentes">Ver recurrentes</a></div>
    <ul class="prox-lista">${lista.map((v) => `<li class="prox ${v.en < 0 ? 'vencido' : v.en <= 1 ? 'urgente' : ''}">
      <span class="prox-ic" aria-hidden="true">${icon(v.en < 0 ? 'alerta' : 'reloj', 'ic-sm')}</span>
      <span class="prox-txt"><b>${esc(v.rec.n)}</b><span class="sub">${cuandoVence(v.en)} · ${fechaCorta(v.fecha)}</span></span>
      <span class="num prox-monto">${v.monto ? money(v.monto) : 'Sin estimado'}</span>
    </li>`).join('')}</ul>
  </section>`;
}

/* El total ahorrado y el avance de las metas abiertas. */
function ahorroResumen(p, per) {
  const e = estadoAhorro(p, per);
  if (!e || (!e.total && !e.metas.length)) return '';
  const abiertas = e.metas.map((m, i) => ({ ...m, color: colorPara(i + 3) })).filter((m) => !m.meta.usada).slice(0, 3);
  return `<section class="card">
    <div class="card-head"><h2 class="card-title">Ahorro y metas</h2><a class="card-meta" href="#ahorro">Ver ahorro</a></div>
    <b class="num ahorro-total">${money(e.total)}</b>
    <span class="sub">${e.esteMes ? `Guardaste ${money(e.esteMes)} este mes` : 'Nada guardado este mes todavía'}</span>
    ${abiertas.length ? `<ul class="metas-mini">${abiertas.map((m) => `<li>
      <div class="mm-top"><span class="mm-n"><i class="dot" style="background:${m.color}"></i><b>${esc(m.meta.n)}</b></span><span class="num">${m.pctAvance} %</span></div>
      <span class="barra" role="progressbar" aria-label="Avance de ${esc(m.meta.n)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m.pctAvance}"><i style="width:${m.pctAvance}%;background:${m.color}"></i></span></li>`).join('')}</ul>` : ''}
  </section>`;
}

/* Primera vez: una cuenta sin un solo movimiento no tiene nada que graficar,
   así que en vez de gráficas vacías se muestra por dónde empezar. */
function bienvenida() {
  const paso = (n, t, d, accion) => `<li class="paso"><span class="paso-n" aria-hidden="true">${n}</span>
    <div class="paso-txt"><b>${t}</b><span class="sub">${d}</span></div>${accion}</li>`;
  return `<section class="card bienvenida">
    <div class="card-head"><h2 class="card-title">Empieza por aquí</h2></div>
    <p class="sub">Tres pasos y el mes se arma solo. Puedes hacerlos en el orden que quieras.</p>
    <ol class="pasos">
      ${paso(1, 'Dile con cuánto empiezas', 'El saldo de hoy, para que el arrastre de cada mes salga exacto.', '<button class="mini" data-ir="ajustes">Ir a Ajustes</button>')}
      ${paso(2, 'Registra un movimiento', 'Un gasto o un ingreso: monto, categoría y fecha.', '<button class="mini btn-primary" id="biRegistrar">Registrar</button>')}
      ${paso(3, 'Agrega lo que se repite', 'El arriendo, los servicios, el sueldo: se pagan o se reciben por partes.', '<button class="mini" data-ir="recurrentes">Ir a Recurrentes</button>')}
    </ol>
  </section>`;
}

/* Tres cifras del mes y la puerta a los reportes completos. */
function resumenRapido(p, per) {
  const r = resumenReporte(p.movs, per, { ahorroId: catAhorro(p.cats)?.id });
  if (!r.gastos && !r.ingresos) return '';
  const dato = (rot, valor, nota) => `<div class="kpi-mini"><span class="stat-label">${rot}</span><b class="num">${valor}</b><span class="sub">${nota}</span></div>`;
  return `<section class="card resumen-rapido">
    <div class="card-head"><h2 class="card-title">Cómo va el mes</h2><a class="card-meta" href="#reportes">Ver reportes</a></div>
    <div class="kpis-mini">
      ${dato('Por día', money(r.promedioDiario), r.proyeccion !== null ? `Cierras en ${money(r.proyeccion)}` : `${r.diasConGasto} días con gasto`)}
      ${dato('Ahorro', r.tasaAhorro === null ? 'Sin ingresos' : `${r.tasaAhorro} %`, r.apartado ? `Apartaste ${money(r.apartado)}` : r.neto >= 0 ? `Sobró ${money(r.neto)}` : `Faltó ${money(-r.neto)}`)}
      ${dato('Día más caro', r.diaMasCaro ? fechaCorta(`${per}-${String(r.diaMasCaro.dia).padStart(2, '0')}`) : 'Ninguno', r.diaMasCaro ? money(r.diaMasCaro.gasto) : 'Sin gastos')}
    </div>
  </section>`;
}

export function renderInicio(root) {
  const p = store.active();
  const per = mesElegido();
  const segmentos = segmentosPorCategoria(p.cats, gastoPorCategoria(p.movs, per));
  const serie = serieMensual(p.saldoInicial, p.movs, per, 6, p.arranques);

  if (!p.movs.length) {
    root.innerHTML = `${selectorMes('Inicio')}${cabeceraMes(p, per)}${bienvenida()}`;
    enlazarMes(root, () => renderInicio(root));
    root.querySelector('#biRegistrar').onclick = () => abrirRegistro({ alGuardar: () => renderInicio(root) });
    root.querySelectorAll('[data-ir]').forEach((b) => {
      b.onclick = () => window.dispatchEvent(new CustomEvent('ir-a-vista', { detail: { route: b.dataset.ir } }));
    });
    return;
  }

  root.innerHTML = `
    ${selectorMes('Inicio')}
    ${cabeceraMes(p, per)}
    ${resumenRapido(p, per)}
    <div class="cols-2">
      <div class="stack">
        ${proximos(p)}
        <section class="card">
          <div class="card-head"><h2 class="card-title">Gasto por categoría</h2></div>
          ${donutBloque(segmentos, 'Salió', { limite: 5 })}
        </section>
      </div>
      <div class="stack">
        <section class="card">
          <div class="card-head"><h2 class="card-title">Entró y salió</h2><span class="card-meta">Últimos 6 meses</span></div>
          <div class="graf" id="gBarras"></div>
          <div class="leyenda"><span><i class="dot" style="background:var(--pos-fill)"></i>Entró</span><span><i class="dot" style="background:var(--neg-fill)"></i>Salió</span></div>
        </section>
        <section class="card">
          <div class="card-head"><h2 class="card-title">Con qué terminas cada mes</h2></div>
          <div class="graf" id="gLinea"></div>
        </section>
        ${ahorroResumen(p, per)}
      </div>
    </div>`;

  responsiva(root.querySelector('#gBarras'), (w) => graficaBarras(serie, undefined, w));
  responsiva(root.querySelector('#gLinea'), (w) => graficaLinea(serie, w));
  enlazarMes(root, () => renderInicio(root));
  enlazarTips(root);
}
