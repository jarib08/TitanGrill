-- =============================================================================
-- ARNÉS DE PRUEBAS LOCAL: scratch/local_test_harness/03_seed_data.sql
-- Propósito: Cargar datos sintéticos fijos para los 18 casos de prueba.
-- =============================================================================

DO $$
BEGIN
  IF current_database() <> 'titan_grill_test' THEN
    RAISE EXCEPTION 'ABORTANDO: Solo puede ejecutarse en titan_grill_test';
  END IF;
END $$;

-- Limpiar tablas
TRUNCATE TABLE public.movimientos_inventario, public.movimientos_caja, public.compra_detalles, public.compras, public.insumos, public.sesiones_caja, public.usuarios CASCADE;

-- Insertar usuarios de prueba
INSERT INTO public.usuarios (id, nombre, rol, activo) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Socio Con Sesion', 'socio', true),
  ('22222222-2222-2222-2222-222222222222', 'Socio Sin Sesion', 'socio', true),
  ('33333333-3333-3333-3333-333333333333', 'Usuario No Socio', 'mesero', true),
  ('44444444-4444-4444-4444-444444444444', 'Cajero Con Sesion', 'cajero', true);

-- Insertar sesiones de caja
INSERT INTO public.sesiones_caja (id, trabajador_id, estado, monto_inicial) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'ABIERTA', 100000),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'ABIERTA', 50000);

-- Insertar insumos
INSERT INTO public.insumos (id, nombre, stock_actual, costo_unitario, unidad_medida) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Carne de Res', 10, 15000, 'KG'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Papas Criollas', 20, 3000, 'KG'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Queso Cheddar', 5, 8000, 'KG');
