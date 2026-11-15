# FASE B — AUDITORÍA FORENSE DEL MOTOR TRANSACCIONAL DE CAJA Y CIERRE
**Titan Grill — Sistema Operativo Gastronómico**
**Fecha de Ejecución:** 24 de Septiembre de 2026
**Tipo de Auditoría:** SOLO LECTURA — FORENSE — SIN CORRECCIONES
**Entorno:** Vite 7 (React 19) + Supabase PostgreSQL 17.6.1 (Producción Live)

---

## 1. ALCANCE

| Capa | Alcance |
|------|---------|
| UI/Frontend | AdminDashboard.jsx (L1108), POS.jsx |
| RPCs | `cerrar_caja`, `registrar_saldo_inicial` (×2), `registrar_venta`, `anular_venta_directa`, `ejecutar_anulacion_venta`, `crear_gasto`, `recibir_compra`, `realizar_transferencia_interna`, `resolver_diferencia_caja`, `calcular_saldo_global` |
| Tablas | `sesiones_caja`, `movimientos_caja`, `ventas`, `gastos`, `compras` |
| Datos en vivo | 7 sesiones históricas, ~106 movimientos de caja |
| Sesión zombie | `d23831d6-2e10-4475-b13b-78ae2f25b407` |

---

## 2. METODOLOGÍA

1. Análisis estático de RPCs extraídas de `pg_proc` en producción vía Supabase MCP.
2. Consultas forenses read-only: SQL directo a BD de producción, zero modificaciones.
3. Reconstrucción matemática del esperado de cierre, independiente de valores guardados en DB.
4. Cruce entre valores calculados y valores almacenados en `sesiones_caja`.
5. Inspección de AdminDashboard.jsx (filtros de tipo_operacion).

---

## 3. ARQUITECTURA REAL

```
APERTURA (abrir_caja)
  → INSERT sesiones_caja (estado='ABIERTA', monto_apertura, apertura_nequi, apertura_bancolombia)
  → NO genera movimiento en movimientos_caja

SALDO INICIAL (registrar_saldo_inicial) [Rol: Socio]
  → INSERT movimientos_caja (tipo=INGRESO, tipo_operacion=SALDO_INICIAL, sesion_id=X)
  → Hasta 3 registros (EFECTIVO, NEQUI, BANCOLOMBIA)

VENTAS / GASTOS / COMPRAS / LIQUIDACIONES / TRANSFERENCIAS
  → INSERT movimientos_caja (tipos varios, sesion_id en su mayoría)

CIERRE (cerrar_caja) — Modelo C: cierre declarativo
  → Lee monto_apertura + SUM(movimientos_caja WHERE sesion_id=X)
  → UPDATE sesiones_caja (estado=CERRADA, esperado_*, contado_*, diferencia_*)
  → NO genera movimiento en movimientos_caja

RESOLVER DIFERENCIA (resolver_diferencia_caja) [Rol: Socio]
  → INSERT movimientos_caja (tipo_operacion=AJUSTE_FALTANTE o AJUSTE_SOBRANTE)
```

**Principios:**
- `monto_apertura` = fondo de cambio declarado por el trabajador al abrir turno.
- `SALDO_INICIAL` = fondo del negocio inyectado por el Socio (movimiento financiero real).
- `cerrar_caja` suma ambos (monto_apertura + movimientos sesion, incluyendo SALDO_INICIAL).
- Sesión por trabajador: pueden coexistir dos sesiones ABIERTA simultáneamente.

---

## 4. FASE 1 — CERRAR_CAJA

### Parámetros
```sql
cerrar_caja(
  p_monto_cierre_contado  numeric,
  p_observaciones         text,
  p_contado_nequi         numeric DEFAULT 0,
  p_contado_bancolombia   numeric DEFAULT 0
)
```

### Fórmula matemática exacta

```
v_mov_efectivo    = SUM(CASE tipo WHEN 'INGRESO' THEN monto ELSE -monto END)
                    FROM movimientos_caja WHERE sesion_id=X AND metodo_pago='EFECTIVO'

v_esp_efectivo    = monto_apertura + v_mov_efectivo
v_esp_nequi       = apertura_nequi + v_mov_nequi
v_esp_bancolombia = apertura_bancolombia + v_mov_bancolombia

v_dif_efectivo    = p_monto_cierre_contado - v_esp_efectivo
v_total_esperado  = v_esp_efectivo + v_esp_nequi + v_esp_bancolombia
v_total_contado   = p_monto_cierre_contado + p_contado_nequi + p_contado_bancolombia
v_dif_total       = v_total_contado - v_total_esperado
```

### Análisis de concurrencia y locks

| Aspecto | Evaluación |
|---------|-----------|
| SELECT FOR UPDATE | ❌ No existe sobre sesiones_caja antes del cálculo |
| Validación estado ABIERTA | ✅ Filtra `estado='ABIERTA'` |
| Doble cierre | ✅ Protegido por estado (el segundo `WHERE estado='ABIERTA'` retorna NULL) |
| Cierre + venta simultánea | 🔴 Sin lock: ventana de carrera existe entre SUM y UPDATE |
| Idempotencia | Implícita: segundo intento devuelve success:false |

---

## 5. FASE 2 — REGISTRAR_SALDO_INICIAL

### HALLAZGO: Dos versiones activas en producción

