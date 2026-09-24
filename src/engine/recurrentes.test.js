import { describe, it, expect } from 'vitest';
import {
  fechaEnPeriodo, fechaSugerida, nuevoRecurrente, pendientes, pagosDelMes, estaPagado, estadoDelMes,
  abonar, pagarLoQueFalta, editarAbono, quitarAbono, notasUsadas, marcarTodos, resumen,
  normalizarCuotas, mesesEntre, numeroCuota, mesFinal, activoEn, estadoDeuda,
  diasEntre, vencimientos, cuandoVence, proyeccion, calendarioICS,
} from './recurrentes.js';

const nuevo = (n, monto, extra = {}) => nuevoRecurrente({ n, monto, catId: 'viv', dia: 5, ...extra });

describe('fecha del recurrente', () => {
  it('el día 31 se cae al último del mes', () => {
    expect(fechaEnPeriodo('2026-02', 31)).toBe('2026-02-28');
    expect(fechaEnPeriodo('2024-02', 31)).toBe('2024-02-29');
    expect(fechaEnPeriodo('2026-09', 5)).toBe('2026-09-05');
  });

  it('un día inválido cae el primero', () => {
    expect(fechaEnPeriodo('2026-09', 0)).toBe('2026-09-01');
    expect(fechaEnPeriodo('2026-09', undefined)).toBe('2026-09-01');
  });
});

describe('modelo', () => {
  it('guarda nombre y estimado, sin marca de apagado', () => {
    const r = nuevo('Arriendo', 1200000);
    expect(r).toMatchObject({ n: 'Arriendo', monto: 1200000, catId: 'viv', tipo: 'gasto' });
    expect('activo' in r).toBe(false);
  });

  it('un ingreso no lleva categoría y el estimado puede ir vacío', () => {
    expect(nuevoRecurrente({ n: 'Sueldo', monto: 3000000, tipo: 'ingreso' }).catId).toBeNull();
    expect(nuevo('Mercado', 0).monto).toBe(0);
  });
});

