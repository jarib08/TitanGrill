# TITAN GRILL — AUDITORÍA FASE B (INVENTARIO Y MERMAS)

## 1. RESUMEN DE LA AUDITORÍA
En cumplimiento de la FASE B (solo lectura), se ha realizado una inspección forense del modelo de datos, RPCs, reglas de seguridad (RLS) y la interfaz de usuario referentes a inventario, productos, recetas, movimientos de inventario, compras y mermas.

Se ha descubierto que, si bien existen restricciones de integridad básicas (como `CHECK (stock_actual >= 0)`), la concurrencia en la lectura y escritura de inventarios presenta vulnerabilidades graves que podrían corromper tanto las existencias físicas lógicas como los egresos financieros asociados.

---

## 2. FLUJO ACTUAL DE INVENTARIO

### Estructura de Datos
- **`productos`**: Catálogo de venta final. Utiliza un flag `requiere_inventario` para decidir si descuenta stock.
- **`insumos`**: Inventario bruto con cantidades y costos. Protegido por `CHECK (stock_actual >= 0)`.
- **`producto_insumos`**: Representa las recetas (relación N:M entre productos e insumos con `cantidad_por_unidad`).
- **`movimientos_inventario`**: Tabla de bitácora/trazabilidad con tipos: `VENTA`, `ANULACION_VENTA`, `ENTRADA_COMPRA`, `AJUSTE`, `MERMA`.
- **`compras` / `compra_detalles`**: Representan órdenes de abastecimiento que, al recibirse, alimentan el stock y generan un egreso de caja.

### Flujo Operativo Analizado
1. **Venta (`registrar_venta`)**: Al vender, el RPC verifica si el producto requiere inventario, iterando sus insumos. Hace una pre-validación (leyendo stock) y si aprueba, más abajo ejecuta un `UPDATE` restando el stock.
2. **Abastecimiento (`recibir_compra`)**: Cambia el estado de una compra de `BORRADOR` a `RECIBIDA`, aumenta el `stock_actual` de cada insumo y genera un egreso en la caja activa.
3. **Mermas (`registrar_merma_trabajador`)**: Permite a cualquier trabajador restar stock por pérdida/daño, bloqueando la fila de insumo (`FOR UPDATE`) y dejando registro de `MERMA`.
4. **Carga Masiva (`registrar_carga_masiva_inventario`)**: Toma un "nuevo stock" digitado, calcula la diferencia contra el actual y hace un `UPDATE` sobreescribiendo el valor, registrando `AJUSTE`.

---

## 3. HALLAZGOS Y VULNERABILIDADES CRÍTICAS

### B-001: Race Condition en Ventas (Error 500 en POS por violación de Check)
- **Severidad:** ALTA
- **Problema:** En `registrar_venta`, la validación de inventario (`IF v_insumo.stock_actual < v_stock_required`) se hace **sin bloqueo (sin FOR UPDATE)**. 
- **Impacto:** Si dos ventas concurrentes compiten por la última unidad de un insumo, ambas pasarán la validación. Al ejecutar el descuento (`stock_actual = stock_actual - requerido`), la restricción de BD `insumos_stock_actual_check` frenará la segunda transacción. Como el RPC no maneja un bloque `EXCEPTION WHEN check_violation`, esto explotará retornando un error HTTP 500 nativo de PostgreSQL al frontend, en lugar de un mensaje amigable ("Stock insuficiente"), bloqueando temporalmente la UI del POS.

### B-002: Doble Recepción de Compras (Doble Stock y Doble Egreso Financiero)
- **Severidad:** CRÍTICA
- **Problema:** En el RPC `recibir_compra`, la verificación de idempotencia se hace sin bloqueo transaccional (`SELECT estado ... WHERE id = p_compra_id`).
- **Impacto:** Si un socio hace un "doble clic" al botón de Recibir Compra, o existen problemas de red, dos solicitudes simultáneas leerán el estado `BORRADOR` y ambas procederán a ejecutar la lógica. El sistema sumará el doble de insumos al inventario y, lo que es más grave, **descontará el doble del dinero de la sesión de caja** (`movimientos_caja` tipo `EGRESO`), descuadrando la contabilidad irremediablemente sin validación estricta de estado.

### B-003: Sobreescritura Ciega en Carga Masiva de Inventario
- **Severidad:** MEDIA-ALTA
- **Problema:** El RPC `registrar_carga_masiva_inventario` lee el stock actual para calcular el "delta", y luego aplica un `UPDATE` estableciendo ciegamente `stock_actual = v_nuevo_stock`.
- **Impacto:** Si un cajero registra una venta mientras el administrador está guardando una carga masiva/auditoría, la carga masiva sobreescribirá el stock, destruyendo el descuento legítimo hecho por la venta concurrente. (Ej: Stock=10, Venta descuenta 2 -> Stock=8. Carga masiva tenía 15 en pantalla, sobreescribe con 15. El inventario real quedó en 15 cuando debió ser 13).

### B-004: Trazabilidad de Mermas
- **Severidad:** BAJA
- **Problema:** El diseño del RPC `registrar_merma_trabajador` es el **único** que está correctamente blindado usando `FOR UPDATE`. Sin embargo, al consultar la base de datos se nota que el tipo `MERMA` no tiene registros históricos (solo `AJUSTE`), lo cual sugiere que los trabajadores no están usando esta función o la UI depende de cargas masivas para los ajustes por daños.

---

## 4. CONCLUSIÓN Y ESTADO DE LA AUDITORÍA
La FASE B revela deficiencias significativas en el manejo de concurrencia para las recepciones de compras (afectando la caja) y en la reducción de inventarios por ventas y ajustes masivos.

**ESTADO ACTUAL:** AUDITORÍA FINALIZADA. **ESPERANDO AUTORIZACIÓN PARA CREAR EL PLAN DE CORRECCIÓN (FASE B.1).** Ninguna modificación se ha realizado en la base de datos ni en el código.
