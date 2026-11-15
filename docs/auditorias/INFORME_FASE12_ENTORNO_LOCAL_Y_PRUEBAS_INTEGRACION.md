# INFORME FASE 12 — CONSTRUCCIÓN CONTROLADA DEL ENTORNO LOCAL DE PRUEBAS Y VALIDACIÓN DE INTEGRACIÓN

> **Proyecto:** Titan Grill  
> **Fecha:** 10 de Octubre, 2026  
> **Rama:** `audit/titan-grill-forensic-handoff`  
> **HEAD:** `60cd590fdec62b0ba0f0bb3e81a1d44227d692a0`  
> **Veredicto:** `APROBADA CON CONDICIONES`

---

## 1. ESTADO GIT INICIAL Y FINAL

| Métrica | Estado Inicial (Fase 11 -> 12) | Estado Final (Post-Fase 12) |
| :--- | :--- | :--- |
| **Branch** | `audit/titan-grill-forensic-handoff` | `audit/titan-grill-forensic-handoff` |
| **HEAD Commit** | `60cd590fdec62b0ba0f0bb3e81a1d44227d692a0` | `60cd590fdec62b0ba0f0bb3e81a1d44227d692a0` |
| **Modified Files** | `src/components/AdminDashboard.jsx`, `newpromt.md` | `src/components/AdminDashboard.jsx`, `newpromt.md` |
| **Untracked Files** | Informes Fase 10/11, migraciones I1.1, I1.2, I1.3 | + `INFORME_FASE12...`, migración `I1.4`, directorio `scratch/local_test_harness/` |
| **Commits Realizados** | `0` (Ningún commit) | `0` (Ningún commit) |

---

## 2. CONFIRMACIÓN DEL AISLAMIENTO LOCAL Y BASE DE DATOS UTILIZADA

- **Motor Local:** PostgreSQL 18.0 (x86_64-pc-windows-msvc, 64-bit).
- **Host de Conexión:** `localhost:5432` (Conexión TCP/IP explicita aislada, sin accesos a producción).
- **Base de Datos Creada:** `titan_grill_test` (Propietario: `styleos`).
- **Verificación de Seguridad:** Se verificó que `titan_grill_test` no contenía datos previos ni conexiones remotas. Todo el esquema fue construido desde cero con scripts DDL de aislamiento local.
- **Aislamiento Remoto:** Cero conexiones enviadas a Supabase Cloud / Producción.

---

## 3. AUDITORÍA DE LA MIGRACIÓN I1.3 Y DETECCIÓN DE HALLAZGOS (I1.4)

### 3.1 Análisis de I1.3
Durante la auditoría estática y de ejecución de `20261010_i1_3_recibir_compra_corregida_propuesta.sql`, se corroboró que:
1. Resuelve adecuadamente la ambigüedad trivaluada en la consulta de sesión de turno activa (`p_trabajador_id IS NOT NULL AND st.trabajador_id = p_trabajador_id AND st.estado = 'ABIERTA'`).
2. Implementa idempotencia limpia por `p_idempotency_key`.
3. Normaliza correctamente los métodos de pago (`EFECTIVO`, `TRANSFERENCIA`, `TARJETA`, `DATAFONO`).

### 3.2 Hallazgo Crítico Detectado en I1.3
Al ejecutar las pruebas en el motor PostgreSQL local, se identificó un **error de sintaxis en el INSERT de movimientos de inventario**:
```sql
-- Declaraba 8 columnas de destino:
INSERT INTO public.movimientos_inventario (
    insumo_id, tipo, cantidad, motivo, compra_id, usuario_id, costo_unitario_historico, costo_total_historico
)
-- Pero proveía únicamente 7 valores en el VALUES (faltaba p_compra_id):
VALUES (
    v_detail.insumo_id, 'ENTRADA_COMPRA', v_detail.cantidad, 'Recepción de compra',
    auth.uid(), v_costo_unitario_val, v_costo_total_val
);
```

### 3.3 Creación de Propuesta Corregida: I1.4
Sin modificar los archivos históricos (I1.1, I1.2, I1.3), se redactó la migración correctiva final:
- `supabase/migrations/20261010_i1_4_recibir_compra_definitiva_v2.sql`

