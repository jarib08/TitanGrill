-- =====================================================================
-- TITAN GRILL — FASE 0 · INVENTARIO FORENSE DE BASE DE DATOS
-- Rama: audit/titan-grill-forensic-handoff
-- Propósito: recuperar en Git la definición real de RPCs, RLS, triggers,
--            constraints e índices que hoy solo existen en producción (E1).
--
-- GARANTÍA DE SEGURIDAD — este script es 100% READ-ONLY:
--   · Una sola sentencia SELECT sobre catálogos del sistema (pg_*, information_schema).
--   · NO contiene INSERT / UPDATE / DELETE / TRUNCATE / MERGE.
--   · NO contiene DDL (CREATE / ALTER / DROP / GRANT / REVOKE).
--   · NO invoca ninguna RPC de negocio.
--   · NO lee datos de negocio: ni una fila de ventas, clientes, caja o insumos.
--     (La única métrica de volumen es pg_class.reltuples, una ESTIMACIÓN ya
--      almacenada en el catálogo — no ejecuta COUNT(*) ni escanea tablas.)
--   · NO modifica producción de ninguna forma.
--
-- CÓMO EJECUTARLO:
--   Supabase → SQL Editor → pegar completo → RUN.
--   Devuelve UN solo resultado. Usa "Download CSV" o copia el grid completo.
--   Si el editor corta la salida, ejecútalo filtrando por bloque, p. ej.
--   envolviéndolo:  SELECT * FROM (<todo el script sin el ; final>) q
--                   WHERE seccion = '05_FUNCIONES_DEFINICION_COMPLETA';
-- =====================================================================

WITH

-- 01 · Tablas públicas: estado de RLS, propietario, GRANTs y volumen estimado.
--      Aquí se confirma o descarta B1/B2 (¿está RLS activo? ¿quién tiene GRANT?)
--      y A3 (¿qué tablas se acercan al corte de 1000 filas de PostgREST?).
s01 AS (
  SELECT 1 AS orden,
         '01_TABLAS_RLS_Y_GRANTS' AS seccion,
         c.relname::text AS objeto,
         format('rls_habilitado=%s | rls_forzado=%s | filas_estimadas=%s | owner=%s | grants=%s',
                c.relrowsecurity,
                c.relforcerowsecurity,
                c.reltuples::bigint,
                pg_get_userbyid(c.relowner),
                coalesce(c.relacl::text, 'DEFAULT (sin GRANT explicito)')) AS detalle
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),

-- 02 · Políticas RLS completas: comando, roles, USING y WITH CHECK.
--      Requisito 2 del pedido. Es la evidencia directa para B1 y B2.
s02 AS (
  SELECT 2,
         '02_POLITICAS_RLS',
         format('%s -> %s', p.tablename, p.policyname),
         format('cmd=%s | permissive=%s | roles=%s | USING=%s | WITH_CHECK=%s',
                p.cmd,
                p.permissive,
                p.roles::text,
                coalesce(p.qual, '(sin USING)'),
                coalesce(p.with_check, '(sin WITH CHECK)'))
  FROM pg_policies p
  WHERE p.schemaname = 'public'
),

-- 03 · Diagnóstico derivado de RLS: tablas sin protección real.
--      "RLS_DESACTIVADO" = expuesta vía PostgREST según los GRANTs.
--      "RLS_SIN_POLITICAS" = bloqueada por completo (posible funcionalidad muerta).
s03 AS (
  SELECT 3,
         '03_DIAGNOSTICO_RLS',
         c.relname::text,
         CASE
           WHEN NOT c.relrowsecurity THEN 'RLS_DESACTIVADO — sin proteccion a nivel de fila'
           WHEN NOT EXISTS (SELECT 1 FROM pg_policies p
                            WHERE p.schemaname = 'public' AND p.tablename = c.relname)
             THEN 'RLS_SIN_POLITICAS — todo acceso denegado excepto SECURITY DEFINER'
           ELSE 'RLS_CON_POLITICAS — revisar seccion 02'
         END
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),

