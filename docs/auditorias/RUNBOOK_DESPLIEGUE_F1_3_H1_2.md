# RUNBOOK DE DESPLIEGUE — `f1_3` y `h1_2`

> **Fecha:** 2026-09-27
> **Rama:** `audit/titan-grill-forensic-handoff`
> **Migraciones que cubre:**
> - `supabase/migrations/20260927_f1_3_cierre_fuga_clientes.sql`
> - `supabase/migrations/20260927_h1_2_bloquear_escritura_directa_stock.sql`
>
> **Ambas están SIN APLICAR a propósito.** Rompen compatibilidad con el build que
> hoy sirve producción. Este documento es el orden exacto para aplicarlas sin
> cortar el servicio.

---

## 0. POR QUÉ ESTAS DOS NO SE APLICARON CON LAS DEMÁS

Las otras migraciones de esta rama son **aditivas**: crean funciones o columnas
nuevas y no quitan nada, así que el build viejo sigue funcionando mientras se
despliega el nuevo.

Estas dos **revocan privilegios que el build actual usa**:

| Migración | Qué revoca | Qué se rompe si se aplica antes del despliegue |
|---|---|---|
| `f1_3` | `SELECT` público sobre `clientes` | `LeadPopup`, `JoinClubSection` y `LoyaltyCard`: la tarjeta de fidelización de clientes reales deja de funcionar |
| `h1_2` | `UPDATE(stock_actual)` a nivel de columna | `handleAjustarStock` y `handleSaveInsumo`: no se puede ajustar stock **ni editar ningún insumo** |

Son **independientes entre sí** (no hay orden obligatorio entre las dos), pero
ambas dependen del mismo despliegue.

### Las dos ventanas

```
build nuevo desplegado + migración NO aplicada   →  SEGURO
   el frontend ya usa las RPCs, y los privilegios viejos siguen
   existiendo sin que nadie los use

migración aplicada + build viejo sirviendo       →  SE ROMPE
```

De ahí la regla: **build primero, siempre.**

---

## 1. PRECONDICIONES

### 1.1 ⚠️ EasyPanel necesita dos Build Args, o el build FALLA

Esto es un cambio de comportamiento respecto al despliegue anterior y es la
causa más probable de que el deploy falle.

Antes, el `Dockerfile` **sobrescribía `.env` con credenciales hardcodeadas**, así
que EasyPanel no necesitaba configuración alguna. Eso se corrigió (hallazgo B5):
la anon key ya no queda en el historial de la imagen y la configuración de
entorno dejó de ser decorativa.

Ahora hay que configurar en **EasyPanel → el servicio → Build Args**:

```
VITE_SUPABASE_URL       = https://mbyjehhplruoqlgphfvw.supabase.co
VITE_SUPABASE_ANON_KEY  = <la anon key del proyecto>
```

Si falta alguna, el build **falla en ~19 segundos** con un mensaje explícito que
nombra el arg que falta. Verificado con un `docker build` real.

### 1.2 La app va a empezar a usar una anon key distinta

El código viejo hacía:

```js
(envAnonKey && envAnonKey.startsWith('eyJ')) ? envAnonKey : LEGACY_JWT_ANON_KEY
```

La key configurada es del formato nuevo de Supabase (`sb_publishable_...`), que
**no empieza con `eyJ`**. O sea que el build actual estaba **ignorando la key
configurada y usando el JWT legacy hardcodeado**.

Tras el despliegue la app usará la key real del build arg. Verificado contra la
API de producción: esa key responde correctamente (200 en lo permitido, 401 en
lo denegado), y el bundle compilado ya no contiene la legacy.

### 1.3 Backup vigente

El backup verificado está en `supabase/backups/` (305 objetos, restaurable con
`pg_restore`). Si pasó mucho tiempo, generar uno nuevo antes de empezar:

```bash
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner -Fc \
  -f "supabase/backups/$(date +%Y%m%d_%H%M%S)_completo.dump"
```

### 1.4 Horario

Aplicar **fuera de horario de servicio**, sobre todo `f1_3`.

`index.html` se sirve con `no-cache, must-revalidate` para que los navegadores
tomen los chunks nuevos, pero **quien ya tenga la página abierta sigue ejecutando
el JS viejo hasta que recargue**. Un cliente con su tarjeta de fidelización
abierta en el teléfono vería que deja de actualizarse.

Para `h1_2` el riesgo es menor: solo afecta al administrador con el panel abierto.

### 1.5 Estado esperado antes de empezar

```bash
psql "$SUPABASE_DB_URL" -c "
SELECT 'f1_3' AS migracion,
       CASE WHEN EXISTS(SELECT 1 FROM pg_policies
                        WHERE tablename='clientes' AND policyname='clientes_select_public')
            THEN 'NO aplicada' ELSE 'APLICADA' END AS estado
UNION ALL
SELECT 'h1_2',
       CASE WHEN has_column_privilege('authenticated','public.insumos','stock_actual','UPDATE')
            THEN 'NO aplicada' ELSE 'APLICADA' END;"
```

