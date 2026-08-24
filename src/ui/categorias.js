import * as store from '../store.js';
import { total, amount, spentInItem, fixedVariableSplit, clamp, r2 } from '../engine/reparto.js';
import { money, plain, esc, digits } from '../format.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

const PALETTE = ['var(--ink)', 'var(--pink)', 'var(--danger)', 'var(--success)', 'var(--warning)',
  'var(--pink-dark)', 'var(--ink-lighter)', 'var(--pink-light)'];

export function renderCategorias(root) {
  const p = store.active();

  root.innerHTML = `
    <div class="cats-head">
      <button id="catAdd" class="wide btn-primary">+ Agregar categoría</button>
      <button id="catEqual">Repartir lo que falta en partes iguales</button>
    </div>
    <div id="catList"></div>`;

  root.querySelector('#catAdd').onclick = () => openNewCategory(root);
  root.querySelector('#catEqual').onclick = () => {
    const d = r2(100 - total(p.items));
    if (Math.abs(d) < 0.01) { toast('Ya está en 100%'); return; }
    const unlocked = p.items.filter((it) => !it.locked);
    if (!unlocked.length) { toast('Todas las categorías están bloqueadas'); return; }
    const e = d / unlocked.length;
    unlocked.forEach((it) => { it.p = r2(clamp(it.p + e, 0, 100)); });
    store.save();
    renderCategorias(root);
  };

  paintList(root);
}

function paintList(root) {
  const p = store.active();
  const box = root.querySelector('#catList');
  box.innerHTML = p.items.map((it) => catCard(it, p)).join('');

  p.items.forEach((it) => wireCard(root, it, p));
}

function catCard(it, p) {
  const budget = amount(it, store.incomeRepartir(p));
  const sp = spentInItem(it);
  const { fixed, variable } = fixedVariableSplit(it);
  return `
  <div class="card cat-card" data-id="${it.id}">
    <div class="cat-top">
      <span class="dot" style="background:${it.c}"></span>
      <input class="cat-name" value="${esc(it.n)}" ${it.locked ? 'disabled' : ''}>
      <button class="mini cat-lock" title="${it.locked ? 'Desbloquear' : 'Bloquear'}">${icon('candado', 'ic-sm')}</button>
      <button class="mini cat-del">${icon('cerrar', 'ic-sm')}</button>
    </div>
    <div class="sub cat-desc" contenteditable="${!it.locked}">${esc(it.d || '')}</div>
    <div class="cat-fields">
      <label class="fieldw"><span>${p.cur}</span><input class="cat-monto num" type="text" inputmode="numeric" value="${plain(budget, p.cur)}" ${it.locked ? 'disabled' : ''}></label>
      <label class="fieldw pcent"><input class="cat-pct num" type="text" inputmode="decimal" value="${it.p}" ${it.locked ? 'disabled' : ''}><span>%</span></label>
    </div>
    <input type="range" class="cat-range" min="0" max="100" step="0.5" value="${it.p}" ${it.locked ? 'disabled' : ''}>
    <button class="wide mini cat-fix" ${it.locked ? 'disabled' : ''}></button>
    <div class="cat-detail">
      <div class="detail-head"><span class="label">Detalle</span><button class="btn-plus cat-plus">+</button></div>
      <div class="lines">${lines(it, p)}</div>
      <div class="sub" style="margin-top:8px">Suma <b class="num">${money(sp, p.cur)}</b> · fijo ${money(fixed, p.cur)} · variable ${money(variable, p.cur)}</div>
    </div>
  </div>`;
}

function lines(it, p) {
  if (!it.L.length) return '<div class="empty">Sin nada en la lista.</div>';
  return it.L.map((l) => `
    <div class="line" data-lid="${l.id}">
      <input class="ln" value="${esc(l.n)}" placeholder="Concepto">
      <input class="lv num" type="text" inputmode="numeric" value="${l.v ? plain(l.v, p.cur) : ''}" placeholder="0">
      <button class="mini fixedtoggle ${l.fixed ? 'on' : ''}" title="Fijo/variable">${l.fixed ? 'Fijo' : 'Variable'}</button>
      <button class="mini lx">${icon('cerrar', 'ic-sm')}</button>
    </div>`).join('');
}

