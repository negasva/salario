# Reparto mensual

Registra ingresos y gastos, ponles categoría, mira en gráficas a dónde se va la plata, y el saldo se arrastra de un mes al siguiente: si agosto termina en −100.000, septiembre empieza en −100.000. Cuando quieras cortar ese arrastre, un mes puede empezar de nuevo con la cifra que le pongas.

**Lo que una hoja de cálculo no hace: detecta tus pagos repetidos.** Si algo se repite en 3 meses con monto y día parecidos y no lo marcaste como recurrente, Inicio te avisa con cuánto suman al mes, y lo agregas con un toque (con deshacer) o lo descartas.

Ocho pantallas. En el teléfono van abajo Inicio, Movimientos, **Registrar** (en el centro, donde llega el pulgar y no tapa ninguna cifra), Ahorro y **Más**, que abre las demás; en escritorio la barra lateral las muestra todas. Con `Ctrl`/`⌘` + `K` se abre una paleta de comandos para ir a cualquier pantalla, registrar o buscar un movimiento.

- **Inicio**: flechas de mes · empezaste con / entró / salió / terminas con · **si pagas y recibes lo que falta de tus recurrentes, con cuánto terminas** · empezar el mes de nuevo · **próximos pagos** (lo que vence en 7 días y lo vencido) · donut por categoría · barras de 6 meses · línea de saldo.
- **Movimientos**: lista del mes agrupada por día · **búsqueda** por nota, categoría, recurrente o monto, en el mes o en todos los meses, con el total de lo encontrado · filtro por categoría · botón “+” con hoja de 5 campos (ingreso/gasto, monto, categoría, fecha, nota).
- **Recurrentes**: lo que se repite todos los meses, cada uno con su nombre y su estimado. Están todos siempre; lo que cambia cada mes es cuánto llevas pagado de cada uno. Se paga de una vez (“Pagar todo”) o por partes: el mercado presupuestado en 400.000 se va pagando 130.000 en el Éxito, 200.000 en el D1 y 30.000 en domicilios, y ves que quedan 40.000. Cada parte es un movimiento con su nota y su fecha; el estimado no se mueve por lo que pagues. **Deudas en cuotas**: un recurrente puede tener fin (“12 cuotas desde junio”); solo aparece en sus meses, dice “cuota 7 de 12” y la sección Deudas muestra cuánto falta en total y cuándo termina.
- **Ahorro**: el total ahorrado (lo registrado en la categoría Ahorro menos lo que se sacó), siempre entero, y cómo se reparte. Cada **meta** tiene un objetivo y un porcentaje: “Llantas, 2.000.000, el 30 %” arranca con el 30 % de lo que ya tenías libre y cada mes se lleva el 30 % de lo que ahorres, hasta completar. Muestra el avance, lo que falta y en cuántos meses llegas al ritmo de los últimos tres. Usar una meta (o sacar de lo libre) devuelve la plata al saldo como ingreso.
- **Reportes**: el mes o el año. Cuatro cifras (gastaste, gasto por día, tasa de ahorro, día más caro), frases que resumen lo accionable (presupuestos pasados, qué subió, cómo cierras el mes), el **gasto acumulado contra el mes anterior** con el ritmo actual en puntos, un **calendario de calor** por cuartiles, el gasto por día de la semana (sin recurrentes ni ahorro, que tapan los hábitos), las categorías con su tendencia de 6 meses, su presupuesto y su variación contra el mes anterior o contra el promedio de los tres anteriores (el mes en curso se mide contra los mismos días: el 3 de octubre se compara con el 1 al 3 de septiembre), y los mayores gastos. La vista del año suma entró/salió, lo que sobró cada mes y a dónde se fue. Las gráficas se leen con el mouse, con el dedo y con las flechas del teclado. **Imprimir** guarda el reporte en PDF, siempre en claro.
- **Perfil**: se llega desde el avatar de Inicio (o desde la fila de cuenta de la barra lateral, o desde Más en el teléfono). Nombre y color del avatar con vista previa, correo y si está verificado, desde cuándo eres usuario, cambio de contraseña (con medidor de fuerza y mensajes en español), cerrar sesión aquí o en todos los dispositivos, cuántos datos hay y si ya se guardaron en la nube, atajos de teclado y **borrar todos los datos** manteniendo el botón presionado dos segundos.
- **Categorías**: dos listas, gastos e ingresos. Nombre · presupuesto opcional · barra de lo gastado · agregar, renombrar, borrar (los movimientos pasan a Otros).
- **Ajustes**: saldo inicial · **apariencia** (sistema, claro u oscuro) · exportar para Excel (CSV) o JSON · **importar el extracto del banco** en CSV (adivina las columnas y la categoría, marca los repetidos y se revisa antes de guardar) · **avisos** de vencimiento en el dispositivo y **calendario** (.ics) con los pagos del mes · cerrar sesión.

## Correr en local

```
npm install
cp .env.example .env   # llena las dos variables
npm run dev
```

## Configurar Supabase

