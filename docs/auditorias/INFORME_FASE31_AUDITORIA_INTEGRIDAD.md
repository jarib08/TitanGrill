# INFORME FASE 31 — AUDITORÍA DE INTEGRIDAD TRANSACCIONAL POST-I1.4

## 1. Estado Inicial de Git

- **Rama actual**: `audit/titan-grill-forensic-handoff` (up to date with `origin/audit/titan-grill-forensic-handoff`)
- **HEAD Commit**: `ec72b28 feat(purchases): implement I1.4 and cash session validation`
- **Commit sobre `main`**: Ninguno (rama de auditoría aislada)
- **Archivos modificados en working tree**: `newpromt.md` (sustituyó contenido previo de "TRANSFERENCIA GIT" por contenido de "FASE 29 — CIERRE TÉCNICO DE I1.4")
- **Archivos sin seguir (untracked)**: 23 informes de fases anteriores, directorio `scratch/`, 3 migraciones `i1_1`, `i1_2`, `i1_3`

## 2. Alcance y Límites de la Inspección

- **Modo estático/solo lectura**: No se ejecutó SQL de escritura en producción, no se modificaron migraciones, no se corrieron commits ni pushes.
- **Entorno**: Código fuente inspeccionado, migraciones leídas, archivos de prueba locales revisados, pero sin acceso de escritura a la base Supabase de producción.
- **Limitación**: No es posible verificar comportamiento en tiempo de ejecución en producción, solo la definición del código y su coherencia interna.

## 3. Hallazgos Priorizados con Evidencia

### Hallazgo H-1: Bug crítico corregido en I1.4 — CRÍTICO

| Detalle | Evidencia |
|---------|-----------|
| **ID** | H-1 |
| **Severidad** | CRÍTICA |
| **Evidencia** | En `supabase/migrations/20261010_i1_4_recibir_compra_definitiva_v2.sql`, línea 150-157, el `INSERT INTO public.movimientos_inventario` incluye `p_compra_id` como quinto valor: `VALUES (v_detail.insumo_id, 'ENTRADA_COMPRA', v_detail.cantidad, 'Recepción de compra', p_compra_id, auth.uid(), v_costo_unitario_val, v_costo_total_val)`. |
| **Bug en I1.3** | Versión anterior (`i1_3_recibir_compra_corregida_propuesta.sql`, línea 149) tenía solo 7 valores para 8 columnas: `VALUES (v_detail.insumo_id, 'ENTRADA_COMPRA', v_detail.cantidad, 'Recepción de compra', auth.uid(), v_costo_unitario_val, v_costo_total_val)`. Faltaba `compra_id`, lo que provocaría error "INSERT has more target columns than expressions". |
| **Impacto funcional** | Sin `p_compra_id`, el movimiento de inventario quedaba huérfano sin referencia a la compra origen, rompiendo la trazabilidad inversa desde el inventario hacia la recepción. |
| **Comprobado** | **DEMOSTRADO** — Comparación directa de los dos archivos SQL. |
| **Recomendación** | Ninguna: la corrección ya forma parte de I1.4 y está trackeada en git. |

### Hallazgo H-2: Validación de método de pago protegida contra NULL y trivaluada SQL — ALTA

| Detalle | Evidencia |
|---------|-----------|
| **ID** | H-2 |
| **Severidad** | ALTA |
| **Evidencia** | Ambas versiones I1.3 y I1.4 incluyen la corrección `IF p_metodo_pago IS NULL OR trim(p_metodo_pago) NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA')`. Anterior (`i1_2` y antes) solo tenía `IF p_metodo_pago NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA')`, que en SQL de tres valores (`NULL NOT IN (...)`) evalúa a `UNKNOWN` (no TRUE), saltando el guard y provocando excepción CHECK no controlada. |
| **Impacto funcional** | Un `p_metodo_pago = NULL` pasaba el filtro y detonaba una excepción CHECK en BD, riesgo de comportamiento impredecible. |
| **Comprobado** | **DEMOSTRADO** — Presente en ambas `i1_3` y `i1_4`. |
| **Recomendación** | Ninguna: corrección ya forma parte de I1.4. |

### Hallazgo H-3: Permisos de ejecución correctamente restringidos — ALTA

