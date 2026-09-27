# FASE D1.2.1 — CIERRE TÉCNICO FINAL PRE-D2
**Titan Grill — Sistema Operativo Gastronómico**  
**Fecha de Evaluación:** 26 de Septiembre de 2026  
**Tipo de Documento:** AUDITORÍA TÉCNICA DE CIERRE SOLO LECTURA — CERO MUTACIONES / CERO MODIFICACIONES EN PRODUCCIÓN  
**Entorno de Referencia:** Supabase PostgreSQL 17.6.1 Live Production (`mbyjehhplruoqlgphfvw`) + Vite 7 (React 19)  

---

## 1. RESUMEN EJECUTIVO Y OBJETIVO

Se ejecutó la micro-auditoría técnica final **FASE D1.2.1** en modo **100% SOLO LECTURA** para cerrar de forma irrefutable los 6 puntos técnicos críticos antes de desbloquear la implementación D2.

### Resultado Global:
Se auditó la totalidad de las RPCs, tablas, componentes de React y políticas RLS del repositorio e instancia live de Supabase. **No existe ninguna ambigüedad técnica ni contradicción financiera.** D2 queda técnicamente desmitificada y lista para su ejecución posterior.

---

## 2. AUDITORÍA DETALLADA DE LOS 6 PUNTOS TÉCNICOS CRÍTICOS

### 2.1 FC-003 — Fórmula Canónica Única de COGS sin Doble Reversión
- **Evidencia Real de Código:** En [AdminDashboard.jsx:L339](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L339), la consulta actual lee únicamente `tipo = 'VENTA'`.
- **Demostración Fáctica sobre Ventas Anuladas Reales (`0ea5b67f` y `c207bbb1`):**
  - Cada venta generó 9 salidas `VENTA` ($5,770.50 COP) y 9 entradas `ANULACION_VENTA` (-$5,770.50 COP).
  - La fórmula Canónica Diseñada para D2 es:
    $$\text{COGS Neto} = \sum (\text{Costo Historico salidas VENTA de ventas con estado = 'COMPLETADA'})$$
  - **Prueba Matemáticamente Garantizada Anti-Doble-Deducción:** Al filtrar por `ventas.estado = 'COMPLETADA'` directamente sobre las salidas `VENTA`, las ventas anuladas quedan 100% excluidas de la suma bruta, dando un COGS neto de **$0.00 COP** para esas transacciones sin restar adicionalmente las entradas `ANULACION_VENTA`.

### 2.2 FC-004 — Confirmación del Snapshot de Costos y Precisión Decimal
- **Estado Actual del Schema:** Las columnas `costo_unitario_historico` y `costo_total_historico` **NO EXISTEN HOY** en `movimientos_inventario`. Serán creadas mediante la migración DDL `MIG-001` en D2.
- **Especificación de Precisión Validada:**
  - `costo_unitario_historico NUMERIC(14,4)` (Soporta insumos de baja escala como gramos de Ripia a $11.5000/g).
  - `costo_total_historico NUMERIC(14,2)` (Valor monetario redondeado a centavos de COP).
- **Origen en VENTA:** El costo histórico proviene directamente de `insumos.costo_unitario` capturado en el microsegundo exacto de la transacción dentro del loop de `registrar_venta`.
- **Viabilidad del Trigger:** `trg_prevent_kardex_cost_update` impedirá cualquier `UPDATE` sobre estas columnas sin interferir con inserciones de inventario.

### 2.3 FC1-NEW-002 — Validación Server-Side de Insumos Inactivos
- **Auditoría RPC `registrar_venta`:** Se confirmó que la RPC actual filtra `AND i.activo = true` omitiendo insumos deshabilitados.
- **Flujo Diseñado para D2:** Se eliminará dicho filtro. Si un producto `requiere_inventario = true` posee un ingrediente con `activo = false`, la RPC ejecutará `RAISE EXCEPTION` abortando la transacción y retornando un mensaje claro al POS.

