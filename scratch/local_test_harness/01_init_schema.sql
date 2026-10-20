-- =============================================================================
-- ARNÉS DE PRUEBAS LOCAL: scratch/local_test_harness/01_init_schema.sql
-- Propósito: Esquema mínimo aislado para pruebas unitarias y de integración
--            de recibir_compra en PostgreSQL 18 local (titan_grill_test).
-- REGLA DE SEGURIDAD: Aborta de inmediato si no está conectado a 'titan_grill_test'
--                     o si el host no es localhost.
-- =============================================================================

DO $$
BEGIN
  IF current_database() <> 'titan_grill_test' THEN
    RAISE EXCEPTION 'ABORTANDO: Este script solo puede ejecutarse en titan_grill_test. Base actual: %', current_database();
  END IF;
  IF inet_server_addr() NOT IN ('127.0.0.1'::inet, '::1'::inet) AND inet_server_addr() IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTANDO: Conexión no es local. Servidor inet: %', inet_server_addr();
  END IF;
END $$;

-- 1. Esquema auth simulado (Mock de Supabase Auth)
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN nullif(current_setting('app.current_user_id', true), '')::uuid;
END;
$$;

-- 2. Limpieza de tablas previas en titan_grill_test (en orden de dependencias)
DROP TABLE IF EXISTS public.movimientos_inventario CASCADE;
DROP TABLE IF EXISTS public.movimientos_caja CASCADE;
DROP TABLE IF EXISTS public.compra_detalles CASCADE;
DROP TABLE IF EXISTS public.compras CASCADE;
DROP TABLE IF EXISTS public.insumos CASCADE;
DROP TABLE IF EXISTS public.sesiones_caja CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;

-- 3. Tabla usuarios (perfiles)
CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('socio', 'cajero', 'mesero', 'cocina')),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 4. Función fn_is_socio (Simulación del helper de seguridad de Titan Grill)
CREATE OR REPLACE FUNCTION public.fn_is_socio()
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_uid uuid;
  v_is boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  SELECT (rol = 'socio' AND activo = true) INTO v_is
  FROM public.usuarios
  WHERE id = v_uid;
  RETURN COALESCE(v_is, false);
END;
$$;

-- 5. Tabla sesiones_caja
CREATE TABLE public.sesiones_caja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trabajador_id uuid NOT NULL REFERENCES public.usuarios(id),
  estado text NOT NULL CHECK (estado IN ('ABIERTA', 'CERRADA')),
  monto_inicial numeric NOT NULL DEFAULT 0,
  fecha_apertura timestamptz NOT NULL DEFAULT now(),
  fecha_cierre timestamptz
);

-- 6. Función fn_get_active_session
CREATE OR REPLACE FUNCTION public.fn_get_active_session(p_trabajador_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_sesion_id uuid;
BEGIN
  IF p_trabajador_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id INTO v_sesion_id
  FROM public.sesiones_caja
  WHERE trabajador_id = p_trabajador_id AND estado = 'ABIERTA'
  ORDER BY fecha_apertura DESC
  LIMIT 1;
  RETURN v_sesion_id;
END;
$$;

-- 7. Tabla insumos
CREATE TABLE public.insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  stock_actual numeric NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  costo_unitario numeric NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),
  unidad_medida text NOT NULL DEFAULT 'UNIDAD',
  updated_at timestamptz DEFAULT now()
);

-- 8. Tabla compras
CREATE TABLE public.compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estado text NOT NULL CHECK (estado IN ('BORRADOR', 'RECIBIDA', 'ANULADA')),
  total numeric NOT NULL DEFAULT 0 CHECK (total >= 0),
  metodo_pago text,
  idempotency_key uuid UNIQUE,
  observaciones text,
  created_at timestamptz DEFAULT now()
);

-- 9. Tabla compra_detalles
CREATE TABLE public.compra_detalles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL REFERENCES public.insumos(id),
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  costo_unitario numeric NOT NULL CHECK (costo_unitario >= 0),
  subtotal numeric NOT NULL CHECK (subtotal >= 0)
);

-- 10. Tabla movimientos_caja
CREATE TABLE public.movimientos_caja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO')),
  monto numeric NOT NULL CHECK (monto >= 0),
  metodo_pago text NOT NULL CHECK (metodo_pago IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA')),
  descripcion text,
  trabajador_id uuid REFERENCES public.usuarios(id),
  sesion_id uuid REFERENCES public.sesiones_caja(id),
  compra_id uuid REFERENCES public.compras(id),
  idempotency_key uuid,
  created_at timestamptz DEFAULT now()
);

-- 11. Tabla movimientos_inventario
CREATE TABLE public.movimientos_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id uuid NOT NULL REFERENCES public.insumos(id),
  tipo text NOT NULL,
  cantidad numeric NOT NULL,
  motivo text,
  compra_id uuid REFERENCES public.compras(id),
  usuario_id uuid,
  costo_unitario_historico numeric,
  costo_total_historico numeric,
  idempotency_key uuid,
  created_at timestamptz DEFAULT now()
);

-- Indice unico parcial de idempotencia en movimientos_inventario (tal como en Supabase)
CREATE UNIQUE INDEX IF NOT EXISTS idx_movinv_idempotency 
ON public.movimientos_inventario(idempotency_key) 
WHERE idempotency_key IS NOT NULL;
