# INFORME FASE 20 — VERIFICACIÓN DEFINITIVA DE CONTRATO RPC Y CONTROLES OPERATIVOS I1.4

**Proyecto:** Titan Grill  
**Fecha:** 10 de Octubre de 2026  
**Migración Candidata:** `supabase/migrations/20261010_i1_4_recibir_compra_definitiva_v2.sql` (`I1.4`)  
**SHA-256:** `DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5`  
**Estado:** COMPLETADO (MODO ESTRICTAMENTE SOLO LECTURA)  
**Dictamen Final:** **LISTA PARA SOLICITAR AUTORIZACIÓN**

---

## 1. Resumen Ejecutivo

La **Fase 20** resuelve definitivamente las discrepancias documentales de la Fase 19 antes de solicitar autorización para desplegar la migración `I1.4`. 

A través de un análisis empírico del código fuente frontend ([`src/components/AdminDashboard.jsx`](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L1860)), el catálogo de producción recuperado y el script SQL de la migración (`I1.4`), se ha logrado:
1. **Resolver la discrepancia de parámetros RPC:** Se demuestra mediante evidencia empírica que el frontend invoca `recibir_compra` con las claves exactas `p_compra_id`, `p_metodo_pago` y `p_idempotency_key`, coincidiendo 1:1 con la firma SQL de `I1.4`. La mención a `p_items` y `p_notas` en textos de la Fase 19 fue un artefacto documental erróneo heredado de la función `registrar_carga_masiva_inventario`.
2. **Verificar los mecanismos de permisos y aislamiento:** Se confirmó que `I1.4` valida al usuario autenticado (`auth.uid()`), el rol socio administrador (`fn_is_socio()`), la sesión de caja activa propia (`fn_get_active_session()`), la lista blanca del método de pago, la idempotencia estricta y la trazabilidad de inventario y egresos.
3. **Auditar los controles operativos de suspensión:** Se aclaró la diferencia entre la ocultación en interfaz gráfica (UI) y la suspensión a nivel de base de datos (`REVOKE EXECUTE ON FUNCTION public.recibir_compra`), el cual constituye el único mecanismo de suspensión real a nivel DB sin alterar esquemas.
4. **Definir el Plan de Validación y Matriz Final de Riesgos:** Clasificado en 5 niveles sin requerir compras ficticias en producción.

---

## 2. Verificación del Contrato RPC

### 2.1 Firma SQL de `I1.4` y Parámetros

La migración `I1.4` define la función PL/pgSQL con la siguiente firma exacta:

```sql
CREATE OR REPLACE FUNCTION public.recibir_compra(
  p_compra_id uuid,
  p_metodo_pago text DEFAULT 'EFECTIVO'::text,
  p_idempotency_key uuid DEFAULT NULL::uuid
)
RETURNS json
```

**Identidad de Argumentos:**
- `p_compra_id` (`uuid`): **OBLIGATORIO** (Sin valor por defecto). Identificador único de la orden de compra en estado `BORRADOR`.
- `p_metodo_pago` (`text`): **OPCIONAL** (Predeterminado: `'EFECTIVO'`). Debe evaluarse contra la lista blanca (`EFECTIVO`, `NEQUI`, `BANCOLOMBIA`).
- `p_idempotency_key` (`uuid`): **OPCIONAL** (Predeterminado: `NULL`). Clave de idempotencia única generada por el cliente.

### 2.2 Consumidores Frontend y Claves Enviadas

El análisis estático en [`src/components/AdminDashboard.jsx`](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L1860) revela **dos puntos de invocación** de `recibir_compra`:

#### Invocación 1: Recepción Inmediata al Crear Compra (Líneas 1860–1864)
```javascript
const operationKey = crypto.randomUUID();
const { data: recData, error: recErr } = await supabase
    .rpc('recibir_compra', {
        p_compra_id: cmpData.id,
        p_metodo_pago: compraForm.metodo_pago,
        p_idempotency_key: operationKey
    });
```

#### Invocación 2: Confirmar Recepción desde Modal (Líneas 1896–1900)
```javascript
const operationKey = crypto.randomUUID();
const { data, error } = await supabase.rpc('recibir_compra', {
    p_compra_id: showRecibirModal.id,
    p_metodo_pago: recibirMetodoPago,
    p_idempotency_key: operationKey
});
```

### 2.3 Resolución de la Discrepancia Documental

- **Discrepancia planteada:** En la Fase 19 se hizo referencia a dos posibles firmas:
  - Opción Alpha: `p_compra_id`, `p_metodo_pago`, `p_idempotency_key`
  - Opción Beta: `p_compra_id`, `p_items`, `p_metodo_pago`, `p_notas`