En esta versión:
1. Se restituye `p_compra_id` en la posición 5 del `VALUES` de `movimientos_inventario`.
2. Se preserva íntegramente toda la lógica de resolución de turnos por trabajador de I1.3.

---

## 4. ARCHIVOS NUEVOS CREADOS

1. `supabase/migrations/20261010_i1_4_recibir_compra_definitiva_v2.sql` (Propuesta corregida v2).
2. `scratch/local_test_harness/01_init_db.sql` (Creación de base de datos aislada).
3. `scratch/local_test_harness/02_schema.sql` (Esquema DDL réplica local de tablas, tipos, secuencias e índices).
4. `scratch/local_test_harness/03_seed_data.sql` (Datos sintéticos: usuarios auth, insumos, compras borrador/recibidas, turnos).
5. `scratch/local_test_harness/runner.cjs` (Arnés automatizado de pruebas en Node.js que simula llamadas RPC PostgREST).

---

## 5. RESULTADOS DE LA EJECUCIÓN DE PRUEBAS (20 CASOS)

El ejecutor automatizado `runner.cjs` ejecutó la suite completa de 20 casos de integración sobre `titan_grill_test`:

| ID | Nombre del Caso | Resultado SQL | Estado de Verificación |
| :---: | :--- | :---: | :--- |
| **C01** | Método de Pago NULL | RECHAZADO | PASÓ (Retornó `success: false, message: 'El método de pago es requerido'`) |
| **C02** | Método de Pago Vacío / Espacios | RECHAZADO | PASÓ (Retornó `success: false, message: 'El método de pago es requerido'`) |
| **C03** | Método de Pago Inválido | RECHAZADO | PASÓ (Retornó `success: false, message: 'Método de pago no válido...'`) |
| **C04** | Método Válido con Espacios Laterales (`'  EFECTIVO  '`) | ACEPTADO | PASÓ (Normalizado a `EFECTIVO`, estado `RECIBIDA`) |
| **C05** | Compra Inexistente | RECHAZADO | PASÓ (Retornó `success: false, message: 'Compra no encontrada'`) |
| **C06** | Compra Ya Recibida Previamente | RECHAZADO | PASÓ (Retornó `success: false, message: 'La compra ya fue recibida anteriormente'`) |
| **C07** | Mapeo de Método `DATAFONO` | ACEPTADO | PASÓ (Normalizado a `DATAFONO`, estado `RECIBIDA`) |
| **C08** | Idempotencia: Repetición Misma Clave | RETORNO IDEMPOTENTE | PASÓ (Retorna resultado guardado sin duplicar caja/inventario) |
| **C09** | Idempotencia: Clave Diferente sobre Compra Recibida | RECHAZADO | PASÓ (Retornó `success: false`, previene re-procesamiento) |
| **C10** | Compra con Múltiples Insumos | ACEPTADO | PASÓ (Múltiples insumos actualizados y movimientos generados) |
| **C11** | Fallo Deliberado en Inventario (Atomicidad/Rollback) | ROLLBACK | PASÓ (Transacción abortada, cero cambios parciales en DB) |
| **C12** | Pago Efectivo con Sesión de Turno Abierta | ACEPTADO | PASÓ (Inserta movimiento en `movimientos_caja` con `caja_id`) |
| **C13** | Pago Efectivo SIN Sesión de Turno Abierta | RECHAZADO | PASÓ (Exige turno abierto para pagos en efectivo) |
| **C14** | Pago Bancario SIN Sesión de Turno | ACEPTADO | PASÓ (Procesa compra sin requerir turno, afecta tesorería) |
| **C15** | Pago Bancario CON Sesión de Turno | ACEPTADO | PASÓ (Procesa compra asociando trabajador pero sin impactar `movimientos_caja`) |
| **C16** | Sesión Abierta de OTRO Trabajador | ACEPTADO | PASÓ (Resuelve correctamente la sesión específica del trabajador que ejecuta) |
| **C17** | Firma RPC con Parámetros Opcionales Omisos | ACEPTADO | PASÓ (Default `p_trabajador_id = NULL` opera correctamente) |
| **C18** | Concurrencia Simultánea (Doble Recepción Paralela) | BLOQUEO SAFE | PASÓ (`FOR UPDATE` bloquea la segunda transacción hasta finalizar la primera) |
| **C19** | RLS / Permisos de Seguridad (Rol no autorizado) | RECHAZADO | PASÓ (Retornó `Acceso denegado: se requiere rol Socio Administrador`) |
| **C20** | Retención de Idempotencia tras Aborto por Error | LIMPIO | PASÓ (No quedan claves idempotentes "fantasma" tras un error) |

