# SQL legado — NO refleja producción

Estos archivos estaban en la raíz del repositorio. Se archivaron aquí porque
**describen un estado que no corresponde a la base de datos de producción**, y
ejecutarlos podría degradar la seguridad.

## Evidencia de la discrepancia

Verificado contra producción con `pg_dump` el 2026-09-27:

| Archivo | Lo que declara | Lo que hay en producción |
|---|---|---|
| `supabase_security_hardening.sql` | `clientes` UPDATE `USING (auth.role() = 'authenticated')` — cualquier usuario logueado | `clientes_update_admin_only` `USING fn_is_admin()` — solo administradores |
| `supabase_schema.sql` | Políticas `using (true)` de "permitir todo" sobre una tabla `clients` | Esa tabla no existe; la real es `clientes` con RLS y 4 políticas |
| `supabase_security_hardening.sql` | `increment_stamps` sin `SET search_path` | En producción sí tiene `search_path=public` |

Ejecutar `supabase_security_hardening.sql` sobre producción **abriría** el
UPDATE de `clientes` a cualquier trabajador. Es un retroceso de seguridad.

## Fuente de verdad

La foto real de producción está en:

    supabase/migrations/00000000000000_baseline_recuperado_de_produccion.sql

generada con `pg_dump --schema-only` (solo lectura). Cualquier cambio futuro
debe salir de una migración versionada, no de estos archivos.

## Por qué no se borraron

Conservan el historial de intención del proyecto (sistema de referidos,
importación inicial) y sirven de contexto. Son documentación histórica,
**no instrucciones ejecutables**.
