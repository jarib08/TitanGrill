# FASE F — AUDITORÍA Y REMEDIACIÓN

> **Fecha:** 2026-09-27
> **Rama:** `audit/titan-grill-forensic-handoff`
> **Alcance:** 13.106 líneas JS/JSX, 42 funciones y 42 políticas RLS de producción, Dockerfile, nginx, Vite.
> **Commits:** `125d559`, `ab8cb6d`, `6763beb`, `539522f`, `9ee563e`, `563e487`

---

## 0. MÉTODO

Cada cambio en base de datos siguió el mismo protocolo, sin excepción:

1. Backup completo verificado antes de tocar nada (`supabase/backups/`, 305 objetos, restaurable con `pg_restore`).
2. Migración ensayada dentro de `BEGIN … ROLLBACK`, con la batería de pruebas corriendo **sobre datos reales de producción**.
3. Script de reversión escrito **antes** de aplicar (`supabase/migrations/rollback/`).
4. Aplicación, y verificación posterior end-to-end por HTTPS con la anon key real.
5. Conteos de integridad antes y después.

Toda lectura de diagnóstico se hizo en transacciones `READ ONLY`. Se verificó en vivo que la barrera funciona: un `CREATE TABLE` dentro de ella falla con `25006`.

> **Nota sobre el pooler:** `PGOPTIONS` de arranque **no funciona** con Supavisor, lo ignora en silencio. Hay que usar `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` explícito. El `run_readonly.sh` de `supabase/audit/` ya lo hace.

---

## 1. HALLAZGO MÁS GRAVE — backdoor de autenticación (CERRADO)

`registrar_venta` era `SECURITY DEFINER`, sin guard de autorización, con `PUBLIC EXECUTE`, y con este fallback:

```sql
v_worker_id := auth.uid();
IF v_worker_id IS NULL THEN
  SELECT id INTO v_worker_id FROM perfiles_trabajadores WHERE estado = 'ACTIVO' LIMIT 1;
END IF;
```

**Demostrado en vivo.** Actuando como rol `anon`, sin ninguna autenticación:

| Qué se logró | Resultado |
|---|---|
| Venta registrada | `success: true` |
| Total cobrado | **$1** por 10 unidades de un producto de $1.000 |
| Atribuida a | **"Administrador Principal" (ADMINISTRADOR)** |
| Caja usada | La que llevaba 19 días abierta |
| Inventario descontado | 10 unidades, **COGS $6.000** |

`registrar_carga_masiva_inventario` era peor: sin ningún guard y con doble fallback de suplantación. Un anónimo podía reescribir el stock de todos los insumos.

**Cuantificación del daño real:** 0 ventas en cero, mínimo real $1.000, 0 ventas descuadradas contra movimientos de caja. **Era riesgo abierto, no daño consumado.** Nadie lo explotó.

**Cerrado** en `20260927_f1_1`: guard `fn_is_worker()`, sin fallback de suplantación, solo la caja propia, `p_total` validado contra `productos.precio`, montos mixtos validados, `search_path` fijado, `REVOKE` de `anon`. Se preservó sin cambios la idempotencia, la pre-validación de receta/stock, el snapshot de costos, el orden determinístico de `FOR UPDATE` y la forma del JSON de respuesta.

Verificado tras aplicar: el mismo ataque devuelve `HTTP 401 / 42501 permission denied`.

---

## 2. CONTABILIDAD (CORREGIDA)

### 2.1 El Estado de Resultados mezclaba períodos

Ventas **filtradas** por el rango elegido, contra COGS, nómina, gastos y otros egresos de **toda la historia**, más costos fijos normalizados a mes.

Medido: para "Hoy" el dashboard mostraba **−620.359**. Ahora muestra **−40.000**, el costo variable real de un día.

Corregido con la RPC `fn_estado_resultados(desde, hasta)`, que calcula todo en SQL sobre el mismo rango.

### 2.2 Otros errores contables encontrados

| Error | Qué pasaba |
|---|---|
| Retiros de socios | $520.379 en 3 egresos se restaban como gasto operativo. Un retiro es distribución de utilidades. Ahora se reporta aparte. |
| Vigencia de costos | `fecha_inicio` y `fecha_fin` se ignoraban: un costo vencido seguía contando. |
| Devengo futuro | Un costo con `fecha_fin NULL` se proyectaba hacia adelante. Un rango que terminaba en 2030 acumulaba **$48.499.980** de alquiler que no ha ocurrido. Topado en `CURRENT_DATE`. |
| Pricing en el P&L | `MULTIPLICADOR` e `IMPUESTO` se mezclaban con los costos fijos. |
| Truncamiento silencioso | 896 filas de `movimientos_inventario` se bajaban al navegador para sumarlas en JS. PostgREST trunca en 1000 **sin avisar**: el COGS habría empezado a mentir a ~104 ventas de distancia. |
| Ceros contables | `getResData()` devolvía `[]` ante un error, y el admin veía **$0 de ingresos** como si fuera un dato. Ahora se muestra el error y ninguna cifra. |

