# TITAN GRILL — PREPARACIÓN FINAL DE MIGRACIÓN DE PRODUCCIÓN
## Fase 1.5 · Documento Maestro — SOLO LECTURA / SOLO DISEÑO

> **Modo**: ANÁLISIS Y DISEÑO PURO.
> **Fecha**: 2026-08-07
> **Auditor**: Antigravity AI
> **Confirmación al cierre**: Ver Sección 12.

---

## RESUMEN EJECUTIVO

La Fase 1.5 auditó el estado real de producción de Titan Grill y lo contrastó contra el Contrato Técnico (Fase 0.9). El sistema actual es funcional pero inmaduro en seguridad. La migración requerida es quirúrgica: **ningún dato de cliente se perderá**, el frontend actual funcionará sin cambios de código durante la transición, y el riesgo operacional es bajo dado que hay 0 canjes y 14 clientes.

**Hallazgo más crítico**: Las RPCs `increment_stamps` y `redeem_reward` son ejecutables por **cualquier usuario anónimo** de internet. Esto es el riesgo de seguridad #1 y debe corregirse como prioridad absoluta.

**Hallazgo inesperado**: Existe un trigger `trg_check_referral_bonus` sobre `stamp_logs` que nunca fue documentado en fases anteriores. Este trigger dispara automáticamente un sello de bono al referidor cuando se inserta el primer log de un cliente referido. **Los 2 INSERT de reconciliación de Fase 1.4 podrían disparar este trigger** si no se controla. Esto cambia el diseño del script de reconciliación.

---

## PARTE 1 — AUDITORÍA FÍSICA FINAL

### 1.1 Tabla `clientes`

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|:--------:|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `nombre` | text | **YES** | — | ⚠️ Permite NULL |
| `celular` | text | NO | — | UNIQUE no declarado formalmente |
| `email` | text | YES | — | Opcional |
| `stamps_count` | integer | **YES** | `0` | ⚠️ Nullable + sin CHECK ≥ 0 |
| `created_at` | timestamptz | YES | `timezone('utc', now())` | |
| `last_stamp_at` | timestamptz | YES | — | No se actualiza automáticamente ⚠️ |
| `referral_code` | text | YES | — | UNIQUE — generado por trigger |
| `referred_by` | uuid | YES | — | FK → `clientes.id` (auto-referencia) |

**Constraints detectados:**
- PK: `clientes_pkey` (id)
- UNIQUE: `clientes_referral_code_key` (referral_code)
- FK: `clientes_referred_by_fkey` → `clientes.id`

**Trigger sobre INSERT:**
- `set_referral_code` BEFORE INSERT → `generate_referral_code()` — asigna código único de 8 chars.

**Columnas del Contrato 0.9 AUSENTES en producción:**
- No existe `updated_at`
- `last_stamp_at` existe pero **no se actualiza** en `increment_stamps` (bug latente)
- `stamps_count` debería tener `CHECK (stamps_count >= 0)` — actualmente no tiene

---

### 1.2 Tabla `stamp_logs`

**Esquema actual real:**

| Columna | Tipo | Nullable | Default |
|---------|------|:--------:|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `client_id` | uuid | YES | — |
| `created_at` | timestamptz | YES | `now()` |
| `notes` | text | YES | — |

**Trigger sobre INSERT:**
- `trg_check_referral_bonus` AFTER INSERT → `trigger_check_referral_bonus()` — premia al referidor con 1 sello si es el primer log del cliente referido.

**Columnas del Contrato 0.9 COMPLETAMENTE AUSENTES:**

| Campo del Contrato | Estado en producción |
|--------------------|---------------------|
| `tipo` (VENTA/REFERIDO/MANUAL/PROMOCIONAL/PAGO_DEUDA/MIGRACION) | ❌ No existe |
| `venta_id` (FK → ventas.id) | ❌ No existe |
| `otorgado_por` (FK → auth.users.id) | ❌ No existe |
| `motivo` | ❌ No existe |
| `estado` (ACTIVO/REVERTIDO) | ❌ No existe |

**Solo existe**: `notes` (text libre, nullable) — equivale parcialmente al campo `motivo` pero sin estructura.

**FK de `client_id`**: Existe FK → `clientes.id` pero `client_id` es **NULLABLE** — permite logs huérfanos sin cliente.

---

### 1.3 Tabla `redemptions`

| Columna | Tipo | Nullable | Default |
|---------|------|:--------:|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `client_id` | uuid | YES | — |
| `stamps_exchanged` | integer | NO | — |
| `redeemed_at` | timestamptz | YES | `now()` |

**Registros actuales**: **0** (tabla vacía, confirmado).
**FK**: `redemptions_client_id_fkey` → `clientes.id`.
**Ausente del Contrato 0.9**: No existe columna `otorgado_por`, ni `premio_id`, ni `estado`.

---

### 1.4 Tabla `admin_users`

| Columna | Tipo | Nullable | Default |
|---------|------|:--------:|---------|
| `id` | uuid | NO | — |
| `email` | text | YES | — |

**Constraints**: PK(`id`), UNIQUE(`email`), FK(`id`) → `auth.users.id`.
**RLS**: Habilitado. Policy: usuario autenticado puede leer únicamente su propio registro (`auth.uid() = id`).
**Registro único**: 1 admin (`mdeviajob@gmail.com`).
**Relación con el Contrato 0.9**: Esta tabla es el mecanismo actual de identificación de admins. El Contrato 0.9 la reemplaza con `perfiles_trabajadores`. La migración deberá hacerse en paralelo para no romper el login actual.

---

## PARTE 2 — AUDITORÍA DE RPC

### 2.1 `increment_stamps`

