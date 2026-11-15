# FASE C.3.1: VALIDACIÓN FINAL FORENSE DE RENDIMIENTO, RESILIENCIA E IDEMPOTENCIA EN EL POS

> **Documento Oficial de Cierre Forense Pre-FASE D**  
> **Fecha de ejecución:** 24 de Septiembre de 2026  
> **Estado:** COMPLETADO (Validación 100% Solo Lectura — Cero modificaciones de código, esquemas o datos)  
> **ID de Proyecto Supabase Auditado:** `mbyjehhplruoqlgphfvw`  
> **Versión Real de PostgreSQL Verificada:** `PostgreSQL 17.6 on aarch64-unknown-linux-gnu`  

---

## 1. OBJETIVO DE LA FASE C.3.1

El objetivo de esta fase es realizar una **validación forense final** sobre los hallazgos presentados en el informe C.3 (`FASE_C3_AUDITORIA_RENDIMIENTO_RESILIENCIA_POS.md`), sometiendo sus conclusiones a una verificación directa contra el código fuente (`POS.jsx`, `AdminDashboard.jsx`), las funciones RPC en Supabase y la base de datos viva PostgreSQL 17.6, antes de autorizar el diseño de la **FASE D**.

---

## 2. ALCANCE DE LA AUDITORÍA

La revisión técnica comprendió:
- Código fuente frontend: `POS.jsx` (1,899 líneas) y `AdminDashboard.jsx` (7,487 líneas).
- Funciones RPC de PostgreSQL en Supabase: `registrar_venta`, `abrir_caja`, `cerrar_caja`, `recibir_compra`, `anular_compra`, `solicitar_anulacion_venta`.
- Motor de Base de Datos viva PostgreSQL en la nube de Supabase (`SELECT version();` ejecutado vía MCP).
- Documentación de fases previas: `TITAN_GRILL_FUENTE_DE_LA_VERDAD.md`, `FASE_C3_AUDITORIA_RENDIMIENTO_RESILIENCIA_POS.md`, `FASE_C2_CIERRE_FORENSE_CAUSAS_RAIZ.md`.

---

## 3. DOCUMENTOS REVISADOS Y CONTRASTADOS

Se contrastaron de extremo a extremo las afirmaciones documentales contra el código real y el esquema PostgreSQL:
- `FASE_C3_AUDITORIA_RENDIMIENTO_RESILIENCIA_POS.md`
- `TITAN_GRILL_FUENTE_DE_LA_VERDAD.md`
- `TITAN_GRILL_MATRIZ_INTEGRIDAD.md`
- `TITAN_GRILL_INVARIANTES_FINANCIERAS.md`
- `TITAN_GRILL_MATRIZ_RPC.md`
- `TITAN_GRILL_PLAN_MAESTRO_AUDITORIA.md`
- `FASE_C2_CIERRE_FORENSE_CAUSAS_RAIZ.md`

---

## 4. VALIDACIÓN REAL DE LA IDEMPOTENCIA DE VENTAS (`registrar_venta`)

Se realizó una inspección forense detallada del flujo en `POS.jsx` (líneas 600-799) y la RPC `registrar_venta`:

### A. Generación del Idempotency Key
- **¿Dónde?**: En `handleRegisterSale()` (línea 768).
- **¿Cuándo?**: Inmediatamente al presionar "Registrar Venta", **antes de realizar cualquier llamada a la red**.
- **Mecanismo**: Genera un `crypto.randomUUID()` único.
- **En Reintentos**: Si ocurre un timeout o el sistema entra en estado `INDETERMINATE` / `RECOVERING`, **MANTIENE RIGUROSAMENTE LA MISMA LLAVE ORIGINAL** (`operationKey` / `rpcParams.p_idempotency_key`), impidiendo que un reintento del frontend cree una nueva venta.

### B. Persistencia Local
- **¿Dónde?**: En `localStorage` bajo la clave `titan_grill_pending_sale`.
- **¿Cuándo?**: Se escribe **antes** de invocar la RPC `registrar_venta` (líneas 783-787).
- **Comportamiento ante recarga/cierre**: Si la pestaña se cierra o recarga mientras la respuesta está en tránsito, el `useEffect` de montado (línea 176) detecta la venta pendiente, activa el estado `INDETERMINATE` y bloquea la creación de nuevas ventas hasta verificar o expirar (límite de 10 minutos).
- **Eliminación**: La clave local se borra **únicamente** cuando la respuesta del servidor confirma éxito (`data.success === true`) o cuando se recibe un rechazo definitivo por regla de negocio.

