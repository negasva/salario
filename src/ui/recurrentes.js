import * as store from '../store.js';
import {
  estadoDelMes, abonar, pagarLoQueFalta, editarAbono, quitarAbono, notasUsadas, marcarTodos,
  nuevoRecurrente, resumen, fechaSugerida, pendientes, normalizarCuotas, numeroCuota, activoEn,
  estadoDeuda, mesFinal,
} from '../engine/recurrentes.js';
import { deTipo, nombreDe, colorDe, OTROS } from '../engine/categorias.js';
import { money, plain, esc, digits, fechaCorta, nombreMes } from '../format.js';
import { selectorMes, enlazarMes, mesElegido } from './mes.js';
import { abrirModal } from './modal.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

/* Lo que se repite todos los meses. Están todos siempre; lo que cambia es
   cuánto llevas pagado de cada uno este mes, de una vez o por partes. */

// Editor de la ficha: nombre, estimado, categoría, día y, si es una deuda, sus cuotas.
function editorFicha(rec, alGuardar) {
  const p = store.active();
  const nuevo = !rec;
  const r = rec || nuevoRecurrente({});
  const { cuerpo, cerrar } = abrirModal({ titulo: nuevo ? 'Nuevo recurrente' : 'Editar recurrente' });
  cuerpo.innerHTML = `
    <div class="chips chips-tipo" id="reTipo">
      <button class="chip chip-gasto" data-tipo="gasto">${icon('sale', 'ic-sm')}Gasto</button>
      <button class="chip chip-ingreso" data-tipo="ingreso">${icon('entra', 'ic-sm')}Ingreso</button>
    </div>
    <div class="fld"><label for="reNombre">Nombre</label>
      <input id="reNombre" value="${esc(r.n)}" placeholder="Ej: Arriendo, Internet" autocomplete="off"></div>
    <div class="fld"><label for="reMonto">Estimado al mes <span class="opcional">(opcional)</span></label>
      <input id="reMonto" class="num monto" inputmode="numeric" placeholder="0" value="${r.monto ? plain(r.monto) : ''}">
      <p class="sub">Es solo una referencia. Al marcarlo como pagado escribes lo que de verdad costó, y este número se queda igual. Déjalo vacío si nunca es el mismo.</p></div>
    <div class="fld" id="reCatWrap"><label for="reCat">Categoría</label>
      <select id="reCat">${deTipo(p.cats, 'gasto').map((c) => `<option value="${c.id}" ${(r.catId || OTROS) === c.id ? 'selected' : ''}>${esc(c.n)}</option>`).join('')}</select></div>
    <div class="fld"><label for="reDia">Día del mes</label>
      <input id="reDia" class="num" type="number" min="1" max="31" value="${r.dia || 1}"></div>
    <div class="fld cuotas-wrap" id="reCuotasWrap">
      <label class="check-chip"><input type="checkbox" id="reEsDeuda" ${r.cuotas ? 'checked' : ''}> Es una deuda en cuotas</label>
      <div class="cuotas-campos" id="reCuotasCampos">
        <div class="fld"><label for="reCuotas">Número de cuotas</label>
          <input id="reCuotas" class="num" type="number" min="1" max="600" inputmode="numeric" value="${r.cuotas?.total || ''}" placeholder="12"></div>
        <div class="fld"><label for="reDesde">Primera cuota</label>
          <input id="reDesde" type="month" value="${r.cuotas?.desde || mesElegido()}"></div>
        <p class="sub" id="reCuotasTxt"></p>
      </div>
    </div>
    <div id="reErr" class="auth-err"></div>
    <button class="wide btn-primary" id="reSave">Guardar</button>
    ${nuevo ? '' : '<button class="wide btn-borrar" id="reBorrar" style="margin-top:var(--space-2)">Borrar recurrente</button>'}`;

  const $ = (s) => cuerpo.querySelector(s);
  let tipo = r.tipo;
  const setTipo = (t) => {
    tipo = t;
    cuerpo.querySelectorAll('#reTipo .chip').forEach((b) => {
      b.classList.toggle('on', b.dataset.tipo === t);
      b.setAttribute('aria-pressed', String(b.dataset.tipo === t));
    });
    $('#reCatWrap').hidden = t === 'ingreso';
    $('#reCuotasWrap').hidden = t === 'ingreso';
  };
  // la cuenta de la deuda se ve mientras se escribe: 12 cuotas de 500.000 son 6.000.000
  const cuentaCuotas = () => {
    const deuda = $('#reEsDeuda').checked;
    $('#reCuotasCampos').hidden = !deuda;
    const n = Math.round(Number($('#reCuotas').value) || 0);
    const monto = Math.round(digits($('#reMonto').value));
    const desde = $('#reDesde').value;
    $('#reCuotasTxt').textContent = deuda && n > 0 && /^\d{4}-\d{2}$/.test(desde)
      ? `${monto ? `${n} cuotas de ${money(monto)} son ${money(n * monto)}. ` : ''}La última es en ${nombreMes(mesFinal({ cuotas: { total: n, desde } }))}.`
      : '';
  };
  ['#reEsDeuda', '#reCuotas', '#reDesde', '#reMonto'].forEach((sel) => $(sel).addEventListener('input', cuentaCuotas));
  const guardar = () => {
    const n = $('#reNombre').value.trim();
    if (!n) { $('#reErr').textContent = 'Escribe el nombre.'; return; }
    const cuotas = tipo === 'gasto' && $('#reEsDeuda').checked
      ? normalizarCuotas({ total: $('#reCuotas').value, desde: $('#reDesde').value }) : null;
    if (tipo === 'gasto' && $('#reEsDeuda').checked && !cuotas) {
      $('#reErr').textContent = 'Escribe cuántas cuotas son y el mes de la primera.'; return;
    }
    if (cuotas) r.cuotas = cuotas; else delete r.cuotas;
    Object.assign(r, {
      n,
      monto: Math.max(0, Math.round(digits($('#reMonto').value))),
      tipo,
      catId: tipo === 'ingreso' ? null : ($('#reCat').value || OTROS),
      dia: Math.min(31, Math.max(1, Number($('#reDia').value) || 1)),
    });
    if (nuevo) p.recurrentes.push(r);
    store.save();
    cerrar();
    alGuardar();
  };
  $('#reTipo').onclick = (e) => { const b = e.target.closest('.chip'); if (b) setTipo(b.dataset.tipo); };
  $('#reSave').onclick = guardar;
  $('#reBorrar')?.addEventListener('click', () => {
    const i = p.recurrentes.indexOf(r);
    if (i < 0) return;
    const deshacer = store.borrarConDeshacer(() => p.recurrentes.splice(i, 1), () => p.recurrentes.splice(i, 0, r));
    cerrar();
    alGuardar();
    toast(`${r.n} ya no se repite. Los movimientos que ya registraste quedan.`, () => { deshacer(); alGuardar(); });
  });
  cuerpo.onkeydown = (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardar(); } };
  setTipo(tipo);
  cuentaCuotas();
  $('#reNombre').focus();
}

