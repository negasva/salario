import * as store from '../store.js';
import { amount, clamp } from '../engine/reparto.js';
import {
  monthlyToward, monthsToGoal, whenText, plazo, escalonActual, cuotaPorMeses, cuotaPorFecha,
} from '../engine/metas.js';
import { estadoDe, ordenadas } from '../engine/fila.js';
import { aportesAMeta, hoyISO } from '../engine/movimientos.js';
import { deudasDelPerfil, minimosCubiertos } from '../engine/deudas.js';
import { money, plain, esc, digits } from '../format.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

/* F5 — metas simples. Una meta es un nombre, un costo, lo que llevas y cuánto
   guardas al mes; con eso la app dice cuántos meses faltan. Se acabaron el
   estado "en fila", el aporte de hoy, el reparto por bloque y el costo de
   oportunidad: cada meta es su propio bloque dentro de Categorías. */

function id() { return Math.random().toString(36).slice(2, 9); }

const estadoFondo = (p) => store.ensureFondoGoal(p);

const escalonDe = (p) => escalonActual({
  minimosDeudaCubiertos: minimosCubiertos(deudasDelPerfil(p.items, p.movs),
    p.items.filter((it) => it.r === 'deu').reduce((t, it) => t + amount(it), 0)),
  fondoEstado: estadoFondo(p).estado,
  tieneMetasActivas: p.goals.some((g) => !g.special && estadoDe(g) === 'activa'),
});

// Categorías pide abrir una meta; se guarda aquí y renderMetas la destapa al montar
let pendiente = null;
export function abrirMeta(goalId) { pendiente = goalId; }

export function renderMetas(root, args = {}) {
  const p = store.active();
  if (estadoFondo(p).creado) store.save();

  root.innerHTML = `
    <button id="metaAdd" class="wide btn-primary" style="margin-bottom:var(--sp-4)">+ Nueva meta</button>
    <div id="metaList" class="grid"></div>`;

  root.querySelector('#metaAdd').onclick = () => abrirPasoAPaso(root);

  paint(root);

  if (args.nueva) { abrirPasoAPaso(root); return; }

  if (pendiente) {
    const g = p.goals.find((x) => x.id === pendiente);
    pendiente = null;
    if (g) openGoalSheet(root, g);
  }
}

function paint(root) {
  const p = store.active();
  const box = root.querySelector('#metaList');
  const lista = ordenadas(p.goals);
  const movibles = lista.filter((g) => !g.special);

  box.innerHTML = lista.map((g) => {
    const est = estadoDe(g);
    const pct = g.t > 0 ? Math.round(clamp((g.s || 0) / g.t * 100, 0, 100)) : 0;
    const n = monthsToGoal(g);
    const i = movibles.indexOf(g);
    const arrastrable = !g.special && est !== 'completa';
    return `
    <div class="card goal ${g.special ? 'goal-esp' : ''} ${est === 'completa' ? 'goal-hecha' : ''}"
      data-id="${g.id}" ${arrastrable ? 'draggable="true"' : ''}>
      <div class="goal-top">
        <div>
          <div class="goal-name">${esc(g.n)} ${g.special ? '<span class="badge warn">fondo</span>' : ''} ${est === 'completa' ? '<span class="badge ok">completa</span>' : ''}</div>
          <div class="sub num">${money(g.t, p.cur)}</div>
        </div>
        <div class="goal-acts">
          ${arrastrable ? `<div class="goal-move">
            <button class="mini goal-up" title="Subir" aria-label="Subir ${esc(g.n)}" ${i <= 0 ? 'disabled' : ''}>${icon('flecha-arriba', 'ic-sm')}</button>
            <button class="mini goal-down" title="Bajar" aria-label="Bajar ${esc(g.n)}" ${i < 0 || i >= movibles.length - 1 ? 'disabled' : ''}>${icon('flecha-abajo', 'ic-sm')}</button>
          </div>` : ''}
          <button class="mini goal-edit">Editar</button>
        </div>
      </div>
      <div class="pbar"><i style="width:${pct}%"></i></div>
      <div class="sub">${textoPlazo(g, est, n, p)}</div>
    </div>`;
  }).join('');

  lista.forEach((g) => {
    const card = box.querySelector(`.goal[data-id="${g.id}"]`);
    if (!card) return;
    card.querySelector('.goal-edit')?.addEventListener('click', () => openGoalSheet(root, g));
    card.querySelector('.goal-up')?.addEventListener('click', () => { store.moverMeta(g.id, -1); paint(root); });
    card.querySelector('.goal-down')?.addEventListener('click', () => { store.moverMeta(g.id, 1); paint(root); });
  });

  cablearArrastre(root, box);
}

function textoPlazo(g, est, n, p) {
  if (est === 'completa') return `Terminaste esta meta con ${money(g.s || 0, p.cur)}.`;
  return n
    ? `Llevas ${money(g.s || 0, p.cur)}. Guardas <b class="num">${money(monthlyToward(g), p.cur)}</b> al mes, la tienes en ${plazo(n)}, hacia ${whenText(n)}.`
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
      const idSoltado = origen || e.dataTransfer.getData('text/plain');
      card.classList.remove('drag-over');
      if (idSoltado && store.soltarMeta(idSoltado, card.dataset.id)) paint(root);
    });
  });
}

