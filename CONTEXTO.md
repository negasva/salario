# Reparto mensual

## Qué es

Una app de presupuesto personal para una sola persona, sin nómina, sin equipos, sin categorías de empresa. La idea de fondo es vieja y conocida: repartes el sueldo en bloques de porcentaje antes de gastarlo, y cada peso que sale tiene que salir de un bloque. Lo que cambia aquí es que los bloques no son un adorno. La app calcula qué pasa con tus metas cuando mueves un slider, y te dice el precio en meses.

Está en español de Colombia, con pesos por defecto, aunque acepta MXN, USD, ARS, CLP, PEN y EUR. El diseño es rosa chicle sobre tinta casi negra, y no es negociable: es la identidad visual del proyecto.

## Para qué sirve

El problema que resuelve no es "no sé cuánto gasté". Para eso ya hay veinte apps que leen tu banco. El problema es el otro: sabes que quieres una moto de 24 millones y un fondo de emergencia, tienes 5,5 millones al mes, y no tienes ni idea de si eso significa dos años o siete, ni de qué tienes que dejar de hacer para que sean dos.

Entonces la app responde tres preguntas en concreto:

1. Si guardo esto al mes, ¿cuándo la tengo? (con mes y año, no con un porcentaje abstracto)
2. Si la quiero en tal fecha, ¿cuánto tengo que guardar y de dónde lo saco?
3. Mis dos metas están peleando por el mismo bloque de ahorro. ¿Qué pasa si las hago en paralelo y qué pasa si las hago en fila?

Y desde que existe el libro de movimientos responde una cuarta, que es la que hace que las otras tres sirvan de algo: **¿el plan que hiciste se parece en algo a lo que de verdad pasó?**

También hace una cosa que casi ninguna app hace: te dice cuándo el problema no es que ahorres poco. Si tus esenciales pasan el 65% del ingreso, la recomendación de ahorro se corta a la mitad y el mensaje cambia. No sirve pedirle disciplina a alguien cuyo arriendo se come tres cuartas partes del sueldo.

## Cómo funciona por dentro

### La estructura de datos

Todo cuelga de un **perfil**. Un perfil es un presupuesto completo y aislado: su ingreso, su moneda, sus categorías, sus metas, sus movimientos. Puedes tener varios (uno personal y uno familiar, o uno real y uno de simulación) y se cambia entre ellos desde Ajustes o con el buscador de arriba.

```js
{
  id, name, remoteId,
  inc, cur,                        // ingreso y moneda
  ingresoTipo, ingresoHistorial,   // 'fijo' | 'variable'
  tasaInteres, fondoMeses,         // costo de oportunidad y meses del fondo
  metodoDeuda,                     // 'avalancha' | 'bolaDeNieve'
  items, goals, movs,
  traspaso,                        // F5: el traspaso de fila esperando respuesta
  updated,
}
```

Dentro de un perfil hay tres listas que se cruzan.

Las **categorías** (`items`) son los bloques del reparto. Vienen cinco por defecto: Esenciales 55%, Gasto libre 5%, Deudas 10%, Ahorro corto plazo 15%, Inversión largo plazo 15%. Cada una tiene un porcentaje, un color, un rol (`r`) y una lista de renglones (`L`) donde escribes los conceptos reales: arriendo, servicios, mercado. Cada renglón se marca como fijo o variable, y esa marca no es decorativa: el plan de recorte solo toca variables, y el objetivo del fondo de emergencia se calcula como los fijos más la mitad de los variables.

Los renglones de un bloque con rol `deu` llevan además `saldo`, `tasa` y `minimo`. Vacíos, el renglón se comporta como cualquier otro.

Las **metas** (`goals`) son las cosas que quieres comprar. Cada meta guarda un mapa `a` que dice qué porcentaje de cada bloque reclama. Si la Moto tiene `a = { ahorroCorto: 88 }`, se lleva el 88% de lo que caiga en ese bloque cada mes. Ese mapa es el corazón del cálculo y también la fuente del conflicto: si dos metas suman más de 100% del mismo bloque, la app lo detecta y baja el tope del slider de la segunda.

Cada meta lleva además un `orden` y un `estado` (`activa`, `en_fila` o `completa`), que son los que arman la fila. El fondo de emergencia siempre tiene `orden: 0` y no se mueve de ahí.

