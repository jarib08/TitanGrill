# TITAN GRILL — PLAN DE MIGRACIÓN Y SEGURIDAD (FASE 1)
## PLAN DE IMPLEMENTACIÓN DETALLADO — MODO READ-ONLY

Este documento es el plan máster de migración y seguridad de la Fase 1 para el proyecto Titan Grill. Compara el estado real de la base de datos de producción con el diseño esperado, detalla la estrategia de seguridad a nivel de Supabase/PostgreSQL y establece el orden de implementación y rollback.

---

## 1. ESTADO ACTUAL REAL DE SUPABASE

Tras auditar la instancia real en Supabase (`mbyjehhplruoqlgphfvw`), se documenta el esquema físico real:

### 1.1 Auth & Usuarios
- **Usuarios existentes**:
  1. `mdeviajob@gmail.com` (UUID: `6731b487-c90f-43d5-8118-c688c6ca00b4`)
  2. `migueldevia1003401157@gmail.com` (UUID: `8b0f4e09-b5b2-45f5-8308-1fb3c9c39488`)
- **Relación actual**: El usuario `mdeviajob@gmail.com` está mapeado en la tabla `public.admin_users`.
- **Mecanismo de autorización**: El frontend (`ProtectedRoute.jsx`) verifica la existencia del UUID en la tabla `admin_users` para dar permisos de `/admin`.

### 1.2 Tablas Físicas y RLS
- **`public.clientes`**:
  - Columnas: `id` (uuid, PK, default: `gen_random_uuid()`), `nombre` (text, nullable), `celular` (text, UNIQUE, not null), `email` (text, nullable), `stamps_count` (integer, default: `0`), `created_at` (timestamptz, default: `timezone('utc')`), `last_stamp_at` (timestamptz, nullable), `referral_code` (text, nullable), `referred_by` (uuid, FK -> `clientes.id`).
  - RLS: Habilitado.
    - `Allow public insert` / `Permitir inserción pública` (anon/authenticated).
    - `Permitir lectura pública` (anon/authenticated).
    - `Allow authenticated read` / `Allow authenticated update` (authenticated).
    - `Permitir actualización a admins` (authenticated, sin verificar `admin_users`).
- **`public.admin_users`**:
  - Columnas: `id` (uuid, PK), `email` (text, nullable).
  - RLS: Habilitado.
    - `Allow individual read own admin status` (`auth.uid() = id`).
- **`public.stamp_logs`**:
  - Columnas: `id` (uuid, PK), `client_id` (uuid, FK -> `clientes.id`), `created_at` (timestamptz), `notes` (text).
  - RLS: Habilitado.
    - `Admins can view / read-only` (cualquier usuario `authenticated`).
- **`public.redemptions`**:
  - Columnas: `id` (uuid, PK), `client_id` (uuid, FK -> `clientes.id`), `stamps_exchanged` (integer), `redeemed_at` (timestamptz).
  - RLS: Habilitado.
    - `Admins can view / read-only` (cualquier usuario `authenticated`).
- **`public.admin_audit_log`**:
  - Columnas: `id` (uuid, PK), `admin_id` (uuid, FK -> `auth.users.id`), `action` (text), `target_client_id` (uuid, FK -> `clientes.id`), `details` (jsonb), `created_at` (timestamptz).
  - RLS: Habilitado.
    - `Admins can view` (cualquier usuario `authenticated`).

### 1.3 Funciones / RPC Actuales
1. **`increment_stamps(client_id uuid)`**: Incrementa en 1 `stamps_count` del cliente e inserta registro en `stamp_logs`. (*Security Definer*, ejecutable por `PUBLIC`).
2. **`redeem_reward(client_id uuid)`**: Lockea la fila del cliente con `FOR UPDATE`, valida $\ge 10$ sellos, resta 10 sellos e inserta en `redemptions`. (*Security Definer*, ejecutable por `PUBLIC`).
3. **`trigger_check_referral_bonus()`**: Ejecutada `AFTER INSERT` en `stamp_logs`. Verifica si es el primer sello del referido y añade 1 sello al referidor. (*Security Definer*).
4. **`get_client_by_referral_code(ref_code text)`**: Retorna cliente por su código. (*Security Definer*).
5. **`generate_referral_code()`**: Helper de generación de código aleatorio.

---

## 2. ESTADO ESPERADO (MÓDULOS DE SEGURIDAD Y TABLAS)

El sistema operativo debe incorporar control transaccional de caja, inventario, ventas y trabajadores.

```text
  Nuevas Entidades:
  - perfiles_trabajadores (roles y tarifas)
  - turnos_trabajadores (asistencia y horas)
  - cuentas_financieras (bolsillos de caja)
  - movimientos_caja (ingresos, egresos, transferencias, ajustes)
  - pagos_venta (múltiples pagos por venta)
  - ventas (idempotencia y totalizador)
  - detalle_ventas (productos vendidos con costo histórico)
  - productos (catálogo)
  - insumos (materias primas y Kardex)
  - recetas (fórmula de ingredientes)
  - compras_insumos (egresos de inventario)
  - arqueos_caja (auditoría esperada vs real)
```