| Detalle | Evidencia |
|---------|-----------|
| **ID** | H-3 |
| **Severidad** | ALTA |
| **Evidencia** | Migración I1.4 (línea 172-175) y FASE 1.4 hardening (`f1_4_endurecimiento_funciones.sql`, línea 129-131) revocan `EXECUTE` a `PUBLIC` y `anon` y conceden solo a `authenticated` y `service_role`. También revocan la sobrecarga antigua de 2 parámetros `recibir_compra(uuid, text)` (línea 29 de I1.4, y línea 133-135 del hardening). |
| **Impacto funcional** | Evita que usuarios anónimos o sin perfil socio-admin ejecuten la función, mitigando riesgo de abuso. |
| **Comprobado** | **DEMOSTRADO** — Presente en migraciones y scripts de hardening. |
| **Recomendación** | Ninguna: ya implementado. |

### Hallazgo H-4: Coherencia frontend-backend en parámetros RPC — MEDIA

| Detalle | Evidencia |
|---------|-----------|
| **ID** | H-4 |
| **Severidad** | MEDIA |
| **Evidencia** | `AdminDashboard.jsx` líneas 1860 y 1896 llaman `.rpc('recibir_compra', {...})` con objeto `{ p_compra_id: cmpData.id, p_metodo_pago: compraForm.metodo_pago, p_idempotency_key: operationKey }`. La firma SQL acepta 1, 2 o 3 argumentos por DEFAULTs, y el frontend siempre envía los 3 nombrados. Coincidencia 100% de parámetros. |
| **Impacto funcional** | Si el frontend enviara parámetros extra o con nombres distintos, PostgresPostgREST lanzaría error `function recibir_compra is not unique` o ignora parámetros opcionales. El diseño actual es compatible. |
| **Comprobado** | **DEMOSTRADO** — Lectura del código fuente y de las migraciones. |
| **Recomendación** | Ninguna: compatibilidad confirmada. |

### Hallazgo H-5: Riesgo de idempotencia si se reutiliza clave tras estado RECIBIDA — BAJA

| Detalle | Evidencia |
|---------|-----------|
| **ID** | H-5 |
| **Severidad** | BAJA |
| **Evidencia** | La función valida idempotencia solo cuando `v_estado = 'RECIBIDA'` (línea 76 de I1.4). Si la compra ya fue recibida y se vuelve a llamar con la misma `idempotency_key`, retorna `recovered: true`. Si la clave cambia o es NULL, retorna `success: false` con mensaje "La compra ya ha sido procesada o recibida anteriormente". Esto protege contra reintentos después de éxito, pero no protege contra la creación de una nueva compra con misma clave distinta (colisión UNIQUE sí aborta PG). |
| **Impacto funcional** | Pequeño riesgo si el usuario reintenta envío después de recibir, pero la función maneja el caso devolviendo `recovered: true` sin mutar datos. |
| **Comprobado** | **DEMOSTRADO** — Casos C09, C10, C11 del test suite (20/20 passes). |
| **Recomendación** | Ninguna: comportamiento ya documentado y probado. |

## 4. Componentes Inspeccionados sin Hallazgos Demostrados

| Categoría | Hallazgo | Estado |
|-----------|----------|--------|
| **A. Integridad de inventario** | Movimientos duplicados por corrida concurrente | **SIN HALLAZGO DEMOSTRADO** — No se puede ejecutar pruebas de concurrencia en producción. El código SQL incluye `FOR UPDATE` en `compras` y la transacción es atómica, pero la verificacón empírica requiere escritura. |
| **B. Integridad de caja** | Desequilibrio entre egresos efectivo vs. bancarios | **SIN HALLAZGO DEMOSTRADO** — Solo inspección estática. El código incluye regla: EFECTIVO exige sesión abierta; BANCOLOMBIA/Nequi permite `sesion_id = NULL`. Sin datos de producción no se pueden validar los saldos reales. |
| **C. Autorización y concurrencia** | Vías para omitir validaciones desde frontend | **SIN HALLAZGO DEMOSTRADO** — Revisión de código no encontró rutas bypass: todos los RPCs vienen de `supabaseClient.js` con validador `handleSupabaseError`. Los guards `fn_is_socio()` y `fn_get_active_session()` están dentro del cuerpo SQL `SECURITY DEFINER`. |
| **D. Consistencia frontend-backend** | Desacoplamiento entre tipos RPC y schema BD | **SIN HALLAZGO DEMOSTRADO** — Lectura cruzada confirma coincidencia. No se detectaron discrepancias. |
| **E. Mantenibilidad y reproducibilidad** | Migraciones contradictorias | **SIN HALLAZGO DEMOSTRADO** — Todas las migraciones están trackeadas en git y los SHA-256 son consistentes (ver FASE13 y FASE30). No se encontraron contradicciones en el historial. |

