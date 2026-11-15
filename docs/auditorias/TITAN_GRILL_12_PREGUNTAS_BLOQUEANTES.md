# TITAN GRILL — 12 PREGUNTAS BLOQUEANTES
**Fuente:** TITAN_GRILL_AUDITORIA_EXCEL_HOJAS_VISIBLES.md  
**Modo:** READ-ONLY — sin modificaciones  
**Solo hojas visibles:** EQUIVALENCIA, burger, perro clasicc, salchipapa, salchip especial, salsas, CONTABILID 2026, inventario, planeación

---

## PREGUNTA 1 — PRECIO SALCHIPAPA

| Campo | Detalle |
|---|---|
| **ID** | P01 |
| **Pregunta** | ¿La "Salchipapa" del Excel ($13.000) es el mismo producto que "Papa en Espiral" del sistema ($8.000)? ¿O son dos productos distintos? |
| **Hoja visible** | `salchipapa` (visible, posición 4) |
| **Ubicación** | Fila "PRECIO SUGERIDO DE VENTA APROBADO" → $13.000 |
| **Valores encontrados** | Excel `salchipapa`: precio aprobado = **$13.000** / Supabase `Papa en Espiral`: precio = **$8.000** |
| **Conflicto** | Nombre distinto ("Salchipapa" vs "Papa en Espiral") Y precio distinto ($13.000 vs $8.000). No es posible determinar si son el mismo producto o dos productos diferentes. |
| **Tabla/campo Supabase afectado** | `productos.nombre`, `productos.precio` (id: `e3bbda11-...`, "Papa en Espiral") |
| **Opciones** | A) Son el mismo producto → actualizar nombre y precio en Supabase a Salchipapa $13.000 / B) Son el mismo producto pero el precio de $8.000 es el correcto → renombrar solamente / C) Son el mismo producto pero el precio de $13.000 es el correcto → actualizar precio y renombrar / D) Son dos productos distintos → crear "Salchipapa" como producto nuevo y mantener "Papa en Espiral" / E) "Papa en Espiral" es un producto descontinuado → desactivar y crear "Salchipapa" |
| **Qué necesito de ti** | Confirma si son el mismo producto, y si lo son, cuál es el precio actual correcto. |
| **Clasificación** | 🔴 BLOQUEANTE — afecta si creamos un producto nuevo o actualizamos uno existente |

---

## PREGUNTA 2 — SALSA TOMATE (dos entradas con precios distintos)

| Campo | Detalle |
|---|---|
| **ID** | P02 |
| **Pregunta** | ¿`Salsa tomate (grande)` a $6,74/g y `salsa tomate` a $12,79/g son dos productos distintos (marcas diferentes) o es el mismo con un precio desactualizado? |
| **Hoja visible** | `EQUIVALENCIA` (visible, posición 1) |
| **Ubicación** | Fila 17 (row index): `Salsa tomate (grande)` → $29.000 por 4.300g = $6,74/g / Fila 36 (row index): `salsa tomate ` → $55.000 por 4.300g = $12,79/g |
| **Valores encontrados** | Entrada 1: precio presentación $29.000, equivalencia 4.300, costo/g = **$6,74** / Entrada 2: precio presentación $55.000, equivalencia 4.300, costo/g = **$12,79** |
| **Conflicto** | Misma cantidad declarada en presentación (4.300g) pero precio casi doble ($29k vs $55k). Las recetas visibles ("burger", "perro clasicc", "salchipapa", "salchip especial") todas usan `Salsa tomate (grande)` a $6,74/g. La entrada de $12,79/g no aparece referenciada en ninguna receta visible. |
| **Tabla/campo Supabase afectado** | `insumos.nombre`, campo futuro `insumos.costo_unitario` |
| **Opciones** | A) Son dos marcas distintas → registrar ambas como insumos separados / B) Es el mismo producto y el precio correcto actual es $29.000 ($6,74/g) → ignorar la entrada de $55.000 / C) Es el mismo producto y el precio correcto actual es $55.000 ($12,79/g) → actualizar recetas / D) Es el mismo producto con precio antiguo y precio nuevo → indicar cuál es vigente |
| **Qué necesito de ti** | ¿Son el mismo producto o marcas distintas? ¿Cuál es el precio de compra actual? |
| **Clasificación** | 🔴 BLOQUEANTE — afecta el costo calculado de todas las recetas que usan salsa de tomate |

