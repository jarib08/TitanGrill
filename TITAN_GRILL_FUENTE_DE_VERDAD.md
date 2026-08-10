# TITAN GRILL — FUENTE DE LA VERDAD
## Versión 1.0 — Documento maestro de negocio, producto y arquitectura funcional

> **Estado:** BORRADOR PARA APROBACIÓN DEL PROPIETARIO  
> **Última actualización:** 2026-08-07  
> **Propósito:** establecer la visión, reglas de negocio, relaciones entre módulos y decisiones confirmadas de Titan Grill antes de realizar cambios estructurales en código o base de datos.

---

# 0. REGLAS DE USO

Este archivo es la **Fuente de la Verdad (Source of Truth)** del proyecto Titan Grill.

Los agentes de desarrollo deben:

1. Leer este documento antes de modificar funcionalidades relacionadas.
2. Respetar las decisiones marcadas como **CONFIRMADA**.
3. No convertir una recomendación en requisito sin aprobación.
4. No modificar una regla confirmada sin autorización explícita.
5. Si una nueva tarea contradice este documento, detenerse y señalar la contradicción antes de implementar.
6. Mantener actualizadas las relaciones entre módulos cuando una implementación cambie el flujo de datos.
7. Registrar nuevas decisiones aquí antes de considerarlas parte definitiva del producto.
8. No hacer operaciones Git destructivas ni commits/pushes sin autorización explícita.

---

# 1. VISIÓN DEL SISTEMA

Titan Grill evolucionará desde un sitio web con sistema de fidelización hacia un **sistema operativo integral para el negocio**, manteniendo como prioridad que la operación diaria sea rápida y sencilla.

El sistema deberá integrar progresivamente:

- Fidelización de clientes.
- Punto de venta (POS).
- Catálogo de productos.
- Compras.
- Inventario.
- Recetas estándar.
- Costos y márgenes.
- Caja y tesorería.
- Gastos.
- Trabajadores y liquidaciones.
- Rentabilidad.
- Punto de equilibrio.
- Analítica.
- Pareto.
- Pronóstico de demanda.
- Control estadístico de procesos.
- Menú digital.
- Carrito.
- Pedidos por WhatsApp.
- Automatizaciones.
- Notificaciones.
- Futuramente IA para atención/ventas.

Una operación puede afectar varios módulos simultáneamente:

**Ventas → Caja → Inventario → Fidelización → Analítica → Rentabilidad.**

---

# 2. PRINCIPIO FUNDAMENTAL: OPERACIÓN SIMPLE

Titan Grill puede tener una arquitectura interna sofisticada, pero la operación del puesto debe ser simple.

Los administradores y trabajadores pueden estar simultáneamente:

- atendiendo clientes;
- registrando pedidos;
- cobrando;
- identificando clientes;
- preparando productos;
- entregando pedidos;
- atendiendo varias órdenes.

Por tanto:

> **La complejidad debe estar detrás del sistema, no delante del operador.**

El POS debe priorizar:

- una pantalla principal;
- pocos pasos;
- acciones visibles;
- botones grandes;
- mínimo desplazamiento;
- mínimo cambio de página;
- registro rápido;
- soporte para pagos mixtos;
- cliente identificado o anónimo;
- acceso rápido al QR de fidelización;
- cierre de venta sin formularios innecesarios.

---

# 3. USUARIOS Y ROLES

## 3.1 Administradores

Actualmente existen **3 administradores** que participan directamente en la operación.

Los administradores pueden:

- vender;
- preparar productos;
- comprar insumos;
- administrar inventario;
- gestionar clientes;
- revisar información financiera;
- realizar tareas administrativas;
- eventualmente recibir remuneración por su trabajo.

No debe asumirse que los administradores solamente "administran". Son también operadores del negocio.

## 3.2 Trabajadores

Se prevé inicialmente:

- 1 o 2 trabajadores.

Pueden vender y realizar determinadas operaciones operativas según permisos.