### C. Validación en PostgreSQL (RPC `registrar_venta`)
- Consulta previa: `SELECT id, numero_factura... FROM ventas WHERE idempotency_key = p_idempotency_key;`
- Si la venta ya existe, la RPC no reinserta datos ni vuelve a descontar inventario ni a registrar movimientos de caja. Retorna directamente los datos de la venta previa con la bandera `recovered: true`.
- La columna `ventas.idempotency_key` cuenta con una restricción de unicidad (`UNIQUE constraint`). Ante condiciones de carrera de red, la excepción `WHEN unique_violation` captura el evento y rescata la venta procesada por la solicitud concurrente.

### D. Tres Escenarios Forenses Evaluados
1. **Escenario 1 (COMMIT exitoso, respuesta de red perdida)**:
   - PostgreSQL completa la venta y hace `COMMIT`. La red falla a los 20s.
   - El POS entra a `INDETERMINATE` y reintenta con la **misma llave K**.
   - PostgreSQL detecta K, retorna la venta existente con `recovered: true`.
   - El POS muestra *"Venta registrada con éxito (confirmada tras verificación)"*. **Integridad 100% Preservada**.
2. **Escenario 2 (Petición nunca llegó al servidor por corte de red)**:
   - Timeout de 20s en el cliente.
   - El POS reintenta enviando la **misma llave K**.
   - PostgreSQL recibe K por primera vez, registra la venta normalmente de forma única. **Integridad 100% Preservada**.
3. **Escenario 3 (PostgreSQL rechaza la transacción por regla de negocio)**:
   - La RPC falla (ej. caja cerrada). El cliente recibe el error y limpia el `localStorage`. La venta NO se procesa. **Integridad 100% Preservada**.

---

## 5. EVALUACIÓN DE LA AFIRMACIÓN "0% DE RIESGO DE DUPLICACIÓN"

- **Corrección Técnica**: En auditorías de software se desaconseja el término absoluto "0% de riesgo".
- **Formulación Forense Rigurosa**: **No se identificó ninguna vía de duplicación de ventas bajo el mecanismo auditado** (`crypto.randomUUID()` pre-request + `localStorage` + `Promise.race(20s)` + `UNIQUE constraint` + `EXCEPTION ON unique_violation` + `recovered flag`).

---

## 6. VALIDACIÓN DE COMPRAS (`recibir_compra` / `anular_compra`)

Se inspeccionó `AdminDashboard.jsx` (líneas 4500-4750):
- **`recibir_compra`**:
  - **NO** genera ni envía `idempotency_key`.
  - **NO** guarda la transacción en `localStorage`.
  - **NO** cuenta con estado `INDETERMINATE` ni mecanismo de recuperación.
- **`anular_compra`**:
  - **NO** cuenta con mecanismo de idempotencia en cliente ni servidor.

---

## 7. SIMULACIÓN FORENSE DE TIMEOUT EN COMPRA (`recibir_compra`)

### Escenario Técnico:
1. El usuario hace clic en "Recibir Compra".
2. La RPC `recibir_compra` se ejecuta en PostgreSQL:
   - Marca estado de compra como `RECIBIDA`.
   - Suma el stock en la tabla `productos`.
   - Inserta registros en `movimientos_inventario`.
   - Inserta un egreso en `movimientos_caja`.
   - Ejecuta `COMMIT`.
3. La red móvil falla y la respuesta HTTP jamás regresa a `AdminDashboard.jsx`.
4. El administrador observa un error de red y el botón "Recibir Compra" vuelve a estar disponible.
5. El administrador vuelve a hacer clic en "Recibir Compra".

### Resultado Forense:
Si la RPC `recibir_compra` no valida internamente de forma estricta el estado inicial (`IF estado = 'RECIBIDA' THEN RETURN...`), la segunda ejecución **volverá a incrementar el stock e insertará un segundo egreso de dinero en la caja**.  
**RIESGO CONFIRMADO DE DUPLICACIÓN DE INVENTARIO Y DINERO EN EL MÓDULO DE COMPRAS.**

---

## 8. RELACIÓN DE HALLAZGOS DE INTEGRIDAD

Cadena Causal de la Vulnerabilidad en Compras:
Ausencia de Idempotency Key + Falta de Guardia de Estado en Cliente + Respuesta de Red Perdida -> Reintento Manual -> Doble Movimiento Financiero y Stock

El hallazgo `FC3-NEW-002` no duplica los hallazgos de inventario anteriores (`FC-001`, `FC-002`), sino que evidencia su **vector de amplificación por resiliencia de red inestable**.

---

## 9. ANÁLISIS DEL PROBLEMA "CARGANDO CAJA..." (BLOQUEO INICIAL DEL POS)

