# TRASPASO TÉCNICO — TITAN GRILL

**Propósito:** Punto de continuidad para el siguiente desarrollador.
**Fecha de inspección:** 20 de octubre de 2026 (hora local: 13:06 -05:00)
**Método:** Solo lectura. Sin SQL ejecutado, sin conexión a producción.

---

## 1. ESTADO DEL REPOSITORIO

| Elemento | Valor |
|---|---|
| Repositorio remoto | `https://github.com/jarib08/TitanGrill.git` |
| Rama actual local | `audit/titan-grill-forensic-handoff` |
| HEAD actual | `ec72b28ff6178a788e4aa0c9f53aa1db82b5c0f7` |
| Último commit | `feat(purchases): implement I1.4 and cash session validation` (10-Oct-2026) |
| Ramas locales | `audit/titan-grill-forensic-handoff` (activa), `main`, `master` |
| Ramas remotas (caché) | `origin/main`, `origin/audit/titan-grill-forensic-handoff` |

**Archivo modificado (con seguimiento, NO staged):**
- `newpromt.md` — 368 inserciones, 70 eliminaciones. Es el archivo de trabajo del propietario. **No revertir.**

**Archivos sin seguimiento (untracked):**
- `INFORME_FASE10` a `INFORME_FASE39_*.md` — Informes históricos de auditoría
- `INFORME_FASE3D_CORRECCION_DOCUMENTAL_FORENSE.md` — **0 bytes**, vacío
- `opencode.json` — config MCP con project_ref de Supabase (sensible)
- `scratch/` — scripts de prueba locales y harness de 20 casos
- `supabase/migrations/20261010_i1_1_*.sql`, `i1_2_*.sql`, `i1_3_*.sql` — borradores intermedios (NO aplicar)

---

## 2. ARQUITECTURA

| Stack | Detalle |
|---|---|
| Framework | Vite 7 + React 19, JS/JSX sin TypeScript |
| Estilos | Tailwind CSS v4 |
| Backend | Supabase (PostgreSQL, RLS, SECURITY DEFINER RPCs) |
| Auth | Supabase Auth |
| Routing | React Router v7 |
| Puerto dev | 5173 |

**Componentes principales:**
- `src/components/AdminDashboard.jsx` — Panel administrativo (~7930 líneas)
- `src/components/POS.jsx` — Punto de venta (~2031 líneas)
- `src/lib/supabaseClient.js` — Cliente Supabase
- `supabase/migrations/` — Migraciones SQL versionadas

---

## 3. TRABAJO IMPLEMENTADO Y EVIDENCIA

### Caja y sesiones — CONFIRMADO EN CÓDIGO

- `abrir_caja(p_monto_apertura, p_apertura_nequi, p_apertura_bancolombia)`: Guard `fn_is_worker()`, crea sesión para `auth.uid()`. Fuente: `baseline:73-108`, Frontend: `POS.jsx:645`
- `cerrar_caja(...)`: Calcula esperado por método de pago. Frontend: `POS.jsx:669`
- `fn_get_active_session(p_trabajador_id uuid)`: Firma con argumento obligatorio. Fuente: `baseline:1130-1145`
- POS carga sesión activa con `sesiones_caja WHERE trabajador_id = auth.uid()` — CORRECTO

### Ventas — CONFIRMADO EN CÓDIGO

- `registrar_venta(...)`: idempotencia por fingerprint, FOR UPDATE ordenado, snapshot de costo inmutable por trigger `fn_immutable_cost_snapshot`

### Compras (I1.4) — CONFIRMADO EN CÓDIGO + PRUEBA LOCAL

- Frontend (`AdminDashboard.jsx:1800-1882`): flujo 3 pasos (INSERT compra → INSERT detalles → RPC recibir_compra)
- `20261010_i1_4_recibir_compra_definitiva_v2.sql`: usa `fn_get_active_session(auth.uid())`. EFECTIVO requiere sesión propia. NEQUI/BANCOLOMBIA → `sesion_id = NULL`
- **Pruebas locales:** `scratch/local_test_harness/` — **20/20 PASARON** (evidencia: `test_results.json`)
- **ADVERTENCIA:** Pruebas sobre base local. I1.4 **NO confirmada en producción** (VPS inaccesible)

