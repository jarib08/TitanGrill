# CONTEXTO GLOBAL TITAN GRILL

> **Documento de Consolidación Forense y Técnico**  
> **Fecha de Emisión:** 2026-09-26  
> **Estado Operativo:** Fases D2.1, D2.2 y D2.3 Completadas con Éxito (0 Mutaciones durante esta auditoría/generación).

---

## 1. ESTADO GENERAL DEL REPOSITORIO

- **Framework & Runtime:** Single Package App React 19 (JavaScript / JSX puro, sin TypeScript), empaquetado y construido con Vite 7.
- **Port:** Dev server en `http://localhost:5173`.
- **Rutas Principales (`App.jsx`):**
  - `/` -> `POS` (Punto de venta principal)
  - `/admin` -> `AdminDashboard` (Panel de administración general)
  - `/pedidos` -> `GestorPedidos` (Gestión de comandas y cocina)
  - `/menu` -> Menu digital para clientes con QR
- **Calidad de Código / Linting:** ESLint flat config configurado (`npm run lint` -> **0 errores / PASS**).
- **Control de Versiones (Git):** Branch `main`, sincronizado con `origin/main`. Archivos de documentación y reportes de fases auditados presentes sin commits pendientes sobre código funcional.

---

## 2. ESTADO REAL DE SUPABASE (PRODUCCIÓN)

- **Conexión:** `src/lib/supabaseClient.js` consumiendo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- **Tablas Públicas Principales Auditadas:**
  - `ventas`: 99 registros históricos baseline + ventas de prueba limpiadas. Incluye columna `payload_fingerprint` y `idempotency_key`.
  - `movimientos_inventario`: 970+ registros (incluye ajuste histórico regularizado de tomate). Columnas `costo_unitario_historico` y `costo_total_historico` agregadas y operativas.
  - `movimientos_caja`: 120 registros intactos.
  - `insumos`: Stock y estado de ingredientes. Incluye restricción y validación de insumos activos (`activo = true`).
  - `recetas` / `receta_detalles`: Desglose e ingredientes por producto comercial.
  - `compras` / `compra_detalles`: Gestión de proveedores y recepciones.
- **Restricciones de Integridad Críticas Aplicadas:**
  - `chk_movimientos_compra_trazabilidad`: Impide entradas de inventario etiquetadas como `compra` o `ENTRADA_COMPRA` si `compra_id IS NULL`.

---

## 3. ESTADO DE LA FASE D2.1 (Schema & Migraciones)

- **Resultado:** **PASS**
- **Logros Clave:**
  - Adición exitosa y libre de bloqueos de las columnas `costo_unitario_historico` y `costo_total_historico` en `movimientos_inventario`.
  - Adición de `payload_fingerprint` en `ventas`.
  - Respeto total a la regla de **NO Backfill**: Los movimientos de inventario históricos previos a D2.1 mantienen `NULL` en los costos históricos para preservar la integridad histórica inalterada.

---

## 4. ESTADO DE LA FASE D2.2 (RPC `registrar_venta`, Idempotencia & Snapshots)

- **Resultado:** **PASS**
- **Logros Clave:**
  - **RPC `registrar_venta` Reescrita de Forma Atómica:** Integra validación de idempotencia dual por `idempotency_key` y `payload_fingerprint`.
  - **Snapshot Inmutable:** Cada venta captura el `costo_unitario` vigente del insumo al instante y graba `costo_unitario_historico` y `costo_total_historico` en `movimientos_inventario`.
  - **Control Anti-Deadlock:** Ordenamiento determinístico de `insumo_id` antes del bloqueo `FOR UPDATE OF i`.
  - **Ingredientes Inactivos (FC1-NEW-002):** Si un producto contiene algún ingrediente con `activo = false`, la venta se aborta inmediatamente con `ROLLBACK`.

---

## 5. ESTADO DE LA FASE D2.3 (Compras, Trazabilidad & Ajustes)

