#!/usr/bin/env bash
# TITAN GRILL — ejecutor READ-ONLY del inventario forense de BD.
# Barreras VERIFICADAS en vivo contra el pooler de Supabase:
#   1. SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY  -> confirmado activo
#   2. BEGIN TRANSACTION READ ONLY ... ROLLBACK              -> confirmado bloquea escrituras (25006)
#   3. statement_timeout / lock_timeout                      -> no puede colgar produccion
# NOTA: PGOPTIONS de arranque NO funciona: Supavisor lo ignora. Por eso se usan
#       sentencias SET explicitas dentro de la sesion.
set -euo pipefail

REPO="/Users/jarib08/TitanGrill"
SQL="$REPO/supabase/audit/FASE_0_INVENTARIO_READONLY.sql"
OUT="${1:?uso: run_readonly.sh <ruta_salida.txt>}"

DB_URL="$(grep -m1 '^SUPABASE_DB_URL=' "$REPO/.env" | cut -d= -f2-)"
[ -n "$DB_URL" ] || { echo "ERROR: falta SUPABASE_DB_URL en .env"; exit 1; }
export PGCONNECT_TIMEOUT=15

{
  echo "SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;"
  echo "SET statement_timeout = 60000;"
  echo "SET lock_timeout = 3000;"
  echo "SET idle_in_transaction_session_timeout = 15000;"
  echo "BEGIN TRANSACTION READ ONLY;"
  cat "$SQL"
  echo "ROLLBACK;"
} | psql "$DB_URL" \
      --no-password \
      --set=ON_ERROR_STOP=1 \
      --pset=pager=off \
      --pset=format=unaligned \
      --pset=fieldsep='|~|' \
      --pset=tuples_only=on \
      --echo-errors \
      > "$OUT" 2>"$OUT.err"

echo "OK -> $OUT ($(wc -l < "$OUT") lineas, $(wc -c < "$OUT") bytes)"
[ -s "$OUT.err" ] && { echo "--- stderr ---"; cat "$OUT.err"; } || echo "stderr vacio"