function wireCard(root, it, p) {
  const card = root.querySelector(`.cat-card[data-id="${it.id}"]`);
  if (!card) return;

  function setPct(v) {
    it.p = r2(clamp(v, 0, 100));
    store.save();
    renderCategorias(root);
  }

  // el arrastre solo actualiza los campos visibles, sin re-render ni guardado en cada tick
  function liveDrag(v) {
    it.p = r2(clamp(v, 0, 100));
    const pctEl = card.querySelector('.cat-pct');
    const montoEl = card.querySelector('.cat-monto');
    if (document.activeElement !== pctEl) pctEl.value = it.p;
    if (document.activeElement !== montoEl) montoEl.value = plain(amount(it, store.incomeRepartir(p)), p.cur);
  }

  card.querySelector('.cat-name').oninput = (e) => { it.n = e.target.value; store.save(); };
  card.querySelector('.cat-desc').oninput = (e) => { it.d = e.target.textContent; store.save(); };
  card.querySelector('.cat-range').oninput = (e) => liveDrag(Number(e.target.value));
  card.querySelector('.cat-range').onchange = (e) => setPct(Number(e.target.value));
  card.querySelector('.cat-pct').onchange = (e) => setPct(Number(String(e.target.value).replace(',', '.')) || 0);
  card.querySelector('.cat-monto').onchange = (e) => {
    const inc = store.incomeRepartir(p);
    setPct(inc > 0 ? (digits(e.target.value) / inc) * 100 : 0);
  };

  const fixBtn = card.querySelector('.cat-fix');
  const diff = r2(100 - total(p.items));
  if (!it.locked && Math.abs(diff) >= 0.01) {
    fixBtn.textContent = diff > 0 ? `Sumar ${diff}% aquí` : `Quitar ${Math.abs(diff)}% de aquí`;
    fixBtn.onclick = () => setPct(it.p + diff);
  } else {
    fixBtn.textContent = 'Cuadrado';
    fixBtn.disabled = true;
  }

  card.querySelector('.cat-lock').onclick = () => { it.locked = !it.locked; store.save(); renderCategorias(root); };

  card.querySelector('.cat-del').onclick = () => {
    if (p.items.length < 2) { toast('Deja al menos una categoría'); return; }
    if (it.locked) { toast('Desbloquea la categoría antes de borrarla'); return; }
    const idx = p.items.indexOf(it);
    const reclamos = p.goals.filter((g) => g.a[it.id] !== undefined).map((g) => ({ g, pct: g.a[it.id] }));
    const { undo } = store.stageDelete(
      () => { p.items.splice(idx, 1); p.goals.forEach((g) => { delete g.a[it.id]; }); },
      () => { p.items.splice(idx, 0, it); reclamos.forEach(({ g, pct }) => { g.a[it.id] = pct; }); }
    );
    renderCategorias(root);
    toast(`"${it.n}" eliminada`, () => { undo(); renderCategorias(root); });
  };

  card.querySelector('.cat-plus').onclick = () => {
    it.L.push({ id: 'l' + Math.random().toString(36).slice(2, 8), n: '', v: 0, fixed: true });
    store.save();
    renderCategorias(root);
  };

  card.querySelectorAll('.line').forEach((lineEl) => {
    const lid = lineEl.dataset.lid;
    const l = it.L.find((x) => x.id === lid);
    if (!l) return;
    lineEl.querySelector('.ln').oninput = (e) => { l.n = e.target.value; store.save(); };
    lineEl.querySelector('.lv').onchange = (e) => { l.v = digits(e.target.value); store.save(); renderCategorias(root); };
    lineEl.querySelector('.fixedtoggle').onclick = () => { l.fixed = !l.fixed; store.save(); renderCategorias(root); };
    lineEl.querySelector('.lx').onclick = () => {
      const idx = it.L.indexOf(l);
      const { undo } = store.stageDelete(() => it.L.splice(idx, 1), () => it.L.splice(idx, 0, l));
      renderCategorias(root);
      toast('Renglón eliminado', () => { undo(); renderCategorias(root); });
    };
  });
}