| Versión | Firma | Búsqueda de sesión | Concurrencia |
|---------|-------|-------------------|-------------|
| V1 (antigua) | `(p_efectivo, p_nequi, p_bancolombia)` | `fn_get_active_session(auth.uid())` | Sin FOR UPDATE |
| V2 (nueva/migration) | `(p_sesion_id, p_efectivo, p_nequi, p_bancolombia)` | `WHERE id=p_sesion_id` | Con FOR UPDATE |

**Ambas versiones:** requieren Socio, verifican estado ABIERTA, bloquean doble saldo con `COUNT(*) > 0`.

### Caso Especial FASE-A-002 — Sesión `283e7d33`

**Datos reales de producción:**
```
sesiones_caja:
  monto_apertura = 82,000 | apertura_nequi = 0 | apertura_bancolombia = 0

movimientos_caja (sesion_id=283e7d33):
  SALDO_INICIAL  EFECTIVO     +189,400
  SALDO_INICIAL  BANCOLOMBIA   +51,631
  Ventas         EFECTIVO     +107,900
  Ventas         NEQUI         +19,980
  Ventas         BANCOLOMBIA  +161,820
  Anulación      BANCOLOMBIA    -9,990
```

**Reconstrucción matemática:**
```
v_mov_efectivo    = 189,400 + 107,900 = 297,300
v_esp_efectivo    = 82,000 + 297,300  = 379,300  ✅ COINCIDE DB
v_esp_nequi       = 0 + 19,980        = 19,980   ✅ COINCIDE DB
v_esp_bancolombia = 0 + 213,451       = 213,451  ✅ COINCIDE DB
v_total_esperado  = 612,731                       ✅ COINCIDE DB
```

**Conclusión FASE-A-002:** → **CONFIRMADO**

El esperado de cierre incluye correctamente `monto_apertura + SALDO_INICIAL + ventas`.
El SALDO_INICIAL (189,400) entra como movimiento INGRESO y se suma al monto_apertura (82,000) en el cálculo del esperado efectivo, lo cual es matemáticamente coherente si ambos representan efectivo físico en caja.

---

## 6. FASE 3 — MATRIZ DE MOVIMIENTOS_CAJA

### Tipos de operación en producción

| tipo_operacion | tipo | metodo_pago | # | Total ($) | sesion_id | venta_id | gasto_id | compra_id |
|---------------|------|------------|---|-----------|-----------|----------|---------|---------|
| `NULL` (ventas/liq/anulación) | INGRESO | EFECTIVO | 53 | 1,190,610 | Sí | Mayoría sí | No | No |
| `NULL` | INGRESO | NEQUI | 10 | 136,980 | Sí | Sí | No | No |
| `NULL` | INGRESO | BANCOLOMBIA | 38 | 656,820 | Sí | Sí | No | No |
| `NULL` (liquidaciones) | EGRESO | EFECTIVO | 2 | 80,000 | Sí | No | No | No |
| `NULL` (anulación+compra) | EGRESO | BANCOLOMBIA | 3 | 58,630 | Mixto¹ | Parcial | No | 1 |
| `SALDO_INICIAL` | INGRESO | EFECTIVO | 1 | 189,400 | Sí | No | No | No |
| `SALDO_INICIAL` | INGRESO | BANCOLOMBIA | 1 | 51,631 | Sí | No | No | No |
| `TRANSFERENCIA_INTERNA` | EGRESO | EFECTIVO | 2 | 144,831 | Sí | No | No | No |
| `TRANSFERENCIA_INTERNA` | EGRESO | NEQUI | 2 | 74,980 | Sí | No | No | No |
| `TRANSFERENCIA_INTERNA` | INGRESO | BANCOLOMBIA | 4 | 219,811 | Sí | No | No | No |
| `RETIRO` | EGRESO | EFECTIVO | 2 | 500,379 | Sí | No | No | No |
| `RETIRO` | EGRESO | NEQUI | 1 | 20,000 | Sí | No | No | No |
| `INGRESO_MANUAL` | INGRESO | BANCOLOMBIA | 1 | 2,161 | Sí | No | No | No |

¹ 1 compra con `sesion_id=NULL` (FB-002)

**RETIRO:** egresos opacos sin `gasto_id`, `compra_id` ni `venta_id`. No pasan por `crear_gasto`. Trazabilidad: descripción textual libre únicamente.

---

## 7. FASE 4 — VENTAS

### registrar_venta — cadena de efectos
```
ventas INSERT (estado='COMPLETADA', sesion_id, idempotency_key)
  + movimientos_caja INSERT INGRESO (sesion_id, venta_id, metodo_pago)
    └─ Si MIXTO: hasta 3 registros por método de pago
  + insumos UPDATE (-stock)
  + movimientos_inventario INSERT (tipo='VENTA')
  + clientes UPDATE (+stamp) + stamp_logs INSERT
```

**Sesión usada:** Primero sesión propia del trabajador, luego fallback a cualquier sesión ABIERTA más reciente.

**Idempotencia:** ✅ `idempotency_key` en ventas + try/catch unique_violation.

### Anulación — HALLAZGO CRÍTICO (FB-003)

Ambos RPCs de anulación (`anular_venta_directa`, `ejecutar_anulacion_venta`) buscan sesión así:
```sql
SELECT id FROM sesiones_caja WHERE estado='ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1;
```
**El EGRESO compensatorio va a la sesión ACTUALMENTE abierta, no a la sesión original de la venta.**

