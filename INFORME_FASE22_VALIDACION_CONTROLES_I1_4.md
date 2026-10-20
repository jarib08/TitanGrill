# INFORME FASE 22 — VALIDACIÓN DE PRIVILEGIOS, IDEMPOTENCIA Y AUDITORÍA FINANCIERA I1.4

**Proyecto:** Titan Grill  
**Repositorio:** `e:\Documents\titan_grill`  
**Rama Esperada y Confirmada:** `audit/titan-grill-forensic-handoff`  
**HEAD Commit:** `60cd590fdec62b0ba0f0bb3e81a1d44227d692a0`  
**Migración Candidata:** `supabase/migrations/20261010_i1_4_recibir_compra_definitiva_v2.sql`  
**SHA-256 Esperado:** `DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5`  
**SHA-256 Verificado:** `DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5` ✅  
**Fecha de Revisión:** 10 de Octubre de 2026  
**Modo:** ESTRICTAMENTE SOLO LECTURA

---

## 1. Estado Inicial de Git y Hash

```
Rama:   audit/titan-grill-forensic-handoff
HEAD:   60cd590fdec62b0ba0f0bb3e81a1d44227d692a0
Status: M newpromt.md / M src/components/AdminDashboard.jsx (modificaciones previas preservadas)
        ?? INFORME_FASE10–21 (sin seguimiento, preservados)
        ?? scratch/ (sin seguimiento, preservado)
        ?? supabase/migrations/20261010_i1_1..i1_4 (sin seguimiento, preservados)
Hash I1.4: DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5 ✅
```

El árbol de trabajo no se limpió ni revirtió. Se registró el estado antes de comenzar la revisión.

---

## 2. Alcance y Limitaciones de la Revisión

| Tipo | Detalle |
|:---|:---|
| **Incluido** | Auditoría estática de SQL de `I1.4`, `fn_is_socio()`, `fn_get_active_session()`, `movimientos_caja`, `movimientos_inventario`; análisis de privilegios usando evidencia de catálogo de producción recogida en Fase 14; análisis de idempotencia en frontend y DB. |
| **Excluido / NO VERIFICADO** | Llamadas HTTP reales a PostgREST; ACLs efectivas en vivo de producción (la evidencia disponible es el snapshot de la Fase 14, Oct 2026); staging inexistente. |
| **Limitación explícita** | No existe entorno de staging. La evidencia del catálogo de producción (`proacl`, `oid 101538/100711`) data de la Fase 14. Si se modificaron permisos desde entonces, los valores reales actuales serían diferentes y deberían consultarse nuevamente. |

---

## 3. Investigación A — Privilegios Efectivos

### A.1 Propietario de la Función

Según la evidencia de catálogo registrada en el **Informe de Fase 14** (única fuente disponible sin acceso a producción en vivo):
- Propietario de `recibir_compra`: `postgres`
- `SECURITY DEFINER SET search_path TO 'public'`

### A.2 ACL Efectiva de `recibir_compra(uuid, text, uuid)` en Producción

| Rol | Privilegio en Producción (Snapshot Fase 14) | Después de Aplicar `I1.4` |
|:---|:---|:---|
| `postgres` (propietario) | `EXECUTE` implícito (dueño) | `EXECUTE` implícito (sin cambio) |
| `PUBLIC` | **Sin permiso** (`REVOKE FROM PUBLIC` en Fase F1.4) | **Sin permiso** (`REVOKE FROM PUBLIC` en `I1.4`) |
| `anon` | **Sin permiso** (revocado en `F1.4`) | **Sin permiso** (`REVOKE FROM anon` en `I1.4`, L174) |
| `authenticated` | `EXECUTE` (`GRANT TO authenticated`) | `EXECUTE` (`GRANT TO authenticated, service_role`, L175) |
| `service_role` | `EXECUTE` | `EXECUTE` |

**Evidencia textual en `I1.4`** (Líneas 173–175):
```sql
REVOKE EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) TO authenticated, service_role;
```

**Limitación crítica:** Esta evidencia es el snapshot de la Fase 14. Los permisos actuales en producción deben verificarse mediante:
```sql
SELECT proname, proargtypes, proacl FROM pg_proc WHERE proname = 'recibir_compra';
```

### A.3 Privilegios de Funciones Auxiliares (Baseline `00000000000000`)

`fn_get_active_session(uuid)` — ACL en baseline (Líneas 4488–4490):
```sql
GRANT ALL ON FUNCTION public.fn_get_active_session(p_trabajador_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_get_active_session(p_trabajador_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_get_active_session(p_trabajador_id uuid) TO service_role;
```