```sql
-- DEFINICIÓN REAL (READ-ONLY — NO EJECUTAR)
CREATE OR REPLACE FUNCTION public.increment_stamps(client_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stamps int;
  updated_row clientes%rowtype;
BEGIN
  SELECT stamps_count INTO current_stamps FROM clientes WHERE id = client_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Cliente no encontrado');
  END IF;

  UPDATE clientes 
  SET stamps_count = stamps_count + 1 
  WHERE id = client_id 
  RETURNING * INTO updated_row;

  INSERT INTO public.stamp_logs (client_id, notes)
  VALUES (client_id, 'Sello escaneado por admin');

  RETURN json_build_object(
    'success', true,
    'new_count', updated_row.stamps_count,
    'is_reward_ready', (updated_row.stamps_count >= 10)
  );
END;
$$;
```

**Análisis de seguridad y comportamiento:**

| Atributo | Valor Real | Riesgo |
|----------|-----------|--------|
| `SECURITY DEFINER` | SÍ | La función corre con permisos del dueño (postgres/service_role) |
| `EXECUTE TO PUBLIC` | SÍ | **CRÍTICO**: Cualquier usuario anónimo puede llamarla |
| `EXECUTE TO anon` | SÍ | **CRÍTICO**: Confirma acceso sin autenticación |
| Valida autenticación | NO | No verifica `auth.uid()` |
| Valida que caller sea admin | NO | Cualquiera con el UUID de un cliente puede dar sellos |
| Actualiza `stamps_count` directamente | SÍ | Sin pasar por check de atomicidad con FOR UPDATE |
| Crea `stamp_logs` | SÍ | ✅ Correcto — genera trazabilidad |
| Actualiza `last_stamp_at` | NO | Bug: el campo existe pero nunca se actualiza |
| `search_path` fijado | NO | Vulnerable a search_path injection |
| Dispara `trg_check_referral_bonus` | SÍ (indirectamente) | El INSERT en stamp_logs dispara el trigger |

**Vías de bypass identificadas:**
1. Cualquier persona con el UUID de un cliente (obtenible del QR público) puede hacer `POST /rpc/increment_stamps` desde curl/Postman y dar sellos ilimitados.
2. El QR del cliente contiene su UUID en la URL pública: `origen/login?clientId=<uuid>`. Este UUID es suficiente para llamar la RPC sin autenticación.

---

### 2.2 `redeem_reward`

```sql
-- DEFINICIÓN REAL (READ-ONLY — NO EJECUTAR)
CREATE OR REPLACE FUNCTION public.redeem_reward(client_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stamps int;
  new_stamps int;
  surplus int;
BEGIN
  SELECT stamps_count INTO current_stamps 
  FROM public.clientes WHERE id = client_id FOR UPDATE; -- ✅ Row lock presente

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Cliente no encontrado');
  END IF;

  IF current_stamps < 10 THEN
    RETURN json_build_object('success', false, 'message', 'No tiene suficientes sellos (Mínimo 10)');
  END IF;

  surplus := current_stamps - 10;
  new_stamps := surplus;

  UPDATE public.clientes SET stamps_count = new_stamps WHERE id = client_id;
  INSERT INTO public.redemptions (client_id, stamps_exchanged) VALUES (client_id, 10);

  RETURN json_build_object('success', true, 'message', 'Premio canjeado con éxito', 'new_count', new_stamps);
END;
$$;
```

| Atributo | Valor Real | Riesgo |
|----------|-----------|--------|
| `SECURITY DEFINER` | SÍ | Corre con privilegios elevados |
| `EXECUTE TO PUBLIC` / `anon` | SÍ | **CRÍTICO**: Cualquiera puede canjear si tiene UUID y cliente tiene ≥ 10 sellos |
| `FOR UPDATE` row lock | SÍ | ✅ Correcto — previene race conditions |
| Valida autenticación | NO | No verifica `auth.uid()` |
| Valida que caller sea admin | NO | Sin control |
| Registra en `redemptions` | SÍ | ✅ Correcto |
| `search_path` fijado | NO | Vulnerable |

---

### 2.3 Funciones de Trigger

#### `generate_referral_code()` (BEFORE INSERT en `clientes`)
Genera código único de 8 caracteres (charset sin 0, O, 1, I). Detecta colisiones con loop WHILE. Asigna `NEW.referral_code`. **Seguro y correcto.**

#### `trigger_check_referral_bonus()` (AFTER INSERT en `stamp_logs`)
Lógica crítica no documentada anteriormente:
1. Recupera `stamps_count`, `referred_by`, `nombre` del cliente del nuevo log.
2. Si el cliente tiene `referred_by IS NOT NULL` y `referred_by != client_id`:
3. Cuenta los logs del cliente. Si `stamps_count = 1` AND `COUNT(logs) = 1` → **Es el primer sello**.
4. Hace `UPDATE clientes SET stamps_count = stamps_count + 1 WHERE id = v_referred_by`.
5. Inserta en `stamp_logs` para el referidor con nota `'Bono por referido: <nombre_cliente>'`.

> [!CAUTION]
> **Implicación directa para reconciliación**: Si Valentina o Sthefanie Pacheco tienen un referidor (`referred_by` no nulo), insertar su primer log de reconciliación disparará automáticamente este trigger y dará un sello extra al referidor. Verificación necesaria antes de cualquier INSERT.

---

## PARTE 3 — AUDITORÍA DE SEGURIDAD

### 3.1 Estado de RLS por tabla

| Tabla | RLS Habilitado |
|-------|:-------------:|
| `clientes` | ✅ SÍ |
| `stamp_logs` | ✅ SÍ |
| `redemptions` | ✅ SÍ |
| `admin_users` | ✅ SÍ |

### 3.2 Matriz de Políticas Real

#### `clientes`

| Policy | Rol | Operación | Condición |
|--------|-----|-----------|-----------|
| Permitir lectura pública | public | SELECT | `true` (sin restricción) |
| Allow authenticated read | public | SELECT | `auth.role() = 'authenticated'` |
| Allow public insert | public | INSERT | `true` |
| Permitir inserción pública | public | INSERT | `true` |
| Allow authenticated update | public | UPDATE | `auth.role() = 'authenticated'` |
| Permitir actualización a admins | authenticated | UPDATE | `true` |