1. Crea un proyecto en supabase.com.
2. En el SQL editor, corre `supabase/schema.sql`. Se puede volver a correr sin riesgo, también sobre una base que ya tiene la tabla: deja una fila por cuenta, la política `with check` y solo los privilegios que la app usa. Si el índice único falla, hay cuentas con filas duplicadas; el propio archivo explica cómo revisarlas. Cada perfil puede pesar hasta 5 MB (unos 22.000 movimientos); si lo pasa, Perfil avisa "Demasiado grande para la nube" y los datos siguen a salvo en el dispositivo.
3. En Authentication → Providers, deja email/password activo. En Authentication → Sign In / Up → Password, sube el largo mínimo a 8 y activa *Prevent use of leaked passwords* (la app ya pide 8 con letras y números al crear la cuenta, pero eso solo lo cumple el navegador).
4. Copia `Project URL` y `anon public key` a `.env` (local) o a las variables de entorno de Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
5. Para que el enlace de **recuperar contraseña** vuelva a la app y no a otra dirección, en Authentication → URL Configuration:
   - **Site URL**: el dominio de producción (`https://tu-dominio.com`). Es el destino de respaldo: si queda en una URL de Vercel, los correos llevan allí.
   - **Redirect URLs**: agrega `https://tu-dominio.com/**` y, si quieres probar en vistas previas, `https://*-tu-equipo.vercel.app/**`. Supabase ignora el `redirectTo` que no esté en esta lista.
   - Opcional: `VITE_SITE_URL=https://tu-dominio.com` fija ese destino aunque pidas el correo desde una vista previa.
   - El texto y remitente del correo se cambian en Authentication → Emails (plantilla *Reset Password*); para un remitente propio configura SMTP en Authentication → SMTP.

La política de contenido (CSP) y demás cabeceras de seguridad viven en `vercel.json`. Solo deja conectar a la propia app y a `*.supabase.co`: si usas un dominio propio para Supabase, agrégalo a `connect-src`. Si editas el script del tema en `index.html`, hay que actualizar su hash (una prueba avisa).

## Operación

- **Antes de desplegar**: `vercel.json` hace que Vercel corra `npm test` antes de `npm run build`; si un test falla, no hay despliegue. En GitHub, `.github/workflows/ci.yml` corre los mismos tests y el build en cada pull request.
- **Variables de entorno** (Vercel → Settings → Environment Variables): `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` son obligatorias; sin ellas la app muestra "Falta configurar Supabase" en vez de quedar en blanco. `VITE_SITE_URL` es opcional.
- **Respaldos**: en Ajustes → Tus datos, `JSON` descarga una copia completa y la app recuerda cuándo fue la última (avisa pasados 30 días). `Restaurar copia` la vuelve a cargar y reemplaza todo, con deshacer unos segundos. Los respaldos automáticos de la base de datos dependen del plan de Supabase (Database → Backups); el plan gratuito no los incluye, así que conviene descargar el JSON de vez en cuando.

## Build y tests

```
npm run build
npm run test
```

## Decisiones

- Vite + JS vanilla, sin framework: el estado cabe en un módulo.
- El motor (`src/engine/`) es puro y es lo que tiene tests, incluido el de reportes.
- Gráficas en SVG a mano, sin librería. Cada una se dibuja al ancho real de su contenedor (`responsiva`), así el texto de los ejes mide siempre lo mismo.
- Diseño en tokens (`src/styles/tokens.css`), con las bases de Vercel: negro casi puro, superficies separadas por líneas de un píxel, botón principal en blanco, un solo radio por tipo de pieza y el rosa de marca como único acento. Poppins se sirve desde el propio build (`@fontsource/poppins`): no hay petición a Google y funciona sin conexión. Hay tema oscuro y claro; un script en `index.html` lo aplica antes de pintar para que no parpadee.
- En el teléfono el botón de registrar no flota: va en el centro de la barra de pestañas. Un botón flotante tapaba cifras y botones de pagar. Las hojas suben con el teclado (`visualViewport`) y se cierran arrastrando.
- Movimiento con función, cada uno con su porqué: la pastilla de los controles segmentados viaja (estado), el botón de guardar se vuelve ✓ un instante (confirmación), la fila recién guardada destella una vez (dónde quedó), los pasos de bienvenida entran en cascada (primera vez), y borrar todo se hace manteniendo presionado (nada irreversible con un toque). Todo se apaga o se vuelve un fundido con “reducir movimiento”, menos el relleno de mantener presionado, que es un temporizador.
- Movimiento con restricción (criterio de Emil Kowalski): los botones responden al presionar (escala 0,97 en 160 ms), las hojas suben con la curva de iOS y bajan por donde entraron, y solo al abrir la app las piezas de la pantalla entran en cascada. Cambiar de pestaña o de mes es instantáneo, porque pasa decenas de veces al día. Con “reducir movimiento” quedan solo los fundidos. Los hover solo existen donde hay mouse, para que no se queden pegados en el teléfono.
- La pantalla vive en el `#` de la dirección (`#movimientos`), así que atrás funciona y se puede enlazar.
- localStorage como caché, Supabase como fuente de verdad: la UI nunca espera al servidor.
- Solo pesos colombianos. Un perfil por cuenta.
- Un recurrente no crea movimientos solo: uno que aparece sin que lo pidas es uno que nadie revisa.
- Los avisos no tienen servidor de push: salen al abrir la app, una vez al día. Para que avise sin abrirla está el calendario .ics, que el teléfono recuerda por su cuenta.
- Una meta no aparta plata a mano: es un porcentaje de lo que ahorras. Cambiarle el porcentaje recalcula desde el mes en que se creó.
- El importador solo lee CSV: cada banco exporta distinto, así que adivina y la persona confirma. Nada entra sin revisar.
- Empezar un mes de nuevo no borra nada: `arranques` guarda desde qué mes se cuenta el arrastre, y los meses anteriores quedan intactos.
- Los perfiles de versiones anteriores se migran solos al abrir la app (`src/engine/migrar.js`). Lo que antes eran conceptos dentro de una categoría —un nombre y un precio al mes— hoy son los recurrentes. Un perfil que ya pasó por una migración anterior los recupera del blob viejo que sigue en `localStorage`.
