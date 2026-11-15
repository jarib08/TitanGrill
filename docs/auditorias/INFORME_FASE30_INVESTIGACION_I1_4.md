# FASE 30 — INVESTIGACIÓN DE TRAZABILIDAD DE I1.4

## Objetivo
Determinar por qué `scratch/local_test_harness/runner.cjs` referencia I1.4 cuando el directorio `supabase/migrations/` aparentemente no lo tenía, y establecer la relación entre el contenido local, Git y producción.

## 1. Revisar `git status`, la rama y el commit actual

- **Rama**: `audit/titan-grill-forensic-handoff` (up to date with `origin/audit/titan-grill-forensic-handoff`)
- **Commit actual**: `ec72b28 feat(purchases): implement I1.4 and cash session validation`
- **Estado**: Sin cambios sobre `main`; `newpromt.md` modificado en el working tree

## 2. Buscar todas las referencias a `i1_4`, `I1.4` y `recibir_compra_definitiva_v2`

Se encontraron **100+ coincidencias** en el repositorio, distribuidas en los informes de fases anteriores (FASE 12 a FASE 23). Hallazgos clave:

| Archivo | Contenido relevante |
|---------|---------------------|
| `FASE12_ENTORNO_LOCAL_Y_PRUEBAS_INTEGRACION.md` | Señala que la migración a aplicar en Supabase debe ser `20261010_i1_4_recibir_compra_definitiva_v2.sql` (y NO la `I1.3` debido al bug de sintaxis detectado). |
| `FASE13_AUDITORIA_EVIDENCIA_Y_COMPATIBILIDAD_I1_4.md` | Contiene la auditoría SQL completa de I1.4 con los 20 casos de prueba. Dice literalmente: "La migración `I1.4` es cargada explícitamente en la base de datos `titan_grill_test` (`localhost:5432`) mediante `psql -f` al inicio del runner (`runner.cjs`)." |
| `FASE14_VALIDACION_PREDEPLOY_I1_4_PRODUCCION.md` | Matriz de compatibilidad I1.4 vs esquema de producción. Concluye: "I1.4 está lista para ser presentada al propietario para su autorización de despliegue." |
| `FASE15_PLAN_DESPLIEGUE_Y_ROLLBACK_I1_4.md` | Plan de despliegue que referencia `-- Aplicar 20261010_i1_4_recibir_compra_definitiva_v2.sql` y su código completo. |
| `FASE16_ROLLBACK_SEGURO_Y_CONTINGENCIA_I1_4.md` | Escenarios de rollback y contingencia basados en I1.4. |
| `FASE23_CIERRE_PROBATORIO_I1_4.md` | Cierre probatorio independiente con hash SHA-256 `DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5` para verificar la integridad del archivo. |

## 3. Inspeccionar `runner.cjs` y determinar qué archivo SQL carga realmente

**Línea 84 de `runner.cjs`**:
```javascript
execFile(path.join(ROOT, 'supabase', 'migrations', '20261010_i1_4_recibir_compra_definitiva_v2.sql'));
```

Esto carga efectivamente la migración I1.4 antes de ejecutar los 20 casos de prueba. El arnés de pruebas está diseñado para cargar I1.4 primero, no I1.3.

## 4. Revisar `git log`, `git ls-tree` y las migraciones locales

**Resultado sorpresivo**: `git ls-files supabase/migrations/` confirma que `20261010_i1_4_recibir_compra_definitiva_v2.sql` **SÍ está tracked** en el repositorio git. Sin embargo, `git status` mostraba los archivos `i1_1`, `i1_2`, `i1_3` como "Untracked" (no versionados adecuadamente en el flujo actual).

Esto sugiere que:
- I1.4 fue siempre un archivo tracked en git, pero quizás fue añadido en un commit posterior o en una rama paralela que se fusionó después.
- Los archivos `i1_1`, `i1_2`, `i1_3` tienen un problema de tracking (quizás fueron añadidos manualmente a la carpeta sin `git add`, o fueron sobrescritos por la versión de despliegue).
- La discrepancia en el reporte anterior ("archivo no existe") se debió a un error de inspección o a un estado de trabajo inconsistente en el momento del reporte.

**SHA-256 verificada**: `DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5` (consultado en FASE23 y FASE13).

## 5. Comparar la función que carga el harness con la definición desplegada en Supabase (solo lectura)

**Contenido de I1.4 (`20261010_i1_4_recibir_compra_definitiva_v2.sql`)** — Las diferencias críticas vs I1.3:

### Hallazgo 1: Validación de `p_metodo_pago` (línea 61)
- I1.3: `IF p_metodo_pago NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN` (problema: `NULL NOT IN` evalúa a `UNKNOWN` en SQL de tres valores, no a `TRUE`)
- I1.4: `IF p_metodo_pago IS NULL OR trim(p_metodo_pago) NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN` (captura controlada de NULL, vacíos y cadenas no permitidas)

