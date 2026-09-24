# Reparto mensual

Registra ingresos y gastos, ponles categoría, mira en gráficas a dónde se va la plata, y el saldo se arrastra de un mes al siguiente: si agosto termina en −100.000, septiembre empieza en −100.000. Cuando quieras cortar ese arrastre, un mes puede empezar de nuevo con la cifra que le pongas.

Siete pantallas. En el teléfono van abajo Inicio, Movimientos, Recurrentes, Ahorro y **Más**, que abre las otras tres; en escritorio la barra lateral las muestra todas.

- **Inicio**: flechas de mes · empezaste con / entró / salió / terminas con · **si pagas y recibes lo que falta de tus recurrentes, con cuánto terminas** · empezar el mes de nuevo · **próximos pagos** (lo que vence en 7 días y lo vencido) · donut por categoría · barras de 6 meses · línea de saldo.
- **Movimientos**: lista del mes agrupada por día · **búsqueda** por nota, categoría, recurrente o monto, en el mes o en todos los meses, con el total de lo encontrado · filtro por categoría · botón “+” con hoja de 5 campos (ingreso/gasto, monto, categoría, fecha, nota).
- **Recurrentes**: lo que se repite todos los meses, cada uno con su nombre y su estimado. Están todos siempre; lo que cambia cada mes es cuánto llevas pagado de cada uno. Se paga de una vez (“Pagar todo”) o por partes: el mercado presupuestado en 400.000 se va pagando 130.000 en el Éxito, 200.000 en el D1 y 30.000 en domicilios, y ves que quedan 40.000. Cada parte es un movimiento con su nota y su fecha; el estimado no se mueve por lo que pagues. **Deudas en cuotas**: un recurrente puede tener fin (“12 cuotas desde junio”); solo aparece en sus meses, dice “cuota 7 de 12” y la sección Deudas muestra cuánto falta en total y cuándo termina.
- **Ahorro**: el total ahorrado (lo registrado en la categoría Ahorro menos lo que se sacó), siempre entero, y cómo se reparte. Cada **meta** tiene un objetivo y un porcentaje: “Llantas, 2.000.000, el 30 %” arranca con el 30 % de lo que ya tenías libre y cada mes se lleva el 30 % de lo que ahorres, hasta completar. Muestra el avance, lo que falta y en cuántos meses llegas al ritmo de los últimos tres. Usar una meta (o sacar de lo libre) devuelve la plata al saldo como ingreso.
- **Comparar**: cada categoría contra el mes anterior o contra el promedio de los tres anteriores, con lo que más subió y lo que más bajó.
- **Categorías**: dos listas, gastos e ingresos. Nombre · presupuesto opcional · barra de lo gastado · agregar, renombrar, borrar (los movimientos pasan a Otros).
- **Ajustes**: saldo inicial · exportar para Excel (CSV) o JSON · **importar el extracto del banco** en CSV (adivina las columnas y la categoría, marca los repetidos y se revisa antes de guardar) · **avisos** de vencimiento en el dispositivo y **calendario** (.ics) con los pagos del mes · cerrar sesión.

## Correr en local

```
npm install
cp .env.example .env   # llena las dos variables
npm run dev
```

## Configurar Supabase

1. Crea un proyecto en supabase.com.
2. En el SQL editor, corre `supabase/schema.sql`.
3. En Authentication → Providers, deja email/password activo.
4. Copia `Project URL` y `anon public key` a `.env` (local) o a las variables de entorno de Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Build y tests

```
npm run build
npm run test
```

## Decisiones

- Vite + JS vanilla, sin framework: el estado cabe en un módulo.
- El motor (`src/engine/`) es puro y es lo único con tests.
- Gráficas en SVG a mano, sin librería.
- Diseño en tokens (`src/styles/tokens.css`): Montserrat, solo modo oscuro y sin degradados: rosa de marca como único acento sobre grafito. En el teléfono el menú va abajo, al alcance del pulgar; en escritorio, a un lado.
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