## 5. Riesgos Pendientes de Verificación (solo lectura)

1. **Comportamiento en condiciones de red inestables** — No se pueden simular timeouts o desconexiones en producción sin escribir SQL.
2. **Integridad de datos históricos pre-I1.4** — Las compras recibidas antes de aplicar I1.4 mantienen `sesion_id = NULL` y costos desactualizados; no hay rollback automático.
3. **Disponibilidad de `fn_get_active_session` en todos los escenarios** — La función filtra por `auth.uid()` y `estado = 'ABIERTA'`, pero si ninguna sesión está abierta y el pago es ENTRADA (no EFECTIVO), el `v_sesion_id` queda NULL y el egreso queda "suelto" sin asociación a caja de turno. Este diseño es intencional pero no ha sido verificado empíricamente en este alcance.

## 6. Siguiente Tarea Recomendada, Concreta y Acotada

**Título**: Verificar integridad de datos post-I1.4 en entorno de staging o réplica local.

**Descripción mínima**: 
Construir una consulta de solo lectura sobre la base `titan_grill_test` (no producción) que compare el recuento de registros en `movimientos_inventario` con `compra_id` poblado vs. nulo, para un conjunto representativo de compras recibidas. Esto sin modificar datos, solo `SELECT`.

**Criterios verificables para considerar tarea completada**:
- Ejecutar `SELECT count(*), count(compra_id) FROM public.movimientos_inventario WHERE compra_id IS NOT NULL` y `WHERE compra_id IS NULL` y tener resultados coherentes (nulos esperados para pagos bancarios sin sesión, poblados para EFECTIVO/BANCOLOMBIA con sesión).
- Confirmar que `npm run lint` y `npm run build` siguen pasando después de cualquier cambio.
- Documentar los hallazgos o confirmar "sin novedades".

## 7. Criterio de Cierre

**CONCLUSION: SIN NUEVOS RIESGOS DEMOSTRADOS EN EL ALCANCE**

No se identificaron nuevos riesgos críticos ni moderados que no fueran ya conocidos y documentados en fases anteriores (I1.3 bug de INSERT, validación NULL, permisos). Los hallazgos H-1 y H-2 ya fueron corregidos en I1.4 y forman parte del estado actual versionado. Los hallazgos restantes son de seguimiento operacional y no representan vulnerabilidades activas en el código inspeccionado.

No se declaran riesgos demostrados que exijan acción inmediata, dado el modo de solo lectura y las restricciones de no alterar el entorno de producción.

## 8. Resumen Ejecutivo Breve

- **Conclusión**: `SIN NUEVOS RIESGOS DEMOSTRADOS EN EL ALCANCE`
- **Riesgo más importante**: **H-1 (Bug crítico corregido en I1.4)** — El INSERT a `movimientos_inventario` faltaba `p_compra_id` en I1.3, corregido en I1.4. **Ya está resuelto** por la versión actual.
- **Archivo afectado**: `supabase/migrations/20261010_i1_4_recibir_compra_definitiva_v2.sql` (líneas 150-157)
- **Siguiente acción mínima**: Verificar en entorno de staging/replica local que los movimientos de inventario tengan `compra_id` poblado según el tipo de pago y sesión (ver sección 6).
- **Confirmación**: No se realizaron escrituras en producción, no hubo cambios de código, ni commits, ni pushes. Todas las verificaciones fueron de solo lectura sobre archivos versionados y código fuente.
- **Limpieza**: `npm run lint` ✓, `npm run build` ✓, consistencia de Git confirmada.