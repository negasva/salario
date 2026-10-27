import { describe, it, expect } from 'vitest';
import { vencimientos, nuevoRecurrente } from './recurrentes.js';
import { avisosDeHoy, mensajeDe, hoyEnBogota } from '../../supabase/functions/avisar/vencimientos.js';

/* La función del servidor tiene su propia copia de la regla de avisos: aquí se
   comprueba que da lo mismo que la de la app. */
describe('avisos del servidor', () => {
  const recs = [
    nuevoRecurrente({ n: 'Plan de datos', monto: 30000, cada: { dias: 20, desde: '2026-10-27' } }),
    nuevoRecurrente({ n: 'Arriendo', monto: 900000, dia: 1 }),
    nuevoRecurrente({ n: 'Carro', monto: 500000, dia: 28, cuotas: { total: 3, desde: '2026-09' } }),
    nuevoRecurrente({ n: 'Gym', monto: 80000, dia: 15 }),
  ];
  recs[3].omitidos = ['2026-11'];
  const pago = { id: 'p', fecha: '2026-10-28', tipo: 'gasto', monto: 500000, catId: 'x', recId: recs[2].id };

  for (const hoy of ['2026-10-27', '2026-10-31', '2026-11-15', '2026-11-16', '2026-11-30', '2026-12-31']) {
    it(`coincide con la app el ${hoy}`, () => {
      const app = vencimientos(recs, [pago], hoy, 1).map((v) => `${v.rec.n}|${v.en}`);
      const srv = avisosDeHoy(recs, [pago], hoy, 1).map((v) => `${v.n}|${v.en}`);
      expect(srv).toEqual(app);
    });
  }

  it('el aviso del plan sale a los 19 días', () => {
    expect(mensajeDe(avisosDeHoy(recs, [], '2026-11-15'))).toContain('Plan de datos: vence mañana · $ 30.000');
  });

  it('hoy se cuenta en hora de Colombia', () => {
    expect(hoyEnBogota(new Date('2026-11-16T03:00:00Z'))).toBe('2026-11-15');
  });
});
