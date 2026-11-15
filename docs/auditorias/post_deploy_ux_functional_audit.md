# TITAN GRILL — AUDITORÍA FUNCIONAL POST-DEPLOY + UX MENU

## 1. Estado del deployment actual
⚠️ **El despliegue automático falló.**
El deployment manual en EasyPanel no pudo realizarse (error `Repository not found`). Por lo tanto, el entorno de producción actual sigue ejecutando la versión antigua de hace 2 meses. Esta auditoría se basa en el código fuente actual en la rama `main` que *debería* estar desplegado, simulando el comportamiento esperado una vez se resuelva el problema de infraestructura.

## 2. Bug "Explorar carta"
El botón "Explorar Carta" en la página principal (`/`) se muestra correctamente y tiene un evento `onClick` asignado, pero al hacer clic no ocurre absolutamente nada.

## 3. Causa técnica
En el componente `Hero.jsx`, la función `scrollToMenu` intenta buscar un elemento en el DOM usando `document.getElementById('digital-menu')`. Sin embargo, el componente `MenuGrid.jsx` (que renderiza la carta en la página principal) tiene el atributo `id="menu"`. Al no encontrar el ID `digital-menu`, la variable es `null` y el método `scrollIntoView` nunca se ejecuta.

## 4. Ubicación del código
- Archivo: `src/components/Hero.jsx`
- Líneas: 7-12
```javascript
const scrollToMenu = () => {
    const menuSection = document.getElementById('digital-menu'); // <-- AQUÍ ESTÁ EL ERROR
    if (menuSection) {
        menuSection.scrollIntoView({ behavior: 'smooth' });
    }
};
```
*Solución recomendada:* Cambiar `getElementById('digital-menu')` por `getElementById('menu')`.

## 5. Carrito actual
El carrito (modal "Tu Pedido") se implementa dentro de `src/components/DigitalMenu.jsx`.
- **Estado:** Utiliza `useState` para `cart`, `showCartModal`, `deliveryType`, `customerName`, `customerPhone`, `deliveryAddress`, y `orderNotes`.
- **Validaciones:** Se exige Nombre, Teléfono, y Dirección. Si el `deliveryType` es "En Mesa", el mensaje de error de la dirección cambia dinámicamente a "Por favor especifica el número de mesa."
- **Cálculo del total:** Se suma multiplicando `item.precio * item.quantity`.
- **Botón:** Un botón verde "ENVIAR POR WHATSAPP" que genera la URL con `encodeURIComponent` y abre una nueva pestaña.

## 6. Flujo actual de entrega
Actualmente el usuario selecciona mediante 3 "botones" que actúan como radio buttons:
- Domicilio
- Para Llevar
- En Mesa

La UI muestra los mismos 4 campos de texto (Nombre, Teléfono, Dirección, Notas) para todas las opciones, lo cual resulta confuso cuando se selecciona "Para Llevar", ya que igual solicita una "Dirección de Entrega".

## 7. Nueva estructura propuesta
La estructura propuesta refleja mejor la operativa real:
- **A. DOMICILIO — FUERA DE LA U**
- **B. YO PASO POR EL** (Con sub-modalidades: Para llevar / Comer en el stand)
- **C. DENTRO DE LA U** (Para entregas internas en la universidad)

## 8. Impacto técnico
La implementación de esta nueva estructura es de complejidad **media**:
1. Hay que modificar los botones de `deliveryType` en `DigitalMenu.jsx` para usar las nuevas opciones.
2. Hay que crear un nuevo estado (ej. `pickupMode`) para manejar la selección secundaria de "YO PASO POR EL" (Llevar vs Stand).
3. Hay que implementar **Renderizado Condicional** en el formulario:
   - Ocultar el input de "Dirección" cuando la opción es "YO PASO POR EL".
   - Cambiar el label del input de "Dirección" a "Ubicación (Bloque, Curso, etc.)" cuando la opción es "DENTRO DE LA U".
4. Modificar la lógica de validación (líneas 120-131 de `DigitalMenu.jsx`) para que no exija "Dirección" si el usuario va a pasar por el pedido.
5. Actualizar la concatenación del mensaje de WhatsApp para inyectar estos nuevos campos de forma clara.

## 9. Campos condicionales recomendados
La estructura evaluada es perfectamente coherente y se recomienda la siguiente lógica de renderizado:

*   **DOMICILIO — FUERA DE LA U**
    *   Nombre (Requerido)
    *   Teléfono (Requerido)
    *   Dirección de entrega (Requerido)
    *   Notas Especiales (Opcional)
*   **YO PASO POR EL**
    *   Nombre (Requerido)
    *   Teléfono (Requerido)
    *   Modalidad: Botones tipo Radio [Para llevar] / [Comer en el stand] (Requerido)
    *   Notas Especiales (Opcional)
