/* Movimiento de números y barras. La app repinta con `innerHTML`, así que un
   número no sabe de dónde viene: el valor anterior se guarda aquí por clave y
   al repintar se anima del viejo al nuevo. Sin clave no hay animación, que es
   lo correcto la primera vez que algo aparece en pantalla. */

const previos = new Map();

export function sinMotion() {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/* Cuenta de un valor a otro. `formato` decide cómo se escribe cada cuadro, así
   que sirve igual para pesos, para porcentajes y para "quedan X sin repartir".
   Se apoya en rAF y no en un intervalo: si la pestaña se va al fondo, se para. */
export function contarHasta(el, desde, hasta, formato, ms = 300) {
  if (!el) return;
  if (sinMotion() || desde === hasta) { el.textContent = formato(hasta); return; }
  const t0 = performance.now();
  // ease-out cúbico: arranca rápido y frena, que es como se lee un total
  const curva = (t) => 1 - (1 - t) ** 3;
  const paso = (ahora) => {
    const t = Math.min(1, (ahora - t0) / ms);
    el.textContent = formato(desde + (hasta - desde) * curva(t));
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/* Anima todo `[data-num][data-key]` dentro de `scope` desde lo que valía la
   última vez que se pintó esa misma clave. El texto ya viene puesto por el
   render, así que si no hay valor previo no se toca nada y no hay parpadeo. */
export function animarNumeros(scope, formato) {
  scope.querySelectorAll('[data-num][data-key]').forEach((el) => {
    const { key } = el.dataset;
    const hasta = Number(el.dataset.num) || 0;
    const desde = previos.get(key);
    previos.set(key, hasta);
    if (desde === undefined || desde === hasta) return;
    contarHasta(el, desde, hasta, formato);
  });
}

/* F10 — revelar al entrar en pantalla: fade y 12px de subida, una sola vez y
   sin parallax. Dos precauciones deliberadas:

   - El estado oculto lo pone el JS, nunca el CSS. Si este módulo no corre, o el
     navegador no trae `IntersectionObserver`, todo se ve: una sección en blanco
     por un fallo de una animación decorativa sería un desastre muy caro para lo
     poco que aporta el efecto.
   - Solo se marcan los elementos que arrancan por debajo del pliegue. Lo que ya
     está en pantalla no tiene "entrada" que hacer: animarlo sería un parpadeo
     en cada repintado. */
export function revelarAlEntrar(scope, sel = '.card,.cat-card') {
  if (sinMotion() || typeof IntersectionObserver === 'undefined') return;
  const alto = window.innerHeight;
  const tarde = [...scope.querySelectorAll(sel)]
    .filter((el) => el.getBoundingClientRect().top > alto * 0.9);
  if (!tarde.length) return;

  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('revelado');
      obs.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });

  tarde.forEach((el) => { el.classList.add('revelar'); obs.observe(el); });
}
