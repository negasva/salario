// F5 — el orden de las metas y nada más. El estado "en fila", el traspaso
// automático y la proyección de turnos se fueron: una meta o está activa o ya
// la cumpliste.

export function estadoDe(g) {
  return g.estado === 'completa' ? 'completa' : 'activa';
}

// El fondo de emergencia vive en orden 0 y no se mueve de ahí.
function ordenDe(g) {
  return g.special ? 0 : Number(g.orden) || 0;
}

export function ordenadas(goals) {
  return goals.slice().sort((a, b) => ordenDe(a) - ordenDe(b));
}

// Renumera de corrido para que no queden huecos ni empates.
export function reasignar(lista) {
  let i = 1;
  lista.forEach((g) => { g.orden = g.special ? 0 : i++; });
  return lista;
}

function recolocar(goals, id, destino) {
  const lista = ordenadas(goals);
  const fijas = lista.filter((g) => g.special);
  const movibles = lista.filter((g) => !g.special);
  const i = movibles.findIndex((g) => g.id === id);
  const j = typeof destino === 'number' ? destino : movibles.findIndex((g) => g.id === destino);
  if (i < 0 || j < 0 || j >= movibles.length || i === j) return false;
  movibles.splice(j, 0, movibles.splice(i, 1)[0]);
  reasignar([...fijas, ...movibles]);
  return true;
}

// flechas arriba/abajo de la tarjeta
export function mover(goals, id, delta) {
  const movibles = ordenadas(goals).filter((g) => !g.special);
  const i = movibles.findIndex((g) => g.id === id);
  return i < 0 ? false : recolocar(goals, id, i + delta);
}

// arrastrar y soltar: `id` queda donde estaba `sobreId`
export function soltar(goals, id, sobreId) {
  return recolocar(goals, id, sobreId);
}
