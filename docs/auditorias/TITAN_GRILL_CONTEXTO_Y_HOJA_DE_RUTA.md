# TITAN GRILL — CONTEXTO MAESTRO Y HOJA DE RUTA PARA AI ORCHESTRATOR (GEMINI)

> **PROPÓSITO DE ESTE DOCUMENTO:**  
> Proporcionar contexto técnico completo, historia de la migración, decisiones tomadas, estado actual de la base de datos Supabase, reglas de arquitectura y los pasos exactos a seguir para la continuidad del desarrollo.

---

## 1. RESUMEN DEL PROYECTO

- **Nombre:** Titan Grill POS & Loyalty System
- **Tipo:** SPA (Single Package Web App) para punto de venta (POS), gestión de inventario, recetas, compras y club de fidelización por sellos.
- **Stack Técnico:**
  - **Frontend:** React 19 + React Router v7 (`react-router-dom@7`) + Vite 7
  - **Lenguaje:** **JavaScript / JSX puro** (*Sin TypeScript* - NO introducir `.ts`/`.tsx`).
  - **Estilos:** Tailwind CSS v4 (`@import "tailwindcss"` en `src/index.css`), `clsx`, `tailwind-merge`.
  - **Animaciones:** Framer Motion.
  - **Backend / DB:** Supabase (Auth, Postgres, Storage, RPCs PL/pgSQL).
  - **Verificación Estándar:** `npm run lint` (ESLint flat config) y `npm run build` (Vite build).

---

## 2. REGLAS DE ORO Y CONVENCIONES DE CÓDIGO

