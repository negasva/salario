import * as store from '../store.js';
import { plain, money, digits, esc } from '../format.js';
import { icon } from './icons.js';
import { MONEDAS } from '../engine/moneda.js';
import { RANGOS, gastosSugeridos, gastoMaximoSugerido } from '../engine/perfilInicial.js';

/* F2 — el paso a paso de una cuenta nueva: nombre, edad y rango de salario, y
   con eso la app propone cinco gastos recurrentes y un tope de gasto. Todo lo
   que propone se edita o se borra ahí mismo. Se puede saltar entero y se
   rehace desde Ajustes. */

const MARCA = 'reparto:nuevo';

export function marcarCuentaNueva() {
  try {
    localStorage.setItem(MARCA, '1');
  } catch { /* sin localStorage el onboarding se salta, la app va igual */ }
}

export function esCuentaNueva() {
  try {
    return localStorage.getItem(MARCA) === '1';
  } catch {
    return false;
  }
}

function olvidarMarca() {
  try {
    localStorage.removeItem(MARCA);
  } catch { /* nada que limpiar */ }
}

const PASOS = 5;
const nid = (pre) => pre + Math.random().toString(36).slice(2, 8);

export function abrirOnboarding(alTerminar) {
  const p = store.active();
  if (!p) return;

  let paso = 0;
  // borrador: nada toca el perfil hasta el último paso
  const d = {
    nombre: p.name === 'Mi presupuesto' ? '' : p.name,
    edad: p.edad || '',
    inc: p.inc || 0,
    rango: '',
    gastos: [],
    tope: p.gastoMaximo || 70,
    ingresos: [],
  };

  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const cerrar = () => {
    olvidarMarca();
    overlay.remove();
    document.body.style.overflow = '';
    alTerminar();
  };

  function aplicar() {
    if (d.nombre) store.renameProfile(store.activeId(), d.nombre);
    if (d.edad) p.edad = Number(d.edad);
    if (d.inc > 0) p.inc = d.inc;
    p.gastoMaximo = d.tope;
    /* Rehacer el paso a paso desde Ajustes no puede duplicar lo que ya tienes:
       si el nombre ya existe, se respeta lo que hay. */
    const igual = (a, b) => a.trim().toLowerCase() === String(b || '').trim().toLowerCase();
    d.gastos.filter((g) => g.n.trim()).forEach((g) => {
      if (p.items.some((it) => igual(g.n, it.n))) return;
      p.items.push(store.nuevoItem(g.n.trim(), g.m, 'ese'));
    });
    // un ingreso recurrente es la misma plantilla mensual de Movimientos
    d.ingresos.filter((i) => i.n.trim() && i.monto > 0).forEach((i) => {
      if (p.recurrentes.some((r) => r.tipo === 'ingreso' && igual(i.n, r.nota))) return;
      p.recurrentes.push({ id: nid('r'), tipo: 'ingreso', monto: i.monto, cur: i.cur,
        itemId: null, lineId: null, goalId: null, nota: i.n.trim(), dia: i.dia });
    });
    store.save();
    cerrar();
  }

  const cabeza = (titulo, ayuda) => `
    <div class="ob-pasos" aria-label="Paso ${paso + 1} de ${PASOS}">
      ${Array.from({ length: PASOS }, (_, i) => `<i class="${i <= paso ? 'on' : ''}"></i>`).join('')}
    </div>
    <div class="sheet-head"><h3>${esc(titulo)}</h3></div>
    <p class="sub">${esc(ayuda)}</p>`;

  const pie = (boton) => `
    <div id="obErr" class="auth-err"></div>
    <button class="wide btn-primary" id="obNext" style="margin-top:var(--space-4)">${esc(boton)} ${icon('flecha-abajo', 'ic-sm')}</button>
    <div class="prow" style="margin-top:var(--space-2)">
      ${paso > 0 ? '<button id="obBack">Atrás</button>' : ''}
      <button id="obSkip">Saltar</button>
    </div>`;

  function pintar() {
    const s = pasos[paso];
    overlay.innerHTML = `<div class="sheet ob-sheet">${s.vista()}</div>`;
    const err = overlay.querySelector('#obErr');
    overlay.querySelector('#obSkip').onclick = cerrar;
    const atras = overlay.querySelector('#obBack');
    if (atras) atras.onclick = () => { paso -= 1; pintar(); };
    overlay.querySelector('#obNext').onclick = () => {
      if (s.validar?.(err)) return;
      if (paso === PASOS - 1) { aplicar(); return; }
      paso += 1;
      pintar();
    };
    s.vivo?.();
    overlay.querySelector('input')?.focus();
    overlay.querySelector('.sheet').onkeydown = (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); overlay.querySelector('#obNext').click(); }
    };
  }

  /* --- paso 1: nombre --- */
  const vistaNombre = () => `
    ${cabeza('¿Cómo te llamas?', 'Es el nombre de este presupuesto. Puedes tener varios: uno personal, uno familiar.')}
    <div class="fld" style="margin-top:var(--space-4)"><label for="obNombre">Nombre</label>
      <input id="obNombre" autocomplete="off" value="${esc(d.nombre)}" placeholder="Mi presupuesto"></div>
    ${pie('Siguiente')}`;

  /* --- paso 2: edad --- */
  const vistaEdad = () => `
    ${cabeza('¿Cuántos años tienes?', 'Con la edad ajustamos cuánto tiene sentido que gastes y cuánto que guardes.')}
    <div class="fld" style="margin-top:var(--space-4)"><label for="obEdad">Edad</label>
      <input id="obEdad" type="number" min="14" max="100" value="${esc(d.edad)}" placeholder="30"></div>
    ${pie('Siguiente')}`;

  /* --- paso 3: rango de salario --- */
  const vistaSalario = () => `
    ${cabeza('¿Cuánto entra al mes?', 'Elige el rango y ajusta el monto si lo tienes claro. Se corrige solo cuando registres la nómina real.')}
    <div class="chips" id="obRangos" style="margin-top:var(--space-4)">
      ${RANGOS.map((r) => `<button class="chip ${d.rango === r.id ? 'on' : ''}" data-r="${r.id}">${esc(r.label)}</button>`).join('')}
    </div>
    <div class="fld" style="margin-top:var(--space-4)"><label for="obInc">Ingreso mensual</label>
      <input id="obInc" class="num" inputmode="numeric" value="${d.inc ? plain(d.inc, p.cur) : ''}" placeholder="5.500.000"></div>
    ${pie('Siguiente')}`;

  /* --- paso 4: gastos recurrentes + tope --- */
  const vistaGastos = () => `
    ${cabeza('Tus gastos recurrentes', 'Estos son los que casi todo el mundo tiene, con un estimado sobre tu salario. Cámbialos o bórralos.')}
    <div id="obGastos" style="margin-top:var(--space-4)"></div>
    <button class="mini" id="obGastoNuevo" style="margin-top:var(--space-2)">+ Agregar gasto</button>
    <div class="card" style="margin-top:var(--space-4)">
      <span class="label">Gasto máximo sugerido</span>
      <div class="fld" style="margin-top:8px"><label for="obTope">Porcentaje del ingreso (%)</label>
        <input id="obTope" type="number" min="10" max="100" value="${d.tope}"></div>
      <div class="sub" id="obTopeTxt"></div>
    </div>
    ${pie('Siguiente')}`;

  /* --- paso 5: ingresos recurrentes --- */
  const vistaIngresos = () => `
    ${cabeza('Tus ingresos que se repiten', 'Salario, pensión, un arriendo que cobras. Cada mes los agregas con un clic desde Movimientos.')}
    <div id="obIngresos" style="margin-top:var(--space-4)"></div>
    <button class="mini" id="obIngNuevo" style="margin-top:var(--space-2)">+ Agregar ingreso</button>
    ${pie('Terminar')}`;

  /* Cada paso junta su vista, su validación y el cableado de sus listas: tres
     arreglos paralelos indexados por el mismo número era una invitación a que
     se desalinearan. */
  const pasos = [
    {
      vista: vistaNombre,
      validar: (err) => {
        d.nombre = overlay.querySelector('#obNombre').value.trim();
        if (!d.nombre) { err.textContent = 'Ponle un nombre, aunque sea "Mi plata".'; return true; }
        return false;
      },
    },
    {
      vista: vistaEdad,
      validar: (err) => {
        d.edad = Number(overlay.querySelector('#obEdad').value) || 0;
        if (d.edad < 14 || d.edad > 100) { err.textContent = 'Escribe una edad entre 14 y 100.'; return true; }
        return false;
      },
    },
    {
      vista: vistaSalario,
      validar: (err) => {
        d.inc = digits(overlay.querySelector('#obInc').value);
        if (d.inc <= 0) { err.textContent = 'Elige un rango o escribe cuánto entra al mes.'; return true; }
        // volver atrás y seguir no puede borrar lo que ya editaste en el paso 4
        if (!d.gastos.length || d.incSembrado !== d.inc) {
          d.gastos = gastosSugeridos(d.inc);
          d.tope = gastoMaximoSugerido(d.edad, d.inc);
          d.incSembrado = d.inc;
        }
        return false;
      },
      vivo: () => {
        const inc = overlay.querySelector('#obInc');
        overlay.querySelectorAll('#obRangos .chip').forEach((b) => {
          b.onclick = () => {
            d.rango = b.dataset.r;
            d.inc = RANGOS.find((x) => x.id === d.rango).medio;
            inc.value = plain(d.inc, p.cur);
            overlay.querySelectorAll('#obRangos .chip').forEach((x) => x.classList.toggle('on', x === b));
          };
        });
      },
    },
    {
      vista: vistaGastos,
      validar: () => { d.tope = Number(overlay.querySelector('#obTope').value) || d.tope; return false; },
      vivo: () => {
        const box = overlay.querySelector('#obGastos');
        const topeTxt = overlay.querySelector('#obTopeTxt');
        const pintarTope = () => {
          const pct = Number(overlay.querySelector('#obTope').value) || 0;
          topeTxt.textContent = `Son ${money(Math.round((d.inc * pct) / 100), p.cur)} al mes. Lo demás queda para ahorro y metas.`;
        };
        const pintarGastos = () => {
          box.innerHTML = d.gastos.map((g, i) => `<div class="prow" style="margin-top:6px">
            <input class="obG" data-i="${i}" data-k="n" value="${esc(g.n)}" style="flex:1" aria-label="Nombre del gasto">
            <input class="obG num" data-i="${i}" data-k="m" inputmode="numeric" value="${plain(g.m, p.cur)}" style="width:38%" aria-label="Monto de ${esc(g.n)}">
            <button class="mini obGDel" data-i="${i}" aria-label="Quitar ${esc(g.n)}">${icon('cerrar', 'ic-sm')}</button>
          </div>`).join('') || '<div class="empty">Sin gastos precargados. Los creas después en Categorías.</div>';
          box.querySelectorAll('.obG').forEach((inp) => {
            inp.onchange = (e) => {
              const g = d.gastos[Number(e.target.dataset.i)];
              if (e.target.dataset.k === 'n') g.n = e.target.value;
              else g.m = digits(e.target.value);
            };
          });
          box.querySelectorAll('.obGDel').forEach((b) => {
            b.onclick = () => { d.gastos.splice(Number(b.dataset.i), 1); pintarGastos(); };
          });
        };
        pintarGastos();
        pintarTope();
        overlay.querySelector('#obTope').oninput = pintarTope;
        overlay.querySelector('#obGastoNuevo').onclick = () => { d.gastos.push({ n: '', m: 0 }); pintarGastos(); };
      },
    },
    {
      vista: vistaIngresos,
      vivo: () => {
        const box = overlay.querySelector('#obIngresos');
        const pintarIngresos = () => {
          box.innerHTML = d.ingresos.map((it, i) => `<div class="prow" style="margin-top:6px">
            <input class="obI" data-i="${i}" data-k="n" value="${esc(it.n)}" placeholder="Salario" style="flex:1" aria-label="Nombre del ingreso">
            <input class="obI num" data-i="${i}" data-k="monto" inputmode="numeric" value="${it.monto ? plain(it.monto, it.cur) : ''}" placeholder="0" style="width:30%" aria-label="Monto">
            <select class="obI" data-i="${i}" data-k="cur" aria-label="Moneda">
              ${MONEDAS.map((m) => `<option value="${m}" ${it.cur === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
            <input class="obI" data-i="${i}" data-k="dia" type="number" min="1" max="31" value="${it.dia}" style="width:64px" aria-label="Día del mes">
            <button class="mini obIDel" data-i="${i}" aria-label="Quitar ingreso">${icon('cerrar', 'ic-sm')}</button>
          </div>`).join('') || '<div class="empty">Sin ingresos recurrentes. Puedes agregarlos después.</div>';
          box.querySelectorAll('.obI').forEach((inp) => {
            inp.onchange = (e) => {
              const it = d.ingresos[Number(e.target.dataset.i)];
              const k = e.target.dataset.k;
              it[k] = k === 'monto' ? digits(e.target.value) : k === 'dia' ? Number(e.target.value) || 1 : e.target.value;
            };
          });
          box.querySelectorAll('.obIDel').forEach((b) => {
            b.onclick = () => { d.ingresos.splice(Number(b.dataset.i), 1); pintarIngresos(); };
          });
        };
        if (!d.ingresos.length) d.ingresos.push({ n: 'Salario', monto: d.inc, cur: p.cur, dia: 1 });
        pintarIngresos();
        overlay.querySelector('#obIngNuevo').onclick = () => {
          d.ingresos.push({ n: '', monto: 0, cur: p.cur, dia: 1 });
          pintarIngresos();
        };
      },
    },
  ];

  pintar();
}