-- 04 · Resumen de funciones: SECURITY DEFINER, search_path y GRANT EXECUTE.
--      Requisito 1 (metadatos). Evidencia para B6 (search_path no fijado)
--      y para saber si anon puede ejecutar algo que no debería.
s04 AS (
  SELECT 4,
         '04_FUNCIONES_RESUMEN',
         format('%s(%s)', p.proname, pg_get_function_identity_arguments(p.oid)),
         format('seguridad=%s | search_path=%s | volatilidad=%s | retorna=%s | lenguaje=%s | owner=%s | execute=%s',
                CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END,
                coalesce(array_to_string(p.proconfig, ' ; '), '*** NO FIJADO ***'),
                p.provolatile,
                pg_get_function_result(p.oid),
                l.lanname,
                pg_get_userbyid(p.proowner),
                coalesce(p.proacl::text, 'DEFAULT (PUBLIC EXECUTE)'))
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l  ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
),

-- 05 · Definición COMPLETA de cada función. Requisito 1.
--      Es el bloque más voluminoso y el más importante: aquí viene
--      registrar_venta, recibir_compra, cerrar_caja, generar_liquidacion, etc.
s05 AS (
  SELECT 5,
         '05_FUNCIONES_DEFINICION_COMPLETA',
         format('%s(%s)', p.proname, pg_get_function_identity_arguments(p.oid)),
         pg_get_functiondef(p.oid)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
),

-- 06 · Triggers no internos, con definición completa. Requisito 4.
s06 AS (
  SELECT 6,
         '06_TRIGGERS',
         format('%s ON %s', t.tgname, c.relname),
         pg_get_triggerdef(t.oid, true)
  FROM pg_trigger t
  JOIN pg_class c     ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal
),

-- 07 · Vistas y vistas materializadas con su definición. Requisito 5.
s07 AS (
  SELECT 7, '07_VISTAS', v.viewname::text, pg_get_viewdef(format('public.%I', v.viewname)::regclass, true)
  FROM pg_views v WHERE v.schemaname = 'public'
  UNION ALL
  SELECT 7, '07_VISTAS', m.matviewname::text || ' (MATERIALIZADA)',
         pg_get_viewdef(format('public.%I', m.matviewname)::regclass, true)
  FROM pg_matviews m WHERE m.schemaname = 'public'
),

-- 08 · Constraints: PK, FK, UNIQUE y CHECK sobre todas las tablas públicas.
--      Requisito 6. Incluye chk_movimientos_compra_trazabilidad (D2.3) y
--      permite ver qué invariantes contables están realmente forzadas en BD.
s08 AS (
  SELECT 8,
         '08_CONSTRAINTS',
         format('%s -> %s', c.relname, con.conname),
         format('tipo=%s | %s',
                CASE con.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY'
                                 WHEN 'u' THEN 'UNIQUE'      WHEN 'c' THEN 'CHECK'
                                 WHEN 'x' THEN 'EXCLUDE'     ELSE con.contype::text END,
                pg_get_constraintdef(con.oid, true))
  FROM pg_constraint con
  JOIN pg_class c     ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
),

-- 09 · Índices. Requisito 6. Confirma idx_sesion_unica_abierta,
--      idx_movinv_insumo_costo_snap y detecta FKs sin índice (rendimiento, C).
s09 AS (
  SELECT 9, '09_INDICES', format('%s -> %s', i.tablename, i.indexname), i.indexdef
  FROM pg_indexes i WHERE i.schemaname = 'public'
),

