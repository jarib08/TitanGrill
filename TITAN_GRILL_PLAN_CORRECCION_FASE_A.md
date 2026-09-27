# TITAN GRILL — PLAN DE CORRECCIÓN FASE A

## A. Hallazgos
- **A-001:** `registrar_saldo_inicial` se bloquea permanentemente después del primer uso en la historia de la aplicación, por contar `SALDO_INICIAL` sin filtro de sesión o fecha.
- **A-002:** `registrar_saldo_inicial` asigna el saldo a la sesión global más reciente (`ORDER BY fecha_apertura DESC LIMIT 1`), sin importar qué usuario la haya abierto, pudiendo inyectar dinero a la caja de otro trabajador.
- **A-003:** Falta de un mecanismo robusto (ej. Unique Constraint) para prevenir cajas huérfanas concurrentes (`sesiones_caja`).
- **A-004:** `fn_get_active_session` carece de un `ORDER BY` y es susceptible a retornar resultados arbitrarios si llega a haber más de una sesión abierta por error previo.

## B. Evidencia actual
- La tabla `sesiones_caja` no cuenta con `UNIQUE INDEX` sobre `estado = 'ABIERTA'`.
- La función `registrar_saldo_inicial` incluye la validación global `SELECT COUNT(*) ... WHERE tipo_operacion = 'SALDO_INICIAL'`.
- La función `abrir_caja` verifica la existencia de una caja con un simple `SELECT`, vulnerable a Race Conditions (tiempo entre comprobación e inserción).

## C. Regla de negocio
- **Apertura de Caja:** Cada trabajador activo puede tener **máximo una sesión de caja abierta simultáneamente**. No existe una única sesión global (ya que las cajas tienen un dueño, `trabajador_id`).
- **Saldo Inicial:** El Administrador/Socio que registra el saldo inicial lo hace sobre **su propia sesión de caja activa**. No sobre cajas ajenas.
- **Idempotencia de Apertura:** Un doble click o reintento de red no debe duplicar la sesión. Si la sesión ya está abierta, debe devolver el ID de la caja existente de forma controlada.

## D. Solución propuesta
1. **Base de Datos (Constraint):** Crear un índice único parcial: 
   `CREATE UNIQUE INDEX idx_sesion_unica_abierta ON sesiones_caja (trabajador_id) WHERE estado = 'ABIERTA';`
2. **RPC `fn_get_active_session`:** Añadir `ORDER BY fecha_apertura DESC` preventivo.
3. **RPC `abrir_caja`:** Envolver el `INSERT` en un bloque `BEGIN ... EXCEPTION WHEN unique_violation THEN ... END` para capturar condiciones de carrera y devolver `success: false, message: 'Ya tienes una sesión...'` o `success: true` con la sesión recuperada. En este caso, el comportamiento actual es devolver success: false, mantendremos la consistencia de interfaz pero capturando el error.
4. **RPC `registrar_saldo_inicial`:**
   - Reemplazar la obtención de la sesión a: `v_sesion_id = public.fn_get_active_session(auth.uid());`
   - Validar que el socio tenga caja abierta (`IF v_sesion_id IS NULL`).
   - Cambiar la validación de duplicados para que solo cuente los `SALDO_INICIAL` en `v_sesion_id`: `SELECT COUNT(*) INTO v_count FROM public.movimientos_caja WHERE sesion_id = v_sesion_id AND tipo_operacion = 'SALDO_INICIAL';`
5. **Frontend `POS.jsx`:** El frontend ya bloquea el botón con `loading` y verifica la sesión. Las correcciones backend aseguran que los errores de red/doble clic fallarán elegantemente sin corromper DB. 

## E. Alternativas descartadas
- **Usar un `idempotency_key` en UI para `abrir_caja`:** Descartado por añadir complejidad innecesaria a nivel de columnas de BD y localStorage en UI, cuando la regla estricta de negocio (solo 1 caja abierta por worker) se protege mejor y nativamente con un `UNIQUE INDEX` en BD, sirviendo como su propio identificador de idempotencia natural.
- **Asignar saldo inicial a cualquier caja:** Descartado. Rompería el ownership y responsabilidad financiera del trabajador que abrió la caja.

## F. Impacto
- **Tablas:** `sesiones_caja` (nuevo índice).
- **RPC:** Modificación de `fn_get_active_session`, `abrir_caja`, `registrar_saldo_inicial`.
- **Frontend:** Ningún cambio sustancial requerido, el backend absorberá y blindará correctamente las solicitudes. 

## G. Riesgo de migración
- **Bajo:** Si ya existen registros corruptos (múltiples cajas 'ABIERTA' para el mismo trabajador), la creación del `UNIQUE INDEX` fallará. Se debe comprobar existencia de duplicados previamente.

## H. Estrategia de rollback
- Eliminar el índice creado: `DROP INDEX idx_sesion_unica_abierta;`
- Ejecutar el código SQL anterior de los RPC (respaldado antes de modificar).

## I. Pruebas necesarias
- Comprobar creación del índice.
- Intentar abrir caja dos veces de forma concurrente o manual en SQL.
- Intentar registrar saldo inicial el mismo día, y en sesiones diferentes.
- Verificar que solo afecte a la sesión del socio.

## J. Criterios de aceptación
- `registrar_saldo_inicial` permite ingresos en días sucesivos.
- Es imposible tener dos sesiones 'ABIERTA' para el mismo usuario.
- `abrir_caja` maneja los choques de concurrencia y no estalla en error HTTP 500, sino en respuesta controlada.