### 2.3 El COGS no es reconstruible — dato duro

```
tipo=VENTA | 896 filas | con_snapshot=0 | sin_snapshot=896 | COGS real disponible = $0.00
```

`registrar_venta` **sí graba** el snapshot — verificado en vivo, produjo `costo_unitario_historico=600, costo_total_historico=6000`. Pero **ninguna venta ha pasado por esa ruta**: la Fase D2.2 está desplegada y nunca se ejercitó.

Consecuencias que el próximo programador debe saber:

- El COGS histórico de las 99 ventas **es irrecuperable**. No se puede reconstruir sin inventar costos.
- El plan D2.5 tal como estaba escrito daría **COGS = 0**.
- El COGS correcto solo existirá **desde la próxima venta real**.

`fn_estado_resultados` no inventa nada: devuelve el snapshot real, cuántos faltan, una estimación marcada como tal, y una advertencia que la UI muestra en un banner.

### 2.4 Alerta nueva: doble conteo de nómina

`trabajador1 - Diego` está configurado como costo VARIABLE de $40.000 diarios **y además** hay $80.000 en liquidaciones PAGADAS. El mismo trabajo se resta dos veces. La RPC ahora lo advierte. **Hay que elegir una sola vía.**

---

## 3. NÓMINA — NO ES UN ARREGLO, ES UNA CONSTRUCCIÓN

Se auditó por patrón en todo el esquema, sin asumir nada:

- **No existe ninguna tabla** de turnos, asistencia, jornadas ni horas. Solo `liquidaciones` y `perfiles_trabajadores`.
- Los 3 perfiles tienen `modalidad_pago = 'POR_TURNO'` y **`tarifa_pago = 0`**.
- `generar_liquidacion` solo inserta el `p_monto` que le manden. Cero cálculo.

| Modalidad (permitida por constraint) | ¿Calculable hoy? |
|---|---|
| `POR_HORA` | **No.** No se registran horas en ninguna parte. |
| `POR_TURNO` | **No.** No hay tabla de turnos. `sesiones_caja` **no sirve** como sustituto: solo la abre quien usa el POS, se puede abrir varias veces al día, y cocina no la usa. |
| `POR_VENTA` | **Sí.** `ventas.trabajador_id` existe; la comisión por ventas del período es derivable ya. |

**Antes de construir el motor de nómina hay que crear el registro de turnos.** Es trabajo de modelo de datos.

---

## 4. CAJA — INCOHERENCIAS DE MODELO (ABIERTAS)

### 4.1 Doble conteo de apertura, con caso concreto

Sesión `283e7d33`: `monto_apertura = $82.000` **y además** 2 movimientos `SALDO_INICIAL` por **$241.031**. `cerrar_caja` calcula `esperado = monto_apertura + SUM(movimientos)`, así que contó la apertura dos veces. Esperado: $612.731.

### 4.2 El arqueo es decorativo

**Las 6 sesiones cerradas tienen `diferencia = 0`, todas.** Un arqueo real no cuadra perfecto 6 de 6 veces. La causa está en el POS: le muestra `expectedCashAtClose` al trabajador **antes** de que cuente. Están copiando el número esperado. Es falla de control interno, no bug de código.

### 4.3 Dos definiciones de "dinero que tengo"

`calcular_saldo_global()` suma **solo movimientos** ($654.800 efectivo) e ignora los $354.000 de aperturas declaradas — pero los $241.031 de esa sesión **sí** entran porque se registraron como movimiento. El modelo se aplica de forma inconsistente y el saldo global no es auditable.

### 4.4 La migración Fase A es código muerto

Existen **las dos sobrecargas**:

```
registrar_saldo_inicial(p_efectivo, p_nequi, p_bancolombia)              ← la vieja
registrar_saldo_inicial(p_sesion_id, p_efectivo, p_nequi, p_bancolombia) ← la de la migración
```

El frontend llama con 3 parámetros → **resuelve a la vieja**. El `FOR UPDATE`, la sesión explícita y la prevención de duplicados de `20260912_fase_a_correccion.sql` **nunca se ejecutan**. Mismo riesgo latente con las 2 sobrecargas de `recibir_compra` y `anular_compra`.

---

## 5. PRIVACIDAD (RESUELTA, PENDIENTE DE DESPLIEGUE)

`clientes_select_public` era `cmd=SELECT roles={public} USING=true`. Verificado por HTTPS con la anon key: `GET /rest/v1/clientes?select=*` devolvía `content-range: 0-26/27` — **los 27 clientes con nombre, celular, email y código de referido**.

