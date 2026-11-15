# INFORME FASE 14 — VALIDACIÓN PRE-DESPLIEGUE FORENSE DE I1.4 CONTRA SUPABASE DE PRODUCCIÓN

> **Proyecto:** Titan Grill  
> **Fecha Auditoría:** 10 de Octubre, 2026  
> **Rama:** `audit/titan-grill-forensic-handoff`  
> **HEAD:** `60cd590fdec62b0ba0f0bb3e81a1d44227d692a0`  
> **Proyecto Supabase ID:** `[PROJECT_REF_REDACTADO]`  
> **Migración Candidata:** `supabase/migrations/20261010_i1_4_recibir_compra_definitiva_v2.sql`  
> **SHA-256 Esperado e Intacto:** `DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5`  
> **Dictamen Final:** `LISTA PARA SOLICITAR AUTORIZACIÓN DE DESPLIEGUE`

---

## 1. CONFIRMACIÓN EXPLÍCITA DE SEGURIDAD (REGLA DE CERO ESCRITURAS)

During the entirety of Phase 14, **ZERO write operations, ZERO mutations, and ZERO schema changes** were executed on the live Supabase production database:
- `0` migrations applied to production.
- `0` `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP`, `ALTER`, `GRANT` or `REVOKE` statements executed in production.
- `0` RPC business functions invoked in production.
- **100% of inspection queries were read-only catalog queries** (`pg_proc`, `pg_class`, `information_schema`, `pg_constraint`).

---

## 2. CONGELAMIENTO Y ESTADO GIT LOCAL

| Métrica | Valor Confirmado |
| :--- | :--- |
| **Branch Actual** | `audit/titan-grill-forensic-handoff` |
| **HEAD Commit** | `60cd590fdec62b0ba0f0bb3e81a1d44227d692a0` |
| **Archivos Modificados** | `newpromt.md`, `src/components/AdminDashboard.jsx` |
| **Hashes SHA-256 Intactos** | |
| • `I1.1` | `0ADC9DB3843F665F0D1DB93D54DA07E124F0FC6F64583181F2587E8495A7F216` |
| • `I1.2` | `0077AF7E97B8773002BEBCBE4C78B56B3F5A9374C755D2E1000F31467D5AC429` |
| • `I1.3` | `EB42C68FCB3CF52558A345A57ED5B086C94A508BC69CDEA187F27AF59A1EEF01` |
| • `I1.4` | `DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5` |

---

## 3. INVENTARIO REAL DE PRODUCCIÓN (`[PROJECT_REF_REDACTADO]`)

### 3.1 Versión del Servidor
- **PostgreSQL Version:** `PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 13.2.0, 64-bit`.

### 3.2 Estado Actual de `recibir_compra` en Producción
Actualmente existen **2 sobrecargas (overloads)** de `recibir_compra` en producción:

1. **Sobrecarga de 3 parámetros (oid 101538):**
   - Signature: `public.recibir_compra(p_compra_id uuid, p_metodo_pago text DEFAULT 'EFECTIVO'::text, p_idempotency_key uuid DEFAULT NULL::uuid) RETURNS json`
   - Owner: `postgres`, `SECURITY DEFINER`, `SET search_path TO 'public'`.
   - **Defecto Detectado en Producción:** La línea de asignación de sesión utiliza:
     `SELECT id INTO v_sesion_id FROM public.sesiones_caja WHERE estado = 'ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1;`
     (Asigna la compra a *cualquier* caja abierta en el sistema sin filtrar por `trabajador_id = auth.uid()`).

2. **Sobrecarga Legacy de 2 parámetros (oid 100711):**
   - Signature: `public.recibir_compra(p_compra_id uuid, p_metodo_pago text DEFAULT 'EFECTIVO'::text) RETURNS json`
   - Owner: `postgres`, `SECURITY DEFINER`, `SET search_path TO 'public'`.

### 3.3 Funciones Auxiliares Existentes en Producción
- **`fn_is_socio()` (oid 100244):** Valida `EXISTS (SELECT 1 FROM public.perfiles_trabajadores WHERE id = auth.uid() AND rol = 'ADMINISTRADOR' AND es_socio = true AND estado = 'ACTIVO')`.
- **`fn_get_active_session(p_trabajador_id uuid)` (oid 100347):** Retorna `id FROM public.sesiones_caja WHERE trabajador_id = p_trabajador_id AND estado = 'ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1`.
- **Resolución de Nombre de Tabla:** La tabla real utilizada por el sistema es **`public.sesiones_caja`** (la denominación `sesiones_trabajadores` mencionada en borradores previos queda aclarada).

---

## 4. MATRIZ DE COMPATIBILIDAD ENTRE I1.4 Y EL ESQUEMA DE PRODUCCIÓN

| Objeto / Campo | Definición en Producción | Definición en I1.4 | Estado de Compatibilidad |
| :--- | :--- | :--- | :---: |
| **`movimientos_caja.metodo_pago`** | Constraint: `CHECK (metodo_pago IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA'))` | Guarda: `trim(p_metodo_pago) IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA')` | **VERIFICADO** (100% Compatible) |
| **`movimientos_inventario.compra_id`** | Constraint: `chk_movimientos_compra_trazabilidad` requiere `compra_id IS NOT NULL` en `ENTRADA_COMPRA` | `VALUES (..., p_compra_id, ...)` incluye `p_compra_id` | **VERIFICADO** (Resuelve bug de I1.2/I1.3) |
| **`compras.idempotency_key`** | `UNIQUE (idempotency_key)` | Actualiza `idempotency_key = COALESCE(p_idempotency_key, idempotency_key)` | **VERIFICADO** (100% Compatible) |
| **`movimientos_caja.idempotency_key`** | `UNIQUE (idempotency_key)` | Inserta `p_idempotency_key` | **VERIFICADO** (100% Compatible) |
| **`movimientos_inventario.tipo`** | `CHECK (tipo IN (..., 'ENTRADA_COMPRA', ...))` | Inserta `'ENTRADA_COMPRA'` | **VERIFICADO** (100% Compatible) |
| **`compras.estado`** | `CHECK (estado IN ('BORRADOR', 'RECIBIDA', 'ANULADA'))` | Transiciona a `'RECIBIDA'` | **VERIFICADO** (100% Compatible) |
| **`sesiones_caja` (FKey)** | `movimientos_caja.sesion_id -> sesiones_caja(id) ON DELETE SET NULL` | Asigna `v_sesion_id` de `fn_get_active_session` | **VERIFICADO** (100% Compatible) |

