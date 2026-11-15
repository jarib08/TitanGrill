# TITAN GRILL — REVISIÓN PRE-IMPLEMENTACIÓN FASE A

## 1. VALIDAR LA REGLA DE NEGOCIO
- **Regla de Caja Abierta:** El flujo del POS (en `POS.jsx`) y el RPC `abrir_caja` (`WHERE trabajador_id = auth.uid()`) demuestran que **cada trabajador opera su propia sesión de caja**. No es una caja global para todo el negocio; es una sesión lógica vinculada al perfil del trabajador. Por lo tanto, la regla "máximo 1 caja ABIERTA por trabajador" es la correcta.
- **Justificación:** Si un trabajador opera la caja diurna y olvida cerrarla, el trabajador nocturno puede abrir su propia caja sin chocar con la del compañero, ya que el identificador es el `trabajador_id`.

## 2. VALIDAR EL ÍNDICE ÚNICO
- **Ejecución Read-Only:** Se ejecutó `SELECT trabajador_id, count(*) FROM sesiones_caja WHERE estado = 'ABIERTA' GROUP BY trabajador_id HAVING count(*) > 1;`
- **Resultado:** 0 filas devueltas (Vacío).
- **Conclusión:** No hay datos corruptos o cajas huérfanas actualmente. La creación del índice `UNIQUE (trabajador_id) WHERE estado = 'ABIERTA'` es 100% segura y no afectará sesiones históricas (`CERRADA`).

## 3. REVISAR `abrir_caja`
- **Captura de `unique_violation`:** El error `unique_violation` es un error estándar de PostgreSQL (código `23505`). En la estructura propuesta, el `INSERT` sobre `sesiones_caja` solo está sujeto al nuevo índice único parcial o a la Primary Key (UUID autogenerado, probabilidad de colisión nula). Capturarlo de forma generalizada en ese bloque es seguro para el contexto de la caja, siempre que se verifique que la excepción recupera correctamente el ID de la sesión.
- **Decisión de Concurrencia (Opción B):** Si el Request B choca por Unique Violation, la Opción B (devolver `success = false` con mensaje) es compatible con el frontend, ya que este lanza una alerta controlada. Pero es aún mejor devolver `success = true` y el `sesion_id` de la caja preexistente. Al hacerlo, el frontend se recuperará limpiamente (hará un fetch de la sesión y mostrará el POS abierto). Modificaremos el plan para usar la **Opción B adaptada** (retornar success = true si fue concurrencia).

## 4. REVISAR `fn_get_active_session`
- Actualmente retorna `uuid`. Es utilizada por múltiples operaciones (`abrir_caja`, etc.).
- Si existen (por un bug histórico) múltiples sesiones abiertas para un trabajador, `LIMIT 1` sin `ORDER BY` retorna resultados no deterministas.
- Agregar `ORDER BY fecha_apertura DESC` es una defensa robusta, ya que siempre se operará sobre la última caja.
- Al añadir el `UNIQUE INDEX`, la garantía será absoluta y solo habrá 1, pero el `ORDER BY` protege contra cualquier caída eventual del índice en el futuro.

## 5. REVISAR `registrar_saldo_inicial`
- **El flujo real:** En `AdminDashboard.jsx`, el Socio hace click en "Registrar Saldo Inicial". El frontend **NO envía un `sesion_id`**. 
- **Problema de Arquitectura Actual:** Como el Socio administra desde el Dashboard (donde no abre caja propia), si cambiamos el RPC para requerir `fn_get_active_session(auth.uid())`, el Socio tendría que abrir una caja en el POS primero. 
- **Solución Propuesta (Cambio Adicional):** En lugar de forzar al Socio a abrir una caja, modificaremos la firma del RPC a `registrar_saldo_inicial(p_sesion_id uuid, p_efectivo numeric, ...)`. 
- **Ajuste en Frontend:** Deberemos modificar `AdminDashboard.jsx` para que el formulario de Saldo Inicial permita seleccionar a qué caja abierta (de qué trabajador) se le inyectará el saldo. O de lo contrario, que el backend se lo asigne a la única caja abierta si solo hay una (pero es peligroso si hay dos).
- **Protección contra Doble Saldo:** `WHERE sesion_id = v_sesion_id AND tipo_operacion = 'SALDO_INICIAL'` protege en validación secuencial. Para evitar una condición de carrera, **AÑADIREMOS** un constraint en Base de Datos: `CREATE UNIQUE INDEX idx_unico_saldo_inicial_por_sesion ON movimientos_caja (sesion_id) WHERE tipo_operacion = 'SALDO_INICIAL';`

---

## RESULTADOS DE REVISIÓN PRE-IMPLEMENTACIÓN

### Resultado A-001 (Bloqueo de saldo histórico)
PASS para implementación. Se requerirá un nuevo UNIQUE INDEX parcial en `movimientos_caja` para blindarlo totalmente contra concurrencia.

### Resultado A-002 (Asignación ciega a última caja global)
BLOQUEADO. El plan sugería `fn_get_active_session(auth.uid())`, lo cual requeriría que el Socio abra una caja. **Nuevo Plan:** Modificar el contrato del RPC para requerir `p_sesion_id` explícitamente y actualizar `AdminDashboard.jsx` para enviar la sesión deseada.

### Resultado A-003 (Cajas huérfanas concurrentes)
PASS para implementación. No hay duplicados en DB, el índice puede crearse seguramente.

### Resultado A-004 (Determinismo de active session)
PASS para implementación. La adición del `ORDER BY` es segura y no rompe firmas.

---

### CAMBIOS ADICIONALES DETECTADOS
1. **Constraint para Saldo Inicial:** Se creará un nuevo índice: `CREATE UNIQUE INDEX idx_unico_saldo_inicial_por_sesion ON movimientos_caja (sesion_id) WHERE tipo_operacion = 'SALDO_INICIAL';`
2. **Cambio de contrato RPC:** `registrar_saldo_inicial` ahora requerirá `p_sesion_id uuid`.
3. **Ajuste de Frontend (`AdminDashboard.jsx`):** Modificar el modal de Saldo Inicial para solicitar a qué `sesion_id` se asocia el saldo (seleccionando de un listado de cajas 'ABIERTA' obtenidas de `sesiones_caja`).
4. **Comportamiento ante Unique Violation en Apertura:** `abrir_caja` devolverá `success: false` si falla (manteniendo compatibilidad actual) para que el frontend alerte "Ya tienes una caja abierta". Alternativamente, devolver `success: true` para recuperación invisible. Usaremos `success: false` para respetar la respuesta nativa del RPC preexistente.
