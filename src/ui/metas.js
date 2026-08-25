import * as store from '../store.js';
import { amount, freeFor, clamp, r2 } from '../engine/reparto.js';
import {
  monthlyToward, monthsToGoal, whenText, plazo, escalonActual,
  cuotaPorFecha, cuotaPorMeses, planRecorte, escenarios, costoOportunidad,
  conflictosDeMetas, secuenciaPlazos, aplicarRecorte,
} from '../engine/metas.js';
import { estadoDe, ordenadas, proyeccion } from '../engine/fila.js';
import { aportesAMeta, hoyISO } from '../engine/movimientos.js';
import { deudasDelPerfil, minimosCubiertos } from '../engine/deudas.js';
import { money, plain, esc, digits } from '../format.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

function id() { return Math.random().toString(36).slice(2, 9); }

const estadoFondo = (p) => store.ensureFondoGoal(p);

const escalonDe = (p) => escalonActual({
  minimosDeudaCubiertos: minimosCubiertos(deudasDelPerfil(p.items, p.movs),
    p.items.filter((it) => it.r === 'deu').reduce((t, it) => t + amount(it, store.incomeRepartir(p)), 0)),
  fondoEstado: estadoFondo(p).estado,
  tieneMetasActivas: p.goals.some((g) => !g.special && estadoDe(g) === 'activa'),
});

// Categorías pide abrir una meta; se guarda aquí y renderMetas la destapa
// al montar, así la hoja siempre vive dentro de su propia vista.
let pendiente = null;
export function abrirMeta(goalId) { pendiente = goalId; }

export function renderMetas(root) {
  const p = store.active();
  if (estadoFondo(p).creado) store.save();

  root.innerHTML = `
    <button id="metaAdd" class="wide btn-primary" style="margin-bottom:var(--sp-4)">+ Nueva meta</button>
    <div id="metaList" class="grid"></div>`;

  root.querySelector('#metaAdd').onclick = () => {
    const escalon = escalonDe(p);
    const g = { id: 'g' + id(), n: 'Nueva meta', t: 0, s: 0, a: {}, priority: 'media', modo: 'monto',
      base: 0, estado: 'activa', orden: p.goals.length + 1 };
    p.goals.push(g);
    store.save();
    openGoalSheet(root, g, escalon < 4);
  };

  paint(root);

  if (pendiente) {
    const g = p.goals.find((x) => x.id === pendiente);
    pendiente = null;
    if (g) openGoalSheet(root, g, false);
  }
}

