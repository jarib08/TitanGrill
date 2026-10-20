# INFORME FASE 15 — VALIDACIÓN FINAL DEL PLAN DE DESPLIEGUE, COMPATIBILIDAD RPC Y REVERSIÓN

> **Proyecto:** Titan Grill  
> **Fecha:** 10 de Octubre, 2026  
> **Rama:** `audit/titan-grill-forensic-handoff`  
> **HEAD:** `60cd590fdec62b0ba0f0bb3e81a1d44227d692a0`  
> **Proyecto Supabase ID:** `[PROJECT_REF_REDACTADO]`  
> **Migración Candidata:** `supabase/migrations/20261010_i1_4_recibir_compra_definitiva_v2.sql`  
> **SHA-256 Esperado:** `DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5`  
> **Dictamen Final:** `LISTA PARA SOLICITAR AUTORIZACIÓN DE DESPLIEGUE`

---

## 1. CONFIRMACIÓN EXPLÍCITA DE SEGURIDAD

Se confirma de forma categórica que durante toda la Fase 15 **NO se aplicaron migraciones, NO se realizaron ejecuciones DDL ni se modificaron datos** en la base de datos de producción de Supabase:
- `0` migraciones o sentencias escritas en producción.
- `0` llamadas a funciones mutantes ejecutadas en producción.
- **100% de las operaciones fueron consultas de lectura de metadatos del catálogo PostgreSQL.**

---

## 2. ESTADO GIT Y HASHES VERIFICADOS

- **Branch:** `audit/titan-grill-forensic-handoff`
- **HEAD Commit:** `60cd590fdec62b0ba0f0bb3e81a1d44227d692a0`
- **Hashes SHA-256 Intactos:**
  - `I1.1`: `0ADC9DB3843F665F0D1DB93D54DA07E124F0FC6F64583181F2587E8495A7F216`
  - `I1.2`: `0077AF7E97B8773002BEBCBE4C78B56B3F5A9374C755D2E1000F31467D5AC429`
  - `I1.3`: `EB42C68FCB3CF52558A345A57ED5B086C94A508BC69CDEA187F27AF59A1EEF01`
  - `I1.4`: `DF8AACE317FBB643F78BA7001755A20C080B5FFE389FABEE7F38FFEF1B4A90D5`

---

## 3. DEFINICIONES ANTERIORES EXACTAS DE PRODUCCIÓN

Se capturaron las definiciones DDL completas de las **dos sobrecargas** existentes en producción (`[PROJECT_REF_REDACTADO]`):

### 3.1 Sobrecargas en Producción
1. **Sobrecarga de 3 parámetros (oid 101538):**
   `public.recibir_compra(p_compra_id uuid, p_metodo_pago text DEFAULT 'EFECTIVO'::text, p_idempotency_key uuid DEFAULT NULL::uuid)`
   - Propietario: `postgres`, `SECURITY DEFINER`, `SET search_path TO 'public'`.
   - ACL: `{postgres=X, authenticated=X, service_role=X}`.
2. **Sobrecarga Legacy de 2 parámetros (oid 100711):**
   `public.recibir_compra(p_compra_id uuid, p_metodo_pago text DEFAULT 'EFECTIVO'::text)`
   - Propietario: `postgres`, `SECURITY DEFINER`, `SET search_path TO 'public'`.
   - ACL: `{postgres=X, authenticated=X, service_role=X}`.

---

## 4. INVENTARIO DE CONSUMIDORES RPC Y ESTRATEGIA DE FIRMA

### 4.1 Consumidores en el Frontend
En `src/components/AdminDashboard.jsx`:
- Líneas 1860 y 1896: `supabase.rpc('recibir_compra', { p_compra_id, p_metodo_pago, p_idempotency_key })`.

### 4.2 Evaluación de la Estrategia de Eliminación de Sobrecarga
- **Estrategia A (Seleccionada en I1.4):** Eliminar la sobrecarga legacy de 2 parámetros (`DROP FUNCTION IF EXISTS public.recibir_compra(uuid, text);`) y mantener la función única de 3 parámetros con valores predeterminados `DEFAULT`.
- **Justificación Técnica:** En PostgREST (Supabase), cuando existen sobrecargas con valores por defecto superpuestos, las peticiones con 2 parámetros provocan ambigüedad HTTP 400 (`PGRST202`). Al dejar una única función con `DEFAULT` en `p_metodo_pago` y `p_idempotency_key`, PostgreSQL y PostgREST resuelven unívocamente llamadas de 1, 2 o 3 parámetros sin ambigüedades.

