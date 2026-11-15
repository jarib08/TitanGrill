# FASE 0.6 — DISEÑO DE ARQUITECTURA OBJETIVO Y CONTRATOS DE DATOS
# TITAN GRILL
# READ-ONLY — NO IMPLEMENTAR

> Propósito: producir el mapa técnico objetivo que utilizaremos para implementar POS, inventario, caja, trabajadores, recetas, etc. — **sin implementar nada**.
> Principio guía: **CONSERVAR → ORDENAR → PROTEGER → EXTENDER**.
> Ancla normativa: **`TITAN_GRILL_FUENTE_DE_VERDAD.md`** (v1.0) — todas las decisiones marcadas como **CONFIRMADA** son obligaciones de diseño.

---

## 0. INPUTS USADOS

| Fuente | Estado | Comentario |
|---|---|---|
| `AGENTS.md` | ✅ existe (raíz) | leído completo |
| `TITAN_GRILL_FUENTE_DE_VERDAD.md` | ✅ existe, v1.0 (1384 líneas) | leído completo. Decisiones CONFIRMADAS son obligaciones. |
| `auditoria_arquitectura.md` | ❌ no existe | se usa como equivalente: `Titan Grill — Resumen integral del estado actual del proyecto antes de ideas.md` (audit READ-ONLY código + DB en vivo). |
| Código `src/` | ✅ leído | 17 componentes + lib/hooks/constants. |
| DB en vivo Supabase | ✅ verificada | REST `anon`: `clientes`(39 rows), `admin_users`, `stamp_logs`, `redemptions`; RPC `get_client_by_referral_code` probada OK. |

---

## 1. RESUMEN EJECUTIVO

