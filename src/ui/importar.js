import * as store from '../store.js';
import { leerCSV, detectarColumnas, aCandidatos } from '../engine/csv.js';
import { deTipo, nuevoId } from '../engine/categorias.js';
import { money, esc, fechaCorta } from '../format.js';
import { abrirModal } from './modal.js';
import { icon } from './icons.js';
import { toast } from './shell.js';

/* Importar el extracto del banco. Tres pasos en la misma hoja: elegir el
   archivo, confirmar qué columna es qué, y revisar cada movimiento (tipo,
   categoría y si entra o no) antes de guardarlos. Nada entra sin revisar:
   los que ya estaban llegan desmarcados. */

// Los bancos a veces exportan en Latin-1: si UTF-8 deja caracteres rotos, se relee.
async function leerTexto(archivo) {
  const buf = await archivo.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf8;
}

export function abrirImportar(alGuardar = () => {}) {
  const p = store.active();
  const { cuerpo, cerrar } = abrirModal({ titulo: 'Importar extracto' });
  let filas = [];
  let mapa = null;
  let candidatos = [];

  const paso1 = () => {
    cuerpo.innerHTML = `
      <p class="sub">Descarga el extracto de tu banco en <b>CSV</b> (en Excel: Guardar como → CSV). La app adivina las columnas y tú revisas cada movimiento antes de que entre.</p>
      <label class="subir-archivo">
        <input type="file" id="imArchivo" accept=".csv,.txt,text/csv">
        ${icon('subir')}<b>Elegir archivo</b><span class="sub">.csv o .txt</span>
      </label>
      <div id="imErr" class="auth-err"></div>`;
    cuerpo.querySelector('#imArchivo').onchange = async (e) => {
      const archivo = e.target.files?.[0];
      if (!archivo) return;
      try {
        filas = leerCSV(await leerTexto(archivo));
      } catch { filas = []; }
      if (filas.length < 2) { cuerpo.querySelector('#imErr').textContent = 'No encontré filas en ese archivo. ¿Es un CSV?'; return; }
      mapa = detectarColumnas(filas);
      paso2();
    };
  };

  const encabezados = () => {
    const fila = mapa.encabezado >= 0 ? filas[mapa.encabezado] : filas[0];
    return fila.map((c, j) => (mapa.encabezado >= 0 && c ? c : `Columna ${j + 1}`));
  };

  const paso2 = () => {
    candidatos = aCandidatos(filas, mapa, p);
    const cols = encabezados();
    const sel = (campo, etiqueta, opcional) => `<div class="fld"><label for="im-${campo}">${etiqueta}</label>
      <select id="im-${campo}" data-campo="${campo}">${opcional ? '<option value="-1">(ninguna)</option>' : ''}
        ${cols.map((c, j) => `<option value="${j}" ${mapa[campo] === j ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>`;
    const incluidos = candidatos.filter((c) => !c.duplicado);
    const opciones = (c) => deTipo(p.cats, c.tipo).map((x) => `<option value="${x.id}" ${x.id === c.catId ? 'selected' : ''}>${esc(x.n)}</option>`).join('');

    cuerpo.innerHTML = `
      <details class="im-cols" ${candidatos.length ? '' : 'open'}>
        <summary>Columnas: ${esc(cols[mapa.fecha] || '?')} · ${esc(cols[mapa.descripcion] || '?')} · ${esc(cols[mapa.monto] || [cols[mapa.debito], cols[mapa.credito]].filter(Boolean).join(' / ') || '?')}</summary>
        <div class="im-grid">
          ${sel('fecha', 'Fecha')}${sel('descripcion', 'Descripción')}
          ${sel('monto', 'Valor (con signo)', true)}${sel('debito', 'Débitos (salidas)', true)}${sel('credito', 'Créditos (entradas)', true)}
        </div>
        <p class="sub">Si el valor viene en una sola columna, los negativos son gastos.</p>
      </details>
      ${candidatos.length ? `
      <p class="sub im-resumen num" id="imResumen"></p>
      <ul class="list im-lista">${candidatos.map((c) => `<li class="row im-fila ${c.duplicado ? 'duplicado' : ''}" data-id="${c.id}">
        <input type="checkbox" class="im-si" aria-label="Importar ${esc(c.nota)}" ${c.duplicado ? '' : 'checked'}>
        <div class="row-txt">
          <span class="row-t">${esc(c.nota || '(sin descripción)')}</span>
          <span class="row-s">${fechaCorta(c.fecha)} ${c.fecha.slice(0, 4)}${c.duplicado ? ' · <b>ya está registrado</b>' : ''}</span>
          <select class="im-cat" aria-label="Categoría">${opciones(c)}</select>
        </div>
        <b class="num row-monto ${c.tipo === 'ingreso' ? 'pos' : 'neg'}">${c.tipo === 'ingreso' ? '+' : '−'}${money(c.monto)}</b>
      </li>`).join('')}</ul>
      <button class="wide btn-primary" id="imGuardar"></button>`
    : '<div class="empty">Con estas columnas no salió ningún movimiento: revisa cuál es la fecha y cuál el valor.</div>'}
      <button class="wide" id="imOtro">Elegir otro archivo</button>`;

    const $ = (s) => cuerpo.querySelector(s);
    const elegidos = () => candidatos.filter((c) => cuerpo.querySelector(`[data-id="${c.id}"] .im-si`)?.checked);
    const contar = () => {
      const e = elegidos();
      const sale = e.filter((c) => c.tipo === 'gasto').reduce((t, c) => t + c.monto, 0);
      const entra = e.filter((c) => c.tipo === 'ingreso').reduce((t, c) => t + c.monto, 0);
      if ($('#imResumen')) {
        $('#imResumen').innerHTML = `${candidatos.length} en el archivo · ${candidatos.length - incluidos.length} ya estaban · sale ${money(sale)} · entra ${money(entra)}`;
      }
      if ($('#imGuardar')) {
        $('#imGuardar').textContent = e.length ? `Importar ${e.length} movimiento${e.length === 1 ? '' : 's'}` : 'Marca los que quieres importar';
        $('#imGuardar').disabled = !e.length;
      }
    };
    cuerpo.querySelectorAll('select[data-campo]').forEach((s) => {
      s.onchange = () => { mapa[s.dataset.campo] = Number(s.value); paso2(); };
    });
    cuerpo.querySelectorAll('.im-fila').forEach((li) => {
      const c = candidatos.find((x) => x.id === li.dataset.id);
      li.querySelector('.im-si').onchange = contar;
      li.querySelector('.im-cat').onchange = (e) => { c.catId = e.target.value; };
    });
    $('#imOtro').onclick = paso1;
    $('#imGuardar')?.addEventListener('click', () => {
      const nuevos = elegidos().map((c) => ({ id: nuevoId(), fecha: c.fecha, tipo: c.tipo, monto: c.monto, catId: c.catId, nota: c.nota }));
      if (!nuevos.length) return;
      p.movs.push(...nuevos);
      store.save();
      cerrar();
      alGuardar();
      toast(`${nuevos.length} movimiento${nuevos.length === 1 ? '' : 's'} importado${nuevos.length === 1 ? '' : 's'}.`, () => {
        const ids = new Set(nuevos.map((m) => m.id));
        for (let i = p.movs.length - 1; i >= 0; i -= 1) if (ids.has(p.movs[i].id)) p.movs.splice(i, 1);
        store.save();
        alGuardar();
      });
    });
    contar();
  };

  paso1();
}
