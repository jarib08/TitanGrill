# FASE D.2.1.1 — AUDITORÍA FORENSE POST-IMPLEMENTACIÓN DE DISPONIBILIDAD INICIAL DEL POS

**Proyecto:** Titan Grill POS  
**Fecha:** 24 de Septiembre, 2026  
**Fase:** D.2.1.1 — Validación Forense de Resiliencia y Carga Inicial POS (FC3-NEW-001)  
**Dictamen Final:** **APROBADA CON OBSERVACIONES**

---

## 1. Objetivo

Realizar una auditoría forense **100% READ-ONLY** sobre la implementación realizada en la Fase D.2.1 en `src/components/POS.jsx`, evaluando rigurosamente el comportamiento de `Promise.race`, la protección contra cuelgues de red, la carrera de promesas tardías, la concurrencia de reintentos y la preservación de la resiliencia de ventas.

---

## 2. Alcance

* **Archivo inspeccionado:** [`src/components/POS.jsx`](file:///e:/Documents/titan_grill/src/components/POS.jsx)
* **Base de Datos / Supabase:** 0 modificaciones (100% intacta).
* **RPCs / Tablas:** 0 modificaciones.
* **Resiliencia de Ventas:** 0 modificaciones (preservada al 100%).

---

## 3. Cambios Encontrados en D.2.1

Se confirmó la incorporación de:
1. `INIT_POS_TIMEOUT_MS = 12000` (12 segundos).
2. `isInitializingRef = useRef(false)` para guardia de concurrencia.
3. `const [initError, setInitError] = useState(null);`.
4. Rutina `initPOS()` con `Promise.race([initPromise, timeoutPromise])` y envoltorio `try/catch/finally`.
5. Pantalla de Contingencia con mensaje claro, botón **"Reintentar Carga"** y botón **"Cerrar Sesión"**.

---

## 4. Respuestas Prioritarias (Criterio Especial del Auditor)

### Pregunta Prioritaria 1:
> **¿El timeout realmente protege al sistema o solamente deja de esperar mientras las operaciones originales continúan ejecutándose?**

* **Respuesta Auditora:** **El timeout protege a la INTERFAZ DE USUARIO (UI) liberándola del bloqueo indefinido en "Cargando caja...", pero NO cancela las solicitudes HTTP subyacentes a Supabase.**
* **Análisis Técnico:** En el motor de JavaScript, las Promesas nativas y las peticiones HTTP de Supabase no se cancelan automáticamente cuando `Promise.race` rechaza. Cuando transcurren los 12 segundos, `Promise.race` rechaza, el bloque `catch` toma el control, se ejecuta el `finally` deshaciendo el indicador de carga (`sessionLoading = false`) y liberando la guardia (`isInitializingRef = false`), y se despliega la pantalla de contingencia. Las peticiones originales a Supabase continúan su ciclo de vida en el fondo hasta que la red se restablece o expira el socket TCP del navegador.

---

### Pregunta Prioritaria 2:
> **¿Un resultado tardío de una inicialización anterior puede modificar el estado después de que el usuario haya iniciado un nuevo intento?**

* **Respuesta Auditora:** **SÍ, existe una ventana teórica de condición de carrera si el intento #1 responde mientras un intento #2 está en curso.**
* **Análisis Técnico:** Debido a que `initPromise` en el intento #1 no valida una variable de generación/secuencia (e.g. `requestId` o `initGenerationRef`) antes de llamar a `setWorker(profile)` o `setActiveSession(cashSession)`, si la red del intento #1 despierta y resuelve *después* de que el usuario presiona "Reintentar Carga" (intento #2), las llamadas a `setWorker` y `setActiveSession` del intento #1 se ejecutarán en segundo plano. Si el intento #2 posteriormente falla o expira, los datos cargados tardíamente por el intento #1 podrían permanecer en memoria mientras el estado `initError` muestra contingencia, o viceversa.

---

## 5. Validación del `Promise.race`

* **Comportamiento:** `Promise.race` evalúa `initPromise` vs `timeoutPromise`. El primer evento en asentarse (éxito, error o timeout a los 12s) determina la resolución del `await`.
* **Garantía de Salida:** El bloque `finally` asegura de forma determinista que `setSessionLoading(false)` y `isInitializingRef.current = false` se ejecuten **SIEMPRE**, eliminando la posibilidad de que el usuario quede en "Cargando caja..." indefinidamente.

---

## 6. Validación de Promesas Pendientes y Resultados Tardíos

* **Escenario:** Intento #1 sufre latencia alta (>12s) -> Falla por timeout -> Usuario pulsa "Reintentar Carga" (Intento #2) -> Intento #1 responde a los 15s.
* **Efecto:** El intento #1 ejecutará `setWorker` y `setActiveSession`. Si bien esto no destruye datos en la base de datos (ya que es una operación READ-ONLY), puede provocar actualizaciones de estado desfasadas.
* **Clasificación:** **Hallazgo Forense de Severidad MEDIA** (`FD2.1.1-001`).

---

## 7. Validación de `isInitializingRef`

* **En Inicio:** Se asigna a `true` en la línea 160 de `POS.jsx` impidiendo invocaciones concurrentes mientras la promesa está activa.
* **En Timeout / Error:** El bloque `finally` (línea 229) restablece `isInitializingRef.current = false`.
* **En Reintento:** Permite al usuario presionar "Reintentar Carga" y lanzar una nueva ejecución limpia.

---

## 8. Validación del `useEffect` y Desmontaje

* **Render Inicial:** Invoca `initPOS()` de manera limpia al montar el componente.
* **Strict Mode / Doble Montaje:** `isInitializingRef` bloquea la segunda ejecución sincrónica rápida en desarrollo.
* **Desmontaje (Unmount):** Si el operador abandona la vista del POS durante la inicialización, la promesa en curso continuará hasta terminar. En React 18/19, las llamadas a `setState` en componentes desmontados son ignoradas o emiten advertencias sin colapsar la aplicación.

---

## 9. Diferenciación de Estados: Caja Cerrada vs. Error de Red

Se verificó la separación absoluta entre ambos estados en el render:
1. **Caja Cerrada Normal:** `sessionLoading === false` y `initError === null` y `activeSession === null`. Despliega el panel para abrir turno con el fondo de caja.
2. **Error / Timeout de Conexión:** `sessionLoading === false` y `initError !== null`. Despliega la **Pantalla de Contingencia** con los botones "Reintentar Carga" y "Cerrar Sesión".

---

## 10. Preservación de la Resiliencia de Ventas

Se confirmó por inspección estática del diff que:
* `PENDING_SALE_KEY` no fue modificado.
* `SALE_TIMEOUT_MS` (20,000 ms) no fue modificado.
* Generación de `crypto.randomUUID()` no fue modificada.
* Procedimiento RPC `registrar_venta` y recuperación idempotente permanecen 100% intactos.

---

## 11. Evidencia Runtime vs. Inspección Estática

* **Compilación y Linteado (EJECUTADO EN ENTORNO):**
  - `npm run lint`: **Exit Code 0** (0 errores).
  - `npm run build`: **Exit Code 0** (Construcción exitosa en 18.33s).
* **Pruebas de Latencia Extrema / Cuelgue de Socket (INSPECCIÓN ESTÁTICA / DEDUCCIÓN):**
  - El comportamiento ante latencia de red de 12s se derivó del análisis estático de la especificación ES6 de `Promise.race` y del árbol de render de React.

---

## 12. Hallazgos Nuevos

### `FD2.1.1-001` — SEVERIDAD MEDIA: Ausencia de ID de Generación para Cancelación de Asignaciones Tardías
* **Descripción:** Si el intento #1 de `initPOS()` excede los 12s y el usuario presiona "Reintentar Carga", el intento #1 aún puede resolver en segundo plano e invocar `setWorker` o `setActiveSession`.
* **Impacto:** Posible parpadeo o sobrescritura de estado entre dos reintentos consecutivos muy cercanos.
* **Condición para reproducirlo:** Red móvil con latencia oscilante entre 12 y 18 segundos donde el operador presione "Reintentar Carga" inmediatamente a los 12 segundos.
* **Recomendación Futura (Para Fases Posteriores):** Utilizar un contador de generación `initRequestIdRef.current++` y verificar `if (currentId !== initRequestIdRef.current) return;` antes de ejecutar cada `setState`. *(NO IMPLEMENTADO EN ESTA FASE SEGÚN LAS REGLAS)*.

---

## 13. Dictamen Final

### **APROBADA CON OBSERVACIONES**

**Justificación:**
1. La implementación de D.2.1 resuelve de forma efectiva y verificada el riesgo crítico **FC3-NEW-001**: el POS **ya no puede quedar colgado indefinidamente en "Cargando caja..."**.
2. El timeout de 12s garantiza la liberación del indicador de carga y ofrece la pantalla de contingencia con "Reintentar Carga" y "Cerrar Sesión".
3. `npm run lint` y `npm run build` pasaron sin ningún error.
4. Se registra la observación minoritaria `FD2.1.1-001` sobre la falta de token de generación para respuestas tardías en redes con oscilaciones extremas.

---

**DETENIDO SEGÚN LA REGLA FINAL:** No se realizan modificaciones de código ni se avanza a D.2.2 o D.3 hasta recibir autorización explícita.