> [!WARNING]
> **Políticas duplicadas y solapadas**: Existen 2 políticas de SELECT (una para public con `true`, otra para authenticated), 2 de INSERT y 2 de UPDATE. Esto genera confusión y la política más permisiva siempre gana en modo PERMISSIVE. Resultado: **cualquier usuario anónimo puede leer y crear clientes sin restricción**.

#### `stamp_logs`

| Policy | Operación | Condición |
|--------|-----------|-----------|
| Admins can view stamp_logs | SELECT | `auth.role() = 'authenticated'` |
| Admins read-only stamp_logs | SELECT | `auth.role() = 'authenticated'` |

> ⚠️ Sin política de INSERT directa — pero la función RPC SECURITY DEFINER puede escribir aquí ignorando RLS.

#### `redemptions`

| Policy | Operación | Condición |
|--------|-----------|-----------|
| Admins can view redemptions | SELECT | `auth.role() = 'authenticated'` |
| Admins read-only redemptions | SELECT | `auth.role() = 'authenticated'` |

> ⚠️ Sin política de INSERT directa — el RPC SECURITY DEFINER bypasea RLS.

#### `admin_users`

| Policy | Operación | Condición |
|--------|-----------|-----------|
| Allow individual read own admin status | SELECT | `auth.uid() = id` |

✅ La más restrictiva de todas. Solo puede leer quien es admin.

### 3.3 Matriz de Permisos Efectivos por Rol

| Recurso | Operación | `anon` | `authenticated` (no-admin) | `authenticated` (admin) |
|---------|-----------|:------:|:--------------------------:|:-----------------------:|
| `clientes` | SELECT | ✅ SÍ | ✅ SÍ | ✅ SÍ |
| `clientes` | INSERT | ✅ SÍ | ✅ SÍ | ✅ SÍ |
| `clientes` | UPDATE | ❌ NO | ✅ SÍ | ✅ SÍ |
| `clientes` | DELETE | ❌ NO | ❌ NO | ❌ NO |
| `stamp_logs` | SELECT | ❌ NO | ✅ SÍ | ✅ SÍ |
| `stamp_logs` | INSERT | ❌ NO | ❌ NO* | ✅ vía RPC |
| `redemptions` | SELECT | ❌ NO | ✅ SÍ | ✅ SÍ |
| `redemptions` | INSERT | ❌ NO | ❌ NO* | ✅ vía RPC |
| `admin_users` | SELECT | ❌ NO | propio | propio |
| `increment_stamps` | EXECUTE | ✅ **SÍ** 🔴 | ✅ **SÍ** 🔴 | ✅ SÍ |
| `redeem_reward` | EXECUTE | ✅ **SÍ** 🔴 | ✅ **SÍ** 🔴 | ✅ SÍ |

*El RPC bypasea RLS porque es SECURITY DEFINER.

> [!CAUTION]
> Las celdas 🔴 representan los vectores de ataque más críticos. Cualquier persona con acceso a internet y el UUID de un cliente puede ejecutar `increment_stamps` o `redeem_reward`.

---

## PARTE 4 — COMPATIBILIDAD CON EL CONTRATO 0.9

### 4.1 Brecha en `stamp_logs`

| Campo requerido por Contrato 0.9 | ¿Existe? | Tipo propuesto | Impacto si se agrega |
|----------------------------------|:--------:|----------------|---------------------|
| `tipo` | ❌ No | `text NOT NULL DEFAULT 'MANUAL'` | Requiere migrar notas actuales |
| `venta_id` | ❌ No | `uuid NULLABLE FK → ventas.id` | Ninguno hasta tener tabla ventas |
| `otorgado_por` | ❌ No | `uuid NULLABLE FK → auth.users.id` | Los logs históricos quedan con NULL |
| `motivo` | ❌ No | `text NULLABLE` | Sin impacto |
| `estado` | ❌ No | `text NOT NULL DEFAULT 'ACTIVO'` | Requiere un CHECK constraint |
| `notes` | ✅ Sí | text NULLABLE | Conservar para compatibilidad con trigger y RPC existentes |

### 4.2 Mapa de Contradicciones Documentadas

> [!IMPORTANT]
> Las siguientes contradicciones requieren decisión explícita antes de implementar.

| # | Contradicción | Origen A | Origen B | Decisión propuesta |
|---|---------------|----------|----------|-------------------|
| C1 | `nombre` en `clientes` permite NULL pero toda la UX lo muestra | Esquema real | Contrato 0.9 | Agregar `NOT NULL` en migración, validar código |
| C2 | `stamps_count` no tiene `CHECK >= 0` | Esquema real | Contrato 0.9 § devoluciones | Agregar CHECK en migración |
| C3 | `last_stamp_at` existe pero `increment_stamps` no la actualiza | Código RPC real | Diseño esperado | Corregir en RPC hardening |
| C4 | `increment_stamps` no registra `otorgado_por` | RPC actual | Contrato 0.9 §5.1 | Agregar parámetro en nueva versión de RPC |
| C5 | El trigger `trg_check_referral_bonus` da sello directamente al referidor sin pasar por `increment_stamps` | Trigger real | Contrato 0.9 §4 (1 venta elegible = 1 sello) | El bono de referido es correcto; documentar como tipo REFERIDO |
| C6 | Existe `admin_users` pero el Contrato 0.9 usa `perfiles_trabajadores` | Implementación actual | Contrato 0.9 §1 | Migración en paralelo (ver Parte 8) |
| C7 | RPC `redeem_reward` no registra `otorgado_por` ni tipo en `redemptions` | RPC real | Contrato 0.9 §6 | Enriquecer tabla y RPC |

---

## PARTE 5 — DECISIÓN SOBRE LOS 2 SELLOS HUÉRFANOS

**Clientes afectados:**
- **Valentina** (id: `25f18bce`) — `stamps_count=1`, `referred_by=NULL`, `logs=0`
- **Sthefanie Pacheco** (id: `b486553d`) — `stamps_count=1`, `referred_by=NULL`, `logs=0`

Verificación clave: **Ambos clientes tienen `referred_by = NULL`** → El trigger `trg_check_referral_bonus` NO se disparará para estos clientes (requiere `referred_by IS NOT NULL`). ✅ Los INSERTs son seguros en ese aspecto.

