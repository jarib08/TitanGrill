# TITAN GRILL — INFORME FINAL DE AUDITORÍA: FASE A (POS / ABRIR CAJA)

## 1. RESUMEN EJECUTIVO
1. La apertura de caja (`abrir_caja`) adolece de **condiciones de carrera (Race Conditions)**; no hay garantías a nivel de base de datos que impidan abrir múltiples cajas simultáneas para el mismo trabajador o diferentes trabajadores.
2. La función para identificar cajas activas (`fn_get_active_session`) carece de un `ORDER BY`, por lo que en caso de múltiples cajas abiertas, selecciona una de forma arbitraria e impredecible.
3. El RPC `registrar_saldo_inicial` contiene un **error lógico crítico**: restringe el saldo inicial a 1 sola vez en la historia de la tabla, impidiendo la apertura en días posteriores, y asigna el saldo a la última caja abierta de cualquier usuario sin validar de quién es.
4. El frontend carece de un mecanismo formal de idempotencia (ej. UUID único en red) para la apertura; se fía únicamente de la variable de estado `loading` y la respuesta del servidor.
5. Existen altas probabilidades de falsos saldos, sesiones corrompidas, y errores operativos críticos relacionados con la caja si el negocio opera con más de un trabajador o en más de un turno.

---

## 2. MAPA DEL FLUJO REAL

```text
UI (POS.jsx)
 ↓
[Botón Abrir Caja] -> handleOpenSession()
 ↓
Hook/Estado: setLoading(true)
 ↓
Supabase RPC: abrir_caja(monto_efectivo, monto_nequi, monto_bancolombia)
 ↓
DB Function: fn_is_worker() / fn_get_active_session()
 ↓
Tabla: sesiones_caja (INSERT estado = 'ABIERTA')
 ↓
Dashboard de Admin / Funciones financieras
 ↓
UI (AdminDashboard) -> Supabase RPC: registrar_saldo_inicial() (En otro flujo/componente)
```

---

## 3. AUDITORÍA DE `abrir_caja`
**Parámetros:** `p_monto_apertura` (numeric), `p_apertura_nequi` (numeric, default 0), `p_apertura_bancolombia` (numeric, default 0).
**Usuario:** `auth.uid()` validado como worker (`fn_is_worker`).
**Lógica:**
- Verifica si ya existe sesión llamando a `fn_get_active_session(auth.uid())`.
- Si no existe, realiza un `INSERT` en `sesiones_caja` con estado 'ABIERTA'.
**Validaciones de Base de datos:** No existe ningún `UNIQUE INDEX` sobre `(trabajador_id, estado)` para garantizar exclusividad, ni bloqueos transaccionales avanzados (`FOR UPDATE`). 
**Resultado:** Registra los montos declarativos pero NO genera `movimientos_caja`.

---

## 4. AUDITORÍA DE `registrar_saldo_inicial`
**Parámetros:** Efectivo, Nequi, Bancolombia.
**Validaciones:** `fn_is_socio()`.
**Lógica y Errores Críticos:**
- Realiza `SELECT COUNT(*) FROM movimientos_caja WHERE tipo_operacion = 'SALDO_INICIAL';` y **falla** si `count > 0`. Esto significa que en toda la vida del sistema solo se puede llamar UNA VEZ. No filtra por `sesion_id` ni fecha. 🔴
- Llama a `SELECT id INTO v_sesion_id FROM public.sesiones_caja WHERE estado = 'ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1;`. No filtra por `trabajador_id`. Asigna el dinero a la caja global más reciente, que podría no ser la del administrador. 🔴
- Registra `INGRESO` de caja multiplicando el impacto si se llegase a arreglar la validación pero se ejecutara dos veces.

---

## 5. AUDITORÍA DE CONCURRENCIA
**Usuario A y Usuario B abren caja simultáneamente:** No hay restricciones globales que impidan N cajas 'ABIERTA' en general.
**Mismo usuario doble clic (Race Condition):**
```text
Req 1 -> fn_get_active_session -> NULL
Req 2 -> fn_get_active_session -> NULL
Req 1 -> INSERT 
Req 2 -> INSERT
```
**Conclusión PostgreSQL:** Permite el estado corrupto `sesión A = ABIERTA`, `sesión B = ABIERTA` para el mismo trabajador, ya que no hay índice único. Luego, `fn_get_active_session` retornará cualquiera de las dos por carecer de `ORDER BY`.

---

## 6. AUDITORÍA DE IDEMPOTENCIA
- **¿Existe `idempotency_key` en `abrir_caja` o `sesiones_caja`?:** NO.
- **¿Quién genera protección?:** Solo el estado de UI (React) inhabilitando el botón mientras `loading === true`.
- **¿Sobrevive a la reconexión?:** NO. Un timeout seguido de reintento por el usuario fallará previsiblemente (gracias a `fn_get_active_session`), pero si ocurre exactamente al mismo milisegundo (ej. error de proxy), creará duplicados. 

---

## 7. AUDITORÍA FRONTEND (`POS.jsx`)
- El POS hace fetch de la sesión activa en su carga inicial y tras cada operación.
- **Botón de apertura:** Se bloquea usando `loading`, pero no aplica debounce explícito contra manipulación del DOM.
- **Caja CERRADA vs ABIERTA:** Si backend tiene múltiples cajas abiertas, frontend cargará arbitrariamente una, dejando la(s) otra(s) "zombie".
- **Falso "Caja Cerrada":** Si la red falla y frontend asume que no abrió la caja, el usuario no verá la UI de caja abierta hasta que refresque.