El **fondo de emergencia** es una meta especial (`special: 'emergencia'`) que la app crea sola y no te deja borrar. Su objetivo se recalcula desde tus esenciales por el número de meses que elijas, entre tres y seis. Si lo editas a mano queda marcado `manual` y la app deja de recalcularlo: el número que escribiste gana.

Los **movimientos** (`movs`) son el libro de lo que de verdad entró y salió. Un movimiento es esto y nada más:

```js
{
  id, fecha,      // ISO corto, sin hora, sin zona horaria
  tipo,           // 'gasto' | 'ingreso'
  monto,          // siempre positivo, el signo lo da el tipo
  itemId,         // categoría a la que carga
  lineId,         // renglón concreto, opcional
  goalId,         // si el gasto es un aporte a una meta
  nota, extra,    // `extra`: ingreso que no es la nómina
}
```

Una sola estructura resuelve cuatro cosas: aporte a meta (`goalId`), cierre de mes real (agrupar por `itemId` y periodo), alerta de renglón que creció (agrupar por `lineId`) e ingreso extra (`tipo: 'ingreso'` con `extra: true`). No hay cuatro sistemas separados, y esa es la decisión de diseño central de todo lo que se construyó después.

Al arrancar se podan los movimientos de más de 24 meses. El perfil entero viaja como un blob JSON y sin poda crecería sin techo.

### El motor de cálculo

Está aislado en `src/engine/` y es lo único con pruebas, porque es lo único con lógica de negocio real. Todo es puro: recibe datos, devuelve datos, nunca toca el store ni el DOM. Son 91 pruebas en siete archivos.

`reparto.js` hace la aritmética base. Suma porcentajes, convierte porcentaje a monto, separa fijos de variables, y calcula cuánto queda libre de un bloque después de que las otras metas lo reclamaron.

`metas.js` hace lo interesante. Calcula cuánto va hacia una meta al mes, en cuántos meses la alcanzas, la cuota necesaria para una fecha objetivo, el plan de recorte cuando no alcanza, tres escenarios comparables (conservador, equilibrado, agresivo), el costo de oportunidad de ese dinero invertido a cinco y diez años, la detección de metas en competencia, y cuánto se lleva cada meta de un bloque dado.

`fila.js` maneja la fila: el orden de las metas, quién sigue, el traspaso de una asignación a la siguiente, y la proyección de cuándo le toca el turno a cada una.

`consejo.js` tiene la parte opinada. Recomienda el reparto entre corto y largo plazo según el estado de tu fondo, y maneja el ingreso variable.

`movimientos.js` agrega el libro: por periodo, por bloque, por renglón, ingreso real contra extra, y lo aportado a cada meta. También `hoyISO()`, que construye la fecha en local a propósito — `toISOString()` convierte a UTC y al este de Greenwich el día 1 del mes cae en el periodo anterior.

`cierre.js` arma el snapshot del mes, calcula qué meses quedaron sin cerrar, y saca la brecha entre lo planeado y lo gastado.

`deudas.js` amortiza. Meses para liquidar, intereses totales, orden de ataque por avalancha o bola de nieve, y el plan que reparte el presupuesto del bloque. Todo sale de una sola simulación mes a mes en vez de la fórmula cerrada: es exacta con el último pago parcial, y el plan la necesita igual, porque cuando una deuda cae su mínimo se suma al sobrante y arrastra a la siguiente. De ahí sale la ventaja de los dos métodos.

Hay una regla de prioridad que atraviesa todo, la escalera de cinco peldaños que se ve en el dashboard: mínimos de deuda, un mes de fondo, fondo completo, metas, inversión de largo plazo. La app te dice en cuál estás y te avisa si estás creando una meta del peldaño 4 cuando todavía andas en el 2. El peldaño 1 se verifica de verdad contra los mínimos de tus deudas y el presupuesto del bloque.

### El plan de recorte

Cuando le pides una meta para una fecha y no te alcanza, la app no dice "ahorra más". Busca de dónde sacarlo, en este orden y con estas restricciones: baja el gasto libre hasta un piso del 2% del ingreso, recorta el 20% de los renglones variables de esenciales, pausa la inversión de largo plazo, y solo si tu fondo ya está completo toca el ahorro de corto plazo.

Nunca toca renglones fijos ni mínimos de deuda. Y cada recorte viene con su precio escrito al lado, en lenguaje normal: "pausas la inversión 14 meses", no "ajuste del bloque 5".

### La fila de metas

