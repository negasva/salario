import { icon } from './icons.js';
import { MESES, MESES_CORTOS } from '../format.js';

/* Selector de fecha propio. El calendario nativo del navegador no se puede
   pintar, así que los <input type="date"> y <input type="month"> se vuelven
   un botón que abre un calendario en la página, con los colores de la app.
   El input sigue ahí (oculto) y es la fuente de verdad: `.value`, los eventos
   `input`/`change` y los formularios funcionan igual que antes. */

const DIAS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];
const pad = (n) => String(n).padStart(2, '0');
const iso = (a, m, d) => `${a}-${pad(m)}-${pad(d)}`;
const hoy = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function etiqueta(valor, tipo) {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(valor || '');
  if (!m) return 'Elegir…';
  const mes = MESES[Number(m[2]) - 1];
  return tipo === 'month' ? `${mayus(mes)} ${m[1]}` : `${Number(m[3])} de ${mes} de ${m[1]}`;
}

function mejorar(input) {
  if (input.dataset.fecha) return;
  const tipo = input.type;
  input.dataset.fecha = tipo;
  const rotulo = input.id ? document.querySelector(`label[for="${input.id}"]`) : null;

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'fecha-btn';
  boton.setAttribute('aria-haspopup', 'dialog');
  boton.setAttribute('aria-expanded', 'false');
  if (input.id) { boton.id = `${input.id}Btn`; if (rotulo) rotulo.htmlFor = boton.id; }
  const panel = document.createElement('div');
  panel.className = 'fecha-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', tipo === 'month' ? 'Elegir mes' : 'Elegir fecha');

  const pintaBoton = () => {
    boton.innerHTML = `<span>${etiqueta(input.value, tipo)}</span>${icon('calendario', 'ic-sm')}`;
  };

  // si el código cambia `.value`, el botón lo refleja
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  input.type = 'hidden';
  Object.defineProperty(input, 'value', {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) { desc.set.call(this, v); pintaBoton(); },
  });
  input.after(boton, panel);
  pintaBoton();

  let vista = { a: 0, m: 0 }; // año y mes (1-12) que se están mirando
  const actual = () => {
    const m = /^(\d{4})-(\d{2})/.exec(input.value) || /^(\d{4})-(\d{2})/.exec(hoy());
    return { a: Number(m[1]), m: Number(m[2]) };
  };
  const elegir = (valor) => {
    input.value = valor;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    cerrar(true);
  };

  const pintaDias = () => {
    const { a, m } = vista;
    const primero = (new Date(a, m - 1, 1).getDay() + 6) % 7; // lunes primero
    const total = new Date(a, m, 0).getDate();
    const sel = input.value;
    const celdas = [];
    for (let i = 0; i < primero; i += 1) celdas.push('<span></span>');
    for (let d = 1; d <= total; d += 1) {
      const f = iso(a, m, d);
      celdas.push(`<button type="button" class="fecha-d${f === sel ? ' sel' : ''}${f === hoy() ? ' hoy' : ''}" data-f="${f}" aria-label="${d} de ${MESES[m - 1]} de ${a}" aria-pressed="${f === sel}" tabindex="${f === sel || (!/^\d{4}-\d{2}-\d{2}$/.test(sel) && f === hoy()) ? 0 : -1}">${d}</button>`);
    }
    panel.innerHTML = `
      <div class="fecha-cab">
        <b class="fecha-t" aria-live="polite">${mayus(MESES[m - 1])} ${a}</b>
        <button type="button" class="fecha-nav" data-mes="-1" aria-label="Mes anterior">${icon('izq', 'ic-sm')}</button>
        <button type="button" class="fecha-nav" data-mes="1" aria-label="Mes siguiente">${icon('der', 'ic-sm')}</button>
      </div>
      <div class="fecha-sem" aria-hidden="true">${DIAS.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="fecha-grid">${celdas.join('')}</div>
      <div class="fecha-pie"><button type="button" class="fecha-hoy" data-hoy>Hoy</button></div>`;
  };
  const pintaMeses = () => {
    const sel = input.value.slice(0, 7);
    panel.innerHTML = `
      <div class="fecha-cab">
        <b class="fecha-t" aria-live="polite">${vista.a}</b>
        <button type="button" class="fecha-nav" data-anio="-1" aria-label="Año anterior">${icon('izq', 'ic-sm')}</button>
        <button type="button" class="fecha-nav" data-anio="1" aria-label="Año siguiente">${icon('der', 'ic-sm')}</button>
      </div>
      <div class="fecha-meses">${MESES_CORTOS.map((n, i) => {
    const v = `${vista.a}-${pad(i + 1)}`;
    return `<button type="button" class="fecha-m${v === sel ? ' sel' : ''}${v === hoy().slice(0, 7) ? ' hoy' : ''}" data-f="${v}" aria-pressed="${v === sel}">${mayus(n)}</button>`;
  }).join('')}</div>
      <div class="fecha-pie"><button type="button" class="fecha-hoy" data-hoy>Este mes</button></div>`;
  };
  const pinta = () => (tipo === 'month' ? pintaMeses() : pintaDias());

  function cerrar(devolverFoco) {
    panel.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
    if (devolverFoco) boton.focus({ preventScroll: true });
  }
  function abrir() {
    vista = actual();
    pinta();
    panel.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    (panel.querySelector('.sel') || panel.querySelector('.hoy') || panel.querySelector('[data-f]'))?.focus({ preventScroll: true });
  }

  boton.onclick = () => (panel.hidden ? abrir() : cerrar());
  panel.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.f) return elegir(b.dataset.f);
    if ('hoy' in b.dataset) return elegir(tipo === 'month' ? hoy().slice(0, 7) : hoy());
    const mover = b.dataset.mes !== undefined ? Number(b.dataset.mes) : null;
    if (mover !== null) {
      const n = vista.m - 1 + mover;
      vista = { a: vista.a + Math.floor(n / 12), m: ((n % 12) + 12) % 12 + 1 };
    } else if (b.dataset.anio !== undefined) {
      vista = { a: vista.a + Number(b.dataset.anio), m: vista.m };
    } else return;
    pinta();
    panel.querySelector(`[data-${mover !== null ? 'mes' : 'anio'}="${mover !== null ? mover : b.dataset.anio}"]`)?.focus({ preventScroll: true });
  };
  panel.onkeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(true); return; }
    const d = e.target.closest?.('.fecha-d');
    const pasos = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!d || !(e.key in pasos)) return;
    e.preventDefault();
    const lista = [...panel.querySelectorAll('.fecha-d')];
    const i = lista.indexOf(d) + pasos[e.key];
    if (i >= 0 && i < lista.length) { lista[i].focus(); return; }
    const n = vista.m - 1 + (i < 0 ? -1 : 1);
    vista = { a: vista.a + Math.floor(n / 12), m: ((n % 12) + 12) % 12 + 1 };
    pinta();
    const nuevas = [...panel.querySelectorAll('.fecha-d')];
    (i < 0 ? nuevas[nuevas.length - 1] : nuevas[0])?.focus();
  };
  // tocar fuera lo cierra
  document.addEventListener('pointerdown', (e) => {
    if (!panel.hidden && !panel.contains(e.target) && !boton.contains(e.target)) cerrar();
  });
}

const buscar = (raiz) => {
  if (raiz.nodeType !== 1) return;
  if (raiz.matches?.('input[type=date],input[type=month]')) mejorar(raiz);
  raiz.querySelectorAll?.('input[type=date],input[type=month]').forEach(mejorar);
};

export function montarFechas() {
  buscar(document.body);
  new MutationObserver((cambios) => cambios.forEach((c) => c.addedNodes.forEach(buscar)))
    .observe(document.body, { childList: true, subtree: true });
}