**Verificado en producción:** Venta `0ea5b67f` (INGRESO 9,990 BANCOLOMBIA en sesión `283e7d33`, CERRADA) → EGRESO compensatorio en sesión `181e86d5` (diferente sesión/trabajador).

---

## 8. FASE 5 — GASTOS

**crear_gasto:** `gastos INSERT` + `movimientos_caja INSERT (tipo=EGRESO, gasto_id, sesion_id=sesión_abierta_más_reciente)`.

**Sin sesión abierta:** `sesion_id=NULL` → egreso invisible en arqueo (afecta saldo global solamente).

**Liquidaciones:** `pagar_liquidacion` genera EGRESO con `tipo_operacion=NULL`. No diferenciables de egresos de ventas anuladas excepto por descripción textual.

---

## 9. FASE 6 — COMPRAS

**recibir_compra:** INSERT `movimientos_caja` sin `sesion_id` en la lista de columnas:
```sql
INSERT INTO movimientos_caja (tipo, monto, metodo_pago, descripcion, trabajador_id, compra_id)
VALUES ('EGRESO', v_total, p_metodo_pago, 'Pago de compra de insumos', auth.uid(), p_compra_id)
-- Sin sesion_id
```

**Confirmado en producción:** `d6f798e9` (38,650 BANCOLOMBIA, compra_id=`45ed9db2`) con `sesion_id=NULL`.

**Consecuencias:**
- Egreso de compra → invisible en arqueo de cualquier sesión.
- Egreso de compra → visible en `calcular_saldo_global` (sin filtro de sesión).
- Trabajadores verán diferencias al arquear que no corresponden a sus acciones.

**Doble egreso:** No posible — `estado='BORRADOR'` como guard de idempotencia.

---

## 10. FASE 7 — TRANSFERENCIAS INTERNAS

**realizar_transferencia_interna:**
```
movimientos_caja INSERT EGRESO (origen, TRANSFERENCIA_INTERNA, idempotency_key)
movimientos_caja INSERT INGRESO (destino, TRANSFERENCIA_INTERNA, sin idempotency_key)
```

**Impacto en Dashboard:** ✅ Filtrado correctamente (`tipo_operacion !== 'TRANSFERENCIA_INTERNA'`).

**Impacto en calcular_saldo_global:** ✅ Neutro (verificado: `TRANSFERENCIA_INTERNA impacto_neto = 0`).

**Idempotencia parcial:** Solo el EGRESO tiene idempotency_key. Fallo de red entre los dos INSERTs → EGRESO huérfano sin INGRESO (FB-007).

---

## 11. FASE 8 — DIFERENCIAS DE CAJA

**resolver_diferencia_caja:**
- Solo sobre sesiones CERRADAS.
- Crea movimiento compensatorio (`AJUSTE_FALTANTE`=EGRESO, `AJUSTE_SOBRANTE`=INGRESO).
- Anti-duplicación: `EXISTS(... WHERE sesion_id AND metodo_pago AND tipo_operacion IN (...))`
- **NO actualiza** `sesiones_caja.diferencia_*`. La diferencia original permanece registrada (FB-008).

---

## 12. FASE 9 — ANÁLISIS DE CONCURRENCIA

| Escenario | Protección real PostgreSQL | Riesgo |
|-----------|---------------------------|--------|
| Dos cierres misma sesión | Estado cambia a CERRADA → segundo devuelve NULL | 🟢 BAJO |
| Cierre + venta simultánea | Sin FOR UPDATE → ventana de carrera | 🔴 REAL |
| Cierre + gasto simultáneo | Sin FOR UPDATE | 🔴 REAL |
| Cierre + transferencia | Sin FOR UPDATE | 🔴 REAL |
| Dos SALDO_INICIAL simultáneos | V2 usa SELECT FOR UPDATE | 🟢 PROTEGIDO |
| Dos anulaciones simultáneas | `ventas FOR UPDATE` en ambos RPCs | 🟢 PROTEGIDO |
| Timeout durante cerrar_caja | PostgreSQL rollback → trabajador puede reintentar | 🟢 OK |
| Timeout post-commit | Cierre aplicado; reintento → success:false | 🟢 OK |
| Dos abrir_caja simultáneos | Índice único + try/catch unique_violation | 🟢 PROTEGIDO |
| Reintento cerrar_caja | success:false (no hay sesión ABIERTA) | 🟢 OK |

---

## 13. FASE 10 — RECONCILIACIÓN MATEMÁTICA (7 sesiones)

| Sesión | Estado | Esp. EF (calc) | Esp. EF (DB) | Esp. NQ (calc) | Esp. NQ (DB) | Esp. BC (calc) | Esp. BC (DB) | ✅ |
|--------|--------|---------------|-------------|---------------|-------------|---------------|-------------|---|
| `283e7d33` | CERRADA | 379,300 | 379,300 | 19,980 | 19,980 | 213,451 | 213,451 | ✅ |
| `d23831d6` | **ABIERTA** | **-416,689** | 0* | **-75,000** | 0* | 199,831 | 0* | N/A† |
| `181e86d5` | CERRADA | 8,389 | 8,389 | 20 | 20 | 2,161 | 2,161 | ✅ |
| `603e3360` | CERRADA | 415,000 | 415,000 | 18,000 | 18,000 | 0 | 0 | ✅ |
| `64bde410` | CERRADA | 333,000 | 333,000 | 37,000 | 37,000 | 243,000 | 243,000 | ✅ |
| `4d304b11` | CERRADA | 153,800 | 153,800 | 24,000 | 24,000 | 108,000 | 108,000 | ✅ |
| `bf4fe1ec` | CERRADA | 136,000 | 136,000 | 18,000 | 18,000 | 144,000 | 144,000 | ✅ |