Dos metas que quieren el mismo bloque ya no pelean para siempre. Una se pone `en_fila` y espera: su reparto se guarda, pero no consume nada, así que no le baja el tope a la que está corriendo. `claimedBy()` la ignora, y por eso el slider de la meta activa vuelve a llegar hasta donde debería.

Cuando la meta activa llega a su objetivo, su asignación entera pasa a la siguiente de la fila, que se vuelve activa. Eso no pasa en silencio: sale un anuncio que tapa la pantalla y dice `Terminaste la meta Moto. Los $1.813.064 al mes pasan ahora a Fondo de emergencia.`, con un botón para aceptar y otro para repartirlo a mano. El de a mano libera el porcentaje sin asignárselo a nadie y abre la meta que sigue para que lo acomodes tú.

Si nadie contesta, a las 24 horas se aplica solo. El dinero no se queda sin dueño. Como no hay cron ni servidor, el reloj se mira cuando la app está abierta, igual que el cierre de mes: el traspaso pendiente vive en el perfil (`p.traspaso`) y sobrevive a que cierres la pestaña.

Si no hay nadie esperando en la fila, no pasa nada. La meta cumplida sigue como estaba y el anuncio sale el día que pongas otra meta detrás; así una meta que ya alcanzaste no se queda sin su bloque sin que lo hayas pedido.

### El cierre de mes

Al arrancar, la app cierra los meses que quedaron pendientes. No hay cron ni servidor: se cierra el mes la primera vez que abres la app pasado el día 1, y si no la abres en tres meses, al volver se cierran los tres de una. Solo se cierran meses en los que hay algo registrado, para que una cuenta recién abierta no se llene de cierres vacíos hacia atrás.

El snapshot `version: 2` guarda plan contra real por bloque, los renglones con gasto, el ingreso real y el extra, y lo aportado a cada meta. Los snapshots viejos solo traen `essentialsShare` y `ahorroRate` y no llevan `version`; todo lo que lee los campos ricos comprueba `version >= 2` antes de tocarlos.

Un cierre nace en borrador y se edita en Historial: el planeado a la izquierda, el real editable a la derecha precargado con la suma de movimientos, más el ingreso y una nota libre. `Confirmar cierre` quita el borrador, `Volver a editar` lo reabre. Nada queda congelado para siempre, porque siempre hay algo que se olvidó registrar, y la alternativa sería inventar movimientos con fecha falsa.

### Ingreso variable

Si trabajas por tu cuenta y el ingreso no es el mismo cada mes, cambias el perfil a variable y metes los últimos tres meses. A partir de ahí la app usa dos números distintos según para qué: el **promedio** para repartir porcentajes, y el **mínimo** para calcular si tus esenciales son sostenibles. Esa asimetría es a propósito. Repartir sobre el promedio es razonable, pero medir tus gastos fijos contra el promedio es cómo la gente se mete en problemas.

Si el último mes fue mejor que el promedio, la app calcula el excedente y sugiere 70% a metas y fondo, 30% libre.

### Persistencia

Dos capas. `localStorage` bajo la llave `reparto:v8` es caché, y Supabase es la fuente de verdad. La UI escribe local de inmediato y empuja al servidor con dos segundos de retraso, así que nunca te quedas esperando a la red. Si el push falla, reintenta a los cuatro segundos y vuelve a intentar cuando el navegador avisa que hay conexión. `OLD_KEYS` lee las llaves viejas para no perder el caché de nadie al subir de versión.

Hay dos tablas. `perfiles` guarda todo el presupuesto vivo como un blob JSON. `cierres` guarda un snapshot por mes cerrado, con el periodo en formato `AAAA-MM`. Ambas con row level security amarrada a `auth.uid()`. El upsert de perfiles devuelve su `id` y ese `id` se guarda en `p.remoteId`: sin eso cada guardado insertaría una fila nueva, y todo el historial se cae detrás.

La autenticación es correo y contraseña de Supabase, con recuperación por enlace. Si empezaste a usar la app sin cuenta y después te registras, lo que tenías en local se sube como perfil inicial y sale un aviso.

### Las seis vistas

**Dashboard** es el resumen. Ingreso editable, cuánto por ciento llevas repartido, estado del fondo, la escalera de prioridad, la tasa de ahorro con su tendencia, el reparto por bloques y los anillos de progreso de cada meta. Si tus esenciales pasan del 50% aparece una tarjeta de advertencia con los tres renglones que más pesan. Si la app cerró meses por ti al arrancar, sale un banner que lleva a Historial.