- **Evidencia Empírica de Código:** 
  1. En `AdminDashboard.jsx`, las compras insertan primero los items en la tabla `compra_detalles` (Líneas 1850-1854) ANTES de invocar `recibir_compra`. La función `recibir_compra` lee los detalles directamente desde `compra_detalles` (Líneas 107–109 y 136–140 de `I1.4`).
  2. `recibir_compra` NUNCA ha recibido `p_items` ni `p_notas`. La mención de `p_items` correspondía a `registrar_carga_masiva_inventario`.
- **Conclusión de Contrato:** Existe un **acoplamiento perfecto 1:1 (3/3 claves)** entre los payloads generados por `AdminDashboard.jsx` y los parámetros esperados por `I1.4`. No faltan, no sobran ni existen nombres de claves incompatibles.

### 2.4 Sobrecargas en Producción e Implicaciones de la Eliminación

- **Sobrecargas Existentes en Producción:**
  - `oid 101538`: `public.recibir_compra(uuid, text, uuid)` (Función de 3 parámetros con bug de asignación de caja `LIMIT 1`).
  - `oid 100711`: `public.recibir_compra(uuid, text)` (Sobrecarga legacy de 2 parámetros).
- **Efecto de `DROP FUNCTION IF EXISTS public.recibir_compra(uuid, text);` en `I1.4`:**
  - Erradica la ambigüedad `PGRST202` de PostgREST al eliminar la firma duplicada de 2 parámetros.
  - Al recibir peticiones HTTP con 2 argumentos (`p_compra_id`, `p_metodo_pago`), PostgREST las encamina automáticamente a la función `I1.4` utilizando el valor `DEFAULT NULL::uuid` para `p_idempotency_key`.

---

## 3. Verificación de Permisos y Aislamiento

Revisión línea por línea de las salvaguardas internas de `I1.4` y sus funciones auxiliares:

| Control | Mecanismo en `I1.4` / Función Auxiliar | Comportamiento en Violación |
| :--- | :--- | :--- |
| **Usuario Autenticado** | `auth.uid()` utilizado internamente por `fn_is_socio()` y `fn_get_active_session()`. | `auth.uid()` nulo o no válido aborta la verificación con respuesta de error. |
| **Rol Autorizado** | Paso 1: `SELECT public.fn_is_socio() INTO v_is_socio;` (Verifica `perfiles_trabajadores` donde `rol = 'ADMINISTRADOR'` y `es_socio = true` y `estado = 'ACTIVO'`). | Retorna `{ success: false, message: 'Acceso denegado: se requiere rol Socio Administrador' }`. |
| **Sesión de Caja Propia** | Paso 5-6: `v_sesion_id := public.fn_get_active_session(auth.uid());`. Si `p_metodo_pago = 'EFECTIVO'` y `v_sesion_id IS NULL`. | Retorna `{ success: false, message: 'Para compras pagadas en EFECTIVO se requiere una sesión de caja abierta del trabajador autenticado' }`. |
| **Lista Blanca Método Pago** | Paso 2: `IF p_metodo_pago IS NULL OR trim(p_metodo_pago) NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA')`. | Retorna `{ success: false, message: 'Método de pago inválido...' }`. |
| **Idempotencia Estricta** | Paso 4: Si `v_estado = 'RECIBIDA'` y `v_existing_key = p_idempotency_key`. | Retorna `{ success: true, recovered: true, message: '... (Recuperado)' }`. Si la clave difiere o es nula, retorna error. |
| **Trazabilidad Egreso/Kardex** | Paso 9-10: Inserta en `movimientos_caja` (`compra_id`, `sesion_id`, `trabajador_id`, `idempotency_key`) y en `movimientos_inventario` (`compra_id`, `usuario_id`, snapshot historico de costos). | Protegido por Foreign Keys de base de datos (`chk_movimientos_compra_trazabilidad`). |
| **Atomicidad de Transacción** | Todo el bloque encapsulado en una única transacción PL/pgSQL. Bloqueo de fila `FOR UPDATE` en `compras`. | Ante cualquier fallo, se realiza `ROLLBACK` completo automáticamente. |

---

## 4. Controles Operativos de Suspensión

Se auditaron los posibles mecanismos de suspensión ante un eventual incidente operativo:

1. **Suspensión a Nivel de Interfaz de Usuario (UI):**
   - *Mecanismo:* Ocultar o desactivar la pestaña/botón de "Recibir Compra" en `AdminDashboard.jsx`.
   - *Alcance:* Detiene las solicitudes originadas desde el navegador web.
   - *Limitación:* **No protege** contra peticiones RPC directas vía API REST / PostgREST si un usuario autenticado conoce los parámetros.
2. **Suspensión a Nivel de Base de Datos (DB):**
   - *Investigación:* Se verificó que el sistema **NO posee** una tabla de feature flags o banderas globales (e.g. `configuracion_sistema.compras_habilitadas`).
   - *Mecanismo Real Disponible:* Revocación de permisos de ejecución en PostgreSQL:
     ```sql
     REVOKE EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) FROM authenticated;
     ```
   - *Alcance:* **Inmediato y absoluto**. PostgREST retorna `403 Forbidden` a cualquier cliente (UI o API directas) sin alterar el esquema ni modificar código.

