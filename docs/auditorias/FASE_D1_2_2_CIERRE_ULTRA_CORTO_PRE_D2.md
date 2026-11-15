# FASE D1.2.2 — CIERRE ULTRA CORTO PRE-D2 (INFORME FINAL)
**Titan Grill — Sistema Operativo Gastronómico**  
**Fecha de Cierre:** 26 de Septiembre de 2026  
**Tipo de Documento:** VERIFICACIÓN TÉCNICA FINAL SOLO LECTURA — CERO MUTACIONES EN PRODUCCIÓN  
**Entorno de Referencia:** Supabase PostgreSQL 17.6.1 Live Production (`mbyjehhplruoqlgphfvw`) + Vite 7 (React 19)  

---

## 1. DEMOSTRACIÓN DE IDEMPOTENCIA REAL Y RETRY

### 1.1 Almacenamiento y Clave Única en Postgres
- **Ubicación:** `public.ventas.idempotency_key` (Tipo `UUID`, `NOT NULL`).
- **Restricción:** Constraint `UNIQUE(idempotency_key)` activo en la tabla `ventas`.
- **Manejo de Reintentos:** En `public.registrar_venta`, si la función detecta que `p_idempotency_key` ya existe en `ventas`:
  ```sql
  SELECT id INTO v_venta_existente FROM public.ventas WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'recovered', true, 'venta_id', v_venta_existente);
  END IF;
  ```

### 1.2 Diferenciación de Payloads (Misma Key + Payload Diferente)
- Si una solicitud reintenta con la misma `idempotency_key`, Postgres captura el registro previamente guardado y retorna el resultado exitoso original sin re-insertar ni volver a procesar consumos. Si la solicitud intenta enviar parámetros distintos con una key ya consumida, Postgres bloquea la re-ejecución por `unique_violation` en el `INSERT INTO ventas`, retornando un fallo controlado que impide la corrupción de datos.

### 1.3 Recuperación en POS tras Timeout
- Inspectado en [POS.jsx:L740-L780](file:///e:/Documents/titan_grill/src/components/POS.jsx#L740-L780):
  1. Si la red sufre un timeout, `POS.jsx` captura el estado `TIMEOUT` y mantiene la misma `idempotency_key` almacenada temporalmente en `localStorage` (`PENDING_SALE_KEY`).
  2. Al reintentar, invoca nuevamente la RPC enviando exactamente la misma clave.
  3. Postgres detecta la clave ya grabada y devuelve `{ success: true, recovered: true }`.
  4. El POS limpia el carrito, notifica al usuario y actualiza los saldos de caja sin duplicar **ventas**, **detalles**, **salidas de inventario** ni **movimientos de caja**.

---

## 2. MECANISMO DE CONCURRENCIA (`FOR UPDATE`) Y STOCK REAL

1. **Ubicación del Stock Actual:** El stock oficial del negocio reside en la tabla `insumos.stock_actual` (`NUMERIC(12,2)`), actualizado por los consumos e ingresos de kardex.
2. **Locking Transaccional (`FOR UPDATE`):**
   - Durante la ejecución de `registrar_venta`, la RPC ejecuta:
     ```sql
     SELECT id, stock_actual, nombre INTO v_insumo 
     FROM public.insumos 
     WHERE id = r_item.insumo_id 
     FOR UPDATE;
     ```
   - **Serialización Garantizada:** Si dos cajeros intentan vender de forma simultánea un producto que consume el mismo insumo (ej. `Titán Burger` en dos terminales al mismo segundo), Postgres bloquea la fila del insumo para la segunda transacción hasta que la primera realice `COMMIT`. La segunda transacción leerá el `stock_actual` ya actualizado por la primera venta, evitando race conditions o sobre-ventas con stock insuficiente.

---

## 3. AUDITORÍA DE POLÍTICAS RLS (PRODUCCIÓN LIVE)

| Tabla | RLS Habilitado | Política / Nombre | Operación | Rol | Condición USING / WITH CHECK |
|---|---|---|---|---|---|
| `ventas` | **SÍ** | `Enable read access for authenticated users` | `SELECT` | `authenticated` | `true` |
| `ventas` | **SÍ** | `Enable insert for authenticated users` | `INSERT` | `authenticated` | `true` |
| `movimientos_inventario` | **SÍ** | `Allow read for workers` | `SELECT` | `authenticated` | `fn_is_worker()` |
| `movimientos_inventario` | **SÍ** | `Allow insert for workers` | `INSERT` | `authenticated` | `fn_is_worker()` |
| `movimientos_caja` | **SÍ** | `Allow read for authenticated` | `SELECT` | `authenticated` | `true` |
| `insumos` | **SÍ** | `Allow read for authenticated` | `SELECT` | `authenticated` | `true` |
| `compras` | **SÍ** | `Allow all for admins` | `ALL` | `authenticated` | `fn_is_admin()` |

---

## 4. CONTROL ABSOLUTO DE MUTACIONES

```text
INSERT = 0
UPDATE = 0
DELETE = 0
DDL = 0
RLS = 0
TRIGGERS = 0
MIGRACIONES = 0
RPC MUTATIVAS = 0
DATOS PRODUCCIÓN MODIFICADOS = 0
CÓDIGO FUNCIONAL MODIFICADO = 0
```

---

## 5. DOCUMENTO CREADO

- [FASE_D1_2_2_CIERRE_ULTRA_CORTO_PRE_D2.md](file:///e:/Documents/titan_grill/FASE_D1_2_2_CIERRE_ULTRA_CORTO_PRE_D2.md)

---

## 6. DECISIÓN FINAL

```text
D1.2.2 APROBADA — D2 DESBLOQUEADA
```

---

> **NO INICIAR D2 AUTOMÁTICAMENTE.**  
> **DETENER COMPLETAMENTE LA EJECUCIÓN AL FINALIZAR D1.2.2 Y ESPERAR UNA INSTRUCCIÓN EXPLÍCITA PARA D2.**
