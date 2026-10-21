-- =====================================================================
-- FASE J1.1 — FECHA DE CORTE DE CONFIABILIDAD
-- Fecha: 2026-10-05
--
-- ##########################################################
-- ##  NO EJECUTADA. Requiere autorizacion explicita.      ##
-- ##########################################################
--
-- QUE RESUELVE
--   El negocio quiere "empezar de cero" financieramente. El analisis demostro
--   que eso YA OCURRE: fn_estado_resultados filtra cada componente por fecha,
--   asi que cualquier periodo nuevo arranca en $0 (medido: hoy, ayer y octubre
--   dan 0.00 en todas las lineas).
--
--   El problema real no es el arranque en cero, es la CONFIABILIDAD del dato
--   historico: 896 de 1085 movimientos de venta no tienen snapshot de costo,
--   asi que cualquier rango que incluya el 6-30 de septiembre reporta un COGS
--   incompleto y una utilidad SOBREESTIMADA.
--
--   Esta migracion NO toca ni un dato. Solo registra una fecha a partir de la
--   cual el dato es confiable, para que el dashboard pueda:
--     - abrir por defecto en el periodo confiable
--     - advertir de forma visible si se consulta hacia atras
--
-- POR QUE 2026-10-01 (validado contra produccion)
--   ventas antes del corte        : 116
--   ventas desde el corte         : 0
--   movs VENTA antes del corte    : 1085  (896 SIN snapshot)
--   movs VENTA desde el corte     : 0     (0 sin snapshot)
--   primer movimiento con snapshot: 2026-09-29 21:04 UTC
--
--   Un corte en 29-sep NO serviria: entre el 29 y el 30 hay movimientos
--   costeados y sin costear mezclados. El 1-oct es la primera fecha con CERO
--   movimientos sin snapshot, asi que desde ahi el COGS es 100% confiable.
--
--   Contrapartida aceptada: los 189 movimientos costeados del 29-30 de sep
--   ($199.539,82 de COGS legitimo) quedan del lado historico. Es correcto:
--   pertenecen al periodo anterior.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1. Tabla de configuracion del sistema
-- ---------------------------------------------------------------
-- No se reutiliza costos_configuracion a proposito: esa tabla modela costos
-- con monto y periodicidad, y meter una fecha ahi la desvirtuaria.
CREATE TABLE IF NOT EXISTS public.configuracion_sistema (
  clave       text PRIMARY KEY,
  valor       text NOT NULL,
  descripcion text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.perfiles_trabajadores(id),
  CONSTRAINT configuracion_clave_no_vacia CHECK (length(TRIM(BOTH FROM clave)) > 0)
);

COMMENT ON TABLE public.configuracion_sistema IS
  'Configuracion de negocio clave-valor. No almacena secretos ni credenciales.';

INSERT INTO public.configuracion_sistema (clave, valor, descripcion)
VALUES (
  'fecha_corte_confiabilidad',
  '2026-10-01',
  'Fecha desde la cual el 100% de los movimientos de venta tiene snapshot de costo. Antes de esta fecha el COGS es incompleto (896 de 1085 movimientos sin costo) y la utilidad esta sobreestimada. No afecta ningun dato: solo informa al dashboard.'
)
ON CONFLICT (clave) DO NOTHING;

-- ---------------------------------------------------------------
-- 2. RLS: lectura para trabajadores, escritura solo por RPC
-- ---------------------------------------------------------------
ALTER TABLE public.configuracion_sistema ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_select_worker" ON public.configuracion_sistema;
CREATE POLICY "config_select_worker"
  ON public.configuracion_sistema FOR SELECT TO authenticated
  USING (public.fn_is_worker());

-- Sin politicas de INSERT/UPDATE/DELETE: toda escritura pasa por la RPC
-- SECURITY DEFINER de abajo. Mismo patron aplicado en turnos.

GRANT SELECT ON public.configuracion_sistema TO authenticated;
REVOKE ALL ON public.configuracion_sistema FROM anon;

-- ---------------------------------------------------------------
-- 3. Lectura y escritura del corte
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_fecha_corte_confiabilidad()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_fecha date; v_desc text; v_sin_snap integer;
BEGIN
  IF NOT public.fn_is_worker() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado');
  END IF;

  SELECT valor::date, descripcion INTO v_fecha, v_desc
  FROM configuracion_sistema WHERE clave='fecha_corte_confiabilidad';

  IF v_fecha IS NULL THEN
    RETURN json_build_object('success', true, 'configurado', false, 'fecha_corte', NULL);
  END IF;

  -- Cuantos movimientos de venta sin costo quedan ANTES del corte: es el dato
  -- que justifica la advertencia, calculado en vivo y no hardcodeado.
  SELECT count(*) INTO v_sin_snap
  FROM movimientos_inventario
  WHERE tipo='VENTA' AND costo_total_historico IS NULL AND created_at < v_fecha;

  RETURN json_build_object(
    'success', true, 'configurado', true,
    'fecha_corte', v_fecha,
    'descripcion', v_desc,
    'movimientos_sin_costo_antes_del_corte', v_sin_snap
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.actualizar_fecha_corte_confiabilidad(p_fecha date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid; v_sin_snap integer; v_anterior date;
BEGIN
  IF NOT public.fn_is_socio() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: sesion no autenticada');
  END IF;
  IF p_fecha IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'La fecha es obligatoria.');
  END IF;
  IF p_fecha > (now() AT TIME ZONE 'America/Bogota')::date THEN
    RETURN json_build_object('success', false, 'message', 'La fecha de corte no puede ser futura.');
  END IF;

  -- Advertencia, NO bloqueo: si desde la fecha propuesta hay movimientos sin
  -- costo, el corte no garantiza un COGS confiable y hay que saberlo.
  SELECT count(*) INTO v_sin_snap
  FROM movimientos_inventario
  WHERE tipo='VENTA' AND costo_total_historico IS NULL AND created_at >= p_fecha;

  SELECT valor::date INTO v_anterior FROM configuracion_sistema WHERE clave='fecha_corte_confiabilidad';

  INSERT INTO configuracion_sistema (clave, valor, descripcion, updated_at, updated_by)
  VALUES ('fecha_corte_confiabilidad', p_fecha::text,
          'Fecha desde la cual el COGS se considera confiable.', now(), v_actor)
  ON CONFLICT (clave) DO UPDATE
    SET valor = EXCLUDED.valor, updated_at = now(), updated_by = v_actor;

  RETURN json_build_object('success', true,
    'fecha_anterior', v_anterior, 'fecha_corte', p_fecha,
    'movimientos_sin_costo_desde_el_corte', v_sin_snap,
    'advertencia', CASE WHEN v_sin_snap > 0
      THEN format('Atencion: desde %s hay %s movimientos de venta SIN snapshot de costo. El COGS de ese periodo seguira incompleto.', p_fecha, v_sin_snap)
      ELSE NULL END,
    'message', format('Fecha de corte de confiabilidad establecida en %s.', p_fecha));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_fecha_corte_confiabilidad()                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.actualizar_fecha_corte_confiabilidad(date)      FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_fecha_corte_confiabilidad()                  TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.actualizar_fecha_corte_confiabilidad(date)      TO authenticated, service_role;

COMMIT;