### Gastos administrativos — CONFIRMADO EN CÓDIGO — DEFECTO CRÍTICO

- `crear_gasto(p_categoria_id, p_descripcion, p_monto, p_metodo_pago)`: Guard `fn_is_socio()`
- **DEFECTO:** Usa `WHERE estado = 'ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1` sin filtrar por usuario. Fuente: `baseline:961-964`

### Liquidaciones — CONFIRMADO EN CÓDIGO — DEFECTO ALTO

- `pagar_liquidacion(p_liquidacion_id, p_cuenta_origen, p_sesion_id DEFAULT NULL)`: Guard `fn_is_socio()`
- **DEFECTO:** Frontend nunca envía `p_sesion_id` → siempre roba la sesión más reciente. Fuente: `baseline:1422-1425`, Frontend: `AdminDashboard.jsx:1952`
- **DEFECTO:** Fallback ciego a socio aleatorio si `auth.uid()` es nulo

### Anulación de compras — CONFIRMADO EN CÓDIGO — DEFECTOS ALTOS

- `anular_compra(p_compra_id, p_motivo, p_idempotency_key DEFAULT NULL)`: Guard `fn_is_socio()`
- **DEFECTO 1:** INGRESO compensatorio en sesión arbitraria. Fuente: `baseline:297-300, 325`
- **DEFECTO 2:** No restaura `insumos.costo_unitario`. Fuente: `baseline:209-216`

### Inventario y costos — CONFIRMADO EN CÓDIGO

- Método: **Último Costo de Compra** (no Promedio Ponderado)
- Snapshots históricos en `movimientos_inventario` — inmutables
- COGS en `fn_estado_resultados`: suma `costo_total_historico` de movimientos VENTA

---

## 4. MIGRACIONES SQL

| Archivo | Git | Producción | Recomendación |
|---|---|---|---|
| `00000000000000_baseline_recuperado_de_produccion.sql` | Tracked | SÍ | MANTENER |
| `20260927_*` (f1_1 a f2_1, g1_1 a h1_2) | Tracked | PENDIENTE VALIDACIÓN | REVISIÓN HUMANA |
| `20261010_i1_4_recibir_compra_definitiva_v2.sql` | Tracked | NO CONFIRMADO | REVISIÓN HUMANA |
| `20261010_i1_1/i1_2/i1_3_*.sql` | **Untracked** | NO | **EXCLUIR** — borradores |

---

## 5. DEFECTOS CONOCIDOS

| ID | Gravedad | Función | Síntoma | Estado |
|---|---|---|---|---|
| D-01 | CRÍTICO | `crear_gasto` | Gasto atribuido al cajero más reciente | Sin corrección implementada |
| D-02 | CRÍTICO | `pagar_liquidacion` | Liquidación atribuida a sesión ajena | Sin corrección implementada |
| D-03 | ALTO | `anular_compra` | INGRESO ficticio en sesión arbitraria | Requiere decisión de negocio |
| D-04 | ALTO | `anular_compra` | `insumos.costo_unitario` no se restaura | Decisión aprobada — no implementada |
| D-05 | MEDIO | Frontend + `recibir_compra` | Borradores huérfanos si falla el RPC | Sin corrección implementada |
| D-06 | PENDIENTE | I1.4 | No confirmada en producción (VPS ETIMEDOUT) | Verificar en hPanel Hostinger |

---

## 6. INFORMES HISTÓRICOS

