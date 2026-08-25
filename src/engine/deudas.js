import { r2 } from './reparto.js';
import { whenText } from './metas.js';

/* Amortización mensual estándar. Todo sale de una sola simulación mes a mes:
   es exacta con el último pago parcial y evita repetir la fórmula cerrada. */

const TOPE = 600; // 50 años: más allá de eso la cuota no está pagando nada

function amortizar(saldo, tasaAnual, cuota) {
  const i = (Number(tasaAnual) || 0) / 100 / 12;
  if (!(saldo > 0)) return { meses: 0, interes: 0 };
  if (!(cuota > 0) || cuota <= saldo * i) return { meses: null, interes: null };
  let resto = saldo;
  let interes = 0;
  let mes = 0;
  while (resto > 0 && mes < TOPE) {
    mes++;
    const cargo = resto * i;
    interes += cargo;
    resto = resto + cargo - Math.min(cuota, resto + cargo);
  }
  return resto > 0 ? { meses: null, interes: null } : { meses: mes, interes: r2(interes) };
}

export function mesesParaLiquidar(saldo, tasaAnual, cuota) {
  return amortizar(saldo, tasaAnual, cuota).meses;
}

export function interesTotal(saldo, tasaAnual, cuota) {
  return amortizar(saldo, tasaAnual, cuota).interes;
}

// Saldo declarado menos lo abonado desde el libro. Nunca por debajo de cero.
export function saldoVivo(linea, movs = []) {
  const abonado = movs
    .filter((m) => m.abono && m.lineId === linea.id)
    .reduce((s, m) => s + m.monto, 0);
  return Math.max(0, (Number(linea.saldo) || 0) - abonado);
}

// Los renglones de los bloques de deuda que sí tienen saldo vivo
export function deudasDelPerfil(items, movs = []) {
  return items
    .filter((it) => it.r === 'deu')
    .flatMap((it) => (it.L || [])
      .map((l) => ({ id: l.id, n: l.n, saldo: saldoVivo(l, movs), tasa: Number(l.tasa) || 0, minimo: Number(l.minimo) || 0 }))
      .filter((d) => d.saldo > 0));
}

export function ordenar(deudas, metodo = 'avalancha') {
  return [...deudas].sort((a, b) => (metodo === 'bolaDeNieve' ? a.saldo - b.saldo : b.tasa - a.tasa));
}

export function minimosCubiertos(deudas, presupuestoMensual) {
  return deudas.reduce((s, d) => s + (d.minimo || 0), 0) <= presupuestoMensual;
}

/* Reparte el presupuesto del bloque: mínimo a cada deuda y el sobrante a la
   primera de la fila. Cuando una cae, su mínimo se suma al sobrante y arrastra
   a la siguiente, que es de donde sale la ventaja de los dos métodos. */
export function plan(deudas, presupuestoMensual, metodo = 'avalancha') {
  const vivas = ordenar(deudas, metodo).map((d) => ({ ...d, resto: d.saldo, meses: null }));
  if (!vivas.length) return { deudas: [], meses: 0, fecha: null, interes: 0, cubreMinimos: true };
  if (!minimosCubiertos(vivas, presupuestoMensual)) {
    return { deudas: [], meses: null, fecha: null, interes: 0, cubreMinimos: false };
  }

  let interes = 0;
  let mes = 0;
  while (vivas.some((d) => d.resto > 0) && mes < TOPE) {
    mes++;
    vivas.forEach((d) => {
      if (d.resto <= 0) return;
      const cargo = d.resto * (d.tasa / 100 / 12);
      d.resto += cargo;
      interes += cargo;
    });
    let bolsa = presupuestoMensual;
    vivas.forEach((d) => {
      if (d.resto <= 0 || bolsa <= 0) return;
      const pago = Math.min(d.minimo, d.resto, bolsa);
      d.resto -= pago;
      bolsa -= pago;
    });
    for (const d of vivas) {
      if (bolsa <= 0) break;
      if (d.resto <= 0) continue;
      const pago = Math.min(bolsa, d.resto);
      d.resto -= pago;
      bolsa -= pago;
    }
    vivas.forEach((d) => { if (d.resto <= 0 && d.meses === null) d.meses = mes; });
  }

  const liquida = vivas.every((d) => d.resto <= 0);
  return {
    deudas: vivas.map((d) => ({ id: d.id, n: d.n, meses: d.meses, fecha: d.meses ? whenText(d.meses) : null })),
    meses: liquida ? mes : null,
    fecha: liquida ? whenText(mes) : null,
    interes: r2(interes),
    cubreMinimos: true,
  };
}
