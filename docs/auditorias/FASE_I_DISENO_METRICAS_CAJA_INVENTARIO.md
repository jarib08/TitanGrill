# FASE I — AUDITORÍA Y DISEÑO: MÉTRICAS DE CAJA, INVENTARIO Y ANALÍTICA

> **Fecha:** 2026-09-28
> **Rama:** `audit/titan-grill-forensic-handoff`
> **Estado:** auditoría completada, diseño pendiente de aprobación. **Nada implementado.**
> **Hallazgos:** A5, A3, A4, A6, A7, A8
>
> No se ejecutó ninguna migración, no se modificó producción, ni el frontend, ni el build.
> Toda consulta de diagnóstico se hizo en transacciones `READ ONLY`.

---

## 1. RESUMEN

El tab de **Rentabilidad** ya se corrigió en la Fase F con `fn_estado_resultados`. Los
tabs de **Caja** y **Analítica** siguen con la misma clase de errores: agregados
calculados en el navegador sobre datos sin límite, con fallos silenciosos.

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| **A5** | **ALTA** | Las transferencias internas inflan las cifras por método de pago | **Confirmado y cuantificado: $219.811** |
| **A3** | **ALTA** | 18 consultas sin `.range()`; PostgREST trunca en 1000 sin avisar | **Confirmado: `movimientos_inventario` a 30 filas del corte** |
| **A4** | **ALTA** | Un fallo de consulta se convierte en $0 contable | Confirmado |
| **A6** | MEDIA | El "último costo" se toma sin `ORDER BY` | Confirmado (hoy sin impacto: 1 compra por insumo) |
| **A7** | MEDIA | El gráfico de "consumo" muestra compras, e ignora el filtro de fechas | Confirmado |
| **A8** | MEDIA | `yesterday` y `today` comparten el instante frontera | **Confirmado con prueba ejecutable** |

---

## 2. A5 — Las transferencias internas inflan los totales por método

### El código

`AdminDashboard.jsx` ~`:1244`

```js
const totalIngresos   = movimientos.filter(m => m.tipo==='INGRESO' && m.tipo_operacion !== 'TRANSFERENCIA_INTERNA')...
const efectivoIngresos = movimientos.filter(m => m.tipo==='INGRESO' && m.metodo_pago==='EFECTIVO')...   // ← no excluye
const nequiIngresos    = movimientos.filter(m => m.tipo==='INGRESO' && m.metodo_pago==='NEQUI')...      // ← no excluye
const bancolombiaIngresos = ...                                                                          // ← no excluye
const otrosIngresos    = ...                                                                             // ← no excluye
```

El total **sí** excluye las transferencias internas. Las cifras por método **no**.

### Cuánto distorsiona, medido contra producción

| Método | Como lo muestra | Correcto | Inflado por transferencias |
|---|---|---|---|
| EFECTIVO | $1.380.010 | $1.380.010 | $0 |
| NEQUI | $136.980 | $136.980 | $0 |
| **BANCOLOMBIA** | **$930.423** | **$710.612** | **$219.811** |

Y la incoherencia que el administrador ve en pantalla:

```
totalIngresos mostrado      : $2.227.602
efectivo + otros mostrado   : $2.447.413
descuadre                   :   $219.811
```

**La suma de las partes no cuadra con el total**, y el KPI "QR / Transf." reporta
$930.423 cuando el ingreso real por Bancolombia fue $710.612. Mover plata de
efectivo a Bancolombia no es un ingreso.

---

## 3. A3 — Truncamiento silencioso a 1000 filas

18 consultas sin `.range()` ni `.limit()`. PostgREST corta en `max-rows` (1000 por
defecto) **sin error y sin aviso**.

| Tabla | Filas | Margen | Estado |
|---|---|---|---|
| **`movimientos_inventario`** | **970** | **30** | **RIESGO INMINENTE** |
| `movimientos_caja` | 120 | 880 | ok por ahora |
| `ventas` | 99 | 901 | ok por ahora |
| `insumos` | 51 | 949 | ok por ahora |