Debe decir **`NO aplicada`** en las dos.

---

## 2. ORDEN DE EJECUCIÓN

```
PASO 1  Desplegar el build              (EasyPanel, sin tocar la base)
PASO 2  Verificar las 4 pruebas reales  (si falla algo, PARAR aquí)
PASO 3  Aplicar f1_3 y h1_2             (fuera de horario)
PASO 4  Verificar post-migración        (cierre del agujero + las 4 pruebas otra vez)
```

**En el paso 2, si algo falla, se para y no se aplica ninguna migración.** El
build viejo sigue funcionando porque todavía no se revocó nada. Es el punto de
retorno sin costo.

---

## 3. PASO 1 — DESPLEGAR EL BUILD

1. Confirmar Build Args (§1.1).
2. Desplegar `audit/titan-grill-forensic-handoff` desde EasyPanel.
3. Confirmar que el build terminó bien. Si falla en segundos quejándose de un
   build arg, es §1.1.

Al terminar, comprobar que el sitio responde:

```bash
for r in / /menu /admin /pos /login; do
  printf '%-10s HTTP %s\n' "$r" "$(curl -s -o /dev/null -w '%{http_code}' https://TU-DOMINIO$r)"
done
```

Las cinco deben dar **200**. `/menu` es especialmente relevante: antes devolvía
301 → 403 y el menú digital por QR no cargaba.

---

## 4. PASO 2 — LAS 4 PRUEBAS FUNCIONALES

Hacerlas **con el build nuevo y las migraciones todavía sin aplicar**.

### Prueba 1 — Clientes / fidelización

| Acción | Resultado esperado |
|---|---|
| En la landing, registrarse con un celular **nuevo** | Se crea la tarjeta y aparece en pantalla |
| Volver a registrar **el mismo celular** | Devuelve la tarjeta **existente**, no crea una segunda |
| Registrar con celular de 9 dígitos | Mensaje: debe tener exactamente 10 dígitos |
| Registrar sin nombre | Mensaje: el nombre es obligatorio |

> Antes esto era consultar → insertar → reintentar, con una carrera real: dos
> personas registrándose a la vez con el mismo número creaban **dos tarjetas**.

### Prueba 2 — Sellos

| Acción | Resultado esperado |
|---|---|
| Con la tarjeta abierta en un teléfono, sellar desde el POS | El sello aparece en **≤ 5 segundos** |
| Dejar la pestaña en segundo plano y volver | Se actualiza al volver al frente |

> Se eliminó la suscripción Realtime porque Realtime respeta el RLS y, tras
> `f1_3`, dejaría de entregar eventos **en silencio**. Ahora es polling de la RPC
> cada 5 s, que **se pausa** cuando la pestaña no está visible.

### Prueba 3 — Inventario

| Acción | Resultado esperado |
|---|---|
| Ajustar stock de un insumo (Entrada +10) | Funciona, y aparece en el historial de movimientos |
| Probar "Ajuste (Corrección −)" | Opción **nueva**: baja el stock sin registrarlo como merma |
| Intentar una merma mayor al stock | **Rechazada** con mensaje que dice el stock disponible (antes lo dejaba en 0 en silencio) |
| Doble clic en guardar | Se aplica **una sola vez** |
| **Editar el nombre de un insumo** | **El stock NO cambia** |

> La última es la clave. Antes `handleSaveInsumo` enviaba `stock_actual` en su
> UPDATE con el valor cargado en el formulario: editar el nombre o el costo
> sobrescribía el stock con un valor viejo y **sin dejar rastro**. El campo estaba
> `disabled` en pantalla, así que la interfaz daba la impresión de que eso no
> podía pasar.

### Prueba 4 — Turnos

| Acción | Resultado esperado |
|---|---|
| En Liquidaciones, "Cerrar turno y pagar $40.000" | Genera la liquidación **y** el egreso en caja |
| Intentar cerrar el turno del mismo día otra vez | El botón muestra "Turno de hoy ya pagado" |
| Verificar en Rentabilidad | La nómina del período incluye ese pago, **sin duplicarlo** |
| En Trabajadores, botón "Tarifa" | Permite cambiar el valor; los turnos ya pagados **conservan el suyo** |

---

## 5. PASO 3 — APLICAR LAS MIGRACIONES

Solo si las 4 pruebas pasaron. Fuera de horario.

```bash
psql "$SUPABASE_DB_URL" --set=ON_ERROR_STOP=1 \
  -f supabase/migrations/20260927_f1_3_cierre_fuga_clientes.sql

psql "$SUPABASE_DB_URL" --set=ON_ERROR_STOP=1 \
  -f supabase/migrations/20260927_h1_2_bloquear_escritura_directa_stock.sql

# PostgREST debe recargar su cache de esquema
psql "$SUPABASE_DB_URL" -c "NOTIFY pgrst, 'reload schema';"
```