### Opción A: INSERT directo con esquema actual (como propuso Fase 1.4)
```sql
-- NO EJECUTAR — SOLO DISEÑO
INSERT INTO public.stamp_logs (client_id, notes, created_at) VALUES
  ('25f18bce-22b3-4395-81ca-1daed8d305ae',
   'Sello histórico reconciliado — Origen: asignación manual sin log original',
   '2026-04-24 21:30:54+00'),
  ('b486553d-c985-469d-b2a0-ec25f873b6fa',
   'Sello histórico reconciliado — Origen: asignación manual sin log original',
   '2026-05-09 00:02:17+00');
```
- ✅ **Ventaja**: Simple. Funciona con el esquema actual. No rompe nada.
- ⚠️ **Riesgo**: Si se ejecuta ANTES de agregar la columna `tipo`, los logs de reconciliación quedarán sin tipo y requerirán un UPDATE posterior.
- ⚠️ **Riesgo**: Dispara el trigger `trg_check_referral_bonus` — aunque en este caso no hay referidor (`referred_by=NULL`) por lo que el trigger verifica y no hace nada. ✅ Confirmado seguro.

### Opción B: INSERT adaptado al nuevo esquema (DESPUÉS de agregar columnas)
```sql
-- NO EJECUTAR — SOLO DISEÑO
INSERT INTO public.stamp_logs (client_id, tipo, motivo, estado, notes, created_at) VALUES
  ('25f18bce-22b3-4395-81ca-1daed8d305ae',
   'MIGRACION', 'Reconciliación histórica Fase 1.4 — sello sin log de origen', 'ACTIVO',
   'Sello histórico reconciliado — Origen: asignación manual sin log original',
   '2026-04-24 21:30:54+00'),
  ('b486553d-c985-469d-b2a0-ec25f873b6fa',
   'MIGRACION', 'Reconciliación histórica Fase 1.4 — sello sin log de origen', 'ACTIVO',
   'Sello histórico reconciliado — Origen: asignación manual sin log original',
   '2026-05-09 00:02:17+00');
```
- ✅ **Ventaja**: Los logs quedan completos desde el primer día. Máxima trazabilidad.
- ✅ El tipo `MIGRACION` es inequívoco — nunca se confundirá con una venta real.
- ⚠️ **Riesgo**: Debe ejecutarse DESPUÉS de la migración estructural de `stamp_logs`.

### Opción C: Dentro de una migración transaccional completa
Los INSERTs de reconciliación van dentro de la misma transacción que altera el esquema:
```sql
-- NO EJECUTAR — SOLO DISEÑO
BEGIN;
  -- Paso 1: Agregar columnas
  ALTER TABLE stamp_logs ADD COLUMN tipo text NOT NULL DEFAULT 'MANUAL';
  -- ... resto de columnas ...
  -- Paso 2: Insertar logs de reconciliación
  INSERT INTO stamp_logs (...) VALUES (...);
  -- Paso 3: Hardening de RPC
  -- ...
COMMIT;
```
- ✅ **Ventaja**: Atómica. Si cualquier paso falla, todo se revierte.
- ✅ Máxima seguridad para producción.
- ⚠️ Más complejo de redactar y revisar.

### Opción D: No insertar logs retroactivos — solo documentar
Dejar los 2 sellos como "deuda histórica documentada" sin crear logs falsos.
- ✅ Más honesto: no se inventa nada.
- ❌ El `delta` siempre será +1 para esos clientes, imposibilitando validaciones futuras.
- ❌ No es compatible con el modelo de trazabilidad total del Contrato 0.9.

### **Decisión Recomendada: Opción C (migración transaccional) con tipo `MIGRACION`**

Los logs deben crearse con `tipo = 'MIGRACION'` como parte de la misma transacción que amplía el esquema, garantizando atomicidad y máxima trazabilidad. **El evento debe identificarse explícitamente como reconciliación histórica**, jamás como una venta o sello manual ordinario.

---

## PARTE 6 — DISEÑO DE LA PRIMERA MIGRACIÓN REAL

> [!CAUTION]
> **TODO EL SQL SIGUIENTE ES DISEÑO ÚNICAMENTE — NO EJECUTAR**
> Cada bloque está marcado con `-- NO EJECUTAR`.

### Orden de Ejecución (9 pasos en 1 transacción)

El orden minimiza el riesgo: primero se valida el estado actual, luego se amplía sin romper, luego se restringe.

---

#### PASO 0 — VALIDACIÓN PREVIA (fuera de la transacción principal)

```sql
-- NO EJECUTAR — VERIFICACIÓN PREVIA
-- Ejecutar READ-ONLY para confirmar estado antes de migrar

-- Verificar conteos
SELECT COUNT(*) FROM clientes;        -- Esperado: 14
SELECT COUNT(*) FROM stamp_logs;      -- Esperado: 13
SELECT COUNT(*) FROM redemptions;     -- Esperado: 0
SELECT SUM(stamps_count) FROM clientes; -- Esperado: 15

-- Verificar que nadie tenga stamps_count < 0
SELECT COUNT(*) FROM clientes WHERE stamps_count < 0; -- Esperado: 0

-- Verificar los 2 clientes inconsistentes
SELECT nombre, stamps_count FROM clientes
WHERE id IN (
  '25f18bce-22b3-4395-81ca-1daed8d305ae',
  'b486553d-c985-469d-b2a0-ec25f873b6fa'
); -- Esperado: stamps_count = 1 para ambos

-- Verificar que no tienen referidor
SELECT nombre, referred_by FROM clientes
WHERE id IN (
  '25f18bce-22b3-4395-81ca-1daed8d305ae',
  'b486553d-c985-469d-b2a0-ec25f873b6fa'
); -- Esperado: referred_by = NULL para ambos
```

---

#### PASO 1 — AMPLIAR `stamp_logs` (sin romper lo existente)