*Campos `esperado_*` son 0/NULL porque la sesión nunca fue cerrada.
†La sesión zombie no tiene valores de cierre; los valores calculados son la proyección si se cerrara hoy.

**Resultado: Las 6 sesiones CERRADAS tienen reconciliación matemática perfecta. El algoritmo de `cerrar_caja` produce resultados exactos y verificados.**

---

## 14. FASE 11 — SESIÓN ZOMBIE `d23831d6`

| Campo | Valor |
|-------|-------|
| **ID** | `d23831d6-2e10-4475-b13b-78ae2f25b407` |
| **trabajador_id** | `fbd7bacb-f275-4544-ab07-d567ebbba944` |
| **Estado** | ABIERTA |
| **Fecha apertura** | 2026-09-07 21:52 UTC |
| **monto_apertura** | 87,000 |
| **Duración al cierre de auditoría** | ~17 días |

### Movimientos de la zombie

| Tipo | Operación | Método | Monto | Fecha |
|------|-----------|--------|-------|-------|
| INGRESO | Ventas (10) | EFECTIVO | +217,810 | 07-08 Sep |
| EGRESO | Liquidación | EFECTIVO | -40,000 | 08 Sep |
| EGRESO | TRANSFERENCIA_INTERNA | EFECTIVO | -115,999 | 08 Sep |
| INGRESO | TRANSFERENCIA_INTERNA | BANCOLOMBIA | +115,999 | 08 Sep |
| EGRESO | RETIRO | NEQUI | -20,000 | 09 Sep |
| EGRESO | TRANSFERENCIA_INTERNA | NEQUI | -55,000 | 12 Sep |
| INGRESO | TRANSFERENCIA_INTERNA | BANCOLOMBIA | +55,000 | 12 Sep |
| EGRESO | TRANSFERENCIA_INTERNA | EFECTIVO | -28,832 | 12 Sep |
| INGRESO | TRANSFERENCIA_INTERNA | BANCOLOMBIA | +28,832 | 12 Sep |
| EGRESO | RETIRO | EFECTIVO | -496,668 | 12 Sep |
| EGRESO | Liquidación | EFECTIVO | -40,000 | 13 Sep |

### Proyección de cierre hoy

```
Efectivo esperado:  87,000 + (-503,689) = -416,689  [NEGATIVO]
Nequi esperado:     0 + (-75,000)       = -75,000   [NEGATIVO]
Bancolombia esp:    0 + 199,831         = +199,831
```

**Si se cierra hoy con p_contado_efectivo=0:** diferencia efectivo = +416,689 (sobrante ficticio).

### Comportamiento actual en POS

Si `fbd7bacb` intenta abrir caja → sistema detecta sesión ABIERTA → devuelve `success:true, sesion_id=d23831d6` → trabaja sobre sesión zombie. Cualquier venta nueva entra a esta sesión ya contaminada.

### Información mínima para cierre administrativo

1. Detalle de los 20 movimientos listados con montos y fechas.
2. Justificación de RETIRO 496,668 ("gasto semanal") y RETIRO 20,000 ("Ajuste").
3. Liquidaciones: 2 × 40,000 EFECTIVO (Sep 8 y Sep 13).
4. Transferencias internas: 3 operaciones (total 200,831 BANCOLOMBIA).

---

## 15. FASE 12 — DASHBOARD Y SALDO GLOBAL

### calcular_saldo_global (RPC)

```sql
SELECT SUM(CASE metodo_pago='EFECTIVO' WHEN tipo='INGRESO' THEN monto ELSE -monto END) ...
FROM movimientos_caja;  -- Sin filtro de sesión ni fecha
```

**SALDO_INICIAL en saldo global:** ✅ Incluido — impacto neto +241,031 en producción.
**TRANSFERENCIAS en saldo global:** ✅ Neutras (neto = 0, verificado).

### AdminDashboard.jsx — Cálculo de ingresos/egresos (L1108-1115)

```javascript
totalIngresos = movimientos.filter(m =>
  m.tipo === 'INGRESO' &&
  m.tipo_operacion !== 'TRANSFERENCIA_INTERNA'   // ✅ transferencias excluidas
// ❌ SALDO_INICIAL NO excluido
// ❌ INGRESO_MANUAL NO excluido
).reduce((sum, m) => sum + m.monto, 0);

totalEgresos = movimientos.filter(m =>
  m.tipo === 'EGRESO' &&
  m.tipo_operacion !== 'TRANSFERENCIA_INTERNA'   // ✅ transferencias excluidas
// ❌ RETIRO NO excluido (aparece como egreso operativo)
).reduce((sum, m) => sum + m.monto, 0);
```

### Tabla de aparición de SALDO_INICIAL por contexto

| Contexto | SALDO_INICIAL incluido | Como qué aparece |
|----------|----------------------|-----------------|
| cerrar_caja (arqueo) | ✅ Sí | Parte del "esperado" |
| calcular_saldo_global | ✅ Sí | Ingreso financiero |
| Dashboard totalIngresos | ✅ Sí (no filtrado) | **Ingreso operativo** (incorrecto) |
| Dashboard netCash | ✅ Sí | Parte del flujo neto |
| Dashboard rentabilidad | N/A | No calculada aquí |

