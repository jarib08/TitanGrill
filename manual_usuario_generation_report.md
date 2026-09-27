# INFORME FINAL — GENERACIÓN DE MANUAL OPERATIVO PDF
## Titan Grill — Manual de Usuario (Administrador · Trabajador · Cliente)

**Fecha de Generación:** 24 de Agosto de 2026  
**Documento Generado:** `Titan_Grill_Manual_Usuario.pdf`  
**Ubicación:** `e:\Documents\titan_grill\Titan_Grill_Manual_Usuario.pdf`  
**Tamaño del Archivo:** 4.38 MB (4,382,921 bytes)  
**Total de Páginas:** 32 páginas  
**Total de Capturas Reales Utilizadas:** 36 capturas de pantalla de alta resolución  
**Entorno / Aplicación Auditada:** Producción en vivo (`https://titangrill.online`)  

---

## 1. Resumen Ejecutivo

Se ejecutó con éxito el flujo integral de 12 fases establecido en [`newpromt.md`](file:///e:/Documents/titan_grill/newpromt.md) para generar el **Manual Operativo Oficial de Titan Grill** en formato PDF profesional.

El manual documenta **exclusivamente las funcionalidades reales y observables** en el código fuente y en la aplicación desplegada en producción, cubriendo con rigor las tres perspectivas del sistema:

1. **👨‍💼 ADMINISTRADOR:** Panel de control con 12 módulos activos, KPIs, gestión de menú, inventario de 4 niveles (insumos, recetas, compras, mermas), caja, ventas, fidelización, finanzas, analítica y configuración de socios.
2. **👷 TRABAJADOR / OPERADOR:** Punto de Venta (POS), apertura de turno con fondo inicial, catálogo por categorías, carrito dinámico, fidelización con escáner QR / búsqueda por celular, registro rápido de clientes, cobro multicanal (Efectivo, Nequi, Bancolombia, Mixto), consulta de ventas de turno, solicitud de anulación auditada y arqueo/cierre de caja.
3. **👤 CLIENTE:** Landing page, navegación, exploración de carta con modales de precios, Menú Digital interactivo (`/menu`), carrito con barra flotante, selección de modalidad de entrega (Domicilio fuera de la U, Yo paso por él [Para llevar / En el stand], Dentro de la U), pedido estructurado por WhatsApp, Club de Fidelización con tarjeta digital en tiempo real y QR, horarios y mapa interactivo.

---

## 2. Inventario de Módulos Documentados y Capturas

| Módulo / Sección | Captura Asociada | Descripción de la Vista |
| :--- | :--- | :--- |
| **Portada Oficial** | Diseño institucional | Estilo oscuro *fire/gold* con sellos de versión y roles |
| **Tabla de Contenidos** | Índice estructurado | 7 capítulos con desglose de secciones y números de página |
| **Capítulo 1: Introducción** | Diagrama de flujo | Matriz de permisos y flujo operativo comensal ➔ POS ➔ Admin |
| **Cliente: Hero** | `hero_section_1787554988457.png` | Cabecera principal con botones de acción directa |
| **Cliente: Carta** | `menu_section_1787555049914.png` | Selección Titan (Entradas, Burger Classic, Perros, Bebidas) |
| **Cliente: Menú Digital** | `menu_digital_catalogo_1787555267848.png` | Catálogo interactivo con buscador y filtros por categoría |
| **Cliente: Carrito Activo** | `menu_digital_con_carrito_1787555308955.png` | Barra flotante de pedido con contador y subtotal |
| **Cliente: Checkout** | `menu_checkout_modal_1787555365464.png` | Modal de checkout con las 3 modalidades de entrega |
| **Cliente: Yo paso por él** | `menu_checkout_recoger_1787555398896.png` | Selector "Para llevar" vs. "En el stand" |
| **Cliente: Club Fidelización** | `join_club_1787555159599.png` | Formulario de registro y tarjeta digital con 10 fuegos |
| **Cliente: Ubicación & Horario**| `ubicacion_horarios_1787555114352.png` | Mapa de Unimagdalena, Instagram y horario L-V 4:00 - 9:30 PM |
| **Trabajador: Login** | `login_page_1787555451730.png` | Acceso restringido con autenticación Supabase |
| **Trabajador: Caja Cerrada** | `pos_caja_cerrada_1787556824266.png` | Bloqueo de POS para ingreso obligatorio de fondo inicial |
| **Trabajador: POS Operación** | `pos_carrito_con_items_1787556880265.png` | Catálogo, carrito, selector de pago y búsqueda de cliente |
| **Trabajador: Registro Cliente**| `pos_modal_registro_cliente_1787556907458.png` | Modal de alta rápida de comensal desde el POS |
| **Trabajador: Mis Ventas** | `pos_modal_mis_ventas_1787556959478.png` | Historial de transacciones de turno con botón de anulación |
| **Trabajador: Arqueo de Caja** | `pos_modal_arqueo_1787557006637.png` | Conteo físico discriminado y cálculo automático de diferencias |
| **Admin: Dashboard** | `admin_dashboard_kpis_1787556321220.png` | Métricas de fidelización y accesos directos de operación |
| **Admin: Productos / Menú** | `admin_productos_menu_1787556752084.png` | Maestro de platos, precios, activación e imágenes |
| **Admin: Modal Producto** | `productos_modal_crear_producto_1787557352189.png`| Formulario completo de creación/edición de plato |
| **Admin: Inventario Insumos** | `admin_inventario_insumos_1787556339331.png`| Materias primas, stock actual, mínimo y costo unitario |
| **Admin: Modal Insumo** | `inventario_modal_crear_insumo_1787557091625.png` | Formulario de registro de materia prima |
| **Admin: Recetas** | `admin_inventario_recetas_1787556358735.png` | Escandallo por producto para descuento automático de stock |
| **Admin: Compras** | `admin_inventario_compras_1787556380426.png` | Registro de compras a proveedores con impacto en caja |
| **Admin: Mermas** | `admin_inventario_mermas_1787556402868.png` | Auditoría de pérdidas y desperdicios justificados |
| **Admin: Caja y Arqueo** | `admin_caja_arqueo_1787556434515.png` | Movimientos detallados y sesiones archivadas |
| **Admin: Ventas** | `admin_ventas_1787556469137.png` | Historial con detalle expandible y panel de anulaciones |
| **Admin: Clientes** | `admin_clientes_fidelizacion_1787556501646.png` | Base de datos de clientes, ranking de sellos y tarjetas |
| **Admin: Gastos Operativos** | `admin_gastos_operativos_1787556606217.png` | Control de egresos clasificados por categoría |
| **Admin: Modal Gasto** | `gastos_modal_registrar_gasto_1787557171792.png`| Formulario de registro de egreso con método de pago |
| **Admin: Rentabilidad / P&L**| `admin_rentabilidad_finanzas_1787556567589.png`| Estado de resultados, COGS y margen neto |
| **Admin: Liquidaciones** | `admin_liquidaciones_1787556676631.png` | Pagos por turno y nómina de trabajadores |
| **Admin: Analítica** | `admin_analitica_1787556640741.png` | Tendencias de venta, horas pico y análisis Pareto 80/20 |
| **Admin: Trabajadores** | `admin_trabajadores_1787556533944.png` | Directorio de personal y asignación de roles |
| **Admin: Configuración** | `admin_configuracion_1787556788138.png` | Reglas de fidelización y costos estructurales (Socios) |

---

## 3. Metodología de Inspección y Herramientas

1. **Browser Subagent:** Recorrió la aplicación en vivo en `https://titangrill.online`, interactuó con formularios en modo lectura y capturó las 36 pantallas sin alterar registros contables ni datos de base de datos.
2. **Motor de Renderizado PDF:** Node.js con Puppeteer headless y Chromium para garantizar maquetación A4 de alta fidelidad, márgenes balanceados, encabezados y pies de página con paginación dinámica (`Página X de Y`).
3. **Cero Modificaciones:** Se verificó la integridad del código fuente de React, archivos de configuración, `.env` y tablas de Supabase.

---

## 4. Validaciones Realizadas

- [x] **Existencia del PDF:** Archivo generado en `e:\Documents\titan_grill\Titan_Grill_Manual_Usuario.pdf` (4.38 MB).
- [x] **Páginas e Integridad:** 32 páginas sin cortes de texto, sin títulos huérfanos y con todas las imágenes cargadas.
- [x] **Fidelidad de Nombres:** Botones, formularios, campos y estados coinciden exactamente con la interfaz real en español.
- [x] **Seguridad:** CERO exposición de contraseñas, tokens, service role keys, anon keys o credenciales privadas en el documento.
- [x] **Estado de Git:** Verificado con `git status --short`. Ningún archivo de código fuente (`src/`, `package.json`, etc.) fue modificado.

---

## 5. Limitaciones / Notas del Sistema

- Los módulos de **Analítica** y **Liquidaciones** muestran estados vacíos en producción cuando no hay ventas o turnos generados en el rango de fechas seleccionado; el manual explica su funcionamiento teórico basado en el código del componente `AdminDashboard.jsx`.
- El acceso a **Configuración** está restringido exclusivamente a administradores que tengan la propiedad `es_socio: true` en su perfil de Supabase.