## 3.3 Cliente

Puede:

- registrarse;
- utilizar fidelización;
- recibir sellos;
- obtener recompensas;
- eventualmente realizar pedidos digitales.

## 3.4 Autenticación

La opción recomendada es utilizar **Supabase Auth** para:

- correo + contraseña;
- recuperación de contraseña;
- sesión;
- identidad del usuario.

Los datos de autenticación no deben duplicarse innecesariamente en tablas propias.

La información adicional del empleado/administrador debe vivir en perfiles/roles/permisos vinculados al usuario autenticado.

> **Pendiente:** definir si los 3 administradores tendrán exactamente el mismo nivel de permisos o si existirá un propietario/superadministrador.

---

# 4. ADMINISTRACIÓN EXISTENTE

Actualmente existe un apartado `/admin` con:

- gráficas;
- consulta de clientes;
- búsqueda por nombre;
- búsqueda por número.

La evolución recomendada es **ampliar el área administrativa existente**, no crear un sistema administrativo completamente separado sin necesidad.

La futura administración podrá organizarse en:

- Dashboard
- Ventas / POS
- Clientes / Fidelización
- Productos
- Recetas
- Inventario
- Compras
- Caja / Tesorería
- Gastos
- Trabajadores
- Rentabilidad
- Reportes
- Configuración

La estructura exacta de navegación queda pendiente de UX.

---

# 5. FIDELIZACIÓN

## 5.1 Flujo actual

El cliente:

1. llega al punto de venta;
2. conoce el programa;
3. entra a la web;
4. completa el formulario;
5. obtiene su tarjeta;
6. recibe su primer fuego;
7. posteriormente muestra su QR;
8. el administrador/trabajador lo escanea;
9. se genera el sello.

## 5.2 Regla normal — CONFIRMADA

> **1 venta elegible completada = 1 sello.**

No importa cuántos productos haya dentro de la venta.

## 5.3 Sello ligado a venta

El sello normal debe quedar relacionado con la venta que lo originó.

```text
CLIENTE
  ↓
VENTA ELEGIBLE
  ↓
VENTA COMPLETADA
  ↓
1 SELLO
```

## 5.4 Sello especial mediante QR

Debe existir una posibilidad controlada para que un administrador pueda otorgar un sello especial mediante el QR del cliente.

Casos posibles:

- el cliente publicó en redes;
- recomendó el negocio;
- realizó una acción promocional;
- tuvo una situación especial;
- el administrador desea premiarlo.

Esto **no debe confundirse con el sello automático de una venta**.

Debe quedar registrado:

- tipo: `SELLO_ESPECIAL`;
- cliente;
- usuario que lo otorgó;
- fecha/hora;
- motivo;
- observación opcional.

No debe existir una vía silenciosa para alterar el contador.

## 5.5 Referidos

La lógica actual contempla:

```text
Cliente A invita a Cliente B
        ↓
Cliente B compra
        ↓
Cliente A recibe sello
```

La recompensa debe estar relacionada con una venta válida del referido.

No debe generarse solamente por abrir un enlace o registrarse.

## 5.6 Recompensas

Al cumplir la cantidad requerida:

```text
sellos acumulados
      ↓
cumple condición
      ↓
recompensa/canje
```

Debe conservarse historial de:

- sellos por venta;
- sellos especiales;
- sellos por referido;
- sellos retirados;
- canjes;
- ajustes autorizados.

No depender únicamente de un contador mutable.

---

# 6. PRODUCTOS Y MENÚ

El menú actualmente es relativamente estático.

La evolución debe convertir los productos en entidades administrables.

Un producto puede tener:

- nombre;
- descripción;
- categoría;
- precio;
- precio promocional;
- disponibilidad;
- imagen;
- estado activo/inactivo;
- receta;
- costo;
- margen;
- información para menú digital.

No eliminar productos físicamente. Preferir:

```text
ACTIVO
INACTIVO
```

para conservar historial.

---

# 7. RECETAS ESTÁNDAR

