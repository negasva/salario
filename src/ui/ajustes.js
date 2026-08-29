import * as store from '../store.js';
import { toast } from './shell.js';
import { plain, money, esc, digits } from '../format.js';
import { ingresoEfectivo, excedente } from '../engine/consejo.js';
import { estadoNotificaciones, pedirPermisoNotificaciones } from './avisos.js';
import { MONEDAS, tasa } from '../engine/moneda.js';
import { abrirOnboarding } from './onboarding.js';

export function renderAjustes(root) {
  const p = store.active();

  root.innerHTML = `
    <div class="grid">
      <div class="card">
        <span class="label">Perfiles</span>
        <div class="fld" style="margin-top:10px"><label>Nombre del perfil activo</label>
          <input id="ajNombre" value="${esc(p.name)}" aria-label="Nombre del perfil activo"></div>
        <div class="chips" id="ajChips" style="margin-top:10px">
          ${store.profiles().filter((pr) => pr.id !== store.activeId())
            .map((pr) => `<button class="chip" data-id="${pr.id}">${esc(pr.name)}</button>`).join('')}
        </div>
        <div class="prow">
          <button id="ajNew">+ Nuevo perfil</button>
          <button id="ajDup">Duplicar</button>
          <button id="ajDel">Eliminar</button>
        </div>
      </div>

      <div class="card">
        <span class="label">Ingreso</span>
        <div class="chips" style="margin-top:10px">
          <button class="chip ${p.ingresoTipo === 'fijo' ? 'on' : ''}" id="ajFijo">Fijo</button>
          <button class="chip ${p.ingresoTipo === 'variable' ? 'on' : ''}" id="ajVariable">Variable</button>
        </div>
        <div id="ajHistorial" style="margin-top:12px"></div>
      </div>

      <div class="card">
        <span class="label">Saldo inicial</span>
        <div class="sub" style="margin-top:6px">Lo que tenías antes de empezar. A partir de ahí se suman ingresos y se restan egresos.</div>
        ${MONEDAS.map((m) => `<div class="fld" style="margin-top:10px"><label>${m}</label>
          <input class="ajSaldo" data-cur="${m}" inputmode="numeric" value="${plain(p.saldos?.[m] || 0, m)}"></div>`).join('')}
      </div>

      <div class="card">
        <span class="label">Moneda principal</span>
        <div class="chips" id="ajMonedas" style="margin-top:10px">
          ${MONEDAS.map((m) => `<button class="chip ${p.cur === m ? 'on' : ''}" data-cur="${m}">${m}</button>`).join('')}
        </div>
        <div class="sub" id="ajTasas" style="margin-top:10px">Consultando tasas…</div>
      </div>

      <div class="card">
        <span class="label">Medios de pago</span>
        <div id="ajMedios" style="margin-top:10px"></div>
        <div class="prow"><button id="ajMedioNuevo">+ Agregar medio</button></div>
      </div>

      <div class="card">
        <span class="label">Fondo de emergencia</span>
        <div class="fld" style="margin-top:10px"><label>Meses objetivo (3 a 6)</label>
          <input type="number" id="ajFondoMeses" min="3" max="6" value="${p.fondoMeses}"></div>
      </div>

      <div class="card">
        <span class="label">Costo de oportunidad</span>
        <div class="fld" style="margin-top:10px"><label>Tasa anual nominal (%)</label>
          <input type="number" id="ajTasa" min="0" max="100" step="0.5" value="${p.tasaInteres}"></div>
      </div>

      <div class="card">
        <span class="label">Avisos</span>
        <div class="sub" id="ajNotifTexto" style="margin-top:8px"></div>
        <div class="prow"><button id="ajNotif">Permitir notificaciones</button></div>
      </div>

      <div class="card">
        <span class="label">Paso a paso</span>
        <div class="sub" style="margin-top:6px">Vuelve a las preguntas del inicio: edad, salario, gastos e ingresos que se repiten.</div>
        <div class="prow"><button id="ajWizard">Rehacer el paso a paso</button></div>
      </div>

      <div class="card">
        <span class="label">Datos</span>
        <div class="prow">
          <button id="ajExport">Exportar</button>
          <label class="btn-file">Importar<input type="file" id="ajImport" accept="application/json" hidden></label>
        </div>
        <div id="ajImportar"></div>
      </div>
    </div>`;

  root.querySelectorAll('#ajChips .chip').forEach((b) => {
    b.onclick = () => { store.setActive(b.dataset.id); renderAjustes(root); };
  });
  root.querySelector('#ajNombre').onchange = (e) => {
    store.renameProfile(store.activeId(), e.target.value);
    renderAjustes(root);
  };
  // sin prompt(): nombre por defecto y el foco en el input, que en móvil se puede usar
  root.querySelector('#ajNew').onclick = () => {
    store.addProfile(`Perfil ${store.profiles().length + 1}`, false);
    renderAjustes(root);
    root.querySelector('#ajNombre').select();
  };
  root.querySelector('#ajDup').onclick = () => {
    store.addProfile(`${p.name} (copia)`, true);
    renderAjustes(root);
    toast('Perfil duplicado');
  };
  root.querySelector('#ajDel').onclick = () => {
    if (store.profiles().length < 2) { toast('Deja al menos un perfil'); return; }
    if (store.removeProfile(p.id)) { renderAjustes(root); toast('Perfil eliminado'); }
  };

  root.querySelector('#ajFijo').onclick = () => { p.ingresoTipo = 'fijo'; store.save(); renderAjustes(root); };
  root.querySelector('#ajVariable').onclick = () => { p.ingresoTipo = 'variable'; store.save(); renderAjustes(root); };

  const histBox = root.querySelector('#ajHistorial');
  if (p.ingresoTipo === 'variable') {
    while (p.ingresoHistorial.length < 3) p.ingresoHistorial.push(0);
    histBox.innerHTML = `<div class="label" style="margin-bottom:8px">Últimos 3 meses</div>
      ${[0, 1, 2].map((i) => `<div class="fld"><input class="ajMes" data-i="${i}" value="${plain(p.ingresoHistorial[i], p.cur)}" inputmode="numeric"></div>`).join('')}
      <div class="sub" id="ajResumen"></div>`;
    const paintResumen = () => {
      const { promedio, minimo } = ingresoEfectivo(p.ingresoHistorial);
      let html = `Promedio para repartir: <b class="num">${plain(promedio, p.cur)}</b> · Mínimo para gastos recurrentes: <b class="num">${plain(minimo, p.cur)}</b>`;
      const ultimo = p.ingresoHistorial[p.ingresoHistorial.length - 1];
      if (ultimo > promedio) {
        const ex = excedente(ultimo, promedio);
        html += `<br>Excedente del último mes: <b class="num">${money(ex.total, p.cur)}</b> — ${money(ex.metasYFondo, p.cur)} a metas y fondo, ${money(ex.libre, p.cur)} libre.`;
      }
      histBox.querySelector('#ajResumen').innerHTML = html;
    };
    histBox.querySelectorAll('.ajMes').forEach((inp) => {
      inp.onchange = (e) => { p.ingresoHistorial[Number(e.target.dataset.i)] = digits(e.target.value); store.save(); paintResumen(); };
    });
    paintResumen();
  } else {
    histBox.innerHTML = '';
  }

  root.querySelectorAll('.ajSaldo').forEach((inp) => {
    inp.onchange = (e) => {
      p.saldos = p.saldos || {};
      p.saldos[e.target.dataset.cur] = digits(e.target.value);
      store.save();
    };
  });

  root.querySelectorAll('#ajMonedas .chip').forEach((b) => {
    b.onclick = () => { p.cur = b.dataset.cur; store.save(); renderAjustes(root); };
  });

  /* Las tasas se piden una vez y quedan cacheadas 12 h; si no hay red se
     muestra la última conocida y, si nunca hubo, se dice en voz alta. */
  (async () => {
    const otras = MONEDAS.filter((m) => m !== p.cur);
    const valores = await Promise.all(otras.map((m) => tasa(m, p.cur)));
    const box = root.querySelector('#ajTasas');
    if (!box) return;
    const linea = otras.map((m, i) => (valores[i] ? `1 ${m} = ${money(valores[i], p.cur)}` : `1 ${m} = sin tasa`));
    box.innerHTML = linea.join(' · ');
  })();

  const mediosBox = root.querySelector('#ajMedios');
  function pintarMedios() {
    p.medios = p.medios || [];
    mediosBox.innerHTML = p.medios.map((m, i) => `<div class="prow" style="margin-top:6px">
      <input class="ajMedio" data-i="${i}" value="${esc(m)}" aria-label="Medio de pago ${i + 1}" style="flex:1">
      <button class="mini ajMedioDel" data-i="${i}">Quitar</button>
    </div>`).join('') || '<div class="empty">Sin medios de pago. Agrega el primero.</div>';
    mediosBox.querySelectorAll('.ajMedio').forEach((inp) => {
      inp.onchange = (e) => { p.medios[Number(e.target.dataset.i)] = e.target.value.trim() || 'Sin nombre'; store.save(); };
    });
    mediosBox.querySelectorAll('.ajMedioDel').forEach((b) => {
      b.onclick = () => { p.medios.splice(Number(b.dataset.i), 1); store.save(); pintarMedios(); };
    });
  }
  pintarMedios();
  root.querySelector('#ajMedioNuevo').onclick = () => {
    p.medios.push('Nuevo medio');
    store.save();
    pintarMedios();
    mediosBox.querySelector('.ajMedio:last-of-type')?.select?.();
  };

  root.querySelector('#ajFondoMeses').onchange = (e) => {
    p.fondoMeses = Math.min(6, Math.max(3, Number(e.target.value) || 4));
    store.save();
  };
  root.querySelector('#ajTasa').onchange = (e) => { p.tasaInteres = Number(e.target.value) || 0; store.save(); };

  const notifTexto = {
    'no-soportado': 'Este navegador no tiene notificaciones. Los avisos igual salen dentro de la app.',
    granted: 'Concedido. Al abrir la app te avisamos a 5, 3 y 1 día del cierre de mes, y de las metas con fecha encima.',
    denied: 'Lo negaste. Se cambia desde el candado de la barra de direcciones; mientras tanto los avisos salen dentro de la app.',
    default: 'Te avisamos a 5, 3 y 1 día del cierre de mes y cinco días antes de la fecha de una meta. Nada más.',
  };
  const pintarNotif = () => {
    const estado = estadoNotificaciones();
    root.querySelector('#ajNotifTexto').textContent = notifTexto[estado] || notifTexto.default;
    const btn = root.querySelector('#ajNotif');
    btn.disabled = estado !== 'default';
    btn.textContent = estado === 'granted' ? 'Notificaciones activas' : 'Permitir notificaciones';
  };
  root.querySelector('#ajNotif').onclick = async () => {
    await pedirPermisoNotificaciones();
    pintarNotif();
  };
  pintarNotif();

  root.querySelector('#ajWizard').onclick = () => abrirOnboarding(() => renderAjustes(root));

  root.querySelector('#ajExport').onclick = () => {
    const blob = new Blob([JSON.stringify({ profiles: store.profiles() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    a.href = url;
    a.download = `reparto-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  root.querySelector('#ajImport').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(reader.result); } catch { toast('Archivo inválido'); return; }
      if (!parsed.profiles?.length) { toast('El archivo no tiene perfiles'); return; }
      const nombres = parsed.profiles.map((pr) => pr.name).join(', ');
      // reemplazar borra todo: se pregunta con dos botones que dicen qué hace cada uno
      const box = root.querySelector('#ajImportar');
      box.innerHTML = `<div class="sub">Contiene ${parsed.profiles.length} perfil(es): ${esc(nombres)}.</div>
        <div class="prow">
          <button id="ajImpFusion">Agregarlos a los míos</button>
          <button id="ajImpReemplazo">Borrar los míos y dejar solo estos</button>
          <button id="ajImpCancel">Cancelar</button>
        </div>`;
      const aplicar = (reemplazar) => {
        store.importProfiles(parsed.profiles, reemplazar);
        renderAjustes(root);
        toast('Importación completa');
      };
      box.querySelector('#ajImpFusion').onclick = () => aplicar(false);
      box.querySelector('#ajImpReemplazo').onclick = () => aplicar(true);
      box.querySelector('#ajImpCancel').onclick = () => { box.innerHTML = ''; };
    };
    reader.readAsText(file);
  };
}