describe('pagar en una o en varias partes', () => {
  it('un pago se anota con lo que de verdad costó y el estimado no se toca', () => {
    const luz = nuevo('Luz', 90000);
    const movs = [];
    const mov = abonar(luz, movs, '2026-09', 87400);
    expect(mov).toMatchObject({ monto: 87400, fecha: '2026-09-05', tipo: 'gasto', catId: 'viv', nota: 'Luz', recId: luz.id });
    expect(luz.monto).toBe(90000);
    expect(estaPagado(luz, movs, '2026-09')).toBe(true);
    expect(estaPagado(luz, movs, '2026-10')).toBe(false);
  });

  it('el mercado se va pagando por partes y se ve cuánto queda', () => {
    const mercado = nuevo('Mercado', 400000);
    const movs = [];
    abonar(mercado, movs, '2026-09', 130000, { nota: 'Éxito', fecha: '2026-09-03' });
    abonar(mercado, movs, '2026-09', 200000, { nota: 'D1', fecha: '2026-09-10' });
    abonar(mercado, movs, '2026-09', 30000, { nota: 'Domicilios', fecha: '2026-09-12' });
    const e = estadoDelMes(mercado, movs, '2026-09');
    expect(e).toMatchObject({ pagado: 360000, queda: 40000, pasado: 0, estado: 'parcial' });
    expect(e.pagos.map((m) => m.nota)).toEqual(['Éxito', 'D1', 'Domicilios']);
    expect(movs).toHaveLength(3);
  });

  it('los pagos salen en orden de fecha aunque se anoten desordenados', () => {
    const mercado = nuevo('Mercado', 400000);
    const movs = [];
    abonar(mercado, movs, '2026-09', 1000, { nota: 'b', fecha: '2026-09-20' });
    abonar(mercado, movs, '2026-09', 1000, { nota: 'a', fecha: '2026-09-02' });
    expect(pagosDelMes(mercado, movs, '2026-09').map((m) => m.nota)).toEqual(['a', 'b']);
  });

  it('llegar al estimado lo deja pagado y pasarse se dice', () => {
    const mercado = nuevo('Mercado', 400000);
    const movs = [];
    abonar(mercado, movs, '2026-09', 300000);
    abonar(mercado, movs, '2026-09', 100000);
    expect(estadoDelMes(mercado, movs, '2026-09')).toMatchObject({ estado: 'pagado', queda: 0, pasado: 0 });
    abonar(mercado, movs, '2026-09', 25000);
    expect(estadoDelMes(mercado, movs, '2026-09')).toMatchObject({ estado: 'pagado', pasado: 25000 });
  });

  it('pagar lo que falta completa el estimado de una vez', () => {
    const mercado = nuevo('Mercado', 400000);
    const movs = [];
    abonar(mercado, movs, '2026-09', 360000);
    expect(pagarLoQueFalta(mercado, movs, '2026-09').monto).toBe(40000);
    expect(estadoDelMes(mercado, movs, '2026-09').estado).toBe('pagado');
    expect(pagarLoQueFalta(mercado, movs, '2026-09')).toBeNull();
  });

  it('pagar todo sin pagos previos es pagar el estimado', () => {
    const arriendo = nuevo('Arriendo', 1200000);
    const movs = [];
    expect(pagarLoQueFalta(arriendo, movs, '2026-09').monto).toBe(1200000);
    expect(movs).toHaveLength(1);
  });

  it('sin estimado se anota lo que se escriba y con un pago cuenta como pagado', () => {
    const mercado = nuevo('Mercado', 0);
    const movs = [];
    expect(abonar(mercado, movs, '2026-09', 240000).monto).toBe(240000);
    expect(estadoDelMes(mercado, movs, '2026-09')).toMatchObject({ estado: 'pagado', queda: 0, pasado: 0 });
    expect(pagarLoQueFalta(mercado, movs, '2026-09')).toBeNull();
    expect(abonar(nuevo('Nada', 0), [], '2026-09', 0)).toBeNull();
  });

  it('corregir un pago cambia ese mismo movimiento', () => {
    const mercado = nuevo('Mercado', 400000);
    const movs = [];
    const mov = abonar(mercado, movs, '2026-09', 130000, { nota: 'Éxito' });
    editarAbono(mercado, mov, { monto: 135000, fecha: '2026-09-07', nota: '' });
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ monto: 135000, fecha: '2026-09-07', nota: 'Mercado' });
    expect(editarAbono(mercado, mov, { monto: 0 })).toBeNull();
  });

  it('quitar un pago lo saca y dice dónde estaba', () => {
    const mercado = nuevo('Mercado', 400000);
    const movs = [];
    const a = abonar(mercado, movs, '2026-09', 130000);
    abonar(mercado, movs, '2026-09', 200000);
    expect(quitarAbono(a, movs)).toBe(0);
    expect(estadoDelMes(mercado, movs, '2026-09').pagado).toBe(200000);
    expect(quitarAbono(a, movs)).toBe(-1);
  });

  it('lo pendiente es lo que no tiene ni un pago', () => {
    const arriendo = nuevo('Arriendo', 1200000);
    const mercado = nuevo('Mercado', 400000);
    const movs = [];
    expect(pendientes([arriendo, mercado], movs, '2026-09').map((r) => r.n)).toEqual(['Arriendo', 'Mercado']);
    abonar(mercado, movs, '2026-09', 130000);
    expect(pendientes([arriendo, mercado], movs, '2026-09').map((r) => r.n)).toEqual(['Arriendo']);
  });

  it('las notas ya usadas quedan de atajo, sin repetir y la más reciente primero', () => {
    const mercado = nuevo('Mercado', 400000);
    const movs = [];
    abonar(mercado, movs, '2026-08', 1000, { nota: 'D1', fecha: '2026-08-10' });
    abonar(mercado, movs, '2026-09', 1000, { nota: 'Éxito', fecha: '2026-09-03' });
    abonar(mercado, movs, '2026-09', 1000, { nota: 'd1', fecha: '2026-09-01' });
    abonar(mercado, movs, '2026-09', 1000);
    expect(notasUsadas(mercado, movs)).toEqual(['Éxito', 'd1']);
  });

  it('un pago nuevo arranca hoy si se mira el mes en curso', () => {
    const luz = nuevo('Luz', 90000);
    expect(fechaSugerida(luz, '2026-09', '2026-09-23')).toBe('2026-09-23');
    expect(fechaSugerida(luz, '2026-08', '2026-09-23')).toBe('2026-08-05');
  });
});