```sql
-- NO EJECUTAR — SOLO DISEÑO
BEGIN;

-- 1a: Agregar columna 'tipo' con default para no romper inserts existentes
ALTER TABLE public.stamp_logs 
  ADD COLUMN tipo text NOT NULL DEFAULT 'MANUAL';

-- 1b: Agregar columna 'estado' con default
ALTER TABLE public.stamp_logs 
  ADD COLUMN estado text NOT NULL DEFAULT 'ACTIVO';

-- 1c: Agregar columna 'otorgado_por' (nullable — histórico no tiene este dato)
ALTER TABLE public.stamp_logs 
  ADD COLUMN otorgado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 1d: Agregar columna 'motivo' (nullable)
ALTER TABLE public.stamp_logs 
  ADD COLUMN motivo text;

-- 1e: Agregar columna 'venta_id' (nullable — para futura integración con ventas)
ALTER TABLE public.stamp_logs 
  ADD COLUMN venta_id uuid;

-- 1f: Agregar CHECK constraints
ALTER TABLE public.stamp_logs 
  ADD CONSTRAINT stamp_logs_tipo_check 
  CHECK (tipo IN ('VENTA','REFERIDO','MANUAL','PROMOCIONAL','PAGO_DEUDA','MIGRACION'));

ALTER TABLE public.stamp_logs 
  ADD CONSTRAINT stamp_logs_estado_check 
  CHECK (estado IN ('ACTIVO','REVERTIDO'));

-- Hacer client_id NOT NULL (todos los logs actuales tienen client_id)
ALTER TABLE public.stamp_logs 
  ALTER COLUMN client_id SET NOT NULL;

COMMIT;
```

**Dependencias**: Ninguna. Esta operación es aditiva y no rompe el RPC ni el trigger existente.

---

#### PASO 2 — ACTUALIZAR LOGS EXISTENTES (clasificar los 13 logs históricos)

```sql
-- NO EJECUTAR — SOLO DISEÑO
BEGIN;

-- Clasificar los 12 logs del trigger de bono de referido como REFERIDO
UPDATE public.stamp_logs
SET tipo = 'MANUAL'
WHERE notes = 'Sello escaneado por admin'
  AND tipo = 'MANUAL'; -- Son ya MANUAL por default, solo confirmar

-- Los logs con nota de bono de referido
UPDATE public.stamp_logs
SET tipo = 'REFERIDO'
WHERE notes LIKE 'Bono por referido:%';

COMMIT;
```

---

#### PASO 3 — RECONCILIACIÓN HISTÓRICA (los 2 sellos huérfanos)

```sql
-- NO EJECUTAR — SOLO DISEÑO
BEGIN;

-- Insertar logs de reconciliación para Valentina y Sthefanie Pacheco
INSERT INTO public.stamp_logs 
  (client_id, tipo, motivo, estado, notes, created_at)
VALUES
  (
    '25f18bce-22b3-4395-81ca-1daed8d305ae',
    'MIGRACION',
    'Reconciliación histórica Fase 1.4 — sello asignado antes del sistema de logs',
    'ACTIVO',
    'Sello histórico reconciliado — Origen: asignación manual sin log original',
    '2026-04-24 21:30:54+00'
  ),
  (
    'b486553d-c985-469d-b2a0-ec25f873b6fa',
    'MIGRACION',
    'Reconciliación histórica Fase 1.4 — sello asignado antes del sistema de logs',
    'ACTIVO',
    'Sello histórico reconciliado — Origen: asignación manual sin log original',
    '2026-05-09 00:02:17+00'
  );

-- NOTA: El trigger trg_check_referral_bonus se disparará pero no actuará
-- porque referred_by = NULL para ambos clientes. Verificado en Fase 1.4.

COMMIT;
```

---

#### PASO 4 — PROTECCIÓN DE `stamps_count`

```sql
-- NO EJECUTAR — SOLO DISEÑO
BEGIN;

-- Agregar check constraint para impedir valores negativos
ALTER TABLE public.clientes 
  ADD CONSTRAINT clientes_stamps_count_non_negative 
  CHECK (stamps_count >= 0);

-- Agregar columna updated_at (faltante del Contrato 0.9)
ALTER TABLE public.clientes 
  ADD COLUMN updated_at timestamptz DEFAULT now();

COMMIT;
```

---

#### PASO 5 — ENDURECIMIENTO DE RPCs

```sql
-- NO EJECUTAR — SOLO DISEÑO

-- Revocar EXECUTE a PUBLIC y anon
REVOKE EXECUTE ON FUNCTION public.increment_stamps(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_stamps(uuid) FROM anon;

REVOKE EXECUTE ON FUNCTION public.redeem_reward(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_reward(uuid) FROM anon;

-- Otorgar solo a authenticated
GRANT EXECUTE ON FUNCTION public.increment_stamps(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated;

-- Reemplazar increment_stamps con versión con validación de admin
-- (Requiere que perfiles_trabajadores exista para verificar admin)
-- Por ahora: validación contra admin_users
CREATE OR REPLACE FUNCTION public.increment_stamps(client_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- Fijar search_path
AS $$
DECLARE
  current_stamps int;
  updated_row clientes%rowtype;
  is_admin boolean;
BEGIN
  -- NUEVO: Verificar que el caller está autenticado y es admin
  SELECT EXISTS(
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  ) INTO is_admin;
  
  IF NOT is_admin THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol de administrador');
  END IF;

  SELECT stamps_count INTO current_stamps FROM clientes WHERE id = client_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Cliente no encontrado');
  END IF;

  UPDATE clientes 
  SET stamps_count = stamps_count + 1,
      last_stamp_at = now()  -- NUEVO: actualizar last_stamp_at
  WHERE id = client_id 
  RETURNING * INTO updated_row;

  INSERT INTO public.stamp_logs (client_id, tipo, otorgado_por, notes)
  VALUES (client_id, 'MANUAL', auth.uid(), 'Sello escaneado por admin');

  RETURN json_build_object(
    'success', true,
    'new_count', updated_row.stamps_count,
    'is_reward_ready', (updated_row.stamps_count >= 10)
  );
END;
$$;
```

