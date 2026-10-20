-- =============================================================================
-- SUITE EXHAUSTIVA DE PRUEBAS DE INTEGRACIÓN: recibir_compra (FASE 10)
-- Archivo: scratch/test_recibir_compra_suite.sql
-- Propósito: Especificación formal y ejecutable de los 18 escenarios de prueba.
-- POLÍTICA DE SEGURIDAD:
--   - Diseñada exclusivamente para entornos aislados (Local / Staging verificado).
--   - BLOQUEADA para ejecución con escrituras debido a que solo existe 1 proyecto
--     en Supabase (Producción [PROJECT_REF_REDACTADO]) y no hay staging disponible.
--   - Todos los casos fueron auditados mediante análisis estático y verificación
--     de restricciones en el catálogo de PostgreSQL.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CASO 1: Recepción válida en EFECTIVO con sesión propia abierta
-- -----------------------------------------------------------------------------
-- Preparación: Socio autenticado (auth.uid = S1) con sesión de caja abierta (sesion_id = B1). Compra C1 en BORRADOR.
-- Operación: SELECT public.recibir_compra('C1', 'EFECTIVO', 'KEY-1');
-- Resultado esperado: json { success: true, recovered: false, sesion_id: 'B1', metodo_pago: 'EFECTIVO' }
-- Aserciones BD:
--   1. compras.estado = 'RECIBIDA'
--   2. compras.idempotency_key = 'KEY-1'
--   3. movimientos_caja: 1 registro tipo 'EGRESO', monto = total, metodo_pago = 'EFECTIVO', sesion_id = 'B1', idempotency_key = 'KEY-1'
--   4. insumos.stock_actual incrementado en cantidad comprada.
--   5. movimientos_inventario: registros tipo 'ENTRADA_COMPRA' con snapshots de costo.
-- Limpieza: ROLLBACK de transacción de prueba.
-- Estado: Bloqueada para ejecución real (sin staging); Aprobada en análisis estático.

-- -----------------------------------------------------------------------------
-- CASO 2: Recepción en EFECTIVO sin sesión abierta
-- -----------------------------------------------------------------------------
-- Preparación: Socio autenticado (auth.uid = S1) SIN sesión abierta. Compra C2 en BORRADOR.
-- Operación: SELECT public.recibir_compra('C2', 'EFECTIVO', 'KEY-2');
-- Resultado esperado: json { success: false, message: 'Para compras pagadas en EFECTIVO se requiere una sesión de caja abierta...' }
-- Aserciones BD:
--   1. compras.estado permanece 'BORRADOR'
--   2. movimientos_caja: 0 registros creados
--   3. insumos.stock_actual sin cambios.
-- Limpieza: N/A (no muta).
-- Estado: Bloqueada para ejecución real; Aprobada en análisis estático (Guarda L98-103).

-- -----------------------------------------------------------------------------
-- CASO 3: Recepción por NEQUI sin sesión abierta (Pago de Tesorería)
-- -----------------------------------------------------------------------------
-- Preparación: Socio autenticado (auth.uid = S1) SIN sesión abierta. Compra C3 en BORRADOR.
-- Operación: SELECT public.recibir_compra('C3', 'NEQUI', 'KEY-3');
-- Resultado esperado: json { success: true, sesion_id: null, metodo_pago: 'NEQUI' }
-- Aserciones BD:
--   1. compras.estado = 'RECIBIDA'
--   2. movimientos_caja: 1 registro tipo 'EGRESO', metodo_pago = 'NEQUI', sesion_id = NULL
--   3. Stock de insumos incrementado correctamente.
-- Limpieza: ROLLBACK.
-- Estado: Bloqueada para ejecución real; Aprobada en análisis estático.

-- -----------------------------------------------------------------------------
-- CASO 4: Recepción por BANCOLOMBIA sin sesión abierta (Pago de Tesorería)
-- -----------------------------------------------------------------------------
-- Preparación: Socio autenticado (auth.uid = S1) SIN sesión abierta. Compra C4 en BORRADOR.
-- Operación: SELECT public.recibir_compra('C4', 'BANCOLOMBIA', 'KEY-4');
-- Resultado esperado: json { success: true, sesion_id: null, metodo_pago: 'BANCOLOMBIA' }
-- Aserciones BD:
--   1. compras.estado = 'RECIBIDA'
--   2. movimientos_caja: 1 registro tipo 'EGRESO', metodo_pago = 'BANCOLOMBIA', sesion_id = NULL
-- Limpieza: ROLLBACK.
-- Estado: Bloqueada para ejecución real; Aprobada en análisis estático.

