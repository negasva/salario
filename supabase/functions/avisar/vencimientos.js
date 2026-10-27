/* Qué avisar hoy, calculado en el servidor. Es la misma regla que
   `vencimientos` en src/engine/recurrentes.js (hoy, mañana y lo vencido),
   copiada aquí porque la función corre en Deno y no importa de src/. Una
   prueba (src/engine/avisar.test.js) revisa que las dos den lo mismo. */

const diasEntre = (a, b) => {
  const f = (x) => { const [y, m, d] = x.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((f(b) - f(a)) / 86400000);
};
const sumarDias = (fecha, n) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const sumarMeses = (per, n) => {
  const [y, m] = per.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};
const enPeriodo = (per, dia) => {
  const [y, m] = per.split('-').map(Number);
  const d = Math.min(Math.max(1, Number(dia) || 1), new Date(y, m, 0).getDate());
  return `${per}-${String(d).padStart(2, '0')}`;
};

export function avisosDeHoy(recurrentes, movs, hoy, dias = 1) {
  const actual = hoy.slice(0, 7);
  const pagado = (rec, per) => (movs || []).some((m) => m.recId === rec.id && String(m.fecha).slice(0, 7) === per);
  const lista = [];
  for (const rec of recurrentes || []) {
    if (rec.tipo !== 'gasto') continue;
    if (rec.cada) {
      const ultimo = (movs || []).filter((m) => m.recId === rec.id).reduce((u, m) => (m.fecha > u ? m.fecha : u), '');
      const base = ultimo > rec.cada.desde ? ultimo : rec.cada.desde;
      const en = diasEntre(hoy, sumarDias(base, rec.cada.dias));
      if (en <= dias) lista.push({ n: rec.n, monto: rec.monto || 0, en });
      continue;
    }
    for (const per of [actual, sumarMeses(actual, 1)]) {
      if (rec.omitidos?.includes(per) || pagado(rec, per)) continue;
      if (rec.cuotas) {
        const [ya, ma] = rec.cuotas.desde.split('-').map(Number);
        const [yb, mb] = per.split('-').map(Number);
        const n = (yb - ya) * 12 + (mb - ma) + 1;
        if (n < 1 || n > rec.cuotas.total) continue;
      }
      const en = diasEntre(hoy, enPeriodo(per, rec.dia));
      if (en > dias || (per !== actual && en < 0)) continue;
      lista.push({ n: rec.n, monto: rec.monto || 0, en });
    }
  }
  return lista.sort((a, b) => a.en - b.en);
}

const cuando = (en) => (en === 0 ? 'vence hoy' : en === 1 ? 'vence mañana' : en > 1 ? `vence en ${en} días`
  : en === -1 ? 'venció ayer' : `venció hace ${-en} días`);
const plata = (v) => `$ ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(v)}`;

export function mensajeDe(lista) {
  if (!lista.length) return '';
  return `💸 Pagos por hacer\n${lista.slice(0, 8).map((v) => `• ${v.n}: ${cuando(v.en)}${v.monto ? ` · ${plata(v.monto)}` : ''}`).join('\n')}`;
}

// 'AAAA-MM-DD' de hoy en Colombia, sin importar dónde corra el servidor.
export const hoyEnBogota = (ahora = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(ahora);