---

#### PASO 6 — ENDURECIMIENTO DE RLS EN `clientes`

```sql
-- NO EJECUTAR — SOLO DISEÑO

-- Eliminar políticas duplicadas y permisivas
DROP POLICY IF EXISTS "Permitir lectura pública" ON public.clientes;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.clientes;
DROP POLICY IF EXISTS "Allow public insert" ON public.clientes;
DROP POLICY IF EXISTS "Permitir inserción pública" ON public.clientes;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.clientes;
DROP POLICY IF EXISTS "Permitir actualización a admins" ON public.clientes;

-- Nueva política: lectura pública (necesaria para que el cliente vea su tarjeta)
CREATE POLICY "clientes_select_public"
ON public.clientes FOR SELECT TO public USING (true);

-- Nueva política: INSERT solo para usuarios anon/authenticated (registro desde app)
CREATE POLICY "clientes_insert_public"
ON public.clientes FOR INSERT TO public WITH CHECK (true);

-- Nueva política: UPDATE solo para admins autenticados
CREATE POLICY "clientes_update_admin_only"
ON public.clientes FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));
```

---

#### PASO 7 — RLS PARA `stamp_logs` Y `redemptions`

```sql
-- NO EJECUTAR — SOLO DISEÑO

-- stamp_logs: solo admins autenticados pueden leer
DROP POLICY IF EXISTS "Admins can view stamp_logs" ON public.stamp_logs;
DROP POLICY IF EXISTS "Admins read-only stamp_logs" ON public.stamp_logs;

CREATE POLICY "stamp_logs_select_admin"
ON public.stamp_logs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- redemptions: solo admins autenticados pueden leer
DROP POLICY IF EXISTS "Admins can view redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Admins read-only redemptions" ON public.redemptions;

CREATE POLICY "redemptions_select_admin"
ON public.redemptions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));
```

---

#### PASO 8 — ÍNDICES DE RENDIMIENTO

```sql
-- NO EJECUTAR — SOLO DISEÑO
CREATE INDEX IF NOT EXISTS idx_stamp_logs_client_id ON public.stamp_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_stamp_logs_created_at ON public.stamp_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_redemptions_client_id ON public.redemptions(client_id);
CREATE INDEX IF NOT EXISTS idx_clientes_celular ON public.clientes(celular);
```

---

#### PASO 9 — VALIDACIÓN POST-MIGRACIÓN

```sql
-- NO EJECUTAR — SOLO DISEÑO (Ejecutar READ-ONLY después de migrar)

-- Verificar conteos finales
SELECT COUNT(*) FROM clientes;           -- Esperado: 14
SELECT COUNT(*) FROM stamp_logs;         -- Esperado: 15 (13 originales + 2 reconciliados)
SELECT COUNT(*) FROM redemptions;        -- Esperado: 0
SELECT SUM(stamps_count) FROM clientes;  -- Esperado: 15

-- Verificar que los 2 clientes reconciliados tienen delta = 0
SELECT c.nombre, c.stamps_count,
       (SELECT COUNT(*) FROM stamp_logs sl WHERE sl.client_id = c.id) as logs_count,
       c.stamps_count - (SELECT COUNT(*) FROM stamp_logs sl WHERE sl.client_id = c.id) as delta
FROM clientes c
WHERE c.id IN (
  '25f18bce-22b3-4395-81ca-1daed8d305ae',
  'b486553d-c985-469d-b2a0-ec25f873b6fa'
); -- Esperado: delta = 0 para ambos

-- Verificar distribución de tipos en stamp_logs
SELECT tipo, COUNT(*) FROM stamp_logs GROUP BY tipo ORDER BY tipo;
-- Esperado: MANUAL=13, MIGRACION=2

-- Verificar que no existe anon con EXECUTE en RPCs
SELECT grantee, routine_name FROM information_schema.role_routine_grants
WHERE routine_name IN ('increment_stamps','redeem_reward')
  AND grantee IN ('anon','PUBLIC');
-- Esperado: 0 filas
```

---

## PARTE 7 — COMPATIBILIDAD HACIA ATRÁS

### 7.1 Análisis de impacto por componente

| Componente | Dependencia | Impacto de migración | Acción requerida |
|-----------|-------------|---------------------|-----------------|
| `LoyaltyCard.jsx` | `SELECT * FROM clientes WHERE id = ?` | ✅ Ninguno — solo lee |  Ninguna |
| `Login.jsx` | `rpc('increment_stamps', {client_id})` | ⚠️ CRÍTICO: Si el admin no está autenticado al llamar, fallará | Ninguna — el flujo ya autentica antes |
| `AdminDashboard.jsx` | `SELECT stamps_count FROM clientes` | ✅ Ninguno |  Ninguna |
| `AdminDashboard.jsx` | `rpc('redeem_reward', {client_id})` | ⚠️ CRÍTICO: Requiere estar autenticado como admin | Ninguna — ya requiere sesión admin |
| `AdminDashboard.jsx` | `SELECT * FROM stamp_logs` (con join) | ✅ Las nuevas columnas son additive — no rompe `SELECT *` | Ninguna |
| `AdminDashboard.jsx` | `SELECT * FROM redemptions` | ✅ Ninguno |  Ninguna |
| `ProtectedRoute.jsx` | `SELECT id FROM admin_users WHERE id = auth.uid()` | ✅ Ninguno — `admin_users` no cambia |  Ninguna |
| `LeadPopup.jsx` | `INSERT INTO clientes (nombre, celular, stamps_count=0)` | ✅ Ninguno — campos nuevos tienen defaults |  Ninguna |
| `JoinClubSection.jsx` | `INSERT INTO clientes (nombre, celular, stamps_count=0)` | ✅ Ninguno — idéntico |  Ninguna |

### 7.2 Único riesgo real de compatibilidad

El endurecimiento del RPC `increment_stamps` agrega una validación de admin (`auth.uid()` en `admin_users`). El flujo actual en `Login.jsx`:
1. Autentica con email/contraseña → obtiene `session` con `auth.uid()`
2. Verifica en `admin_users`
3. **Luego** llama `increment_stamps`

