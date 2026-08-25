import { money } from '../format.js';
import { normalizar } from './clasificar.js';
import { nombreCategoria } from './clasificar.js';

/* F11 — buscar en todo el perfil: movimientos, metas, bloques y renglones.
   Todo cabe en memoria, así que es un filtro sobre arrays y nada más. */

function coincide(texto, termino) {
  return normalizar(texto).includes(termino);
}

export function buscar(p, consulta, limite = 40) {
  const q = normalizar(consulta).trim();
  if (q.length < 2) return [];
  const res = [];

  (p.items || []).forEach((it) => {
    if (coincide(it.n, q)) {
      res.push({ tipo: 'categoria', id: it.id, titulo: it.n, sub: `Categoría · ${money(it.m || 0, p.cur)} al mes`, ruta: 'categorias' });
    }
    (it.L || []).forEach((l) => {
      if (coincide(l.n || '', q)) {
        res.push({ tipo: 'renglon', id: l.id, titulo: l.n, sub: `Renglón de ${it.n}`, ruta: 'movimientos', args: { lineId: l.id } });
      }
    });
  });

  (p.goals || []).forEach((g) => {
    if (coincide(g.n, q)) {
      res.push({ tipo: 'meta', id: g.id, titulo: g.n, sub: 'Meta', ruta: 'metas', args: { goalId: g.id } });
    }
  });

  (p.movs || []).forEach((m) => {
    const it = (p.items || []).find((x) => x.id === m.itemId);
    const etiquetas = [m.nota, it?.n, m.cat ? nombreCategoria(m.cat) : '', m.fecha].join(' ');
    if (coincide(etiquetas, q)) {
      res.push({
        tipo: 'movimiento', id: m.id, monto: m.monto, fecha: m.fecha,
        titulo: m.nota || it?.n || (m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'),
        sub: `${m.fecha}${it ? ` · ${it.n}` : ''}`,
        ruta: 'movimientos', args: { movId: m.id },
      });
    }
  });

  /* Primero lo que tiene nombre propio —un bloque, un renglón, una meta— y
     después los movimientos, del más reciente al más viejo: buscar "rappi" es
     buscar los últimos rappis, pero buscar "moto" es buscar la meta. */
  const rango = (r) => (r.tipo === 'movimiento' ? 1 : 0);
  res.sort((a, b) => rango(a) - rango(b) || (b.fecha || '').localeCompare(a.fecha || ''));
  return res.slice(0, limite);
}

// Cuánto suma lo encontrado: la pregunta que sigue siempre a "busca Rappi"
export function totalDeMovimientos(resultados) {
  return resultados.filter((r) => r.tipo === 'movimiento').reduce((s, r) => s + (r.monto || 0), 0);
}
