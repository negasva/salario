import { NAV, toast } from './shell.js';
import { abrirRegistro } from './registrar.js';
import { prepararBusqueda } from './movimientos.js';
import { setMes } from './mes.js';
import { periodoActual } from '../engine/movimientos.js';
import { elegir, siguiente } from './tema.js';
import { icon } from './icons.js';
import { esc } from '../format.js';

/* Paleta de comandos, como la de Vercel: Ctrl o ⌘ + K abre una caja donde se
   escribe a dónde ir o qué hacer. Si lo escrito no es un comando, ofrece buscarlo
   en los movimientos. Sin animación: se abre con el teclado, que es lo que
   más se repite, y tiene que sentirse instantáneo. */

const sinTildes = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const ruta = () => location.hash.slice(1) || 'inicio';
const ir = (route) => window.dispatchEvent(new CustomEvent('ir-a-vista', { detail: { route } }));
const repintar = () => ir(ruta());

function comandos(q, salir) {
  const base = [
    ...NAV.filter((n) => !n.soloTel).map((n) => ({ grupo: 'Ir a', t: n.label, ic: n.ic, run: () => ir(n.id) })),
    { grupo: 'Acciones', t: 'Registrar gasto', ic: 'sale', run: () => abrirRegistro({ tipo: 'gasto', alGuardar: repintar }) },
    { grupo: 'Acciones', t: 'Registrar ingreso', ic: 'entra', run: () => abrirRegistro({ tipo: 'ingreso', alGuardar: repintar }) },
    { grupo: 'Acciones', t: 'Volver al mes actual', ic: 'calendario', run: () => { setMes(periodoActual()); repintar(); } },
    { grupo: 'Acciones', t: 'Cambiar tema', ic: 'sol', run: () => { const t = siguiente(); elegir(t); toast(`Tema: ${t}.`); } },
    { grupo: 'Acciones', t: 'Cerrar sesión', ic: 'salir', run: salir },
  ];
  const palabras = sinTildes(q).trim().split(/\s+/).filter(Boolean);
  const lista = base.filter((c) => palabras.every((p) => sinTildes(c.t).includes(p)));
  if (q.trim()) lista.push({ grupo: 'Buscar', t: `Buscar “${q.trim()}” en movimientos`, ic: 'buscar', run: () => { prepararBusqueda(q.trim()); ir('movimientos'); } });
  return lista;
}

let abierta = null;

function abrir(salir) {
  if (abierta) return;
  const origen = document.activeElement;
  const fondo = document.createElement('div');
  fondo.className = 'paleta-fondo';
  fondo.innerHTML = `<div class="paleta" role="dialog" aria-modal="true" aria-label="Buscar o ir a">
    <div class="paleta-in">${icon('buscar', 'ic-sm')}
      <input id="plQ" role="combobox" aria-expanded="true" aria-controls="plLista" aria-label="Buscar o ir a" placeholder="Buscar o ir a…" autocomplete="off" spellcheck="false">
      <kbd>Esc</kbd></div>
    <ul class="paleta-lista" id="plLista" role="listbox" aria-label="Resultados"></ul></div>`;
  document.body.appendChild(fondo);
  document.body.style.overflow = 'hidden';
  const input = fondo.querySelector('input');
  const ul = fondo.querySelector('ul');
  let items = []; let sel = 0;

  const pintar = () => {
    items = comandos(input.value, salir);
    sel = Math.min(sel, Math.max(0, items.length - 1));
    let grupo = '';
    ul.innerHTML = items.length ? items.map((c, i) => {
      const cab = c.grupo !== grupo ? `<li class="pl-g" role="presentation">${(grupo = c.grupo)}</li>` : '';
      return `${cab}<li class="pl-i" role="option" id="pl-${i}" data-i="${i}" aria-selected="${i === sel}">${icon(c.ic, 'ic-sm')}<span>${esc(c.t)}</span></li>`;
    }).join('') : '<li class="pl-vacio" role="presentation">Nada coincide.</li>';
    input.setAttribute('aria-activedescendant', items.length ? `pl-${sel}` : '');
  };
  const marcar = (n) => {
    sel = (n + items.length) % items.length;
    ul.querySelectorAll('[role=option]').forEach((li) => li.setAttribute('aria-selected', String(Number(li.dataset.i) === sel)));
    input.setAttribute('aria-activedescendant', `pl-${sel}`);
    ul.querySelector(`#pl-${sel}`)?.scrollIntoView({ block: 'nearest' });
  };
  const cerrar = () => {
    fondo.remove();
    document.body.style.overflow = '';
    abierta = null;
    if (origen?.isConnected) origen.focus({ preventScroll: true });
  };
  const ejecutar = (i) => { const c = items[i]; if (!c) return; cerrar(); c.run(); };

  input.oninput = () => { sel = 0; pintar(); };
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); marcar(sel + 1); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); marcar(sel - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); ejecutar(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
    else if (e.key === 'Tab') e.preventDefault(); // el foco se queda en la caja
  };
  ul.onclick = (e) => { const li = e.target.closest('[data-i]'); if (li) ejecutar(Number(li.dataset.i)); };
  ul.onpointermove = (e) => { const li = e.target.closest('[data-i]'); if (li && Number(li.dataset.i) !== sel) marcar(Number(li.dataset.i)); };
  fondo.onpointerdown = (e) => { if (e.target === fondo) cerrar(); };
  abierta = { cerrar };
  pintar();
  input.focus();
}

export function montarPaleta({ activa, salir }) {
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (!activa()) return;
      if (abierta) abierta.cerrar(); else if (!document.querySelector('.overlay')) abrir(salir);
    }
  });
  window.addEventListener('abrir-paleta', () => { if (activa()) abrir(salir); });
}