---

## PREGUNTA 3 — SALSA X (identidad desconocida)

| Campo | Detalle |
|---|---|
| **ID** | P03 |
| **Pregunta** | ¿Qué es "salsa x"? ¿Cuál es su contenido real? ¿Es un producto comprado o preparado internamente? |
| **Hoja visible** | `EQUIVALENCIA` fila 51, `burger` fila 20, `perro clasicc` fila 11, `salchipapa` fila 7, `salchip especial` fila 8 |
| **Ubicación** | EQUIVALENCIA: `salsa x | UNI | $600 | 1 | $600` / burger: `1 ud × $600 = $600` / perro: `1 ud × $600 = $600` / salchipapa: `2 ud × $600 = $1.200` / salchip especial: `1 ud × $600 = $600` |
| **Valores encontrados** | Nombre: "salsa x" / Precio: $600/ud / Sin descripción, sin grupo, sin equivalencia a gramos |
| **Conflicto** | Aparece en 4 de las 4 recetas de producto visible. Representa entre $600 y $1.200 del costo por receta. No se puede identificar qué es ni si debe gestionarse como inventario. |
| **Tabla/campo Supabase afectado** | `insumos` (nuevo insumo), `producto_insumos.cantidad_por_unidad` |
| **Opciones** | A) Es un producto comprado con nombre real (indicar nombre y presentación) → registrar como insumo / B) Es una preparación interna (indicar receta) → modelar como subreceta / C) Ya no se usa → excluir de todas las recetas / D) Se reemplazó por otra salsa (indicar cuál) → sustituir en recetas |
| **Qué necesito de ti** | Nombre real, contenido, si se compra o se prepara, y si sigue en uso. |
| **Clasificación** | 🔴 BLOQUEANTE — presente en las 4 recetas visibles, afecta costo y inventario |

---

## PREGUNTA 4 — PORCIÓN DE CARNE (110g vs 120g)

| Campo | Detalle |
|---|---|
| **ID** | P04 |
| **Pregunta** | ¿La hamburguesa lleva 110g o 120g de carne por porción? |
| **Hoja visible** | `burger` (visible, posición 2) y `planeación` (visible, posición 18) |
| **Ubicación** | burger fila 4: `110 | CARNE ESPECIAL | $16,556 | $1.821` / planeación fila 16: `"porciónar carnes (120g)"` |
| **Valores encontrados** | Receta "burger": **110g** explícitamente / Hoja planeación: **120g** como instrucción de porcionamiento |
| **Conflicto** | 10g de diferencia. No es posible saber cuál es la cantidad actual sin confirmación. La diferencia afecta el costo por hamburguesa en ~$165,56 ($1.821 vs $1.987). |
| **Tabla/campo Supabase afectado** | `producto_insumos.cantidad_por_unidad` (Burger Classic → Carne Especial) |
| **Opciones** | A) Son 110g (la receta de la hoja "burger" es correcta) / B) Son 120g (la planeación es más reciente y correcta) / C) Otra cantidad (indicar cuál) |
| **Qué necesito de ti** | ¿Cuántos gramos de carne lleva actualmente cada hamburguesa? |
| **Clasificación** | 🔴 BLOQUEANTE — afecta el costo de receta y el consumo de inventario del insumo más caro |

---

## PREGUNTA 5 — CORN DOG CLÁSICO

| Campo | Detalle |
|---|---|
| **ID** | P05 |
| **Pregunta** | ¿El Corn Dog Clásico está activo en el menú? ¿Cuál es su receta (ingredientes y cantidades)? |
| **Hoja visible** | `planeación` (visible, posición 18) |
| **Ubicación** | planeación fila 11: `"preparar masa corn dogs"` y fila 19: `"fritar corn dogs"` |
| **Valores encontrados** | El producto existe en Supabase (nombre: "Corn Dog Clásico", categoría: "Entradas", precio: $12.000, activo: true). En hojas visibles solo aparece mencionado en tareas de planeación. No hay hoja de receta visible. |
| **Conflicto** | Producto activo en Supabase sin receta en ninguna hoja visible. No se pueden importar ingredientes ni calcular costos. |
| **Tabla/campo Supabase afectado** | `producto_insumos` (receta vacía actualmente) |
| **Opciones** | A) Sigue activo → proporcionar receta completa (ingredientes, cantidades, unidades) / B) Sigue activo pero la receta es confidencial/no documentada → mantener sin receta / C) Ya no se vende → desactivar en Supabase / D) Precio cambió → indicar precio actual |
| **Qué necesito de ti** | ¿Está activo? Si sí, necesito ingredientes, cantidades y unidades. Si no, confirmar para desactivar. |
| **Clasificación** | 🟡 IMPORTANTE — no bloquea la importación de otros productos, pero sí la completitud del catálogo |