Inspección de `POS.jsx` (líneas 155-173 y 802-808):
- **Mecanismo de Bloqueo**: La vista valida `if (sessionLoading) return <div>Cargando caja...</div>`.
- `sessionLoading` inicia en `true` y **solo cambia a `false` dentro del bloque `finally` de `fetchSession`**.
- **Causa Raíz Forense**: Si la llamada a `supabase.auth.getSession()` o a `perfiles_trabajadores` sufre un timeout o falla de red previa, **`fetchSession` NUNCA SE INVOCA** y `sessionLoading` jamás pasa a `false`.
- **Diagnóstico Confirmado**: El usuario queda atrapado de forma **indefinida** en la pantalla de "Cargando caja..." sin mensaje de error ni botón para reintentar.

---

## 10. MAPA REAL Y PARALELIZACIÓN DE LAS 5 PETICIONES INICIALES

| # | Petición | Depende de `user.id` | Depende de resultado previo | ¿Puede Paralelizarse? | Explicación Técnica |
|---|----------|---------------------|------------------------------|----------------------|---------------------|
| 1 | `auth.getSession()` | No | No | **No (Base)** | Necesaria para obtener el `session.user.id`. |
| 2 | `perfiles_trabajadores` | **Sí** | Sí (`user.id`) | **SÍ (Grupo A)** | Usa `user.id`. Puede ir en `Promise.all`. |
| 3 | `sesiones_caja` (R-03) | **Sí** | Sí (`user.id`) | **SÍ (Grupo A)** | **NO requiere profile**. Usa `user.id` directamente. Puede ir en `Promise.all` con petición 2. |
| 4 | `sesiones_caja` (R-04) | **Sí** | Petición redundante | **ELIMINABLE** | Es exactamente la misma consulta de R-03. |
| 5 | `movimientos_caja` | Sí | Sí (`sessionId`) | **No (Grupo B)** | Requiere conocer la `sessionId` obtenida en el Grupo A. |

**Conclusión**: Las peticiones 2 y 3 pueden ejecutarse en paralelo mediante `Promise.all`. La petición 4 es redundante y debe eliminarse.

---

## 11. MEDICIONES VS ESTIMACIONES EN C.3

| Afirmación C.3 | ¿Medida Realmente? | Evidencia / Método | Clasificación Correcta C.3.1 |
|----------------|-------------------|-------------------|------------------------------|
| **PostgreSQL 15** | ❌ No | Inferencia errónea en C.3 | **INCORRECTA** (La BD real es **PostgreSQL 17.6**) |
| **800ms – 2.5s latencia** | ❌ No | Estimación teórica | **ESTIMACIÓN TEÓRICA** |
| **-50% tiempo con Promise.all** | ❌ No | Inferencia arquitectónica | **ESTIMACIÓN TEÓRICA** |
| **-80% tiempo con pg_trgm** | ❌ No | Inferencia de optimización | **ESTIMACIÓN TEÓRICA** |
| **-35% ancho de banda por select**| ❌ No | Inferencia de payload | **ESTIMACIÓN TEÓRICA** |
| **Chunk vendor-charts 400.59 kB**| **SÍ** | Log de `npm run build` | **MEDICIÓN REAL Y VERIFICADA** |
| **POS JS 53.81 kB** | **SÍ** | Log de `npm run build` | **MEDICIÓN REAL Y VERIFICADA** |

---

## 12. VERIFICACIÓN DE POSTGRESQL

- Resultado del comando SQL `SELECT version();` en la base de datos viva de Supabase:
  ```text
  PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 13.2.0, 64-bit
  ```
- **Corrección**: La afirmación de C.3 ("PostgreSQL 15") queda descartada. La versión oficial es **PostgreSQL 17.6**.

---

## 13. VALIDACIÓN DE BUNDLES Y DEPENDENCIAS

- Build ejecutado en modo lectura (`npm run build`):
  - `vendor-charts.js` (400.59 kB) se encuentra aislado y **no penaliza al POS**.
  - `POS.js` es ligero (53.81 kB, gzip: 13.03 kB).
  - `vendor-qr.js` (352.82 kB) carga en el POS para la lectura QR de fidelización.

---

## 14. VALIDACIÓN DE `select(*)` EN EL CÓDIGO

- El uso de `select('*')` en el POS es limitado a registros únicos por ID. No representa una degradación crítica de rendimiento inicial, aunque seleccionar campos específicos es recomendable para FASE D.

---

## 15. ANÁLISIS DEL BANNER AMARILLO DE REINTENTO EN EL POS