| Informe | Validez |
|---|---|
| `INFORME_FASE10` a `INFORME_FASE39_*.md` | DOCUMENTACIÓN HISTÓRICA — proceso de diseño, no estado actual del código |
| `INFORME_FASE3D_CORRECCION_DOCUMENTAL_FORENSE.md` | VACÍO — descartar |
| `scratch/local_test_harness/test_results.json` | CONFIRMADO POR PRUEBA LOCAL — 20/20 para I1.4 |
| `TITAN_GRILL_FUENTE_DE_VERDAD.md` | Relevante para arquitectura, puede estar desactualizado |
| `TITAN_GRILL_INVARIANTES_FINANCIERAS.md` | Relevante — invariantes financieras del sistema |

---

## 7. DECISIONES DE NEGOCIO APROBADAS

### Decisión 1 — Gastos y sesiones de caja

Registrar el origen real de los fondos. Nunca atribuir automáticamente a la caja de otro trabajador.
- EFECTIVO de cajero de turno → `sesion_id` del cajero
- EFECTIVO de socio sin caja propia → `sesion_id = NULL`
- NEQUI / BANCOLOMBIA → siempre `sesion_id = NULL`

### Decisión 2 — Anulaciones y reembolsos

Separar: (1) anulación operativa, (2) reversión de inventario, (3) devolución pendiente, (4) reembolso efectivo confirmado, (5) reembolso por transferencia, (6) nota de crédito.
**Principio:** Una anulación no demuestra que el dinero haya regresado.

### Decisión 3 — Restauración del costo

Al anular compra recibida: restaurar `insumos.costo_unitario` al último costo válido anterior.
No modificar snapshots históricos de ventas.

Estas son **decisiones aprobadas, no implementaciones existentes**.

---

## 8. PRÓXIMAS TAREAS (4 PAQUETES INDEPENDIENTES)

### Paquete A — Contratos de sesión (PRIORIDAD ALTA)
Erradicar `ORDER BY fecha_apertura DESC LIMIT 1` de `crear_gasto` y `pagar_liquidacion`.
Implementar reglas por método de pago.

### Paquete B — Anulaciones y reembolsos (PRIORIDAD ALTA)
Separar anulación contable del registro de reembolso en `anular_compra`.

### Paquete C — Restauración de costo unitario (PRIORIDAD MEDIA)
Restaurar `insumos.costo_unitario` desde historial de compras al anular.

### Paquete D — Pruebas de regresión (PRIORIDAD MEDIA)
Implementar suite: 2 cajeros simultáneos, socio sin caja propia, liquidación bancaria,
anulación con sesión cerrada, reintento de anulación.

**NO combinar los paquetes en una sola migración.**

---

## 9. RIESGOS

- No atribuir movimientos a cajas ajenas
- No simular reembolsos no recibidos
- No reescribir costos históricos (trigger inmutable los protege)
- No ejecutar migraciones sin autorización
- No publicar `opencode.json` (project_ref de Supabase)
- No publicar I1.1, I1.2, I1.3 (borradores)
- No sobrescribir `newpromt.md`
- No ejecutar `scratch/execute_prod_pre_migration_validation.mjs` sin revisar

---

## 10. INSTRUCCIONES PARA EL SIGUIENTE DESARROLLADOR

1. Ejecutar `git status` antes de cualquier cambio
2. No aplicar I1.4 a producción sin verificar el VPS
3. Leer el código fuente, no los informes (los informes describen el proceso)
4. Iniciar con el Paquete A — es la corrección más urgente y aislada
5. Cada paquete necesita pruebas antes de aplicarse a producción
6. El harness `scratch/local_test_harness/` es la plantilla para nuevas pruebas

---

## 11. PLAN DE RAMA Y PUBLICACIÓN — NO EJECUTADO

**Rama propuesta:** `handoff/titan-grill-continuidad-tecnica`
**Base:** `ec72b28ff6178a788e4aa0c9f53aa1db82b5c0f7`

### Tabla de archivos candidatos

