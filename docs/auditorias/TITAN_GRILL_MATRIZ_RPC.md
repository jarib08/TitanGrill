# TITAN GRILL — MATRIZ DE RPC

| RPC | Propósito | Tablas modificadas | Caja | Inventario | Rentabilidad | Atomicidad | Idempotencia | Riesgo |
|-----|-----------|--------------------|------|------------|-------------|------------|--------------|--------|
| `registrar_venta` | Procesar una venta, restar stock, agregar dinero a caja y otorgar sellos | `ventas`, `movimientos_caja`, `insumos`, `movimientos_inventario`, `clientes`, `stamp_logs` | + INGRESO | - MERMA | Afecta Positivo | Sí (Bloque transaccional) | Sí (Usa `idempotency_key`) | 🔴 CRÍTICO |
| `recibir_compra` | Pagar compra e ingresar stock al Kardex | `compras`, `insumos`, `movimientos_inventario`, `movimientos_caja` | - EGRESO | + ENTRADA | Afecta Negativo | Sí | Parcial (Usa check estado 'BORRADOR') | 🔴 CRÍTICO |
| `crear_gasto` | Registrar gasto y egreso de caja | `gastos`, `movimientos_caja` | - EGRESO | = | Afecta Negativo | Sí | No explícita | 🟠 ALTO |
| `ejecutar_anulacion_venta` | Revertir los efectos de una venta (dinero e insumos) | `solicitudes_anulacion_venta`, `ventas`, `movimientos_caja`, `insumos`, `movimientos_inventario`, `clientes`, `stamp_logs` | - EGRESO | + ENTRADA | Afecta Negativo | Sí | Parcial (Usa check estado) | 🔴 CRÍTICO |
| `realizar_transferencia_interna` | Mover dinero entre cuentas / métodos de pago | `movimientos_caja` | +/- | = | = (Neutro) | Sí | No explícita | 🟠 ALTO |
| `pagar_liquidacion` | Pagar nómina (Efectivo/Nequi/Bancolombia) | `liquidaciones`, `movimientos_caja` | - EGRESO | = | Afecta Negativo | Sí | Parcial (Usa check estado) | 🟠 ALTO |
| `abrir_caja` | Iniciar turno laboral | `sesiones_caja` | = | = | = | Sí | No explícita | 🟡 MEDIO |
| `cerrar_caja` | Finalizar turno e informar descuadres | `sesiones_caja` | = | = | = | Sí | No explícita | 🟡 MEDIO |
| `registrar_saldo_inicial` | Configurar caja inicial de operación | `movimientos_caja` | + INGRESO | = | = | Sí | Parcial (Una por sesión) | 🟡 MEDIO |
| `increment_stamps` | Registrar sello a cliente y dar recompensa | `clientes`, `stamp_logs` | = | = | = | Sí | Sí (Trigger log) | 🟢 BAJO |
| `redeem_reward` | Canjear 10 sellos por un beneficio | `clientes`, `redemptions` | = | = | Afecta Negativo (indirecto)| Sí | Sí (IF `stamps >= 10`) | 🟢 BAJO |
| `registrar_merma_trabajador`| Reportar desperdicio o pérdida | `insumos`, `movimientos_inventario`| = | - MERMA | Afecta Negativo (Costos) | Sí | No explícita | 🟠 ALTO |