El RLS no puede arreglarlo solo: evalúa fila por fila, no consulta por consulta. Además el `INSERT … .select()` de la landing **requiere** permiso SELECT.

**Solución:** 3 RPCs de acceso mínimo que exigen valor exacto y devuelven solo `id, nombre, stamps_count, referral_code`.

### ⚠️ ORDEN DE DESPLIEGUE OBLIGATORIO

```
1. [YA HECHO]  20260927_f1_2_rpcs_clientes_publicos.sql    ← aditiva, sin riesgo
2. DESPLEGAR el frontend de esta rama
3. VERIFICAR en el sitio real: registro en la landing + tarjeta con sellos
4. RECIÉN ENTONCES aplicar 20260927_f1_3_cierre_fuga_clientes.sql
5. VERIFICAR que un anónimo ya no pueda listar clientes
```

**No aplicar el paso 4 antes del 2.** El build en producción todavía lee la tabla directamente y se rompería la tarjeta de fidelización de clientes reales.

### Bug de concurrencia corregido en el camino

El frontend hacía: `SELECT` por celular → si no existe `INSERT` → si choca, reintentar. Ese reintento era **código muerto**: no existe índice único sobre `clientes.celular`, así que la `unique_violation` que esperaba nunca podía ocurrir. Dos personas registrándose a la vez con el mismo número creaban **dos tarjetas**.

Ahora se serializa con `pg_advisory_xact_lock`. Verificado con dos sesiones concurrentes: la segunda esperó **2.914 ms**.

---

## 6. RENDIMIENTO — LA CAUSA ERA LAS IMÁGENES

| Medición | Antes | Después |
|---|---|---|
| Landing completa | **6,07 MB** | **1,03 MB** (−83%) |
| Imágenes | 5,40 MB | 0,75 MB |
| Chunk `vendor-qr` | 352 KB | 17,8 KB |
| JS principal (gzip) | sin gzip | 232 → 72 KB (−69%) |
| CSS (gzip) | sin gzip | 116 → 17 KB (−85%) |

Las imágenes pesaban **8 veces más que todo el JavaScript**, y gzip no comprime PNG.

**No se renombró ni un archivo** (las rutas `/menu/*.png` están en `productos.imagen`). Cada asset tiene un gemelo `.webp` servido por dos mecanismos: nginx con la misma URL, y el componente `AppImage` con `<picture>` para independencia del host.

**Integridad visual medida, no supuesta** (Chrome headless, contra el código anterior compilado en un worktree aparte):

```
a 1280px: body 4150, scrollWidth 1280, tarjetas 387.3x256  →  IDÉNTICO
a  400px: body 5302, scrollWidth 500                        →  IDÉNTICO
```

Las dimensiones naturales también coinciden: el WebP tiene los mismos píxeles. Calidad por RMSE en las 16 imágenes: todas bajo 2%, la peor 1,88%.

**Lo que se descartó:** optimizar los PNG en su mismo nombre y formato. Probado sobre una copia, los archivos **crecieron 27%** (`corn_dogs` de 823 KB a 1.243 KB). Los PNG originales ya están mejor comprimidos que lo que produce ImageMagick.

### ⚠️ Trampa de `<picture>` que hay que respetar

Si el `<source>` da **404**, el navegador muestra imagen **rota** — por especificación **no** reintenta con el `<img>`. Por eso `AppImage` se usa **solo con rutas fijas**. `DigitalMenu`, cuyas rutas vienen de la BD, usa `<img>` normal a propósito: ahí la optimización la hace nginx, que sí cae al original.

`npm run verificar-webp` es la red que evita esa trampa. **Correrlo antes de cada despliegue que agregue imágenes.**

---

## 7. BUG DE PRODUCCIÓN: el menú digital por QR no cargaba

`public/menu/` es una carpeta de imágenes y `/menu` es también una ruta de la SPA. nginx servía el directorio: `/menu` → **301** → `/menu/` → **403**. El menú digital nunca cargaba.

Verificado con nginx real en contenedor. Arreglado con un `location` de match exacto. No se renombró la carpeta porque las rutas están en `productos.imagen`.

---

## 8. CORRECCIONES A LA AUDITORÍA PREVIA

Dos hallazgos que esta auditoría marcó primero como críticos y **no lo eran**:

| Hallazgo | Diagnóstico inicial | Realidad verificada |
|---|---|---|
| Escalación de rol | CRÍTICO | **Refutado.** `perfiles_update_restrictive: USING=fn_is_socio() WITH_CHECK=fn_is_socio()`. Un TRABAJADOR no puede ascenderse. |
| UPDATE abierto de clientes | CRÍTICO | **Refutado.** Producción usa `fn_is_admin()`, no `auth.role()='authenticated'`. |

