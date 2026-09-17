# Reparto mensual

Registra ingresos y gastos, ponles categoría, mira en gráficas a dónde se va la plata, y el saldo se arrastra de un mes al siguiente: si agosto termina en −100.000, septiembre empieza en −100.000.

Cinco pantallas:

- **Inicio**: flechas de mes · empezaste con / entró / salió / terminas con · donut por categoría · barras de 6 meses · línea de saldo.
- **Movimientos**: lista del mes agrupada por día · filtro por categoría · botón “+” con hoja de 5 campos (ingreso/gasto, monto, categoría, fecha, nota).
- **Recurrentes**: lo que se repite todos los meses, cada uno con su nombre y su precio. No se agregan solos: un botón los mete al mes cuando tú lo dices.
- **Categorías**: dos listas, gastos e ingresos. Nombre · presupuesto opcional · barra de lo gastado · agregar, renombrar, borrar (los movimientos pasan a Otros).
- **Ajustes**: saldo inicial · exportar JSON · cerrar sesión.

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
- localStorage como caché, Supabase como fuente de verdad: la UI nunca espera al servidor.
- Solo pesos colombianos. Un perfil por cuenta.
- Los perfiles de versiones anteriores se migran solos al abrir la app (`src/engine/migrar.js`). Lo que antes eran conceptos dentro de una categoría —un nombre y un precio al mes— hoy son los recurrentes. Un perfil que ya pasó por una migración anterior los recupera del blob viejo que sigue en `localStorage`.
