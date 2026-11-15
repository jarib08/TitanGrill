# FASE D2.1 — IMPLEMENTACIÓN SCHEMA / MIGRACIONES
**Titan Grill — Sistema Operativo Gastronómico**  
**Fecha de Ejecución:** 2026-09-27 03:01–03:04 UTC  
**Entorno:** Supabase PostgreSQL 17.6.1 Live Production (`mbyjehhplruoqlgphfvw`) + Vite 7 (React 19)  
**Tipo de Documento:** IMPLEMENTACIÓN CONTROLADA — D2.1 SCHEMA / MIGRACIONES

---

## 1. PREFLIGHT (Solo Lectura)

### 1.1 Estructura de `movimientos_inventario` (pre-DDL)

| Columna | Tipo | Nullable |
|---|---|---|
| `id` | uuid | NOT NULL |
| `insumo_id` | uuid | NOT NULL |
| `tipo` | text | NOT NULL |
| `cantidad` | numeric | NOT NULL |
| `motivo` | text | YES |
| `venta_id` | uuid | YES |
| `usuario_id` | uuid | NOT NULL |
| `created_at` | timestamptz | NOT NULL |
| `compra_id` | uuid | YES |
| `costo_unitario_historico` | — | NO EXISTIA |
| `costo_total_historico` | — | NO EXISTIA |

### 1.2 Estructura de `ventas` (pre-DDL)

| Columna | Tipo | Nullable | Notas |
|---|---|---|---|
| `id` | uuid | NOT NULL | PK |
| `idempotency_key` | uuid | YES | Unique index parcial activo |
| `estado` | text | YES | default COMPLETADA |
| `total` | numeric | NOT NULL | |
| `detalles` | jsonb | YES | |

### 1.3 Constraints existentes

- `movimientos_inventario_pkey` — PRIMARY KEY (id)
- FK a compras, insumos, perfiles_trabajadores, ventas
- `ventas_pkey` — PRIMARY KEY (id)
- FKs a clientes, perfiles_trabajadores, sesiones_caja
- Indice: `idx_ventas_idempotency_key` — UNIQUE parcial WHERE idempotency_key IS NOT NULL
- Sin constraint UNIQUE formal sobre idempotency_key — solo indice.

### 1.4 Triggers existentes pre-DDL

- movimientos_inventario: NINGUNO
- ventas: NINGUNO

### 1.5 Conteos pre-DDL

| Tabla | Registros |
|---|---|
| `movimientos_inventario` | 969 |
| `ventas` | 99 |
| `ventas` con `idempotency_key` | 99/99 (100%) |
| Movimientos motivo=compra AND compra_id IS NULL | 1 |

### 1.6 Registro huerfano FC1-NEW-003 (confirmado presente)

```
id:       7c402a48-089b-47ff-9745-ab6f74517332
tipo:     ENTRADA
motivo:   compra
compra_id: NULL
cantidad: 271
```

NO se altera. Documentado como precondicion pendiente D2.3.

### 1.7 Analisis de UPDATE sobre movimientos_inventario

| RPC | Operacion sobre movimientos_inventario |
|---|---|
| `registrar_venta` | INSERT unicamente |
| `recibir_compra` (v1 y v2) | INSERT unicamente |
| `registrar_carga_masiva_inventario` | INSERT unicamente |
| `registrar_movimiento_manual` | INSERT en movimientos_caja (NO en movimientos_inventario) |

Conclusion: no existe ningun UPDATE legitimo activo sobre movimientos_inventario. El trigger de inmutabilidad puede ser pleno sin riesgo de ruptura operacional.

### 1.8 RLS

| Tabla | RLS Habilitado |
|---|---|
| `movimientos_inventario` | true |
| `ventas` | true |
| `insumos` | true |

### 1.9 Columnas snapshot pre-DDL

NINGUNA — confirmado por information_schema.columns (resultado vacio).

---

## 2. PROTECCION/BACKUP VERIFICADO