-- 10 · Columnas de todas las tablas públicas: tipo, nullable y DEFAULT.
--      Necesario para validar los contratos frontend↔RPC (E2, D2) y para
--      saber si costo_unitario_historico / payload_fingerprint existen de verdad.
s10 AS (
  SELECT 10,
         '10_COLUMNAS',
         format('%s.%s', col.table_name, col.column_name),
         format('pos=%s | tipo=%s | nullable=%s | default=%s',
                col.ordinal_position,
                coalesce(col.data_type, '?')
                  || coalesce('(' || col.character_maximum_length || ')', '')
                  || coalesce('(' || col.numeric_precision || ',' || col.numeric_scale || ')', ''),
                col.is_nullable,
                coalesce(col.column_default, '(ninguno)'))
  FROM information_schema.columns col
  JOIN pg_class c     ON c.relname = col.table_name
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = col.table_schema
  WHERE col.table_schema = 'public' AND c.relkind = 'r'
),

-- 11 · AUDITORÍA DE NÓMINA Y ASISTENCIA (no asume nada).
--      Busca cualquier tabla o columna que pudiera ser la fuente real de
--      turnos/asistencia/jornadas, y cómo se declaran modalidad y tarifa.
--      Si esta sección vuelve vacía, queda documentado que NO existe registro
--      confiable de asistencia y la nómina no puede derivarse automáticamente.
s11 AS (
  SELECT 11,
         '11_NOMINA_TABLAS_CANDIDATAS',
         c.relname::text,
         format('filas_estimadas=%s — nombre sugiere turno/asistencia/nomina', c.reltuples::bigint)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND c.relname ~* '(turno|asistencia|jornada|nomina|horario|liquidacion|marcaje|fichaje|empleado|trabajador|perfil)'
  UNION ALL
  SELECT 11,
         '11_NOMINA_COLUMNAS_CANDIDATAS',
         format('%s.%s', col.table_name, col.column_name),
         format('tipo=%s | nullable=%s | default=%s',
                col.data_type, col.is_nullable, coalesce(col.column_default, '(ninguno)'))
  FROM information_schema.columns col
  WHERE col.table_schema = 'public'
    AND col.column_name ~* '(turno|asistencia|jornada|modalidad|tarifa|salario|sueldo|hora|dia_trabajado|fecha_ingreso|periodo)'
),

-- 12 · Tipos ENUM del esquema público.
--      Revela si metodo_pago / estado / tipo_operacion son enums cerrados o
--      texto libre (relevante para A5: valores de tipo_operacion realmente posibles).
s12 AS (
  SELECT 12,
         '12_ENUMS',
         t.typname::text,
         string_agg(e.enumlabel, ' | ' ORDER BY e.enumsortorder)
  FROM pg_type t
  JOIN pg_enum e      ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
  GROUP BY t.typname
),

-- 13 · Tablas publicadas a Realtime. Relevante para C6 y para exposición de datos.
s13 AS (
  SELECT 13,
         '13_REALTIME_PUBLICACIONES',
         format('%s.%s', pt.schemaname, pt.tablename),
         format('publicacion=%s', pt.pubname)
  FROM pg_publication_tables pt
  WHERE pt.schemaname = 'public'
),

-- 14 · Extensiones instaladas (contexto: pg_cron, pgcrypto, etc.).
s14 AS (
  SELECT 14, '14_EXTENSIONES', e.extname::text,
         format('version=%s | esquema=%s', e.extversion, n.nspname)
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
)

SELECT orden, seccion, objeto, detalle
FROM (
  SELECT * FROM s01 UNION ALL SELECT * FROM s02 UNION ALL SELECT * FROM s03 UNION ALL
  SELECT * FROM s04 UNION ALL SELECT * FROM s05 UNION ALL SELECT * FROM s06 UNION ALL
  SELECT * FROM s07 UNION ALL SELECT * FROM s08 UNION ALL SELECT * FROM s09 UNION ALL
  SELECT * FROM s10 UNION ALL SELECT * FROM s11 UNION ALL SELECT * FROM s12 UNION ALL
  SELECT * FROM s13 UNION ALL SELECT * FROM s14
) q
ORDER BY orden, seccion, objeto;