---

## 16. FASE 13 — INVARIANTES FINANCIERAS

| Invariante | Estado | Evidencia |
|-----------|--------|-----------|
| Venta válida ↔ Pago en movimientos_caja | ✅ VERIFICADA | Cruce venta_id: 1:1 |
| Venta válida ↔ Salida de inventario | ✅ VERIFICADA | RPC atómica |
| Venta anulada ↔ Reversión caja+inventario | ⚠️ PARCIALMENTE VERIFICADA | Reversión existe pero en sesión diferente |
| Gasto ↔ Egreso en caja | ✅ VERIFICADA | crear_gasto atómica |
| Compra pagada ↔ Egreso en caja | ⚠️ PARCIALMENTE VERIFICADA | Egreso existe pero sesion_id=NULL |
| Liquidación ↔ Egreso en caja | ✅ VERIFICADA | pagar_liquidacion inserta egreso |
| Transferencia ↔ EGRESO+INGRESO par | ✅ VERIFICADA (histórico) | 4 transferencias con par completo |
| Idempotencia ventas | 🟡 POR VALIDAR | RPC OK; front-end no validado en esta fase |
| No solapamiento de sesiones | ❌ PARCIALMENTE VIOLADA | Zombie + nueva sesión coexisten |
| Compra no se ejecuta dos veces | ✅ VERIFICADA | estado='BORRADOR' como guard |

---

## 17. FASE 14 — MATRIZ DE INTEGRIDAD (ACTUALIZACIONES)

| Nueva relación documentada | Hallazgo |
|---------------------------|---------|
| `recibir_compra` → `movimientos_caja.sesion_id` | NULL por omisión en código; egreso excluido del arqueo |
| `anular_venta_*` → sesión activa (no original) | EGRESO compensatorio en sesión incorrecta (contaminación inter-sesión) |
| `resolver_diferencia_caja` → `sesiones_caja.diferencia_*` | NO actualiza diferencia en sesión; inconsistencia histórica |
| Dashboard.totalIngresos → SALDO_INICIAL | Sin filtro; el fondo del negocio infla ingresos operativos |

---

## 18. FASE 15 — HALLAZGOS

### FB-001 — 🔴 CRÍTICO: cerrar_caja sin SELECT FOR UPDATE

**Descripción:** `cerrar_caja` calcula el arqueo leyendo `movimientos_caja` y luego hace UPDATE sobre `sesiones_caja` sin `SELECT ... FOR UPDATE` sobre la sesión. Una venta, gasto o transferencia procesada concurrentemente después del SELECT pero antes del UPDATE produce un arqueo con saldo incorrecto.

| Campo | Detalle |
|-------|---------|
| RPC | `cerrar_caja` |
| Tablas | `sesiones_caja`, `movimientos_caja` |
| Constraint | Ninguno protege la ventana de carrera |
| Impacto financiero | Arqueo incorrecto → diferencias ficticias |
| Probabilidad | Baja (concurrencia en momento exacto del cierre) |
| Estado | Riesgo teórico confirmado por código |

---

### FB-002 — 🔴 CRÍTICO: egreso de compra con sesion_id=NULL

**Descripción:** `recibir_compra` no asigna `sesion_id` al egreso. El pago de cada compra es invisible en el arqueo de cierre de cualquier sesión. Solo visible en saldo global.

| Campo | Detalle |
|-------|---------|
| Evidencia | `movimientos_caja.d6f798e9` (38,650 BANCOLOMBIA, sesion_id=NULL, compra_id=45ed9db2) |
| RPC | `recibir_compra` |
| Tablas | `movimientos_caja` |
| Impacto | Diferencias sistemáticas e inexplicadas en todos los arqueos de sesiones que coincidan temporalmente con compras |
| Probabilidad | 100% — ocurre en cada compra recibida |
| Estado | CONFIRMADO en producción |

---

### FB-003 — 🔴 CRÍTICO: movimiento compensatorio de anulación en sesión incorrecta

**Descripción:** `anular_venta_directa` y `ejecutar_anulacion_venta` asignan el EGRESO compensatorio a `SELECT ... WHERE estado='ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1` — no a la sesión original de la venta. Sesiones cerradas quedan sin reversión en su arqueo; la sesión activa recibe egresos de otros turnos.

| Campo | Detalle |
|-------|---------|
| Evidencia | Venta `0ea5b67f` (INGRESO 9,990 en sesión `283e7d33`) → EGRESO compensatorio en sesión `181e86d5` |
| RPC | `anular_venta_directa`, `ejecutar_anulacion_venta` |
| Impacto financiero | Sesión receptora con arqueo inflado negativamente; sesión original con arqueo sin reversión |
| Probabilidad | ALTA — ocurre en toda anulación de venta de sesión ya cerrada |
| Estado | CONFIRMADO en producción |

---

### FB-004 — 🟠 ALTO: Dos versiones de registrar_saldo_inicial en producción

**Descripción:** Coexisten V1 (sin p_sesion_id, busca sesión del usuario) y V2 (con p_sesion_id, usa FOR UPDATE). El frontend debe llamar a la versión correcta según el contexto.

| Campo | Detalle |
|-------|---------|
| Evidencia | `pg_proc` retorna 2 registros con `proname='registrar_saldo_inicial'` y firmas diferentes |
| Impacto | Posible inyección de saldo en sesión incorrecta si se usa V1 en contexto multi-socio |
| Estado | CONFIRMADO — ambas versiones coexisten en producción |

