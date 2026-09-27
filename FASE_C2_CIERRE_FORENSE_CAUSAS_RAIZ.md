# FASE C.2 — CIERRE FORENSE Y CAUSAS RAÍZ
**Titan Grill — Sistema Operativo Gastronómico**  
**Fecha de Ejecución:** 24 de Septiembre de 2026  
**Tipo de Auditoría:** CIERRE FORENSE, SÍNTESIS DE CAUSALIDAD Y CONSOLIDACIÓN READ-ONLY  
**Entorno Verificado:** Supabase PostgreSQL 17.6.1 Live Production (`mbyjehhplruoqlgphfvw`) + Vite 7 (React 19)  
**Documentos Auditados:**  
- [FASE_C_AUDITORIA_INVENTARIO_COMPRAS.md](file:///e:/Documents/titan_grill/FASE_C_AUDITORIA_INVENTARIO_COMPRAS.md)  
- [FASE_C1_VALIDACION_HALLAZGOS_INVENTARIO_COMPRAS.md](file:///e:/Documents/titan_grill/FASE_C1_VALIDACION_HALLAZGOS_INVENTARIO_COMPRAS.md)  
- [FASE_B1_VALIDACION_HALLAZGOS_CRITICOS.md](file:///e:/Documents/titan_grill/FASE_B1_VALIDACION_HALLAZGOS_CRITICOS.md)  
- [TITAN_GRILL_FUENTE_DE_LA_VERDAD.md](file:///e:/Documents/titan_grill/TITAN_GRILL_FUENTE_DE_LA_VERDAD.md)  
- [TITAN_GRILL_INVARIANTES_FINANCIERAS.md](file:///e:/Documents/titan_grill/TITAN_GRILL_INVARIANTES_FINANCIERAS.md)  
- [TITAN_GRILL_MATRIZ_INTEGRIDAD.md](file:///e:/Documents/titan_grill/TITAN_GRILL_MATRIZ_INTEGRIDAD.md)  
- [TITAN_GRILL_MATRIZ_RPC.md](file:///e:/Documents/titan_grill/TITAN_GRILL_MATRIZ_RPC.md)  

---

## 1. OBJETIVO

El presente documento constituye el **Cierre Forense Definitivo de la Auditoría de Inventario, Compras e Integridad Financiera** de Titan Grill. Su propósito es consolidar, desduplicar y establecer la cadena de causalidad técnica de los 16 hallazgos reportados a lo largo de las FASES B.1, C y C.1, distinguiendo taxativamente entre **Causas Raíz**, **Defectos Técnicos**, **Consecuencias**, **Síntomas**, **Riesgos Potenciales** y **Anomalías Históricas**.

---

## 2. ALCANCE Y REGLA DE SOLO LECTURA

### Modo 100% Solo Lectura Certificado:
- **Cero mutaciones:** Cero sentencias `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`. Cero ejecuciones de RPCs mutadoras.
- **Entorno real verificado:** Base de datos activa de producción con 99 ventas, 969 movimientos de inventario, 51 insumos, 13 productos, 42 fórmulas de recetas, 1 compra histórica con 3 detalles y 120 movimientos de caja.
- **Cero parches en esta fase:** Ningún archivo de código funcional, script SQL ni parámetro de producción fue alterado.

---

## 3. FUENTES ANALIZADAS Y METODOLOGÍA

La investigación forense se sustentó en la triangulación estricta de:
1. **Modelado Causal Inverso:** Agrupación de síntomas y hallazgos hacia sus abstracciones arquitectónicas de origen.
2. **Reconciliación Cuantitativa Desduplicada:** Auditoría de impacto financiero sin doble contabilización.
3. **Análisis de Aislamiento de Transacciones:** Evaluación estática del nivel `READ COMMITTED` y bloqueos de PostgreSQL 17.6.1.

---

## 4. ESTADO FINAL DE LOS HALLAZGOS AUDITADOS

| ID Original | Título Sintético | Categoría C.2 | Severidad Final | Causa Raíz Asociada | Solapamiento / Absorción |
|---|---|---|---|---|---|
| **FC-001** | Ausencia de `FOR UPDATE` en `recibir_compra` y `anular_compra` | `CONFIRMADO — CAUSA RAÍZ` | 🔴 CRÍTICO | **CR-01:** Ausencia de Bloqueos Pesimistas e Idempotencia en PL/pgSQL | Absorbe y complementa a `FC1-NEW-001`. |
| **FC-002** | Egresos de compras con `sesion_id = NULL` (FB-002) | `CONFIRMADO — CAUSA RAÍZ` | 🔴 CRÍTICO | **CR-02:** Desacople Arquitectónico entre Caja Central y Arqueo de Turno | Absorbe el hallazgo heredado `FB-002`. |
| **FC-003** | Distorsión de COGS por omisión de `ANULACION_VENTA` en Dashboard | `CONFIRMADO — CONSECUENCIA` | 🔴 CRÍTICO | **CR-03:** Omisión de Reversiones y Snapshot de Costos en Reporting | Síntoma directo de cálculo incompleto en frontend. |
| **FC-004** | Recálculo retroactivo del costo histórico de ventas (COGS) | `CONFIRMADO — CAUSA RAÍZ` | 🟠 ALTO | **CR-04:** Inexistencia de Snapshot Histórico de Costo en Kardex | Causa raíz de la alteración retroactiva del P&L. |
| **FC-005** | Ajuste manual de stock en Frontend no atómico | `CONFIRMADO — CAUSA RAÍZ` | 🟠 ALTO | **CR-05:** Mutaciones Directas Multi-Request Cliente-Servidor | Causa raíz de desincronización kardex/stock en UI. |
| **FC-006** | Desacoplamiento entre `stock_actual` y $\sum \text{kardex}$ | `CONFIRMADO — ANOMALÍA HISTÓRICA` | 🟡 MEDIO | **CR-05:** Mutaciones Directas Multi-Request Cliente-Servidor | Consecuencia histórica de cargas sin kardex. |
| **FC-007** | `anular_compra` clasifica reversión como `'MERMA'` | `CONFIRMADO — DEFECTO TÉCNICO` | 🟡 MEDIO | **CR-06:** Modelado Semántico Incorrecto en Reversiones | Defecto de diseño sin pérdida monetaria directa. |
| **FC-008** | Inexistencia de índices en Foreign Keys de kardex y compras | `CONFIRMADO — RIESGO DERIVADO` | 🟡 MEDIO | **CR-07:** Incompleitud en Diseño Físico de Base de Datos | Riesgo de rendimiento futuro (Seq Scan). |
| **FC-009** | Pre-validación de stock en `registrar_venta` sin lock pesimista | `CONFIRMADO — CONSECUENCIA` | 🟡 MEDIO | **CR-01:** Ausencia de Bloqueos Pesimistas e Idempotencia en PL/pgSQL | Síntoma de falta de lock; PostgreSQL frena stock negativo. |
| **FC-010** | El POS no consulta ni visualiza stock disponible | `CONFIRMADO — SÍNTOMA` | 🟢 BAJO | **CR-08:** Desconexión Operativa de Inventario en Frontend POS | Defecto de UX en el punto de venta. |
| **FC1-NEW-001** | Omisión de estado en `WHERE` del `UPDATE` de compras | `ABSORBIDO EN FC-001` | 🔴 CRÍTICO | **CR-01:** Ausencia de Bloqueos Pesimistas e Idempotencia en PL/pgSQL | Absorbe detalle técnico dentro de `FC-001`. |
| **FC1-NEW-002** | Omisión silenciosa de insumos inactivos en recetas | `CONFIRMADO — DEFECTO TÉCNICO` | 🟡 MEDIO | **CR-09:** Falta de Validación Server-Side en Filtros de Insumo | Defecto de integridad de receta en ventas. |
| **FC1-NEW-003** | Entrada manual +271 con motivo 'compra' sin `compra_id` | `CONFIRMADO — CONSECUENCIA` | 🟡 MEDIO | **CR-05:** Mutaciones Directas Multi-Request Cliente-Servidor | Síntoma de falta de restricciones en motivo 'compra'. |

---

## 5. MATRIZ DE CAUSAS RAÍZ IDENTIFICADAS

Se determinaron **9 Causas Raíz Estructurales** que originan la totalidad de los hallazgos:

| ID Causa Raíz | Definición Arquitectónica | Hallazgos Originados / Afectados | Subsistemas Afectados | Impacto Real Demostrado | Impacto Potencial |
|---|---|---|---|---|---|
| **CR-01** | Ausencia de bloqueos pesimistas (`FOR UPDATE`) y de cláusulas de estado idempotentes en UPDATEs PL/pgSQL | `FC-001`, `FC-009`, `FC1-NEW-001` | Compras, Inventario, Caja, Ventas | Cero duplicados en BD actual | Duplicación masiva por doble clic o retry |
| **CR-02** | Desacople arquitectónico entre compras institucionales y la sesión de caja del arqueo de turno | `FC-002`, `FB-002` | Compras, Caja, Arqueos, Dashboard | **$38,650 COP** en movimiento `d6f798e9` con `sesion_id = NULL` | Descuadre en gaveta física si se paga en efectivo |
| **CR-03** | Cálculo de agregaciones financieras en Frontend ignorando tipos de movimiento de reversión | `FC-003` | COGS, Dashboard, Rentabilidad | **$11,541 COP** de sobrecosto en COGS por ventas `0ea5b67f` y `c207bbb1` | Utilidad Bruta permanente deprimida |
| **CR-04** | Inexistencia de congelamiento de costo unitario (`snapshot`) en la tabla `movimientos_inventario` | `FC-004` | Kardex, Costos, Rentabilidad, Dashboard | 117 salidas de venta recalculadas al precio de compra posterior | Pérdida total de trazabilidad de márgenes históricos |
| **CR-05** | Mutaciones directas de tablas maestras mediante peticiones REST cliente-servidor sin transacción backend | `FC-005`, `FC-006`, `FC1-NEW-003` | Inventario, Kardex, Dashboard UI | Palillo burger (+89) y Pan Burger (+5); Entrada +271 lechuga | Corrupción silenciosa de kardex y race conditions |
| **CR-06** | Clasificación semántica incorrecta de reversiones operativas como pérdidas o mermas en PL/pgSQL | `FC-007` | Inventario, Mermas, Compras | Reversión de compra etiquetada como `'MERMA'` | Distorsión de métricas de desperdicios en cocina |
| **CR-07** | Ausencia de índices btree sobre claves foráneas en el esquema físico PostgreSQL | `FC-008` | Base de Datos, Performance | Cero latencia actual (969 filas) | Degeneración en Seq Scan al escalar tabla kardex |
| **CR-08** | Consulta de catálogo POS aislada de recetas y disponibilidades físicas de insumos | `FC-010` | POS Frontend, Operativa | Fricción al cobrar mercancía agotada | Rechazos imprevistos tras presionar botón cobro |
| **CR-09** | Inexistencia de validación de integridad cuando un insumo de receta es desactivado | `FC1-NEW-002` | Ventas, Recetas, Inventario | Venta de Titán Burger sin descontar Tomate (inactivo, stock 0) | Consumo fantasma e invulnerabilidad de recetas |

---

## 6. ÁRBOL / GRAFO CAUSAL INTEGRADO

```text
                               ┌──────────────────────────────────────────────────────────┐
                               │                    CAUSAS RAÍZ (CR)                      │
                               └──────────────────────────────────────────────────────────┘
                                 │            │            │            │            │
         ┌───────────────────────┘            │            │            │            └───────────────────────┐
         ▼                                    ▼            ▼            ▼                                    ▼
   ┌───────────┐                        ┌───────────┐┌───────────┐┌───────────┐                        ┌───────────┐
   │   CR-01   │                        │   CR-02   ││   CR-03   ││   CR-04   │                        │   CR-05   │
   └───────────┘                        └───────────┘└───────────┘└───────────┘                        └───────────┘
         │                                    │            │            │                                    │
         ▼                                    ▼            ▼            ▼                                    ▼
┌──────────────────┐                   ┌───────────┐┌───────────┐┌───────────┐                        ┌───────────────┐
│ DEFECTO TÉCNICO  │                   │ DEFECTO   ││ DEFECTO   ││ DEFECTO   │                        │ DEFECTO       │
│  Falta de Lock   │                   │ Desacople ││ Query UI  ││ No Costo  │                        │ Non-Atomic UI │
│   PL/pgSQL       │                   │  Sesión   ││   COGS    ││ en Kardex │                        │   Mutations   │
└──────────────────┘                   └───────────┘└───────────┘└───────────┘                        └───────────────┘
         │                                    │            │            │                                    │
         ▼                                    ▼            ▼            ▼                                    ▼
┌──────────────────┐                   ┌───────────┐┌───────────┐┌───────────┐                        ┌───────────────┐
│ HALLAZGO / SÍNTOM│                   │ HALLAZGO  ││ HALLAZGO  ││ HALLAZGO  │                        │ HALLAZGOS     │
│FC-001 / FC1-NEW-1│                   │  FC-002   ││  FC-003   ││  FC-004   │                        │FC-005/006/NEW3│
└──────────────────┘                   └───────────┘└───────────┘└───────────┘                        └───────────────┘
         │                                    │            │            │                                    │
         ▼                                    ▼            ▼            ▼                                    ▼
┌──────────────────┐                   ┌───────────┐┌───────────┐┌───────────┐                        ┌───────────────┐
│ IMPACTO POTENCIAL│                   │ IMPACTO   ││ IMPACTO   ││ IMPACTO   │                        │ IMPACTO REAL  │
│ Doble Compra /   │                   │ REAL      ││ REAL      ││ REAL      │                        │ Descuadres    │
│ Doble Egreso     │                   │ $38.650   ││ $11.541   ││ 117 Sales │                        │ Palillo/Pan   │
│                  │                   │ NULL Ses. ││ Inflado   ││ Recalc.   │                        │ +271 Lechuga  │
└──────────────────┘                   └───────────┘└───────────┘└───────────┘                        └───────────────┘
```

---

## 7. ANÁLISIS ESPECÍFICO DE CONFLICTOS Y SOLAPAMIENTOS

### 7.1 Solapamiento FC-001 y FC1-NEW-001 (Absorción Confirmada)
- **Análisis:** FC-001 señala la ausencia de `FOR UPDATE` en la lectura inicial. FC1-NEW-001 señala que el `UPDATE` posterior carece de `AND estado = 'BORRADOR'`.
- **Dictamen C.2:** Ambos hallazgos describen exactamente el mismo fallo de idempotencia concurrente bajo el motor PL/pgSQL. **FC1-NEW-001 se absorbe formalmente dentro de FC-001** como un detalle de su causa raíz (**CR-01**).

### 7.2 Relación entre FB-002, FC-002 y FC1-NEW-003 (Trazabilidad Financiera)
- **Análisis:**
  - FB-002/FC-002 identificó que el egreso de $38,650 COP posee `sesion_id = NULL`.
  - FC1-NEW-003 identificó la entrada manual `7c402a48` (+271 Lechuga) con `motivo = 'compra'` y `compra_id = NULL`.
- **Dictamen C.2:** Comparten la falla de control interno en UI/RPC que permite registrar eventos etiquetados como "compra" sin vincular el par completo (orden de compra, movimiento de caja con sesión y entrada de kardex).

### 7.3 Solapamiento y Desduplicación Cuantitativa entre FC-003 y FC-004
- **Análisis:** FC-003 demuestra un COGS inflado en $11,541.00 COP por omisión de ventas anuladas. FC-004 demuestra recálculo retroactivo por cambio de costo en insumos.
- **Evaluación de Solapamiento:** Las dos ventas anuladas (`0ea5b67f` y `c207bbb1`) correspondían al producto `Vulcano Dog` cuyo costo ($5,770.50 COP c/u) se calculó con los insumos a su costo actual. Si se corrige FC-003 excluyendo los 18 movimientos de esas ventas anuladas, dichos movimientos **desaparecen por completo del COGS del Dashboard**, anulando cualquier solapamiento de costo retroactivo sobre ellos.
- **Desduplicación:** Las dos cifras de impacto ($11,541.00 COP de COGS inflado por anulaciones y el recálculo retroactivo de las 117 ventas anteriores) corresponden a **efectos independientes** y no se están contando dos veces.

---

## 8. RECONCILIACIÓN CUANTITATIVA Y MATRIZ "NO DOBLE CONTAR"

| Cifra / Cuantificación | Mencionada en | ¿Es el mismo impacto? | Valor exacto | ¿Contabilizar una vez? | Justificación Forense |
|---|---|---|---|---|---|
| **$38,650.00 COP** | FB-002, FC-002 | **SÍ** | $38,650.00 COP | **SÍ** | Corresponde al valor único de la compra `45ed9db2` cuyo egreso `d6f798e9` fue registrado con `sesion_id = NULL`. No hay pérdida de dinero; es un egreso real desvinculado del arqueo de turno. |
| **$11,541.00 COP** | FC-003 | **NO** | $11,541.00 COP | **SÍ** | Sobrecosto exacto en el COGS del Dashboard debido a 2 ventas anuladas ($5,770.50 × 2). Representa una distorsión pura de reporting de Utilidad Bruta. |
| **117 Movimientos** | FC-004 | **NO** | 117 registros de venta | **SÍ** | Número de salidas de inventario históricas previas a la compra `45ed9db2` cuyo COGS se recalculó retroactivamente. |
| **+89 Unidades** | FC-006 | **NO** | +89 Palillo burger | **SÍ** | Saldo inicial inyectado directamente en `insumos.stock_actual` sin asiento en el kardex. Anomalía estática de carga inicial. |
| **+5 Unidades** | FC-006 | **NO** | +5 Pan Burger | **SÍ** | Saldo inicial inyectado en `insumos.stock_actual` sin asiento en kardex. Anomalía estática de carga inicial. |
| **+271 Unidades** | FC1-NEW-003 | **NO** | +271 Lechuga Crespa | **SÍ** | Carga manual de inventario realizada en UI con texto libre `motivo = 'compra'` sin orden de compra ni egreso de caja. |

---

## 9. MATRIZ DE INTEGRIDAD VS REPORTING

| ID | Integridad de Datos | Integridad Financiera | Concurrencia | Contabilidad / COGS | Reporting | Performance | UX | Control Interno |
|---|---|---|---|---|---|---|---|---|
| **FC-001** | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | ⚪ | ⚪ | 🔴 |
| **FC-002** | ⚪ | 🔴 | ⚪ | 🔴 | 🔴 | ⚪ | ⚪ | 🔴 |
| **FC-003** | ⚪ | ⚪ | ⚪ | 🔴 | 🔴 | ⚪ | ⚪ | ⚪ |
| **FC-004** | 🔴 | 🔴 | ⚪ | 🔴 | 🔴 | ⚪ | ⚪ | 🔴 |
| **FC-005** | 🔴 | ⚪ | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | 🔴 |
| **FC-006** | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | 🔴 |
| **FC-007** | 🔴 | ⚪ | ⚪ | 🔴 | 🔴 | ⚪ | ⚪ | 🔴 |
| **FC-008** | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | 🔴 | ⚪ | ⚪ |
| **FC-009** | ⚪ | ⚪ | 🔴 | ⚪ | ⚪ | ⚪ | 🔴 | ⚪ |
| **FC-010** | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | 🔴 | ⚪ |
| **FC1-NEW-002**| 🔴 | ⚪ | ⚪ | 🔴 | 🔴 | ⚪ | ⚪ | 🔴 |
| **FC1-NEW-003**| 🔴 | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | 🔴 |

---

## 10. RECOMENDACIONES ARQUITECTÓNICAS PARA LA FUTURA FASE D

> [!IMPORTANT]
> Estas recomendaciones son exclusivamente conceptuales para guiar la futura FASE D de corrección. **NO deben implementarse durante esta fase de auditoría.**

1. **Intervención sobre CR-01 (FC-001 / FC1-NEW-001 / FC-009):**  
   Incorporar `FOR UPDATE` en las lecturas de estado de compras e insumos dentro de `recibir_compra`, `anular_compra` y `registrar_venta`. Añadir la condición explícita `AND estado = 'BORRADOR'` en el `WHERE` de la sentencia `UPDATE public.compras`.
2. **Intervención sobre CR-02 (FC-002 / FB-002):**  
   Modificar la firma de `recibir_compra` y `anular_compra` para aceptar un parámetro `p_sesion_id`. Si el pago es en `EFECTIVO`, vincularlo a la sesión activa; si es `BANCOLOMBIA`/`NEQUI` central, marcarlo con bandera de cuenta central para reconciliación bancaria fuera del arqueo del trabajador.
3. **Intervención sobre CR-03 y CR-04 (FC-003 / FC-004):**  
   - Agregar columnas `costo_unitario_snapshot` y `costo_total_snapshot` en la tabla `movimientos_inventario`.
   - Modificar la consulta en [AdminDashboard.jsx](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L339) para que descuente los movimientos con `tipo = 'ANULACION_VENTA'` y excluya los de ventas con `estado = 'ANULADA'`, evaluando el COGS desde el snapshot del kardex.
4. **Intervención sobre CR-05 (FC-005 / FC-006 / FC1-NEW-003):**  
   Eliminar las actualizaciones directas REST a la tabla `insumos` desde React. Canalizar todos los ajustes manuales a través de la función RPC transaccional `registrar_carga_masiva_inventario` asegurando validación atómica en el servidor.
5. **Intervención sobre CR-09 (FC1-NEW-002):**  
   Ajustar `registrar_venta` para que valide la existencia de recetas completas activas y no omita silenciosamente los insumos inactivos.

---

## 11. CONFIRMACIÓN DE CONTROL DE SEGURIDAD

Se certifica el estado final de la base de datos y el código:
- Código funcional modificado: **0**
- Sentencias DDL / DML ejecutadas: **0**
- Modificaciones en producción: **NO**
- Datos de producción alterados: **NO**
- FASE D ejecutada: **NO**
- Verificación de sanidad: `npm run lint` (code 0) y `npm run build` (code 0).

---

## 12. CONCLUSIÓN FORENSE FINAL

La FASE C.2 concluye que el subsistema de inventarios y compras de Titan Grill está afectado por **9 Causas Raíz Estructurales**, las cuales explican la totalidad de los 16 hallazgos detectados. 

El impacto real comprobado se sintetiza en:
1. **$38,650 COP** de egreso de compra desvinculado de la sesión de caja del cajero.
2. **$11,541 COP** de distorsión en el COGS del Dashboard que deprime artificialmente la Utilidad Bruta.
3. **117 ventas históricas** cuyo costo de venta fue alterado retroactivamente.
4. **+94 unidades** de desfase estático en inventario por cargas iniciales sin kardex.

**ESTADO FINAL DE LA AUDITORÍA DE INVENTARIO Y COMPRAS:** ✅ **FASE C.2 COMPLETADA Y CERRADA. SISTEMA LISTO PARA PLANIFICAR FASE D DE CORRECCIÓN.**
