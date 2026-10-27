-- Correccion de dato: Mayoneza kary tenia costo_unitario = 5000 con unidad
-- 'gramo', lo que implicaba $5.000.000 por kilo. Inflaba el valor del
-- inventario en $23.915.000 (96,1% del total reportado).
-- Dato real del socio: $67.900 por envase de 3,7 L.
--   67900 / 3700 ml = $18,3514/ml  ->  se registra 18.35 (2 decimales, como el
--   resto de los insumos en mililitro: $7,33 y $16,47).
-- Se cambia la unidad de 'gramo' a 'mililitro' porque la compra es por volumen;
-- asi se evita suponer una densidad. Es seguro ahora: stock en 0 y el insumo no
-- aparece en ninguna receta.
BEGIN;

UPDATE insumos
   SET unidad_medida  = 'mililitro',
       costo_unitario = 18.35,
       updated_at     = now()
 WHERE nombre = 'Mayoneza kary';

DO $$
DECLARE v_u text; v_c numeric; v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM insumos WHERE nombre = 'Mayoneza kary';
  IF v_n <> 1 THEN RAISE EXCEPTION 'se esperaba 1 fila, hay %', v_n; END IF;

  SELECT unidad_medida, costo_unitario INTO v_u, v_c
    FROM insumos WHERE nombre = 'Mayoneza kary';
  IF v_u <> 'mililitro' OR v_c <> 18.35 THEN
    RAISE EXCEPTION 'quedo mal: unidad=% costo=%', v_u, v_c;
  END IF;

  -- ningun otro insumo debe haber cambiado
  IF EXISTS (SELECT 1 FROM insumos
             WHERE unidad_medida IN ('gramo','mililitro')
               AND costo_unitario > 100) THEN
    RAISE EXCEPTION 'sigue habiendo un insumo con costo inverosimil por unidad de peso/volumen';
  END IF;

  RAISE NOTICE 'OK: Mayoneza kary = $18,35/mililitro. Ningun otro costo sospechoso.';
END $$;

COMMIT;
