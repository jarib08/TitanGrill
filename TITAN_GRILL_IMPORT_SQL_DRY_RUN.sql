-- ============================================================
-- TITAN GRILL — IMPORT SQL DRY-RUN
-- Fecha: 2026-08-08
-- ESTADO: NO EJECUTAR — Solo para revisión
-- ============================================================
-- PREREQUISITO: Resolver B1 (Salchipapa vs Papa en Espiral)
-- antes de ejecutar FASE 3 y FASE 4 parcialmente.
-- ============================================================

BEGIN;

-- ============================================================
-- FASE 0 — SCHEMA MIGRATION
-- ============================================================

-- Guard: verificar que la columna no existe ya
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'insumos'
      AND column_name = 'costo_unitario'
  ) THEN
    RAISE NOTICE 'SKIP: costo_unitario ya existe en insumos';
  ELSE
    ALTER TABLE public.insumos ADD COLUMN costo_unitario NUMERIC DEFAULT 0;
    RAISE NOTICE 'OK: costo_unitario agregado';
  END IF;
END $$;

-- ============================================================
-- FASE 1 — INSUMOS
-- ============================================================

-- 1.1 UPDATE existente: Pan de Hamburguesa → Pan Hamburguesa Artesanal
UPDATE public.insumos
SET nombre = 'Pan Hamburguesa Artesanal',
    costo_unitario = 1350,
    updated_at = now()
WHERE id = '73548bdb-f31e-43eb-840e-d262daf64024'
  AND nombre = 'Pan de Hamburguesa';  -- Guard: solo si el nombre es el esperado

-- 1.2 CREATE nuevos insumos
-- Guard: verificar que no existan duplicados antes de insertar
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.insumos
  WHERE nombre IN (
    'Tocineta','Cebolla Blanca','Cebolla Roja','Tomate','Queso Chalo',
    'Orégano en Polvo','Pimienta Negra','Ajo en Polvo','Salsa Tomate Grande',
    'Carne Especial','Salsa de Carne','Salsa Inglesa','Mostaza','Aceite Ideal',
    'Papa','Cebollín','Lechuga Crespa','Ripia','Salsa Piña','Mayoneza',
    'Pechuga de Pollo','Paprika','Pan Perro Artesanal','Salchicha Perro Jumbo',
    'Chorizo Don Vitto','Queso Duro','Sal Refisal','Azúcar','Cabeza de Ajo',
    'Porción Salsa Acompañamiento','Salchicha Manguera','Maíz (bolsa 1kg)',
    'Queso Mozzarella','Lechuga Bola',
    'Empaque J1','Bolsa','Servilleta','Papel Envoltorio 29×29','Porta Perro'
  );
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: Se encontraron % insumos duplicados. Abortar.', v_count;
  END IF;
END $$;

-- Insumos productivos (34)
INSERT INTO public.insumos (nombre, unidad_medida, costo_unitario, stock_actual, stock_minimo, activo) VALUES
('Tocineta', 'unidad', 736.67, 0, 0, true),
('Cebolla Blanca', 'unidad', 600, 0, 0, true),
('Cebolla Roja', 'unidad', 500, 0, 0, true),
('Tomate', 'unidad', 800, 0, 0, true),
('Queso Chalo', 'unidad', 610, 0, 0, true),
('Orégano en Polvo', 'gramo', 100, 0, 0, true),
('Pimienta Negra', 'gramo', 56, 0, 0, true),
('Ajo en Polvo', 'gramo', 60, 0, 0, true),
('Salsa Tomate Grande', 'gramo', 6.744, 0, 0, true),
('Carne Especial', 'gramo', 16.556, 0, 0, true),
('Salsa de Carne', 'mililitro', 16.471, 0, 0, true),
('Salsa Inglesa', 'mililitro', 16.471, 0, 0, true),
('Mostaza', 'gramo', 10.612, 0, 0, true),
('Aceite Ideal', 'mililitro', 7.967, 0, 0, true),
('Papa', 'gramo', 6.68, 0, 0, true),
('Cebollín', 'gramo', 25, 0, 0, true),
('Lechuga Crespa', 'gramo', 19.444, 0, 0, true),
('Ripia', 'gramo', 10.40, 0, 0, true),
('Salsa Piña', 'gramo', 9.70, 0, 0, true),
('Mayoneza', 'gramo', 14.70, 0, 0, true),
('Pechuga de Pollo', 'gramo', 22.898, 0, 0, true),
('Paprika', 'gramo', 53.333, 0, 0, true),
('Pan Perro Artesanal', 'unidad', 1200, 0, 0, true),
('Salchicha Perro Jumbo', 'unidad', 1850, 0, 0, true),
('Chorizo Don Vitto', 'unidad', 593.75, 0, 0, true),
('Queso Duro', 'gramo', 22.20, 0, 0, true),
('Sal Refisal', 'gramo', 3, 0, 0, true),
('Azúcar', 'gramo', 2.15, 0, 0, true),
('Cabeza de Ajo', 'unidad', 600, 0, 0, true),
('Porción Salsa Acompañamiento', 'porción', 600, 0, 0, true),
('Salchicha Manguera', 'unidad', 2300, 0, 0, true),
('Maíz (bolsa 1kg)', 'gramo', 9.40, 0, 0, true),
('Queso Mozzarella', 'gramo', 29.50, 0, 0, true),
('Lechuga Bola', 'gramo', 4.40, 0, 0, true);