> ⚠️ **HALLAZGO A-1 (RIESGO MEDIO):** En el baseline, `fn_get_active_session` tiene `GRANT ALL TO anon`. La migración `20260927_f1_4_endurecimiento_funciones.sql` revoca eso (`REVOKE FROM PUBLIC; REVOKE FROM anon; GRANT TO authenticated, service_role;`). Sin embargo, no puede confirmarse en esta revisión si esa migración fue aplicada en producción sin una consulta en vivo. Si `anon` aún tiene `EXECUTE` en `fn_get_active_session`, un atacante anónimo podría consultar IDs de sesiones activas. **Estado: PENDIENTE de verificación en catálogo de producción.**

### A.4 Otras Sobrecargas y Rutas Alternativas

- **Sobrecarga `recibir_compra(uuid, text)` (`oid 100711`):** Presente en producción antes de `I1.4`. El `DROP FUNCTION IF EXISTS public.recibir_compra(uuid, text);` (L29) la elimina al aplicar `I1.4`.
- **Funciones alternativas que ejecuten la misma operación:** No se identificó ninguna función en el repositorio que realice las mismas mutaciones (UPDATE compras + INSERT movimientos_caja + INSERT movimientos_inventario) que `recibir_compra`.

### A.5 Análisis de la Sentencia de Suspensión Propuesta

`REVOKE EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) FROM authenticated;`

| Objetivo | ¿Lo alcanza? | Explicación |
|:---|:---|:---|
| A. Impedir llamadas de usuarios ordinarios autenticados | **SÍ** | PostgreSQL retorna `ERROR 42501: permission denied for function recibir_compra`. PostgREST traduce esto en HTTP `403 Forbidden`. |
| B. Impedir todas las llamadas a través de PostgREST | **PARCIAL** | No bloquea peticiones con clave `service_role`, que conserva `EXECUTE`. |
| C. Detener cualquier ejecución, incluyendo rutas privilegiadas | **NO** | El propietario `postgres` y `service_role` pueden seguir ejecutando la función. Para suspensión total: `REVOKE EXECUTE ... FROM authenticated, service_role;`. |

**No se afirma `403` como respuesta universal sin esta distinción.**

### A.6 Restauración Segura

```sql
-- Restaurar solo los roles necesarios (principio de menor privilegio):
GRANT EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) TO authenticated, service_role;
-- NO conceder a PUBLIC ni a anon.
```

---

## 4. Investigación B — Idempotencia y Reintentos

Basada en [`AdminDashboard.jsx`](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L1858) y `I1.4`.

### B.1 Generación de Clave de Idempotencia en el Frontend

**Invocación 1** (L1858): `const operationKey = crypto.randomUUID();` generado en el mismo bloque de código, inmediatamente antes del `rpc(...)`. La clave NO se almacena en estado de React ni en localStorage. **Si el usuario recarga la página o el componente se re-renderiza, se genera una clave nueva.**

**Invocación 2** (L1895): `const operationKey = crypto.randomUUID();` generado en `handleConfirmarRecibir()`. Igual comportamiento: nueva clave en cada llamada al handler.

### B.2 Análisis de 10 Escenarios de Idempotencia