---

## PREGUNTA 6 — SALSA DE CEBOLLA

| Campo | Detalle |
|---|---|
| **ID** | P06 |
| **Pregunta** | La planeación menciona "preparar salsa cebolla". ¿Existe una receta para esta salsa? ¿Se usa como ingrediente en algún producto? |
| **Hoja visible** | `planeación` (visible, posición 18) |
| **Ubicación** | planeación fila 14: `"preparar salsa cebolla"` |
| **Valores encontrados** | Mención textual. No existe receta de "salsa cebolla" en ninguna hoja de salsas visible ni oculta. No aparece como ingrediente en ninguna receta visible. |
| **Conflicto** | Si esta salsa se usa actualmente en algún producto, las recetas visibles estarían incompletas (faltaría un ingrediente). |
| **Tabla/campo Supabase afectado** | Potencialmente `insumos` (nuevo) y `producto_insumos` (ingrediente adicional) |
| **Opciones** | A) Sí existe y se usa → proporcionar receta y en qué productos se aplica / B) Es la "cebolla caramelizada" mencionada en planeación fila 20 → aclarar nombre / C) Ya no se prepara → ignorar / D) Es lo mismo que otro ingrediente ya listado (indicar cuál) |
| **Qué necesito de ti** | ¿Se prepara actualmente? Si sí, ¿en qué productos se usa y con qué ingredientes? |
| **Clasificación** | 🟡 IMPORTANTE — podría significar un ingrediente faltante en recetas |

---

## PREGUNTA 7 — SALSAS TÁRTARA Y BACON (costo > precio)

| Campo | Detalle |
|---|---|
| **ID** | P07 |
| **Pregunta** | El costo calculado de Tártara ($244/porción) y Bacon ($421/porción) supera el precio aprobado ($239 ambas). ¿Los precios de $239 son actuales o históricos? ¿Cómo se cobran actualmente? |
| **Hoja visible** | `salsas` (visible, posición 13) |
| **Ubicación** | Tártara: fila "PRECIO APROBADO" = $239, costo calculado = Σ ingredientes ÷ 30 porciones = $244 / Bacon: fila "PRECIO APROBADO" = $239, costo calculado = Σ ingredientes ÷ 20 porciones = $421 |
| **Valores encontrados** | Tártara: costo $244 vs precio $239 → **margen negativo -2%** / Bacon: costo $421 vs precio $239 → **margen negativo -76%** |
| **Conflicto** | El precio de venta es menor que el costo de producción en ambas salsas. Esto genera pérdida. El precio de $239 podría ser histórico o podría ser costo interno, no precio de venta al público. |
| **Tabla/campo Supabase afectado** | Potencialmente `productos.precio` si se venden por separado, o exclusivamente `insumos`/subrecetas si son ingredientes internos |
| **Opciones** | A) Son subrecetas internas (no se venden al público por separado) → el "precio" de $239 es irrelevante para el sistema / B) Se venden al público → indicar precio actual / C) El rendimiento declarado es incorrecto (producen más porciones) → indicar rendimiento real / D) Los precios de los ingredientes cambiaron → actualizar EQUIVALENCIA |
| **Qué necesito de ti** | ¿Se venden estas salsas por separado? ¿El "precio aprobado" es precio de venta público o costo interno de referencia? |
| **Clasificación** | 🟡 IMPORTANTE — afecta cómo se modelan en el sistema (insumo vs producto vendible) |

---

## PREGUNTA 8 — PAPA vs papa bolsa premiun