---

## 6. LIMITACIONES DOCUMENTADAS DEL MOCK LOCAL DE SUPABASE

1. **Simulación de `auth.uid()`:** En PostgreSQL local se simula mediante `SET app.current_user_id = '...'` y la función wrapper `auth.uid()`.
2. **Políticas RLS:** Supabase PostgREST aplica RLS automáticamente según la sesión JWT. El arnés local simula los permisos mediante chequeo explicito de `perfil_usuario` en la función `SECURITY DEFINER`.
3. **Roles Supabase Cloud:** Los roles `anon`, `authenticated`, `service_role` de Supabase Cloud no existen nativamente en un PostgreSQL standalone de Windows, por lo que los `GRANT`/`REVOKE` de Supabase son omitidos durante las pruebas locales aisladas.

---

## 7. HASHES SHA-256 DE MIGRACIONES

| Archivo | Hash SHA-256 | Estado |
| :--- | :--- | :--- |
| `20261010_i1_1_recibir_compra_sesion_por_trabajador.sql` | `0ADC9DB3843F665F0D1DB93D54DA07E124F0FC6F64583181F2587E8495A7F216` | Intacto |
| `20261010_i1_2_recibir_compra_definitiva.sql` | `0077AF7E97B8773002BEBCBE4C78B56B3F5A9374C755D2E1000F31467D5AC429` | Intacto |
| `20261010_i1_3_recibir_compra_corregida_propuesta.sql` | `EB42C68FCB3CF52558A345A57ED5B086C94A508BC69CDEA187F27AF59A1EEF01` | Intacto |
| `20261010_i1_4_recibir_compra_definitiva_v2.sql` | `DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5` | **Nuevo (Propuesta v2)** |

---

## 8. PUERTAS DE CALIDAD (FINAL QUALITY GATES)

```bash
npm run lint    # Exit Code: 0 (PASÓ)
npm run build   # Exit Code: 0 (PASÓ - dist/ generado exitosamente en 18.27s)
git diff --check # Exit Code: 0 (PASÓ - Sin marcadores de conflicto ni errores de sangrado)
```

---

## 9. DECISIÓN CONTABLE Y RIESGOS PENDIENTES

- **Pagos Bancarios con Sesión de Turno (Caso C15):** La función actual procesa compras bancarias realizadas por un trabajador con sesión abierta registrando la recepción del inventario y la compra como `RECIBIDA`, pero **NO inserta en `movimientos_caja`** (ya que la caja del turno solo maneja dinero en efectivo físico). 
- **Decisión Pendiente del Negocio:** Se debe confirmar con el propietario si los egresos por transferencias/tarjetas realizados durante un turno deben impactar un reporte separado de "Tesorería General / Cuentas Bancarias" o si el comportamiento actual de omitir `movimientos_caja` es el deseado por contabilidad.

---

## 10. VEREDICTO FINAL

### `APROBADA CON CONDICIONES`

**Justificación:**
1. El entorno PostgreSQL local `titan_grill_test` demostró aislamiento absoluto de producción.
2. Se descubrió y subsanó el error crítico de desajuste de columnas/valores en `movimientos_inventario` mediante la propuesta `I1.4`.
3. La suite de 20 casos de integración pasó satisfactoriamente en el arnés local.
4. **Condición para Despliegue:** La migración a aplicar en Supabase debe ser **`20261010_i1_4_recibir_compra_definitiva_v2.sql`** (y NO la `I1.3` debido al bug de sintaxis detectado). El despliegue a producción requiere aprobación explícita del propietario.

---
*Fin del Informe Fase 12.*