El orden entre las dos es indiferente. Ambas están envueltas en
`BEGIN … COMMIT`: si una falla, no deja nada a medias.

---

## 6. PASO 4 — VERIFICACIÓN POST-MIGRACIÓN

### 6.1 `f1_3` — la fuga cerrada

```bash
# ANTES devolvía:  content-range: 0-26/27   (los 27 clientes completos)
# AHORA debe devolver 0 filas
curl -sI "$VITE_SUPABASE_URL/rest/v1/clientes?select=id" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Prefer: count=exact" -H "Range: 0-0" | grep -i content-range

# Y las RPCs públicas deben seguir respondiendo
curl -s -X POST "$VITE_SUPABASE_URL/rest/v1/rpc/fn_cliente_por_celular" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" -d '{"p_celular":"3009999999"}'
# esperado: {"success":true,"encontrado":false,"cliente":null}
```

### 6.2 `h1_2` — escritura directa bloqueada

```bash
psql "$SUPABASE_DB_URL" -c "
SELECT has_column_privilege('authenticated','public.insumos','stock_actual','UPDATE') AS stock_bloqueado_si_false,
       has_column_privilege('authenticated','public.insumos','costo_unitario','UPDATE') AS costo_editable_si_true,
       has_table_privilege('authenticated','public.insumos','SELECT') AS lectura_ok,
       has_table_privilege('authenticated','public.insumos','INSERT') AS crear_ok;"
```

Esperado: `false, true, true, true`.

### 6.3 Integridad de datos

Ninguna de las dos migraciones toca datos. Los conteos deben ser los mismos:

```bash
psql "$SUPABASE_DB_URL" -c "
SELECT (SELECT count(*) FROM clientes) clientes,
       (SELECT count(*) FROM ventas) ventas,
       (SELECT count(*) FROM insumos) insumos,
       (SELECT count(*) FROM movimientos_inventario) movs_inv,
       (SELECT count(*) FROM movimientos_caja) movs_caja,
       (SELECT md5(string_agg(id::text||':'||stock_actual::text, ',' ORDER BY id)) FROM insumos) hash_stock;"
```

Referencia del 2026-09-27 antes de aplicar:
`clientes=27, ventas=99, insumos=51, movs_inv=970, movs_caja=120`,
`hash_stock=8ba3c13e830a650562ea0c5b1d72bab5`
*(los conteos crecen con la operación normal; el hash cambia solo si cambió el stock)*

### 6.4 Repetir las 4 pruebas del paso 2

Esta vez con las migraciones puestas. Es la confirmación de que cerrar los
privilegios no rompió nada.

---

## 7. ROLLBACK — Y LA ASIMETRÍA

### ⚠️ Volver al build viejo NO basta

Si hay que revertir el frontend después de aplicar las migraciones, **hay que
revertir también las migraciones**. El build viejo no tiene los privilegios que
ellas quitaron: quedaría roto igual.

```bash
# En este orden: primero la base, después el frontend
psql "$SUPABASE_DB_URL" -f supabase/migrations/rollback/20260927_f1_3_ROLLBACK.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/rollback/20260927_h1_ROLLBACK.sql
psql "$SUPABASE_DB_URL" -c "NOTIFY pgrst, 'reload schema';"
# luego: revertir el despliegue en EasyPanel al commit anterior
```

### Qué cuesta cada reversión

| Rollback | Qué reabre |
|---|---|
| `f1_3_ROLLBACK` | **La fuga de datos**: cualquiera con la anon key vuelve a poder descargar los 27 clientes con nombre, celular y email |
| `h1_ROLLBACK` | La escritura directa de `stock_actual`, incluido el camino sin trazabilidad de `handleSaveInsumo` |

Son **salidas de emergencia**, no estados en los que quedarse. Si hay que usar
una, corregir y volver a aplicar cuanto antes.

### Restauración total desde backup

Solo si algo salió muy mal:

```bash
pg_restore --clean --if-exists -d "$SUPABASE_DB_URL" \
  supabase/backups/<TIMESTAMP>_completo.dump
```

---

## 8. RESUMEN EN UNA PÁGINA

| # | Paso | Punto de retorno |
|---|---|---|
| 0 | Build Args en EasyPanel (§1.1) | — |
| 1 | Desplegar el build | Revertir el deploy, sin costo |
| 2 | Las 4 pruebas funcionales | **Último punto de retorno sin costo** |
| 3 | Aplicar `f1_3` y `h1_2` | A partir de aquí, revertir exige revertir ambas cosas |
| 4 | Verificar cierre + repetir las 4 pruebas | — |

**La regla:** nunca aplicar una migración antes de que el build que la acompaña
esté sirviendo y verificado.
