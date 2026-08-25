#!/usr/bin/env bash
# Despliega la función de IA en tu proyecto de Supabase.
#
#   ./scripts/ia.sh
#
# Hace los cuatro pasos: CLI, enlace del proyecto, llave y despliegue. La llave
# se pide por teclado y no queda en el historial del shell ni en el repo.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v supabase >/dev/null || {
  echo "→ Instalando el CLI de Supabase…"
  npm i -g supabase
}

# El ref del proyecto sale de la URL que ya tienes en .env
REF="${SUPABASE_REF:-}"
if [ -z "$REF" ] && [ -f .env ]; then
  REF="$(grep -m1 VITE_SUPABASE_URL .env | sed -E 's#.*https://([^.]+)\.supabase\.co.*#\1#')"
fi
if [ -z "$REF" ]; then
  read -rp "Ref del proyecto de Supabase (el pedazo de la URL): " REF
fi
echo "→ Proyecto: $REF"

supabase projects list >/dev/null 2>&1 || supabase login
supabase link --project-ref "$REF"

echo
echo "Pega tu llave de NVIDIA (build.nvidia.com). No se ve al escribir y no se guarda en ningún archivo."
read -rsp "NVIDIA_API_KEY: " LLAVE
echo
[ -n "$LLAVE" ] || { echo "Sin llave no hay nada que desplegar."; exit 1; }

supabase secrets set "NVIDIA_API_KEY=$LLAVE"
unset LLAVE

supabase functions deploy ia

echo
echo "Listo. Entra a la app con tu cuenta y prueba la tarjeta 'Pregúntale a tus números'."
echo "Si algo falla, los logs: Dashboard → Edge Functions → ia → Logs"
