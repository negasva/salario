import * as store from '../store.js';
import { amount, freeFor, clamp, r2 } from '../engine/reparto.js';
import {
  monthlyToward, monthsToGoal, whenText, emergencyTarget, emergencyStatus, escalonActual,
  cuotaPorFecha, planRecorte, escenarios, costoOportunidad, conflictosDeMetas, secuenciaPlazos, aplicarAporte,
} from '../engine/metas.js';
import { money, plain } from '../format.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

function digits(v) { const c = String(v).replace(/[^\d]/g, ''); return c ? Number(c) : 0; }
function id() { return Math.random().toString(36).slice(2, 9); }

function estadoFondo(p) {
  const essentials = p.items.filter((it) => it.r === 'ese');
  const { oneMonth, target } = emergencyTarget(essentials, p.fondoMeses);
  const g = p.goals.find((x) => x.special === 'emergencia');
  const saved = g ? g.s || 0 : 0;
  return { oneMonth, target, saved, estado: emergencyStatus(saved, oneMonth, target), goal: g };
}

export function renderMetas(root) {
  const p = store.active();
  const inc = store.incomeRepartir(p);
  const ef = estadoFondo(p);

  if (!ef.goal) {
    p.goals.unshift({ id: 'g' + id(), n: 'Fondo de emergencia', t: ef.target, s: 0, a: {}, priority: 'alta', dateMode: false, aportes: [], special: 'emergencia' });
    store.save();
  } else if (ef.goal.t !== ef.target) {
    ef.goal.t = ef.target;
    store.save();
  }

  root.innerHTML = `
    <button id="metaAdd" class="wide" style="margin-bottom:var(--sp-4)">+ Nueva meta</button>
    <div id="metaList" class="grid"></div>`;

  root.querySelector('#metaAdd').onclick = () => {
    const escalon = escalonActual({
      minimosDeudaCubiertos: true,
      fondoEstado: estadoFondo(p).estado,
      tieneMetasActivas: p.goals.some((g) => !g.special),
    });
    const g = { id: 'g' + id(), n: 'Nueva meta', t: 0, s: 0, a: {}, priority: 'media', dateMode: false, aportes: [] };
    p.goals.push(g);
    store.save();
    openGoalSheet(root, g, escalon < 4);
  };

  paint(root);
}

