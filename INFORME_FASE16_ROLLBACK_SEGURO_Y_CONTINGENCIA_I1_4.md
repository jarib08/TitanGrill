# INFORME FASE 16 — AUDITORÍA DE ROLLBACK SEGURO Y CONTINGENCIA OPERATIVA DE I1.4

> **Proyecto:** Titan Grill  
> **Fecha:** 10 de Octubre, 2026  
> **Rama:** `audit/titan-grill-forensic-handoff`  
> **HEAD:** `60cd590fdec62b0ba0f0bb3e81a1d44227d692a0`  
> **Proyecto Supabase ID:** `[PROJECT_REF_REDACTADO]`  
> **Migración Candidata:** `supabase/migrations/20261010_i1_4_recibir_compra_definitiva_v2.sql`  
> **SHA-256 Esperado e Intacto:** `DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5`  
> **Dictamen Final:** `LISTA PARA SOLICITAR AUTORIZACIÓN`

---

## 1. CONFIRMACIÓN EXPLÍCITA DE SEGURIDAD Y ESTADO GIT

Se confirma de manera categórica que durante la Fase 16 **NO se ejecutó ninguna migración, escritura DDL/DML o llamada RPC mutante** en la base de datos de producción de Supabase:
- `0` escrituras realizadas en producción.
- **Branch:** `audit/titan-grill-forensic-handoff`
- **HEAD Commit:** `60cd590fdec62b0ba0f0bb3e81a1d44227d692a0`
- **Hashes SHA-256 de las Migraciones:**
  - `I1.1`: `0ADC9DB3843F665F0D1DB93D54DA07E124F0FC6F64583181F2587E8495A7F216`
  - `I1.2`: `0077AF7E97B8773002BEBCBE4C78B56B3F5A9374C755D2E1000F31467D5AC429`
  - `I1.3`: `EB42C68FCB3CF52558A345A57ED5B086C94A508BC69CDEA187F27AF59A1EEF01`
  - `I1.4`: `DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5`

---

## 2. AUDITORÍA DE DEFECTOS EN LA VERSIÓN ANTERIOR (OID 101538)

Al contrastar la versión anterior en producción (oid 101538) con `I1.4`, se identificaron los siguientes defectos críticos de negocio y seguridad en el código antiguo:

1. **Usurpación / Asignación Cruzada de Cajas de Turno:**
   - *Código Antiguo (oid 101538):*
     `SELECT id INTO v_sesion_id FROM public.sesiones_caja WHERE estado = 'ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1;`
   - *Defecto:* Asignaba los egresos en efectivo a la *última caja abierta en el sistema*, independientemente de qué trabajador la hubiera abierto. Si el trabajador A abrió caja a las 8:00 AM y el trabajador B procesa una compra a las 2:00 PM, el egreso se imputaba a la caja de A.
   - *Solución en I1.4:* `v_sesion_id := public.fn_get_active_session(auth.uid());` vincula el egreso exclusivamente a la sesión del trabajador autenticado.

2. **Falta de Guarda Obligatoria de Caja para Pagos en Efectivo:**
   - *Código Antiguo:* No exigía sesión abierta propia para compras pagadas en efectivo.
   - *Solución en I1.4:* Bloquea las compras en `EFECTIVO` si el trabajador no tiene una sesión de caja abierta (`v_sesion_id IS NULL`), asegurando la consistencia del dinero físico.

3. **Sobrecarga Legacy Ambigua de 2 Parámetros (oid 100711):**
   - *Código Antiguo:* Permitía invocaciones sin `p_idempotency_key`, sin registrar snapshots de costos ni validar la sesión de caja del trabajador.
   - *Solución en I1.4:* Elimina `recibir_compra(uuid, text)` y canaliza el 100% de las llamadas a la función de 3 parámetros con valores predeterminados `DEFAULT`.

---

## 3. EVALUACIÓN DE RIESGOS DE UN ROLLBACK TRADICIONAL