Cada producto que tenga composición de insumos podrá asociarse a una receta estándar.

La receta debe soportar:

- ingrediente/insumo;
- cantidad;
- unidad de medida;
- costo unitario;
- costo total;
- rendimiento;
- número de porciones;
- costo estándar total;
- costo estándar por porción;
- precio sugerido;
- margen.

La interfaz debe minimizar trabajo manual.

## 7.1 Unidades y equivalencias

Debe contemplar unidades como:

- kg;
- g;
- L;
- ml;
- unidad;
- paquete;
- etc.

Debe existir una capa de equivalencias/conversiones para permitir que una compra esté expresada en una unidad y la receta utilice otra.

Ejemplo:

```text
Compra:
1 kg de queso

Receta:
150 g de queso
```

---

# 8. COSTOS Y COMPRAS

## 8.1 Principio

Una compra no es simplemente una modificación de inventario.

Una compra puede generar:

```text
COMPRA
 ├── INVENTARIO
 ├── COSTO DEL INSUMO
 └── MOVIMIENTO FINANCIERO
```

## 8.2 Ejemplo

Compra:

```text
5 kg carne
$100.000
```

Registra:

```text
Compra:
5 kg
$100.000
$20.000/kg
```

Y produce:

```text
Inventario:
+5 kg

Tesorería:
-$100.000
```

según el medio de pago.

## 8.3 Historial de costos

Los costos no deben sobrescribirse destruyendo historial.

```text
Compra 1 → $20.000/kg
Compra 2 → $22.000/kg
Compra 3 → $21.000/kg
```

Debe conservarse el historial.

## 8.4 Costo vigente / estándar

Cuando cambie el costo:

```text
COMPRA
 ↓
nuevo costo
 ↓
recalcular costo de receta
 ↓
recalcular margen
 ↓
mostrar alerta/recomendación
```

El sistema **no debe cambiar automáticamente el precio público** solamente porque aumentó un insumo.

Debe permitir que un administrador decida si modifica el precio.

---

# 9. INVENTARIO

Debe permitir conocer:

- stock actual;
- entradas;
- salidas;
- consumo por recetas;
- compras;
- mermas;
- productos dañados;
- vencimientos;
- ajustes;
- diferencias físicas;
- unidades;
- costos.

## 9.1 Movimientos

Priorizar un modelo basado en movimientos:

```text
stock inicial
+ entradas
- consumo
- merma
+/- ajustes
= stock actual
```

Evitar depender únicamente de editar un campo `stock` manualmente.

## 9.2 Mermas

Registrar:

- producto;
- cantidad;
- motivo;
- fecha;
- usuario.

Motivos posibles:

- vencimiento;
- daño;
- desperdicio;
- error;
- pérdida.

## 9.3 Alertas

El sistema podrá indicar:

- stock bajo;
- próximo vencimiento;
- agotado;
- consumo anormal.

Futuras recomendaciones de compra podrán utilizar:

- ventas históricas;
- consumo;
- stock;
- días restantes;
- demanda estimada.

---

# 10. POS / VENTAS

## 10.1 Objetivo

Registrar una venta rápidamente.

## 10.2 Estados

Diseño recomendado:

```text
BORRADOR
   ↓
COMPLETADA
   ↓
ANULADA
```

Una venta anulada no se elimina físicamente.

## 10.3 Venta anónima — CONFIRMADO

No todos los clientes quieren fidelizarse.

```text
VENTA
├── cliente identificado
└── venta anónima
```

Una venta anónima no genera sello.

## 10.4 Venta identificada

Puede identificar al cliente mediante:

- QR;
- búsqueda;
- número;
- otro mecanismo rápido.

## 10.5 Pagos múltiples — CONFIRMADO

Una venta puede pagarse mediante varios medios.

Ejemplo:

```text
Venta: $30.000

Efectivo: $10.000
Nequi:    $20.000
```

La venta sigue siendo una sola.

## 10.6 Cancelaciones