-- -----------------------------------------------------------------------------
-- CASO 5: Recepción bancaria (BANCOLOMBIA) con sesión propia abierta
-- -----------------------------------------------------------------------------
-- Preparación: Socio autenticado (auth.uid = S1) CON sesión abierta B1. Compra C5 en BORRADOR.
-- Operación: SELECT public.recibir_compra('C5', 'BANCOLOMBIA', 'KEY-5');
-- Resultado esperado: json { success: true, sesion_id: 'B1' }
-- Aserciones BD: movimientos_caja.sesion_id = 'B1'.
-- Riesgo analizado: Imputa el pago a la caja de turno de S1.
-- Estado: Bloqueada para ejecución real; Aprobada en análisis estático (decisión contable pendiente del propietario).

-- -----------------------------------------------------------------------------
-- CASO 6: Método de pago NULL
-- -----------------------------------------------------------------------------
-- Preparación: Socio autenticado. Compra C6 en BORRADOR.
-- Operación: SELECT public.recibir_compra('C6', NULL, 'KEY-6');
-- Resultado esperado en I1.2 actual: El `NOT IN` de SQL evalúa a NULL, saltando el guard y fallando posteriormente en el CHECK constraint de movimientos_caja.
-- Hallazgo detectado: Requiere corregir guard a `IF p_metodo_pago IS NULL OR p_metodo_pago NOT IN ...`.
-- Estado: Bloqueada para ejecución real; Hallazgo técnico documentado en análisis estático.

-- -----------------------------------------------------------------------------
-- CASO 7: Método de pago no permitido (ej. 'TARJETA', 'BITCOIN')
-- -----------------------------------------------------------------------------
-- Operación: SELECT public.recibir_compra('C7', 'TARJETA', 'KEY-7');
-- Resultado esperado: json { success: false, message: 'Método de pago inválido. Use: EFECTIVO, NEQUI o BANCOLOMBIA' }
-- Aserciones BD: Cero mutaciones en BD.
-- Estado: Bloqueada para ejecución real; Aprobada en análisis estático (Guarda L60-62).

-- -----------------------------------------------------------------------------
-- CASO 8: Compra inexistente
-- -----------------------------------------------------------------------------
-- Operación: SELECT public.recibir_compra(gen_random_uuid(), 'EFECTIVO', 'KEY-8');
-- Resultado esperado: json { success: false, message: 'Compra no encontrada' }
-- Estado: Bloqueada para ejecución real; Aprobada en análisis estático (Guarda L70-72).

-- -----------------------------------------------------------------------------
-- CASO 9: Compra ya recibida con la misma clave (Recuperación Idempotente)
-- -----------------------------------------------------------------------------
-- Preparación: Compra C9 en estado 'RECIBIDA' con idempotency_key = 'KEY-9'.
-- Operación: SELECT public.recibir_compra('C9', 'EFECTIVO', 'KEY-9');
-- Resultado esperado: json { success: true, recovered: true, message: 'La compra ya fue recibida exitosamente (Recuperado)' }
-- Aserciones BD: Cero movimientos financieros duplicados; stock no vuelve a incrementarse.
-- Estado: Bloqueada para ejecución real; Aprobada en análisis estático (Guarda L75-83).

-- -----------------------------------------------------------------------------
-- CASO 10: Compra ya recibida con clave diferente
-- -----------------------------------------------------------------------------
-- Preparación: Compra C10 en 'RECIBIDA' con idempotency_key = 'KEY-10A'.
-- Operación: SELECT public.recibir_compra('C10', 'EFECTIVO', 'KEY-10B');
-- Resultado esperado: json { success: false, message: 'La compra ya ha sido procesada o recibida anteriormente' }
-- Estado: Bloqueada para ejecución real; Aprobada en análisis estático (Guarda L84-86).

