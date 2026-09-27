# FASE E.1.1 — VALIDACIÓN FORENSE DE F-E1-001

> **Proyecto**: Titan Grill POS  
> **Fecha de Emisión**: 25 de Septiembre de 2026  
> **Fase**: FASE E — VENTAS  
> **Subfase**: E.1.1 (Validación Forense de Integridad de `p_total`)  
> **Modo**: ESTRICTAMENTE READ-ONLY ABSOLUTO  
> **Veredicto Final**: **HALLAZGO CONFIRMADO**  

---

## 1. OBJETIVO

Validar exclusivamente el hallazgo **F-E1-001** registrado en la Fase E.1:  
*El valor `p_total` de `registrar_venta` se origina en el cliente y la RPC de PostgreSQL no efectúa una re-validación server-side recalculando la suma de los ítems provistos contra el catálogo de productos.*

---

## 2. FUENTES AUDITADAS

1. `TITAN_GRILL_PLAN_MAESTRO_AUDITORIA.md`
2. `TITAN_GRILL_FUENTE_DE_VERDAD.md`
3. `TITAN_GRILL_MATRIZ_INTEGRIDAD.md`
4. `TITAN_GRILL_INVARIANTES_FINANCIERAS.md`
5. `TITAN_GRILL_MATRIZ_RPC.md`
6. `FASE_E1_AUDITORIA_FORENSE_VENTAS.md`
7. `src/components/POS.jsx`

---

## 3. FLUJO REAL DE `p_total`

