/* F2 — con qué arranca una cuenta nueva. Los cinco gastos que casi todo el
   mundo tiene, con un monto estimado como porcentaje del salario declarado.
   Son una propuesta: se editan y se borran. */
export const GASTOS_SUGERIDOS = [
  { n: 'Arriendo', p: 30 },
  { n: 'Mercado', p: 15 },
  { n: 'Salud', p: 5 },
  { n: 'Gasolina', p: 5 },
  { n: 'Inversión', p: 10 },
];

export const RANGOS = [
  { id: 'r1', label: 'Menos de $2.000.000', min: 0, max: 2000000, medio: 1500000 },
  { id: 'r2', label: '$2.000.000 a $4.000.000', min: 2000000, max: 4000000, medio: 3000000 },
  { id: 'r3', label: '$4.000.000 a $8.000.000', min: 4000000, max: 8000000, medio: 5500000 },
  { id: 'r4', label: '$8.000.000 a $15.000.000', min: 8000000, max: 15000000, medio: 11000000 },
  { id: 'r5', label: 'Más de $15.000.000', min: 15000000, max: Infinity, medio: 20000000 },
];

export function gastosSugeridos(ingreso) {
  return GASTOS_SUGERIDOS.map((g) => ({ n: g.n, m: Math.round(((Number(ingreso) || 0) * g.p) / 100) }));
}

/* Cuánto del ingreso puede irse en gastos. Con sueldos bajos casi todo se va
   en vivir y pedir un 70% es una fantasía; con sueldos altos el margen para
   ahorrar es real. La edad mueve el número porque a los veinte el interés
   compuesto todavía juega a favor y a los cincuenta las obligaciones pesan. */
export function gastoMaximoSugerido(edad, ingreso) {
  const inc = Number(ingreso) || 0;
  let pct = 75;
  if (inc >= 8000000) pct = 65;
  else if (inc >= 4000000) pct = 70;
  else if (inc < 2000000) pct = 85;
  const años = Number(edad) || 0;
  if (años && años < 30) pct -= 5;
  else if (años >= 50) pct += 5;
  return Math.min(90, Math.max(50, pct));
}