Las ventas pueden cancelarse cuando sea necesario.

No se debe borrar la venta.

Debe quedar:

- estado;
- usuario;
- fecha;
- motivo;
- efectos inversos.

## 10.7 Devoluciones

Se recomienda soportar:

- devolución completa;
- devolución parcial.

Una devolución puede afectar:

- dinero;
- inventario;
- fidelización;
- reportes.

---

# 11. DESCUENTOS Y PROMOCIONES

No se establece una comisión fija de descuento para trabajadores.

Se podrán configurar:

- promociones;
- precios especiales;
- descuentos autorizados.

La venta debe conservar:

```text
precio de lista
- descuento
= precio final
```

Esto permitirá analizar:

- ventas brutas;
- descuentos;
- ventas netas;
- impacto de promociones.

Los descuentos no deben desaparecer del historial.

---

# 12. CAJA Y TESORERÍA

## 12.1 Cuentas

La operación actual contempla:

- efectivo;
- Bancolombia;
- Nequi.

No asumir conceptos que no existan en el negocio.

Debe existir posibilidad de crear nuevas cuentas:

```text
Nequi
Bancolombia
Daviplata
otra cuenta bancaria
etc.
```

## 12.2 Saldos

Los saldos deben derivarse de movimientos:

```text
saldo inicial
+ ingresos
- egresos
+ transferencias
= saldo
```

No depender de sobrescribir manualmente el saldo.

## 12.3 Movimientos

Cada movimiento puede registrar:

- fecha;
- cuenta;
- tipo;
- monto;
- origen;
- destino si aplica;
- referencia;
- usuario;
- descripción.

## 12.4 Transferencias

Debe soportarse:

```text
Nequi
 ↓
Bancolombia
```

sin tratarlo como ingreso/venta.

Es un movimiento entre cuentas propias.

---

# 13. COMPRAS COMO EGRESOS

Una compra de insumos puede generar un egreso financiero.

Ejemplo:

```text
Compra carne
$100.000
pagada en efectivo
```

Tesorería:

```text
Efectivo -$100.000
```

La compra además queda registrada como compra e inventario.

No duplicar el egreso.

Debe existir una relación clara:

```text
COMPRA
 ↕
MOVIMIENTO FINANCIERO
```

---

# 14. GASTOS

Debe existir un módulo de gastos separado de compras de inventario.

Ejemplos:

- servicios;
- transporte;
- publicidad;
- mantenimiento;
- otros gastos operativos.

Cada gasto puede registrar:

- categoría;
- monto;
- cuenta de origen;
- fecha;
- descripción;
- comprobante;
- usuario.

---

# 15. TRABAJADORES Y LIQUIDACIONES

## 15.1 Modalidades confirmadas

Solo se contemplan inicialmente:

### POR_HORA

```text
horas × tarifa
```

### POR_VENTA

```text
base de comisión × porcentaje
```

### POR_TURNO

```text
turnos × tarifa
```

No se implementa inicialmente el modelo mixto.

## 15.2 Administradores también trabajan

Los 3 administradores pueden participar directamente en:

- ventas;
- preparación;
- compras;
- operación.

El sistema no debe asumir que solamente los trabajadores generan costos de personal.

## 15.3 Pago a administradores

La frecuencia todavía no está definida.

Debe ser configurable.

Opciones:

- diario;
- semanal;
- quincenal;
- mensual;
- otra frecuencia.

No codificar una única frecuencia.

## 15.4 Obligación vs pago

Debe distinguirse entre lo generado y lo efectivamente pagado:

```text
Trabajo generado
↓
obligación $200.000
↓
pago realizado
↓
movimiento financiero -$200.000
```

---

# 16. CUADRE DE CAJA

Debe existir cierre/arqueo.

Conceptualmente:

```text
MOVIMIENTOS ESPERADOS
        ↓
DECLARACIÓN REAL
        ↓
DIFERENCIA
```

Por cuenta:

