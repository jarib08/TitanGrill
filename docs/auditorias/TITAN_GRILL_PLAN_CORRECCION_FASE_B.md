# TITAN GRILL — PLAN DE CORRECCIÓN DE LA FASE B (INVENTARIO Y MERMAS)

## 1. OBJETIVO DEL PLAN
Establecer las estrategias técnicas y de negocio para mitigar las vulnerabilidades de concurrencia e integridad financiera detectadas en la Fase B, garantizando que el inventario y la caja mantengan absoluta coherencia sin importar la concurrencia de los usuarios.

---

## 2. ANÁLISIS DE HALLAZGOS Y SOLUCIONES PROPUESTAS

### B-001: Race Condition en Ventas (`registrar_venta`)
- **Impacto:** Si dos ventas concurrentes procesan el mismo insumo que tiene 1 unidad, ambas pasan la validación sin bloqueo. Al intentar actualizar, PostgreSQL arroja una excepción no manejada (`insumos_stock_actual_check`), devolviendo HTTP 500 y degradando la UX del POS.
- **Riesgos:** Deterioro de la experiencia de usuario y fallos del POS en horas pico.
- **Solución Robusta (Transaccional):**
  - **Estrategia:** Reestructurar el ciclo de descuento de inventario.
  - Implementar un bloqueo `FOR UPDATE` sobre los insumos involucrados **antes** de validar el stock.
  - Para evitar **Deadlocks** (si la Venta A bloquea Insumo 1 e Insumo 2, y Venta B bloquea Insumo 2 e Insumo 1), se debe asegurar que el bloqueo se haga ordenando por `insumo_id` (`ORDER BY insumo_id FOR UPDATE`).
  - **Alternativa descartada:** Atrapar `check_violation`. Es mala práctica depender de excepciones genéricas de base de datos para lógica de negocio; es mejor bloquear y validar controladamente, devolviendo un mensaje claro de "Stock insuficiente".

### B-002: Doble Recepción de Compras (`recibir_compra`)
- **Impacto:** Un doble clic del Administrador desencadena la inyección duplicada de insumos en inventario y el doble descuento de dinero (EGRESO) en la caja, descuadrando totalmente la conciliación.
- **Riesgos:** Riesgo financiero altísimo (pérdida de integridad de caja).
- **Solución Robusta (Transaccional):**
  - **Estrategia:** Implementar un bloqueo a nivel de fila (`FOR UPDATE`) explícito al consultar el estado de la compra.
  - `SELECT estado, total INTO v_estado, v_total FROM public.compras WHERE id = p_compra_id FOR UPDATE;`
  - Esto obliga a la segunda transacción a esperar a que la primera termine. Cuando la primera cambie el estado a `'RECIBIDA'`, la segunda despertará, leerá el nuevo estado, y abortará el proceso controladamente devolviendo `success: false`.
  - El incremento de inventario y el egreso de caja quedan asegurados dentro del mismo bloque atómico protegido.

### B-003: Sobreescritura en Carga Masiva (`registrar_carga_masiva_inventario`)
- **Impacto:** Una auditoría de inventario sobreescribe de forma destructiva los descuentos legítimos realizados por ventas concurrentes.
- **Riesgos:** Pérdida de trazabilidad de los movimientos de venta; saltos inexplicables en el inventario.
- **Solución Robusta (Transaccional):**
  - **Estrategia:** Optimistic Concurrency Control (OCC) o Diferencial Absoluto.
  - En lugar de establecer `stock_actual = v_nuevo_stock` ciegamente, el frontend debe enviar el stock actual que tenía en pantalla (`v_stock_pantalla`).
  - El backend aplica un `FOR UPDATE` al insumo. Compara el `v_stock_pantalla` con el `stock_actual` real de la BDD.
  - Si difieren, significa que hubo movimientos mientras el usuario auditaba. Se calcula el diferencial de la auditoría y se suma algebraicamente, garantizando que no se destruyan las ventas concurrentes; o bien, se rechaza indicando: "El stock de X cambió durante tu auditoría".

### B-004: Trazabilidad de Mermas
- **Investigación:** El flujo en código (`AdminDashboard.jsx` y el RPC `registrar_merma_trabajador`) es correcto y seguro (`FOR UPDATE` está presente). El problema de que no existan registros de tipo `MERMA` radica en un **comportamiento operativo**: los administradores están usando el botón de "Ajuste Masivo" para igualar el inventario cuando hay mermas, evadiendo el registro de los motivos de merma.
- **Solución:**
  - **Negocio:** Se debe auditar visualmente que la pestaña de "Mermas" sea más accesible o requerir motivos obligatorios en los Ajustes Masivos para disuadir su uso como basurero contable.
  - No hay fallos transaccionales aquí, solo un problema de adopción de la interfaz.

---

## 3. PRUEBAS DE CONCURRENCIA (CRITERIOS DE ACEPTACIÓN)

Para declarar la **FASE B** como **PASS**, se deben ejecutar las siguientes pruebas tras la implementación:

1. **Test B-001 (Ventas Concurrentes):** Simular dos ventas simultáneas que requieran la última unidad de "Pan de Hamburguesa". Una debe ser exitosa, la otra debe retornar un JSON controlado de fallo (`success: false, message: "Stock insuficiente..."`), y el POS no debe caerse ni mostrar un error 500.
2. **Test B-002 (Compras Dobles):** Simular el envío simultáneo de dos requests a `recibir_compra` para la misma orden en estado `BORRADOR`. Solo se debe registrar **un** ingreso de stock y **un** egreso en la caja. El segundo request debe ser rechazado amigablemente.
3. **Test B-003 (Auditoría vs Venta):** Iniciar un ajuste masivo de un insumo y lanzar una venta de ese insumo en paralelo. El inventario final debe reflejar el diferencial del ajuste menos la venta, sin perderse en sobreescrituras ciegas.

---

## 4. ESTRATEGIA DE ROLLBACK
- Todos los cambios se realizarán mediante un único script de migración SQL (`20260912_fase_b_correccion.sql`).
- Dado que las correcciones consisten puramente en la reescritura de los RPC (`registrar_venta`, `recibir_compra`, `registrar_carga_masiva_inventario`), la estrategia de rollback será restaurar el bloque de código original de dichas funciones utilizando la vista histórica provista en `TITAN_GRILL_AUDITORIA_FASE_B.md` o el historial del control de versiones.

---

**ESTADO ACTUAL:** PLAN DE CORRECCIÓN (FASE B) CREADO. ESPERANDO AUTORIZACIÓN PARA INICIAR REVISIÓN PRE-IMPLEMENTACIÓN Y EJECUCIÓN (FASE B.1).