/* La hoja de pagos de un recurrente en el mes: cuánto llevas, cuánto queda,
   cada pago con su nota, y el formulario para anotar otro. Se queda abierta
   al guardar, porque el mercado se paga de a poquitos. "Pagar todo" (o "lo
   que falta") lo resuelve de un toque para el que se paga de una vez. */
function hojaPagos(rec, per, alGuardar) {
  const p = store.active();
  const ingreso = rec.tipo === 'ingreso';
  const { cuerpo, cerrar } = abrirModal({ titulo: esc(rec.n) });
  let editando = null; // el pago que se está corrigiendo, o null para uno nuevo

  const pinta = () => {
    const e = estadoDelMes(rec, p.movs, per);
    const pct = rec.monto > 0 ? Math.min(100, Math.round((e.pagado / rec.monto) * 100)) : 0;
    const atajo = e.pagos.length ? 'Pagar lo que falta' : (ingreso ? 'Recibir todo' : 'Pagar todo');
    const notas = notasUsadas(rec, p.movs);

    cuerpo.innerHTML = `
      <section class="pg-resumen" aria-label="Cómo va ${esc(rec.n)} en ${nombreMes(per)}">
        <div class="pg-cifras">
          <span class="stat-label">${ingreso ? 'Recibido' : 'Llevas'} en ${nombreMes(per)}</span>
          <b class="num ${e.pasado ? 'neg' : ''}">${money(e.pagado)}</b>
          ${rec.monto ? `<span class="sub">de ${money(rec.monto)}</span>` : ''}
        </div>
        ${rec.monto ? `<span class="barra ${e.pasado ? 'barra-over' : ''}" role="progressbar" aria-label="Pagado del estimado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%;background:${e.pasado ? 'var(--neg-fill)' : 'var(--pos-fill)'}"></i></span>
        <p class="sub num">${e.pasado
    ? `<span class="neg">${icon('alerta', 'ic-sm')}Te pasaste ${money(e.pasado)}</span>`
    : e.queda ? `Quedan <b>${money(e.queda)}</b>` : `<span class="pos">${icon('check', 'ic-sm')}Completo</span>`}</p>`
    : `<p class="sub">Sin estimado: aquí se va sumando lo que ${ingreso ? 'recibas' : 'pagues'}.</p>`}
      </section>
      ${e.pagos.length ? `<h3 class="seccion-t pg-t">${e.pagos.length === 1 ? 'Un pago' : `${e.pagos.length} pagos`}</h3>
      <ul class="list pg-lista">${e.pagos.map((m) => `<li class="row row-link ${editando === m ? 'editando' : ''}">
          <button class="row-main" data-abono="${m.id}"><span class="sr-only">Corregir </span>
            <span class="row-txt"><span class="row-t">${esc(m.nota === rec.n ? 'Pago' : m.nota)}</span>
              <span class="row-s">${fechaCorta(m.fecha)}</span></span>
            <b class="num row-monto">${money(m.monto)}</b>
          </button>
          <button class="btn-icon btn-icon-danger" data-quitar="${m.id}" aria-label="Quitar pago de ${money(m.monto)}">${icon('basura')}</button>
        </li>`).join('')}</ul>` : ''}
      <div class="pg-form">
        <h3 class="seccion-t pg-t">${editando ? 'Corregir pago' : (e.pagos.length ? 'Otro pago' : (ingreso ? 'Anotar lo recibido' : 'Anotar un pago'))}</h3>
        ${!editando && e.queda > 0 ? `<button class="wide pg-todo ${e.pagos.length ? '' : 'btn-primary'}" id="pgTodo">${icon('check')}${atajo} · ${money(e.queda)}</button>
        <p class="pg-o">o escribe una parte</p>` : ''}
        <div class="fld"><label for="pgMonto">¿Cuánto?</label>
          <input id="pgMonto" class="num monto" inputmode="numeric" placeholder="${e.queda && !editando ? plain(e.queda) : '0'}" value="${editando ? plain(editando.monto) : ''}"></div>
        <div class="fld"><label for="pgNota">${ingreso ? 'De dónde' : 'Dónde o en qué'} <span class="opcional">(opcional)</span></label>
          <input id="pgNota" autocomplete="off" placeholder="${ingreso ? 'Ej: quincena' : 'Ej: Éxito, D1, domicilio'}" value="${editando && editando.nota !== rec.n ? esc(editando.nota) : ''}">
          ${notas.length ? `<div class="pg-notas" role="group" aria-label="Notas que ya usaste">${notas.map((n) => `<button type="button" class="mini" data-nota="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}</div>
        <div class="fld"><label for="pgFecha">Fecha</label>
          <input type="date" id="pgFecha" value="${editando ? editando.fecha : fechaSugerida(rec, per)}"></div>
        <div id="pgErr" class="auth-err"></div>
        <button class="wide ${!editando && e.queda > 0 && !e.pagos.length ? '' : 'btn-primary'}" id="pgSave">${editando ? 'Guardar cambios' : 'Anotar pago'}</button>
        ${editando ? '<button class="wide" id="pgCancelar">Cancelar</button>' : ''}
      </div>`;

    const $ = (sel) => cuerpo.querySelector(sel);
    const datos = () => ({ fecha: $('#pgFecha').value, nota: $('#pgNota').value });
    const listo = (msg, deshacer) => {
      store.save();
      alGuardar();
      if (msg) toast(msg, deshacer);
    };

    $('#pgTodo')?.addEventListener('click', () => {
      const mov = pagarLoQueFalta(rec, p.movs, per, datos());
      if (!mov) return;
      cerrar();
      listo(`${rec.n}: ${money(mov.monto)} en ${nombreMes(per)}.`, () => {
        quitarAbono(mov, p.movs);
        listo();
      });
    });
    const guardar = () => {
      const monto = Math.round(digits($('#pgMonto').value));
      if (monto <= 0) { $('#pgErr').textContent = 'Escribe cuánto fue.'; $('#pgMonto').focus(); return; }
      if (editando) {
        editarAbono(rec, editando, { monto, ...datos() });
        editando = null;
        listo('Pago corregido.');
      } else {
        abonar(rec, p.movs, per, monto, datos());
        const { queda } = estadoDelMes(rec, p.movs, per);
        listo(`${money(monto)} a ${rec.n}${rec.monto ? `. ${queda ? `Quedan ${money(queda)}` : 'Completo'}` : ''}.`);
      }
      pinta();
    };
    $('#pgSave').onclick = guardar;
    $('#pgCancelar')?.addEventListener('click', () => { editando = null; pinta(); });
    cuerpo.querySelectorAll('[data-nota]').forEach((b) => {
      b.onclick = () => { $('#pgNota').value = b.dataset.nota; $('#pgMonto').focus(); };
    });
    cuerpo.querySelectorAll('[data-abono]').forEach((b) => {
      b.onclick = () => { editando = e.pagos.find((m) => m.id === b.dataset.abono) || null; pinta(); };
    });
    cuerpo.querySelectorAll('[data-quitar]').forEach((b) => {
      b.onclick = () => {
        const mov = e.pagos.find((m) => m.id === b.dataset.quitar);
        if (!mov) return;
        const i = quitarAbono(mov, p.movs);
        if (editando === mov) editando = null;
        listo(`Pago de ${money(mov.monto)} quitado.`, () => {
          p.movs.splice(Math.min(i, p.movs.length), 0, mov);
          listo();
          if (cuerpo.isConnected) pinta();
        });
        pinta();
      };
    });
    cuerpo.onkeydown = (ev) => { if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') { ev.preventDefault(); guardar(); } };
    $('#pgMonto').focus();
  };
  pinta();
}

/* Las deudas: en qué cuota vas, cuánto llevas pagado de todo, cuánto falta y
   cuándo terminas. Aparecen todas, también las que no tocan este mes. */
function seccionDeudas(deudas, p, per) {
  const falta = deudas.reduce((t, r) => t + estadoDeuda(r, p.movs, per).falta, 0);
  return `<section class="seccion">
    <div class="seccion-head"><h2 class="seccion-t">Deudas</h2><span class="sub num">Te faltan <b>${money(falta)}</b></span></div>
    <ul class="list">${deudas.map((r) => {
    const d = estadoDeuda(r, p.movs, per);
    const pct = d.deuda ? Math.min(100, Math.round((d.pagado / d.deuda) * 100)) : 0;
    const cuando = {
      'por empezar': `Empieza en ${nombreMes(r.cuotas.desde)}`,
      'en curso': `Cuota ${d.cuota} de ${d.total} · termina en ${nombreMes(d.fin)}`,
      pagada: `Pagada · ${d.total} cuotas`,
      vencida: `Terminó en ${nombreMes(d.fin)} y quedó saldo`,
    }[d.estado];
    return `<li class="row row-link deuda ${d.estado === 'pagada' ? 'pagada' : ''}">
      <button class="row-main" data-deuda="${r.id}"><span class="sr-only">Editar </span>
        <span class="av" style="--c:${colorDe(p.cats, r.catId)}" aria-hidden="true">${icon('tarjeta', 'ic-sm')}</span>
        <span class="row-txt">
          <span class="row-top"><span class="row-t">${esc(r.n)}</span><span class="num row-monto">${d.falta ? `faltan ${money(d.falta)}` : icon('check', 'ic-sm')}</span></span>
          <span class="barra" aria-hidden="true"><i style="width:${pct}%;background:var(--pos-fill)"></i></span>
          <span class="row-s num"><span class="trozo">${cuando}</span>${d.deuda ? `<span class="trozo">· ${money(d.pagado)} de ${money(d.deuda)}</span>` : ''}</span>
        </span>
      </button>
    </li>`;
  }).join('')}</ul>
  </section>`;
}

export function renderRecurrentes(root) {
  const p = store.active();
  const per = mesElegido();
  const gastos = resumen(p.recurrentes, p.movs, per, 'gasto');
  const ingresos = resumen(p.recurrentes, p.movs, per, 'ingreso');
  const faltan = gastos.faltan + ingresos.faltan;
  const conEstimado = pendientes(p.recurrentes, p.movs, per).filter((r) => r.monto > 0).length;

  const fila = (r) => {
    const e = estadoDelMes(r, p.movs, per);
    const ingreso = r.tipo === 'ingreso';
    const partes = e.pagos.length > 1 ? ` · ${e.pagos.length} pagos` : '';
    let detalle;
    if (e.estado === 'pendiente') {
      detalle = `${r.monto ? `Estimado ${money(r.monto)}` : 'Sin estimado'} · día ${r.dia}`;
    } else if (e.estado === 'parcial') {
      detalle = `${money(e.pagado)} de ${money(r.monto)}${partes} · <b>quedan ${money(e.queda)}</b>`;
    } else if (e.pasado) {
      detalle = `<span class="neg">${money(e.pagado)} · te pasaste ${money(e.pasado)}</span>${partes}`;
    } else {
      const ultimo = e.pagos[e.pagos.length - 1];
      detalle = `${money(e.pagado)}${e.pagos.length > 1 ? partes : ` el ${fechaCorta(ultimo.fecha)}`}${r.monto && e.pagado !== r.monto ? ` · estimado ${money(r.monto)}` : ''}`;
    }
    if (r.cuotas) detalle = `Cuota ${numeroCuota(r, per)} de ${r.cuotas.total} · ${detalle}`;
    const pct = r.monto > 0 ? Math.min(100, Math.round((e.pagado / r.monto) * 100)) : 0;
    const boton = {
      pendiente: ['mini btn-primary', ingreso ? 'Recibir' : 'Pagar', `${ingreso ? 'Recibir' : 'Pagar'} ${esc(r.n)}`],
      parcial: ['mini', `${icon('mas', 'ic-sm')}Abonar`, `${esc(r.n)}: abonar, quedan ${money(e.queda)}`],
      pagado: ['mini pagado-btn', `${icon('check', 'ic-sm')}${ingreso ? 'Recibido' : 'Pagado'}`, `${esc(r.n)}: ${ingreso ? 'recibido' : 'pagado'}, ver pagos`],
    }[e.estado];
    return `<li class="row rec ${e.estado}" data-id="${r.id}">
      <span class="estado ${e.estado}" aria-hidden="true">${icon(e.estado)}</span>
      <div class="row-txt">
        <div class="row-t">${esc(r.n)}</div>
        <div class="row-s num"><span class="dot" style="background:${ingreso ? 'var(--pos-fill)' : colorDe(p.cats, r.catId)}"></span>${detalle}${ingreso ? ' · Ingreso' : nombreDe(p.cats, r.catId) === r.n ? '' : ` · ${esc(nombreDe(p.cats, r.catId))}`}</div>
        ${e.estado === 'parcial' || e.pasado ? `<span class="barra ${e.pasado ? 'barra-over' : ''}" aria-hidden="true"><i style="width:${pct}%;background:${e.pasado ? 'var(--neg-fill)' : 'var(--brand)'}"></i></span>` : ''}
      </div>
      <div class="row-acc">
        <button class="${boton[0]}" data-pago="${r.id}" aria-label="${boton[2]}">${boton[1]}</button>
        <button class="btn-icon" data-edit="${r.id}" aria-label="Editar ${esc(r.n)}">${icon('lapiz')}</button>
      </div>
    </li>`;
  };

  // una deuda solo aparece en los meses de sus cuotas
  const lista = (tipo) => p.recurrentes.filter((r) => r.tipo === tipo && activoEn(r, per));
  const total = gastos.total + ingresos.total;
  const marcados = total - faltan;
  const deudas = p.recurrentes.filter((r) => r.cuotas);

  root.innerHTML = `
    ${selectorMes('Recurrentes')}
    <section class="card resumen">
      <div class="stats">
        <div class="stat"><span class="stat-label">Pagado este mes</span><b class="num neg">${money(gastos.pagado)}</b></div>
        <div class="stat"><span class="stat-label">Estimado del mes</span><b class="num">${money(gastos.estimado)}</b></div>
        ${gastos.estimado ? `<div class="stat"><span class="stat-label">Queda por pagar</span><b class="num">${money(gastos.queda)}</b></div>` : ''}
        ${ingresos.total ? `<div class="stat"><span class="stat-label">Ingresos fijos recibidos</span><b class="num pos">${money(ingresos.pagado)}</b></div>
        <div class="stat"><span class="stat-label">Estimado de ingresos</span><b class="num">${money(ingresos.estimado)}</b></div>` : ''}
      </div>
      ${total ? `<div class="progreso">
        <div class="progreso-txt"><span>${faltan ? `Faltan <b>${faltan}</b> sin ningún pago` : 'Todos tienen al menos un pago este mes'}</span><span class="num">${marcados} de ${total}</span></div>
        <div class="barra" role="progressbar" aria-label="Recurrentes con algún pago" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${marcados}"><i style="width:${Math.round((marcados / total) * 100)}%"></i></div>
        ${conEstimado ? `<button class="mini" id="reTodos">${icon('check', 'ic-sm')}Pagar ${conEstimado} por su estimado</button>` : ''}
      </div>` : ''}
    </section>
    <div class="section-bar">
      <p class="sub">Cada uno guarda su nombre y su estimado. Págalo de una vez o por partes: el mercado en el Éxito, luego en el D1, y ves cuánto te queda.</p>
      <button class="btn-primary" id="reNuevo">${icon('mas')}Nuevo</button>
    </div>
    ${p.recurrentes.length ? `
      <section class="seccion">
        <h2 class="seccion-t">Gastos</h2>
        ${lista('gasto').length ? `<ul class="list">${lista('gasto').map(fila).join('')}</ul>` : '<div class="empty">Ninguno todavía.</div>'}
      </section>
      ${lista('ingreso').length ? `<section class="seccion">
        <h2 class="seccion-t">Ingresos</h2>
        <ul class="list">${lista('ingreso').map(fila).join('')}</ul>
      </section>` : ''}
      ${deudas.length ? seccionDeudas(deudas, p, per) : ''}`
    : `<div class="empty-state">
        <span class="empty-ic">${icon('recurrente')}</span>
        <b>Todavía no tienes recurrentes</b>
        <span class="sub">El arriendo, el internet, el sueldo: lo que se repite cada mes. Toca Nuevo para agregar el primero.</span>
      </div>`}`;

  const repintar = () => renderRecurrentes(root);
  enlazarMes(root, repintar);
  root.querySelector('#reNuevo').onclick = () => editorFicha(null, repintar);
  root.querySelectorAll('[data-pago]').forEach((b) => {
    b.onclick = () => hojaPagos(p.recurrentes.find((r) => r.id === b.dataset.pago), per, repintar);
  });
  root.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => editorFicha(p.recurrentes.find((r) => r.id === b.dataset.edit), repintar);
  });
  root.querySelectorAll('[data-deuda]').forEach((b) => {
    b.onclick = () => editorFicha(p.recurrentes.find((r) => r.id === b.dataset.deuda), repintar);
  });
  root.querySelector('#reTodos')?.addEventListener('click', () => {
    const nuevos = marcarTodos(p.recurrentes, p.movs, per);
    if (!nuevos.length) return;
    store.save();
    repintar();
    toast(`${nuevos.length} pagado${nuevos.length === 1 ? '' : 's'} por su estimado. Corrige el que no haya dado igual.`, () => {
      nuevos.forEach((m) => { const i = p.movs.indexOf(m); if (i >= 0) p.movs.splice(i, 1); });
      store.save();
      repintar();
    });
  });
}
