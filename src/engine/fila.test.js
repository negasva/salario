import { describe, it, expect } from 'vitest';
import {
  ordenadas, reasignar, mover, soltar, siguienteEnFila, metaCumplida,
  mezclarAsignacion, aplicarTraspaso, traspasoVencido, proyeccion, DIA_MS,
} from './fila.js';
import { claimedBy, freeFor } from './reparto.js';
import { metasEnItem, conflictosDeMetas } from './metas.js';

const items = [{ id: 'cor', n: 'Ahorro corto plazo', p: 20, r: 'cor', L: [] }];
const INC = 5000000; // el bloque son 1.000.000 al mes

function metas() {
  return [
    { id: 'fondo', n: 'Fondo de emergencia', special: 'emergencia', orden: 0, estado: 'activa', t: 4000000, s: 0, a: {} },
    { id: 'moto', n: 'Moto', orden: 1, estado: 'activa', t: 24000000, s: 0, a: { cor: 80 } },
    { id: 'viaje', n: 'Viaje', orden: 2, estado: 'en_fila', t: 6000000, s: 0, a: {} },
  ];
}

describe('F5.1 orden', () => {
  it('el fondo de emergencia siempre va de primero', () => {
    const gs = metas();
    gs[0].orden = 9;
    expect(ordenadas(gs).map((g) => g.id)).toEqual(['fondo', 'moto', 'viaje']);
  });

  it('reasignar renumera de corrido y deja el fondo en 0', () => {
    const gs = reasignar(ordenadas(metas()));
    expect(gs.map((g) => g.orden)).toEqual([0, 1, 2]);
  });

  it('las flechas mueven la meta dentro de la fila', () => {
    const gs = metas();
    expect(mover(gs, 'viaje', -1)).toBe(true);
    expect(ordenadas(gs).map((g) => g.id)).toEqual(['fondo', 'viaje', 'moto']);
  });

  it('no se puede subir mas alla del primer puesto movible', () => {
    const gs = metas();
    expect(mover(gs, 'moto', -1)).toBe(false);
    expect(ordenadas(gs).map((g) => g.id)).toEqual(['fondo', 'moto', 'viaje']);
  });

  it('el fondo no se mueve de su puesto', () => {
    const gs = metas();
    expect(mover(gs, 'fondo', 1)).toBe(false);
    expect(soltar(gs, 'moto', 'fondo')).toBe(false);
    expect(gs.find((g) => g.id === 'fondo').orden).toBe(0);
  });

  it('soltar deja la meta en el puesto de la otra', () => {
    const gs = metas();
    expect(soltar(gs, 'viaje', 'moto')).toBe(true);
    expect(ordenadas(gs).map((g) => g.id)).toEqual(['fondo', 'viaje', 'moto']);
  });
});

describe('F5.2 una meta en fila no consume bloque', () => {
  it('no cuenta en claimedBy ni le baja el tope a las activas', () => {
    const gs = metas();
    gs[2].a = { cor: 50 }; // su reparto se guarda...
    expect(claimedBy(gs, 'cor', null)).toBe(80); // ...pero no cuenta
    expect(freeFor(gs, gs[1], 'cor')).toBe(100);
  });

  it('no aparece como comprometida en el bloque', () => {
    const gs = metas();
    gs[2].a = { cor: 50 };
    expect(metasEnItem(gs, items[0], INC).map((x) => x.goal.id)).toEqual(['moto']);
  });

  it('no pelea con nadie: una meta en fila no esta en conflicto', () => {
    const gs = metas();
    gs[2].a = { cor: 50 };
    expect(conflictosDeMetas(gs)).toEqual([]);
  });
});

describe('F5.2 traspaso', () => {
  it('detecta la meta activa que llego a su objetivo', () => {
    const gs = metas();
    gs[1].s = 24000000;
    expect(metaCumplida(gs).id).toBe('moto');
  });

  it('una meta en fila cumplida no dispara nada', () => {
    const gs = metas();
    gs[2].s = 99999999;
    expect(metaCumplida(gs)).toBe(null);
  });

  it('la siguiente de la fila es la de menor orden', () => {
    const gs = metas();
    expect(siguienteEnFila(gs).id).toBe('viaje');
  });

  it('la asignacion pasa entera y la meta queda completa', () => {
    const gs = metas();
    gs[1].s = 24000000;
    aplicarTraspaso(gs[1], gs[2]);
    expect(gs[1].estado).toBe('completa');
    expect(gs[1].a).toEqual({});
    expect(gs[2].estado).toBe('activa');
    expect(gs[2].a).toEqual({ cor: 80 });
  });

  it('a mano libera el bloque sin repartirlo', () => {
    const gs = metas();
    aplicarTraspaso(gs[1], gs[2], true);
    expect(gs[1].a).toEqual({});
    expect(gs[2].a).toEqual({});
    expect(gs[2].estado).toBe('activa');
  });

  it('lo que la meta de la fila ya reclamaba se suma, con tope 100', () => {
    expect(mezclarAsignacion({ cor: 40 }, { cor: 80, lar: 10 })).toEqual({ cor: 100, lar: 10 });
  });

  it('vence a las 24 horas', () => {
    const t = { creado: 0 };
    expect(traspasoVencido(t, DIA_MS - 1)).toBe(false);
    expect(traspasoVencido(t, DIA_MS)).toBe(true);
    expect(traspasoVencido(null, DIA_MS)).toBe(false);
  });
});

describe('F5.3 proyeccion de la fila', () => {
  it('la meta en fila arranca cuando termina la de adelante', () => {
    const gs = metas();
    const pr = proyeccion(gs, items, INC);
    // moto: 24.000.000 a 800.000 al mes = 30 meses
    expect(pr.moto.dura).toBe(30);
    expect(pr.viaje.empieza).toBe(30);
    expect(pr.viaje.predecesor.n).toBe('Moto');
    // hereda los 800.000: 6.000.000 son 8 meses mas
    expect(pr.viaje.dura).toBe(8);
    expect(pr.viaje.fin).toBe(38);
  });

  it('sin aporte no hay fecha, ni para la que espera', () => {
    const gs = metas();
    gs[1].a = {};
    const pr = proyeccion(gs, items, INC);
    expect(pr.moto.dura).toBe(null);
    expect(pr.viaje.empieza).toBe(null);
  });

  it('las metas completas no ocupan puesto en la fila', () => {
    const gs = metas();
    gs[1].estado = 'completa';
    expect(proyeccion(gs, items, INC).moto).toBe(undefined);
  });
});
