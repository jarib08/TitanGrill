-- =====================================================================
-- ROLLBACK de la Fase G1 (turnos y nomina)
-- =====================================================================
-- ADVERTENCIA: si ya se pagaron turnos, eliminar la tabla borra el vinculo
-- turno -> liquidacion. Las liquidaciones y los movimientos de caja NO se
-- tocan: el dinero pagado queda registrado igual. Lo que se pierde es la
-- trazabilidad de que dia corresponde cada pago.
-- Revisar antes:  SELECT count(*) FROM turnos WHERE estado='PAGADO';

BEGIN;

-- 1. RPCs
DROP FUNCTION IF EXISTS public.cerrar_y_pagar_turno(uuid, date, text, text, uuid);
DROP FUNCTION IF EXISTS public.pagar_turno(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.registrar_turno(uuid, date, numeric, text);
DROP FUNCTION IF EXISTS public.anular_turno(uuid, text);
DROP FUNCTION IF EXISTS public.fn_turnos_periodo(date, date);
DROP FUNCTION IF EXISTS public.actualizar_tarifa_trabajador(uuid, numeric);

-- 2. Triggers sobre liquidaciones (deja de estar protegido monto_calculado)
DROP TRIGGER  IF EXISTS trg_propagar_anulacion_liquidacion ON public.liquidaciones;
DROP FUNCTION IF EXISTS public.fn_propagar_anulacion_liquidacion();
DROP TRIGGER  IF EXISTS trg_liquidacion_inmutable_si_pagada ON public.liquidaciones;
DROP FUNCTION IF EXISTS public.fn_liquidacion_inmutable_si_pagada();

-- 3. Tabla turnos y sus triggers
DROP TRIGGER  IF EXISTS trg_turno_inmutable_si_pagado ON public.turnos;
DROP FUNCTION IF EXISTS public.fn_turno_inmutable_si_pagado();
DROP TRIGGER  IF EXISTS trg_turno_sin_fecha_futura ON public.turnos;
DROP FUNCTION IF EXISTS public.fn_turno_sin_fecha_futura();
DROP TABLE    IF EXISTS public.turnos;

-- 4. pagar_liquidacion: la version ORIGINAL esta en
--    supabase/migrations/00000000000000_baseline_recuperado_de_produccion.sql
--    (reabre el fallback de cualquier caja abierta y quita el FOR UPDATE).
--    No se restaura automaticamente a proposito.

-- 5. Datos: revertir a mano si se quiere
--    UPDATE perfiles_trabajadores SET tarifa_pago = 0 WHERE rol='TRABAJADOR';
--    UPDATE costos_configuracion SET activo = true WHERE categoria='PERSONAL';
--    (esto ultimo REACTIVA el doble conteo de nomina en el P&L)

COMMIT;
EOF
echo "parte 3 (datos) y rollback escritos"
ls -1 supabase/migrations/20260927_g1*.sql | sed 's/^/  /'