| Archivo / Grupo | Categoría | Recomendación | Justificación |
|---|---|---|---|
| `src/` completo | A — Código versionado | **INCLUIR** | Código fuente principal |
| `supabase/migrations/` (tracked, sin i1_1/2/3) | A/C | **INCLUIR con revisión** | Migraciones versionadas |
| `supabase/migrations/rollback/` | A | **INCLUIR** | Rollbacks versionados |
| `newpromt.md` | B — Modificación local | **INCLUIR** | Estado actual de instrucciones |
| `TRASPASO_TECNICO_TITAN_GRILL.md` | D — Documentación | **INCLUIR** | Documento de continuidad |
| `TITAN_GRILL_*.md` versionados | D | **INCLUIR** | Ya en Git |
| `INFORME_FASE30` a `INFORME_FASE39_*.md` | E — Informes históricos | **REVISIÓN HUMANA** | Verificar utilidad y privacidad |
| `INFORME_FASE10` a `INFORME_FASE23_*.md` | E | **REVISIÓN HUMANA** | Proceso de diseño de I1.4 |
| `INFORME_CIERRE_TECNICO_I1_4.md` | E | **REVISIÓN HUMANA** | Verificar contenido |
| `scratch/local_test_harness/` | G — Tests | **REVISIÓN HUMANA** | Útil pero contiene IDs de base local |
| `scratch/*.mjs`, `*.cjs`, `*.sql` | G | **REVISIÓN HUMANA** | Algunos pueden conectarse a producción |
| `INFORME_FASE3D_CORRECCION_DOCUMENTAL_FORENSE.md` | E | **EXCLUIR** | 0 bytes, vacío |
| `opencode.json` | F — Config sensible | **EXCLUIR** | Contiene project_ref de Supabase |
| `.env` | F | **EXCLUIR** | Claves de entorno (no está en Git) |
| `supabase/migrations/20261010_i1_1/i1_2/i1_3_*.sql` | C | **EXCLUIR** | Borradores intermedios |
| `vite.config.js`, `package.json`, etc. | A | **INCLUIR** | Configuración de build |
| `AGENTS.md` | D | **INCLUIR** | Guía para agentes AI |

### Comandos Git propuestos — NO EJECUTADOS — requieren autorización

```bash
# 1. Crear rama nueva desde el HEAD actual
git branch handoff/titan-grill-continuidad-tecnica ec72b28ff6178a788e4aa0c9f53aa1db82b5c0f7

# 2. Cambiar a la nueva rama
git checkout handoff/titan-grill-continuidad-tecnica

# 3. Añadir documento de traspaso
git add TRASPASO_TECNICO_TITAN_GRILL.md

# 4. Añadir newpromt.md con las instrucciones actuales
git add newpromt.md

# 5. (PENDIENTE AUTORIZACIÓN) Añadir informes históricos aprobados
# git add INFORME_FASE30_INVESTIGACION_I1_4.md INFORME_FASE31_*.md ...

# 6. (PENDIENTE AUTORIZACIÓN) Añadir harness de pruebas
# git add scratch/local_test_harness/

# 7. Revisar el diff antes de confirmar
git diff --cached --stat

# 8. Crear el commit
git commit -m "docs(handoff): traspaso tecnico, auditoria financiera y plan de correccion"

# 9. Publicar en GitHub
git push origin handoff/titan-grill-continuidad-tecnica
```

---

## 12. CHECKLIST DE VALIDACIÓN ANTES DEL COMMIT

- [ ] Revisar `git diff --cached` completo
- [ ] Confirmar que `opencode.json` y `.env` están excluidos
- [ ] Confirmar que I1.1, I1.2, I1.3 están excluidos
- [ ] Verificar que `newpromt.md` se conserva tal como está
- [ ] Revisar informes históricos que se incluyan — sin datos reales de producción
- [ ] Decidir qué hacer con `test_results.json` (contiene IDs de base local)
- [ ] Confirmar nombre final de la rama con el propietario

---

## 13. ÚLTIMO ESTADO VERIFICADO

- **Fecha:** 20-Oct-2026, 13:06 -05:00
- **No verificado:** Estado de producción (VPS inaccesible), migraciones en DB remota, visibilidad de rama en GitHub
- **Confianza:** Alta para código fuente local. Baja para estado de producción.