---

## 3. COMPARACIÓN Y DIFERENCIAS (CONTRATO 0.9 VS BASE REAL)

Clasificación de compatibilidad y ajustes de diseño:

### 3.1 Roles: 🟡 Requiere ajuste de diseño
* **Decisión en Contrato 0.9**: Rol `PROPIETARIO` separado de `ADMINISTRADOR`.
* **Auditoría de Campo**: Dado que los 3 administradores actuales son socios con el mismo nivel operacional en Titan Grill, crear un rol `PROPIETARIO` rígido es innecesario.
* **Propuesta Mejorada**: Mantener solo 2 roles base: `ADMINISTRADOR` y `TRABAJADOR`. Para las acciones ultra-críticas, se añade una columna booleana `super_usuario` (o `es_socio`) en la tabla `perfiles_trabajadores`, simplificando las políticas RLS a dos perfiles principales mientras se protege la configuración crítica.

### 3.2 Arqueo y Ajustes de Caja: 🟡 Requiere ajuste de diseño
* **Decisión en Contrato 0.9**: Crear automáticamente un `movimientos_caja` de tipo `AJUSTE_ARQUEO` al detectar diferencia.
* **Riesgo**: Si un cajero tiene un faltante y el sistema realiza el ajuste contable de forma automática, el descuadre se "limpia" contablemente sin aprobación.
* **Propuesta Mejorada**:
  1. El arqueo se registra con estado `PENDIENTE_CONCILIACION`.
  2. La diferencia se calcula y se almacena en `arqueos_caja.diferencia`.
  3. Un administrador debe revisar el arqueo y justificar la diferencia (ej. "Merma no registrada", "Sencillo extraviado").
  4. Al cambiar el estado a `APROBADO` (vía RPC autorizado para administradores), se gatilla el `movimientos_caja` de tipo `AJUSTE_ARQUEO` para conciliar el saldo contable al valor físico real.

### 3.3 Reversión de Sellos: 🟡 Requiere ajuste de diseño
* **Decisión en Contrato 0.9**: Permitir que `stamps_count` en la tabla `clientes` quede temporalmente en negativo.
* **Propuesta de Mejora (Historial de Eventos)**:
  - Eliminar la mutación directa sobre la columna `stamps_count` como fuente única de verdad.
  - La cantidad real de sellos del cliente debe ser la sumatoria de las filas en `stamp_logs`:
    $$	ext{Saldo} = \sum (	ext{sellos\_otorgados}) - \sum (	ext{sellos\_canjeados})$$
  - Ante una devolución total, se inserta una fila en `stamp_logs` con cantidad `-1` (tipo `REVERSION`). Si el saldo neto baja de 0 (por ejemplo, porque el cliente ya canjeó un premio), el balance del cliente reflejará `-1` de forma natural y transparente en el historial. El cliente no podrá canjear de nuevo hasta que vuelva a acumular 10 sellos netos.

### 3.4 Compatibilidad con Fidelización Existente: 🟢 Compatible
- Las tarjetas actuales leen `clientes.stamps_count`. Para evitar romper el frontend actual, mantendremos esta columna actualizada de forma redundante mediante un Trigger en la base de datos que escuche cambios en `stamp_logs` y mantenga `stamps_count` sincronizado con la suma de eventos del cliente.

---

## 4. RIESGOS Y MITIGACIÓN

1. **Vulnerabilidad de RPCs**: Actualmente `increment_stamps` y `redeem_reward` son accesibles por `PUBLIC`.
   - *Mitigación*: En el script de la Fase 1, revocaremos el privilegio `EXECUTE` a `PUBLIC` y lo asignaremos únicamente a `authenticated`. La lógica de la función verificará que el `auth.uid()` pertenezca a un perfil con rol `ADMINISTRADOR`.
2. **Doble Pago / Race Conditions**: Dos terminales registrando caja.
   - *Mitigación*: Utilizar aislamiento de transacción `SERIALIZABLE` en los RPCs de arqueo y cierre de venta.

---

## 5. MODELO DE SEGURIDAD RECOMENDADO

### 5.1 Roles de Acceso:
- **`TRABAJADOR`**:
  - Lectura: `productos` (catálogo), `clientes` (fidelización), sus propios turnos en `turnos_trabajadores`.
  - Escritura: `ventas` y `pagos_venta` (solo mediante RPC `registrar_venta`).
  - Denegado: Ver estado de caja, modificar recetas, ver reportes financieros, liquidar personal.
- **`ADMINISTRADOR`**:
  - Acceso completo a inventario, compras, recetas, movimientos de caja y liquidaciones.
  - Denegado: Modificar o eliminar logs de auditoría en `admin_audit_log`.

