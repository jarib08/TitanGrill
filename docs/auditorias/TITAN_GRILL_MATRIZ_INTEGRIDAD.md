# TITAN GRILL — MATRIZ DE INTEGRIDAD

| Módulo | Fuente primaria | Tablas | RPC | Consumidores | Caja | Inventario | Rentabilidad | Riesgo |
|--------|-----------------|--------|-----|-------------|------|------------|-------------|--------|
| **Ventas** | `ventas`, `movimientos_caja`, `movimientos_inventario` | `ventas`, `movimientos_caja`, `movimientos_inventario` | `registrar_venta` | Dashboard, Clientes | 🟢 INGRESO | 🔴 DESCUENTO | Afecta Positivo | Alto (Concurrencia) |
| **Gastos** | `gastos`, `movimientos_caja` | `gastos`, `movimientos_caja` | `crear_gasto` | Dashboard | 🔴 EGRESO | N/A | Afecta Negativo | Medio |
| **Compras**| `compras`, `movimientos_caja`, `movimientos_inventario` | `compras`, `compra_detalles`, `movimientos_caja`, `movimientos_inventario` | `recibir_compra` | Dashboard, Inventario | 🔴 EGRESO | 🟢 ENTRADA | Afecta Negativo | Alto (Costo unitario) |
| **Liquidaciones** | `liquidaciones`, `movimientos_caja` | `liquidaciones`, `movimientos_caja` | `pagar_liquidacion` | Dashboard | 🔴 EGRESO | N/A | Afecta Negativo | Medio |
| **Caja** | `sesiones_caja`, `movimientos_caja` | `sesiones_caja`, `movimientos_caja` | `abrir_caja`, `cerrar_caja`, `resolver_diferencia_caja`, `registrar_saldo_inicial` | Dashboard | N/A | N/A | N/A | Alto (Arqueo, Diferencias) |
| **Fidelización** | `clientes`, `stamp_logs` | `clientes`, `stamp_logs`, `redemptions` | `increment_stamps`, `redeem_reward` | Ventas | N/A | N/A | N/A | Bajo |
| **Inventario** | `insumos`, `movimientos_inventario` | `insumos`, `movimientos_inventario` | `registrar_merma_trabajador`, `registrar_carga_masiva_inventario` | Dashboard, Rentabilidad | N/A | +/- AJUSTES | Afecta Costos | Medio |