/* Paso a paso de creación: tres preguntas, una por pantalla. La tercera es la
   única que importa —cuánto guardas al mes— y contesta con el plazo. */
function abrirPasoAPaso(root) {
  const p = store.active();
  const d = { n: '', t: 0, mes: 0 };
  let paso = 0;

  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const cerrar = () => { overlay.remove(); document.body.style.overflow = ''; paint(root); };

  const pintar = () => {
    const meses = d.mes > 0 ? Math.ceil(d.t / d.mes) : null;
    const pasos = [
      { titulo: '¿Qué quieres comprar?', ayuda: 'Ponle el nombre con el que la reconoces.',
        campo: `<input id="mpV" autocomplete="off" placeholder="Moto" value="${esc(d.n)}">`, boton: 'Siguiente' },
      { titulo: '¿Cuánto cuesta?', ayuda: 'El precio completo, aunque hoy no lo tengas.',
        campo: `<input id="mpV" class="num" inputmode="numeric" placeholder="24.000.000" value="${d.t ? plain(d.t, p.cur) : ''}">`, boton: 'Siguiente' },
      { titulo: '¿Cuánto vas a guardar al mes?', ayuda: 'Escribe la cifra exacta y te digo cuánto tardas.',
        campo: `<input id="mpV" class="num" inputmode="numeric" placeholder="500.000" value="${d.mes ? plain(d.mes, p.cur) : ''}">`, boton: 'Crear meta' },
    ];
    const s = pasos[paso];
    overlay.innerHTML = `
      <div class="sheet ob-sheet">
        <div class="ob-pasos" aria-label="Paso ${paso + 1} de 3">${pasos.map((_, i) => `<i class="${i <= paso ? 'on' : ''}"></i>`).join('')}</div>
        <div class="sheet-head"><h3>${esc(s.titulo)}</h3></div>
        <p class="sub">${esc(s.ayuda)}</p>
        <div class="fld" style="margin-top:var(--space-4)">${s.campo}</div>
        <div class="sub" id="mpPlazo">${paso === 2 && meses ? `Con ${money(d.mes, p.cur)} al mes la tienes en <b>${plazo(meses)}</b>, hacia ${whenText(meses)}.` : ''}</div>
        <div id="mpErr" class="auth-err"></div>
        <button class="wide btn-primary" id="mpNext" style="margin-top:var(--space-4)">${esc(s.boton)}</button>
        <div class="prow">
          ${paso > 0 ? '<button id="mpBack">Atrás</button>' : ''}
          <button id="mpCancel">Cancelar</button>
        </div>
      </div>`;

    const input = overlay.querySelector('#mpV');
    const err = overlay.querySelector('#mpErr');
    const seguir = () => {
      if (paso === 0) {
        d.n = input.value.trim();
        if (!d.n) { err.textContent = 'Ponle un nombre.'; return; }
      } else if (paso === 1) {
        d.t = digits(input.value);
        if (d.t <= 0) { err.textContent = 'Escribe cuánto cuesta.'; return; }
      } else {
        d.mes = digits(input.value);
        const g = { id: 'g' + id(), n: d.n, t: d.t, s: 0, mes: d.mes, base: 0,
          modo: 'monto', estado: 'activa', orden: p.goals.length + 1 };
        p.goals.push(g);
        store.save();
        cerrar();
        if (escalonDe(p) < 4) toast('Ojo: todavía te falta fondo de emergencia o mínimos de deuda.');
        return;
      }
      paso += 1;
      pintar();
    };
    overlay.querySelector('#mpNext').onclick = seguir;
    overlay.querySelector('#mpCancel').onclick = cerrar;
    overlay.querySelector('#mpBack')?.addEventListener('click', () => { paso -= 1; pintar(); });
    // el plazo se ve mientras escribes, no después de guardar
    if (paso === 2) {
      const plazoBox = overlay.querySelector('#mpPlazo');
      input.oninput = () => {
        d.mes = digits(input.value);
        const n = d.mes > 0 ? Math.ceil(d.t / d.mes) : null;
        plazoBox.innerHTML = n
          ? `Con ${money(d.mes, p.cur)} al mes la tienes en <b>${plazo(n)}</b>, hacia ${whenText(n)}.`
          : '';
      };
    }
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); seguir(); } };
    input.focus();
  };

  pintar();
}