---

## 6. ESTRATEGIA DE MIGRACIÓN PASO A PASO

1. **Migración de Clientes**: La tabla `clientes` permanece idéntica en producción.
2. **Estructura Compatible de `stamp_logs`**: Se añaden las columnas `tipo`, `venta_id`, `otorgado_por`, `estado` y `motivo` como `nullable`. Los registros históricos quedan con `tipo = 'VENTA'` y `venta_id = NULL`, manteniendo compatibilidad absoluta.
3. **Trigger de Sincronización**: Creamos un trigger `trg_sync_stamps_count` que actualiza `clientes.stamps_count` ante inserciones en `stamp_logs`.

---

## 7. ORDEN EXACTO DE IMPLEMENTACIÓN (SQL QUE DEBERÁ CREARSE)

El siguiente es el script SQL de migración que se creará en la Fase 1 de implementación:

```sql
-- 1. Crear tabla perfiles_trabajadores (Seguridad y Personal)
CREATE TABLE public.perfiles_trabajadores (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('ADMINISTRADOR', 'TRABAJADOR')),
    es_socio BOOLEAN DEFAULT false,
    modalidad_pago TEXT NOT NULL CHECK (modalidad_pago IN ('POR_HORA', 'POR_VENTA', 'POR_TURNO')),
    tarifa NUMERIC(10,2) DEFAULT 0.00,
    comision_porcentaje NUMERIC(5,2) DEFAULT 0.00,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Crear tabla cuentas_financieras
CREATE TABLE public.cuentas_financieras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT UNIQUE NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Crear tabla movimientos_caja
CREATE TABLE public.movimientos_caja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id UUID NOT NULL REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
    tipo TEXT NOT NULL CHECK (tipo IN ('INGRESO_VENTA', 'EGRESO_COMPRA', 'EGRESO_GASTO', 'EGRESO_NOMINA', 'TRANSFERENCIA_EGRESO', 'TRANSFERENCIA_INGRESO', 'AJUSTE_ARQUEO')),
    monto NUMERIC(12,2) NOT NULL,
    origen_id UUID,
    descripcion TEXT,
    creado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Modificar stamp_logs para trazabilidad extendida
ALTER TABLE public.stamp_logs 
    ADD COLUMN tipo TEXT DEFAULT 'VENTA' CHECK (tipo IN ('VENTA', 'REFERIDO', 'MANUAL', 'PROMOCIONAL', 'REVERSION')),
    ADD COLUMN venta_id UUID,
    ADD COLUMN otorgado_por UUID REFERENCES auth.users(id),
    ADD COLUMN estado TEXT DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'REVERTIDO')),
    ADD COLUMN motivo TEXT;

-- 5. Crear trigger para mantener stamps_count sincronizado
CREATE OR REPLACE FUNCTION public.sync_stamps_count()
RETURNS trigger AS $$
BEGIN
    UPDATE public.clientes
    SET stamps_count = COALESCE((
        SELECT SUM(CASE WHEN tipo = 'REVERSION' THEN -1 ELSE 1 END)
        FROM public.stamp_logs
        WHERE client_id = COALESCE(NEW.client_id, OLD.client_id) AND estado = 'ACTIVO'
    ), 0)
    WHERE id = COALESCE(NEW.client_id, OLD.client_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_stamps_count
AFTER INSERT OR UPDATE ON public.stamp_logs
FOR EACH ROW EXECUTE FUNCTION public.sync_stamps_count();
```

---

## 8. PLAN DE RETROCESO (ROLLBACK)

Si la implementación de la Fase 1 falla o corrompe datos:
1. Eliminar las nuevas tablas de soporte transaccional:
   `DROP TABLE IF EXISTS public.movimientos_caja, public.cuentas_financieras, public.perfiles_trabajadores;`
2. Remover las columnas añadidas a `stamp_logs`:
   `ALTER TABLE public.stamp_logs DROP COLUMN IF EXISTS tipo, DROP COLUMN IF EXISTS venta_id, DROP COLUMN IF EXISTS otorgado_por, DROP COLUMN IF EXISTS estado, DROP COLUMN IF EXISTS motivo;`
3. Eliminar el trigger de sincronización:
   `DROP TRIGGER IF EXISTS trg_sync_stamps_count ON public.stamp_logs; DROP FUNCTION IF EXISTS public.sync_stamps_count();`

---

## CONFIRMACIÓN DE RESTRICCIONES DE FASE

> NO SE MODIFICÓ CÓDIGO DE LA APLICACIÓN.
> NO SE MODIFICÓ LA BASE DE DATOS DE SUPABASE.
> NO SE CREARON TABLAS NI MIGRACIONES.
> NO SE MODIFICARON RLS NI RPC.
> NO SE REALIZARON COMMITS NI PUSHES EN GIT.