---

### FB-005 — 🟠 ALTO: SALDO_INICIAL no filtrado en Dashboard (sobreestima ingresos)

**Descripción:** `AdminDashboard.jsx L1108` no filtra `tipo_operacion='SALDO_INICIAL'`. El fondo del negocio ($241,031 en producción) inflará "Ingresos del período" si cae en el rango de fechas.

| Campo | Detalle |
|-------|---------|
| Archivo | `src/components/AdminDashboard.jsx` L1108 |
| Impacto financiero | Ingresos operativos sobreestimados en el valor del fondo inicial |
| Probabilidad | ALTA — ocurre en cada análisis que incluya la fecha del SALDO_INICIAL |
| Estado | CONFIRMADO por código |

---

### FB-006 — 🟠 ALTO: RETIRO sin categoría (opaco financieramente)

**Descripción:** `tipo_operacion='RETIRO'` son egresos sin `gasto_id`, `compra_id` ni `venta_id`. No pasan por `crear_gasto`. Solo tienen descripción textual libre. $520,379 no trazables a ninguna entidad del sistema.

| Campo | Detalle |
|-------|---------|
| Evidencia | 3 movimientos RETIRO: 3,711 EF, 20,000 NEQUI, 496,668 EF ("gasto semanal") |
| Impacto | Egresos no auditables; potencial vector de extracción no controlada |
| Estado | CONFIRMADO en producción |

---

### FB-007 — 🟠 ALTO: Idempotencia parcial en realizar_transferencia_interna

**Descripción:** Solo el EGRESO tiene `idempotency_key`. Fallo de red entre el INSERT EGRESO y el INSERT INGRESO puede producir EGRESO huérfano si el cliente reintenta (el RPC devolvería "ya procesada" basado en la clave del EGRESO).

| Campo | Detalle |
|-------|---------|
| RPC | `realizar_transferencia_interna` |
| Probabilidad | Muy baja (fallo de red exactamente entre dos INSERTs) |
| Estado | Riesgo teórico; no ocurrido en producción (4/4 transferencias tienen par) |

---

### FB-008 — 🟠 ALTO: resolver_diferencia_caja no actualiza sesiones_caja.diferencia_*

**Descripción:** El RPC crea movimiento compensatorio pero NO hace `UPDATE sesiones_caja SET diferencia_*`. La sesión sigue mostrando la diferencia original aunque ya esté resuelta.

| Campo | Detalle |
|-------|---------|
| RPC | `resolver_diferencia_caja` |
| Impacto | Reportes históricos de sesiones incorrectos; inconsistencia entre movimiento y sesión |
| Estado | CONFIRMADO por código |

---

### FB-009 — 🟡 MEDIO: Sesión zombie con saldo esperado negativo

| Campo | Detalle |
|-------|---------|
| Sesión | `d23831d6`, ABIERTA 17+ días |
| Saldo efectivo proyectado | **-416,689** |
| Saldo nequi proyectado | **-75,000** |
| Impacto | No puede cerrarse normalmente sin diferencias irreconciliables |
| Estado | CONFIRMADO en producción |

---

### FB-010 — 🟡 MEDIO: Liquidaciones sin tipo_operacion específico

| Campo | Detalle |
|-------|---------|
| RPC | `pagar_liquidacion` |
| Descripción | EGRESO con `tipo_operacion=NULL`, solo distinguible por texto "Pago de liquidación..." |
| Impacto | Dashboard no puede diferenciar liquidaciones de otros egresos automáticamente |
| Estado | CONFIRMADO |

---

### FB-011 — 🟡 MEDIO: crear_gasto puede registrar sin sesión abierta

| Campo | Detalle |
|-------|---------|
| RPC | `crear_gasto` |
| Descripción | Sin caja abierta, `sesion_id=NULL`. Afecta saldo global pero no arqueo. |
| Estado | Riesgo teórico; no confirmado si ocurrió en producción |

---

### FB-012 — 🟡 MEDIO: INGRESO_MANUAL no filtrado en Dashboard

| Campo | Detalle |
|-------|---------|
| Archivo | `src/components/AdminDashboard.jsx` L1108 |
| Descripción | Aparece como ingreso operativo aunque sea ajuste manual |
| Estado | CONFIRMADO por código |

---

### FB-013 — 🟡 MEDIO: registrar_venta usa fallback a sesión más reciente global

| Campo | Detalle |
|-------|---------|
| RPC | `registrar_venta` |
| Descripción | Si el trabajador no tiene sesión propia pero existe la zombie (de otro trabajador), la venta se registra en la zombie. Contamina el arqueo del otro trabajador. |
| Estado | POSIBLE — zombie activa puede capturar ventas de otros trabajadores |

---

### FB-014 — 🟡 MEDIO: No existe sesión única global abierta

| Campo | Detalle |
|-------|---------|
| Tablas | `sesiones_caja` |
| Descripción | `idx_sesion_unica_abierta` es por trabajador. Dos trabajadores pueden tener cajas abiertas simultáneamente, y los movimientos sin trabajador (gastos, compras, transferencias) se asignan a la sesión más reciente de cualquiera. |
| Estado | Diseño conocido, documentado |

---

### FB-015 — 🟢 BAJO: V1 de registrar_saldo_inicial no puede inyectar en sesiones ajenas