-- Empaques consumibles (5)
INSERT INTO public.insumos (nombre, unidad_medida, costo_unitario, stock_actual, stock_minimo, activo) VALUES
('Empaque J1', 'unidad', 430, 0, 0, true),
('Bolsa', 'unidad', 37, 0, 0, true),
('Servilleta', 'unidad', 14, 0, 0, true),
('Papel Envoltorio 29×29', 'unidad', 85.50, 0, 0, true),
('Porta Perro', 'unidad', 140, 0, 0, true);

-- ============================================================
-- FASE 2 — PROVEEDORES
-- ============================================================

-- Guard: no duplicar proveedores
DO $$
DECLARE v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.proveedores
  WHERE nombre IN ('Chalo', 'Carnecol', 'Olimpica');
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: Proveedores duplicados encontrados: %', v_count;
  END IF;
END $$;

INSERT INTO public.proveedores (nombre, telefono, contacto, activo) VALUES
('Chalo', NULL, NULL, true),
('Carnecol', NULL, NULL, true),
('Olimpica', NULL, NULL, true);

-- ============================================================
-- FASE 3 — PRODUCTOS
-- ============================================================

-- Guard: no duplicar Salchipapa Especial
DO $$
DECLARE v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.productos
  WHERE nombre = 'Salchipapa Especial';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ROLLBACK: Salchipapa Especial ya existe';
  END IF;
END $$;

INSERT INTO public.productos (nombre, precio, categoria, requiere_inventario, activo)
VALUES ('Salchipapa Especial', 18000, 'Entradas', true, true);

-- NOTA: La acción sobre Salchipapa/Papa en Espiral depende de B1.
-- Descomenta UNA de las siguientes opciones DESPUÉS de la decisión del propietario:

-- OPCION A: Papa en Espiral = Salchipapa → renombrar y actualizar precio
-- UPDATE public.productos
-- SET nombre = 'Salchipapa', precio = 13000, categoria = 'Entradas', updated_at = now()
-- WHERE id = 'e3bbda11-cf99-417c-b453-a21a4fea8469';

-- OPCION B: Son diferentes → crear Salchipapa nuevo
-- INSERT INTO public.productos (nombre, precio, categoria, requiere_inventario, activo)
-- VALUES ('Salchipapa', 13000, 'Entradas', true, true);

-- OPCION C: Desactivar Papa en Espiral + crear Salchipapa
-- UPDATE public.productos SET activo = false WHERE id = 'e3bbda11-cf99-417c-b453-a21a4fea8469';
-- INSERT INTO public.productos (nombre, precio, categoria, requiere_inventario, activo)
-- VALUES ('Salchipapa', 13000, 'Entradas', true, true);

-- ============================================================
-- FASE 4 — RECETAS (producto_insumos)
-- ============================================================

-- Guard: no alterar clientes, stamp_logs, ventas, sesiones, movimientos
DO $$
DECLARE
  v_clientes integer;
  v_stamps integer;
  v_ventas integer;
  v_sesiones integer;
BEGIN
  SELECT COUNT(*) INTO v_clientes FROM public.clientes;
  SELECT COUNT(*) INTO v_stamps FROM public.stamp_logs;
  SELECT COUNT(*) INTO v_ventas FROM public.ventas;
  SELECT COUNT(*) INTO v_sesiones FROM public.sesiones_caja;

  IF v_clientes != 14 THEN RAISE EXCEPTION 'ROLLBACK: clientes count changed: %', v_clientes; END IF;
  IF v_stamps != 15 THEN RAISE EXCEPTION 'ROLLBACK: stamp_logs count changed: %', v_stamps; END IF;
  -- ventas y sesiones pueden tener 1 registro de prueba
END $$;

