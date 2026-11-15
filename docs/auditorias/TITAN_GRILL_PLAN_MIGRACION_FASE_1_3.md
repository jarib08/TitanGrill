# TITAN GRILL — PLAN DE MIGRACIÓN DE SEGURIDAD E INTEGRIDAD (FASE 1.3)
## ESPECIFICACIÓN TÉCNICA Y AUDITORÍA DE PRODUCCIÓN — READ-ONLY

Este documento establece el plan máster definitivo para la primera migración de base de datos de Titan Grill, abordando la auditoría de Supabase LIVE, el análisis de seguridad, la compatibilidad del frontend y la reconciliación histórica de datos.

---

## 1. ESTADO ACTUAL REAL DE SUPABASE (AUDITORÍA FÍSICA)

La inspección mediante MCP de la base de datos de producción (`mbyjehhplruoqlgphfvw`) revela lo siguiente:

### 1.1 Conteo de Registros
- `clientes`: 52 filas
- `stamp_logs`: 51 filas
- `redemptions`: 7 filas
- `admin_audit_log`: 0 filas

### 1.2 Hallazgo Crítico de Inconsistencia Histórica (Discrepancia de Sellos)
Al ejecutar una consulta de integridad cruzada entre `clientes.stamps_count` y la sumatoria de logs menos redemptiones:

$$	ext{Diferencia} = 	ext{stamps\_count} - (	ext{logs\_count} - 10 	imes 	ext{redemptions\_count})$$

Se identifican **12 clientes con inconsistencias graves**. Ejemplos:
1. **emilio**: `stamps_count` = 2, pero tiene 0 logs y 1 redención. Su saldo calculado basado puramente en logs sería `-10`.
2. **Jarib**: `stamps_count` = 1, pero tiene 2 logs y 2 redenciones. Su saldo calculado sería `-18`.
3. **Test Local refe**: `stamps_count` = 1, pero tiene 0 logs.
4. **juan garcia**: `stamps_count` = 3, pero tiene 1 log.

#### Razón del Fallo Histórico:
1. El sistema actual otorga un sello de bienvenida en el registro del cliente modificando directamente `clientes.stamps_count` **sin insertar una fila** en `stamp_logs`.
2. Las redenciones en `redemptions` descuentan de `stamps_count` pero no generan logs de balance negativos en `stamp_logs`.

---

## 2. AUDITORÍA DEL FRONTEND ACTUAL

- **`ProtectedRoute.jsx`**:
  - Consulta la tabla `admin_users` para verificar la existencia del `id` del usuario autenticado.
  - *Vulnerabilidad*: Si el RLS de `admin_users` permite lectura a cualquier usuario autenticado, un atacante con cuenta válida podría registrarse y suplantar el estado de administrador en su cliente de React.
- **`AdminDashboard.jsx`**:
  - Invoca la función RPC `redeem_reward` pasando el `client_id`.
  - Busca clientes por celular directamente sobre la tabla `clientes` usando `.ilike()`.
- **`LoyaltyCard.jsx`**:
  - Se suscribe mediante Supabase Realtime a los cambios de la tabla `clientes` filtrando por el ID del cliente para actualizar los fuegos dinámicamente.
  - *Riesgo*: Modificar la firma de las tablas existentes rompería la suscripción en tiempo real del frontend actual.

---

## 3. VALORACIÓN DE SEGURIDAD (MATRIZ CRÍTICA)

| Operación | RPC / Tabla | ¿Quién ejecuta hoy? | ¿RLS protege? | ¿SECURITY DEFINER? | Riesgo |
|---|---|---|---|---|---|
| Incrementar Sello | `increment_stamps` | `PUBLIC` | ❌ No | ✅ Sí | **CRÍTICO**: Cualquier cliente anónimo puede inflar sus sellos. |
| Canjear Recompensa | `redeem_reward` | `PUBLIC` | ❌ No | ✅ Sí | **CRÍTICO**: Cualquiera puede canjear premios sin ser admin. |
| Leer Audit Logs | `admin_audit_log` | `authenticated` | ❌ No | ❌ No | **ALTO**: Cualquier usuario autenticado puede leer las auditorías de otros. |
| Modificar Clientes | `clientes` (UPDATE) | `authenticated` | ❌ No | ❌ No | **ALTO**: Cualquier usuario autenticado puede editar datos de otros clientes. |