**Categorías** es donde vive el detalle. Cada bloque con su slider, su porcentaje, su monto en pesos, y la lista de conceptos. Debajo de los conceptos, lo que las metas ya reclaman de ese bloque, con un botón `Ya lo guardé` que registra el aporte del mes. Al pie, la cuenta completa: presupuesto, gastos reales, comprometido por metas, y el libre. En un bloque de deudas, cada renglón muestra en cuánto se liquida y cuántos intereses cuesta, y al final el comparativo entre avalancha y bola de nieve.

**Metas** es la vista con más lógica. Las metas se reordenan arrastrando la tarjeta —`draggable` del navegador, sin librería— y con un par de flechas arriba/abajo, que es lo que se usa en el celular. Las que están en fila se pintan atenuadas y dicen `Empieza cuando termines la meta Moto, hacia septiembre de 2027`. Cada meta se puede calcular por monto, en N meses, o para una fecha. Hay tres rutas sugeridas de un clic (con tus ahorros, sin tocar la inversión, acelerado) y debajo el ajuste bloque por bloque con sliders. Ahí aparece el plan de recorte, los escenarios, y el costo de oportunidad.

**Movimientos** es el libro. Una fila fija arriba para meter un gasto en tres toques: el foco arranca en el monto y `Enter` guarda y limpia sin soltarlo, para cargar varios seguidos. Un toggle cambia a ingreso y saca la casilla de ingreso extra. Debajo, el resumen del mes con presupuesto contra real por bloque, y la lista agrupada por día. Selector de mes con flechas.

**Historial** cierra el mes y guarda el snapshot. Muestra la tasa de ahorro mes a mes, los esenciales como porcentaje del ingreso con semáforo, la comparación contra el promedio de los tres meses anteriores, y por cada cierre las barras enfrentadas de plan contra real con la brecha dicha en una frase.

**Ajustes** tiene los perfiles, el tipo de ingreso, los meses objetivo del fondo, la tasa anual para el costo de oportunidad, y exportar/importar en JSON.

## El stack y por qué

Vite con JavaScript plano, sin React ni nada parecido. El estado completo cabe en un módulo y no justifica un framework. Las vistas son funciones que reciben un nodo y le escriben `innerHTML`, con los handlers cableados a mano después. Si una vista necesita mandar a otra, despacha un `CustomEvent` (`ir-a-meta`, `ir-a-vista`) y `main.js` navega: así ninguna vista monta una hoja sobre el root de otra.

Los gráficos son SVG escrito a mano. Cinco tipos de gráfico no justifican traerse una librería de charts.

Una sola dependencia en producción: `@supabase/supabase-js`. Vitest para las pruebas del motor.

El sistema de color es un archivo de tokens y una regla que se respeta en todas partes: las tarjetas siempre más claras que el fondo.

## Cómo correrlo

```
npm install
cp .env.example .env    # VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

Para el backend: creas el proyecto en supabase.com, corres `supabase/schema.sql` en el editor SQL, dejas activo el proveedor de correo y contraseña, y copias las dos variables. Para desplegar, se importa el repo en Vercel con preset Vite y las mismas dos variables de entorno.

`npm run test` corre las pruebas del motor. `npm run build` genera `dist/`.

## Lo que todavía no está resuelto

Vale la pena decirlo en voz alta, porque el código no lo dice.

**El progreso de una meta se cuenta por dos caminos.** `goal.s` y `goal.aportes` por un lado, y los movimientos con `goalId` por el otro. `Ya lo guardé` en Categorías escribe en los dos y los mantiene sincronizados, pero un aporte metido a mano desde Movimientos no mueve `goal.s`. Lo limpio es que `goal.s` salga de `aportesAMeta()` y `goal.aportes` desaparezca; eso cambia cómo se calcula el progreso de toda meta, así que no se ha tocado.

**El botón "Aplicar" del plan de recorte no aplica nada.** Mueve un contador visual y opaca la tarjeta, pero no toca los porcentajes.

**`digits()` se come los decimales.** Todo campo de dinero parsea con `digits()`, que descarta lo que no sea dígito. En COP, CLP y ARS da igual porque no se usan decimales, pero en USD o EUR un `85,000.50` se lee como `8500050`. Es consistente en toda la app, y por eso mismo es un solo arreglo cuando toque hacerlo.

**Las alertas de renglón que creció todavía no existen.** El motor ya agrupa por `lineId` y los cierres ya guardan el gasto real por renglón, así que los datos están; falta la vista que los compare mes contra mes.