function paint(root) {
  const p = store.active();
  const inc = store.incomeRepartir(p);
  const box = root.querySelector('#metaList');
  const conflictos = conflictosDeMetas(p.goals);

  box.innerHTML = p.goals.map((g) => {
    const pct = g.t > 0 ? Math.round(clamp((g.s || 0) / g.t * 100, 0, 100)) : 0;
    const n = monthsToGoal(g, p.items, inc);
    const enConflicto = conflictos.some((c) => c.goals.includes(g));
    return `
    <div class="card goal ${g.special ? 'goal-esp' : ''}" data-id="${g.id}">
      <div class="goal-top">
        <div>
          <div class="goal-name">${esc(g.n)} ${g.special ? '<span class="badge warn">fondo</span>' : ''} <span class="badge ${g.priority === 'alta' ? 'bad' : g.priority === 'media' ? 'warn' : 'ok'}">${g.priority}</span></div>
          <div class="sub num">${money(g.t, p.cur)}</div>
        </div>
        <button class="mini goal-edit">Editar</button>
      </div>
      <div class="pbar"><i style="width:${pct}%"></i></div>
      <div class="sub">${n ? `Llevas ${money(g.s || 0, p.cur)}. Guardas <b class="num">${money(monthlyToward(g, p.items, inc), p.cur)}</b> al mes, la tienes en ${n} meses, hacia ${whenText(n)}.` : `Llevas ${money(g.s || 0, p.cur)}. Sin aporte mensual todavía.`}</div>
      ${enConflicto ? '<div class="sub" style="color:var(--amber);margin-top:6px">Compite por bloque con otra meta.</div>' : ''}
    </div>`;
  }).join('');

  p.goals.forEach((g) => {
    const card = box.querySelector(`.goal[data-id="${g.id}"]`);
    card?.querySelector('.goal-edit')?.addEventListener('click', () => openGoalSheet(root, g, false));
  });
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function openGoalSheet(root, g, warnEscalon) {
  const p = store.active();
  const inc = store.incomeRepartir(p);
  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  function close() { overlay.remove(); document.body.style.overflow = ''; paint(root); }

  function paintSheet() {
    const conflictos = conflictosDeMetas(p.goals).find((c) => c.goals.includes(g));
    const m = monthlyToward(g, p.items, inc);
    const co = costoOportunidad(m * 12, p.tasaInteres);

    overlay.innerHTML = `
      <div class="sheet">
        <div class="sheet-head"><h3>Meta de ahorro</h3><button class="btn-del" id="gClose">${icon('cerrar')}</button></div>
        ${warnEscalon ? `<div class="sub" style="color:var(--amber);margin-bottom:12px">Estás en el escalón ${escalonActual({ minimosDeudaCubiertos: true, fondoEstado: estadoFondo(p).estado, tieneMetasActivas: p.goals.some((x) => !x.special) })}, esta meta es del escalón 4.</div>` : ''}
        <div class="fld"><label>Qué quieres comprar</label><input id="gName" value="${esc(g.n)}" ${g.special ? 'disabled' : ''}></div>
        <div class="fld"><label>Cuánto cuesta</label><input id="gCost" value="${plain(g.t, p.cur)}" inputmode="numeric"></div>
        <div class="fld"><label>Cuánto llevas ahorrado</label><input id="gSaved" value="${plain(g.s, p.cur)}" inputmode="numeric"></div>
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
          ${g.aportes?.length ? `<div class="sub" style="margin-top:6px">${g.aportes.slice(-5).reverse().map((a) => `${money(a.monto, p.cur)} · ${new Date(a.fecha).toLocaleDateString('es-CO')}`).join('<br>')}</div>` : ''}
        </div>

        <div class="chips" style="margin-bottom:12px">
          <button class="chip ${!g.dateMode ? 'on' : ''}" id="gModeMonto">Por monto</button>
          <button class="chip ${g.dateMode ? 'on' : ''}" id="gModeFecha">Por fecha</button>
        </div>
        ${g.dateMode ? `<div class="fld"><label>Fecha objetivo</label><input type="date" id="gDate" value="${g.dueDate || ''}"></div><div id="gCuota" class="sub"></div>` : ''}

        ${conflictos ? (() => {
          const { paralelo, secuencia } = secuenciaPlazos(conflictos.goals, p.items, inc);
          return `<div class="sub" style="color:var(--amber);margin-bottom:12px">Esta meta compite por el mismo bloque con ${conflictos.goals.length - 1} otra(s).
          En paralelo: ${paralelo.map((m) => m ? m + ' meses' : 'sin aporte').join(' / ')}.
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

        <button class="wide" id="gDone" style="margin-top:16px">Listo</button>
        ${!g.special ? `<button class="wide" id="gDel" style="margin-top:8px">Eliminar esta meta</button>` : ''}
      </div>`;

    overlay.querySelector('#gClose').onclick = close;
    overlay.querySelector('#gDone').onclick = close;
    overlay.querySelector('#gName').oninput = (e) => { g.n = e.target.value; store.save(); };
    overlay.querySelector('#gCost').onchange = (e) => { g.t = digits(e.target.value); store.save(); paintSheet(); };
    overlay.querySelector('#gSaved').onchange = (e) => { g.s = digits(e.target.value); store.save(); paintSheet(); };
    overlay.querySelector('#gPriority').onchange = (e) => { g.priority = e.target.value; store.save(); };

    overlay.querySelector('#gAporteBtn').onclick = () => {
      const monto = digits(overlay.querySelector('#gAporte').value);
      if (monto <= 0) return;
      aplicarAporte(g, monto);
      store.save();
      toast(`Aporte de ${money(monto, p.cur)} registrado`);
      paintSheet();
    };

    overlay.querySelector('#gModeMonto').onclick = () => { g.dateMode = false; store.save(); paintSheet(); };
    overlay.querySelector('#gModeFecha').onclick = () => { g.dateMode = true; store.save(); paintSheet(); };

    if (g.dateMode) {
      const dateInput = overlay.querySelector('#gDate');
      const paintCuota = () => {
        if (!dateInput.value) return;
        const r = cuotaPorFecha(g.t, g.s, new Date(dateInput.value));
        const disp = monthlyToward(g, p.items, inc);
        overlay.querySelector('#gCuota').innerHTML = disp >= r.cuota
          ? `Necesitas <b class="num">${money(r.cuota, p.cur)}</b> al mes, ya la tienes.`
          : `Necesitas <b class="num">${money(r.cuota, p.cur)}</b> al mes. Hoy destinas ${money(disp, p.cur)}. Falta ${money(r.cuota - disp, p.cur)}.`;
        paintPlan(r.cuota - disp);
      };
      dateInput.oninput = () => { g.dueDate = dateInput.value; store.save(); paintCuota(); };
      paintCuota();
    } else {
      overlay.querySelector('#gPlan').innerHTML = '';
    }

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
        el.querySelector('button').onclick = () => {
          cubierto += r.monto;
          el.style.opacity = '.4';
          el.querySelector('button').disabled = true;
          const restante = Math.max(0, faltante - cubierto);
          planBox.querySelector('#gPlanCounter').textContent = restante > 0 ? `Faltan ${money(restante, p.cur)}` : 'Cubierto';
        };
        cardsBox.appendChild(el);
      });

      // F7 — tres escenarios comparables
      const disp = monthlyToward(g, p.items, inc);
      const escBox = document.createElement('div');
      escBox.className = 'grid';
      escBox.style.marginTop = '14px';
      escenarios(faltante, g.s, g.t, disp, recortes).forEach((e) => {
        const el = document.createElement('div');
        el.className = 'card-2';
        el.style.padding = '10px';
        el.innerHTML = `<b style="text-transform:capitalize">${e.nombre}</b>
          <div class="sub num" style="margin-top:4px">${money(e.cuota, p.cur)} al mes</div>
          <div class="sub" style="margin-top:4px">${e.meses ? `${e.meses} meses, hacia ${e.fecha}` : 'no alcanza'}</div>
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
          <div class="r"><span class="num">${money(m, p.cur)} al mes</span><span class="num" style="color:var(--text);font-weight:800">${n ? n + ' meses' : 'sin aporte'}</span></div></div>`;
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
          <div class="alloc-head"><span>${esc(it.n)}</span><span class="num alloc-amt" style="color:var(--blue)">${money(amount(it, inc) * v / 100, p.cur)}</span></div>
          <input type="range" min="0" max="100" step="1" value="${v}" max="${free}">
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