`movimientos_inventario` está a **30 filas** del corte. Cada venta genera un
movimiento por insumo de la receta, así que se llega en pocas jornadas. Cuando
pase, las métricas de inventario y consumo empiezan a mentir **hacia abajo** sin
que nada lo indique.

> La consulta de COGS ya se eliminó en la Fase F. Las que quedan alimentan los
> tabs de Caja, Analítica y los KPI del dashboard.

---

## 4. A4 — Un fallo de red se muestra como $0

`AdminDashboard.jsx:1163`

```js
const getResData = (r) => r.status === 'rejected' || r.value?.error ? [] : (r.value?.data || []);
```

Usado en **8 lugares**. Con `Promise.allSettled`, si la consulta de `movimientos_caja`
falla, `movimientos` es `[]` y el tab de Caja muestra **$0 de ingresos** — visualmente
idéntico a "hoy no entró plata".

Es el mismo patrón que ya se corrigió en Rentabilidad: **un informe incompleto es
peor que ninguno**, porque el administrador toma decisiones sobre él.

---

## 5. A6 — El "último costo" es un costo cualquiera

`AdminDashboard.jsx:1215`

```js
const latestCostByInsumo = {};
purchaseDetails.forEach(d => {
    if (!latestCostByInsumo[d.insumo_id]) {          // ← la PRIMERA fila que llegue
        latestCostByInsumo[d.insumo_id] = Number(d.costo_unitario || 0);
    }
});
```

La consulta de `compra_detalles` **no tiene `ORDER BY`**, así que PostgREST devuelve
las filas en orden físico arbitrario. "La primera que llegue" no es "la última compra".

**Hoy no tiene impacto**: los 3 insumos con compras tienen **una sola compra cada
uno**, así que la primera es también la última. Es una bomba de tiempo: se activa
con la segunda compra de cualquier insumo.

Además el valor del inventario usa este costo y **no** `insumos.costo_unitario`, que
es el costo mantenido. Nada garantiza que coincidan, y la discrepancia hoy no se ve.

---

## 6. A7 — El gráfico de "consumo" muestra compras

`AdminDashboard.jsx:1228`

```js
const consumptionMap = {};
purchaseDetails.forEach(d => {                       // ← compra_detalles, no movimientos
    consumptionMap[name] = (consumptionMap[name] || 0) + Number(d.cantidad || 0);
});
```

Dos problemas:

1. **Mide compras, no consumo.** El título dice "Insumos con Mayor **Consumo**" y la
   etiqueta interna dice "Total **Comprado**". El consumo real está en
   `movimientos_inventario` con `tipo IN ('VENTA','MERMA')`.
2. **Ignora el filtro de fechas.** `compra_detalles` se pide sin rango, así que el
   gráfico muestra lo mismo elijas "Hoy" o "30 días".

---

## 7. A8 — `yesterday` y `today` comparten la frontera

`getDateRange()` produce, con el equipo en Bogotá:

```
yesterday  start=2026-09-27T05:00:00.000Z   end=2026-09-28T05:00:00.000Z
today      start=2026-09-28T05:00:00.000Z   end=2026-09-29T04:59:59.999Z
                                  ↑ idéntico ↑
```

Y las consultas usan `.gte('fecha', start)` con `.lte('fecha', end)`. Un movimiento
registrado **exactamente** a medianoche de Bogotá se cuenta en **ambos** períodos.

Probabilidad baja, pero es un intervalo cerrado por los dos extremos, que es un error
de construcción, no de datos.

---

## 8. HALLAZGO RELACIONADO — `getDateRange()` y la zona horaria: **RESUELTO**

Esto estaba como *pendiente de verificación* en la Fase F y el dueño pidió
demostrarlo antes de tocar nada. **Se demostró, y el resultado corrige la
sospecha original.**

Se replicó `getDateRange()` en Node y se evaluó contra una venta de las 8:00 p. m.
de Bogotá (que en UTC es del día siguiente):

