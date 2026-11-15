# TITAN GRILL — VALIDACIÓN DEFINITIVA DEL MODELO DE FIDELIZACIÓN (FASE 1.2)
## ANÁLISIS DE CONSISTENCIA Y ESPECIFICACIÓN MATEMÁTICA — READ-ONLY

Este documento presenta la validación final del modelo de fidelización y la especificación matemática de la estrategia de **Deuda de Sellos** (`stamps_debt`) acordada para la Fase 1.2 de Titan Grill.

---

## 1. COMPORTAMIENTO DE LAS VARIABLES

Definimos las siguientes variables agregadas derivadas del historial:
- $S_e$ (`stamps_earned`): Suma de sellos válidos otorgados al cliente (tipo `VENTA`, `REFERIDO`, `MANUAL` o `PROMOCIONAL` en estado `ACTIVO`).
- $S_r$ (`stamps_reverted`): Suma de sellos revertidos (tipo `REVERSION` en estado `ACTIVO`).
- $S_s$ (`stamps_spent`): Suma de sellos canjeados (campo `stamps_exchanged` en la tabla `redemptions`).

El estado real del cliente se rige por las siguientes ecuaciones matemáticas:

### 1.1 Saldo Visual en Tarjeta (`stamps_count`)
$$	ext{stamps\_count} = \max(0, S_e - S_r - S_s)$$

### 1.2 Deuda de Sellos Amortizable (`stamps_debt`)
$$	ext{stamps\_debt} = \max(0, S_s + S_r - S_e)$$

---

## 2. ANÁLISIS DE TRAJECTORIAS OPERACIONALES (PRUEBA DE CONSISTENCIA)

A continuación se simula paso a paso la evolución de las variables para verificar que no existan inconsistencias ni pérdidas de trazabilidad.

| Paso | Evento Operacional | $S_e$ | $S_r$ | $S_s$ | `stamps_count` | `stamps_debt` | Comportamiento en POS y Tarjeta |
|---|---|---|---|---|---|---|---|
| 0 | Registro inicial de cliente | 0 | 0 | 0 | **0** | **0** | Tarjeta vacía. |
| 1 | Compra 10 hamburguesas (10 ventas) | 10 | 0 | 0 | **10** | **0** | Tarjeta llena (10/10). Listo para canjear. |
| 2 | Canje de recompensa (1 premio) | 10 | 0 | 10 | **0** | **0** | Tarjeta se vacía (0/10). Se entrega el premio. |
| 3 | Se anula 1 venta del paso 1 (Reversión) | 10 | 1 | 10 | **0** | **1** | Tarjeta en (0/10). El cajero ve deuda interna de 1. |
| 4 | Cliente compra 1 producto elegible | 11 | 1 | 10 | **0** | **0** | Deuda se liquida. Tarjeta permanece en (0/10). |
| 5 | Cliente compra otro producto elegible | 12 | 1 | 10 | **1** | **0** | Tarjeta sube a (1/10) normalmente. |

*Conclusión del análisis*:
La matemática es consistente. El cliente nunca ve un balance negativo (`stamps_count` siempre $\ge 0$), pero el sistema amortiza automáticamente la deuda de sellos antes de permitirle acumular nuevos sellos para su siguiente recompensa. Esto bloquea cualquier intento de fraude por cancelación de venta posterior a un canje.

---

## 3. ESQUEMA DE SEGURIDAD EN SUPABASE (FASE 1.2)

1. **Restricción de RPCs públicas**:
   - `REVOKE EXECUTE ON FUNCTION public.increment_stamps(uuid) FROM PUBLIC;`
   - `REVOKE EXECUTE ON FUNCTION public.redeem_reward(uuid) FROM PUBLIC;`
   - `GRANT EXECUTE ON FUNCTION public.increment_stamps(uuid) TO authenticated;`
   - `GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated;`
2. **Validación de Rol Administrativo**:
   Dentro de cada RPC, se agregará una verificación de seguridad a nivel de base de datos:
   ```sql
   IF NOT EXISTS (
       SELECT 1 FROM public.perfiles_trabajadores 
       WHERE id = auth.uid() AND rol = 'ADMINISTRADOR' AND activo = true
   ) THEN
       RAISE EXCEPTION 'Operación no autorizada';
   END IF;
   ```

---

## CONFIRMACIÓN DE RESTRICCIONES DE FASE

> NO SE MODIFICÓ CÓDIGO DE LA APLICACIÓN.
> NO SE MODIFICÓ LA BASE DE DATOS DE SUPABASE.
> NO SE CREARON TABLAS NI MIGRACIONES.
> NO SE MODIFICARON RLS NI RPC.
> NO SE REALIZARON COMMITS NI PUSHES EN GIT.

Este análisis de consistencia y validación (Fase 1.2) queda aprobado para guiar la implementación.