Esto significa que cuando el RPC se llama, el usuario **ya está autenticado** y **ya es admin**. ✅ El endurecimiento es completamente compatible con el frontend actual sin cambios de código.

---

## PARTE 8 — TRANSICIÓN DEL ROL ADMINISTRADOR

### 8.1 Estado actual

```
auth.users (1 usuario: mdeviajob@gmail.com)
     ↓ (1:1 FK)
admin_users (1 registro: {id, email})
```

El `ProtectedRoute.jsx` verifica existencia en `admin_users` para otorgar acceso al dashboard.

### 8.2 Estado objetivo (Contrato 0.9)

```
auth.users
     ↓ (1:1 FK)
perfiles_trabajadores (rol: TRABAJADOR | ADMINISTRADOR | PROPIETARIO, es_socio: bool)
```

### 8.3 Plan de transición SIN romper el login actual

**Fase de Transición (coexistencia):**

1. Crear tabla `perfiles_trabajadores` con columnas `id (FK auth.users)`, `nombre`, `rol`, `es_socio`, `email`, `activo`.
2. Poblar con el admin actual: `INSERT INTO perfiles_trabajadores VALUES (id_admin, 'Admin', 'ADMINISTRADOR', false, 'mdeviajob@gmail.com', true)`.
3. Mantener `admin_users` sin cambios.
4. Actualizar `ProtectedRoute.jsx` para verificar en `perfiles_trabajadores` en lugar de `admin_users` (cambio de código, 1 línea).
5. Una vez validado en staging, deprecar (no borrar) `admin_users`.

**Migración de admins actuales:**
- Solo hay 1 admin. Se crea su registro en `perfiles_trabajadores` con `rol = 'ADMINISTRADOR'`.
- No se crea ningún nuevo usuario en `auth.users`.
- El password no cambia. El email no cambia.

> [!IMPORTANT]
> Esta transición requiere UN cambio de código en `ProtectedRoute.jsx` (1 línea: cambiar `admin_users` por `perfiles_trabajadores`). Es el único cambio de código propuesto en toda la Fase 1.

---

## PARTE 9 — ROLLBACK

### 9.1 Clasificación de cambios por reversibilidad

| Cambio | ¿Reversible? | Cómo revertir | Riesgo si no se revierte |
|--------|:-----------:|---------------|--------------------------|
| ADD COLUMN en stamp_logs | ✅ Sí | `ALTER TABLE stamp_logs DROP COLUMN tipo, DROP COLUMN estado...` | Bajo |
| ADD CONSTRAINT CHECK | ✅ Sí | `ALTER TABLE stamp_logs DROP CONSTRAINT nombre_constraint` | Bajo |
| INSERT 2 logs de reconciliación | ⚠️ Parcial | `DELETE FROM stamp_logs WHERE tipo='MIGRACION'` — stamps_count no cambia | Requiere borrar y validar |
| REVOKE EXECUTE a anon/PUBLIC | ✅ Sí | `GRANT EXECUTE ON FUNCTION increment_stamps(uuid) TO PUBLIC` | Bajo |
| Reemplazar función increment_stamps | ✅ Sí | Restaurar definición anterior (guardar en backup antes) |  Bajo |
| DROP POLICY + CREATE POLICY en clientes | ✅ Sí | Recrear políticas originales | Bajo |
| CREATE TABLE perfiles_trabajadores | ✅ Sí | `DROP TABLE perfiles_trabajadores` | Sin impacto si está vacía |
| Cambio código ProtectedRoute.jsx | ✅ Sí | Revertir con git | Sin impacto |

### 9.2 Script de Rollback Conceptual

```sql
-- NO EJECUTAR — SOLO DISEÑO

-- Restaurar acceso público a RPCs (si la restricción rompe el frontend)
GRANT EXECUTE ON FUNCTION public.increment_stamps(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_stamps(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO anon;

-- Eliminar logs de reconciliación
DELETE FROM public.stamp_logs WHERE tipo = 'MIGRACION';

-- Eliminar columnas agregadas a stamp_logs
ALTER TABLE public.stamp_logs DROP COLUMN IF EXISTS tipo;
ALTER TABLE public.stamp_logs DROP COLUMN IF EXISTS estado;
ALTER TABLE public.stamp_logs DROP COLUMN IF EXISTS otorgado_por;
ALTER TABLE public.stamp_logs DROP COLUMN IF EXISTS motivo;
ALTER TABLE public.stamp_logs DROP COLUMN IF EXISTS venta_id;

-- Restaurar client_id nullable
ALTER TABLE public.stamp_logs ALTER COLUMN client_id DROP NOT NULL;

-- Eliminar columnas de clientes
ALTER TABLE public.clientes DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_stamps_count_non_negative;

-- Restaurar políticas originales de clientes
-- (Requiere guardar las definiciones originales antes de migrar)
```

### 9.3 Verificación Post-Rollback

```sql
-- Confirmar que stamps_count no se alteró para ningún cliente
SELECT nombre, stamps_count FROM clientes ORDER BY nombre;
-- Comparar contra snapshot previo a la migración

-- Confirmar que el número de clientes no cambió
SELECT COUNT(*) FROM clientes; -- Esperado: 14

-- Confirmar que el frontend funciona
-- → Ir a /login, verificar que el QR scan sigue funcionando
```

---

## PARTE 10 — PRUEBAS DE ACEPTACIÓN POST-MIGRACIÓN

### Bloque A — Fidelización