```text
Efectivo esperado
Efectivo real
Diferencia

Nequi esperado
Nequi real
Diferencia

Bancolombia esperado
Bancolombia real
Diferencia
```

El detalle de si el arqueo será "a ciegas" o visible queda pendiente.

---

# 17. MODIFICACIONES DE VENTAS CERRADAS

Una venta cerrada no debe editarse silenciosamente.

Se recomienda:

```text
VENTA CERRADA
 ↓
SOLICITUD DE MODIFICACIÓN
 ↓
motivo
 ↓
revisión/autorización según permiso
 ↓
cambio
 ↓
AUDITORÍA
```

Los administradores deben poder recibir aviso de solicitudes relevantes.

Los trabajadores pueden solicitar modificaciones.

Conservar:

- valor anterior;
- valor nuevo;
- usuario;
- fecha;
- motivo;
- autorización;
- resultado.

---

# 18. AUDITORÍA

Debe existir historial para acciones sensibles:

- cambios de precios;
- descuentos;
- anulaciones;
- devoluciones;
- ajustes de inventario;
- mermas;
- sellos especiales;
- cambios de ventas cerradas;
- movimientos financieros;
- cambios de roles/permisos;
- configuración.

---

# 19. REPORTES FINANCIEROS

El sistema deberá evolucionar hacia:

## Flujo de dinero

Responder:

> ¿Dónde está la plata?

Ejemplo:

```text
Efectivo       $X
Nequi          $Y
Bancolombia    $Z
```

## Ventas

- hoy;
- ayer;
- semana;
- mes;
- rango personalizado.

## Gastos

- día;
- semana;
- mes;
- categoría.

## Compras

- proveedor;
- producto;
- periodo.

## Rentabilidad

Diferenciar:

- ventas;
- descuentos;
- costos;
- gastos;
- resultado.

## Estado de resultados

Futuro módulo:

```text
Ingresos
- costo de ventas
= utilidad bruta

- gastos operativos
= resultado operativo
```

La estructura contable exacta queda pendiente de diseño financiero.

---

# 20. RECETAS Y RENTABILIDAD

Para cada producto se busca calcular:

- costo estándar total;
- costo estándar por porción;
- precio sugerido antes de impuestos;
- precio sugerido impuesto incluido;
- precio aprobado;
- margen de costo;
- margen de rentabilidad.

También:

- margen por producto;
- margen por categoría;
- costo real vs estándar.

---

# 21. PUNTO DE EQUILIBRIO

Futuro módulo.

Debe determinar cuánto debe vender Titan Grill para cubrir sus costos.

Debe definir previamente:

- costos fijos;
- costos variables;
- margen de contribución;
- periodo de análisis.

No implementar fórmulas simplificadas sin definir estas bases.

---

# 22. PARETO

Analizar ventas históricas para identificar productos de alta contribución.

Objetivos:

- decisiones sobre menú;
- inventario;
- compras;
- promociones.

No asumir automáticamente que 20% exacto produce 80%; calcularlo a partir de datos reales.

---

# 23. PRONÓSTICO DE DEMANDA

Futuro módulo.

Usará históricos, idealmente:

- fecha;
- día de semana;
- hora/bloque;
- producto;
- cantidad.

Objetivos:

- anticipar demanda;
- mejorar compras;
- reducir faltantes;
- reducir desperdicio.

---

# 24. CONTROL ESTADÍSTICO DE PROCESOS (CEP)

Futuro módulo.

Posibles variables:

- peso de ingredientes;
- tamaño de porción;
- tiempos de preparación;
- tiempos de entrega;
- satisfacción del cliente.

Las variables iniciales deben definirse antes de implementar.

---

# 25. PLANIFICACIÓN DE CAPACIDAD

Futuro módulo para estimar:

- demanda por hora;
- demanda por día;
- carga de trabajo;
- personas necesarias.

Debe permitir analizar días y franjas horarias.

---

# 26. MENÚ DIGITAL Y PEDIDOS