**Plataforma:** Supabase Cloud (region us-east-2)  
**Estado del proyecto:** ACTIVE_HEALTHY  
**Motor:** PostgreSQL 17.6 (17.6.1.063)  
**Timestamp referencia pre-DDL:** 2026-09-27 03:01:39 UTC  
**DB Size:** 15 MB  

Supabase gestiona automaticamente Point-in-Time Recovery (PITR) con WAL-based backups continuos. El rollback via Supabase Dashboard -> Backups es posible seleccionando un punto anterior a 2026-09-27 03:01:39 UTC.

Segunda linea de defensa: ADD COLUMN es no destructivo. Rollback = DROP COLUMN (sin perdida de datos historicos).

Decision: PASS — se procede con DDL.

---

## 3. MIGRACIONES EJECUTADAS

**Archivo versionado:**  
supabase/migrations/20260927_d2_1_snapshot_costos_inmutabilidad.sql

### DDL aplicado en produccion

```sql
ALTER TABLE public.movimientos_inventario
  ADD COLUMN IF NOT EXISTS costo_unitario_historico NUMERIC(14,4) NULL,
  ADD COLUMN IF NOT EXISTS costo_total_historico    NUMERIC(14,2) NULL;

CREATE OR REPLACE FUNCTION public.fn_immutable_cost_snapshot()
RETURNS trigger LANGUAGE plpgsql AS ...;

DROP TRIGGER IF EXISTS trg_immutable_cost_snapshot ON public.movimientos_inventario;
CREATE TRIGGER trg_immutable_cost_snapshot
  BEFORE UPDATE ON public.movimientos_inventario
  FOR EACH ROW EXECUTE FUNCTION public.fn_immutable_cost_snapshot();

CREATE INDEX IF NOT EXISTS idx_movinv_insumo_costo_snap
  ON public.movimientos_inventario(insumo_id, created_at)
  WHERE costo_unitario_historico IS NOT NULL;
```

---

## 4. OBJETOS CREADOS

| Objeto | Tipo | Resultado |
|---|---|---|
| `costo_unitario_historico` | COLUMN NUMERIC(14,4) NULL en movimientos_inventario | CREADO |
| `costo_total_historico` | COLUMN NUMERIC(14,2) NULL en movimientos_inventario | CREADO |
| `fn_immutable_cost_snapshot` | FUNCTION plpgsql | CREADO |
| `trg_immutable_cost_snapshot` | TRIGGER BEFORE UPDATE en movimientos_inventario | ACTIVO |
| `idx_movinv_insumo_costo_snap` | INDEX btree parcial | CREADO |

Objetos NO creados (por protocolo D2.1):
- Constraint motivo=compra -> compra_id NOT NULL ? pendiente D2.3
- Modificaciones a registrar_venta / recibir_compra ? D2.2

---

## 5. VALIDACIONES

### 5.1 Verificacion post-DDL

| Check | Esperado | Real | Estado |
|---|---|---|---|
| costo_unitario_historico existe | 1 | 1 | PASS |
| costo_total_historico existe | 1 | 1 | PASS |
| Tipo costo_unitario_historico | NUMERIC(14,4) | NUMERIC(14,4) | PASS |
| Tipo costo_total_historico | NUMERIC(14,2) | NUMERIC(14,2) | PASS |
| Ambas columnas nullable | YES | YES | PASS |
| Registros totales post-DDL | 969 | 969 | PASS |
| Registros con costo_unitario_historico NOT NULL | 0 | 0 | PASS |
| Trigger trg_immutable_cost_snapshot | BEFORE UPDATE | BEFORE UPDATE | PASS |
| Indice idx_movinv_insumo_costo_snap | Parcial btree | Parcial btree | PASS |
| RLS movimientos_inventario | true | true | PASS |
| RLS ventas | true | true | PASS |
| RLS insumos | true | true | PASS |

### 5.2 Test funcional del trigger

