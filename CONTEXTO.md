# Reparto mensual

## Qué es

Una app de presupuesto personal para una sola persona, sin nómina, sin equipos, sin categorías de empresa. La idea de fondo es vieja y conocida: repartes el sueldo en categorías antes de gastarlo, y cada peso que sale tiene que salir de una categoría. El reparto se escribe en plata, no en porcentajes: a cada categoría le asignas cuánto le toca este mes, y la app te dice si te falta plata por repartir o si te pasaste, y por cuánto. Lo que cambia aquí es que los bloques no son un adorno: la app calcula qué pasa con tus metas cuando mueves un monto, y te dice el precio en meses.

Está en español de Colombia, con pesos por defecto y soporte para USD y EUR con la tasa del día. El diseño es rosa chicle sobre tinta casi negra, y no es negociable: es la identidad visual del proyecto.

## Para qué sirve

El problema que resuelve no es "no sé cuánto gasté". Para eso ya hay veinte apps que leen tu banco. El problema es el otro: sabes que quieres una moto de 24 millones y un fondo de emergencia, tienes 5,5 millones al mes, y no tienes ni idea de si eso significa dos años o siete, ni de qué tienes que dejar de hacer para que sean dos.

Entonces la app responde tres preguntas en concreto:

1. Si guardo esto al mes, ¿cuándo la tengo? (con mes y año, no con un porcentaje abstracto)
2. Si la quiero en tal fecha, ¿cuánto tengo que guardar al mes?
3. Si guardo esta cifra al mes para dos metas a la vez, ¿me alcanza el sueldo o me estoy pasando?

Y desde que existe el libro de movimientos responde una cuarta, que es la que hace que las otras tres sirvan de algo: **¿el plan que hiciste se parece en algo a lo que de verdad pasó?**

También hace una cosa que casi ninguna app hace: te dice cuándo el problema no es que ahorres poco. Si tus esenciales pasan el 65% del ingreso, la recomendación de ahorro se corta a la mitad y el mensaje cambia. No sirve pedirle disciplina a alguien cuyo arriendo se come tres cuartas partes del sueldo.

## Cómo funciona por dentro

### La estructura de datos

Todo cuelga de un **perfil**. Un perfil es un presupuesto completo y aislado: su ingreso, su moneda, sus categorías, sus metas, sus movimientos. Puedes tener varios (uno personal y uno familiar, o uno real y uno de simulación) y se cambia entre ellos desde Ajustes.

```js
{
  id, name, remoteId,
  inc, cur,                        // ingreso y moneda
  paleta,                          // tema visual elegido para este perfil
  ingresoTipo, ingresoHistorial,   // 'fijo' | 'variable'
  tasaInteres, fondoMeses,         // tasa anual de referencia y meses del fondo
  edad, gastoMaximo,               // F2: del paso a paso; el tope de gasto sugerido
  medios, saldos,                  // F1: medios de pago y saldo inicial por moneda
  metodoDeuda,                     // 'avalancha' | 'bolaDeNieve'
  items, goals, movs,
  avisosVistos, avisosEnviados,    // F6: qué aviso se descartó y cuál se notificó, por día
  alertasSilenciadas,              // F7: qué alertas de renglón se silenciaron
  dashLayout,                      // F9: { widgetId: { orden, ancho, oculto } } del dashboard
  recurrentes,                     // F10: plantillas de movimientos que se repiten cada mes
  updated,
}
```

Dentro de un perfil hay tres listas que se cruzan.

**Sobre qué se reparte.** El reparto se contrasta contra lo que de verdad entra, no contra un número tecleado: `incomeRepartir()` devuelve lo que de verdad entró en el mes en curso, nómina más extra, y solo cae al plan (`p.inc`) mientras no haya un ingreso registrado. Ese es el número contra el que se compara lo que tienes asignado: si sobra, la app dice cuánto falta por repartir; si te pasaste, por cuánto. `incomeEsenciales()` sigue midiendo contra el plan o contra el mínimo del historial: medir los gastos fijos contra un mes bueno es exactamente cómo la gente se mete en problemas. Planear abre con una tarjeta que dice de dónde sale ese número, cuánto entró por encima del plan y sigue sin ir a una meta —cualquier peso de más cuenta, esté o no marcado como ingreso extra—, y dos botones: repartirlo entre las metas —el mismo selector de la Fase 8— o dejar el ingreso del mes como plan.