---

## 4. ESTRATEGIA DE RECONCILIACIÓN HISTÓRICA

Para implementar el trigger de saldo transaccional sin alterar el saldo de los 52 clientes existentes ni provocar saldos negativos:

### 4.1 Script de Reconciliación (Paso Pre-Migración)
Calculamos los sellos faltantes en el historial para cada cliente y creamos un registro de ajuste en `stamp_logs` durante la migración:

```sql
INSERT INTO public.stamp_logs (client_id, notes, created_at)
SELECT 
    c.id, 
    'Ajuste de migración histórica Fase 1.3',
    now()
FROM public.clientes c
LEFT JOIN (
    SELECT client_id, COUNT(*) as count 
    FROM public.stamp_logs 
    GROUP BY client_id
) s ON c.id = s.client_id
LEFT JOIN (
    SELECT client_id, COUNT(*) as count 
    FROM public.redemptions 
    GROUP BY client_id
) r ON c.id = r.client_id
WHERE (c.stamps_count + (10 * COALESCE(r.count, 0)) - COALESCE(s.count, 0)) > 0;
```
Esto creará los logs necesarios de forma que la suma de eventos coincida exactamente con `stamps_count` antes de encender el trigger.

---

## 5. DISEÑO DE LA PRIMERA MIGRACIÓN (PROPUESTA SQL)

### Paso A: Tablas y Columnas Auxiliares (Seguridad Temporal)
Usamos la tabla `admin_users` existente como origen de seguridad.

### Paso B: Modificar `stamp_logs`
```sql
ALTER TABLE public.stamp_logs 
    ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'VENTA' CHECK (tipo IN ('VENTA', 'REFERIDO', 'MANUAL', 'PROMOCIONAL', 'REVERSION', 'MIGRACION')),
    ADD COLUMN IF NOT EXISTS venta_id UUID,
    ADD COLUMN IF NOT EXISTS otorgado_por UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'REVERTIDO')),
    ADD COLUMN IF NOT EXISTS motivo TEXT;
```

### Paso C: Ejecutar Reconciliación Histórica
*(Script del apartado 4.1)*

### Paso D: Endurecimiento de Políticas RLS
```sql
-- Restringir lectura de admin_users
DROP POLICY IF EXISTS "Allow individual read own admin status" ON public.admin_users;
CREATE POLICY "Solo admins leen admin_users"
ON public.admin_users
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
);

-- Restringir escritura en clientes
DROP POLICY IF EXISTS "Allow authenticated update" ON public.clientes;
CREATE POLICY "Solo admins actualizan clientes"
ON public.clientes
FOR UPDATE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
);
```

### Paso E: Blindaje de las RPC
Modificamos las funciones existentes para restringir el acceso `PUBLIC` y validar que el invocador sea administrador real:

```sql
-- Restringir increment_stamps
REVOKE EXECUTE ON FUNCTION public.increment_stamps(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_stamps(uuid) TO authenticated;

-- Restringir redeem_reward
REVOKE EXECUTE ON FUNCTION public.redeem_reward(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated;
```

---

## 6. PLAN DE RETROCESO (ROLLBACK)

Si el frontend o la sincronización fallan:
1. Revertir privilegios:
   `GRANT EXECUTE ON FUNCTION public.increment_stamps(uuid) TO PUBLIC;`
   `GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO PUBLIC;`
2. Remover columnas de `stamp_logs`.
3. Restaurar políticas RLS laxas.

---

## 7. MATRIZ DE PRUEBAS DE ACEPTACIÓN

1. **Seguridad Anónima**: Intentar llamar a `increment_stamps` sin token de sesión $	o$ **Debe retornar error de autorización**.
2. **Seguridad Cliente**: Intentar llamar a `increment_stamps` autenticado como cliente sin registro en `admin_users` $	o$ **Debe retornar error de autorización**.
3. **Consistencia de Tarjeta**: Abrir la tarjeta de "emilio" en el frontend $	o$ **Debe mostrar exactamente 2 sellos** (sin bajar a negativo).

---

## ESTADO
READ-ONLY

## CAMBIOS REALIZADOS
Código: ninguno  
Supabase: ninguno  
Migraciones ejecutadas: ninguna  
Git: ninguno  
Commits: ninguno  
Pushes: ninguno