| # | Escenario | Estado Previo | Operaciones DB | Resultado de la Función | ¿Duplicación Posible? | Comportamiento Frontend | Evidencia |
|:--|:---|:---|:---|:---|:---|:---|:---|
| 1 | Primera llamada, respuesta recibida correctamente | `BORRADOR` | `FOR UPDATE` → UPDATE compras → INSERT mov_caja → INSERT mov_inventario (por ítem) | `{success: true, recovered: false}` | **No** | Muestra confirmación al usuario | L66–168 |
| 2 | Primera llamada exitosa en DB, respuesta HTTP perdida | `RECIBIDA` (ya mutada) | Ninguna (idempotencia activa) | Si reintenta con **misma clave**: `{success: true, recovered: true}` | **No** — siempre que reintente con la misma clave | El frontend no retiene la clave entre llamadas (nueva clave en cada llamada). Con clave nueva: `{success: false, message: 'La compra ya ha sido procesada...'}` | L76–88 |
| 3 | Reintento con la misma clave | `RECIBIDA` | Ninguna | `{success: true, recovered: true}` | **No** | Solo posible si el frontend retiene la clave (lo cual **no hace** actualmente) | L77 |
| 4 | Reintento con clave nueva | `RECIBIDA` | Ninguna | `{success: false, message: 'La compra ya ha sido procesada...'}` | **No** — rechazada sin mutación | Frontend puede mostrar error confuso al usuario | L85–87 |
| 5 | Reintento con clave NULL | `RECIBIDA` | Ninguna | `{success: false, message: 'La compra ya ha sido procesada...'}` | **No** — `NULL != NULL` en SQL, condición falla | Error devuelto | L77: `p_idempotency_key IS NOT NULL` falla → else branch |
| 6 | Dos llamadas concurrentes para la misma compra | `BORRADOR` (ambas) | Primera toma `FOR UPDATE`, segunda espera | La primera muta; la segunda ve `RECIBIDA`, retorna `success: false` o recupera | **No** — `FOR UPDATE` serializa | Segunda llamada retorna error (diferente clave) | L66–69, L76–88 |
| 7 | Excepción SQL antes de mutaciones | `BORRADOR` | Ninguna — `RETURN` antes de UPDATE/INSERT (L56, L62, L72, L91, L100) | `{success: false, ...}` vía `RETURN` normal (sin excepción) | **No** | Error del frontend en `recData.success === false` | L52–104 |
| 8 | Excepción SQL después de iniciar mutaciones | `BORRADOR` → parcialmente mutado | `ROLLBACK` automático de transacción PL/pgSQL | Excepción propagada como error PostgREST | **No** — ROLLBACK revierte todo | `error` en respuesta JS; `recData` es null | Garantía de atomicidad PL/pgSQL |
| 9 | Compra ya `RECIBIDA`, clave diferente | `RECIBIDA` | Ninguna | `{success: false, message: 'La compra ya ha sido procesada...'}` | **No** | Error mostrado al usuario | L85–87 |
| 10 | Repetición desde dos sesiones de browser simultáneas | `BORRADOR` | Segunda espera `FOR UPDATE` | Primer commit gana; segunda retorna `success: false` | **No** | Segunda sesión ve error | L66–69 |

### B.3 HALLAZGO B-1: Vulnerabilidad de Recuperación ante Pérdida de Respuesta HTTP

> ⚠️ **HALLAZGO B-1 (RIESGO MEDIO — NO BLOQUEANTE):** Cuando se pierde la respuesta HTTP después de que el servidor completó el commit (Escenario 2), el frontend **no puede recuperar** la operación de forma automática porque `crypto.randomUUID()` genera una nueva clave en cada llamada. El usuario verá un error de "compra ya procesada" si reintenta, en lugar del JSON de recuperación `{recovered: true}`. La función SQL tiene la lógica de recuperación correcta (L77), pero el frontend no la aprovecha porque descarta la clave original.

**Impacto:** El usuario podría creer que la compra falló aunque fue exitosa. No hay duplicación financiera, pero sí riesgo de confusión operativa.

**Solución propuesta (sin implementar):** Persistir la clave de idempotencia en React state o localStorage durante el flujo de recepción, y reutilizarla en el reintento dentro de un tiempo límite razonable.

---

## 5. Investigación C — Consultas de Auditoría Financiera Corregidas

**Hallazgos sobre la estructura de tablas:**
- `movimientos_caja`: Contiene `metodo_pago`, `sesion_id`, `compra_id`, `trabajador_id`, `tipo`, `monto`. Constraint: `CHECK (metodo_pago IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA'))`.
- `movimientos_inventario`: Contiene `compra_id`, `insumo_id`, `tipo`, `cantidad`, `usuario_id`. Constraint `chk_movimientos_compra_trazabilidad` requiere `compra_id IS NOT NULL` cuando `tipo = 'ENTRADA_COMPRA'`.
- `compras`: Contiene `estado`, `total`, `idempotency_key`, `metodo_pago`.

### C.1 Compras RECIBIDAS sin Movimiento de Inventario

```sql
SELECT c.id, c.total, c.metodo_pago, c.idempotency_key
FROM public.compras c
WHERE c.estado = 'RECIBIDA'
  AND NOT EXISTS (
    SELECT 1
    FROM public.movimientos_inventario mi
    WHERE mi.compra_id = c.id AND mi.tipo = 'ENTRADA_COMPRA'
  );
```

**Anomalía:** Compras marcadas RECIBIDA sin entrada en inventario. **FP:** Ninguno esperado. **Umbral:** ≥ 1 fila → suspender. **Responsable:** Administrador financiero + DBA.

### C.2 Duplicación de Entradas de Inventario por Insumo en la Misma Compra