---

## 5. PLAN DE REVERSIÓN REPRODUCIBLE (ROLLBACK SCRIPT)

En caso de requerirse un rollback durante la ventana de mantenimiento, el siguiente script restablece con precisión quirúrgica las dos sobrecargas originales capturadas directamente del catálogo de producción:

```sql
BEGIN;

-- 1. Restaurar sobrecarga de 3 parámetros previa (oid 101538)
CREATE OR REPLACE FUNCTION public.recibir_compra(
  p_compra_id uuid,
  p_metodo_pago text DEFAULT 'EFECTIVO'::text,
  p_idempotency_key uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_socio boolean;
  v_estado text;
  v_total numeric;
  v_existing_key uuid;
  v_detail record;
  v_mov_id uuid;
  v_sesion_id uuid;
  v_costo_unitario_val numeric;
  v_costo_total_val numeric;
BEGIN
  SELECT public.fn_is_socio() INTO v_is_socio;
  IF NOT v_is_socio THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;

  IF p_metodo_pago NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN
    RETURN json_build_object('success', false, 'message', 'Método de pago inválido. Use: EFECTIVO, NEQUI o BANCOLOMBIA');
  END IF;

  SELECT estado, total, idempotency_key INTO v_estado, v_total, v_existing_key
  FROM public.compras
  WHERE id = p_compra_id
  FOR UPDATE;

  IF v_estado IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Compra no encontrada');
  END IF;

  IF v_estado = 'RECIBIDA' THEN
    IF p_idempotency_key IS NOT NULL AND v_existing_key = p_idempotency_key THEN
      RETURN json_build_object(
        'success', true,
        'recovered', true,
        'message', 'La compra ya fue recibida exitosamente (Recuperado)',
        'total', v_total,
        'metodo_pago', p_metodo_pago
      );
    ELSE
      RETURN json_build_object('success', false, 'message', 'La compra ya ha sido procesada o recibida anteriormente');
    END IF;
  END IF;

  IF v_estado != 'BORRADOR' THEN
    RETURN json_build_object('success', false, 'message', 'La compra no se encuentra en estado BORRADOR y no puede ser recibida');
  END IF;

  SELECT id INTO v_sesion_id
  FROM public.sesiones_caja
  WHERE estado = 'ABIERTA'
  ORDER BY fecha_apertura DESC LIMIT 1;

  SELECT COALESCE(SUM(subtotal), 0) INTO v_total
  FROM public.compra_detalles
  WHERE compra_id = p_compra_id;

  UPDATE public.compras
  SET total = v_total,
      metodo_pago = p_metodo_pago,
      estado = 'RECIBIDA',
      idempotency_key = COALESCE(p_idempotency_key, idempotency_key)
  WHERE id = p_compra_id;

  INSERT INTO public.movimientos_caja (
    tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, compra_id, idempotency_key
  ) VALUES (
    'EGRESO',
    v_total,
    p_metodo_pago,
    'Pago de compra de insumos',
    auth.uid(),
    v_sesion_id,
    p_compra_id,
    p_idempotency_key
  ) RETURNING id INTO v_mov_id;

  FOR v_detail IN
    SELECT insumo_id, cantidad, costo_unitario
    FROM public.compra_detalles
    WHERE compra_id = p_compra_id
  LOOP
    v_costo_unitario_val := COALESCE(v_detail.costo_unitario, 0);
    v_costo_total_val := ROUND(v_detail.cantidad * v_costo_unitario_val, 2);

    UPDATE public.insumos
    SET stock_actual = stock_actual + v_detail.cantidad,
        costo_unitario = CASE WHEN v_detail.costo_unitario > 0 THEN v_detail.costo_unitario ELSE costo_unitario END,
        updated_at = now()
    WHERE id = v_detail.insumo_id;

    INSERT INTO public.movimientos_inventario (
      insumo_id, tipo, cantidad, motivo, compra_id, usuario_id,
      costo_unitario_historico, costo_total_historico
    ) VALUES (
      v_detail.insumo_id,
      'ENTRADA_COMPRA',
      v_detail.cantidad,
      'Recepción de compra',
      p_compra_id,
      auth.uid(),
      v_costo_unitario_val,
      v_costo_total_val
    );
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'recovered', false,
    'message', 'Compra recibida, inventario alimentado y egreso financiero registrado',
    'movimiento_caja_id', v_mov_id,
    'total', v_total,
    'metodo_pago', p_metodo_pago
  );
END;
$function$;

-- 2. Restaurar sobrecarga de 2 parámetros previa (oid 100711)
CREATE OR REPLACE FUNCTION public.recibir_compra(p_compra_id uuid, p_metodo_pago text DEFAULT 'EFECTIVO'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_socio boolean;
  v_estado text;
  v_total numeric;
  v_detail record;
  v_mov_id uuid;
BEGIN
  SELECT public.fn_is_socio() INTO v_is_socio;
  IF NOT v_is_socio THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;

  IF p_metodo_pago NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN
    RETURN json_build_object('success', false, 'message', 'Método de pago inválido. Use: EFECTIVO, NEQUI o BANCOLOMBIA');
  END IF;

  SELECT estado, total INTO v_estado, v_total
  FROM public.compras
  WHERE id = p_compra_id;

  IF v_estado IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Compra no encontrada');
  END IF;

  IF v_estado != 'BORRADOR' THEN
    RETURN json_build_object('success', false, 'message', 'La compra ya ha sido procesada o anulada');
  END IF;

  SELECT COALESCE(SUM(subtotal), 0) INTO v_total
  FROM public.compra_detalles
  WHERE compra_id = p_compra_id;

  UPDATE public.compras
  SET total = v_total,
      metodo_pago = p_metodo_pago,
      estado = 'RECIBIDA'
  WHERE id = p_compra_id;

  INSERT INTO public.movimientos_caja (
    tipo, monto, metodo_pago, descripcion, trabajador_id, compra_id
  ) VALUES (
    'EGRESO',
    v_total,
    p_metodo_pago,
    'Pago de compra de insumos',
    auth.uid(),
    p_compra_id
  ) RETURNING id INTO v_mov_id;

  FOR v_detail IN
    SELECT insumo_id, cantidad, costo_unitario
    FROM public.compra_detalles
    WHERE compra_id = p_compra_id
  LOOP
    UPDATE public.insumos
    SET stock_actual = stock_actual + v_detail.cantidad,
        costo_unitario = CASE WHEN v_detail.costo_unitario > 0 THEN v_detail.costo_unitario ELSE costo_unitario END,
        updated_at = now()
    WHERE id = v_detail.insumo_id;

    INSERT INTO public.movimientos_inventario (insumo_id, tipo, cantidad, motivo, compra_id, usuario_id)
    VALUES (v_detail.insumo_id, 'ENTRADA_COMPRA', v_detail.cantidad, 'Recepción de compra', p_compra_id, auth.uid());
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Compra recibida, inventario alimentado y egreso financiero registrado',
    'movimiento_caja_id', v_mov_id,
    'total', v_total,
    'metodo_pago', p_metodo_pago
  );
END;
$function$;

-- 3. Permisos
REVOKE EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.recibir_compra(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recibir_compra(uuid, text) TO authenticated, service_role;

-- 4. Notificar recarga de esquema a PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
```