- El sistema actual es **fidelización + referidos** sobre Supabase (SPA cliente escribe con rol `anon`/`authenticated`, sin backend).
- La **Fuente de la Verdad (FdV)** define un roadmap de 12 fases (Fase 0 Definición → Fase 11 IA/Notificaciones) con entidades y relaciones precisas (§30) y 29 decisiones CONFIRMADAS (§31).
- **Brecha crítica encontrada**: el sello actual se otorga en el *login admin con clientId* (`Login.jsx → increment_stamps`), **NO está ligado a una venta completada**. La FdV exige (Decisiones #8, #22) que 1 venta elegible = 1 sello y que un sello de venta anulada/devuelta se revierta. → La lógica de sello debe migrarse al flujo de venta (`register-sale`), no seguir como RPC independiente en login.
- **Brecha crítica 2**: el bonus de referido se dispara en el *primer sello* (trigger sobre `stamp_logs`), pero la FdV #11 exige que el referido esté **ligado a una compra válida** del referido. Discrepancia funcional.
- **Decisión de backend**: **Sí, pero progresivo y estrecho** — funciones serverless de Supabase (Edge Functions / RPCs `SECURITY DEFINER`) para operaciones transaccionales multi-tabla. **No** un servidor Node monolítico. Mantiene el modelo actual serverless/Supabase-hosted (CONSERVAR).

---

## 2. STACK ACTUAL

Vite 7 + React 19 + Tailwind v4 + Framer Motion + Lucide + `react-qr-code` (solo display) + Recharts. Sin TS, sin tests. Backend = Supabase (Postgres + Auth + Realtime). Deploy = Docker(`node:20`) → Nginx. [CONFIRMADO EN CÓDIGO / AGENTS.md]

> `html5-qrcode` y `qrcode.react` están en `package.json` y chunk `vendor-qr` pero **no se importan**; el "escaneo" QR es con cámara nativa del admin abriendo la URL del código. [ORDENAR: quitar del bundle]

---

## 3. ESTRUCTURA ACTUAL (resumen)

`src/`: `main.jsx`(entry), `App.jsx` (routes: `/`, `/login`, `/admin`, `/admin/client/:clientId`, `*`), `lib/supabaseClient.js`, `lib/referralUtils.js` (+duplicado dead `utils/referralUtils.js`), `constants/index.js`, `hooks/useLocalStorage.js`, `components/` (ver árbol en auditoría). Deploy: `Dockerfile`+`nginx.conf`. Sin `supabase/functions/`.

---

## 4. BASE DE DATOS EN VIVA (verificado)

[CONFIRMADO EN DB EN VIVA] (39 rows en `clientes`; `stamp_logs`/`admin_users` bloqueadas para `anon` por RLS; RPC `get_client_by_referral_code` OK):

| Tabla | columnas (verificadas) | RLS | notas |
|---|---|---|---|
| `clientes` | id(PK), nombre, celular(UNIQUE), email, stamps_count, created_at, last_stamp_at, referral_code(UNIQUE), referred_by→clientes(id) ON DELETE SET NULL | habilitado | constraint `check_no_self_referral` |
| `admin_users` | id→auth.users(PK), email(UNIQUE) | habilitado, política `auth.uid()=id` | sin columna de rol |
| `stamp_logs` | id(PK), client_id→clientes, created_at, notes | habilitado (`authenticated`) | `notes` existe → scripts de referidos parcialmente aplicados |
| `redemptions` | id(PK), client_id→clientes, stamps_exchanged, redeemed_at | habilitado (`authenticated`) | 0 filas visibles |
| `admin_audit_log` | ❌ NO existe | — | definida solo en `supabase_security_enhanced.sql` → ese script NO se aplicó completamente |
| products/ventas/orders/inventario/recetas/caja/insumos/proveedores/gastos/compras/trabajadores/etc | ❌ NO existen (HTTP 404) | — | |

> **Advertencia de scripts conflictivos**: 7 archivos `*.sql` en raíz. Hay **4 versiones contradictorias de `increment_stamps`** y **2 triggers de bonus mutuamente excluyentes** (`auto_referral_bonus` vs `trg_check_referral_bonus`, el segundo hace `DROP TRIGGER` del primero). La DB viva es un "parche" parcial (tiene `notes`, `last_stamp_at`, `referral_code`, RPC viva; pero NO `admin_audit_log`). [HIPÓTESIS sobre la versión exacta de `increment_stamps`: los `last_stamp_at` son NULL para todos (incl. sellos>0) → sugiere la versión viva NO escribe `last_stamp_at` ⇒ apunta a `referral_bonus_fix.sql`; pero no se pudo confirmar sin ejecutar (mutación prohibida).] **Consolidar a un único script canónico antes de migrar.**

### Discrepancia schema legacy
`supabase_schema.sql` define `public.clients` (inglés, `name`/`phone`). AGENTS.md dice que es *legacy*. La DB viva usa **`clientes`/`nombre`/`celular`**. ⇒ **`supabase_schema.sql` NO está aplicado**; descartarlo como fuente de verdad.

---

## 5. RPC / FUNCIONES / TRIGGERS

[CONFIRMADO EN DB EN VIVA] RPC `get_client_by_referral_code(ref_code)` funciona → `[{"client_id":"17ffb7bb...","client_name":"Jarib"}]`. [CONFIRMADO EN CÓDIGO] `increment_stamps` (Login.jsx:55) y `redeem_reward` (AdminDashboard.jsx:174) son llamados; **no se pudieron probar** (mutan datos, prohibido en READ-ONLY).

| Función | Estado vida | Llamada desde |
|---|---|---|
| `get_client_by_referral_code` | ✅ viva (probada) | `LeadPopup.jsx:75` |
| `increment_stamps` | ⚠️ hipótesis (4 versiones) | `Login.jsx:55` |
| `redeem_reward` | ⚠️ hipótesis (2 versiones) | `AdminDashboard.jsx:174` |
| `generate_referral_code()` trigger | ⚠️ hipótesis (hex vs random) | DB (BEFORE INSERT clientes) |
| `trigger_check_referral_bonus` / `auto_referral_bonus` | ⚠️ hipótesis (conflictivo) | DB (AFTER INSERT stamp_logs) |
| `process_referral_bonus`, `validate_referral_code` | definidas en scripts, NO llamadas en código | — |

---

## 6. FIDELIZACIÓN (alineada a FdV §5 y Decisiones #8/#22)

### Flujo ACTUAL (verificado)
CLIENTE → registro (`LeadPopup`/`JoinClubSection`, `clientes` con `stamps_count:0`) → tarjeta digital en `localStorage.titan_client` → `LoyaltyCard` muestra QR = `/login?clientId=<id>` → admin abre esa URL con su cámara → `Login.jsx` autentica admin + llama `increment_stamps` (+1 sello) → redirect `/admin/client/:clientId` → `LoyaltyCard` refresca vía Realtime (`UPDATE` sobre `clientes`).

### ❗ BRECHA CRÍTICA vs FdV (obligación)
- **FdV #8**: *"1 venta elegible completada = 1 sello"* y **#22**: *"un sello originado por una venta anulada/devolución debe poder revertirse"*.
- El sello actual se otorga en `Login → increment_stamps`, **desacoplado de cualquier venta** (no hay tabla `ventas` ni `venta_items`). El contador `clientes.stamps_count` es el único origen, y `stamp_logs` solo registra timestamps.
- **Conclusión de diseño**: cuando se implemente la Fase 5 (POS), el sello **debe emerger de `register-sale`** (venta completada) y debe revertirse en `cancel-sale`/`return`. El RPC `increment_stamps` actual (login) queda **obsoleto/reemplazado** en el modelo objetivo; se conserva solo para el "sello especial controlado" (FdV §5.4).

### Sello especial (FdV §5.4) — NO EXISTE hoy
- Debe registrar: tipo `SELLO_ESPECIAL`, cliente, usuario que lo otorgó, fecha/hora, motivo, observación.
- [CONFIRMADO EN DOCUMENTACIÓN (FdV §5.4)]: requisito funcional. **[NO ENCONTRADO en código/DB]** → se propone tabla `stamp_logs` con `tipo ENUM(SELLO_VENTA, SELLO_ESPECIAL, SELLO_REFERIDO, CANJE, AJUSTE)` + columnas `usuario_id`, `motivo`, `venta_id?`.

### Canje (FdV §5.6)
- `redeem_reward`: 10 sellos → canje; conserva excedente (12→2) y registra en `redemptions`. [CONFIRMADO EN DOCUMENTACIÓN]
- FdV exige historial: sellos por venta, especiales, referidos, retirados, canjes, ajustes autorizados ("no depender únicamente de un contador mutable").

---

## 7. REFERIDOS (alanced a FdV §5.5, Decisión #11)

- Registro con `?ref=<code>`: `LeadPopup` valida vía RPC `get_client_by_referral_code`, almacena `clientes.referred_by`, muestra badge "Invitado por X". [CONFIRMADO EN CÓDIGO/DB]
- **❗ BRECHA CRÍTICA vs FdV #11**: *"La recompensa debe estar relacionada con una venta válida del referido. No debe generarse solamente por abrir un enlace o registrarse."*
  - El mecanismo actual otorga el bonus al **primer sello** del referido (trigger sobre `stamp_logs` INSERT). Si el sello se desacopla de la venta (ver §6), el bonus podría seguir disparándose sin una compra real.
  - **Conclusión de diseño**: el bonus de referido debe dispararse **desde `register-sale`** (venta completada del referido), no desde un trigger genérico de `stamp_logs`. Relacionar tabla `referral_bonuses(referido_id, venta_id, referrer_id, stamp_otorgado BOOLEAN, created_at)`.

---

## 8. ADMINISTRACIÓN (FdV §3, §4, §29 Fase 1)

- Login actual: `supabase.auth.signInWithPassword` + whitelisted `admin_users`. `ProtectedRoute` verifica sesión + `admin_users`. [CONFIRMADO EN CÓDIGO]
- `admin_users` **sin columna de rol** → solo "es admin / no es admin". **❗ BRECHA vs FdV §3**: FdV define 3 administradores operadores + 1-2 trabajadores; pendiente decidir owner/superadmin (Recomendación, no decisión).
- **Diseño objetivo**: `admin_users` → evolucionar a `trabajadores(id→auth.users, nombre, email, rol ENUM(Owner,Admin,Cashier,Worker), activo)`. Login sigue vía Supabase Auth; el rol se lee de `trabajadores` y se usa para autorización granular (RLS por rol). [CONFIRMADO EN FdV §3.1-3.2, #27 §2.4]
- El panel existente `/admin` (Dashboard + búsqueda) **se expande, no se reemplaza** (FdV §4, Decisión #26).

---

## 9. MENÚ (FdV §6, §26, Fase 2)

- Actualmente **hardcodeado** en `MenuGrid.jsx` (categorías, productos, precios, imágenes `/menu/*.png` estáticos). [CONFIRMADO EN CÓDIGO]
- **❗ NO EXISTE** tabla `productos`/`categorias` en vivo (HTTP 404). [CONFIRMADO EN DB EN VIVA]
- **Diseño objetivo**: migrar a `categorias` + `productos` (FdV §6: nombre, descripción, categoría, precio, precio promocional, disponibilidad, imagen [→ Supabase Storage bucket], estado ACTIVO/INACTIVO — "no eliminar físicamente"). El menú público lee productos activos (RLS pública). Imágenes pasan de `public/menu/` a bucket `product-images`.

---

## 10. PRODUCTOS / VENTAS / POS / PEDIDOS (FdV §10, §26, Fase 5)

**[NO EXISTE]** en vivo: ni tablas (`ventas`/`orders`/`order_items`/`cart`/`checkout`/`pagos`/`pedidos`) ni código frontend. [CONFIRMADO EN DB EN VIVA + grep]

| Concepto | Conclusión |
|---|---|
| PRODUCTOS | NO EXISTE como entidad (solo hardcodeado). PENDIENTE Fase 2. |
| VENTAS | NO EXISTE. PENDIENTE Fase 5. |
| PEDIDOS | NO EXISTE. PENDIENTE Fase 10 (carrito/WhatsApp). |
| CARRITO | NO EXISTE. PENDIENTE Fase 10. |
| POS | NO EXISTE. PENDIENTE Fase 5. |

**Contrato venta (FdV §30 Venta, §10):** `ventas(id, cliente_id→clientes nullable, trabajador_id→trabajadores, fecha, estado ENUM(BORRADOR,COMPLETADA,ANULADA), subtotal, descuento, total, metodo_pago)`. `venta_items(id, venta_id, producto_id, cantidad, precio_unitario, subtotal)`. `pagos(id, venta_id, cuenta_id→cuentas, tipo, monto, referencia)`. Devoluciones: `devoluciones(id, venta_id, motivo, total)`. `anulaciones(id, venta_id, usuario, motivo, efectos_inversos)`. [CONFIRMADO EN DOCUMENTACIÓN (FdV §10.2, §10.6, §10.7)]

---

## 11. INVENTARIO (FdV §9, §7.1, Fase 4)

**[NO EXISTE]** en vivo (`inventario`/`stock`/`insumos`/`movimientos_inventario`/`proveedores`) → HTTP 404. [CONFIRMADO EN DB EN VIVA]

**Contrato objetivo (FdV §9 "priorizar movimientos", §9.1):**
- `insumos(id, nombre, unidad_medida, stock_actual, costo_vigente, costo_estandar, stock_minimo, activo)`.
- `unidades_medida(slug, nombre,tipo(ponderable/lineal/volumen))`.
- `equivalencias(origen_unidad_id, destino_unidad_id, factor)` → resolver "1 kg queso → 150 g" (FdV §7.1).
- `movimientos_inventario(id, insumo_id, tipo ENUM(entrada, salida, merma, ajuste), cantidad, unidad_origen, referencia_tipo, referencia_id, trabajador_id, motivo, created_at)`.
- `mermas(id, insumo_id, cantidad, motivo ENUM(vencimiento,daño,desperdicio,error,pérdida), fecha, usuario)`. [CONFIRMADO EN FdV §9.2]
- `proveedores(id, nombre, contacto)`. [FdV §8.1]

---

## 12. RECETAS / COSTOS (FdV §7, §20, Fase 3)

**[NO EXISTE]** en vivo (`recetas`/`receta_ingredientes`/`ingredientes`/`costos`) → HTTP 404. [CONFIRMADO EN DB EN VIVA]

**Contrato objetivo (FdV §7):** `recetas(id, producto_id→productos, nombre, rendimiento_unidad, porciones)`. `receta_ingredientes(receta_id, insumo_id, cantidad, unidad_medida)`. Costos: **histórico no sobreescrito** (FdV §8.3) → `insumo_costos(insumo_id, compra_id, costo_unitario, fecha)`. Costo vigente/estándar derivado. `calcular_costo_producto(producto_id)` (RPC o vista materializada). → deriva `margen`, `precio_sugerido`. El sistema **no cambia el precio público automáticamente** al subir un insumo (FdV §8.4, #18). → alerta/recomendación.

---

## 13. CAJA / TESORERÍA / FINANZAS (FdV §12, §13, §14, Fase 6)

**[NO EXISTE]** en vivo (`caja`/`gastos`/`movimientos_financieros`/`cuentas`/`ingresos`/`compras`) → HTTP 404. [CONFIRMADO EN DB EN VIVA]

**Contrato objetivo:**
- `cuentas(id, nombre, tipo ENUM(efectivo, banco, nequi, daviplata, otra), saldo_actual(derivado), activo)`. Saldos **derivados de movimientos** (FdV §12.2, #19: "no caja basada en saldos manuales"). Cuentas configurables (efectivo/Bancolombia/Nequi + crear nuevas). [CONFIRMADO EN FdV §12.1]
- `movimientos_caja(id, cuenta_id, tipo ENUM(entrada, salida, transferencia), monto, origen, destino?, referencia_tipo, referencia_id, trabajador_id, descripcion, created_at)`. Transferencias entre cuentas NO son ingresos (FdV §12.4). [CONFIRMADO EN FdV §12.3]
- `compras(id, proveedor_id, fecha, total, forma_pago, cuenta_id)`. Relacionada 1:1 con movimiento financiero (FdV §13: "COMPRA ↔ MOVIMIENTO FINANCIERO", no duplicar egreso). Compra → inventario + costo insumo + movimiento financiero (FdV §8). [CONFIRMADO EN FdV §8.1]
- `gastos(id, categoria, monto, cuenta_id, fecha, descripcion, comprobante_url, usuario_id)`. Separado de compras (FdV §14). [CONFIRMADO EN FdV §14]
- `trabajadores` obligaciones (FdV §15.4): "obligación vs pago distintos" → tabla `liquidaciones(trabajador_id, periodo, modalidad, base_calculo, obligacion, pagos)` + movimiento financiero asociado. [CONFIRMADO EN FdV §15, Fase 7]

---

## 14. ANALÍTICA / REPORTES (FdV §19, §20, §22-25, Fase 8-9)

- **Actual**: `AdminDashboard.jsx` muestra KPIs básicos (clientes, sellos, premios listos, redenciones) + gráfico Recharts (sellos/redenciones 7d). [CONFIRMADO EN CÓDIGO]
- **Faltantes** ([NO ENCONTRADO]): exportación Excel/CSV, Pareto, punto de equilibrio, pronóstico, CEP, capacidad, flujo de efectivo por cuenta, estado de resultados (ventas-descuentos-costos-gastos). [CONFIRMADO EN FdV §19-25]
- **Costos/rentabilidad**: margen por producto/categoría, costo real vs estándar (FdV §20). [CONFIRMADO EN FdV §20]

---

## 15. INTEGRACIONES (FdV §26-28, §27, Fase 10-11)

| Integración | Estado | Evidencia |
|---|---|---|
| WhatsApp (pedidos) | ⚠️ Parcial — link estático | `WhatsAppButton.jsx` link `wa.me/3004126441`; FdV §26 indica pedidos → WhatsApp mensaje estructurado (Fase 10). |
| Google Maps | ✅ iframe embed | `LocationSection.jsx:26` coords Santa Marta. |
| Instagram | ✅ link | `@titangrill_burger`. |
| Web Push | ❌ NO EXISTE | FdV §28 (Fase 11). |
| Evolution API / n8n / IA | ❌ NO EXISTE | FdV §27 arquitectura futura Cliente→WA→Evolution→n8n→Titan→Supabase (Fase 11). IA sin privilegios admin (FdV §27). |

---

## 16. MAPA DE DEPENDENCAS (actual + objetivo)

```
SPA (React) ──anon/authenticated──> Supabase REST/Realtime
   │   ├─ clientes/LeadPopup+JoinClub            (lead capture, referral_code)
   │   ├─ RPC get_client_by_referral_code        (valida ?ref=)
   │   ├─ RPC increment_stamps  ← Login(escaneoQR)  [← ver §6 brecha: debe provenir de register-sale]
   │   ├─ RPC redeem_reward     ← AdminDashboard
   │   └─ (FUTURO) Edge Function register-sale   --service_role--> Supabase
             ├─ ventas + venta_items
             ├─ pagos → movimientos_caja (cta)
             ├─ movimientos_inventario (descuento stock)
             ├─ stamp_logs (sello ligado a venta) + clientes.stamps_count
             ├─ referral_bonus (ligado a venta del referido) [FdV #11]
             └─ admin_audit_log (accion: crear venta)
```

---

## 17. ESTRATEGIA DE SEGURIDAD (FdV §3.4, #27, #28; skill security-privileges)

- **Supabase Auth** para identidad (correo+password, recovery, sesión). La info extra del trabajador/admin vive en perfil/rol vinculado a `auth.users` (FdV §3.4, #27). [CONFIRMADO EN FdV]
- **RLS estricto por rol**: `anon` solo lead (`clientes` INSERT limitado) + SELECT productos activos; `authenticated`+rol para admin; `service_role` **solo en Edge Functions**. `force row level security` en tablas sensibles (ventas/caja/inventario/audit). [skill security-privileges]
- **Principle of least privilege**: revocar `all on schema public from public`; `grant` selectivo; RPCs `SECURITY DEFINER` para writers; **nunca** exponer `SUPABASE_SERVICE_ROLE_KEY` al cliente. [CONFIRMADO EN DB: no aparece en `.env`/`src/`; solo referido como comentario en `.env.example`]
- RPC existentes (`increment_stamps`/`redeem_reward`) `SECURITY DEFINER` se conservan (CONSERVAR) y se endurecen.
- Edge Functions usan `createServerSupabaseClient` + `service_role` (server-side env var); cliente nunca lo ve.

---

## 18. ESTRATEGIA DE DESPLIEGUE (CONSERVAR + EXTENDER)

- SPA: Vite build → assets estáticos; Nginx (`nginx.conf`) SPA fallback + cache 1y. [CONFIRMADO EN CÓDIGO]
- Edge Functions: nuevas funciones dentro del proyecto Supabase (misma región); no cambian Docker/Nginx del SPA.
- Storage: migrar imágenes de `public/menu/` al bucket `product-images`; `productos.imagen_url` apunta al bucket.
- Migrations: versionar como migrations de Supabase (nombre semántico + orden) para **reemplazar** los 7 scripts conflictivos (ver §4).
- `Dockerfile:9-10` **hardcodea** la `anon` pública → ordenar: pasar por build arg/env. [CONFIRMADO EN CÓDIGO]

---

## 19. ORDEN DE IMPLEMENTACIÓN (FdV §29 Fase 0-11)

Mapeo de la Fuente de la Verdad → prioridad técnica (validar contra esquema real antes de migrar, FdV §29.19):

| FdV | Tema | Dependencia técnica clave (esto) |
|---|---|---|
| Fase 0 | Definición + FdV | ✅ hecho |
| Fase 1 | Usuarios/Roles/Permisos | `admin_users`→`trabajadores(rol)`; RLS por rol [ver §8] |
| Fase 2 | Productos/Catálogo/Unidades | `categorias`/`productos`; migrar `MenuGrid` a DB; `unidades_medida`/`equivalencias` |
| Fase 3 | Recetas/Costos | `recetas`/`receta_ingredientes`; `insumo_costos` histórico; `calcular_costo_producto` |
| Fase 4 | Compras/Inventario/Mermas | `insumos`/`movimientos_inventario`/`mermas`/`proveedores`; triggers de stock |
| Fase 5 | POS/Ventas/Pagos | **`register-sale` (Edge) atómico**: venta+items+pagos→movimientos_caja+movimientos_inventario+stamp_logs(cliente)+audit. ¡Este cierra la brecha §6! |
| Fase 6 | Caja/Tesorería/Gastos | `cuentas`/`movimientos_caja`/`compras`/`gastos`; saldo derivado (vista/trigger) |
| Fase 7 | Trabajadores/Liquidaciones | `trabajadores`; `liquidaciones` (POR_HORA/VENTA/TURNO) |
| Fase 8 | Rentabilidad/Break-even | vistas/materializadas de margen; alertas de costo (FdV §8.4) |
| Fase 9 | Analítica/Pareto/Pronóstico/CEP | export, reportes, series → Edge read-only con service_role |
| Fase 10 | Menú digital/Carrito/WhatsApp | carrito → pedido → WA mensaje estructurado |
| Fase 11 | Automatización/IA/Notificaciones | WA→Evolution→n8n→Titan→Supabase; IA con permisos limitados |

---

## 20. BRECHAS VS FUENTE DE VERDAD (prioridad de corrección conceptual)

| # | Brecha | Base FdV | Acción de diseño |
|---|---|---|---|
| A | Sello otorgado en login, no ligado a venta | #8, #22, §5.3 | Mover sello a `register-sale`; revertir en anulación/devolución; reservar `increment_stamps` para sello especial |
| B | Bonus referido en primer sello, no en primera compra | #11, §5.5 | Disparar bonus referido desde venta completada del referido, no desde trigger de stamp_logs |
| C | No hay sello especial (tipo/motivo/usuario) | #10, §5.4 | Añadir `tipo`+`usuario_id`+`motivo`+`motivo` a `stamp_logs` |
| D | `admin_users` sin roles | §3, #3 | Evolucionar a `trabajadores` con rol; owner/superadmin pendiente (recomendación) |
| E | Menú hardcodeado | §6, Fase 2 | Migrar a `productos`/`categorias` + Storage imágenes |
| F | 7 scripts SQL conflictivos | auditoría | Consolidar a migrations versionadas; unificar `increment_stamps`; resolver trigger `auto_referral_bonus` vs `trg_check_referral_bonus` |

---

## 21. ARCHIVOS FUNDAMENTALES

- `AGENTS.md` — reglas de agente, stack, convenciones.
- `TITAN_GRILL_FUENTE_DE_VERDAD.md` — **norma funcional ancla** (Decisiones CONFIRMADAS §31).
- `src/App.jsx` — rutas, guards, boundary.
- `src/lib/supabaseClient.js` — singleton + manejo errores.
- `src/lib/referralUtils.js` (+ dead duplicado `src/utils/referralUtils.js`).
- `src/components/{LoyaltyCard,LeadPopup,Login,AdminDashboard,AdminClientView,ProtectedRoute,MenuGrid}`.jsx`
- `src/constants/index.js` — storage keys, timings, z-index, patterns.
- `*.sql` (7 scripts) — historial de intenciones (NO aplicar directamente; consolidar).
- `Dockerfile`, `nginx.conf` — deploy estático.

---

## 22. DECISIONES DEL DISEÑO (alineadas a FdV)

| Tema | Decisión | Base |
|---|---|---|
| Backend | Edge Functions/serverless (no Node monolítico) | §3, skill security-privileges |
| Qué a Edge | `register-sale`, devoluciones, movimientos caja/inventario, reportes, pagos | §3 flujo atómico |
| Qué en Supabase directo | clientes (lead), catálogo (lectura), fidelización vía RPC | CONFIRMADO EN DB/CÓDIGO |
| Roles | `trabajadores(rol)` desde `auth.users`; RLS por rol | FdV §3, #27 |
| Sello | Ligado a venta (Fase 5); revertible; tipo/sello-especial | FdV #8, #10, #22 |
| Referido | Bonus ligado a venta válida del referido | FdV #11 |
| Menú | `productos`/`categorias` + Storage | FdV §6 |
| Deploy | SPA Nginx (actual) + Edge Functions + Storage bucket | Dockerfile/nginx.conf |
| Migraciones | Scripts versionados, reemplazar 7 conflictivos | §4 |

---

## 23. RIESGOS / ABERTURAS

- **[ABERTURA]** La versión exacta de `increment_stamps`/`redeem_reward` en vivo no se pudo determinar (prohibido ejecutar/mutar). Validar via SQL Editor con privilegios antes de migrar.
- **[RIESGO CRÍTICO]** Sello desacoplado de la venta (§6 brecha A) → hasta que `register-sale` no exista, el sello se otorga por escaneo de QR, lo cual **contradice FdV #8**. Priorizar Fase 5.
- **[RIESGO CRÍTICO]** Bonus de referido por primer sello vs. primera compra (§7 brecha B) → **contradice FdV #11**. Re-diseñar trigger.
- **[RIESGO]** 7 scripts SQL conflictivos; aplicar uno podría romper triggers existentes. Consolidar antes de migrar.
- **[RIESGO]** `process.env.NODE_ENV` en `ErrorFallback.jsx:15` (Vite no polyfilla `process`); `bg-banner` clase inexistente en `LoyalaltyCard.jsx:174`. → ORDENAR (no corregir aquí; READ-ONLY).
- **[RIESGO]** `Dockerfile` hardcodea `anon`; `admin_audit_log` definida pero no aplicada.
- **[ABERTURA]** Roles Owner/Cashier/Worker y comisiones exactas son *recomendaciones* (FdV §32) → validar con propietario.

---

*Documento elaborado en cumplimiento de `newpromt.md` (Fase 0.6). READ-ONLY: no se creó/modificó ninguna tabla, RPC, RLS, código fuente, `.env`, migración, package.json ni commit. Único artefacto generado: este documento de diseño (permitido expresamente por `newpromt.md:99`).*