Si se realizara un rollback ingenuo reinstalando el DDL anterior (oid 101538 & 100711):
1. **Reintroducción del Bug de Usurpación:** Las nuevas compras pagadas en efectivo volverían a asignarse indiscriminadamente a la última caja abierta de cualquier trabajador.
2. **Incompatibilidad con Restricción de Trazabilidad:** Si se intentara revertir a las versiones intermedias I1.2 o I1.3, las recepciones de compras fallarían con error de base de datos debido a la restricción `chk_movimientos_compra_trazabilidad` que exige `compra_id IS NOT NULL`.
3. **Conclusión:** Reinstalar el código de la función anterior es una **medida de emergencia técnica extrema** y NO debe usarse como procedimiento habitual. En caso de fallos menores post-despliegue, es técnicamente superior aplicar un **Hotfix en caliente (Migración I1.5)**.

---

## 4. ALTERNATIVAS DE CONTINGENCIA OPERATIVA

| Opción | Descripción | Riesgo / Evaluación | Recomendación |
| :--- | :--- | :--- | :---: |
| **Opción A (Rollback DDL Total)** | Reinstalar oid 101538 y oid 100711 | Reintroduce la asignación cruzada de cajas de turno. | Solo para fallos bloqueantes de runtime |
| **Opción B (Hotfix I1.5)** | Crear migración correctiva `I1.5` | Conserva el aislamiento por trabajador de `I1.4` y corrige el caso puntual. | **RECOMENDADA** |
| **Opción C (Modo Degradado en UI)** | Deshabilitar botón de recepción en UI | Cero riesgo en BD; previene compras con error sin alterar datos. | **CONTINGENCIA UI** |

---

## 5. DIFERENCIACIÓN: REVERSIÓN DE CÓDIGO VS. REPARACIÓN DE DATOS

Se establecen 3 escenarios operativos post-despliegue:

1. **Escenario A: Aborto antes de `COMMIT` (Fallo en la transacción de despliegue)**
   - El bloque `BEGIN; ... COMMIT;` falla. PostgreSQL realiza un `ROLLBACK` automático. El código y los datos quedan 100% intactos en su estado original.

2. **Escenario B: `COMMIT` exitoso pero falla la validación inicial (0 compras procesadas)**
   - Se ejecutó el DDL pero aún ninguna compra ha sido procesada con `I1.4`. Restablecer la función anterior vía script DDL es 100% seguro y libre de inconsistencias financieras.

3. **Escenario C: `I1.4` procesó compras en producción antes de detectar una anomalía**
   - **Regla Inviolable:** Cambiar o restaurar la función SQL **NO modifica ni elimina** las compras, egresos o movimientos de inventario que ya fueron procesados.
   - **Reparación de Datos:** Queda strictly prohibido ejecutar `DELETE` o `TRUNCATE` en `movimientos_caja` o `movimientos_inventario`. Cualquier ajuste debe realizarse mediante notas de ajuste contable auditadas y aprobadas por el propietario.

---

## 6. CRITERIOS OBJETIVOS PARA ABORTAR EL DESPLIEGUE

El despliegue transaccional debe abortarse de inmediato si se cumple cualquiera de estos criterios:
1. La firma obtenida en la inspección previa difiere de las sobrecargas oid 101538 / oid 100711.
2. La sentencia DDL devuelve cualquier error de sintaxis o violación de restricción durante la transacción.
3. Tras ejecutar `NOTIFY pgrst, 'reload schema';`, la función `recibir_compra` retorna un error HTTP 400 (`PGRST202` ambigüedad) en la primera prueba de humo de lectura en el frontend.

---

## 7. DICTAMEN FINAL

### `LISTA PARA SOLICITAR AUTORIZACIÓN`

**Justificación:**
1. Se analizaron y documentaron los defectos del código anterior (oid 101538) y las alternativas de contingencia operativa.
2. Se diferenció claramente la reversión del código DDL frente al tratamiento de datos financieros persistidos.
3. Se fijaron los criterios objetivos de abortar y el protocolo de diagnóstico.
4. **No se realizaron escrituras en producción durante la Fase 16.**

---
*Fin del Informe Fase 16.*
