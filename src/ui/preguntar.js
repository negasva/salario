import * as store from '../store.js';
import { amount, shareOf } from '../engine/reparto.js';
import { periodoDe, hoyISO, ingresoReal, porLinea } from '../engine/movimientos.js';
import { resumenItem, pagosLibresDeItem } from '../engine/pagos.js';
import { preguntarIA, explicar } from '../ia.js';
import { icon } from './icons.js';

/* F3 — la IA en hoja, para el botón flotante, con el mismo contexto que usa la
   tarjeta del dashboard. La IA no calcula nada: solo lee cifras ya calculadas. */

export function contextoIA(p, extras = {}) {
  const periodo = periodoDe(hoyISO());
  const pagadoPorLinea = porLinea(p.movs, periodo);
  const ing = ingresoReal(p.movs, periodo);
  const inc = store.incomeRepartir(p);
  return {
    moneda: p.cur,
    ingresoDelMes: ing.total,
    nomina: ing.nomina,
    extra: ing.extra,
    planDeIngreso: p.inc,
    bloques: p.items.map((it) => ({
      nombre: it.n,
      presupuesto: Math.round(amount(it)),
      porcentaje: shareOf(it, inc),
      gastado: Math.round(resumenItem(
        it,
        pagadoPorLinea,
        periodo,
        pagosLibresDeItem(p.movs, it.id, periodo).reduce((s, m) => s + m.monto, 0),
      ).pagado),
    })),
    metas: p.goals.map((g) => ({ nombre: g.n, objetivo: g.t, llevas: g.s || 0, estado: g.estado })),
    ...extras,
  };
}

export function abrirIA() {
  const p = store.active();
  if (!p) return;
  const overlay = document.createElement('div');
  overlay.className = 'overlay on';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const cerrar = () => { overlay.remove(); document.body.style.overflow = ''; };

  overlay.innerHTML = `
    <div class="sheet">
      <div class="sheet-head">
        <h3>${icon('ia', 'ic-sm')} Pregúntale a tus números</h3>
        <button class="btn-del" id="iaClose" aria-label="Cerrar">${icon('cerrar')}</button>
      </div>
      <p class="sub">Ejemplo: ¿cuánto me queda libre este mes si sigo así?</p>
      <label class="search wide" style="margin-top:var(--space-3)">
        <input id="iaInput" placeholder="Escribe tu pregunta" aria-label="Pregunta sobre tus números"></label>
      <button class="wide btn-primary" id="iaBtn" style="margin-top:var(--space-3)">Preguntar</button>
      <div id="iaRes" class="sub"></div>
    </div>`;

  const input = overlay.querySelector('#iaInput');
  const salida = overlay.querySelector('#iaRes');
  const preguntar = async () => {
    const q = input.value.trim();
    if (q.length < 4) return;
    salida.textContent = 'Pensando…';
    const { respuesta, error } = await preguntarIA(q, contextoIA(p));
    salida.textContent = error ? explicar(error) : (respuesta || 'El modelo no contestó nada.');
  };
  overlay.querySelector('#iaBtn').onclick = preguntar;
  input.onkeydown = (e) => { if (e.key === 'Enter') preguntar(); };
  overlay.querySelector('#iaClose').onclick = cerrar;
  overlay.onclick = (e) => { if (e.target === overlay) cerrar(); };
  input.focus();
}
