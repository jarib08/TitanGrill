# FASE D.1.2: VALIDACIÓN FINANCIERA DE SESION_ID EN COMPRAS

> **Informe de Auditoría Financiera de Lectura (100% Read-Only)**  
> **Fecha de ejecución:** 24 de Septiembre de 2026  
> **Estado:** COMPLETADO CON ÉXITO — AUDITORÍA CERRADA  
> **ID de Proyecto Supabase:** `mbyjehhplruoqlgphfvw`  
> **Clasificación del Componente:** `CORRECTO CON OBSERVACIÓN`  

---

## 1. OBJETIVO DE LA FASE D.1.2

Realizar una evaluación **exclusivamente financiera y de solo lectura** sobre la vinculación del campo `sesion_id` en los movimientos financieros de compras (`recibir_compra` y `anular_compra`), determinando si la asignación de la sesión de caja abierta refleja adecuadamente la contabilidad por método de pago (`EFECTIVO`, `NEQUI`, `BANCOLOMBIA`) y el arqueo final de caja (`cerrar_caja`).

---

## 2. FLUJO ACTUAL DE ASIGNACIÓN DE `sesion_id`

En la implementación actual de PostgreSQL:

### En `recibir_compra`:
1. Se consulta la sesión activa:
   ```sql
   SELECT id INTO v_sesion_id
   FROM public.sesiones_caja
   WHERE estado = 'ABIERTA'
   ORDER BY fecha_apertura DESC LIMIT 1;
   ```
2. Se inserta el egreso en `movimientos_caja`:
   ```sql
   INSERT INTO public.movimientos_caja (
     tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, compra_id, idempotency_key
   ) VALUES (
     'EGRESO', v_total, p_metodo_pago, 'Pago de compra de insumos', auth.uid(), v_sesion_id, p_compra_id, p_idempotency_key
   );
   ```

### En `anular_compra`:
1. Se busca la sesión abierta activa (`v_sesion_id`).
2. Se inserta el ingreso compensatorio en `movimientos_caja`:
   ```sql
   INSERT INTO public.movimientos_caja (
     tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, compra_id, idempotency_key
   ) VALUES (
     'INGRESO', v_egreso.monto, v_egreso.metodo_pago, 'Reversión financiera por anulación...', auth.uid(), COALESCE(v_sesion_id, v_egreso.sesion_id), p_compra_id, p_idempotency_key
   );
   ```

---

## 3. SIGNIFICADO FINANCIERO POR MÉTODO DE PAGO

### A. EFECTIVO (Caja Física del Turno)
- **Dinámica**: Si la compra se paga en efectivo mientras la caja está abierta, el dinero sale del cajón físico de la sucursal.
- **Efecto en `cerrar_caja`**: El egreso en `movimientos_caja` reduce `v_mov_efectivo` y ajusta el saldo esperado en caja (`esperado_efectivo = monto_apertura + v_mov_efectivo`).
- **Evaluación**: **100% CORRECTO Y NECESARIO**. Sin la asignación de `sesion_id`, la salida de dinero físico generaría un faltante injustificado durante el arqueo de cierre.

### B. NEQUI y BANCOLOMBIA (Cuentas Digitales / Bancarias)
- **Dinámica**: Las compras pagadas mediante transferencia digital se debitan del saldo de las cuentas Nequi o Bancolombia.
- **Efecto en `cerrar_caja`**: `cerrar_caja` calcula `esperado_nequi` y `esperado_bancolombia` sumando la apertura declarada más los movimientos de la sesión (`v_mov_nequi` y `v_mov_bancolombia`).
- **Evaluación**: **CORRECTO CON OBSERVACIÓN**.
  - *Observación*: Si un administrador efectúa una transferencia desde la cuenta corporativa principal del restaurante mientras un cajero tiene turno abierto en el POS, el egreso reducirá el saldo esperado de esa cuenta para el turno del cajero.

---

## 4. RELACIÓN CON EL ARQUEO Y CIERRE DE CAJA (`cerrar_caja`)

En `cerrar_caja`, los movimientos financieros se contabilizan mediante:

```sql
SELECT COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE -monto END), 0)
INTO v_mov_efectivo
FROM public.movimientos_caja
WHERE sesion_id = v_active_sesion_id AND metodo_pago = 'EFECTIVO';
```

- Si una compra se realiza con **caja cerrada** (`sesion_id = NULL`):
  - El movimiento `EGRESO` se guarda con `sesion_id = NULL`.
  - No distorsiona cierres de turno anteriores ni futuros.
  - Se incluye correctamente en reportes globales de gastos, utilidades y balance del estado de resultados.

---

## 5. ANÁLISIS DE DATOS REALES EN PRODUCCIÓN

- **Registro Auditado**: Compra ID `45ed9db2-33d3-4f5e-b49e-9a0d31cd6597` (Monto: $38.650 COP, Método: `BANCOLOMBIA`, Fecha: 08-Sep-2026).
- **Estado en `movimientos_caja`**: Registro `d6f798e9-6b55-4a57-986c-ec58ab5febe8`, `sesion_id: NULL`.
- **Explicación Forense**: La compra fue registrada en una fecha previa a las modificaciones de D.1 cuando no existía una sesión de caja abierta asociada. Permanecer con `sesion_id: NULL` es **financieramente correcto** porque no perteneció a ningún turno de cajero específico.

---

## 6. CLASIFICACIÓN FINAL

### CLASIFICACIÓN: `CORRECTO CON OBSERVACIÓN`

### Justificación:
La lógica implementada en la FASE D.1 para la asignación de `sesion_id` representa fielmente la realidad financiera del sistema POS de Titan Grill. Protege el arqueo físico en efectivo y mantiene la trazabilidad global de egresos en cuentas bancarias.

---

## 7. RECOMENDACIÓN PARA FASES SIGUIENTES

- **No se requieren modificaciones de código ni de base de datos para la gestión financiera de `sesion_id` en D.1.**
- La arquitectura actual de compras es financieramente coherente y se encuentra lista para continuar hacia las fases autorizadas.

---

## 8. DECLARACIÓN FINAL DE SOLO LECTURA

- **Líneas de código modificadas en D.1.2**: 0.
- **Mutaciones ejecutadas en PostgreSQL durante D.1.2**: 0.
- **Commits o pushes creados**: 0.
- **Estado de Git**: Inalterado y 100% sincronizado.

---