| # | Prueba | Método | Resultado esperado |
|---|--------|--------|-------------------|
| A1 | Crear nuevo cliente | Formulario LeadPopup/JoinClub | `stamps_count=0`, `tipo` de stamp_logs no aplica, `referral_code` generado automáticamente |
| A2 | Consultar cliente existente | Dashboard admin | Muestra `stamps_count` correcto, nombre, celular |
| A3 | Otorgar sello (flujo QR) | Escanear QR → Login admin → auto-stamp | Aparece nuevo registro en `stamp_logs` con `tipo='MANUAL'`, `otorgado_por=auth.uid()`, `last_stamp_at` actualizado |
| A4 | Verificar `stamp_logs` post-sello | SELECT directo en DB | `COUNT(*) = previo + 1`, fila nueva con campos completos |
| A5 | Verificar `stamps_count` post-sello | SELECT directo en DB | `stamps_count` incrementó en 1 |
| A6 | Otorgar 10 sellos a 1 cliente | 10 veces el flujo A3 | `is_reward_ready = true` en respuesta RPC |
| A7 | Intentar otorgar sello sin autenticación | `POST /rpc/increment_stamps` con role=anon | Error 403 / permission denied |
| A8 | Intentar otorgar sello como user autenticado no-admin | Crear user de prueba sin admin_users | Error de acceso denegado |
| A9 | Canjear premio | Dashboard → botón Canjear con cliente ≥ 10 sellos | `stamps_count = previo - 10`, nuevo registro en `redemptions`, `success=true` |
| A10 | Verificar `redemptions` post-canje | SELECT directo | `COUNT(*) = 1`, `stamps_exchanged=10` |

### Bloque B — Seguridad

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| B1 | `anon` llama `increment_stamps` vía API | Rechazado: 403 |
| B2 | `anon` llama `redeem_reward` vía API | Rechazado: 403 |
| B3 | `authenticated` no-admin llama `increment_stamps` | Rechazado: `success=false, message='Acceso denegado'` |
| B4 | Admin autenticado llama `increment_stamps` | Aceptado: `success=true` |
| B5 | `anon` hace `UPDATE clientes SET stamps_count=999` | Rechazado por RLS |
| B6 | `authenticated` no-admin hace UPDATE a `stamps_count` | Rechazado por nueva policy |
| B7 | Admin intenta `INSERT stamps_count=-1` | Rechazado por CHECK constraint |

### Bloque C — Integridad

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| C1 | Verificar delta global | `SUM(stamps_count) = COUNT(*) de stamp_logs WHERE estado='ACTIVO'` para todos los clientes | Delta = 0 |
| C2 | Verificar logs de reconciliación | `SELECT * FROM stamp_logs WHERE tipo='MIGRACION'` | 2 filas, datos correctos |
| C3 | Verificar trigger de referido | Registrar cliente con `referred_by` y dar primer sello | Referidor obtiene sello automático con `tipo='REFERIDO'` |
| C4 | Verificar que `last_stamp_at` se actualiza | Dar sello a cliente, consultar `last_stamp_at` | Actualizado al timestamp del sello |
| C5 | Transacción con fallo | Simular error durante canje | Rollback completo, `stamps_count` sin cambios, `redemptions` sin nueva fila |

---

## PARTE 11 — CHECKLIST PREVIO A PRODUCCIÓN

```
[ ] Backup completo de la BD exportado (Supabase → Settings → Database → Backup)
[ ] Snapshot manual con SELECT * de clientes, stamp_logs, redemptions
[ ] Validación PASO 0 ejecutada: conteos correctos (14, 13, 0, 15)
[ ] Validación que Valentina y Sthefanie tienen referred_by = NULL
[ ] Horario de migración definido (preferiblemente madrugada / hora de mínimo tráfico)
[ ] Script de rollback revisado y disponible
[ ] El admin está disponible durante la migración para probar el login
[ ] Se ha notificado al equipo sobre la ventana de mantenimiento
[ ] El código del frontend NO se cambia antes de la migración de BD
[ ] Todos los pasos están revisados por el propietario
```

## PARTE 12 — CHECKLIST POSTERIOR A PRODUCCIÓN

```
[ ] Ejecutar PASO 9 (validación post-migración): conteos esperados
[ ] Delta = 0 para todos los 14 clientes
[ ] Valentina: stamps_count=1, logs=1 (tipo=MIGRACION)
[ ] Sthefanie Pacheco: stamps_count=1, logs=1 (tipo=MIGRACION)
[ ] Prueba A3: otorgar sello real con flujo QR → verificar nuevo log
[ ] Prueba B1: confirmar que anon no puede ejecutar RPC
[ ] Prueba B5: confirmar que anon no puede hacer UPDATE stamps_count
[ ] Login del admin funciona normalmente
[ ] Dashboard muestra 14 clientes, 15 sellos, 0 canjes
[ ] QR de cliente sigue funcionando (escaneo → muestra tarjeta de fidelidad)
[ ] Rollback disponible durante 48h post-migración antes de archivarlo
```

---

## TABLA DE CONTRADICCIONES (RESUMEN)

| ID | Descripción | Decisión propuesta |
|----|-------------|-------------------|
| C1 | `nombre` en `clientes` es nullable | Agregar NOT NULL en migración |
| C2 | `stamps_count` sin CHECK >= 0 | Agregar en PASO 4 |
| C3 | `last_stamp_at` nunca se actualiza | Corregir en nueva versión de RPC (PASO 5) |
| C4 | `increment_stamps` no registra `otorgado_por` | Agregar en nueva versión (PASO 5) |
| C5 | Trigger da sello de referido sin pasar por `increment_stamps` | Documentar como correcto, clasificar como tipo REFERIDO |
| C6 | `admin_users` vs `perfiles_trabajadores` | Coexistencia gradual (PARTE 8) |
| C7 | `redeem_reward` no registra `otorgado_por` en redemptions | Diferir a Fase 2 — bajo riesgo actual |

---

## CONFIRMACIÓN FINAL

```
READ-ONLY COMPLETADO. ✅
NO SE MODIFICÓ SUPABASE. ✅
NO SE MODIFICÓ CÓDIGO DE APLICACIÓN. ✅
NO SE EJECUTÓ SQL DE ESCRITURA. ✅
NO SE CREARON MIGRACIONES EJECUTABLES. ✅
NO SE HICIERON COMMITS. ✅
NO SE HICIERON PUSHES. ✅
```

*Titan Grill — Fase 1.5 — Documento de Preparación de Migración*