| Campo | Detalle |
|-------|---------|
| RPC | `registrar_saldo_inicial` V1 |
| Descripción | V1 busca sesión del propio usuario → si el Socio no tiene sesión, devuelve error. No puede inyectar en sesiones de otros. |
| Estado | Protegido por diseño |

---

### FB-016 — 🟢 BAJO: cerrar_caja sin observaciones obligatorias

| Campo | Detalle |
|-------|---------|
| RPC | `cerrar_caja` |
| Descripción | `p_observaciones` es opcional. Cierre sin justificación posible. |
| Estado | Decisión de diseño; riesgo operativo bajo |

---

### FB-017 — 🟢 BAJO: Transferencias en sesión zombie desde fechas tardías

| Campo | Detalle |
|-------|---------|
| Sesión | `d23831d6` |
| Descripción | 3 transferencias el 2026-09-12 mezclan movimientos en sesión de Sep 7. |
| Estado | Documentado para cierre administrativo |

---

### FB-018 — ❓ NO VERIFICADO: Idempotencia en POS.jsx

| Campo | Detalle |
|-------|---------|
| Archivo | `src/components/POS.jsx` |
| Descripción | El RPC `registrar_venta` implementa idempotency_key correctamente. No verificado si POS.jsx la genera/envía en todos los caminos de ejecución. |
| Estado | POR VALIDAR |

---

### FB-019 — ❓ NO VERIFICADO: RLS de movimientos_caja para AJUSTE_*

| Campo | Detalle |
|-------|---------|
| Tablas | `movimientos_caja` |
| Descripción | No se auditaron políticas RLS para verificar que AJUSTE_FALTANTE/SOBRANTE solo se inserten vía `resolver_diferencia_caja` (Socio). |
| Estado | POR VALIDAR |

---

## 19. FASE 16 — MATRIZ DE DOBLE CONTABILIZACIÓN

| Evento | Movimiento generado | Otro lugar donde aparece | Riesgo doble conteo | Resultado |
|--------|--------------------|--------------------------|--------------------|-----------|
| monto_apertura | Ninguno (sesiones_caja) | Base del esperado en cerrar_caja | ⚠️ Se suma a SALDO_INICIAL | Acumulación intencional si representan efectivo distinto |
| SALDO_INICIAL | movimientos_caja INGRESO | Esperado cierre, Dashboard ingresos, saldo global | 🔴 Infla ingresos Dashboard | No es ingreso operativo |
| Venta | movimientos_caja INGRESO | Dashboard ventas Y Dashboard caja | ✅ Dos vistas distintas | Correcto (no es doble conteo) |
| Anulación venta | movimientos_caja EGRESO (sesión actual) | Venta ANULADA | 🔴 EGRESO en sesión diferente | Contamina arqueo sesión receptora |
| Gasto | gastos + movimientos_caja EGRESO | Dashboard egresos | ✅ Sin doble conteo | Correcto |
| Compra | movimientos_caja EGRESO (sesion_id=NULL) | Saldo global (no arqueo) | 🔴 Ausente del arqueo | Invisible en cierre de turno |
| Transferencia | EGRESO+INGRESO par | Saldo global neutro, Dashboard filtrado | ✅ Correctamente excluido | Sin doble conteo neto |
| Cierre | Ningún movimiento (Modelo C) | sesiones_caja.esperado_* | ✅ Declarativo | Sin doble conteo |
| Diferencia caja | movimientos_caja AJUSTE | Sesión con diferencia original intacta | 🟡 Inconsistencia histórica | Sin doble conteo financiero |
| RETIRO | movimientos_caja EGRESO | Dashboard egresos | ⚠️ Opaco, sin categoría | Aparece como egreso normal sin trazabilidad |

---

## 20. RIESGOS ADICIONALES

1. **Zombie activa:** ventas del trabajador `fbd7bacb` van a sesión con saldo efectivo proyectado de -416K.
2. **Compras sistemáticamente fuera del arqueo:** cada compra recibida amplía la brecha entre saldo físico y arqueo.
3. **Ingresos inflados por SALDO_INICIAL:** análisis de rentabilidad sobreestima ingresos del período.
4. **RETIRO no auditable:** $520,379 sin categoría ni trazabilidad a entidad de negocio.

---

## 21. ELEMENTOS NO VERIFICADOS

| Elemento | Motivo |
|----------|--------|
| FB-018: idempotency_key front-end | Análisis profundo de POS.jsx requerido |
| FB-019: RLS movimientos_caja | No se consultó `pg_policies` |
| `anular_gasto` RPC completo | No disponible en consulta inicial |
| `pagar_liquidacion` RPC completo | Ídem |
| `aprobar_anulacion_venta` RPC | Ídem |
| Ventas actuales del trabajador zombie | No verificado si `fbd7bacb` sigue operando |

---

## 22. RECOMENDACIONES (Solo documentación — NO implementar ahora)