| Zona horaria del equipo | `today` start | Veredicto |
|---|---|---|
| **America/Bogota** | `2026-09-28T05:00:00Z` | **CLASIFICA BIEN** ✓ |
| UTC | `2026-09-28T00:00:00Z` | **MAL**: cuenta la venta del 27 como del 28 |
| Europe/Madrid | `2026-09-27T22:00:00Z` | **MAL**: igual |

### Conclusión honesta

`getDateRange()` **no está roto**. `new Date(y, m, d)` construye medianoche en hora
**local del equipo**, que en Colombia es exactamente lo que se quiere.

El bug es **latente y condicional**: aparece solo si el dashboard se abre desde un
dispositivo con otra zona horaria — un teléfono con zona automática en viaje, un
equipo mal configurado, un navegador remoto.

**El riesgo no es teórico en cuanto a volumen:** 62 de 97 ventas (63,9%,
**$1.498.560**) caen en un día distinto según Bogotá o UTC. Si algún día se
consulta desde otra zona, eso es la magnitud de lo que se reclasifica.

Eso baja la prioridad frente a lo que se temía, pero no la elimina: el diseño de
abajo lo resuelve de forma estructural, sin depender de cómo esté configurado
ningún equipo.

---

## 9. DEPENDENCIA CON `fn_estado_resultados`

**Existe, y es de firma.**

`fn_estado_resultados(p_desde timestamptz, p_hasta timestamptz)` recibe sus
límites de `getDateRange()` (`AdminDashboard.jsx:1098`). O sea que **el Estado de
Resultados ya corregido hereda la misma condicionalidad de zona horaria** descrita
en §8.

No es una regresión — es el mismo comportamiento que el resto del dashboard, y es
correcto cuando el equipo está en hora colombiana. Pero si se adopta el enfoque de
fechas del §10.1, `fn_estado_resultados` **debería migrar a la misma firma** para
que todos los tabs compartan exactamente el mismo período.

### Opciones

| Opción | Qué implica |
|---|---|
| **A. Sobrecarga `(date, date)`** *(recomendada)* | Se añade una segunda firma que resuelve el rango en `America/Bogota` y delega en la de `timestamptz`. La actual sigue viva, así que **no rompe el build desplegado**. El frontend migra cuando convenga. |
| B. Cambiar la firma existente | Rompe el build desplegado. Exige coordinar despliegue y migración, como `f1_3`/`h1_2`. |
| C. No tocarla | Los tabs nuevos serían correctos en cualquier zona y Rentabilidad no. Incoherencia entre pantallas: descartada. |

**Recomendación: opción A.** Es aditiva, se puede aplicar sin esperar despliegue, y
deja el frontend migrando a su ritmo.

---

## 10. DISEÑO

### 10.1 Las fechas se resuelven en el servidor, no en el navegador

Todas las RPCs nuevas reciben **`date`**, no `timestamptz`, y resuelven el rango
internamente:

```sql
v_desde_ts := (p_desde::timestamp      AT TIME ZONE 'America/Bogota');
v_hasta_ts := ((p_hasta + 1)::timestamp AT TIME ZONE 'America/Bogota');
-- ... WHERE fecha >= v_desde_ts AND fecha < v_hasta_ts     -- intervalo SEMIABIERTO
```

Esto resuelve dos cosas de una vez:

- **A8** desaparece: el intervalo semiabierto `[desde, hasta+1)` no puede solapar.
- **§8** desaparece: la zona horaria es del servidor y fija. Da igual desde dónde se
  abra el dashboard.

El frontend envía fechas con `Intl.DateTimeFormat` en `America/Bogota` — el mismo
helper `hoyBogota()` que ya existe en el código desde la Fase G.

### 10.2 Tres RPCs con responsabilidad acotada

No una sola función gigante: tres, cada una testeable por separado.

#### `fn_metricas_caja(p_desde date, p_hasta date)`

Corrige **A5**, **A3**, **A4**.

```
ingresos_operativos / egresos_operativos / neto      (sin transferencias internas)
por_metodo[]  → { metodo, ingresos, egresos, neto }  (sin transferencias internas)
transferencias_internas  → { total, movimientos }    reportadas APARTE
por_tipo_operacion[] → { tipo_operacion, tipo, n, monto }   para auditar
saldo_por_metodo[]   → neto acumulado histórico, para conciliar con calcular_saldo_global
advertencias[]
```