-- 4.1 Burger Classic: eliminar receta parcial existente, crear completa
DELETE FROM public.producto_insumos
WHERE producto_id = '5d362b34-199b-4650-a323-b4c84a6d65e3'; -- Burger Classic

-- Insertar receta completa (19 ingredientes)
-- NOTA: Los UUID de insumos se resuelven por nombre
INSERT INTO public.producto_insumos (producto_id, insumo_id, cantidad_por_unidad)
SELECT
  '5d362b34-199b-4650-a323-b4c84a6d65e3',
  i.id,
  v.cantidad
FROM (VALUES
  ('Carne Especial', 110),
  ('Pan Hamburguesa Artesanal', 1),
  ('Queso Chalo', 1),
  ('Servilleta', 3),
  ('Tomate', 0.2),
  ('Salsa Tomate Grande', 25),
  ('Tocineta', 1),
  ('Lechuga Crespa', 15),
  ('Ripia', 10),
  ('Mostaza', 10),
  ('Papel Envoltorio 29×29', 1),
  ('Salsa de Carne', 5),
  ('Cebolla Blanca', 0.2),
  ('Pimienta Negra', 0.7),
  ('Cabeza de Ajo', 0.2),
  ('Orégano en Polvo', 0.5),
  ('Porción Salsa Acompañamiento', 1),
  ('Salsa Piña', 15),
  ('Cebollín', 2)
) AS v(nombre_insumo, cantidad)
JOIN public.insumos i ON i.nombre = v.nombre_insumo;

-- 4.2 Perro Caliente (12 ingredientes, ÷10)
INSERT INTO public.producto_insumos (producto_id, insumo_id, cantidad_por_unidad)
SELECT
  '4afe15e1-f6e0-49cf-9b93-140fc0a4722c',
  i.id,
  v.cantidad
FROM (VALUES
  ('Porta Perro', 1),
  ('Salchicha Perro Jumbo', 1),
  ('Pan Perro Artesanal', 1),
  ('Aceite Ideal', 2),
  ('Ripia', 15),
  ('Salsa Piña', 4),
  ('Salsa Tomate Grande', 4),
  ('Porción Salsa Acompañamiento', 0.1),
  ('Papel Envoltorio 29×29', 0.5),
  ('Maíz (bolsa 1kg)', 8),
  ('Servilleta', 4),
  ('Queso Mozzarella', 2)
) AS v(nombre_insumo, cantidad)
JOIN public.insumos i ON i.nombre = v.nombre_insumo;

-- 4.3 Salchipapa Especial (15 ingredientes)
INSERT INTO public.producto_insumos (producto_id, insumo_id, cantidad_por_unidad)
SELECT
  p.id,
  i.id,
  v.cantidad
FROM (VALUES
  ('Papa', 150),
  ('Chorizo Don Vitto', 1),
  ('Empaque J1', 1),
  ('Porción Salsa Acompañamiento', 1),
  ('Salsa Piña', 30),
  ('Salsa Tomate Grande', 30),
  ('Salchicha Manguera', 0.5),
  ('Queso Duro', 60),
  ('Ripia', 10),
  ('Servilleta', 4),
  ('Bolsa', 1),
  ('Lechuga Crespa', 27),
  ('Paprika', 5),
  ('Pechuga de Pollo', 120),
  ('Aceite Ideal', 20)
) AS v(nombre_insumo, cantidad)
JOIN public.insumos i ON i.nombre = v.nombre_insumo
CROSS JOIN (SELECT id FROM public.productos WHERE nombre = 'Salchipapa Especial') p;

-- 4.4 Salchipapa (13 ingredientes) — DEPENDE DE B1
-- Descomenta después de resolver B1 y determinar el producto_id correcto.
/*
INSERT INTO public.producto_insumos (producto_id, insumo_id, cantidad_por_unidad)
SELECT
  '<SALCHIPAPA_PRODUCT_UUID>',
  i.id,
  v.cantidad
FROM (VALUES
  ('Papa', 160),
  ('Aceite Ideal', 20),
  ('Empaque J1', 1),
  ('Porción Salsa Acompañamiento', 2),
  ('Salsa Piña', 20),
  ('Salsa Tomate Grande', 30),
  ('Salchicha Manguera', 0.5),
  ('Queso Duro', 60),
  ('Ripia', 15),
  ('Servilleta', 5),
  ('Bolsa', 1),
  ('Lechuga Bola', 27),
  ('Paprika', 5)
) AS v(nombre_insumo, cantidad)
JOIN public.insumos i ON i.nombre = v.nombre_insumo;
*/

-- ============================================================
-- FASE 5 — VALIDACIONES POST-INSERT
-- ============================================================