Test 1 — NULL->NULL (debe PERMITIR):
- UPDATE costo_unitario_historico = NULL sobre registro con campo NULL
- Resultado: PASS — sin excepcion, rollback limpio, 0 residuos

Test 2 — Inmutabilidad (debe BLOQUEAR):
- INSERT con costo_unitario_historico = 5.50, luego UPDATE a 999.99
- Resultado: PASS — trigger lanzo RAISE EXCEPTION FC-004: costo_unitario_historico es inmutable
- Limpieza: DELETE del registro de test ejecutado
- Conteo post-test: 969 (identico al baseline)

---

## 6. RESULTADO POST-MIGRACION

```
total_registros:         969  (identico al pre-DDL)
historicos_null_cuh:     969  (100% — NULL intencional, sin backfill)
historicos_null_cth:     969  (100% — NULL intencional, sin backfill)
compras_huerfanas:       1    (FC1-NEW-003, id=7c402a48..., pendiente D2.3)
primer_movimiento:       2026-09-06 03:57:59 UTC
ultimo_movimiento:       2026-09-18 03:33:14 UTC
```

No se inventaron ni backfillearon costos historicos.

Idempotencia ventas:
```
total_ventas:            99
con_idempotency_key:     99 (100%)
sin_idempotency_key:     0
```

---

## 7. ROLLBACK

```sql
DROP TRIGGER IF EXISTS trg_immutable_cost_snapshot ON public.movimientos_inventario;
DROP FUNCTION IF EXISTS public.fn_immutable_cost_snapshot();
DROP INDEX IF EXISTS idx_movinv_insumo_costo_snap;
ALTER TABLE public.movimientos_inventario
  DROP COLUMN IF EXISTS costo_unitario_historico,
  DROP COLUMN IF EXISTS costo_total_historico;
```

Efecto: restaura movimientos_inventario al estado pre-D2.1. No destruye datos (columnas eran NULL para todos los registros).

---

## 8. GIT / LINT

```
npm run lint: EXIT CODE 0 (PASS)
Nota: "deoptimised styling AdminDashboard.jsx >500KB" es advertencia Babel pre-existente.

Git:
  Branch: main (up to date with origin/main)
  Nuevo en D2.1:
    + supabase/migrations/20260927_d2_1_snapshot_costos_inmutabilidad.sql
  Pre-existentes (no introducidos por D2.1):
    ~ newpromt.md
    ~ src/components/AdminDashboard.jsx
    ~ src/components/POS.jsx
    + FASE_*.md (documentacion de auditoria previa)
```

---

## 9. BLOQUEADORES

| # | Tipo | Descripcion | Resolucion |
|---|---|---|---|
| 1 | Pre-existente | FC1-NEW-003: movimiento 7c402a48 motivo=compra sin compra_id | Documentado. Pendiente D2.3. No se creo constraint. |

No hay bloqueadores que impidan el PASS de D2.1.

---

## 10. DECISION FINAL

```
D2.1 RESULTADO: PASS

Preflight:              PASS
Backup/recuperacion:    PASS (Supabase PITR, referencia 2026-09-27T03:01:39Z)
Migracion:              APLICADA
Snapshot schema:        PASS (costo_unitario_historico + costo_total_historico creados)
Inmutabilidad:          PASS (trigger trg_immutable_cost_snapshot activo y verificado)
Idempotencia schema:    PASS (idx_ventas_idempotency_key preexiste, cobertura 100%)
Datos historicos:       INTACTOS (969 registros, NULL intencional, sin backfill)
RLS:                    PASS (habilitado en las 3 tablas relevantes)
Lint:                   PASS (exit code 0)
Git:                    1 archivo nuevo en supabase/migrations/, 0 archivos fuente modificados

Bloqueadores:
- NINGUNO (FC1-NEW-003 documentado, no bloquea D2.1)

Siguiente fase autorizada:
D2.2 / NO AUTORIZADA
```

> **D2.1 CERRADA. NO iniciar D2.2 automaticamente.**  
> **Esperar instruccion explicita para D2.2.**