1. **Esquema de BD en Español:** La base de datos en Supabase usa tablas y columnas en español: `clientes`, `productos`, `insumos`, `producto_insumos`, `compras`, `compra_detalles`, `movimientos_inventario`, `sesiones_caja`, `ventas`, `movimientos_caja`, `proveedores`, `perfiles_trabajadores`.
2. **Variables de Entorno:**
   - `.env` rastreado en git.
   - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` son seguras en navegador.
   - `SUPABASE_SERVICE_ROLE_KEY` es **solo servidor** y jamás debe estar en código del cliente.
3. **No Inferencia Falsa:** No convertir suposiciones en datos. Si un dato no tiene evidencia explícita, marcar como `REQUIERE_CONFIRMACION`.
4. **Verificación Obligatoria:** Todo cambio debe verificar que `npm run lint` y `npm run build` pasen sin errores.

---

## 3. LO QUE YA SE REALIZÓ (AUDITORÍA E IMPORTACIÓN MAESTRA)

Se realizó una auditoría forense completa del Excel `costo titangrill.xlsx` (tomando **únicamente las hojas visibles**: `EQUIVALENCIA`, `burger`, `perro clasicc`, `salchipapa`, `salchip especial`, `salsas`, `inventario`, `CONTABILID 2026`) y se ejecutó la migración completa a Supabase:

### A. Estructura de BD y Schema
- Se agregó la columna `costo_unitario NUMERIC DEFAULT 0` a la tabla `public.insumos`.
- Se actualizó la función RPC `recibir_compra(p_compra_id)` en Supabase para que al recibir una compra:
  1. Aumente el `stock_actual` del insumo.
  2. Actualice el `costo_unitario` vigente en `insumos` con el precio de compra recibido.
  3. Inserte el movimiento `ENTRADA_COMPRA` en `movimientos_inventario`.

### B. Catálogo de Insumos y Proveedores Importados
- **40 Insumos Activos:**
  - 34 Insumos Productivos (Carne Especial, Pollo, Quesos, Vegetales, Salsas base, Especias, etc.).
  - 5 Empaques/Consumibles (Empaque J1, Bolsa, Servilleta, Papel Envoltorio 29×29, Porta Perro).
  - 1 Insumo Actualizado: "Pan de Hamburguesa" → "Pan Hamburguesa Artesanal" (manteniendo su UUID histórico `73548bdb...`).
  - Todos configurados con su `costo_unitario` real derivado de `EQUIVALENCIA`.
- **3 Proveedores Creados:** `Chalo`, `Carnecol`, `Olimpica`.

### C. Productos y Recetas Normalizadas (59 Registros en `producto_insumos`)
1. **Burger Classic:** Receta de 19 ingredientes ($14.000 precio / $6.683 costo → 52,3% margen).
2. **Perro Caliente:** Receta de 12 ingredientes ($8.000 precio / $3.721 costo → 53,5% margen).
3. **Salchipapa:** Producto creado ($13.000 precio / $6.385 costo → 50,9% margen) con 13 ingredientes.
4. **Salchipapa Especial:** Producto creado ($18.000 precio / $9.497 costo → 47,2% margen) con 15 ingredientes.
5. **Papa en Espiral:** Desactivado (`activo = false`) tras confirmación (sustituido por Salchipapa).
6. **Bebidas:** 4 bebidas conservadas con `requiere_inventario = false` (Postobón, Coca-Cola, Cerezada, Limonada).

### D. Frontend Adaptado
- `src/components/AdminDashboard.jsx` fue adaptado para mostrar, calcular y guardar `costo_unitario` en insumos y valorar el inventario total.
- ESLint y Vite build 100% limpios y funcionales.

---

## 4. ESTADO ACTUAL Y DATOS HISTÓRICOS

- **Fidelización y Clientes:** 14 clientes y 15 `stamp_logs` reales preservados e intactos.
- **Transacciones de Prueba:** Existen 1 venta de prueba, 1 sesión de caja de prueba y 2 movimientos de caja de prueba preservados de la fase inicial.
- **Estado del Inventario:**
  - Todos los 40 insumos tienen actualmente `stock_actual = 0` (salvo Pan Hamburguesa que tiene 9 de prueba).
  - **Impacto:** Como los productos tienen `requiere_inventario = true`, la función `registrar_venta()` de Supabase **bloqueará la venta en caja POS** hasta que se realice la toma física / primera carga de compras que alimente el stock.

---

## 5. PRÓXIMOS PASOS (HOJA DE RUTA RECOMENDADA)

### FASE 1: Habilitación Operativa de Inventario (Inmediato)
1. **Toma Física / Carga de Stock Inicial:**
   - Registrar la primera compra o ajuste inicial de stock en Supabase (o mediante el panel Admin) para alimentar el `stock_actual` de los 40 insumos.
2. **Prueba de Venta POS:**
   - Realizar una venta en el POS de Burger Classic, Perro Caliente, Salchipapa y Salchipapa Especial.
   - Verificar que `registrar_venta()` descuente automáticamente las cantidades por receta de `producto_insumos` y genere los `movimientos_inventario` tipo `VENTA`.

### FASE 2: Resoluciones de Productos e Insumos Pendientes
1. **Corn Dog Clásico:**
   - Actualmente existe en Supabase ($12.000, `activo = true`, `requiere_inventario = true`) pero no tiene receta en el Excel visible.
   - *Decisión pendiente:* Asignar receta si el cliente la proporciona, cambiar `requiere_inventario = false`, o desactivar (`activo = false`).
2. **10 Insumos Operativos (Carbón, Limón, Huevo, Cilantro, Mantequilla, etc.):**
   - Presentes en `EQUIVALENCIA` pero no vinculados a recetas visibles. Decidir si se importan como insumos de inventario para compras generales.
3. **Subrecetas de Salsas (Bigmag, Tártara, Bacon):**
   - La hoja `salsas` del Excel define sus fórmulas. Se pueden modelar como preparaciones internas.
4. **Producto "Salsa Extra":**
   - Crear un producto vendible "Salsa Extra" vinculado a `Porción Salsa Acompañamiento` para cobrar porciones adicionales solicitadas por el cliente.

### FASE 3: Limpieza y Pulido
1. **Limpieza de Datos de Prueba:** Eliminar las transacciones/sesiones de prueba iniciales cuando el cliente dé la orden.
2. **Alertas de Stock Mínimo:** Configurar `stock_minimo` en el panel Admin para notificaciones de reabastecimiento.

---

## 6. COMANDOS ÚTILES PARA EL DESARROLLADOR

```bash
npm run dev      # Inicia servidor local de desarrollo (puerto 5173 / 5174)
npm run lint     # Ejecuta linter ESLint (DEBE pasar sin errores)
npm run build    # Compila bundle de producción (DEBE pasar sin errores)
npm run preview  # Previsualiza la versión compilada
```

---
*Documento actualizado al 2026-08-08 tras la migración del catálogo e insumos.*