```sql
SELECT mi.compra_id, mi.insumo_id, COUNT(*) AS num_entradas, SUM(mi.cantidad) AS total_cantidad
FROM public.movimientos_inventario mi
WHERE mi.tipo = 'ENTRADA_COMPRA' AND mi.compra_id IS NOT NULL
GROUP BY mi.compra_id, mi.insumo_id
HAVING COUNT(*) > 1;
```

**Anomalía:** Mismo insumo insertado dos veces para la misma compra. **FP:** Si la compra tiene dos líneas legítimas del mismo insumo en `compra_detalles`, verificar antes de escalar. **Umbral:** ≥ 1 fila no justificable por datos. **Responsable:** DBA.

### C.3 CRÍTICA — Egreso Imputado a Sesión de Caja de Otro Trabajador

```sql
SELECT
  mc.id AS mov_id,
  mc.compra_id,
  mc.trabajador_id AS ejecutor_uid,
  mc.sesion_id,
  sc.trabajador_id AS dueno_sesion_uid,
  mc.metodo_pago,
  mc.monto
FROM public.movimientos_caja mc
JOIN public.sesiones_caja sc ON mc.sesion_id = sc.id
WHERE mc.compra_id IS NOT NULL
  AND mc.tipo = 'EGRESO'
  AND mc.trabajador_id <> sc.trabajador_id;
```

**Anomalía:** Bug de asignación cruzada reactivado. **FN:** Egresos NEQUI/BANCOLOMBIA con `sesion_id NULL` no aparecen (correcto — son legítimos). **Umbral:** ≥ 1 fila → suspensión inmediata. **Responsable:** Socio Administrador.

### C.4 Egresos EFECTIVO sin Sesión de Caja

```sql
SELECT mc.id, mc.compra_id, mc.monto, mc.metodo_pago, mc.fecha, mc.trabajador_id
FROM public.movimientos_caja mc
WHERE mc.compra_id IS NOT NULL
  AND mc.tipo = 'EGRESO'
  AND mc.metodo_pago = 'EFECTIVO'
  AND mc.sesion_id IS NULL;
```

**Anomalía:** Violación del guard L99–104 de `I1.4`. **Umbral:** ≥ 1 fila → auditoría urgente. **Responsable:** Socio Administrador.

### C.5 NUEVA — Discrepancia entre Total de Compra y Suma de Detalles

```sql
SELECT c.id, c.total AS total_registrado, COALESCE(SUM(cd.subtotal), 0) AS total_detalles
FROM public.compras c
LEFT JOIN public.compra_detalles cd ON cd.compra_id = c.id
WHERE c.estado = 'RECIBIDA'
GROUP BY c.id, c.total
HAVING ABS(c.total - COALESCE(SUM(cd.subtotal), 0)) > 0.01;
```

**Anomalía:** Total almacenado en `compras` difiere de la suma de sus detalles. **Umbral:** ≥ 1 fila con diferencia > $0.01. **Responsable:** Administrador financiero.

---

## 6. Investigación D — Atomicidad y Estados de Error

| Tipo de Retorno | ¿Mutaciones realizadas? | Estado Transaccional |
|:---|:---|:---|
| `RETURN json_build_object('success', false, ...)` (L56, L62, L72, L86, L91, L100) | **No** | Sin mutaciones previas. RETURN temprano sin ningún cambio. |
| `RETURN json_build_object('success', true, ...)` (L160–168) | **Sí** | Commit completo de UPDATE compras + INSERT mov_caja + INSERT mov_inventario. |
| Excepción SQL (e.g., violación de constraint) | **Depende** — ROLLBACK automático | PostgreSQL hace ROLLBACK de toda la transacción. Ninguna mutación persiste. |

> **HALLAZGO D-1 (INFORMATIVO):** La distinción entre `success: false` (retorno normal sin excepción) y excepción SQL es coherente. No existe escenario donde `success: true` sea devuelto con mutaciones incompletas. La atomicidad está garantizada por PL/pgSQL.

---

## 7. Investigación E — Plan de Validación Segura