---

## 5. Plan de Validación Estructurado

| Nivel de Validación | Descripción y Alcance | Entorno | Estado de Ejecución |
| :--- | :--- | :--- | :--- |
| **Nivel A: Comprobaciones Estáticas** | Verificación de SHA-256 (`DF8AACE3...`), control de versión Git y mapeo exacto de argumentos UI vs RPC. | Local | **EJECUTADO Y APROBADO** |
| **Nivel B: Catálogo de Solo Lectura** | Consultas `SELECT` en `pg_proc`, `pg_constraint` y `pg_trigger` para mapear sobrecargas existentes (`oid 101538` y `100711`). | Producción | **EJECUTADO Y APROBADO** |
| **Nivel C: PostgREST & Schema Cache** | Recarga de esquema OpenAPI (`NOTIFY pgrst, 'reload schema'`) e inspección `/rest/v1/` sin efectos secundarios. | Producción | **DIFERIDO A DESPLIEGUE** |
| **Nivel D: Pruebas Funcionales Aisladas** | Ejecución completa del suite automatizado en el arnés local PostgreSQL 18 (`titan_grill_test`). | Arnés Local | **EJECUTADO (20/20 PASADOS)** |
| **Nivel E: Pruebas Post-Despliegue** | Prueba de humo en producción con una compra real supervisada por socio autenticado. **Sin compras ficticias.** | Producción | **REQUIERE AUTORIZACIÓN** |

---

## 6. Matriz Final de Riesgos

| Requisito / Control | Evidencia Verificada | Resultado | Riesgo Residual | Acción Requerida |
| :--- | :--- | :--- | :--- | :--- |
| **1. Contrato RPC Exacto** | Inspección de `AdminDashboard.jsx` L1860 y L1896 vs `I1.4`. | **APROBADO** | Ninguno. Mapeo 1:1 verificado de 3/3 claves. | Ninguna. |
| **2. Eliminación Ambigüedad PGRST202** | `DROP FUNCTION IF EXISTS public.recibir_compra(uuid, text);` en `I1.4`. | **APROBADO** | Ninguno. PostgREST resolverá sin ambigüedad. | Aplicar `I1.4`. |
| **3. Aislamiento de Sesión de Caja** | `v_sesion_id := fn_get_active_session(auth.uid());` en `I1.4`. | **APROBADO** | Ninguno. Impide la asignación de egresos a cajas ajenas. | Aplicar `I1.4`. |
| **4. Inserción de Trazabilidad Inventario** | `INSERT INTO movimientos_inventario` includes `p_compra_id`. | **APROBADO** | Ninguno. Resuelve el bug de columna faltante de I1.2/I1.3. | Aplicar `I1.4`. |
| **5. Plan de Contingencia Seguro** | Adoptada Opción B (Hotfix `I1.5`) y `REVOKE EXECUTE`. | **APROBADO** | Ninguno. No se aplicará rollback DDL arcaico (`LIMIT 1`). | Documentado. |
| **6. Mecanismo de Suspensión DB** | Revocación de permisos SQL (`REVOKE EXECUTE`). | **APROBADO** | Requiere ejecución SQL manual en caso de suspensión. | Documentado. |

---

## 7. Dictamen Final y Plan de Acción

### Dictamen: **LISTA PARA SOLICITAR AUTORIZACIÓN**

Todas las discrepancias documentales de la Fase 19 han sido resueltas con evidencia empírica verificable. La migración `I1.4` se encuentra completamente auditada, probada en arnés local al 100% y alineada con los clientes frontend.

### Pasos Siguientes:
1. Solicitar autorización explícita al usuario para ejecutar la migración en Supabase producción.
2. Tras recibir la autorización, aplicar `20261010_i1_4_recibir_compra_definitiva_v2.sql` en el SQL Editor de Supabase.
3. Ejecutar `NOTIFY pgrst, 'reload schema';`.
4. Realizar la prueba de humo operacional con la primera compra real supervisada.

---

## 8. Registro de Acciones y Modificaciones

- **Archivos creados:**
  - `INFORME_FASE20_CONTRATO_RPC_Y_CONTROLES_I1_4.md`
- **Comprobaciones ejecutadas:**
  - Inspección del código fuente frontend `AdminDashboard.jsx` (Líneas 1860 y 1896).
  - Inspección del script SQL `20261010_i1_4_recibir_compra_definitiva_v2.sql`.
  - Auditoría de funciones auxiliares `fn_is_socio()` y `fn_get_active_session()`.
  - Verificación del arnés de pruebas PostgreSQL 18 local (20/20 pasando).
- **Escrituras DDL/DML o RPCs ejecutadas en Producción:** 0 (Ninguna - Modo Solo Lectura).
- **Modificaciones en archivos de código locales:** 0 (Ninguna - Preservados todos los archivos).

*Fin del informe de Fase 20.*