function paint(root) {
  const p = store.active();
  const inc = store.incomeRepartir(p);
  const box = root.querySelector('#metaList');
  const conflictos = conflictosDeMetas(p.goals);
  const lista = ordenadas(p.goals);
  const proy = proyeccion(p.goals, p.items, inc);
  const movibles = lista.filter((g) => !g.special);

  box.innerHTML = lista.map((g) => {
    const est = estadoDe(g);
    const pct = g.t > 0 ? Math.round(clamp((g.s || 0) / g.t * 100, 0, 100)) : 0;
    const n = monthsToGoal(g, p.items, inc);
    const enConflicto = conflictos.some((c) => c.goals.includes(g));
    const i = movibles.indexOf(g);
    const arrastrable = !g.special && est !== 'completa';
    return `
    <div class="card goal ${g.special ? 'goal-esp' : ''} ${est === 'en_fila' ? 'goal-fila' : ''} ${est === 'completa' ? 'goal-hecha' : ''}"
      data-id="${g.id}" ${arrastrable ? 'draggable="true"' : ''}>
      <div class="goal-top">
        <div>
          <div class="goal-name">${esc(g.n)} ${g.special ? '<span class="badge warn">fondo</span>' : ''} ${badgeEstado(est)} <span class="badge ${g.priority === 'alta' ? 'bad' : g.priority === 'media' ? 'warn' : 'ok'}">${g.priority}</span></div>
          <div class="sub num">${money(g.t, p.cur)}</div>
        </div>
        <div class="goal-acts">
          ${arrastrable ? `<div class="goal-move">
            <button class="mini goal-up" title="Subir en la fila" aria-label="Subir ${esc(g.n)}" ${i <= 0 ? 'disabled' : ''}>${icon('flecha-arriba', 'ic-sm')}</button>
            <button class="mini goal-down" title="Bajar en la fila" aria-label="Bajar ${esc(g.n)}" ${i < 0 || i >= movibles.length - 1 ? 'disabled' : ''}>${icon('flecha-abajo', 'ic-sm')}</button>
          </div>` : ''}
          <button class="mini goal-edit">Editar</button>
        </div>
      </div>
      <div class="pbar"><i style="width:${pct}%"></i></div>
      <div class="sub">${textoPlazo(g, est, n, proy[g.id], p, inc)}</div>
      ${enConflicto ? '<div class="sub" style="color:var(--amber);margin-top:6px">Compite por bloque con otra meta. Ponla en fila y arranca cuando la otra termine.</div>' : ''}
    </div>`;
  }).join('');

  lista.forEach((g) => {
    const card = box.querySelector(`.goal[data-id="${g.id}"]`);
    if (!card) return;
    card.querySelector('.goal-edit')?.addEventListener('click', () => openGoalSheet(root, g, false));
    card.querySelector('.goal-up')?.addEventListener('click', () => { store.moverMeta(g.id, -1); paint(root); });
    card.querySelector('.goal-down')?.addEventListener('click', () => { store.moverMeta(g.id, 1); paint(root); });
  });

  cablearArrastre(root, box);
}

function badgeEstado(est) {
  if (est === 'en_fila') return '<span class="badge">en fila</span>';
  if (est === 'completa') return '<span class="badge ok">completa</span>';
  return '';
}

// La meta en fila no dice un plazo suyo: dice cuándo le toca el turno.
function textoPlazo(g, est, n, pr, p, inc) {
  if (est === 'completa') return `Terminaste esta meta con ${money(g.s || 0, p.cur)}. Su bloque quedó libre.`;
  if (est === 'en_fila') {
    const antes = pr?.predecesor;
    const cuando = pr && pr.empieza !== null ? `, hacia ${whenText(pr.empieza)}` : '';
    return antes
      ? `Empieza cuando termines la meta ${esc(antes.n)}${cuando}.`
      : 'En fila. Empieza cuando la pongas activa.';
  }
  return n
    ? `Llevas ${money(g.s || 0, p.cur)}. Guardas <b class="num">${money(monthlyToward(g, p.items, inc), p.cur)}</b> al mes, la tienes en ${plazo(n)}, hacia ${whenText(n)}.`
    : `Llevas ${money(g.s || 0, p.cur)}. Sin aporte mensual todavía.`;
}

/* Arrastrar para reordenar con lo que trae el navegador. El fondo de
   emergencia no es arrastrable ni recibe: vive en el primer puesto. */
function cablearArrastre(root, box) {
  let origen = null;
  box.querySelectorAll('.goal[draggable=true]').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      origen = card.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', origen);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      origen = null;
      box.querySelectorAll('.goal').forEach((c) => c.classList.remove('dragging', 'drag-over'));
    });
    card.addEventListener('dragover', (e) => {
      if (!origen || origen === card.dataset.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      const id = origen || e.dataTransfer.getData('text/plain');
      card.classList.remove('drag-over');
      if (id && store.soltarMeta(id, card.dataset.id)) paint(root);
    });
  });
}

