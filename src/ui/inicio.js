import * as store from '../store.js';
import { gastoPorCategoria, serieMensual, delMes } from '../engine/movimientos.js';
import { segmentosPorCategoria } from '../engine/graficas.js';
import { resumenReporte } from '../engine/reportes.js';
import { idsAhorro, estadoAhorro } from '../engine/ahorro.js';
import { colorPara, colorDe, nombreDe } from '../engine/categorias.js';
import { money, esc, fechaCorta } from '../format.js';
import { abrirRegistro } from './registrar.js';
import { titulo, avatar } from './piezas.js';
import { saludo, nombreVisible } from '../engine/persona.js';
import { donutBloque, graficaBarras, graficaLinea, enlazarTips, responsiva } from './charts.js';
import { selectorMes, enlazarMes, cabeceraMes, mesElegido } from './mes.js';
import { vencimientos, cuandoVence, sugerirRecurrentes, totalAlMes } from '../engine/recurrentes.js';
import { icon } from './icons.js';

/* Lo que vence en la próxima semana y lo que ya se pasó sin pagar, en tiles
   que se deslizan de lado; el último, negro, lleva a crear uno nuevo. */
function proximos(p) {
  const lista = vencimientos(p.recurrentes, p.movs);
  if (!lista.length) return '';
  return `<section class="bloque proximos">
    <div class="bloque-head"><h2 class="card-title">Próximos pagos</h2><a class="card-meta" href="#recurrentes">Ver todos</a></div>
    <ul class="tiles">${lista.map((v) => `<li class="tile ${v.en < 0 ? 'vencido' : v.en <= 1 ? 'urgente' : ''}">
      <span class="tile-ic" style="--c:${colorDe(p.cats, v.rec.catId)}" aria-hidden="true">${icon(v.en < 0 ? 'alerta' : 'reloj')}</span>
      <span class="tile-n">${esc(v.rec.n)}</span>
      <b class="num tile-v">${v.monto ? money(v.monto) : 'Sin estimado'}</b>
      <span class="tile-s">${cuandoVence(v.en)}</span>
    </li>`).join('')}
      <li class="tile tile-nuevo"><a href="#recurrentes">${icon('mas')}<span>Nuevo pago</span></a></li>
    </ul>
  </section>`;
}

/* Si ya haces algo cada mes sin haberlo marcado, aquí se avisa. */
function avisoSugeridos(p) {
  const lista = sugerirRecurrentes(p.movs, p.recurrentes, undefined, p.ignoradas);
  const n = lista.length;
  if (!n) return '';
  const alMes = totalAlMes(lista);
  return `<a class="card aviso-sug" href="#recurrentes">${icon('recurrente')}<span><b>${n} ${n === 1 ? 'pago se repite' : 'pagos se repiten'} cada mes${alMes ? `, unos ${money(alMes)}` : ''}.</b> Agrégalos como recurrentes con un toque.</span></a>`;
}

/* Los tres últimos movimientos del mes, como en la lista de Movimientos. */
function ultimos(p, per) {
  const movs = delMes(p.movs, per).slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 3);
  if (!movs.length) return '';
  return `<section class="bloque">
    <div class="bloque-head"><h2 class="card-title">Últimos movimientos</h2><a class="card-meta" href="#movimientos">Ver todos</a></div>
    <ul class="list">${movs.map((m) => `<li class="row mov ${m.tipo}">
      <span class="av" style="--c:${colorDe(p.cats, m.catId)}" aria-hidden="true">${esc(nombreDe(p.cats, m.catId).trim().charAt(0).toUpperCase())}</span>
      <span class="row-txt"><span class="row-t">${esc(nombreDe(p.cats, m.catId))}</span><span class="row-s">${fechaCorta(m.fecha)}${m.nota ? ` · ${esc(m.nota)}` : ''}</span></span>
      <b class="num row-monto">${m.tipo === 'ingreso' ? '+' : '−'}${money(m.monto)}</b>
    </li>`).join('')}</ul>
  </section>`;
}