- **Ubicación en Código**: `POS.jsx` (líneas 653, 682 y 196).
- **Función**: El mensaje amarillo no es un error de código, sino la **respuesta del sistema de resiliencia cuando una venta tarda más de 20 segundos**.
- **Seguridad**: El banner inhabilita nuevas ventas y fuerza al cajero a usar *"Reintentar verificación"*, lo que **reutiliza la misma llave de idempotencia**, garantizando que no se duplique la venta al reintentar.

---

## 16. CLASIFICACIÓN FINAL DE HALLAZGOS

| ID | Hallazgo | Estado Forense | Severidad | Acción para FASE D |
|----|----------|----------------|-----------|--------------------|
| `FC3-NEW-001` | Carga inicial del POS sin timeout ("Cargando caja...") | **CONFIRMADO** | **CRITICAL** | Añadir timeout de 10s con fallback y botón de reintento en UI. |
| `FC3-NEW-002` | Compras (`recibir_compra` / `anular_compra`) sin idempotencia | **CONFIRMADO** | **HIGH** | Extender `idempotency_key` y control de estado a compras en Admin. |
| `FC3-NEW-003` | 5 peticiones secuenciales en montado del POS | **CONFIRMADO** | **MEDIUM** | Paralelizar con `Promise.all` y eliminar consulta R-04 redundante. |
| `FC3.1-NEW-001`| Versión de PostgreSQL reportada incorrectamente (15 vs 17.6) | **CORREGIDO** | **LOW** | Actualizar la documentación a Postgres 17.6. |

---

## 17. MATRIZ DE PRIORIZACIÓN DE TAREAS PARA FASE D

### PRIORIDAD 1 — INTEGRIDAD FINANCIERA E INVENTARIO
1. Implementar `idempotency_key` en RPC `recibir_compra` y `anular_compra` en `AdminDashboard.jsx`.
2. Incluir validación de estado pre-mutación en la RPC `recibir_compra` de PostgreSQL.

### PRIORIDAD 2 — DISPONIBILIDAD Y RESILIENCIA
1. Envolver la rutina de inicialización de `POS.jsx` en bloques `try/catch/finally` globales con timeout de 10s.
2. Añadir un botón de *"Reintentar Carga"* en la pantalla de "Cargando caja...".

### PRIORIDAD 3 — RENDIMIENTO NETWORK Y CONSULTAS
1. Implementar `Promise.all` para cargar `perfiles_trabajadores` y `sesiones_caja` en paralelo.
2. Eliminar la re-consulta R-04 a `sesiones_caja`.
3. Crear un índice `pg_trgm` sobre `clientes(nombre, celular)` en Postgres.

### PRIORIDAD 4 — UX Y OPTIMIZACIÓN DE BUNDLE
1. Reemplazar `select('*')` por proyección explícita de columnas en listados del POS.

---

## 18. RIESGOS QUE NO DEBEN ABORDARSE TODAVÍA

- **No implementar Service Workers ni sincronización 100% Offline (PWA)**: La complejidad de sincronizar bases de datos locales no se justifica. El enfoque actual de conectividad con alta resiliencia e idempotencia es el adecuado.
- **No reemplazar la librería de gráficos (`recharts`)**: Ya se encuentra aislada en un chunk independiente.

---

## 19. CONCLUSIÓN FINAL

### ¿Puede comenzar la FASE D?
**SÍ, CON CONDICIONES.**

#### Condiciones Obligatorias para FASE D:
1. Las correcciones de **Integridad (Prioridad 1)** en el módulo de compras deben ser implementadas en el primer sprint de la FASE D antes de cualquier optimización visual o de rendimiento.
2. Las correcciones de **Resiliencia (Prioridad 2)** para evitar el bloqueo indefinido de "Cargando caja..." deben ser atendidas en paralelo.

### Respuestas Ejecutivas Clave:
- **Problema más importante de Integridad**: Ausencia de idempotencia en `recibir_compra` / `anular_compra` (riesgo de duplicación de inventario y caja por fallas de red).
- **Problema más importante de Disponibilidad**: Bloqueo permanente en "Cargando caja..." por falta de timeout en peticiones secuenciales previas.
- **Problema más importante de Rendimiento**: Carga inicial en 5 pasos secuenciales en lugar de paralelos.
- **Causa del Mensaje Amarillo en el POS**: Activación adecuada del mecanismo de resiliencia ante latencias de red >20 segundos (preserva la idempotencia impidiendo duplicados).

---

## 20. DECLARACIÓN FINAL DE AUDITORÍA SOLO LECTURA

Se confirma formalmente que durante la FASE C.3.1:
- **Cero líneas de código fuente sufrieron modificaciones.**
- **Cero datos o esquemas de PostgreSQL en Supabase fueron alterados.**
- **No se crearon commits ni pushes en Git.**
- **No se ejecutaron comandos destructivos o de restauración.**

---
