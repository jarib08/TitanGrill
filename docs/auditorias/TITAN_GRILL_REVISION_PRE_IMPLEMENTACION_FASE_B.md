# TITAN GRILL — REVISIÓN PRE-IMPLEMENTACIÓN (FASE B.1)

## OBJETIVO
Revisar el plan de corrección diseñado para la Fase B contrastándolo directamente contra la implementación en código (`POS.jsx`, `AdminDashboard.jsx`) y el modelo de datos real en Supabase, validando transacciones, bloqueos, reglas de negocio y viabilidad técnica antes de proceder con cualquier modificación.

---

## 1. REVISIÓN DE CONTRATOS Y FRONTEND

### `POS.jsx` y `registrar_venta` (B-001)
- **Análisis:** En `POS.jsx`, la función de registro de venta maneja tres estados: `SUCCESS`, `ERROR`, e `INDETERMINATE` (para timeouts e idempotencia). 
- **Validación del Plan:** El plan de retornar un JSON `{success: false, message: 'Stock insuficiente'}` es 100% compatible con el contrato actual del POS. Si PostgreSQL arroja un error 500 crudo por el `CHECK`, el frontend caerá en la rama de error de forma poco elegante.
- **Riesgo Detectado en la Estrategia del Plan:** El plan original proponía iterar y aplicar `FOR UPDATE`. Iterar bloqueos sin un orden predecible genera **Deadlocks**. Si la Venta 1 bloquea (Pan, Carne) y la Venta 2 bloquea (Carne, Pan) simultáneamente, la base de datos se congelará y cancelará una transacción.
- **Mejora al Plan:** El nuevo RPC debe primero agregar y sumarzar todos los insumos requeridos por la venta en una variable/tabla temporal, y luego ejecutar un único `SELECT id, stock_actual FROM insumos WHERE id IN (...) ORDER BY id FOR UPDATE`. Esto garantiza ausencia total de deadlocks transaccionales.

### `AdminDashboard.jsx` y `recibir_compra` (B-002)
- **Análisis:** El frontend lanza la orden y espera un `{success: true}` para recargar los datos.
- **Validación del Plan:** La estrategia de agregar `SELECT estado ... FOR UPDATE` sobre la tabla `compras` es impecable. Bloquea atómicamente a la segunda request (doble clic) en PostgreSQL. Cuando la primera termine (estado pasa a `RECIBIDA`), la segunda despertará, leerá el nuevo estado, abortará controladamente y el dashboard mostrará un mensaje amigable. No afecta la UI ni requiere cambios en el frontend.

### `AdminDashboard.jsx` y `registrar_carga_masiva_inventario` (B-003)
- **Análisis y Decisión sobre Diferencial vs Rechazo:**
  - El frontend envía un array de `insumo_id` y `nuevo_stock`.
  - **Decisión de Negocio (Titan Grill):** ¿Aplicar diferencial automáticamente o rechazar?
  - **Justificación:** Se debe **RECHAZAR**. El auditor cuenta físicamente (Ej. ve 15 panes físicos). Mientras camina a la PC, el cajero vende 2 panes y se los entrega al cliente (El POS baja el DB stock a 14). El auditor ingresa "15". Si el backend calcula un diferencial contra los "14" del DB y simplemente los suma, el DB sube a 15, ¡pero físicamente ya solo hay 13 en el local! El diferencial ciego destruye la venta. 
  - **Conclusión:** El sistema debe exigir que el frontend envíe el `stock_previo` que veía en pantalla. Si en la DB difiere (por ventas concurrentes), se debe rechazar con un error: *"El stock de X cambió por ventas concurrentes durante la auditoría. Por favor, realiza un nuevo conteo."* Esto obliga al auditor a volver a contar los 13 panes reales y salva la integridad del negocio.

### `AdminDashboard.jsx` y Mermas (B-004)
- **Análisis:** `registrar_merma_trabajador` está implementado correctamente en backend y frontend (con `FOR UPDATE` seguro). El problema es puramente de usabilidad y cultura organizacional (los trabajadores prefieren el "Ajuste Masivo"). 

---

## 2. REVISIÓN DE RLS Y SECURITY DEFINER
- Todos los RPCs de inventario involucrados están marcados como `SECURITY DEFINER`.
- **Riesgo mitigado:** Como corren como "postgres", bypassean el RLS de inserción directa a `insumos` y `movimientos_inventario`, lo cual es el diseño intencionado en Titan Grill. Las validaciones de rol se hacen correctamente en el interior del cuerpo del RPC (`fn_is_socio()`, `fn_is_worker()`).

---

## 3. CONCLUSIÓN DE LA REVISIÓN PRE-IMPLEMENTACIÓN

### Hallazgos del plan que siguen siendo válidos:
- B-002: El `FOR UPDATE` en compras es la solución definitiva.
- B-004: La falta de mermas es operativa, el RPC es técnicamente impecable.

### Hallazgos que deban modificarse (Mejoras):
- **B-001:** No se puede iterar el `FOR UPDATE` a ciegas. Se debe consolidar la lista de insumos requeridos en memoria y bloquear ordenando por `id` (`ORDER BY id FOR UPDATE`) para erradicar el riesgo de deadlocks.
- **B-003:** Oficializamos la política de **Rechazo Optimista** en Cargas Masivas (requiriendo `stock_previo` desde el frontend) en lugar de intentar salvar matemáticamente la concurrencia, lo cual violaría el principio de existencia física de Titan Grill.

### Riesgos de Implementación:
- B-003 requiere que modifiquemos el payload del frontend en `AdminDashboard.jsx` (línea ~1419) para que además de `insumo_id` y `nuevo_stock`, envíe `stock_actual` (lo que veía el admin al abrir el modal).
- B-001 requiere reescribir un tramo de ~30 líneas críticas del RPC más pesado (`registrar_venta`), por lo que su migración debe ser extremadamente cuidadosa para no alterar la lógica paralela de *fidelización (stamps)* y *caja (movimientos)*.

### Pruebas Necesarias (Ampliación):
1. **Prueba de Carga Masiva Optimista:** Simular auditoría mientras otra pestaña descuenta inventario por venta. El sistema debe bloquear la carga masiva y alertar al socio.
2. **Prueba Anti-Deadlock:** Simular dos ventas concurrentes de combos cruzados (Combo A requiere insumo X y Y; Combo B requiere Y y X).

### PLAN DEFINITIVO RECOMENDADO:
Ejecutar la FASE B.2 creando un script único `20260912_fase_b_correccion.sql` que sobreescriba `registrar_venta`, `recibir_compra` y `registrar_carga_masiva_inventario` incorporando los bloqueos consolidados `ORDER BY id`, y posteriormente modificar `AdminDashboard.jsx` para inyectar `stock_previo` en el payload de los ajustes masivos.

**ESTADO:** REVISIÓN PRE-IMPLEMENTACIÓN COMPLETADA. ESPERANDO AUTORIZACIÓN.