*   **DENTRO DE LA U**
    *   Nombre (Requerido)
    *   Teléfono (Requerido)
    *   Ubicación en la U (Bloque/Curso) (Requerido)
    *   Notas Especiales (Opcional)

## 10. WhatsApp actual
El número configurado en `DigitalMenu.jsx` (línea 33) es correcto: **`573004126441`**.
La estructura del mensaje es:
```text
🔥 *NUEVO PEDIDO - TITAN GRILL* 🔥
----------------------------------
👤 *Cliente:* [Nombre]
📞 *Teléfono:* [Teléfono]
📍 *Modalidad:* [Domicilio/Para Llevar/En Mesa]
📌 *Ubicación/Mesa:* [Dirección]
📝 *Notas:* [Notas]
----------------------------------
🛒 *DETALLE DEL PEDIDO:*
1. *Burger Classic* x1 -> $14.000
----------------------------------
💰 *TOTAL A PAGAR:* $14.000
----------------------------------
¡Gracias por elegir Titan Grill! Por favor confirma la recepción de mi pedido.
```
*Observación:* Esta plantilla es robusta y fácilmente adaptable a los nuevos campos condicionales de la Fase 9.

## 11. Horarios actuales
Actualmente, los horarios se muestran en `src/components/LocationSection.jsx` en la parte inferior de la Landing Page, al lado del mapa de ubicación. 
Muestra:
- Lunes: 4:00 PM - 9:30 PM
- Miércoles - Viernes: 4:00 PM - 9:30 PM
- Happy Hour: Miércoles 6 PM - 9 PM.

## 12. Recomendación para horarios
Aunque el componente `LocationSection` es el lugar semánticamente correcto, **no es suficiente**. 
Para un negocio de comida rápida, el horario de disponibilidad es información crítica que debe saberse antes de intentar hacer un pedido. 
**Recomendación:** Agregar un pequeño "Badge" (etiqueta) en el header del menú digital (`DigitalMenu.jsx`) y en la sección Hero (`Hero.jsx`) que diga algo como: `🕒 Abierto hoy: 4:00 PM - 9:30 PM`. Esto reduce la fricción del usuario.

## 13. Implementación actual del mapa
El mapa en `LocationSection.jsx` utiliza un `<iframe src="https://www.google.com/maps?q=...">` básico de Google Maps. Está contenido dentro de un `div` con bordes redondeados (`rounded-xl`), overflow oculto, y sombra (`shadow-2xl`).

## 14. Recomendaciones de integración visual del mapa
Visualmente, el iframe por defecto de Google Maps desentona fuertemente con la estética oscura ("Dark Mode"), elegante y "premium" (colores zinc, negro y fuego/naranja) del resto de la página. 

**Recomendaciones para mantener el diseño UI:**
1. **Filtro CSS (Rápido):** Aplicar estilos CSS sobre el `iframe` para forzar un "Modo Oscuro" básico: `style={{ filter: 'invert(90%) hue-rotate(180deg) contrast(100%)' }}`.
2. **Capa superpuesta (Overlay):** Colocar un `div` absoluto sobre el mapa con un `bg-zinc-950/20` para apagar un poco sus colores brillantes y mezclarlo con el fondo.
3. **Contenedor estilizado:** Añadir un pequeño pin de ubicación flotante o un botón overlay "📍 Abrir en Google Maps" usando los colores corporativos (Fuego).

## 15. Riesgos de regresión
Los futuros cambios identificados conllevan los siguientes riesgos que deben ser probados rigurosamente:
- **Validación del carrito:** Al hacer condicional el campo "Dirección", es muy fácil introducir un bug donde el formulario no se pueda enviar porque sigue exigiendo un campo que está oculto.
- **Formateo de WhatsApp:** Si el campo `pickupMode` no se interpola correctamente, el mensaje enviado al comercio podría llegar incompleto o con "undefined".
- **Hero Scroll:** Corregir el ID del ancla es seguro, pero se debe verificar que en pantallas móviles el scroll no quede tapado por el Sticky Header.

## 16. Lista exacta de archivos que habría que modificar posteriormente
Para implementar todas las mejoras propuestas, será estrictamente necesario modificar:
1. `src/components/Hero.jsx` (Corregir ID del ancla `digital-menu` -> `menu` y opcionalmente añadir el horario).
2. `src/components/DigitalMenu.jsx` (Toda la lógica condicional del carrito, la nueva estructura de entrega y el formato del mensaje de WhatsApp).
3. `src/components/LocationSection.jsx` (Solo si se decide aplicar los filtros CSS recomendados al iframe del mapa).