/* Arriba de todo: el saludo y, a la derecha, el avatar que lleva al perfil. */
function saludoFila(p) {
  const correo = store.correo();
  const nombre = nombreVisible(p.persona.nombre, correo).split(' ')[0];
  return `<div class="saludo-fila">
    <div class="saludo-txt"><span class="saludo">${saludo(new Date().getHours())}</span>${nombre ? `<b class="saludo-nombre">${esc(nombre)}</b>` : ''}</div>
    <a class="avatar-btn" href="#perfil" aria-label="Tu perfil">${avatar(p.persona, correo, 'md')}</a>
    <nav class="saludo-acc" aria-label="Atajos">
      <a class="btn-redondo" href="#recurrentes" aria-label="Pagos recurrentes">${icon('campana')}</a>
      <a class="btn-redondo" href="#reportes" aria-label="Reportes">${icon('reportes')}</a>
    </nav>
  </div>`;
}

/* El total ahorrado y el avance de las metas abiertas. */
function ahorroResumen(p, per) {
  const e = estadoAhorro(p, per);
  if (!e || (!e.total && !e.metas.length)) return '';
  const abiertas = e.metas.map((m, i) => ({ ...m, color: colorPara(i + 3) })).filter((m) => !m.meta.usada).slice(0, 3);
  return `<section class="card">
    <div class="card-head">${titulo('ahorro', 'Ahorro y metas')}<a class="card-meta" href="#ahorro">Ver ahorro</a></div>
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
  const paso = (n, t, d, accion) => `<li class="paso" style="--i:${n - 1}"><span class="paso-n" aria-hidden="true">${n}</span>
    <div class="paso-txt"><b>${t}</b><span class="sub">${d}</span></div>${accion}</li>`;
  return `<section class="card bienvenida">
    <div class="card-head">${titulo('chispa', 'Empieza por aquí')}</div>
    <p class="sub">Tres pasos y listo.</p>
    <ol class="pasos">
      ${paso(1, 'Con cuánto empiezas', 'Tu saldo de hoy.', '<button class="mini" data-ir="ajustes">Ajustes</button>')}
      ${paso(2, 'Registra un movimiento', 'Un gasto o un ingreso.', '<button class="mini btn-primary" id="biRegistrar">Registrar</button>')}
      ${paso(3, 'Agrega lo que se repite', 'Arriendo, servicios, sueldo.', '<button class="mini" data-ir="recurrentes">Recurrentes</button>')}
    </ol>
  </section>`;
}

/* Tres cifras del mes y la puerta a los reportes completos. */
function resumenRapido(p, per) {
  const r = resumenReporte(p.movs, per, { ahorroId: idsAhorro(p.cats) });
  if (!r.gastos && !r.ingresos) return '';
  const dato = (rot, valor, nota) => `<div class="kpi-mini"><span class="stat-label">${rot}</span><b class="num">${valor}</b><span class="sub">${nota}</span></div>`;
  return `<section class="card resumen-rapido">
    <div class="card-head">${titulo('chispa', 'Cómo va el mes')}<a class="card-meta" href="#reportes">Ver reportes</a></div>
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
    root.innerHTML = `${saludoFila(p)}${selectorMes('Inicio')}${cabeceraMes(p, per)}${bienvenida()}`;
    enlazarMes(root, () => renderInicio(root));
    root.querySelector('#biRegistrar').onclick = () => abrirRegistro({ alGuardar: () => renderInicio(root) });
    root.querySelectorAll('[data-ir]').forEach((b) => {
      b.onclick = () => window.dispatchEvent(new CustomEvent('ir-a-vista', { detail: { route: b.dataset.ir } }));
    });
    return;
  }

  root.innerHTML = `
    ${saludoFila(p)}
    ${selectorMes('Inicio')}
    ${cabeceraMes(p, per)}
    ${avisoSugeridos(p)}
    ${ultimos(p, per)}
    ${proximos(p)}
    ${resumenRapido(p, per)}
    <div class="cols-2">
      <div class="stack">
        <section class="card">
          <div class="card-head">${titulo('categorias', 'Gasto por categoría')}</div>
          ${donutBloque(segmentos, 'Salió', { limite: 5 })}
        </section>
      </div>
      <div class="stack">
        <section class="card">
          <div class="card-head">${titulo('comparar', 'Entró y salió')}<span class="card-meta">Últimos 6 meses</span></div>
          <div class="graf" id="gBarras"></div>
          <div class="leyenda"><span><i class="dot" style="background:var(--pos-fill)"></i>Entró</span><span><i class="dot" style="background:var(--neg-fill)"></i>Salió</span></div>
        </section>
        <section class="card">
          <div class="card-head">${titulo('sube', 'Saldo cada mes')}</div>
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
