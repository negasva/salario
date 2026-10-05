/* Cuando dos copias del perfil cambiaron a la vez (el teléfono sin red y el
   computador, por ejemplo) no se escoge una y se pierde la otra: se juntan.
   Lo que existe en cualquiera de las dos se queda; si el mismo id está en las
   dos, gana la copia de este dispositivo, que es la que acaba de editarse.
   Los demás datos (saldo inicial, nombre, persona) son los de la nube.
   ponytail: sin lápidas, lo que se borró en un lado vuelve si el otro aún lo
   tiene; si estorba, guardar los ids borrados. */

const porId = (local = [], remoto = []) => {
  const m = new Map();
  [...remoto, ...local].forEach((x) => m.set(x.id, x));
  return [...m.values()];
};

export function fusionar(local, remoto) {
  return {
    ...remoto,
    cats: porId(local.cats, remoto.cats),
    movs: porId(local.movs, remoto.movs),
    recurrentes: porId(local.recurrentes, remoto.recurrentes),
    metas: porId(local.metas, remoto.metas),
    arranques: { ...remoto.arranques, ...local.arranques },
    sobrante: { ...(remoto.sobrante || {}), ...(local.sobrante || {}), hechos: { ...(remoto.sobrante?.hechos), ...(local.sobrante?.hechos) } },
    ignoradas: [...new Set([...(remoto.ignoradas || []), ...(local.ignoradas || [])])],
  };
}