Invariante que la función garantiza: **`SUM(por_metodo.ingresos) = ingresos_operativos`**.
Hoy eso no se cumple y es justamente A5.

#### `fn_metricas_inventario(p_desde date, p_hasta date)`

Corrige **A6**, **A7**, **A3**.

```
valorizacion → { valor_costo_mantenido, valor_ultima_compra, discrepancia }
   - costo mantenido = insumos.costo_unitario
   - última compra   = ORDER BY compras.fecha DESC LIMIT 1  ← el verdadero último
   - se reportan LOS DOS y su diferencia, para que la discrepancia sea visible
consumo_real[]  → de movimientos_inventario tipo IN ('VENTA','MERMA'), EN EL PERÍODO
compras[]       → de compra_detalles, EN EL PERÍODO, etiquetado como compras
stock_bajo[] / sin_stock[]
advertencias[]
```

#### `fn_analitica_productos(p_desde date, p_hasta date)`

Corrige **A3** en Analítica.

Agrega `ventas.detalles` con `jsonb_array_elements` **en SQL**, en vez de bajar todas
las ventas al navegador. Devuelve el Pareto y el pronóstico ya calculados.

### 10.3 Las advertencias son parte del contrato

Igual que en `fn_estado_resultados`, cada RPC devuelve `advertencias[]` y la UI las
muestra en un banner. Casos previstos:

- transferencias internas excluidas y su monto
- discrepancia entre costo mantenido y última compra
- insumos con movimientos pero sin costo asignado
- período sin movimientos

### 10.4 Lo que cambia en el frontend

- `fetchDashboardMetrics` deja de calcular agregados: solo llama las 3 RPCs.
- `getResData()` **se elimina**. Un fallo se muestra como fallo (patrón del §4 ya
  aplicado en Rentabilidad).
- Los gráficos de consumo y compras se separan y se etiquetan correctamente.
- `getDateRange()` **se conserva** para el selector de UI, pero pasa a producir
  fechas de Bogotá en vez de `timestamptz` de hora local.

---

## 11. CRITERIOS DE ACEPTACIÓN

### CA-I1 · A5: la suma de las partes cuadra
Para cualquier período: `SUM(por_metodo.ingresos) = ingresos_operativos` y
`SUM(por_metodo.egresos) = egresos_operativos`, exactamente. Las transferencias
internas no aparecen en ninguna cifra por método y sí en su bloque propio.
**Prueba concreta:** con los datos actuales, Bancolombia debe reportar **$710.612**
y no $930.423, y `transferencias_internas.total` debe ser **$219.811**.

### CA-I2 · A5: conciliación con `calcular_saldo_global`
`saldo_por_metodo` de la RPC coincide, por método, con lo que devuelve
`calcular_saldo_global()`. Si difiere, la diferencia se explica y se documenta.

### CA-I3 · A3: ningún agregado se calcula en el cliente
Ninguna de las 3 RPCs devuelve listas sin límite, y el frontend no vuelve a sumar
`movimientos_caja`, `movimientos_inventario` ni `ventas` en JavaScript.
**Prueba:** insertar (en transacción con `ROLLBACK`) 1.100 movimientos de inventario
y verificar que la métrica de consumo los cuenta todos. Hoy, con el corte de
PostgREST, se perderían 100.

### CA-I4 · A4: un fallo es un fallo
Si una consulta interna falla, la RPC devuelve `success:false` con mensaje, **nunca**
ceros. La UI muestra el error y ninguna cifra.
**Prueba:** invocar con un rango inválido y verificar que no devuelve `0` en ningún campo.

### CA-I5 · A6: el último costo es el último
Con dos compras del mismo insumo a precios distintos, `valor_ultima_compra` usa el de
la compra **más reciente por `compras.fecha`**, sin depender del orden físico.
**Prueba:** crear dos compras del mismo insumo (100 y 200) en transacción con
`ROLLBACK` y verificar que toma 200.