Las **categorías** (`items`) son los bloques del reparto. **No viene ninguna por defecto y nada se reparte solo**: un perfil nuevo arranca vacío y en cero, y lo único que se precarga son los cinco gastos recurrentes que propone el paso a paso —Arriendo, Mercado, Salud, Gasolina, Inversión—, todos editables y borrables. Lo que se guarda es el monto (`m`), que es lo único que se edita. El porcentaje que ves en pantalla siempre es un número derivado del ingreso del mes. Cada una tiene su monto, un color, un rol (`r`) y una lista de renglones (`L`) donde escribes los conceptos reales: arriendo, servicios, mercado. Cada renglón se marca como fijo o variable, y esa marca no es decorativa: el objetivo del fondo de emergencia se calcula como los fijos más la mitad de los variables, y un fijo puede marcarse para llegar ya pagado al mes nuevo (`autoPagar`), siempre editable.

Cada renglón puede llevar `tope`: el máximo que quieres gastar ahí en el mes. Desde el 80% la app lo dice en el dashboard y pinta la barra en Categorías. La alerta de la Fase 7 avisa el mes siguiente, cuando ya gastaste; el tope avisa el mismo día.

Los renglones de un bloque con rol `deu` llevan además `saldo`, `tasa` y `minimo`, más `diaPago` y `fechaLimite`: una deuda puede ser indefinida (solo día de corte cada mes) o tener fecha final. Dos días antes del pago, y el mismo día, sale el aviso — la mora cuesta más que cualquier tasa que hayas calculado. Vacíos, el renglón se comporta como cualquier otro. El `saldo` es el declarado; el que manda en los cálculos es el **saldo vivo**, que le resta los movimientos marcados `abono: true`. Un abono es un gasto normal en todo lo demás: cuenta en `gastoTotal`, en `porItem` y en el presupuesto del bloque.

Las **metas** (`goals`) son las cosas que quieres comprar. Cada meta guarda **una sola cifra mensual** (`mes`): lo que decides guardar cada mes, escrito a mano. Con eso la app contesta la única pregunta que importa —en cuántos meses llegas— y la meta se pinta como un bloque más del reparto, al lado de las categorías, así que `balance()` la cuenta igual que a ellas. Antes ese aporte se armaba repartiéndolo bloque por bloque, y ese mapa era la mitad de la complejidad de la app para una cuenta que es una división. Cada meta guarda además su costo (`t`) y lo que llevas ahorrado (`s`), que puedes escribir a mano: lo que ya tenías guardado antes de usar la app cuenta igual.

