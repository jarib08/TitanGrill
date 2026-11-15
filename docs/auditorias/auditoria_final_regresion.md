# AUDITORÍA FINAL DE REGRESIÓN — TITAN GRILL

## 1. Resumen ejecutivo
Se ha completado la auditoría final de regresión sobre el sistema Titan Grill. La corrección del hallazgo `ventas.descuento` fue aplicada exitosamente. Sin embargo, al intentar validar el flujo completo de anulación (hasta la aprobación real), se descubrió un **segundo hallazgo crítico** que impide completar las anulaciones.

## 2. Estado de roles
- **Trabajador:** Operativo. Autenticación exitosa. POS, Historial, Inventario (Mermas) y restricciones de anulación verificadas.
- **Administrador:** Operativo parcialmente. Dashboard carga correctamente tras la corrección del SELECT. Sin embargo, la aprobación de anulaciones falla por un conflicto entre el RPC y un CHECK constraint.

## 3. POS
**ESTADO: PASS**

## 4. Clientes/Fidelización
**ESTADO: PASS**

## 5. Anulaciones
**ESTADO: FAIL (RPC vs CHECK CONSTRAINT)**
- **Trabajador (Solicitud):** PASS. Solicitud creada con motivo "Prueba Fix Descuento".
- **Dashboard (Listado):** PASS. Las ventas cargan sin el error `ventas.descuento`. (**Hallazgo anterior RESUELTO**)
- **Administrador (Aprobación):** FAIL. El RPC `aprobar_anulacion_venta` falla con error de constraint.

## 6. Transferencias
**ESTADO: PASS**

## 7. Inventario
**ESTADO: PASS**

## 8. Mermas
**ESTADO: PASS**

## 9. Caja/Finanzas
**ESTADO: PASS**

## 10. Supabase
**ESTADO: FAIL (Conflicto RPC vs Constraint)**

## 11. Frontend
**ESTADO: PASS** (Tras corrección de `descuento/subtotal`)

## 12. Lint/Build
**ESTADO: PASS**
- `npm run lint`: 0 errores
- `npm run build`: Completado en ~28s

---

## 15. Matriz de regresión

| Área | Rol | Prueba | Resultado | Evidencia | Severidad |
| ---- | --- | ------ | --------- | --------- | --------- |
| **POS** | Trabajador | Venta Efectivo con cliente | PASS | Venta creada exitosamente | - |
| **Dashboard** | Admin | Listado de ventas | PASS | Carga sin error `descuento` | - |
| **Anulación (Solicitud)** | Trabajador | Crear solicitud | PASS | Estado PENDIENTE en DB | - |
| **Anulación (Aprobación)** | Admin | Aprobar solicitud | **FAIL** | Check constraint violation | **CRÍTICO** |
| **Integración** | Sistema | Lint y Build | PASS | Exit codes 0 | - |

---

## 16. Hallazgos

### Hallazgo 1 — ventas.descuento / ventas.subtotal (RESUELTO)
- **Severidad:** ALTA
- **Estado:** ✅ **RESUELTO**
- **Causa raíz:** El frontend solicitaba columnas `descuento` y `subtotal` que no existen en la tabla `ventas`.
- **Corrección:** Se eliminaron del `.select()` y se extraen desde el JSONB `detalles`.

---

### Hallazgo 2 — RPC `aprobar_anulacion_venta` vs CHECK constraints (NUEVO)
- **Severidad:** CRÍTICA
- **Estado:** ❌ **ABIERTO**

#### Causa raíz
El RPC `aprobar_anulacion_venta` implementa un modelo de "1 aprobación = ejecutada" donde, al recibir una solicitud en estado `PENDIENTE`, asigna al **mismo administrador** como `aprobador_1_id` y `aprobador_2_id` simultáneamente:

```sql
UPDATE public.solicitudes_anulacion_venta
SET estado = 'APROBACION_2',
    aprobador_1_id = v_admin_id,       -- ← mismo usuario
    aprobador_2_id = v_admin_id,       -- ← mismo usuario
    ...
```

Sin embargo, la tabla `solicitudes_anulacion_venta` tiene un CHECK constraint que lo prohíbe:

```sql
CHECK ((aprobador_2_id IS NULL) OR (aprobador_2_id <> aprobador_1_id))
```

#### Check constraints existentes

| Constraint | Regla |
|---|---|
| `chk_aprobador_1_not_solicitante` | aprobador_1 ≠ solicitante |
| `chk_aprobador_2_not_aprobador_1` | **aprobador_2 ≠ aprobador_1** |
| `chk_aprobador_2_not_solicitante` | aprobador_2 ≠ solicitante |

#### Error exacto
```
code: 23514
message: new row for relation "solicitudes_anulacion_venta" violates check constraint "chk_aprobador_2_not_aprobador_1"
```

#### Impacto
Ningún administrador puede aprobar una anulación de forma individual. El sistema requiere **dos administradores diferentes** para completar el flujo, pero el RPC intenta hacerlo con uno solo. Esto hace que **todas** las anulaciones sean imposibles de aprobar.

#### Estado de la solicitud de prueba tras el intento
- Solicitud: `PENDIENTE` (rollback automático por la violación)
- Venta: `COMPLETADA` (sin cambios)
- Aprobadores: ambos `null`

#### Evidencia
Llamada REST autenticada como `mdeviajob@gmail.com` (ADMINISTRADOR, id `6731b487-...`) contra el endpoint `/rest/v1/rpc/aprobar_anulacion_venta` con `p_solicitud_id: b952585d-0433-4668-b9e9-36bd39cb461f`. Respuesta: error 400 con violación de check constraint.

---

## Confirmación final del flujo de anulación

### Solicitud
- ID: `b952585d-0433-4668-b9e9-36bd39cb461f`
- Motivo: "Prueba Fix Descuento"
- Estado actual: `PENDIENTE`
- Venta asociada: `f21a3870-a50f-4e1f-91bd-a2369a2ce8e8` ($13,000, Salchipapa Sencilla)

### Aprobación cruzada
- Solicitante: `fbd7bacb-...` = `trabajador1@titangrill.com` (TRABAJADOR) — ✅ distinto al aprobador
- Aprobador: `6731b487-...` = `mdeviajob@gmail.com` (ADMINISTRADOR) — ✅ usuario autorizado
- Regla cruzada solicitante ≠ aprobador: ✅ cumplida
- **Pero el RPC falla internamente** al intentar asignar el mismo admin como aprobador_1 y aprobador_2

### Estado final
- Solicitud: `PENDIENTE` (sin cambio, rollback)
- Venta: `COMPLETADA` (sin cambio)
- Inventario: sin reversión (la anulación nunca se ejecutó)
- Caja: sin reversión (la anulación nunca se ejecutó)

### Reversión
No se produjo porque la anulación no pudo completarse.

### Evidencia Supabase
- Esquema de `ventas`: columnas `id, cliente_id, trabajador_id, fecha, estado, total, metodo_pago, detalles, sesion_id`
- Contenido de `detalles`: `{"items":[{"name":"Salchipapa Sencilla","price":13000,"quantity":1,...}],"discount":0,"subtotal":13000}`
- 14 movimientos de inventario tipo VENTA con cantidades negativas
- 1 movimiento de caja tipo INGRESO por $13,000 en EFECTIVO
- Check constraints confirmados via `pg_constraint`

### Resultado
**FAIL — La anulación no puede ser aprobada debido a un conflicto entre el RPC y los CHECK constraints de la base de datos.**

---

## 17. Riesgos pendientes
1. **CRÍTICO:** Ninguna anulación puede completarse en el sistema actual. El RPC necesita ser actualizado para respetar los check constraints (usar modelo de 2 aprobadores distintos, o eliminar la asignación duplicada de `aprobador_2_id` cuando solo hay 1 aprobador).

---

## 18. VEREDICTO FINAL

### **FAIL — Incompatibilidad de esquema todavía presente**
El hallazgo del SELECT (`ventas.descuento`) fue resuelto exitosamente. Sin embargo, se descubrió un nuevo hallazgo CRÍTICO: el RPC `aprobar_anulacion_venta` es incompatible con los CHECK constraints de la tabla `solicitudes_anulacion_venta`, haciendo imposible aprobar cualquier anulación. Esto requiere corrección antes de considerar el sistema listo para producción.