---

## 8. AUDITORÍA RLS / SEGURIDAD
1. **¿Quién abre caja?:** Trabajadores activos (`fn_is_worker`).
2. **¿Quién consulta?:** Existe RLS pero asumiendo que los workers ven la suya (falta inspeccionar RLS policy exacta, pero el RPC usa `auth.uid()` con SECURITY DEFINER, por lo que es seguro a inyección).
3. **¿Puede abrir a nombre de otro?:** NO. `abrir_caja` fuerza `trabajador_id = auth.uid()`.
4. **Seguridad General RPC:** Los RPC operan como SECURITY DEFINER y fuerzan comprobaciones de roles, previniendo escalada de privilegios.

---

## 9. AUDITORÍA FINANCIERA
- **`abrir_caja`**: Declarativo, no modifica `movimientos_caja`. Seguro financieramente.
- **`registrar_saldo_inicial`**: Crea un `INGRESO`. Al ejecutarse de forma paralela (aunque actualmente bloqueado por su propio bug de "una vez en la vida"), inflaría falsamente los ingresos del sistema en los arqueos.

---

## 10. CASOS EXTREMOS
| Entrada | Comportamiento Esperado | Comportamiento Real | Riesgo | PASS / FAIL |
|---------|-------------------------|----------------------|--------|-------------|
| **Caso C:** Doble click rápido | Bloqueo o Error controlado | Doble inserción si pasa la condición de carrera (falta de UNIQUE constraint) | 🟠 | FAIL |
| **Caso I:** Admin abre y trabajador abre otra | Cada quien tiene su caja | Múltiples cajas abiertas permitidas. `registrar_saldo_inicial` del socio irá a la última abierta (quizás la del trabajador). | 🔴 | FAIL |
| **Caso:** Nuevo día, Socio registra Saldo Inicial | Saldo asignado al nuevo día | Bloqueo absoluto. "El saldo ya fue registrado anteriormente". Sistema inoperante. | 🔴 | FAIL |

---

## 11. QUERIES READ-ONLY UTILIZADAS
1. `SELECT proname, proargnames, pg_get_functiondef(oid) FROM pg_proc WHERE proname IN ('abrir_caja', ...)`
   *Propósito:* Inspeccionar el código real ejecutado en base de datos.
2. `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.sesiones_caja'::regclass;`
   *Propósito:* Demostrar la carencia de índices únicos que prevengan corrupción de concurrencia.
3. `SELECT column_name... FROM information_schema.columns WHERE table_name = 'sesiones_caja'`
   *Propósito:* Verificación de modelo de datos base.

---

## 12. MATRIZ DE HALLAZGOS
| ID | Severidad | Componente | Hallazgo | Evidencia | Riesgo | Recomendación |
|----|-----------|------------|----------|-----------|--------|---------------|
| A-001 | 🔴 CRÍTICO | RPC (`registrar_saldo_inicial`) | Bloqueo por conteo global sin filtro. | `SELECT COUNT(*) INTO v_count FROM public.movimientos_caja WHERE tipo_operacion = 'SALDO_INICIAL'` | Negocio inoperable financieramente el día 2. | PENDIENTE DE CORRECCIÓN |
| A-002 | 🔴 CRÍTICO | RPC (`registrar_saldo_inicial`) | Asignación ciega a la última caja global abierta. | `ORDER BY fecha_apertura DESC LIMIT 1` sin filtro por UID. | Dinero asignado al trabajador equivocado. | PENDIENTE DE CORRECCIÓN |
| A-003 | 🟠 ALTO | Tabla (`sesiones_caja`) | Carencia de índice parcial único para cajas abiertas. | Faltan constraints en `pg_constraint`. | Cajas huérfanas concurrentes. | PENDIENTE DE CORRECCIÓN |
| A-004 | 🟡 MEDIO | RPC (`fn_get_active_session`) | Falla de ordenamiento (`LIMIT 1` sin `ORDER BY`). | `WHERE trabajador_id = p_trabajador_id AND estado = 'ABIERTA' LIMIT 1;` | Selección aleatoria en caso de corrupción previa. | PENDIENTE DE CORRECCIÓN |

---

## 13. PASS / FAIL
**FASE A — FAIL**
*(Riesgos financieros críticos y arquitectónicos demostrados que impiden una operación confiable de la caja).*

---

## 14. RECOMENDACIONES
- **Críticas:**
  - Reescribir `registrar_saldo_inicial` para que reciba `p_sesion_id` como parámetro y verifique que dicha sesión específica no tenga saldo inicial.
  - Implementar un índice parcial en BD: `CREATE UNIQUE INDEX idx_sesion_unica_abierta ON sesiones_caja (trabajador_id) WHERE estado = 'ABIERTA';`.
- **Importantes:**
  - Modificar `fn_get_active_session` para añadir `ORDER BY fecha_apertura DESC`.
  - Añadir soporte de `idempotency_key` (UUID) en el frontend a la hora de llamar a `abrir_caja`.

---

## 15. PRÓXIMO PASO
Se ha finalizado la auditoría de la Fase A y los problemas han sido documentados. Me detengo a la espera de instrucciones para proceder con la FASE B o ejecutar correcciones.
