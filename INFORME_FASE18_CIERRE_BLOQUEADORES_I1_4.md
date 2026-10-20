# INFORME FASE 18 — CIERRE DE BLOQUEADORES Y PREPARACIÓN DE AUTORIZACIÓN DE I1.4

> **Proyecto:** Titan Grill  
> **Fecha:** 10 de Octubre, 2026  
> **Rama:** `audit/titan-grill-forensic-handoff`  
> **HEAD:** `60cd590fdec62b0ba0f0bb3e81a1d44227d692a0`  
> **Proyecto Supabase ID:** `[PROJECT_REF_REDACTADO]`  
> **Migración Candidata:** `supabase/migrations/20261010_i1_4_recibir_compra_definitiva_v2.sql`  
> **SHA-256 Esperado e Intacto:** `DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5`  
> **Dictamen Final:** `LISTA PARA SOLICITAR AUTORIZACIÓN`

---

## 1. RESUMEN EJECUTIVO

El presente informe consolida el **cierre documental de todos los bloqueadores técnicos** y la preparación de la solicitud de autorización formal de despliegue para la migración `20261010_i1_4_recibir_compra_definitiva_v2.sql` (`I1.4`).

---

## 2. CONFIRMACIÓN EXPLÍCITA DE SEGURIDAD Y COMANDOS

Se confirma formalmente que durante la ejecución de la Fase 18:
- **Comandos Ejecutados:** Ningún comando destructivo ni mutante. Se efectuó inspección de solo lectura.
- **Escrituras en Producción:** **0 escrituras, 0 migraciones aplicadas, 0 ejecuciones DDL/DML y 0 RPCs mutantes invocadas en producción.**
- **Archivos Locales:** `0` archivos de la aplicación o migraciones fueron modificados.

---

## 3. ANÁLISIS Y RESOLUCIÓN DE BLOQUEADORES

### 3.1 Revisión del Rollback y Riesgos del Código Antiguo
- **Pérdida de Protecciones al Revertir:** Si se reinstalaran las funciones anteriores (oid 101538 y 100711), se perdería el filtro `v_sesion_id := public.fn_get_active_session(auth.uid());`, reintroduciendo el fallo por el cual los egresos en efectivo se asignaban a la última caja abierta de cualquier trabajador en el sistema.
- **Diferenciación de Reversión:**
  - **Fallo antes de `COMMIT`:** PostgreSQL realiza `ROLLBACK` transaccional automático. Cero datos o código alterados.
  - **Fallo post-despliegue sin transacciones:** Se reinstalan los DDLs originales mediante el script de rollback capturado.
  - **Fallo post-despliegue con transacciones procesadas:** Cambiar la función SQL **no altera los datos financieros ya insertados**. Cualquier ajuste a egresos o inventario requiere notas de ajuste contable aprobadas.

### 3.2 Compatibilidad RPC con PostgREST
- **Consumidor en Frontend:** [`AdminDashboard.jsx`](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L1860) invoca `supabase.rpc('recibir_compra', { p_compra_id, p_metodo_pago, p_idempotency_key })`.
- **Eliminación de Ambigüedad PostgREST (PGRST202):** La presencia de la sobrecarga legacy de 2 parámetros generaba ambigüedad en peticiones HTTP con 2 argumentos. Al ejecutar `DROP FUNCTION IF EXISTS public.recibir_compra(uuid, text);` en `I1.4`, PostgREST canaliza sin ambigüedad todas las peticiones a la función de 3 parámetros con valores `DEFAULT`.
- **Verificación Local (Caso C17):** Se comprobó empíricamente en PostgreSQL 18 que las invocaciones con 1, 2 y 3 argumentos resuelven sin errores a la firma de 3 parámetros.

### 3.3 Protocolo de Validación Post-Despliegue (En ventana autorizada)
1. **Verificación de Catálogo:**
   ```sql
   SELECT oid, proname, pg_get_function_identity_arguments(oid)
   FROM pg_proc
   WHERE proname = 'recibir_compra';
   ```
   *Criterio de Éxito:* Debe retornar exactamente 1 sola fila con `p_compra_id uuid, p_metodo_pago text, p_idempotency_key uuid`.
2. **Prueba de Humo de Solo Lectura:** Cargar el módulo de administración en la UI para verificar que PostgREST recargó el esquema (`NOTIFY pgrst, 'reload schema'`) y no genera errores de inicialización.

---

## 4. MATRIZ GO/NO-GO DE LA FASE 18

| Control / Requisito | Estado | Evidencia Concreta | Acción de Contingencia |
| :--- | :---: | :--- | :--- |
| **Hash SHA-256 de I1.4** | **APROBADO** | Hash `DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5` intacto | No modificar el archivo |
| **Columnas en movimientos_inventario** | **APROBADO** | 8 columnas declaradas coinciden con 8 valores en `VALUES` (`p_compra_id` incluido) | N/A |
| **Resolución de Sesión por Trabajador** | **APROBADO** | `v_sesion_id := public.fn_get_active_session(auth.uid());` en I1.4 | N/A |
| **Restricciones CHECK de Producción** | **APROBADO** | Compatibilidad 100% con `movimientos_caja_metodo_pago_check` y `chk_movimientos_compra_trazabilidad` | N/A |
| **Pruebas Automatizadas (20 Casos)** | **APROBADO** | 20/20 casos exitosos en PostgreSQL 18 local (`runner.cjs`) | N/A |
| **Script de Reversión (Rollback)** | **APROBADO** | Script SQL exacto documentado en Fase 15 basado en OIDs 101538 y 100711 | Aplicar en caso de fallo DDL |
| **Prueba de Humo Mutante en Producción** | **PENDIENTE** | Bloqueado por regla de CERO escrituras durante auditoría | Ejecutar post-despliegue autorizada |

---

## 5. DICTAMEN FINAL

### `LISTA PARA SOLICITAR AUTORIZACIÓN`

**Justificación:**
1. Todos los bloqueadores técnicos de firma RPC, asignación de sesión por trabajador, columnas de inventario y compatibilidad de restricciones fueron resueltos y verificados con evidencia empírica.
2. Se cuenta con un plan de despliegue atómico transaccional y un script de reversión (*rollback*) exacto derivado del catálogo real de producción.
3. **Se confirma que NO se realizaron escrituras en producción durante la Fase 18.**

---
*Fin del Informe Fase 18.*