---

## 6. RUNBOOK DE DESPLIEGUE TRANSACCIONAL (MODO DOCUMENTAL)

1. **Pre-Despliegue:** Confirmar autorización explícita del propietario del proyecto.
2. **Ejecución DDL Transaccional en Supabase SQL Editor:**
   ```sql
   BEGIN;
   -- Aplicar 20261010_i1_4_recibir_compra_definitiva_v2.sql
   -- [Código completo de I1.4]
   NOTIFY pgrst, 'reload schema';
   COMMIT;
   ```
3. **Verificación Post-Despliegue:**
   ```sql
   SELECT oid, proname, pg_get_function_identity_arguments(oid) 
   FROM pg_proc 
   WHERE proname = 'recibir_compra';
   ```
   Confirmar que únicamente existe 1 registro correspondiente a la firma de 3 parámetros.

---

## 7. DICTAMEN FINAL

### `LISTA PARA SOLICITAR AUTORIZACIÓN DE DESPLIEGUE`

**Justificación:**
1. El plan de despliegue es 100% transaccional y libre de ambigüedades.
2. Se dispone de un script de reversión (*rollback*) exacto y totalmente reproducible basado en el código previo capturado de producción.
3. Se verificó la compatibilidad de todos los consumidores RPC de la aplicación.
4. **No se realizaron escrituras en producción durante la Fase 15.**

---
*Fin del Informe Fase 15.*
