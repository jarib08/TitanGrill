# TITAN GRILL — INVARIANTES FINANCIERAS

A continuación se detallan las invariantes del modelo de datos e integridad del sistema, basándose en la revisión exhaustiva de RPCs, base de datos y Triggers.

## REGLAS DE NEGOCIO Y ESTADO

*   **Venta válida ↔ Pago correspondiente en `movimientos_caja`**: 🟢 VERIFICADA. El RPC `registrar_venta` realiza la inserción a `movimientos_caja` de manera transaccional. (Si es MIXTO lo inserta desglosado).
*   **Venta válida ↔ Salida de inventario correspondiente**: 🟢 VERIFICADA. El RPC `registrar_venta` descuenta stock e inserta un registro en `movimientos_inventario` tipo 'VENTA' por cada insumo configurado en la receta si `requiere_inventario` es true.
*   **Venta anulada ↔ Reversión correspondiente de caja e inventario**: 🟢 VERIFICADA. El RPC `ejecutar_anulacion_venta` registra un EGRESO por el valor devuelto y realiza ENTRADA tipo 'ANULACION_VENTA' en el kardex.
*   **Gasto ↔ Egreso correspondiente en caja**: 🟢 VERIFICADA. El RPC `crear_gasto` inserta automáticamente en `movimientos_caja` al guardar en `gastos`.
*   **Compra pagada ↔ Egreso en caja y entrada en inventario**: 🟢 VERIFICADA. El RPC `recibir_compra` inserta un EGRESO en `movimientos_caja` y registros de ENTRADA en `movimientos_inventario`, además de cambiar la compra a estado 'RECIBIDA'.
*   **Liquidación pagada ↔ Egreso en caja correspondiente**: 🟢 VERIFICADA. El RPC `pagar_liquidacion` genera el respectivo EGRESO en `movimientos_caja`.
*   **Transferencia interna ↔ Movimiento origen + movimiento destino**: 🟢 VERIFICADA. El RPC `realizar_transferencia_interna` genera un EGRESO en el método de pago origen y un INGRESO en el método destino simultáneamente.
*   **Gasto anulado ↔ Reversión de caja**: 🟢 VERIFICADA. El RPC `anular_gasto` crea un INGRESO por ajuste.
*   **Protección de Idempotencia en Ventas (Misma operación no duplica ingresos)**: 🟡 POR VALIDAR. Existen los campos `idempotency_key` con índices `UNIQUE` correspondientes en `ventas` y `movimientos_caja`, y el RPC los maneja devolviendo una copia existente en caso de `unique_violation`. Pero no se ha validado que el Frontend (`POS.jsx`) los envíe correctamente.
*   **Ventas / Gastos / Liquidaciones NO pueden procesarse dos veces (Estados válidos)**: 🟢 VERIFICADA. Los RPC comprueban `estado = 'BORRADOR'` para compras y `estado = 'PENDIENTE'` para liquidaciones antes de ejecutarlas.
*   **Protección de Idempotencia en Movimientos de Inventario**: ⚫ NO VERIFICABLE a nivel base de datos pura (depende enteramente del éxito atómico de los RPC de venta y recibo de compra).
*   **Control del cierre de sesiones (No solapamiento)**: 🟡 POR VALIDAR. El frontend debe asegurar que si hay una caja abierta no se inicie otra por otro usuario, o se proteja a nivel UI, porque la BD tiene una restricción de `sesion_id` donde se liga pero no hay validaciones extra que impidan dos cajas "ABIERTA".