function openGoalSheet(root, g, warnEscalon) {
  const p = store.active();
  const inc = store.incomeRepartir(p);
  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  function close() {
    // 0.12 — una meta nueva que nunca se llenó no debe quedar en la lista
    const idx = p.goals.indexOf(g);
    if (idx >= 0 && !g.special && g.n === 'Nueva meta' && !g.t) { p.goals.splice(idx, 1); store.save(); }
    overlay.remove();
    document.body.style.overflow = '';
    paint(root);
  }

  function paintSheet() {
    const conflictos = conflictosDeMetas(p.goals).find((c) => c.goals.includes(g));
    const m = monthlyToward(g, p.items, inc);
    const co = costoOportunidad(m * 12, p.tasaInteres);

    overlay.innerHTML = `
      <div class="sheet">
        <div class="sheet-head"><h3>Meta de ahorro</h3><button class="btn-del" id="gClose">${icon('cerrar')}</button></div>
        ${warnEscalon ? `<div class="sub" style="color:var(--amber);margin-bottom:12px">Estás en el escalón ${escalonDe(p)}, esta meta es del escalón 4.</div>` : ''}
        <div class="fld"><label>Qué quieres comprar</label><input id="gName" value="${esc(g.n)}" ${g.special ? 'disabled' : ''}></div>
        <div class="fld"><label>Cuánto cuesta</label><input id="gCost" value="${plain(g.t, p.cur)}" inputmode="numeric"></div>
        <div class="fld"><label>Cuánto llevas ahorrado</label><input id="gSaved" value="${plain(g.s, p.cur)}" inputmode="numeric">
          <div class="hint">Los aportes registrados suman ${money(aportesAMeta(p.movs, g.id).total, p.cur)}. Si escribes otro total, la diferencia queda como lo que ya tenías antes.</div>
        </div>
        <div class="fld"><label>Estado en la fila</label>
          <div class="chips">
            <button class="chip ${estadoDe(g) === 'activa' ? 'on' : ''}" data-estado="activa">Activa</button>
            <button class="chip ${estadoDe(g) === 'en_fila' ? 'on' : ''}" data-estado="en_fila">En fila</button>
          </div>
          <div class="hint">${estadoDe(g) === 'en_fila'
            ? 'En fila no consume nada de tus bloques. Su reparto se guarda y arranca cuando termine la meta de adelante.'
            : 'Activa reclama su porcentaje de los bloques cada mes.'}</div>
        </div>
        <div class="fld"><label>Prioridad</label>
          <select id="gPriority">
            ${['alta', 'media', 'baja'].map((v) => `<option value="${v}" ${g.priority === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="fld"><label>Aporte de hoy</label>
          <div style="display:flex;gap:8px">
            <input id="gAporte" placeholder="0" inputmode="numeric" style="flex:1">
            <button id="gAporteBtn" class="mini">Aplicar</button>
          </div>
          ${(() => {
            const ap = p.movs.filter((m) => m.goalId === g.id).slice(-5).reverse();
            return ap.length ? `<div class="sub" style="margin-top:6px">${ap.map((m) => `${money(m.monto, p.cur)} · ${m.fecha}`).join('<br>')}</div>` : '';
          })()}
        </div>

        <div class="label" style="margin-bottom:8px">Cómo quieres calcularla</div>
        <div class="chips" style="margin-bottom:12px">
          <button class="chip ${g.modo === 'monto' ? 'on' : ''}" data-modo="monto">Por monto</button>
          <button class="chip ${g.modo === 'meses' ? 'on' : ''}" data-modo="meses">En N meses</button>
          <button class="chip ${g.modo === 'fecha' ? 'on' : ''}" data-modo="fecha">Para una fecha</button>
        </div>
        ${g.modo === 'meses' ? `<div class="fld"><label>¿En cuántos meses la quieres?</label>
          <input type="number" id="gMeses" min="1" max="600" inputmode="numeric"
            placeholder="12" value="${g.plazoMeses || ''}"></div>` : ''}
        ${g.modo === 'fecha' ? `<div class="fld"><label>Fecha objetivo</label>
          <input type="date" id="gDate" value="${g.dueDate || ''}"></div>` : ''}
        ${g.modo !== 'monto' ? '<div id="gCuota" class="sub"></div>' : ''}

        ${conflictos ? (() => {
          const { paralelo, secuencia } = secuenciaPlazos(conflictos.goals, p.items, inc);
          return `<div class="sub" style="color:var(--amber);margin-bottom:12px">Esta meta compite por el mismo bloque con ${conflictos.goals.length - 1} otra(s).
          En paralelo: ${paralelo.map((m) => m ? plazo(m) : 'sin aporte').join(' / ')}.
          En secuencia (por prioridad): ${secuencia.join(' → ')} meses.</div>`;
        })() : ''}

        <div class="label" style="margin:14px 0 8px">Rutas sugeridas</div>
        <div id="gOpts"></div>
        <div class="divider"></div>
        <div class="label" style="margin-bottom:8px">O ajústalo bloque por bloque</div>
        <div id="gAlloc"></div>

        <details style="margin-top:14px">
          <summary class="label">Costo de oportunidad</summary>
          <div class="sub" style="margin-top:8px">Ese dinero, invertido al ${p.tasaInteres}% anual, sería ${money(co.vf5, p.cur)} en 5 años y ${money(co.vf10, p.cur)} en 10.</div>
        </details>

        <div id="gPlan"></div>

        <button class="wide btn-primary" id="gDone" style="margin-top:16px">Listo</button>
        ${!g.special ? `<button class="wide" id="gDel" style="margin-top:8px">Eliminar esta meta</button>` : ''}
      </div>`;

    overlay.querySelector('#gClose').onclick = close;
    overlay.querySelector('#gDone').onclick = close;
    overlay.querySelector('#gName').oninput = (e) => { g.n = e.target.value; store.save(); };
    overlay.querySelector('#gCost').onchange = (e) => { g.t = digits(e.target.value); g.manual = true; store.save(); paintSheet(); };
    overlay.querySelector('#gSaved').onchange = (e) => {
      g.base = Math.max(0, digits(e.target.value) - aportesAMeta(p.movs, g.id).total);
      store.save();
      paintSheet();
    };
    overlay.querySelector('#gPriority').onchange = (e) => { g.priority = e.target.value; store.save(); };

    overlay.querySelectorAll('.chip[data-estado]').forEach((b) => {
      b.onclick = () => { store.cambiarEstadoMeta(g, b.dataset.estado); paintSheet(); };
    });

    // un aporte es un movimiento del libro: una sola puerta, un solo número
    overlay.querySelector('#gAporteBtn').onclick = () => {
      const monto = digits(overlay.querySelector('#gAporte').value);
      if (monto <= 0) return;
      p.movs.push({ id: 'm' + Math.random().toString(36).slice(2, 9), fecha: hoyISO(),
        tipo: 'gasto', monto, itemId: null, lineId: null, goalId: g.id,
        nota: `Aporte a ${g.n}`, extra: false });
      store.save();
      toast(`Aporte de ${money(monto, p.cur)} registrado`);
      paintSheet();
    };

    overlay.querySelectorAll('.chip[data-modo]').forEach((b) => {
      b.onclick = () => { g.modo = b.dataset.modo; store.save(); paintSheet(); };
    });

    // los dos modos con plazo comparten el mismo calculo: faltante / meses
    const cuotaBox = overlay.querySelector('#gCuota');
    const mesesInput = overlay.querySelector('#gMeses');
    const dateInput = overlay.querySelector('#gDate');

    function paintCuota() {
      if (!cuotaBox) return;
      const r = g.modo === 'meses'
        ? (g.plazoMeses > 0 ? cuotaPorMeses(g.t, g.s, g.plazoMeses) : null)
        : (g.dueDate ? cuotaPorFecha(g.t, g.s, new Date(g.dueDate)) : null);

      if (!r) {
        cuotaBox.innerHTML = g.modo === 'meses'
          ? 'Escribe en cuántos meses la quieres y te digo cuánto guardar al mes.'
          : 'Elige la fecha y te digo cuánto guardar al mes.';
        paintPlan(0);
        return;
      }
      if (r.meses <= 0) {
        cuotaBox.innerHTML = `Ese plazo ya pasó. Te faltan <b class="num">${money(r.cuota, p.cur)}</b> de una vez.`;
        paintPlan(0);
        return;
      }

      const falta = Math.max(0, (g.t || 0) - (g.s || 0));
      const disp = monthlyToward(g, p.items, inc);
      const brecha = r.cuota - disp;
      cuotaBox.innerHTML = `
        Te faltan ${money(falta, p.cur)}. En ${plazo(r.meses)} son
        <b class="num">${money(r.cuota, p.cur)}</b> al mes, hacia ${whenText(r.meses)}.<br>
        ${brecha <= 0
          ? `Hoy destinas ${money(disp, p.cur)}: ya te alcanza.`
          : `Hoy destinas ${money(disp, p.cur)}, te falta reunir <b class="num">${money(brecha, p.cur)}</b> más al mes.`}`;
      paintPlan(brecha);
    }

    if (mesesInput) {
      mesesInput.oninput = () => {
        g.plazoMeses = Math.max(0, Math.floor(Number(mesesInput.value)) || 0);
        store.save();
        paintCuota();
      };
    }
    if (dateInput) {
      dateInput.oninput = () => { g.dueDate = dateInput.value; store.save(); paintCuota(); };
    }
    if (g.modo === 'monto') overlay.querySelector('#gPlan').innerHTML = '';
    else paintCuota();

    function paintPlan(faltante) {
      const planBox = overlay.querySelector('#gPlan');
      if (!faltante || faltante <= 0) { planBox.innerHTML = ''; return; }
      const ef = estadoFondo(p);
      const recortes = planRecorte(faltante, { items: p.items, income: inc, fondoCompleto: ef.estado === 'completo' });
      let cubierto = 0;
      planBox.innerHTML = `
        <div class="label" style="margin:14px 0 8px">Plan de recorte</div>
        <div class="sub" id="gPlanCounter">Faltan ${money(faltante, p.cur)}</div>
        <div id="gPlanCards"></div>`;
      const cardsBox = planBox.querySelector('#gPlanCards');
      if (!recortes.length) {
        cardsBox.innerHTML = '<div class="empty">No hay más de dónde recortar sin tocar lo intocable.</div>';
      }
      recortes.forEach((r) => {
        const el = document.createElement('div');
        el.className = 'card-2';
        el.style.padding = '10px';
        el.style.marginTop = '8px';
        el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <div><b>${r.bloque}</b><div class="sub">${r.costo}</div></div>
          <div style="text-align:right"><div class="num" style="font-weight:700">${money(r.monto, p.cur)}</div>
          <button class="mini" style="margin-top:4px">Aplicar</button></div></div>`;
        // aplicar mueve los porcentajes de verdad; un botón que solo opaca una
        // tarjeta es peor que no tener botón
        el.querySelector('button').onclick = () => {
          if (!aplicarRecorte(r, p.items, inc, g)) {
            toast('Ese recorte no tiene de dónde salir');
            return;
          }
          store.save();
          cubierto += r.monto;
          const restante = Math.max(0, faltante - cubierto);
          toast(restante > 0
            ? `Listo. ${money(r.monto, p.cur)} más al mes hacia ${g.n}.`
            : `Cubierto: ya sale la cuota de ${g.n}.`);
          paintSheet();
        };
        cardsBox.appendChild(el);
      });

      // F7 — tres escenarios comparables
      const disp = monthlyToward(g, p.items, inc);
      const escBox = document.createElement('div');
      escBox.className = 'grid';
      escBox.style.marginTop = '14px';
      escenarios(g.s, g.t, disp, recortes).forEach((e) => {
        const el = document.createElement('div');
        el.className = 'card-2';
        el.style.padding = '10px';
        el.innerHTML = `<b style="text-transform:capitalize">${e.nombre}</b>
          <div class="sub num" style="margin-top:4px">${money(e.cuota, p.cur)} al mes</div>
          <div class="sub" style="margin-top:4px">${e.meses ? `${plazo(e.meses)}, hacia ${e.fecha}` : 'no alcanza'}</div>
          <div class="sub" style="margin-top:4px">Sacrificas: ${e.sacrificio}</div>`;
        escBox.appendChild(el);
      });
      planBox.appendChild(escBox);
    }

    function paintOpts() {
      const box = overlay.querySelector('#gOpts');
      const presets = [
        { title: 'Con tus ahorros', desc: 'Todo el largo plazo y la mitad del corto.', map: { lar: 100, cor: 50 } },
        { title: 'Sin tocar la inversión', desc: 'Todo el ahorro corto más el gasto libre.', map: { cor: 100, lib: 100 } },
        { title: 'Acelerado', desc: 'Corto, largo y gasto libre completos.', map: { cor: 100, lar: 100, lib: 100 } },
      ];
      box.innerHTML = presets.map((pr) => {
        let m = 0;
        p.items.forEach((it) => { if (it.r && pr.map[it.r] !== undefined) m += amount(it, inc) * Math.min(pr.map[it.r], freeFor(p.goals, g, it.id)) / 100; });
        const f = Math.max(0, (g.t || 0) - (g.s || 0));
        const n = m > 0 ? Math.ceil(f / m) : null;
        return `<div class="opt" data-t="${pr.title}"><b>${pr.title}</b><p>${pr.desc}</p>
          <div class="r"><span class="num">${money(m, p.cur)} al mes</span><span class="num" style="color:var(--text);font-weight:800">${n ? plazo(n) : 'sin aporte'}</span></div></div>`;
      }).join('');
      box.querySelectorAll('.opt').forEach((el, i) => {
        el.onclick = () => {
          const pr = presets[i];
          p.items.forEach((it) => { g.a[it.id] = it.r && pr.map[it.r] !== undefined ? r2(Math.min(pr.map[it.r], freeFor(p.goals, g, it.id))) : 0; });
          store.save();
          paintAlloc();
        };
      });
    }

    function paintAlloc() {
      const box = overlay.querySelector('#gAlloc');
      box.innerHTML = p.items.map((it) => {
        const free = freeFor(p.goals, g, it.id);
        const v = g.a[it.id] || 0;
        return `<div class="alloc" data-id="${it.id}">
          <div class="alloc-head"><span>${esc(it.n)}</span><span class="num alloc-amt">${money(amount(it, inc) * v / 100, p.cur)}</span></div>
          <input type="range" min="0" max="${free}" step="1" value="${v}">
          ${free < 100 ? `<div class="hint">Otras metas ya usan ${r2(100 - free)}% de este bloque. Tope aquí: ${r2(free)}%.</div>` : ''}
        </div>`;
      }).join('');
      box.querySelectorAll('.alloc').forEach((el) => {
        const itemId = el.dataset.id;
        const it = p.items.find((x) => x.id === itemId);
        const amtEl = el.querySelector('.alloc-amt');
        // el arrastre solo actualiza el monto mostrado, sin re-render en cada tick
        el.querySelector('input').oninput = (e) => {
          const v = r2(clamp(Number(e.target.value), 0, freeFor(p.goals, g, itemId)));
          amtEl.textContent = money(amount(it, inc) * v / 100, p.cur);
        };
        el.querySelector('input').onchange = (e) => {
          g.a[itemId] = r2(clamp(Number(e.target.value), 0, freeFor(p.goals, g, itemId)));
          store.save();
          paintAlloc();
        };
      });
    }

    paintOpts();
    paintAlloc();

    if (!g.special) {
      overlay.querySelector('#gDel').onclick = () => {
        const idx = p.goals.indexOf(g);
        const { undo } = store.stageDelete(() => p.goals.splice(idx, 1), () => p.goals.splice(idx, 0, g));
        close();
        toast('Meta eliminada', () => { undo(); paint(root); });
      };
    }
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  paintSheet();
}
