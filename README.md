# Reparto mensual

Presupuesto personal por bloques de porcentaje: esenciales, gasto libre, deudas, ahorro corto plazo, inversión largo plazo. Metas de ahorro que reclaman parte de un bloque, fondo de emergencia automático, plan de recorte cuando falta plata, historial mes a mes.

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
4. Copia `Project URL` y `anon public key` a `.env` (local) o a las variables de entorno de Vercel:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Build

```
npm run build
npm run test
```

## Deploy en Vercel

Import del repo en Vercel, framework preset "Vite", variables de entorno arriba. El comando de build y el output (`dist/`) los detecta solo.

## Decisiones de diseño

- Vite + JS vanilla, sin frameworks de UI: el estado cabe en un módulo y no lo justifica.
- Motor de cálculo aislado en `engine/`, es lo único con tests: es lo único con lógica de negocio real.
- Gráficos en SVG a mano: cuatro tipos de gráfico no justifican una librería.
- localStorage como caché, Supabase como fuente de verdad: la UI nunca espera al servidor.
- Un solo sistema de tokens de color, tarjetas siempre más claras que el fondo.

## La función de IA (opcional)

La app clasifica gastos sin red con el diccionario de `src/engine/clasificar.js`. La IA solo afina lo que queda en "otros" y responde la tarjeta de preguntas del dashboard.

```
./scripts/ia.sh
```

El script instala el CLI si falta, saca el ref del proyecto de tu `.env`, te pide la llave por teclado (no queda en el historial ni en ningún archivo) y despliega. A mano son los mismos cuatro pasos:

```
npm i -g supabase && supabase login
supabase link --project-ref TU_REF
supabase secrets set NVIDIA_API_KEY=tu-llave
supabase functions deploy ia
```

Para comprobarlo: entra con tu cuenta y usa la tarjeta *Pregúntale a tus números* del dashboard.

Si algo falla, los logs están en el panel: **Dashboard → Edge Functions → ia → Logs** (`supabase functions logs` no existe en el CLI 2.x). Lo que devuelve la función: `sin-llave` (falta el secreto), `proveedor-401` (llave inválida), `proveedor-404` (ese modelo no está en tu cuenta), `sin-sesion` (no habías entrado a la app).

El modelo se cambia sin tocar código: `supabase secrets set IA_MODELO=meta/llama-3.3-70b-instruct`.

La llave nunca llega al navegador. Sin la función desplegada la app funciona igual, y lo dice donde corresponde.