// F12 — plantillas + F16 — de donde sale el porcentaje de una categoria nueva
function openNewCategory(root) {
  const p = store.active();
  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  overlay.innerHTML = `
    <div class="sheet">
      <div class="sheet-head"><h3>Nueva categoría</h3><button class="btn-del" id="ncClose">${icon('cerrar')}</button></div>
      <div class="fld"><label>Nombre</label><input id="ncName" placeholder="Ej: Mascotas"></div>
      <div class="label" style="margin:14px 0 8px">Plantilla de conceptos</div>
      <div class="chips" id="ncTpl">
        <button class="chip" data-r="ese">Esenciales</button>
        <button class="chip" data-r="deu">Deudas</button>
        <button class="chip" data-r="lib">Gasto libre</button>
        <button class="chip" data-r="cor">Ahorro corto</button>
        <button class="chip on" data-r="">Saltar plantilla</button>
      </div>
      <div class="label" style="margin:14px 0 8px">De dónde sale el porcentaje</div>
      <div class="chips" id="ncSrc">
        <button class="chip on" data-s="sobra">Lo que sobra sin asignar</button>
        <button class="chip" data-s="prop">Proporcional de bloques desbloqueados</button>
        <button class="chip" data-s="bloque">De un bloque específico</button>
      </div>
      <select id="ncBloque" style="margin-top:8px;display:none;width:100%">
        ${p.items.map((it) => `<option value="${it.id}">${esc(it.n)}</option>`).join('')}
      </select>
      <button id="ncCreate" class="wide" style="margin-top:16px">Crear categoría</button>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  let tpl = '';
  let src = 'sobra';
  overlay.querySelector('#ncTpl').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    overlay.querySelectorAll('#ncTpl .chip').forEach((x) => x.classList.remove('on'));
    b.classList.add('on'); tpl = b.dataset.r;
  });
  overlay.querySelector('#ncSrc').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    overlay.querySelectorAll('#ncSrc .chip').forEach((x) => x.classList.remove('on'));
    b.classList.add('on'); src = b.dataset.s;
    overlay.querySelector('#ncBloque').style.display = src === 'bloque' ? '' : 'none';
  });

  function close() { overlay.remove(); document.body.style.overflow = ''; }
  overlay.querySelector('#ncClose').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#ncCreate').onclick = () => {
    const name = overlay.querySelector('#ncName').value.trim() || 'Nueva categoría';
    const lines2 = (store.PLANTILLAS[tpl] || []).map((n) => ({ id: 'l' + Math.random().toString(36).slice(2, 8), n, v: 0, fixed: true }));

    let pct = 0;
    if (src === 'sobra') {
      pct = Math.max(0, r2(100 - total(p.items)));
    } else if (src === 'prop') {
      const unlocked = p.items.filter((it) => !it.locked);
      const t = total(unlocked);
      pct = t > 0 ? r2(t * 0.1) : 5; // ponytail: 10% proporcional simple, ajustable a mano despues
      unlocked.forEach((it) => { it.p = r2(it.p * 0.9); });
    } else if (src === 'bloque') {
      const id = overlay.querySelector('#ncBloque').value;
      const donor = p.items.find((it) => it.id === id);
      if (donor && !donor.locked) { pct = Math.min(10, donor.p); donor.p = r2(donor.p - pct); }
    }

    p.items.push({ id: 'i' + Math.random().toString(36).slice(2, 8), n: name, p: pct, r: tpl || null,
      c: PALETTE[p.items.length % PALETTE.length], d: '', locked: false, L: lines2 });
    store.save();
    close();
    renderCategorias(root);
  };
}