| Campo | Detalle |
|---|---|
| **ID** | P08 |
| **Pregunta** | ¿`PAPA` y `papa bolsa premiun` son el mismo insumo con distinto nombre o son presentaciones diferentes? |
| **Hoja visible** | `EQUIVALENCIA` (visible, posición 1) |
| **Ubicación** | Fila 29: `PAPA | KG | $16.700 | "800-454" | 2.500 | $6,68` / Fila 66: `papa bolsa premiun | $16.700 | 2.500 | $6,68` |
| **Valores encontrados** | Ambas tienen: precio presentación = $16.700, equivalencia = 2.500, costo/g = **$6,68**. La receta "salchipapa" usa "papa bolsa premiun" (160g). La receta "salchip especial" usa "PAPA" (150g). |
| **Conflicto** | Mismo costo por gramo. Diferentes nombres. Si son el mismo insumo, deben registrarse una sola vez. Si son presentaciones distintas (por ejemplo, bolsa de 2,5 kg vs papa a granel), podrían necesitar dos entradas de inventario. |
| **Tabla/campo Supabase afectado** | `insumos.nombre` (crear 1 o 2 registros) |
| **Opciones** | A) Son el mismo insumo → registrar solo como "Papa" y unificar nombre / B) Son presentaciones diferentes (una es bolsa premium, otra es papa suelta) → registrar ambas / C) Uno de los dos es obsoleto → indicar cuál se usa actualmente |
| **Qué necesito de ti** | ¿Son el mismo producto o no? ¿Cuál nombre prefiere usar? |
| **Clasificación** | 🟡 IMPORTANTE — afecta si se crea 1 o 2 registros de insumo |

---

## PREGUNTA 9 — SALSA INGLESA (SALSA INLESA)

| Campo | Detalle |
|---|---|
| **ID** | P09 |
| **Pregunta** | ¿La "SALSA INLESA" es salsa inglesa (Worcestershire sauce)? |
| **Hoja visible** | `EQUIVALENCIA` (visible, posición 1) |
| **Ubicación** | Fila 25: `SALSA INLESA | x | LT | $2.800 | 170 | $16,47/ml` |
| **Valores encontrados** | Nombre: "SALSA INLESA" / Costo: $16,47/ml / Usado en: subreceta "Bacon" (hoja salsas, 20ml por lote) |
| **Conflicto** | No es un conflicto de datos sino un typo evidente. Si es salsa inglesa, el nombre debe normalizarse para evitar confusión en el sistema. |
| **Tabla/campo Supabase afectado** | `insumos.nombre` |
| **Opciones** | A) Sí, es salsa inglesa (Worcestershire) → registrar como "Salsa Inglesa" / B) No, es otro producto → indicar nombre real |
| **Qué necesito de ti** | Confirmación de que es salsa inglesa. |
| **Clasificación** | 🟡 IMPORTANTE — bajo riesgo, pero necesaria para normalizar correctamente |

---

## PREGUNTA 10 — CARBÓN (unidad de inventario)

| Campo | Detalle |
|---|---|
| **ID** | P10 |
| **Pregunta** | ¿Cómo se gestiona el inventario de carbón? ¿Por bolsa o por kilogramo? |
| **Hoja visible** | `EQUIVALENCIA` (visible, posición 1) |
| **Ubicación** | Fila 3: `carbon | UNI | $4.000 | 2 | $2.000` |
| **Valores encontrados** | Precio: $4.000 / Equivalencia: 2 (¿2 bolsas? ¿2 kg?). Costo/ud = $2.000 |
| **Conflicto** | La equivalencia "2" es ambigua. Si son 2 bolsas → costo/bolsa = $2.000. Si son 2 kg → costo/kg = $2.000. Además, algunas recetas podrían usar fracciones (0,5 bolsa), lo cual plantea si se puede fraccionar el inventario. |
| **Tabla/campo Supabase afectado** | `insumos.unidad_medida`, `producto_insumos.cantidad_por_unidad` |
| **Opciones** | A) Se compra y gestiona por bolsa → unidad = "bolsa" / B) Se compra por kg → unidad = "kg" / C) No se gestiona como insumo de receta (es costos generales) → excluir de recetas |
| **Qué necesito de ti** | Unidad de gestión real (bolsa, kg o no aplica). |
| **Clasificación** | 🟡 IMPORTANTE — afecta unidad de medida en inventario |

---

## PREGUNTA 11 — COLUMNA `costo_unitario` EN SUPABASE