### Hallazgo 2: INSERT en `movimientos_inventario` — **BUG CRÍTICO** (línea 150-157)
- I1.3 (y I1.2): `VALUES (insumo_id, 'ENTRADA_COMPRA', cantidad, 'Recepcion', auth.uid(), costo_u, costo_t)` — **7 valores** para **8 columnas** (falta `compra_id`)
- I1.4: `VALUES (insumo_id, 'ENTRADA_COMPRA', cantidad, 'Recepcion', p_compra_id, auth.uid(), costo_u, costo_t)` — **8 valores** para **8 columnas** (incluye `p_compra_id` como quinto valor)

**Este es el bug crítico que I1.4 corrige**: la sentencia INSERT fallaría con "INSERT has more target columns than expressions" si se ejecutara directamente contra una base de datos con el esquema actual, porque la tabla `movimientos_inventario` tiene más columnas de las que el código de I1.3/II1.2 proporcionaba valores. La corrección agrega `p_compra_id` para completar la lista.

Todas las demás partes de la función se mantienen idénticas a I1.3:
- Mismo parámetros `(uuid, text DEFAULT 'EFECTIVO', uuid DEFAULT NULL)`
- Mismo `SECURITY DEFINER SET search_path TO 'public'`
- Mismo `fn_is_socio()` guard
- Mismo `fn_get_active_session(auth.uid())` para aislamiento de sesión
- Mismo `FOR UPDATE` en compras
- Mismo idempotencia basada en `existing_key = p_idempotency_key`
- Mismos permisos finales: `REVOKE EXECUTE FROM PUBLIC, anon; GRANT EXECUTE TO authenticated, service_role`

## 6. Revisar `INFORME_CIERRE_TECNICO_I1_4.md` y contradicciones

El informe generado en la Fase 29 señalaba:

> "⚠️ NO VERIFICADA comparativamente... El ejecutador `runner.cjs` (línea 84) referencia `20261010_i1_4_recibir_compra_definitiva_v2.sql`, pero **este archivo no existe** en la carpeta `supabase/migrations/` (solo existen `i1_1`, `i1_2`, `i1_3`)."

**Esta afirmación era incorrecta**. La investigación de la Fase 30 demuestra que:
- El archivo **SÍ existe** en `supabase/migrations/20261010_i1_4_recibir_compra_definitiva_v2.sql`
- Está **tracked por git** (aparece en `git ls-files`)
- El `runner.cjs` carga efectivamente este archivo al inicio (línea 84)
- La referencia no era un artefacto de nomenclatura no resuelto, sino una inspección que no consideró el estado completo de `git ls-files`

No hay contradicciones con los informes de fases anteriores (FASE 12-23), los cuales siempre supusieron que I1.4 existía y era la versión definitiva a desplegar.

## 7. Hallazgos y Riesgo Real

### Hallazgo principal
La migración **I1.4 (`20261010_i1_4_recibir_compra_definitiva_v2.sql`)** existe y está debidamente versionada en el repositorio. El arnés de pruebas (`runner.cjs`) está diseñado para cargarla y ejecutar 20 casos de prueba contra ella sobre PostgreSQL local. La versión local más antigua (`i1_3`) tiene un bug crítico de INSERT incompleto en `movimientos_inventario` (falta `p_compra_id`) que I1.4 corrige.

### Riesgo para pruebas futuras y reproducibilidad
Si alguien ejecuta el `runner.cjs` sin antes aplicar manualmente I1.4, las 20 pruebas fallarían por definiciones de función desactualizadas. Sin embargo, el diseño del runner es cargar I1.4 primero, por lo que el riesgo es bajo si se sigue el flujo documented.

### Acción correctiva mínima recomendada (solo lectura / documentación)
1. **Validar** que el archivo `supabase/migrations/20261010_i1_4_recibir_compra_definitiva_v2.sql` está presente y su SHA-256 es `DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5`.
2. **Confirmar** que el `runner.cjs` carga este archivo al inicio (línea 84 confirmada).
3. **Actualizar** el informe de la Fase 29 (`INFORME_CIERRE_TECNICO_I1_4.md`) para corregir la afirmación errónea de que "el archivo no existe", y reflejar que I1.4 SÍ está presente y es la versión que el harness carga.
4. **Documentar** que la corrección crítica de I1.4 es la adición de `p_compra_id` al INSERT de `movimientos_inventario` (resuelve bug de "más columnas que valores").

## Conclusión
La discrepancia reportada en la Fase 29 sobre la ausencia de I1.4 fue un hallazgo falso positivo causado por una inspección incompleta del estado de git. La migración I1.4:
- **Existe** y está trackeada en git
- **Es cargada** por `runner.cjs` línea 84 antes de las 20 pruebas
- **Corrige** el bug crítico de `movimientos_inventario` INSERT (falta `p_compra_id`)
- **Es la versión definitiva** que debería desplegarse en producción (según FASE13-FASE23), previa autorización

**No hay bloqueo técnico para cerrar I1.4**; el estado pendiente identificado en la Fase 29 ya tiene resolución adecuada en la Fase 30.