En [POS.jsx](file:///e:/Documents/titan_grill/src/components/POS.jsx):
1. **Carrito**: El usuario selecciona ítems. Cada ítem tiene `precio_unitario` y `cantidad`.
2. **Cálculos Frontend**:
   - `subtotal = sum(item.precio * item.cantidad)`
   - `discount = discountType === 'porcentaje' ? (subtotal * discountInput / 100) : Number(discountInput)`
   - `finalTotal = Math.max(0, subtotal - discount)`
3. **Payload a RPC**:
   - `p_total: finalTotal`
   - `p_detalles: { items: cart, subtotal, discount }`
4. **Construcción del Payload**: El valor `p_total` enviado en los parámetros de la RPC es exactamente la variable calculada localmente en la memoria del navegador.

---

## 4. FUENTE DE LOS PRECIOS

- **Origen del Precio en el Payload**: El precio unitario enviado dentro de `p_detalles.items` proviene de la lectura del catálogo `productos` precargado al inicializar el POS (`fetchProducts`).
- **Comportamiento en Servidor**: La RPC `registrar_venta` itera `p_detalles.items` e inserta los precios directamente en `detalles_venta` y utiliza `p_total` para la cabecera de `ventas` y para los registros de `movimientos_caja`.

---

## 5. CÁLCULO SERVER-SIDE DEL TOTAL

- **Estado Actual**: **NO RECALCULADO**.
- **Análisis Estático**: La RPC `registrar_venta` confía en el valor numérico provisto en `p_total` y no vuelve a consultar la tabla `productos` en PostgreSQL para recalcular `SUM(p.precio * item.cantidad) - p_descuento`.
- **Efecto**: Si una solicitud HTTP fuese interceptada o manipulada alterando `p_total` (o mutando los precios de los ítems en `p_detalles.items`), la RPC registraría la venta con el total alterado sin arrojar un error de suma financiera.

---

## 6. VALIDACIONES EXISTENTES

1. **Validación de Pago Mixto (Cliente)**: En `POS.jsx` (línea 850), si el método es `MIXTO`, se requiere que `cashAmount + nequiAmount + bancolombiaAmount === finalTotal`.
2. **Validación de Carrito Vacío (Cliente)**: Bloquea `cart.length === 0`.
3. **Control de Idempotencia (Servidor)**: Si se reenvía la misma `p_idempotency_key`, la RPC evita la duplicación retornando el registro idéntico original.
4. **Falta de Validación Server-side de Totales**: No existe un bloque SQL `IF (p_total != v_sum_calculada) THEN RAISE EXCEPTION` dentro de la RPC.

---

## 7. ESCENARIOS CONCEPTUALES AUDITADOS

- **Escenario A (Venta Normal)**: `1 × Burger Classic ($15.000)`. Cliente envía `p_total = 15000`. Resultado: Venta guardada correctamente.
- **Escenario B (Total Inferior Manipulado - Conceptual)**: Producto suma `$15.000`, cliente manipula payload y envía `p_total = 10000`. Resultado: La base de datos insertaría `ventas.total = 10000` y `movimientos_caja = 10000`. Descalce entre valor real del producto y dinero cobrado/registrado.
- **Escenario C (Total Superior Manipulado - Conceptual)**: Producto suma `$15.000`, cliente envía `p_total = 20000`. Resultado: Se insertaría por `$20.000`.
- **Escenario D (Descuentos Negativos o Absurdos - Conceptual)**: Si un cliente enviara un descuento negativo o superior al subtotal, no existe una restricción de validación rígida en la RPC SQL para forzar `descuento <= subtotal`.

---

## 8. IMPACTO FINANCIERO Y CONTROLES COMPENSATORIOS

- **Impacto Financiero Teórico**: Potencial descalce en la conciliación de ingresos si el cliente fuera vulnerado o modificado maliciosamente.
- **Controles Compensatorios Vigentes**:
  1. **Entorno Controlado**: El POS opera exclusivamente en tablets/PCs del local ejecutadas por cajeros autorizados de Titan Grill.
  2. **Trazabilidad por Cajero**: Todas las ventas quedan asociadas a `trabajador_id` y `sesion_id`. Cualquier anomalía es imputable al cajero de turno.
  3. **Cuadre de Arqueo**: El dinero físico/digital contado al cierre (`cerrar_caja`) revelaría descuadres respecto a lo vendido.

---

## 9. IDEMPOTENCIA Y ATOMICIDAD

- **Idempotencia (`p_idempotency_key`)**: **PROTEGIDA**. Cambiar `p_total` reutilizando una clave `p_idempotency_key` existente no genera registros nuevos; el servidor retorna la venta previamente procesada.
- **Atomicidad Transaccional**: **CONFIRMADA**. Todo el flujo (`ventas`, `detalles_venta`, `movimientos_caja`, `insumos`, `stamp_logs`) se ejecuta dentro de la misma transacción SQL en Supabase.

---

## 10. EVALUACIÓN DE SEVERIDAD DE F-E1-001

- **Clasificación**: **MEDIUM** (Severidad Media).
- **Justificación**: Aunque no es explotable remotamente por clientes finales (al ser una app POS interna), constituye un riesgo de arquitectura financiera al delegar la autoridad del cálculo del monto total en el cliente web sin verificación estricta en la base de datos.

---

## 11. HALLAZGOS HEREDADOS (FC-009 y FC1-NEW-002)

- **FC-009** (Pre-validación de stock sin `FOR UPDATE`) y **FC1-NEW-002** (Insumos inactivos en recetas) permanecen aislados como hallazgos de inventario y **no afectan** la integridad lógica de `p_total`.

---

## 12. EVIDENCIA DE AUDITORÍA

- **Flujo de Parámetros y Payload**: **ESTÁTICO** (Verificado en `POS.jsx` y matriz RPC).
- **Inexistencia de Recálculo en BD**: **ESTÁTICO** (Confirmado por análisis del contrato de la RPC `registrar_venta`).
- **Estabilidad de Entorno**: **MEDIDO** (`npm run lint` Exit Code 0, `npm run build` Exit Code 0 en 18.90s).

---

## 13. CONCLUSIÓN Y CORRECCIÓN CONCEPTUAL FUTURA

- **Conclusión**: El hallazgo **F-E1-001 queda CONFIRMADO**. `p_total` es generado en el cliente y aceptado directamente por el servidor sin recálculo.
- **Corrección Conceptual Futura (Para subfases de implementación E.2+)**:
  En la RPC `registrar_venta`, iterar la lista de ítems, consultar el precio oficial de cada producto en la tabla `productos`, recalcular `v_total_esperado = SUM(precio_base * cantidad) - p_descuento`, y validar que `ABS(p_total - v_total_esperado) < 0.01` antes de confirmar la transacción.

---

## 14. VALIDACIÓN ESTÁTICA Y GIT

- **`npm run lint`**: Exit Code 0 (0 errores).
- **`npm run build`**: Exit Code 0 (18.90s).
- **Git**: Cero cambios en código de producción. Solamente creado `FASE_E1_1_VALIDACION_FORENSE_F_E1_001.md`.

---

**Firma Forense**: Agentic AI Antigravity - Technical Integrity Governance  
**Estado**: `VERIFICATION_COMPLETED`  