| Campo | Detalle |
|---|---|
| **ID** | P11 |
| **Pregunta** | ¿Desea agregar una columna `costo_unitario` a la tabla `insumos` de Supabase para calcular márgenes automáticamente? |
| **Hoja visible** | `EQUIVALENCIA` (toda la hoja contiene costos unitarios calculados) |
| **Ubicación** | N/A — es una decisión de arquitectura de base de datos |
| **Valores encontrados** | La tabla `insumos` actual tiene: `id, nombre, unidad_medida, stock_actual, stock_minimo, activo, created_at, updated_at`. **No existe campo de costo.** EQUIVALENCIA provee costo por unidad mínima para ~48 insumos. |
| **Conflicto** | Sin `costo_unitario` en Supabase, el sistema no puede calcular: costo de receta por porción, margen de ganancia por producto, ni precio sugerido de venta. La información de costos existe en el Excel pero no tiene dónde almacenarse. |
| **Tabla/campo Supabase afectado** | `insumos` → nueva columna `costo_unitario` (tipo `numeric`) |
| **Opciones** | A) Sí, agregar `costo_unitario` como columna obligatoria → permite costeo automático de recetas / B) Sí, agregar `costo_unitario` como columna opcional (nullable) → permite importación gradual / C) No, gestionar costos externamente (en Excel u otra herramienta) → no requiere migración |
| **Qué necesito de ti** | Decisión: ¿agregar la columna? ¿Obligatoria o nullable? |
| **Clasificación** | 🔴 BLOQUEANTE — sin esta decisión no se puede determinar qué datos de costos importar |

---

## PREGUNTA 12 — TOMA FÍSICA DE INVENTARIO

| Campo | Detalle |
|---|---|
| **ID** | P12 |
| **Pregunta** | ¿Puede realizarse un conteo físico de todos los insumos antes de iniciar la importación? |
| **Hoja visible** | `inventario` (visible, posición 17) |
| **Ubicación** | Toda la hoja — columnas: producto, lugar, cantidad, hay |
| **Valores encontrados** | La columna "hay" contiene solo valores booleanos (`true`/`false`). La columna "cantidad" está **vacía** en todos los registros excepto `Huevo 3 → 1`. No existe stock numérico real para ningún insumo. |
| **Conflicto** | El sistema Supabase necesita `stock_actual` como valor numérico (cantidad real en inventario). El Excel solo proporciona "hay/no hay". Importar `true = 1` o `false = 0` sería inventar datos. |
| **Tabla/campo Supabase afectado** | `insumos.stock_actual`, `insumos.stock_minimo`, `movimientos_inventario` |
| **Opciones** | A) Sí, hacer toma física antes de importar → todos los insumos se crean con stock real / B) Crear insumos con `stock_actual = 0` y ajustar después manualmente / C) Crear insumos con `stock_actual = NULL` como "no inventariado" y hacer toma física después |
| **Qué necesito de ti** | ¿Puede contar el inventario físico antes de la importación? Si no, ¿qué valor inicial prefiere para stock? |
| **Clasificación** | 🔴 BLOQUEANTE — afecta el valor inicial de stock de todos los insumos importados |

---

## DATOS QUE YA PODEMOS CONSIDERAR SEGUROS PARA IMPORTACIÓN

Estos datos provienen **exclusivamente de hojas visibles**, no presentan ambigüedad, están verificados matemáticamente y coinciden con Supabase donde aplica. **No se importará nada todavía** — solo se documentan como listos.

### Insumos seguros (36) — de hoja EQUIVALENCIA (visible)

Todos con nombre original, costo unitario verificado y sin conflicto con ningún otro dato:

| # | Nombre normalizado | Unidad | Costo/ud | Dato explícito | Conflicto |
|---|---|---|---|---|---|
| 1 | Pan Hamburguesa Artesanal | ud | $1.350 | ✅ | Ninguno |
| 2 | Queso Chalo (tajada) | ud | $610 | ✅ | Ninguno |
| 3 | Tocineta (tajada) | ud | $736,67 | ✅ | Ninguno |
| 4 | Carne Especial | g | $16,556 | ✅ | Ninguno |
| 5 | Empaque J1 | ud | $430 | ✅ | Ninguno |
| 6 | Servilleta | ud | $14 | ✅ | Ninguno |
| 7 | Mostaza | g | $10,612 | ✅ | Ninguno |
| 8 | Aceite Ideal | ml | $7,967 | ✅ | Ninguno |
| 9 | Bolsa | ud | $37 | ✅ | Ninguno |
| 10 | Mantequilla Margarina | g | $16,80 | ✅ | Ninguno |
| 11 | Salsa de Carne | ml | $16,471 | ✅ | Ninguno |
| 12 | Salsa de Soja | ml | $16,471 | ✅ | Ninguno |
| 13 | Lechuga Crespa | g | $19,444 | ✅ | Ninguno |
| 14 | Papel Envoltorio 29×29 | ud | $85,50 | ✅ | Ninguno |
| 15 | Papel Carne | ud | $44 | ✅ | Ninguno |
| 16 | Palillos | ud | $6,111 | ✅ | Ninguno |
| 17 | Salsa Piña | g | $9,70 | ✅ | Ninguno |
| 18 | Mayoneza | g | $14,70 | ✅ | Ninguno |
| 19 | Pechuga de Pollo | g | $22,898 | ✅ | Ninguno |
| 20 | Chorizo Don Vitto | ud | $593,75 | ✅ | Ninguno |
| 21 | Ajo en Polvo | g | $60 | ✅ | Ninguno |
| 22 | Paprika | g | $53,333 | ✅ | Ninguno |
| 23 | Sal Refisal | g | $3 | ✅ | Ninguno |
| 24 | Azúcar | g | $2,15 | ✅ | Ninguno |
| 25 | Cebollín | g | $25 | ✅ | Ninguno |
| 26 | Cilantro | g | $14,286 | ✅ | Ninguno |
| 27 | Salchicha Perro Jumbo | ud | $1.850 | ✅ | Ninguno |
| 28 | Porta Perro | ud | $140 | ✅ | Ninguno |
| 29 | Pan Perro Artesanal | ud | $1.200 | ✅ | Ninguno |
| 30 | Maíz (bolsa 1kg) | g | $9,40 | ✅ | Ninguno |
| 31 | Queso Mozzarella | g | $29,50 | ✅ | Ninguno |
| 32 | Queso Duro | g | $22,20 | ✅ | Ninguno |
| 33 | Salchicha Manguera | ud | $2.300 | ✅ | Ninguno |
| 34 | Lechuga Bola | g | $4,40 | ✅ | Ninguno |
| 35 | Huevo | ud | $600 | ✅ | Ninguno |
| 36 | Ripia | g | $10,40 | ✅ | Ninguno |

### Precios de producto seguros (2)

| Producto | Precio Excel | Precio Supabase | Estado |
|---|---|---|---|
| Burger Classic (hoja "burger") | $14.000 | $14.000 | 🟢 Coinciden |
| Perro Clásico (hoja "perro clasicc") | $8.000 | $8.000 | 🟢 Coinciden |

### Recetas seguras (2) — verificación matemática 100% ✅

| Receta | Ingredientes | Rendimiento | Costo/porción | Precio | Margen | Verificación |
|---|---|---|---|---|---|---|
| Burger Classic | 19 ingredientes (excepto "salsa x" pendiente P03) | 1 porción | $6.683 | $14.000 | 52% | 19/19 totales correctos |
| Perro Clásico | 12 ingredientes (excepto "salsa x" pendiente P03) | 10 porciones → $3.721/ud | $3.721 | $8.000 | 53% | 12/12 totales correctos |

> [!NOTE]
> Ambas recetas contienen "salsa x" (P03). Si se resuelve que salsa x se elimina o se reemplaza, las recetas pueden importarse inmediatamente sin ese ingrediente y ajustarse después.

### Proveedores con evidencia (3)

| Proveedor | Evidencia en hoja visible | Insumos |
|---|---|---|
| Chalo | `inventario` → Salsa tomate grande; `CONTABILID 2026` → compras múltiples | Queso tajado, salsa tomate, pan mini perro |
| Carnecol | `inventario` → Carne especial; `CONTABILID 2026` → "carnecol 3 lb" | Carne especial |
| Olimpica | `inventario` → Lechuga crespa | Lechuga crespa |

---

```
SUPABASE INSERTS: 0
SUPABASE UPDATES: 0
SUPABASE DELETES: 0
SUPABASE MIGRATIONS: 0
EXCEL MODIFICADO: NO
CÓDIGO DE PRODUCCIÓN MODIFICADO: NO
```

---

*No se procederá con ninguna importación. Esperando respuestas del propietario a las 12 preguntas.*