**La causa de ambos errores:** los `.sql` de la raíz del repo describían un estado **más permisivo que el real**. Ejecutar `supabase_security_hardening.sql` sobre producción habría **abierto** el UPDATE de `clientes` a cualquier trabajador — un retroceso de seguridad. Por eso se archivaron en `supabase/legacy/` con un README que documenta cada discrepancia.

Esto es el hallazgo **E1** en su forma más concreta: la lógica de negocio no estaba en Git, y lo que había en Git mentía. Corregido con `00000000000000_baseline_recuperado_de_produccion.sql` (`pg_dump --schema-only`).

---

## 9. PENDIENTES

### Aplicar
- [ ] `20260927_f1_3_cierre_fuga_clientes.sql` — **solo después de desplegar** (ver §5)

### Construir
- [ ] **Registro de turnos/asistencia** — bloquea toda la nómina (§3)
- [ ] Unificar el modelo de caja: una sola definición de "dinero que tengo" (§4.3)
- [ ] Corregir el doble conteo de apertura en `cerrar_caja` (§4.1)
- [ ] Ocultar el esperado al trabajador hasta que registre su conteo (§4.2)
- [ ] Alinear el frontend con la sobrecarga correcta de `registrar_saldo_inicial` y eliminar las obsoletas (§4.4)

### Integridad de datos (auditado, no corregido)
- [ ] `handleAjustarStock` (`AdminDashboard.jsx:1298`): `UPDATE insumos` + `INSERT movimientos_inventario` como dos operaciones separadas. Si la segunda falla, el stock cambia sin rastro. Además calcula desde un `stock_actual` cacheado: si el POS vendió en medio, **se pisa el stock**. Y `tipo='AJUSTE'` siempre suma (`sign = +1`): no se puede ajustar hacia abajo.
- [ ] `handleSaveCompra` (`:1640`): `compras.insert` + `compra_detalles.insert` no atómicos → compra BORRADOR con total y sin detalle.
- [ ] Sellos con read-modify-write (`POS.jsx:1362`, `AdminClientView.jsx:75,105,132`): leen `stamps_count`, suman en JS, escriben. Carrera → sellos perdidos. Y esquivan la RPC `increment_stamps`, que existe justo para eso.
- [ ] `NumericInput` escribe en la base **en cada tecla** (`AdminDashboard.jsx:5672, 5688`, y antes también el Precio Aprobado). Escribir `15000` persiste `1`, `15`, `150`, `1500`.

### Pendientes de verificación (no modificar antes de demostrarlo)
- [ ] **`getDateRange()` y el desfase Bogotá/UTC.** Construye las fechas con la hora local del navegador. Con la jornada de 4 a 9 p. m., las ventas de 7–9 p. m. caen en el día siguiente en UTC y podrían estar mal clasificadas en los filtros. **Es una sospecha, no un hallazgo confirmado.** Por decisión del dueño no se toca hasta medirlo: comparar el total del filtro del dashboard contra el mismo período calculado en SQL con `(fecha AT TIME ZONE 'America/Bogota')::date`. Ver detalle en `FASE_G_DISENO_TURNOS_Y_NOMINA.md` §4.

### Operativo
- [ ] Hay una **caja abierta desde hace 19 días** (sesión `d23831d6`, abierta 2026-09-07)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` en `.env` está **inválida** ("Invalid API key")
- [ ] **Rotar** la contraseña de la BD, la anon key y la service role key
- [ ] `logo1.svg` y `logo2.svg` (925 KB juntos) no están referenciados en ningún lado

---

## 10. CÓMO VERIFICAR Y CÓMO REVERTIR

```bash
npm run lint              # 0 errores
npm run build             # compila
npm run verificar-webp    # 11/11 rutas con gemelo .webp

# Inventario forense de la BD, 100% read-only
./supabase/audit/run_readonly.sh /tmp/inventario.txt
```

Cada migración aplicada tiene su reversión en `supabase/migrations/rollback/`. Las de `f1_2` y `f2_1` solo crean funciones nuevas: revertir es eliminarlas, sin efecto en datos. Las de `f1_1` y `f1_4` restauran las definiciones y permisos exactos capturados con `pg_dump` antes del cambio.

> **Advertencia:** revertir `f1_1` **reabre el backdoor de autenticación**, y revertir `f1_3` **reabre la fuga de datos**. Usar solo si la operación se rompe, y volver a aplicar el parche corregido de inmediato.

El backup completo está en `supabase/backups/` (gitignored). Restauración:

```bash
pg_restore --clean --if-exists -d "$SUPABASE_DB_URL" supabase/backups/<TS>_completo.dump
```