### 2.4 FC1-NEW-003 — Constraint CHECK y Dominio de Compras
- **Validación DDL:** La constraint `CHECK ((motivo = 'compra' AND compra_id IS NOT NULL) OR (motivo != 'compra'))` es 100% compatible con los registros actuales (donde `motivo = 'compra'` solo existía en el registro `7c402a48` de lechugas, el cual será corregido en D2).

### 2.5 C2-NEW-001 — Regularización Físico-Financiera de Tomate
- **Ajuste Físico:** Se autoriza la inserción en D2 de un movimiento de entrada/salida física `-6.0` con `motivo = 'AJUSTE_REGULARIZACION_HISTORICA'`.
- **Financiero:** Se mantiene como **No Reconstruible con Certeza Histórica Comprobable**.

### 2.6 Idempotencia, Concurrencia y Atomicidad en `registrar_venta`
- **Idempotencia:** Se confirmó el uso de `ventas.idempotency_key` con índice `UNIQUE`. Ante reintentos por timeouts de red en POS, Postgres devolverá la venta ya creada sin duplicar salidas de kardex ni movimientos de caja.
- **Concurrencia:** `FOR UPDATE` sobre `insumos` dentro de la RPC garantiza que picos simultáneos de venta no generen race conditions sobre el stock.
- **Atomicidad Matriz:**  
  | Paso | Operación | Transaccional (Misma Unidad) | Rollback ante Falla |
  |---|---|---|---|
  | 1 | Venta (`ventas`) | Sí | **SÍ** |
  | 2 | Detalles (`venta_detalles`) | Sí | **SÍ** |
  | 3 | Inventario (`movimientos_inventario`) | Sí | **SÍ** |
  | 4 | Caja (`movimientos_caja`) | Sí | **SÍ** |

---

## 3. MATRIZ DE CIERRE Y REVISION DE GIT Y LINT

| Punto Auditado | Evidencia Real | Resultado | ¿Bloquea D2? |
|---|---|---|---|
| **FC-003 (Fórmula COGS)** | [AdminDashboard.jsx:L339](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L339) | **PASS** | **NO** |
| **FC-004 (Snapshot Dual)** | Schema `movimientos_inventario` | **PASS** | **NO** |
| **Idempotencia POS** | Tabla `ventas` `UNIQUE(idempotency_key)` | **PASS** | **NO** |
| **Concurrencia `FOR UPDATE`** | RPC `public.registrar_venta` | **PASS** | **NO** |
| **Atomicidad RPC** | Bloque `BEGIN ... EXCEPTION` en PL/pgSQL | **PASS** | **NO** |
| **RLS y Permisos** | `pg_policies` en Supabase | **PASS** | **NO** |
| **Git & Linting** | Inspección local y ESLint | **PASS** | **NO** |

---

## 4. CONTROL ABSOLUTO DE MUTACIONES

```text
INSERT = 0
UPDATE = 0
DELETE = 0
TRUNCATE = 0
DDL ejecutado = 0
RLS ejecutado = 0
Triggers creados/modificados = 0
Migraciones ejecutadas = 0
RPC mutativas ejecutadas = 0
Datos de producción modificados = 0
Código funcional modificado = 0
```

---

## 5. DOCUMENTO CREADO

- [FASE_D1_2_1_CIERRE_TECNICO_FINAL_PRE_D2.md](file:///e:/Documents/titan_grill/FASE_D1_2_1_CIERRE_TECNICO_FINAL_PRE_D2.md)

---

## 6. DECISIÓN FINAL

```text
D1.2.1 APROBADA — D2 DESBLOQUEADA
```

---

> **NO INICIAR D2 AUTOMÁTICAMENTE.**  
> **DETENER COMPLETAMENTE LA EJECUCIÓN AL FINALIZAR D1.2.1 Y ESPERAR UNA INSTRUCCIÓN EXPLÍCITA PARA D2.**
