/* F1 — saldo disponible: el saldo base que declaraste al abrir la cuenta,
   más todo lo que entró, menos todo lo que salió. Sin filtro de periodo:
   un saldo es acumulado o no es un saldo. */
export function saldoActual(base, movs = []) {
  return movs.reduce((t, m) => t + (m.tipo === 'ingreso' ? m.monto : -m.monto), Number(base) || 0);
}

// El saldo base vive por moneda: un perfil puede tener pesos y dólares a la vez.
export function saldoBase(p, cur = p?.cur) {
  return Number(p?.saldos?.[cur]) || 0;
}