function openGoalSheet(root, g) {
  const p = store.active();
  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  function close() {
    overlay.remove();
    document.body.style.overflow = '';
    paint(root);
  }

  function paintSheet() {
    const n = monthsToGoal(g);
    const falta = Math.max(0, (g.t || 0) - (g.s || 0));

    overlay.innerHTML = `
      <div class="sheet">
        <div class="sheet-head"><h3>Meta de ahorro</h3><button class="btn-del" id="gClose">${icon('cerrar')}</button></div>
        <div class="fld"><label>Qué quieres comprar</label><input id="gName" value="${esc(g.n)}" ${g.special ? 'disabled' : ''}></div>
        <div class="fld"><label>Cuánto cuesta</label><input id="gCost" value="${plain(g.t, p.cur)}" inputmode="numeric"></div>
        <div class="fld"><label>Cuánto llevas ahorrado</label><input id="gSaved" value="${plain(g.s, p.cur)}" inputmode="numeric">
          <div class="hint">Los aportes registrados suman ${money(aportesAMeta(p.movs, g.id).total, p.cur)}; si escribes más, la diferencia queda como lo que ya tenías desde antes.</div>
        </div>
        <div class="fld"><label>Cuánto guardas al mes</label><input id="gMes" value="${g.mes ? plain(g.mes, p.cur) : ''}" inputmode="numeric" placeholder="0">
          <div class="hint" id="gPlazo"></div>
        </div>

        <div class="label" style="margin-bottom:8px">Cómo quieres calcularla</div>
        <div class="chips" style="margin-bottom:12px">
          <button class="chip ${g.modo === 'monto' ? 'on' : ''}" data-modo="monto">Por monto</button>
          <button class="chip ${g.modo === 'meses' ? 'on' : ''}" data-modo="meses">En N meses</button>
          <button class="chip ${g.modo === 'fecha' ? 'on' : ''}" data-modo="fecha">Para una fecha</button>
        </div>
        ${g.modo === 'meses' ? `<div class="fld"><label>¿En cuántos meses la quieres?</label>
          <input type="number" id="gMeses" min="1" max="600" placeholder="12" value="${g.plazoMeses || ''}"></div>` : ''}
        ${g.modo === 'fecha' ? `<div class="fld"><label>Fecha objetivo</label>
          <input type="date" id="gDate" value="${g.dueDate || ''}"></div>` : ''}
        ${g.modo !== 'monto' ? '<div id="gCuota" class="sub"></div>' : ''}

        <div class="fld" style="margin-top:var(--space-4)"><label>Registrar lo que ya guardaste</label>
          <div style="display:flex;gap:8px">
            <input id="gAporte" placeholder="0" inputmode="numeric" style="flex:1">
            <button id="gAporteBtn" class="mini">Guardar aporte</button>
          </div>
        </div>

        <button class="wide btn-primary" id="gDone" style="margin-top:16px">Listo</button>
        ${!g.special ? '<button class="wide" id="gDel" style="margin-top:8px">Eliminar esta meta</button>' : ''}
      </div>`;

    const plazoBox = overlay.querySelector('#gPlazo');
    plazoBox.innerHTML = n
      ? `Te faltan ${money(falta, p.cur)}: la tienes en <b>${plazo(n)}</b>, hacia ${whenText(n)}.`
      : 'Escribe cuánto guardas al mes y te digo cuántos meses tardas.';

    overlay.querySelector('#gClose').onclick = close;
    overlay.querySelector('#gDone').onclick = close;
    overlay.querySelector('#gName').oninput = (e) => { g.n = e.target.value; store.save(); };
    overlay.querySelector('#gCost').onchange = (e) => { g.t = digits(e.target.value); g.manual = true; store.save(); paintSheet(); };
    overlay.querySelector('#gSaved').onchange = (e) => {
      g.base = Math.max(0, digits(e.target.value) - aportesAMeta(p.movs, g.id).total);
      store.save();
      paintSheet();
    };
    overlay.querySelector('#gMes').onchange = (e) => { g.mes = digits(e.target.value); store.save(); paintSheet(); };

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
        return;
      }
      if (r.meses <= 0) {
        cuotaBox.innerHTML = `Ese plazo ya pasó. Te faltan <b class="num">${money(r.cuota, p.cur)}</b> de una vez.`;
        return;
      }
      const brecha = r.cuota - monthlyToward(g);
      cuotaBox.innerHTML = `En ${plazo(r.meses)} son <b class="num">${money(r.cuota, p.cur)}</b> al mes, hacia ${whenText(r.meses)}.
        ${brecha <= 0 ? 'Con lo que guardas hoy te alcanza.' : `Te falta subir <b class="num">${money(brecha, p.cur)}</b> al mes.`}
        <button class="mini" id="gAdoptar" style="margin-top:6px">Guardar esa cuota al mes</button>`;
      cuotaBox.querySelector('#gAdoptar').onclick = () => {
        g.mes = Math.round(r.cuota);
        store.save();
        paintSheet();
      };
    }

    if (mesesInput) mesesInput.oninput = () => { g.plazoMeses = Math.max(0, Math.floor(Number(mesesInput.value)) || 0); store.save(); paintCuota(); };
    if (dateInput) dateInput.oninput = () => { g.dueDate = dateInput.value; store.save(); paintCuota(); };
    paintCuota();

    if (!g.special) {
      overlay.querySelector('#gDel').onclick = () => {
        const idx = p.goals.indexOf(g);
        const { undo } = store.stageDelete(() => p.goals.splice(idx, 1), () => p.goals.splice(idx, 0, g));
        close();
        toast('Meta eliminada', () => { undo(); paint(root); });
      };
    }
  }

  paintSheet();
}