| Etapa | Descripción | Entorno | Estado |
|:---|:---|:---|:---|
| 1. Revisión estática SQL y frontend | Análisis línea por línea de `I1.4` y `AdminDashboard.jsx`. | Local | **COMPLETADO** |
| 2. Verificación de hash | SHA-256 confirmado. | Local | **COMPLETADO** |
| 3. Pruebas locales de idempotencia/concurrencia | Suite arnés PG18, 20/20 pasados. | Local | **COMPLETADO** |
| 4. Validación de permisos | Análisis ACL snapshot Fase 14 + estático. | Local (análisis) | **COMPLETADO (parcial)** |
| 5. Validación contrato PostgREST | Llamada HTTP a `/rest/v1/rpc/recibir_compra`. | Staging no existe | **NO VERIFICADO** |
| 6. Autorización formal | Aprobación explícita del responsable. | — | **PENDIENTE** |
| 7. Despliegue | Aplicar `I1.4` en consola SQL de Supabase. | Producción | **PENDIENTE** |
| 8. Recarga caché PostgREST | `NOTIFY pgrst, 'reload schema';` | Producción | **PENDIENTE** |
| 9. Prueba funcional | Primera compra real supervisada, autorizada, con conciliación posterior. | Producción | **PENDIENTE** |
| 10. Consultas de conciliación | Ejecutar las 5 queries SELECT de auditoría de esta fase. | Producción | **PENDIENTE** |

---

## 8. Matriz de Severidad y Riesgos

| Hallazgo | Severidad | Estado | Impacto | Mitigación |
|:---|:---|:---|:---|:---|
| **A-1** — ACL de `fn_get_active_session` no verificada en vivo | MEDIA | **PENDIENTE** | `anon` podría consultar IDs de sesión activas. No permite mutaciones. | Verificar con `SELECT proacl FROM pg_proc WHERE proname = 'fn_get_active_session';` post-despliegue. |
| **B-1** — Frontend no retiene clave de idempotencia | MEDIA | **ABIERTO — NO BLOQUEANTE** | Confusión operativa ante respuesta HTTP perdida. Sin duplicación financiera. | Propuesta futura: persistir clave en React state. |
| Contrato RPC 1:1 | — | **APROBADO** | — | `p_compra_id`, `p_metodo_pago`, `p_idempotency_key` exactos. |
| Aislamiento de sesión de caja | — | **APROBADO** | — | `fn_get_active_session(auth.uid())` verificado en código SQL L96. |
| Guard EFECTIVO sin sesión | — | **APROBADO** | — | L99–104 de `I1.4` rechaza sin mutar. |
| Trazabilidad inventario | — | **APROBADO** | — | Constraint DB + INSERT L150–157 incluye `compra_id`. |
| Atomicidad transaccional | — | **APROBADO** | — | Todos los retornos son atómicos. |
| PostgREST en vivo | MEDIA | **NO VERIFICADO** | Sin staging, contrato HTTP no validado. | Verificar en Etapa 8 post-despliegue. |

---

## 9. Contingencia Real vs. Propuesta

| Contingencia | Estado | Observación |
|:---|:---|:---|
| Ocultar botón en UI | **Disponible** | Solo detiene acceso vía interfaz. No bloquea `service_role`. |
| `REVOKE EXECUTE FROM authenticated` | **Disponible** — requiere autorización | Detiene usuarios ordinarios. `service_role` continúa. |
| `REVOKE EXECUTE FROM authenticated, service_role` | **Disponible** — suspensión completa de clientes | Opción más segura para emergencias. |
| Hotfix `I1.5` | **NO EXISTE** | No declarar como contingencia hasta que esté escrita, revisada y probada. |
| Rollback DDL arcaico (`oid 101538`) | **Disponible técnicamente — NO RECOMENDADO** | Restaura bug de caja cruzada (`LIMIT 1`). No revierte transacciones ya ejecutadas. |

---

## 10. Dictamen Final

### `LISTA PARA SOLICITAR AUTORIZACIÓN`

El contrato RPC, las salvaguardas críticas de caja y la atomicidad transaccional están verificados. Los hallazgos abiertos (A-1 y B-1) no introducen riesgo de duplicación financiera ni bloquean el despliegue. La única verificación estructuralmente imposible sin staging (PostgREST en vivo) se realiza como primera acción post-despliegue.

**Esta fase no autoriza el despliegue. Se requiere aprobación explícita del responsable del proyecto.**

---

## 11. Registro de Rendición de Cuentas

**Verificado:** Hash SHA-256 de `I1.4` en vivo (PowerShell), estado Git, SQL de `I1.4` (L1–176), `fn_get_active_session` en baseline (L1127–1145), `fn_is_socio` en arnés local, estructura de `movimientos_caja` e `movimientos_inventario`, invocaciones en `AdminDashboard.jsx` (L1858–1864, L1895–1900), ACL snapshot Fase 14.

**No ejecutado:** DDL, DML, RPC mutante, lecturas de datos en producción Supabase, commits, push, rollbacks, modificaciones a archivos, creación de `I1.5`.

*Fin del informe de Fase 22.*