### CA-I6 · A6: la discrepancia de costo es visible
Si `insumos.costo_unitario` difiere de la última compra, la RPC lo reporta en
`discrepancia` y emite advertencia. No se elige uno en silencio.

### CA-I7 · A7: consumo es consumo
`consumo_real` sale de `movimientos_inventario` con `tipo IN ('VENTA','MERMA')` y
respeta el período. Las compras van en un bloque aparte.
**Prueba:** un período con compras pero sin ventas debe dar `consumo_real` vacío y
`compras` con datos. Hoy el gráfico de "consumo" mostraría las compras.

### CA-I8 · A8: sin solape de frontera
Un movimiento registrado exactamente a medianoche de Bogotá aparece en **un solo**
período. **Prueba:** insertar un movimiento a `00:00:00` de Bogotá y verificar que
`fn_metricas_caja` lo cuenta en su día y no en el anterior.

### CA-I9 · Independencia de la zona horaria del cliente
Las 3 RPCs devuelven **cifras idénticas** llamadas con las mismas fechas,
independientemente de la zona del proceso que llama.
**Prueba:** ejecutar el mismo período con `TZ=America/Bogota`, `TZ=UTC` y
`TZ=Europe/Madrid` y comparar los JSON: deben ser iguales byte a byte.

### CA-I10 · Coherencia con `fn_estado_resultados`
Para el mismo período, los ingresos operativos de `fn_metricas_caja` se reconcilian
con las ventas de `fn_estado_resultados`, y la diferencia se explica por completo
(ingresos manuales, saldo inicial). Cualquier residuo inexplicado es un fallo.

### CA-I11 · Permisos
`anon` no puede ejecutar ninguna de las 3. Requieren `fn_is_admin()` o
`fn_is_socio()`, con `SET search_path`.

### CA-I12 · Rollback completo
Todo se ensaya en `BEGIN … ROLLBACK`. Al terminar: las funciones no existen y los
conteos e `md5` del stock son idénticos a los previos.

---

## 12. PRUEBAS PROPUESTAS, EN ORDEN

1. **Contraste contra cálculo manual en SQL** de cada cifra, como se hizo con
   `fn_estado_resultados` (ahí las 8 cifras coincidieron exactamente).
2. **Invariante de suma** (CA-I1) sobre varios períodos: hoy, ayer, 7d, 30d, mes.
3. **Volumen** (CA-I3): 1.100 filas en `ROLLBACK` para demostrar que el corte de
   PostgREST ya no aplica.
4. **Zona horaria** (CA-I9): mismo período en 3 zonas, JSON idénticos.
5. **Frontera** (CA-I8): movimiento a medianoche exacta de Bogotá.
6. **Costos** (CA-I5, CA-I6): dos compras del mismo insumo.
7. **Consumo vs compras** (CA-I7): período con compras y sin ventas.
8. **Conciliación cruzada** (CA-I2, CA-I10) contra `calcular_saldo_global` y
   `fn_estado_resultados`.
9. **Permisos** (CA-I11) desde `anon` y desde un `TRABAJADOR`.
10. **Rollback** (CA-I12) con verificación por `md5`.

---

## 13. ORDEN DE DESPLIEGUE PREVISTO

A diferencia de `f1_3` y `h1_2`, **esta fase no revoca ningún privilegio**: las RPCs
son aditivas y la sobrecarga de `fn_estado_resultados` también.

```
1. aplicar las migraciones (aditivas, sin riesgo para el build desplegado)
2. desplegar el frontend que las usa
3. verificar
```

Es el orden **inverso** al de `f1_3`/`h1_2`, y es más simple porque no hay ventana
de incompatibilidad. No se elimina nada del código viejo hasta que el nuevo esté
verificado en producción.

---

## 14. FUERA DE ALCANCE

- Compras y sellos no atómicos (fase posterior, ya auditada).
- `NumericInput` escribiendo por tecla en el multiplicador y el impuesto.
- Partir `AdminDashboard.jsx` por tab (rendimiento).
- Reconstruir el COGS histórico: no es reconstruible, ya documentado en la Fase F.