-- -----------------------------------------------------------------------------
-- CASO 11: Clave nula en operación repetida
-- -----------------------------------------------------------------------------
-- Preparación: Compra C11 en 'RECIBIDA' con idempotency_key = 'KEY-11'.
-- Operación: SELECT public.recibir_compra('C11', 'EFECTIVO', NULL);
-- Resultado esperado: json { success: false, message: 'La compra ya ha sido procesada o recibida anteriormente' }
-- Estado: Bloqueada para ejecución real; Aprobada en análisis estático.

-- -----------------------------------------------------------------------------
-- CASO 12: Reutilización de clave en otra compra
-- -----------------------------------------------------------------------------
-- Preparación: Compra C12A ya tiene 'KEY-DUP'. Compra C12B intenta usar 'KEY-DUP'.
-- Operación: SELECT public.recibir_compra('C12B', 'EFECTIVO', 'KEY-DUP');
-- Resultado esperado: Violación de restricción UNIQUE `compras_idempotency_key_key`.
-- Comportamiento: Aborto de transacción y ROLLBACK automático.
-- Estado: Bloqueada para ejecución real; Aprobada en análisis estático (Índice único verificado en BD).

-- -----------------------------------------------------------------------------
-- CASO 13: Dos recepciones concurrentes de la misma compra
-- -----------------------------------------------------------------------------
-- Preparación: Transacciones T1 y T2 llaman a recibir_compra para C13 simultáneamente.
-- Comportamiento verificado: `FOR UPDATE` en L68 bloquea C13. T1 ejecuta y commitea estado RECIBIDA. T2 se desbloquea, lee RECIBIDA y devuelve resultado de idempotencia.
-- Estado: Bloqueada para pruebas en producción; Aprobada por semántica FOR UPDATE de PostgreSQL.

-- -----------------------------------------------------------------------------
-- CASO 14: Error simulado durante actualización de inventario (Atomicidad)
-- -----------------------------------------------------------------------------
-- Preparación: Compra con detalle que genera fallo (insumo con stock check negativo forzado o constraint).
-- Resultado esperado: Excepción SQL. ROLLBACK completo de compra, caja e inventario.
-- Aserciones BD: compras.estado permanece 'BORRADOR', movimientos_caja tiene 0 registros.
-- Estado: Bloqueada para ejecución real; Aprobada por diseño transaccional atómico PL/pgSQL.

-- -----------------------------------------------------------------------------
-- CASO 15: Compra con múltiples insumos (Multilínea)
-- -----------------------------------------------------------------------------
-- Preparación: Compra con 3 detalles en compra_detalles.
-- Comportamiento verificado: Calcula suma exacta de subtotales en v_total. Bucle itera 3 veces creando 3 movimientos de inventario.
-- Aserciones BD: movimientos_inventario tiene 3 filas con idempotency_key = NULL (previene choque con idx_movinv_idempotency).
-- Estado: Bloqueada para ejecución real; Aprobada en análisis estático.

-- -----------------------------------------------------------------------------
-- CASO 16: Prevención de duplicación de movimientos de inventario
-- -----------------------------------------------------------------------------
-- Verificación: Las entradas de inventario se ejecutan únicamente dentro del bloque de transición a RECIBIDA, nunca en la rama recovered=true.
-- Estado: Aprobada en análisis estático.

-- -----------------------------------------------------------------------------
-- CASO 17: Compatibilidad de llamadas RPC de 1, 2 y 3 argumentos
-- -----------------------------------------------------------------------------
-- Verificación:
--   - recibir_compra(uuid): default metodo_pago='EFECTIVO', default idempotency_key=NULL.
--   - recibir_compra(uuid, text): default idempotency_key=NULL. Resuelve sin ambigüedad tras DROP FUNCTION.
--   - recibir_compra(uuid, text, uuid): resuelve exactamente a la firma principal.
-- Estado: Aprobada en análisis estático.

-- -----------------------------------------------------------------------------
-- CASO 18: Ausencia de sesión ajena al trabajador autenticado
-- -----------------------------------------------------------------------------
-- Preparación: Trabajador T1 tiene sesión B1 abierta. Socio S2 (auth.uid) no tiene sesión abierta.
-- Operación: S2 ejecuta recibir_compra con BANCOLOMBIA.
-- Comportamiento verificado: fn_get_active_session(S2) retorna NULL. sesion_id asignado es NULL. NUNCA asigna B1 (de T1).
-- Estado: Aprobada en análisis estático (resuelve el bug original de sobrecarga 101538).