Después de consolidar módulos internos:

```text
MENÚ
 ↓
SELECCIONAR PRODUCTOS
 ↓
CARRITO
 ↓
DATOS DEL CLIENTE
 ↓
PEDIDO
 ↓
WHATSAPP
```

El pedido debe poder enviarse al WhatsApp del negocio con un mensaje estructurado.

---

# 27. WHATSAPP, N8N, EVOLUTION API E IA

Futuro.

Posible arquitectura:

```text
Cliente
 ↓
WhatsApp
 ↓
Evolution API
 ↓
n8n
 ↓
lógica Titan Grill
 ↓
Supabase
```

La IA podrá posteriormente:

- responder preguntas;
- consultar menú;
- ayudar a tomar pedidos;
- enviar carrito;
- consultar disponibilidad;
- ejecutar flujos controlados.

La IA no debe tener privilegios administrativos ilimitados.

---

# 28. NOTIFICACIONES

Futuro.

Posibles canales:

- Web Push;
- WhatsApp;
- otros.

Casos:

- promociones;
- descuentos;
- campañas;
- fidelización;
- recordatorios.

Debe existir consentimiento/preferencia cuando corresponda.

---

# 29. ORDEN CONCEPTUAL DE IMPLEMENTACIÓN

Orden inicial recomendado:

```text
FASE 0
Definición + Fuente de la Verdad
        ↓
FASE 1
Usuarios / Roles / Permisos
        ↓
FASE 2
Productos / Catálogo / Unidades
        ↓
FASE 3
Recetas / Costos
        ↓
FASE 4
Compras / Inventario / Mermas
        ↓
FASE 5
POS / Ventas / Pagos
        ↓
FASE 6
Caja / Tesorería / Gastos
        ↓
FASE 7
Trabajadores / Liquidaciones
        ↓
FASE 8
Rentabilidad / Punto de equilibrio
        ↓
FASE 9
Analítica / Pareto / Pronóstico / CEP
        ↓
FASE 10
Menú digital / Carrito / WhatsApp
        ↓
FASE 11
Automatización / IA / Notificaciones
```

Este orden es provisional y debe validarse contra el esquema real de Supabase y el código actual.

---

# 30. RELACIONES PRINCIPALES ENTRE DATOS

## Venta

```text
VENTA
 ├── cliente (opcional)
 ├── productos vendidos
 ├── descuentos
 ├── pagos
 ├── usuario que la registró
 ├── inventario afectado
 └── fidelización afectada
```

## Compra

```text
COMPRA
 ├── proveedor (si existe)
 ├── insumos
 ├── cantidades
 ├── costos
 ├── inventario
 └── movimiento financiero
```

## Producto

```text
PRODUCTO
 └── RECETA
      └── INSUMOS
```

## Insumo

```text
INSUMO
 ├── compras históricas
 ├── movimientos inventario
 ├── mermas
 └── recetas
```

## Cuenta financiera

```text
CUENTA
 └── MOVIMIENTOS
       ├── ventas
       ├── compras
       ├── gastos
       ├── pagos
       └── transferencias
```

## Fidelización

```text
CLIENTE
 └── MOVIMIENTOS DE SELLOS
       ├── venta
       ├── referido
       ├── sello especial
       ├── canje
       └── ajuste autorizado
```

---

# 31. DECISIONES CONFIRMADAS