1. **[FB-001/CRÍTICO]** Agregar `SELECT ... FOR UPDATE` en `cerrar_caja` sobre la fila de la sesión antes del cálculo.
2. **[FB-002/CRÍTICO]** Agregar `sesion_id` al INSERT de `recibir_compra` (sesión más reciente o parámetro explícito).
3. **[FB-003/CRÍTICO]** En anulación de ventas, usar `v_mov.sesion_id` (de la sesión original) en lugar de buscar la sesión ABIERTA actual.
4. **[FB-004/ALTO]** Unificar las dos versiones de `registrar_saldo_inicial` en V2 (con p_sesion_id y FOR UPDATE).
5. **[FB-005/ALTO]** Filtrar `SALDO_INICIAL` e `INGRESO_MANUAL` del cálculo de totalIngresos en Dashboard.
6. **[FB-006/ALTO]** Requerir que RETIRO pase por `crear_gasto` o crear tipo formal con categoría obligatoria.
7. **[FB-009/MEDIO]** Cerrar sesión zombie con protocolo administrativo documentado.
8. **[FB-010/MEDIO]** Agregar `tipo_operacion='LIQUIDACION'` a `pagar_liquidacion`.
9. **[FB-008/ALTO]** Actualizar `sesiones_caja.diferencia_*` en `resolver_diferencia_caja` para coherencia histórica.

---

## 23. EVIDENCIA

| Hallazgo | Evidencia en producción |
|---------|------------------------|
| FB-002 | `movimientos_caja.id=d6f798e9: sesion_id=NULL, compra_id=45ed9db2, monto=38650, metodo_pago=BANCOLOMBIA` |
| FB-003 | `movimientos_caja.id=541a4387: venta_id=0ea5b67f, sesion_id=181e86d5, tipo=EGRESO` vs `id=efea94f5: venta_id=0ea5b67f, sesion_id=283e7d33, tipo=INGRESO` |
| FB-005 | `AdminDashboard.jsx L1108: filter omite tipo_operacion!='SALDO_INICIAL'` |
| FB-006 | `id=5870deb1: RETIRO 496,668 EF, gasto_id=NULL, descripcion='gasto semanal'` |
| FB-009 | `sesiones_caja.d23831d6: estado=ABIERTA, fecha_apertura=2026-09-07` |
| Reconciliación | 6/6 sesiones CERRADAS: calc = DB en todos los campos esperado_* |

---

## 24. CONCLUSIÓN

**El motor transaccional de caja funciona correctamente para el caso feliz:** apertura → ventas → cierre. Las 6 sesiones cerradas tienen reconciliación matemática perfecta. El algoritmo de `cerrar_caja` produce resultados exactos y verificados.

**Tres defectos críticos en producción:** ausencia de lock en cerrar_caja (FB-001), egresos de compras invisibles en arqueo (FB-002), y movimientos compensatorios de anulación en sesiones incorrectas (FB-003).

**La sesión zombie `d23831d6`** es el riesgo operativo más inmediato con saldo efectivo proyectado de -416,689 y 17+ días de acumulación.

**El SALDO_INICIAL contamina métricas de Dashboard** sobreestimando ingresos operativos.

---

## REGLA DE CONTINUIDAD — ESTADO FINAL

### FASE-A-002: **CONFIRMADO**

La fórmula real de cerrar_caja es:
```
esperado_efectivo = monto_apertura + SUM(movimientos WHERE sesion_id AND metodo_pago='EFECTIVO')
```
El SALDO_INICIAL (189,400) entra como movimiento INGRESO en la misma sesión y se suma al monto_apertura (82,000), dando esperado_efectivo = 379,300. Verificado matemáticamente y coincide exactamente con el valor en producción.

---

### Resumen de hallazgos por severidad

| Severidad | Cantidad | IDs |
|-----------|----------|-----|
| 🔴 CRÍTICO | 3 | FB-001, FB-002, FB-003 |
| 🟠 ALTO | 5 | FB-004, FB-005, FB-006, FB-007, FB-008 |
| 🟡 MEDIO | 6 | FB-009, FB-010, FB-011, FB-012, FB-013, FB-014 |
| 🟢 BAJO | 3 | FB-015, FB-016, FB-017 |
| ❓ NO VERIFICADO | 2 | FB-018, FB-019 |
| **TOTAL** | **19** | |

### Hallazgos CRÍTICOS y ALTOS

| ID | Severidad | Descripción corta |
|----|-----------|------------------|
| FB-001 | 🔴 CRÍTICO | cerrar_caja sin SELECT FOR UPDATE → ventana de carrera |
| FB-002 | 🔴 CRÍTICO | recibir_compra: egreso con sesion_id=NULL → invisible en arqueo |
| FB-003 | 🔴 CRÍTICO | Anulación de venta: EGRESO compensatorio en sesión incorrecta |
| FB-004 | 🟠 ALTO | Dos versiones de registrar_saldo_inicial coexistiendo |
| FB-005 | 🟠 ALTO | SALDO_INICIAL infla ingresos en Dashboard (no filtrado) |
| FB-006 | 🟠 ALTO | RETIRO opaco: $520,379 sin categoría ni trazabilidad |
| FB-007 | 🟠 ALTO | Idempotencia parcial en transferencias (solo EGRESO tiene key) |
| FB-008 | 🟠 ALTO | resolver_diferencia_caja no actualiza sesiones_caja.diferencia_* |

### Pruebas NO VERIFICADAS

- FB-018: Envío de idempotency_key en todos los caminos de POS.jsx
- FB-019: Políticas RLS para AJUSTE_FALTANTE/SOBRANTE en movimientos_caja

---

**DETENTE — ESPERANDO INSTRUCCIONES PARA FASE C**

*Documento generado: 24 de Septiembre de 2026 — Auditoría Forense FASE B — Titan Grill*
*Metodología: Solo lectura. Sin correcciones. Sin modificaciones a código, datos, esquema o RLS.*