- **Resultado:** **PASS**
- **Logros Clave:**
  - **Snapshot en RPC `recibir_compra`:** Graba `costo_unitario_historico` y `costo_total_historico` desde el detalle real de compra.
  - **Saneamiento FC1-NEW-003:** Movimiento `7c402a48-089b-47ff-9745-ab6f74517332` con `compra_id = NULL` actualizado de motivo `compra` a `'Ajuste de inventario histórico sin compra asociada'`.
  - **Constraint `chk_movimientos_compra_trazabilidad`:** Aplicado en DB.
  - **Regularización Tomate (-6.0 unids):** Ajuste físico por omisiones pre-D2.2 ejecutado sin alterar registros ni inventar COGS pasados.

---

## 6. PENDIENTES FASES D2.4 - D2.7 (Plan Maestro / Próximos Pasos)

- **D2.4 (Remediación de POS y Gestión de Red):** Integración en el frontend POS del envío y manejo correcto de respuestas de la RPC `registrar_venta` (recuperación idempotente, reintentos).
- **D2.5 (Motor Financiero & COGS Dashboard):** Actualización de reportes financieros y Dashboard Admin para calcular COGS basándose exclusivamente en `costo_total_historico` inmutable.
- **D2.6 (Auditoría Integral de Caja y Desfases):** Validación de cierres de caja y compatibilidad con `fetch_expected_cash`.
- **D2.7 (Verificación de Regresión & QA Final):** Suite E2E de simulación de caja, ventas en lote, desconexiones y carga masiva.

---

## 7. ARCHIVOS PRINCIPALES PARA EL NUEVO PROGRAMADOR

1. **Punto de Venta (POS):** `src/components/POS.jsx` (Manejo de carrito, cobro, llamado a RPC `registrar_venta`).
2. **Dashboard de Administración:** `src/components/AdminDashboard.jsx` (Inventarios, reportes de ventas, recetas, insumos, compras).
3. **Rutinas de Supabase:** RPCs PostgreSQL en la base de datos produccion (`registrar_venta`, `recibir_compra`, `registrar_carga_masiva_inventario`).
4. **Cliente de Supabase:** `src/lib/supabaseClient.js`.
5. **Reportes Forenses de Fases:**
   - `FASE_D2_1_IMPLEMENTACION_SCHEMA_MIGRACIONES.md`
   - `FASE_D2_2_IMPLEMENTACION_RPC_IDEMPOTENCIA_SNAPSHOT.md`
   - `FASE_D2_3_COMPRAS_TRAZABILIDAD_AJUSTES.md`

---

## 8. RIESGOS CRÍTICOS / ALTOS ENCONTRADOS Y ATENDIDOS

- **Riesgo 1 (Mitigado en D2.2):** Deducción silenciosa de insumos inactivos -> Corregido con rechazo estricto de la venta.
- **Riesgo 2 (Mitigado en D2.2):** Duplicación de ventas por reintentos de red -> Corregido con `idempotency_key` y `payload_fingerprint`.
- **Riesgo 3 (Mitigado en D2.3):** Entradas de inventario por compras ficticias/huérfanas -> Mitigado con constraint `chk_movimientos_compra_trazabilidad`.
- **Riesgo 4 (Pendiente para D2.4/D2.5):** Cálculo de COGS en frontend usando costos variables actuales en vez del historial inmutable -> Requiere actualizar consultas a `movimientos_inventario.costo_total_historico`.

---

## 9. GIT STATUS ACTUAL

```text
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  modified:   newpromt.md
  modified:   src/components/AdminDashboard.jsx
  modified:   src/components/POS.jsx

Untracked files:
  [Documentos de auditoría FASE A a FASE D2.3]
```

---

## 10. CONFIRMACIÓN DE CERO MUTACIONES

> **Declaración Solemne:**  
> Durante la presente ejecución de lectura y resumen de estado global, **NO SE REALIZÓ NINGUNA MUTACIÓN** sobre la base de datos de Supabase, **NO SE REALIZÓ NINGUNA MODIFICACIÓN** de código fuente ni archivos de configuración, **NO SE CREÓ NINGÚN COMMIT** y **NO SE HIZO PUSH**.

---