1. Titan Grill evolucionará hacia una plataforma integral.
2. La operación del POS debe ser extremadamente sencilla.
3. Existen 3 administradores que también operan el negocio.
4. Se prevén 1–2 trabajadores inicialmente.
5. Los trabajadores soportarán modalidades por hora, por venta o por turno.
6. Los administradores también pueden generar obligaciones económicas por su trabajo.
7. La frecuencia de pago a administradores debe ser configurable.
8. 1 venta elegible completada = 1 sello.
9. Una venta puede ser anónima.
10. Debe existir posibilidad controlada de otorgar sellos especiales mediante QR.
11. Los referidos deben estar ligados a una compra válida del referido.
12. Una venta puede utilizar múltiples medios de pago.
13. Las cuentas financieras deben ser configurables.
14. Actualmente se contemplan efectivo, Bancolombia y Nequi.
15. Compras, inventario, costos y tesorería deben estar relacionados.
16. Debe conservarse historial de costos.
17. Un cambio de costo debe poder recalcular costos/márgenes de recetas.
18. El precio público no cambia automáticamente por un cambio de costo.
19. Debe existir control de mermas.
20. Las ventas anuladas no deben borrarse.
21. Deben existir devoluciones completas y parciales.
22. Un sello originado por una venta anulada/devolución debe poder revertirse correctamente.
23. Los descuentos/promociones deben conservarse en la venta.
24. Debe existir auditoría de acciones sensibles.
25. Las ventas cerradas no deben modificarse silenciosamente.
26. El área administrativa existente `/admin` será la base para ampliar la administración.
27. La autenticación interna deberá apoyarse en Supabase Auth.
28. Las credenciales sensibles de servidor nunca deben exponerse al frontend.
29. El sistema debe conservar trazabilidad entre ventas, pagos, inventario, fidelización y tesorería.

---

# 32. RECOMENDACIONES AÚN NO CONVERTIDAS EN DECISIONES

Estas son propuestas y **no deben tratarse como requisitos definitivos sin aprobación**:

- propietario/superadministrador separado de administradores;
- permisos exactos por acción;
- arqueo a ciegas vs visible;
- política exacta para costo estándar;
- fórmula exacta de precio sugerido;
- política de valoración de inventario;
- estructura contable definitiva;
- frecuencia exacta de pago de administradores;
- reglas exactas de comisiones;
- reglas detalladas de descuentos;
- estructura de navegación del `/admin`;
- tecnología definitiva para WhatsApp/IA;
- variables iniciales del CEP;
- modelo estadístico de pronóstico.

---

# 33. NO IMPLEMENTAR TODAVÍA

Hasta aprobar las fases correspondientes, no implementar prematuramente:

- IA autónoma con acceso a operaciones críticas;
- cambios automáticos de precios;
- eliminación física de ventas;
- eliminación física de movimientos financieros;
- edición silenciosa de historial;
- caja basada en saldos manuales;
- descuentos arbitrarios sin trazabilidad;
- inventario basado únicamente en un número editable;
- liquidaciones rígidas codificadas;
- pronósticos sin suficiente historial;
- CEP sin definir variables y método;
- estados financieros sin definir correctamente ingresos, costos y gastos.

---

# 34. PRÓXIMO PASO

Antes de modificar código o base de datos:

1. Revisar este documento.
2. Confirmar decisiones pendientes.
3. Auditar el esquema actual de Supabase.
4. Mapear tablas existentes contra este modelo.
5. Detectar qué funcionalidades ya existen.
6. Detectar qué debe reutilizarse.
7. Detectar qué requiere migración.
8. Crear el modelo técnico por fases.
9. Solo después comenzar implementación.

**No ejecutar migraciones ni cambios estructurales solamente por leer este documento.**

---

# 35. REGLA FINAL

Titan Grill no debe convertirse simplemente en "un POS con muchas funciones".

Debe convertirse en un sistema donde:

```text
                 TITAN GRILL
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
      VENTAS      INVENTARIO     CLIENTES
        │            │            │
        ↓            ↓            ↓
       CAJA       COSTOS       FIDELIZACIÓN
        │            │            │
        └────────────┼────────────┘
                     ↓
                 RENTABILIDAD
                     ↓
                  DECISIONES
```

La finalidad última es que el sistema permita al equipo saber:

> **qué vendimos, qué tenemos, qué compramos, cuánto nos costó, dónde está el dinero, cuánto debemos, cuánto ganamos, qué productos funcionan y qué decisiones deberíamos tomar.**

La tecnología debe servir a esa finalidad y no al revés.