describe('marcar de una vez', () => {
  it('paga por su estimado los que no tienen ningún pago, y no repite', () => {
    const arriendo = nuevo('Arriendo', 1200000);
    const internet = nuevo('Internet', 90000);
    const mercado = nuevo('Mercado', 0);
    const movs = [];
    const hechos = marcarTodos([arriendo, internet, mercado], movs, '2026-09');
    expect(hechos.map((m) => m.nota)).toEqual(['Arriendo', 'Internet']);
    expect(marcarTodos([arriendo, internet, mercado], movs, '2026-09')).toEqual([]);
    expect(movs).toHaveLength(2);
  });

  it('no toca uno que ya va por partes', () => {
    const mercado = nuevo('Mercado', 400000);
    const movs = [];
    abonar(mercado, movs, '2026-09', 130000);
    expect(marcarTodos([mercado], movs, '2026-09')).toEqual([]);
  });

  it('con una lista de ids marca solo esos', () => {
    const arriendo = nuevo('Arriendo', 1200000);
    const internet = nuevo('Internet', 90000);
    const movs = [];
    marcarTodos([arriendo, internet], movs, '2026-09', [internet.id]);
    expect(movs.map((m) => m.nota)).toEqual(['Internet']);
  });
});

describe('resumen del mes', () => {
  it('separa lo estimado de lo pagado, dice cuánto queda y cuenta los que faltan', () => {
    const arriendo = nuevo('Arriendo', 1200000);
    const luz = nuevo('Luz', 90000);
    const mercado = nuevo('Mercado', 400000);
    const sueldo = nuevoRecurrente({ n: 'Sueldo', monto: 3000000, tipo: 'ingreso' });
    const movs = [];
    abonar(luz, movs, '2026-09', 87400);
    abonar(mercado, movs, '2026-09', 130000);
    abonar(mercado, movs, '2026-09', 200000);
    expect(resumen([arriendo, luz, mercado, sueldo], movs, '2026-09', 'gasto'))
      .toEqual({ estimado: 1690000, pagado: 417400, queda: 1200000 + 2600 + 70000, faltan: 1, total: 3 });
    expect(resumen([arriendo, luz, mercado, sueldo], movs, '2026-09', 'ingreso'))
      .toEqual({ estimado: 3000000, pagado: 0, queda: 3000000, faltan: 1, total: 1 });
  });
});

describe('deudas en cuotas', () => {
  const carro = () => nuevo('Carro', 500000, { cuotas: { total: 12, desde: '2026-03' } });

  it('dice qué cuota va y solo aparece en sus meses', () => {
    const r = carro();
    expect(numeroCuota(r, '2026-09')).toBe(7);
    expect(mesFinal(r)).toBe('2027-02');
    expect(activoEn(r, '2026-02')).toBe(false);
    expect(activoEn(r, '2026-03')).toBe(true);
    expect(activoEn(r, '2027-02')).toBe(true);
    expect(activoEn(r, '2027-03')).toBe(false);
    expect(activoEn(nuevo('Luz', 90000), '1999-01')).toBe(true);
  });

  it('fuera de sus meses no cuenta como pendiente ni en el resumen', () => {
    const r = carro();
    expect(pendientes([r], [], '2027-05')).toEqual([]);
    expect(resumen([r], [], '2027-05', 'gasto').total).toBe(0);
    expect(marcarTodos([r], [], '2027-05')).toEqual([]);
  });

  it('lo que falta sale de lo pagado de verdad, abonos incluidos', () => {
    const r = carro();
    const movs = [];
    for (let i = 0; i < 6; i += 1) abonar(r, movs, `2026-0${3 + i}`, 500000);
    abonar(r, movs, '2026-09', 200000);
    expect(estadoDeuda(r, movs, '2026-09'))
      .toMatchObject({ total: 12, cuota: 7, deuda: 6000000, pagado: 3200000, falta: 2800000, fin: '2027-02', estado: 'en curso' });
  });

  it('una deuda sin cuotas válidas es un recurrente normal', () => {
    expect(nuevo('X', 1, { cuotas: { total: 0, desde: '2026-01' } }).cuotas).toBeUndefined();
    expect(normalizarCuotas({ total: 3, desde: 'mal' })).toBeNull();
    expect(estadoDeuda(nuevo('Luz', 1), [], '2026-09')).toBeNull();
    expect(mesesEntre('2026-11', '2027-02')).toBe(3);
  });
});