-- Verificar conteo de insumos
DO $$
DECLARE v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.insumos WHERE activo = true;
  RAISE NOTICE 'Insumos activos: %', v_count; -- Esperado: 40
END $$;

-- Verificar recetas creadas
DO $$
DECLARE v_burger integer; v_perro integer; v_especial integer;
BEGIN
  SELECT COUNT(*) INTO v_burger FROM public.producto_insumos
  WHERE producto_id = '5d362b34-199b-4650-a323-b4c84a6d65e3';

  SELECT COUNT(*) INTO v_perro FROM public.producto_insumos
  WHERE producto_id = '4afe15e1-f6e0-49cf-9b93-140fc0a4722c';

  SELECT COUNT(*) INTO v_especial FROM public.producto_insumos pi
  JOIN public.productos p ON pi.producto_id = p.id
  WHERE p.nombre = 'Salchipapa Especial';

  RAISE NOTICE 'Burger: % ingredientes (esperado 19)', v_burger;
  RAISE NOTICE 'Perro: % ingredientes (esperado 12)', v_perro;
  RAISE NOTICE 'Especial: % ingredientes (esperado 15)', v_especial;

  IF v_burger != 19 THEN RAISE EXCEPTION 'ROLLBACK: Burger tiene % en vez de 19', v_burger; END IF;
  IF v_perro != 12 THEN RAISE EXCEPTION 'ROLLBACK: Perro tiene % en vez de 12', v_perro; END IF;
  IF v_especial != 15 THEN RAISE EXCEPTION 'ROLLBACK: Especial tiene % en vez de 15', v_especial; END IF;
END $$;

-- Verificar que no se tocaron datos históricos
DO $$
DECLARE v_clientes integer; v_stamps integer;
BEGIN
  SELECT COUNT(*) INTO v_clientes FROM public.clientes;
  SELECT COUNT(*) INTO v_stamps FROM public.stamp_logs;
  IF v_clientes != 14 THEN RAISE EXCEPTION 'ROLLBACK: clientes alterados: %', v_clientes; END IF;
  IF v_stamps != 15 THEN RAISE EXCEPTION 'ROLLBACK: stamp_logs alterados: %', v_stamps; END IF;
  RAISE NOTICE 'OK: datos históricos intactos (% clientes, % stamps)', v_clientes, v_stamps;
END $$;

-- Verificar FK integridad
DO $$
DECLARE v_orphans integer;
BEGIN
  SELECT COUNT(*) INTO v_orphans
  FROM public.producto_insumos pi
  LEFT JOIN public.insumos i ON pi.insumo_id = i.id
  LEFT JOIN public.productos p ON pi.producto_id = p.id
  WHERE i.id IS NULL OR p.id IS NULL;
  IF v_orphans > 0 THEN RAISE EXCEPTION 'ROLLBACK: % FK huérfanas encontradas', v_orphans; END IF;
  RAISE NOTICE 'OK: 0 FK huérfanas';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK COMPLETO (ejecutar solo si es necesario revertir)
-- ============================================================
/*
BEGIN;
  -- Revertir recetas
  DELETE FROM public.producto_insumos
  WHERE producto_id IN (
    '5d362b34-199b-4650-a323-b4c84a6d65e3', -- Burger
    '4afe15e1-f6e0-49cf-9b93-140fc0a4722c'  -- Perro
  );
  DELETE FROM public.producto_insumos
  WHERE producto_id = (SELECT id FROM public.productos WHERE nombre = 'Salchipapa Especial');

  -- Restaurar receta original Burger (1 ingrediente: Pan)
  INSERT INTO public.producto_insumos (producto_id, insumo_id, cantidad_por_unidad)
  VALUES ('5d362b34-199b-4650-a323-b4c84a6d65e3', '73548bdb-f31e-43eb-840e-d262daf64024', 1);

  -- Revertir producto
  DELETE FROM public.productos WHERE nombre = 'Salchipapa Especial';

  -- Revertir proveedores
  DELETE FROM public.proveedores WHERE nombre IN ('Chalo', 'Carnecol', 'Olimpica');

  -- Revertir insumos nuevos (preservar Pan de Hamburguesa)
  DELETE FROM public.insumos WHERE id != '73548bdb-f31e-43eb-840e-d262daf64024';

  -- Restaurar nombre original de Pan
  UPDATE public.insumos SET nombre = 'Pan de Hamburguesa', costo_unitario = 0
  WHERE id = '73548bdb-f31e-43eb-840e-d262daf64024';

  -- Revertir schema
  ALTER TABLE public.insumos DROP COLUMN IF EXISTS costo_unitario;
COMMIT;
*/