Cada meta lleva además un `orden` y un `estado` (`activa` o `completa`). El fondo de emergencia siempre tiene `orden: 0` y no se mueve de ahí.

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
  medio,          // F1: medio de pago (Bancolombia, Nequi, Efectivo…)
  montoOrig, curOrig, // F3: lo que escribiste, si lo escribiste en otra moneda
  abono,          // F9: gasto que baja el saldo de un renglón de deuda
  cat,            // F11: categoría de gasto (mercado, comida-fuera, transporte…)
  recId,          // F10: el recurrente del que salió, si salió de uno
}
```

Una sola estructura resuelve cuatro cosas: aporte a meta (`goalId`), cierre de mes real (agrupar por `itemId` y periodo), alerta de renglón que creció (agrupar por `lineId`) e ingreso extra (`tipo: 'ingreso'` con `extra: true`). No hay cuatro sistemas separados, y esa es la decisión de diseño central de todo lo que se construyó después.

Al arrancar se podan los movimientos de más de 24 meses. El perfil entero viaja como un blob JSON y sin poda crecería sin techo.

### Las categorías de gasto y la IA

Un gasto se clasifica en diez categorías —mercado, comida preparada, vivienda, servicios, transporte, salud, ocio, suscripciones, educación, otros— y nada más: con veinte, nadie clasifica nada.

`engine/clasificar.js` lo hace en el navegador, sin red y sin costo, con un diccionario de palabras y marcas colombianas. La regla difícil es la del pan: *pan, lechuga, salsa de tomate* es mercado, pero *comida en Dogger* es comida preparada, y las dos son comida. Por eso el diccionario trae Frisby, El Corral, Crepes & Waffles, Juan Valdez, Tostao, Rappi y compañía, y una marca de restaurante pesa el doble que un sustantivo suelto. Una lista de compras vota en conjunto en vez de renglón por renglón.

Mientras escribes la nota, la app propone el bloque que suele pagar esa categoría; si ya elegiste uno a mano, no te lo mueve.

Lo que el diccionario no reconoce se le pregunta a la **IA**, y solo eso. Vive en una Supabase Edge Function (`supabase/functions/ia`) por una razón que no es negociable: la llave del proveedor no puede estar en el navegador, donde cualquiera la saca del bundle. La función tiene dos acciones: `clasificar`, que devuelve JSON, y `preguntar`, que responde en una frase sobre cifras **que la app ya calculó** — la IA no calcula nada por su cuenta ni ve más datos de los que se le mandan. Sin la función desplegada, `src/ia.js` devuelve `null`, la app se queda con el clasificador local y la tarjeta de preguntas lo dice en voz alta en vez de fingir.

Para desplegarla: `supabase secrets set NVIDIA_API_KEY=...` y `supabase functions deploy ia`.

### El botón flotante

Un `+` fijo abajo a la derecha con las cinco cosas que se hacen a diario: agregar ingreso, agregar egreso, agregar meta, buscar transacciones y preguntarle a la IA. Todas abren una hoja menos la meta, que tiene su propio editor en su vista. Lo que puede ser un pop-up es un pop-up: la app dejó de mandarte a otra página para meter un gasto.

### El buscador

Una acción del botón flotante y una tarjeta en el dashboard, las dos sobre `engine/buscar.js`: busca en movimientos, metas, bloques y renglones a la vez, sin tildes ni mayúsculas, y suma lo encontrado. Buscar "rappi" es buscar los últimos rappis y cuánto se han llevado; por eso los movimientos salen del más reciente al más viejo y las cosas con nombre propio salen primero.

### El motor de cálculo

Está aislado en `src/engine/` y es lo único con pruebas, porque es lo único con lógica de negocio real. Todo es puro: recibe datos, devuelve datos, nunca toca el store ni el DOM. Son 210 pruebas en dieciocho archivos.

`reparto.js` hace la aritmética base. Suma lo asignado, deriva el porcentaje sobre el ingreso, cuadra el reparto contra lo que entra (`balance()`: cuánto falta por repartir o por cuánto te pasaste), separa fijos de variables, y suma lo que las metas se llevan al mes (`totalMetas()`), que entra en el mismo balance.

`metas.js` calcula cuánto va hacia una meta al mes, en cuántos meses la alcanzas, la cuota necesaria para un plazo o una fecha objetivo, y el fondo de emergencia. Nada más: el plan de recorte, los escenarios, el costo de oportunidad y la detección de metas en competencia se fueron con el reparto por bloque del que vivían.

`fila.js` solo ordena las metas: subir, bajar, arrastrar y renumerar.

`analisis.js` arma los segmentos del donut —planeado, real o desde el snapshot de un mes cerrado— y sus arcos. Todo derivado del estado en cada llamada, nada guardado.

`saldo.js` suma el saldo disponible desde el saldo inicial. `moneda.js` trae la tasa de USD y EUR contra COP de frankfurter.app, cacheada 12 h en `localStorage` y con la última tasa conocida como plan B. `perfilInicial.js` propone los gastos y el tope de gasto del paso a paso.

`avisos.js` decide qué tiene que decirte la app hoy: el cierre del mes a 5, 3 y 1 día, los que faltan para la fecha de una meta, y si un aviso ya se descartó hoy.

`consejo.js` maneja el ingreso variable y el excedente del mes bueno. La recomendación de reparto corto/largo se fue con la tarjeta que la pintaba.

`movimientos.js` agrega el libro: por periodo, por bloque, por renglón, ingreso real contra extra, y lo aportado a cada meta. Un ingreso extra se registra como `tipo: 'ingreso'` con `extra: true`; sus aportes sugeridos o manuales quedan como movimientos de gasto con `goalId` y también actualizan `goal.aportes`/`goal.s`. También `serieAhorro()`, la serie mensual que alimenta la gráfica del dashboard, filtrable por meta, por bloque o por abonos a deuda, y que nunca cuenta dos veces el mismo movimiento. Y `hoyISO()`, que construye la fecha en local a propósito — `toISOString()` convierte a UTC y al este de Greenwich el día 1 del mes cae en el periodo anterior.

`cierre.js` arma el snapshot del mes, calcula qué meses quedaron sin cerrar, y saca la brecha entre lo planeado y lo gastado.

`deudas.js` amortiza. `saldoVivo()` descuenta los abonos del libro y `deudasDelPerfil(items, movs)` trabaja sobre él, así que el plazo y los intereses se mueven cuando pagas. Meses para liquidar, intereses totales, orden de ataque por avalancha o bola de nieve, y el plan que reparte el presupuesto del bloque. Todo sale de una sola simulación mes a mes en vez de la fórmula cerrada: es exacta con el último pago parcial, y el plan la necesita igual, porque cuando una deuda cae su mínimo se suma al sobrante y arrastra a la siguiente. De ahí sale la ventaja de los dos métodos.

Hay una regla de prioridad que atraviesa todo, la escalera de cinco peldaños que usa Metas para avisarte cuando creas una meta fuera de turno (el dashboard ya no la pinta): mínimos de deuda, un mes de fondo, fondo completo, metas, inversión de largo plazo. La app te dice en cuál estás y te avisa si estás creando una meta del peldaño 4 cuando todavía andas en el 2. El peldaño 1 se verifica de verdad contra los mínimos de tus deudas y el presupuesto del bloque.

### Los avisos

El problema real de estas apps no es que estén mal hechas. Es que la gente las abre dos veces y las olvida. Así que hay dos avisos. El del cierre llega tres veces —a 5, 3 y 1 día— y el de meta cinco días antes.

El primero es el del cierre, y cada disparo es más corto que el anterior: `Quedan 5 días de agosto. Llevas $3,2 M registrados de $4,1 M presupuestados.`, luego `Faltan 3 días para el cierre de agosto. Revisa lo que no registraste.`, y al final `Mañana cierro agosto. Última oportunidad de cuadrar el mes.` Cada día tiene su propia clave (`cierre-5-2026-08`), así que descartar uno no tapa el siguiente. El segundo es el de una meta con fecha objetivo: `Faltan 5 días para tu fecha de la Moto y llevas el 78%.` Nada más. Una app que avisa de diez cosas no avisa de ninguna.

Salen en un **anuncio grande** (`ui/anuncio.js`), y esa es la parte que importa. No es un toast de seis segundos en la esquina, que es lo que nadie ve, y tampoco es un modal, que se cierra por reflejo sin leerlo. Es una franja del ancho del contenido, arriba de todo, que empuja el resto de la vista hacia abajo y se queda ahí hasta que actúas o la descartas. Rosa con tinta, o tinta con blanco cuando es urgente. Uno o dos botones y una X.

Descartar guarda la marca en `p.avisosVistos = { clave: fecha }` para no repetirlo el mismo día. Al escribir una marca se botan las de días anteriores, así que el mapa nunca crece.

Cada aviso dice en qué vistas aparece, y son dos: el dashboard y la que le toca. El de fin de mes sale también en Movimientos, el de una meta en Metas. En las otras tres no aparece.

Este componente es el único lugar donde la app levanta la voz, y lo reusan las tres cosas que lo necesitan: el cierre automático de la Fase 3, la meta completada de la Fase 5 y los dos avisos de la Fase 6.

### La notificación del navegador

Con la Notifications API nativa y nada más: sin librería, sin service worker, sin servidor de push. Al arrancar, si hay un aviso pendiente y el permiso está concedido, se dispara.

El permiso se pide desde un botón en Ajustes, nunca al cargar la página. Pedirlo de entrada es cómo se consigue que lo nieguen para siempre. Si está negado, o el navegador no tiene la API, el anuncio en pantalla es el plan B y la app funciona igual. `p.avisosEnviados` evita mandar el mismo aviso dos veces en el día.

### El cierre de mes

Al arrancar, la app cierra los meses que quedaron pendientes. No hay cron ni servidor: se cierra el mes la primera vez que abres la app pasado el día 1, y si no la abres en tres meses, al volver se cierran los tres de una. Solo se cierran meses en los que hay algo registrado, para que una cuenta recién abierta no se llene de cierres vacíos hacia atrás.

El snapshot `version: 2` guarda plan contra real por bloque, los renglones con gasto, el ingreso real y el extra, y lo aportado a cada meta. Los snapshots viejos solo traen `essentialsShare` y `ahorroRate` y no llevan `version`; todo lo que lee los campos ricos comprueba `version >= 2` antes de tocarlos.

Un cierre nace en borrador y se edita en Historial: el planeado a la izquierda, el real editable a la derecha precargado con la suma de movimientos, más el ingreso y una nota libre. `Confirmar cierre` quita el borrador, `Volver a editar` lo reabre. Nada queda congelado para siempre, porque siempre hay algo que se olvidó registrar, y la alternativa sería inventar movimientos con fecha falsa.

### Ingreso variable

Si trabajas por tu cuenta y el ingreso no es el mismo cada mes, cambias el perfil a variable y metes los últimos tres meses. A partir de ahí la app usa dos números distintos según para qué: el **promedio** para repartir, y el **mínimo** para calcular si tus esenciales son sostenibles. Esa asimetría es a propósito. Repartir sobre el promedio es razonable, pero medir tus gastos fijos contra el promedio es cómo la gente se mete en problemas.

Si el último mes fue mejor que el promedio, la app calcula el excedente y sugiere 70% a metas y fondo, 30% libre.

Cuando se registra un ingreso extra (por ejemplo, una prima), Movimientos muestra un anuncio grande con ese mismo reparto 70/30. `Aplicar sugerencia` recorre las metas activas en orden y crea sus aportes; `Repartir a mano` abre un selector con montos y `Dejarlo sin asignar` no crea movimientos adicionales. El resumen mensual separa nómina e ingreso extra. El cierre guarda el total extra en `snapshot.ingresoExtra`, y Historial marca con un punto verde los meses que lo tuvieron para que los picos de la tasa de ahorro se puedan explicar.

### La PWA

`public/manifest.webmanifest` y `public/sw.js`: se instala en el teléfono y abre sin internet. El service worker cachea el cascarón —el HTML y los estáticos con hash del build— y **ninguna respuesta de datos**: una app de plata que muestra saldos viejos es peor que una que dice que no hay internet. Los datos siguen viniendo de `localStorage` y de Supabase.

### Persistencia

Dos capas. `localStorage` bajo la llave `reparto:v8` es caché, y Supabase es la fuente de verdad. La UI escribe local de inmediato y empuja al servidor con dos segundos de retraso, así que nunca te quedas esperando a la red. Si el push falla, reintenta a los cuatro segundos y vuelve a intentar cuando el navegador avisa que hay conexión. `OLD_KEYS` lee las llaves viejas para no perder el caché de nadie al subir de versión.

Hay dos tablas. `perfiles` guarda todo el presupuesto vivo como un blob JSON. `cierres` guarda un snapshot por mes cerrado, con el periodo en formato `AAAA-MM`. Ambas con row level security amarrada a `auth.uid()`. El upsert de perfiles devuelve su `id` y ese `id` se guarda en `p.remoteId`: sin eso cada guardado insertaría una fila nueva, y todo el historial se cae detrás.

La autenticación es correo y contraseña de Supabase, con recuperación por enlace. Al crear una cuenta salen dos hojas seguidas, una por dato: cómo se llama el presupuesto y cuánto entra al mes; al terminar la app cae en Categorías, que es donde se reparte. Ni un paso más: un tour de siete pantallas se salta completo. La marca de "cuenta nueva" vive en `localStorage`, no en la sesión, porque si el correo pide confirmación la cuenta entra más tarde y el paso a paso tiene que estar esperando. Si empezaste a usar la app sin cuenta y después te registras, lo que tenías en local se sube como perfil inicial y sale un aviso.

### Las siete vistas

**Dashboard** es el resumen, y desde la Fase 9 es una cuadrícula que el usuario acomoda: el botón `Acomodar` entra en modo edición y ahí cada tarjeta se arrastra, cambia de ancho (una o dos columnas) o sube y baja con flechas en móvil; `Restablecer` borra `p.dashLayout`. También se quitan tarjetas: `Quitar` las saca del dashboard y solo reaparecen, apagadas y con su nombre, dentro del modo edición, que es la única forma de volver a encenderlas. Se guarda en el perfil, así que sobrevive a cerrar la app. Fuera de ese modo nada se mueve. Las tarjetas son: el ingreso del mes (la nómina real registrada en Movimientos, con el plan al lado y un botón para adoptar el real), cuánto por ciento llevas repartido, el estado del fondo, la tasa de ahorro con su tendencia, la gráfica de **ahorro acumulado** con su filtro (todo, una meta, un bloque de ahorro, pago de deudas) y su tabla mes a mes, el reparto por bloques, y los anillos de progreso de cada meta con el monto, el plazo y la fecha escritos debajo. Si tus esenciales pasan del 50% aparece una tarjeta de advertencia con los tres renglones que más pesan. Si la app cerró meses por ti al arrancar, sale un anuncio que lleva a Historial.

Una categoría puede llevar su monto **a mano** o en **automático**. En automático no se teclea: sale de sus propios conceptos, corregido con la realidad. El plan de cada renglón, menos lo que ahorraste y más lo que se pasó, contando solo los renglones que ya cerraste —uno a medio pagar sigue valiendo lo planeado, porque de ese todavía no hay noticia. Es la cuenta que responde "¿cuánto me cuesta de verdad este mes?" en vez de "¿cuánto pensaba que me iba a costar?". `resumenItem()` la devuelve como `costo`, y `sincronizarAutomaticas()` la escribe en `it.m` al guardar y al cargar, así que el dashboard, el reparto y el cierre leen el número al día sin saber que vino de una suma.

Borrar un concepto o una categoría se lleva sus movimientos (`quitarMovsDe()`), y al cargar se limpian los huérfanos que dejaron los borrados viejos (`sinHuerfanos()`): si no, el buscador seguía encontrando los pagos de algo borrado y, al recrearlo con el mismo nombre, mostraba las dos versiones.

Cada renglón lleva sus pagos reales como movimientos sueltos, uno por compra, y cada uno se puede abrir para corregirle el monto, la fecha y ponerle un nombre —"recibo de agosto", "mercado del sábado"— porque un pago sin nombre a los tres meses no dice nada. Y el mes que no alcanzó no se borra: un renglón fijo que quedó debiendo se pasa al siguiente con un botón, y allá vale su plan más lo que se debía (`l.arrastre`, por periodo). Es un botón y no algo automático a propósito: la app no cierra meses sola cuando estás sin conexión, y adivinar deudas ajenas sería peor que preguntarlas. En un renglón variable no aparece: un mercado en el que gastaste menos no es una deuda.

**Planear** (antes Categorías) es donde vive el detalle, y arriba de todo dice cuánto estás repartiendo de verdad este mes: lo asignado contra lo que entra, con la barra y la frase que dice cuánto te falta por repartir o por cuánto te pasaste. Desde la Fase 11 cada categoría y cada concepto son **bloques**: colapsados solo muestran nombre, monto y el botón de editar, y el fondo del bloque se llena de izquierda a derecha con lo pagado sobre lo planeado —al 100% se llena entero y sale un check verde; si te pasas queda lleno y en rojo, nunca más del 100%. La categoría va en tinta y sus conceptos en claro (`--bloque-cat-*` y `--bloque-item-*` en `tokens.css`), y los conceptos se ven colgando de ella. Todo lo demás vive en un pop-up: en el concepto, los pagos, los toggles de *pagado por completo* y *precargar cada mes*, el arrastre al mes siguiente y borrar; en la categoría, el monto asignado, a mano/automático, igualar a lo que cuesta, cuadrar lo que falta, el color, el candado y borrar. Hay **un solo componente modal** (`ui/modal.js`) para toda la app: se cierra con la X, tocando fuera o con Esc. Debajo de los conceptos, lo que las metas ya reclaman de ese bloque, con un botón `Ya lo guardé` que registra el aporte del mes. Al pie, la cuenta completa: presupuesto, gastos reales, comprometido por metas, y el libre. En un bloque de deudas, cada renglón muestra en cuánto se liquida y cuántos intereses cuesta, y al final el comparativo entre avalancha y bola de nieve.

**Metas** se crea con un paso a paso de tres preguntas —qué quieres comprar, cuánto cuesta, cuánto guardas al mes— y la tercera contesta el plazo mientras escribes. Las metas se reordenan arrastrando la tarjeta —`draggable` del navegador, sin librería— y con un par de flechas arriba/abajo, que es lo que se usa en el celular. Cada meta se puede calcular por monto, en N meses o para una fecha; en los dos últimos, un botón adopta la cuota como el aporte mensual.

**Análisis** es la tabla con donut: color, nombre, porcentaje y monto por categoría, con un interruptor entre **Planeado** —donde salen también "Ahorro sugerido" y "Sin asignar"— y **Real**, que se alimenta de las transacciones y agrega la diferencia contra el plan. El donut es un `<circle>` con `stroke-dasharray`, sin librería, y se recalcula en cada render: no hay totales guardados que invalidar. Un selector de mes lee el snapshot de un mes ya cerrado.

**Registrar** es el libro. Arriba, los **recurrentes**: cualquier movimiento se puede guardar como plantilla marcando *Se repite todos los meses*, y cada mes se agregan con un clic —uno a uno o todos los que falten—. No se crean solos: un movimiento que aparece sin que lo pidas es un movimiento que nadie revisa. El registro vive en una hoja (`ui/registrar.js`) que se abre desde el botón flotante, desde los dos botones de la vista y al editar un movimiento: descripción, monto, moneda, fecha, categoría, renglón y medio de pago, y bajo "Más detalle" la meta, el tipo de gasto, el ingreso extra, el abono y el recurrente. Un monto en otra moneda se convierte al guardar con la tasa del día y se recuerda en cuál lo escribiste. Debajo, el resumen del mes con presupuesto contra real por bloque, y la lista agrupada por día. Selector de mes con flechas.

**Historial** cierra el mes y guarda el snapshot. Muestra la tasa de ahorro mes a mes, los esenciales como porcentaje del ingreso con semáforo, la comparación contra el promedio de los tres meses anteriores, y por cada cierre las barras enfrentadas de plan contra real con la brecha dicha en una frase.

**Ajustes** tiene los perfiles (el activo se renombra en un input, sin `prompt()`; el import pregunta con dos botones que dicen qué hace cada uno, no con un `confirm()` ambiguo), el saldo inicial por moneda, la moneda principal con las tasas del día, los medios de pago —agregar, renombrar, borrar—, el tipo de ingreso, los meses objetivo del fondo, la tasa anual de referencia, la paleta de colores, el botón para rehacer el paso a paso, el que pide permiso para las notificaciones, y exportar/importar en JSON.

La paleta visual se cambia desde Ajustes. Se conserva por perfil en el blob local y en Supabase (`paleta`), por lo que al volver a entrar a la cuenta se recupera el tema elegido. La paleta rosa chicle actual sigue siendo la predeterminada; también están Coral & azul, Pizarra y Vivo. Los colores de acento se combinan con texto oscuro o blanco según el contraste, y no se usan colores claros como texto principal.

## El stack y por qué

Vite con JavaScript plano, sin React ni nada parecido. El estado completo cabe en un módulo y no justifica un framework. Las vistas son funciones que reciben un nodo y le escriben `innerHTML`, con los handlers cableados a mano después. Si una vista necesita mandar a otra, despacha un `CustomEvent` (`ir-a-meta`, `ir-a-vista`) y `main.js` navega: así ninguna vista monta una hoja sobre el root de otra.

Los iconos son de Lucide (ISC), inlineados en un sprite; no hay dependencia de iconos en el bundle. Los gráficos son SVG escrito a mano. Cinco tipos de gráfico no justifican traerse una librería de charts.

Una sola dependencia en producción: `@supabase/supabase-js`. Vitest para las pruebas del motor.

El sistema de color es un archivo de tokens y una regla que se respeta en todas partes: las tarjetas siempre más claras que el fondo. Y una regla de ancho: el `body` nunca se desplaza en horizontal, y no por taparlo con `overflow-x:hidden` —lo que sea ancho se desplaza dentro de su propia caja.

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

**El progreso de una meta ya tiene una sola fuente.** `goal.aportes` desapareció. Cada meta guarda `base` —lo que tenías antes de registrar aportes— y `goal.s` se recalcula en cada guardado como `base` más los movimientos con su `goalId`. Registrar un aporte es crear un movimiento y nada más, venga de Categorías, del libro o de la hoja de la meta. Al podar el libro a 24 meses, lo podado se suma a `base` para que el progreso no se caiga. Lo limpio es que `goal.s` salga de `aportesAMeta()` y `goal.aportes` desaparezca; eso cambia cómo se calcula el progreso de toda meta, así que no se ha tocado.

**WhatsApp no es posible desde una app web.** Mandar un mensaje requiere la Cloud API de Meta: número verificado, servidor propio que guarde el token y plantillas aprobadas una por una. Un backend entero para reemplazar lo que el navegador ya hace gratis. La vía realista, si algún día se quiere, es un servicio externo con un cron en Supabase Edge Functions, y eso es otro proyecto.

**Los avisos no llegan con la app cerrada.** La única vía sin backend es un service worker con Periodic Background Sync, que solo corre en Chrome de escritorio y solo si el usuario instaló la PWA. No está hecho.

## Fase 1 — Datos y modelo

**El saldo a favor tenía dos fórmulas y ahora tiene una.** La tarjeta "A favor este mes" decía `$ 734.000` y el botón de reparto `$ 32.600`, porque cada uno hacía su propia cuenta: la tarjeta restaba gastos reales a ingresos reales, y el botón restaba el *plan* del ingreso y encima le quitaba los aportes a metas ya hechos. `saldoAFavor(movs, periodo)` en `engine/saldo.js` es ahora la única fuente —`ingresos − gastos pagados`, el mismo número que `resumenFlujo().saldo`— y `disponibleParaRepartir()` es esa cifra sin dejarla bajar de cero. La segunda fórmula se borró de `ui/categorias.js` junto con `aportadoEsteMes()`, que se quedó sin usuarios. Hay una prueba que ata los dos valores.

**Cada pago lleva nombre.** `agregarPago()` y `agregarPagoLibre()` reciben `nombre` y lo guardan en `mov.nombre`; si no le pones uno, hereda el del concepto. `nombrePago()` lo lee con respaldo a `nota`, así que los perfiles viejos siguen funcionando sin migración: el libro vive dentro del jsonb del perfil y no hubo DDL que correr.

**Categorías de gasto libre.** `esGastoLibre(it)` las marca. La plantilla "Gasto libre" pone `libre: true` al crear la categoría, y el flag explícito manda sobre el rol para que una categoría se pueda cambiar de opinión.

**"Sin tipo de concepto" ahora es "General".** Un solo `SIN_CONCEPTO` exportado desde `engine/pagos.js` que usan la lista de categorías, el donut del análisis y el selector de registro.