describe('lo que viene', () => {
  it('avisa los que vencen pronto y los vencidos, sin los ya pagados', () => {
    const arriendo = nuevo('Arriendo', 1200000, { dia: 1 });
    const luz = nuevo('Luz', 90000, { dia: 20 });
    const internet = nuevo('Internet', 90000, { dia: 25 });
    const agua = nuevo('Agua', 50000, { dia: 28 });
    const sueldo = nuevoRecurrente({ n: 'Sueldo', monto: 1, tipo: 'ingreso', dia: 24 });
    const movs = [];
    abonar(internet, movs, '2026-09', 90000);
    const v = vencimientos([arriendo, luz, internet, agua, sueldo], movs, '2026-09-23', 7);
    expect(v.map((x) => [x.rec.n, x.en])).toEqual([['Arriendo', -22], ['Luz', -3], ['Agua', 5]]);
  });

  it('mira también el comienzo del mes siguiente', () => {
    const arriendo = nuevo('Arriendo', 1200000, { dia: 1 });
    abonar(arriendo, [], '2026-09', 1);
    const movs = [];
    abonar(arriendo, movs, '2026-09', 1200000);
    expect(vencimientos([arriendo], movs, '2026-09-28', 7).map((x) => [x.fecha, x.en])).toEqual([['2026-10-01', 3]]);
  });

  it('dice cuándo vence en palabras', () => {
    expect([0, 1, 4, -1, -3].map(cuandoVence)).toEqual(['vence hoy', 'vence mañana', 'vence en 4 días', 'venció ayer', 'venció hace 3 días']);
    expect(diasEntre('2026-02-27', '2026-03-02')).toBe(3);
  });

  it('proyecta con cuánto terminas si pagas y recibes lo que falta', () => {
    const arriendo = nuevo('Arriendo', 1200000);
    const mercado = nuevo('Mercado', 400000);
    const sueldo = nuevoRecurrente({ n: 'Sueldo', monto: 3000000, tipo: 'ingreso' });
    const movs = [];
    abonar(mercado, movs, '2026-09', 360000);
    expect(proyeccion(500000, [arriendo, mercado, sueldo], movs, '2026-09'))
      .toEqual({ final: 500000 - 1240000 + 3000000, porPagar: 1240000, porRecibir: 3000000 });
  });
});

describe('calendario', () => {
  it('arma un evento mensual por gasto, con aviso y el 31 cae al final de mes', () => {
    const ics = calendarioICS([
      nuevo('Arriendo', 1200000, { dia: 5 }),
      nuevo('Tarjeta', 0, { dia: 31 }),
      nuevo('Carro', 500000, { dia: 10, cuotas: { total: 12, desde: '2026-03' } }),
      nuevoRecurrente({ n: 'Sueldo', monto: 1, tipo: 'ingreso' }),
    ], '2026-09-23', new Date('2026-09-23T10:00:00Z'));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260905');
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=5\r\n');
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1');
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=10;COUNT=6');
    expect(ics).toContain('SUMMARY:Pagar Arriendo ($ 1.200.000)');
    expect(ics).not.toContain('Sueldo');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  });
});