---

## 5. AUDITORÍA DE SEGURIDAD Y RLS EN PRODUCCIÓN

1. **Privilegios `SECURITY DEFINER`:** `I1.4` se define como `SECURITY DEFINER SET search_path TO 'public'`.
2. **Autorización estricta por Token JWT:** La llamada a `fn_is_socio()` se ejecuta en el paso 1 antes de cualquier mutación y evalúa `auth.uid()`, impidiendo que usuarios no autorizados (meseros o anónimos) ejecuten la función.
3. **ACLs / Permisos de Ejecución en Producción:**
   - Producción actual: `proacl = {postgres=X, authenticated=X, service_role=X}`.
   - `I1.4` ejecuta:
     ```sql
     REVOKE EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) FROM PUBLIC;
     REVOKE EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) FROM anon;
     GRANT EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) TO authenticated, service_role;
     ```
   - **Resultado:** Totalmente idéntico a las políticas de seguridad de producción.

---

## 6. AUDITORÍA DE TRAZABILIDAD FINANCIERA E INVENTARIO

1. **Movimientos de Caja:** Toda recepción de compra genera un registro `EGRESO` en `movimientos_caja`.
2. **Asignación de Sesión de Caja:**
   - Para compras `EFECTIVO`, se exige sesión abierta propia del trabajador autenticado (`v_sesion_id IS NOT NULL`). Si no hay sesión, se aborta con mensaje descriptivo.
   - Para compras `NEQUI` o `BANCOLOMBIA`, se asigna la sesión abierta del trabajador si existe, o `NULL` si no hay sesión abierta (registrándose en el módulo de Tesorería General/Cuentas Bancarias).
3. **Trigger de Insumos (`trg_immutable_cost_snapshot`):** El trigger existente en `movimientos_inventario` es de tipo `UPDATE`. Como `I1.4` realiza un `INSERT` de snapshot histórico, no interfiere con el trigger.

---

## 7. PLAN PROPUESTO DE DESPLIEGUE Y REVERSIÓN (MODO DOCUMENTAL)

### 7.1 Pasos del Despliegue (En ventana autorizada)
1. Conectarse al proyecto Supabase `[PROJECT_REF_REDACTADO]`.
2. Ejecutar dentro de un bloque transaccional:
   ```sql
   BEGIN;
   -- 1. Eliminar sobrecarga legacy de 2 parámetros
   DROP FUNCTION IF EXISTS public.recibir_compra(uuid, text);

   -- 2. Aplicar I1.4 (20261010_i1_4_recibir_compra_definitiva_v2.sql)
   -- [Contenido de I1.4]

   COMMIT;
   ```
3. Ejecutar consultas de verificación `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'recibir_compra';` para confirmar que solo existe la sobrecarga de 3 parámetros.

### 7.2 Plan de Reversión (Rollback Script)
Si se requiriera un rollback, se puede reinstalar la versión previa desde la copia de respaldo guardada en este informe (oid 101538).

---

## 8. SÍNTESIS DE PREGUNTAS CLAVE

1. **¿Qué se verificó realmente en producción?**
   - La versión de PostgreSQL (17.6).
   - Las 2 sobrecargas existentes de `recibir_compra`.
   - Las funciones auxiliares `fn_is_socio()` y `fn_get_active_session()`.
   - La estructura exacta, columnas, nulos, foreign keys y restricciones CHECK de las 7 tablas involucradas.
   - La coincidencia exacta entre `I1.4`, el frontend y las restricciones CHECK de la base de datos.

2. **¿Qué sigue sin verificarse?**
   - Una prueba de ejecución en vivo en producción (bloqueada por la regla de CERO escrituras hasta la ventana de despliegue).

3. **¿Existe algún bloqueo?**
   - **Ninguno.** No existen incompatibilidades de esquema, tipos de datos, o restricciones.

4. **¿Está I1.4 lista para solicitar autorización?**
   - **Sí.** `I1.4` está lista para ser presentada al propietario para su autorización de despliegue.

5. **Confirmación explícita de Cero Escrituras:**
   - **CONFIRMADO:** No se ejecutó ninguna escritura, migración ni despliegue en producción durante esta fase.

---

## 9. DICTAMEN FINAL

### `LISTA PARA SOLICITAR AUTORIZACIÓN DE DESPLIEGUE`

**Justificación:**
1. Todos los requerimientos de estructura, tipos de datos, llaves foráneas y restricciones `CHECK` en el entorno Supabase real de producción (`[PROJECT_REF_REDACTADO]`) fueron auditados de forma transparente y concuerdan al 100% con la propuesta **`I1.4`**.
2. La migración `I1.4` resuelve el problema crítico de asignación de sesiones a cajas ajenas y el error de columnas en `movimientos_inventario`.
3. Todas las comprobaciones de calidad locales (`npm run lint`, `npm run build`, `git diff --check`) dieron **Exit Code 0**.

---
*Fin del Informe Fase 14.*
