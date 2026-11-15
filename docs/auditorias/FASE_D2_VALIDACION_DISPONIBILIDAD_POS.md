# FASE D.2: AUDITORÍA DE DISPONIBILIDAD Y CARGA INICIAL DEL POS

> **Informe Oficial de Auditoría y Validación de Disponibilidad (100% Read-Only)**  
> **Fecha de ejecución:** 24 de Septiembre de 2026  
> **Estado:** COMPLETADO CON ÉXITO — AUDITORÍA CERRADA  
> **Clasificación del Hallazgo FC3-NEW-001:** `PERSISTE`  

---

## 1. OBJETIVO DE LA FASE D.2

Realizar una auditoría **100% solo lectura** sobre la cadena de montado e inicialización del componente `src/components/POS.jsx`, con el objetivo exclusivo de evaluar el riesgo identificado en las fases de auditoría anteriores:

> **FC3-NEW-001 — CRÍTICO**: La carga inicial del POS no posee un timeout explícito ni un control adecuado de excepciones alrededor de la cadena de inicialización (`auth.getSession` -> `perfiles_trabajadores` -> `sesiones_caja` -> `fetchExpectedCash`). Si la red se ralentiza o falla, la aplicación permanece colgada indefinidamente en la pantalla de **"Cargando caja..."**.

---

## 2. FLUJO ACTUAL DE INICIALIZACIÓN DE `POS.jsx`

La secuencia de carga al montar el componente (`useEffect`, líneas 155-173) opera de la siguiente manera:

```text
1. Montaje del componente POS.jsx (sessionLoading = true por defecto)
       ↓
2. getWorkerProfile() invocado dentro del useEffect
       ↓
3. await supabase.auth.getSession()
       ↓
4. await supabase.from('perfiles_trabajadores').select('*').eq('id', session.user.id).single()
       ↓
5. await fetchSession(profile.id)
       ↓
6. await supabase.from('sesiones_caja').select('*').eq('trabajador_id', userId).eq('estado', 'ABIERTA').maybeSingle()
       ↓
7. await fetchExpectedCash(data.id) (Consulta sesiones_caja y movimientos_caja)
       ↓
8. BLOQUE FINALLY en fetchSession(): setSessionLoading(false)
       ↓
9. Renderizado de interfaz principal del POS o pantalla de "Caja Cerrada"
```

---

## 3. ANÁLISIS DETALLADO DE DEPENDENCIAS Y VULNERABILIDADES

Se evaluó el comportamiento del código ante fallas o latencia extrema en cada paso de la cadena:

### Caso A: auth.getSession() colgado / latencia de red
- **Código**: Línea 157 de `POS.jsx`.
- **Análisis**: Si la conexión móvil o la API de Supabase Auth no responde o se cuelga:
  - No existe un bloque `try/catch` envolviendo la llamada en `getWorkerProfile()`.
  - No existe un `timeout` ni `Promise.race` para forzar el desbloqueo.
  - La ejecución se detiene indefinidamente en la línea 157.
  - La función `fetchSession()` **jamás se invoca**.
  - La instrucción `setSessionLoading(false)` **nunca se ejecuta**.
- **Resultado en UI**: El cajero permanece **bloqueado de forma permanente** en la pantalla *"Cargando caja..."*. Sin botón de reintento, sin mensaje de error y sin opción de cerrar sesión.

### Caso B: Consulta a perfiles_trabajadores colgado / falla de red
- **Código**: Líneas 159-163 de `POS.jsx`.
- **Análisis**: Si `auth.getSession()` resuelve pero la consulta a la tabla `perfiles_trabajadores` sufre pérdida de paquetes o timeout:
  - La ejecución se congela en la línea 159.
  - Si la promesa falla o arroja error, al no existir un `try/catch` que capture excepciones en `getWorkerProfile()`, la función finaliza de forma abrupta antes de llamar a `fetchSession()`.
  - La instrucción `setSessionLoading(false)` nunca es llamada.
- **Resultado en UI**: Bloqueo permanente en *"Cargando caja..."*.

### Caso C: Consulta a sesiones_caja en fetchSession() colgado
- **Código**: Líneas 100-105 de `POS.jsx`.
- **Análisis**: La función `fetchSession()` incluye un bloque `try/catch/finally` propio donde el `finally` ejecuta `setSessionLoading(false)`.
  - Si la llamada a Supabase falla y rechaza la promesa, entra a `catch` y luego a `finally`, liberando el estado de carga.
  - Sin embargo, si la red celular se suspende sin rechazar la promesa inmediatamente (espera prolongada de socket TCP), la ejecución no entra a `finally` hasta que el navegador aborte el socket (que puede tardar minutos o nunca).
- **Resultado en UI**: Espera prolongada o indeterminada en *"Cargando caja..."*.

### Caso D: Consulta a fetchExpectedCash() colgado
- **Código**: Línea 110 de `POS.jsx`.
- **Análisis**: `fetchExpectedCash` ejecuta dos consultas consecutivas (`sesiones_caja` y `movimientos_caja`). Si cualquiera de las dos promesas no se resuelve, la ejecución no regresa a `fetchSession` y no alcanza el bloque `finally`.
- **Resultado en UI**: Bloqueo indeterminado en *"Cargando caja..."*.

---

## 4. CUADRO COMPARATIVO: ERROR VS TIMEOUT VS PÉRDIDA DE RED

| Escenario de Carga Inicial | ¿Posee try/catch? | ¿Posee Timeout? | ¿Ejecuta `setSessionLoading(false)`? | Estado Resultante en Pantalla |
|----------------------------|-------------------|------------------|---------------------------------------|-------------------------------|
| Error HTTP 500 en `getSession()` | ❌ NO | ❌ NO | ❌ NO | Bloqueado en *"Cargando caja..."* |
| Pérdida de red en `perfiles_trabajadores` | ❌ NO | ❌ NO | ❌ NO | Bloqueado en *"Cargando caja..."* |
| Perfil no encontrado (`profile = null`) | ⚠️ Condicional | ❌ NO | ❌ NO | Bloqueado en *"Cargando caja..."* |
| Socket colgado en `fetchSession()` | ⚠️ Solo en try interno | ❌ NO | ❌ NO (hasta timeout de navegador) | Bloqueado en *"Cargando caja..."* |
| Falla en `fetchExpectedCash()` | ⚠️ Solo en try interno | ❌ NO | ❌ NO (si la promesa no resuelve) | Bloqueado en *"Cargando caja..."* |

---

## 5. INTERACCIÓN CON LA RESILIENCIA EXISTENTE DE VENTAS

Se verificó expresamente que el análisis del hallazgo FC3-NEW-001 **no interfiere ni altera** la resiliencia de ventas existente:
- `POS.jsx` implementa un timeout de 20 segundos mediante `Promise.race` **exclusivamente para la RPC `registrar_venta`** (línea 601).
- El proceso de recuperación de ventas pendientes vía `localStorage` (`PENDING_SALE_KEY`) funciona de manera independiente tras el renderizado de la UI.
- La ausencia de timeouts se concentra de forma aislada en el **hook de montado e inicialización**.

---

## 6. CLASIFICACIÓN DEL HALLAZGO FC3-NEW-001

### CLASIFICACIÓN: `PERSISTE`

**Sustentación Técnica**:
El hallazgo **FC3-NEW-001** se mantiene totalmente activo en el código actual de `POS.jsx`. La rutina de montado carece de un bloque `try/catch/finally` envolvente a nivel global, no implementa temporizadores de rescate (`Promise.race` / `setTimeout`) y no provee una interfaz de contingencia o botón de reintento para el cajero ante fallos de conexión iniciales.

---

## 7. RIESGOS ASOCIADOS CONFIRMADOS

1. **Riesgo de Disponibilidad Operativa**: En restaurantes con cobertura móvil inestable, la terminal POS puede quedar inutilizable al iniciar turno, impidiendo registrar ventas incluso cuando el dinero en efectivo esté listo.
2. **Falta de Trazabilidad para el Usuario**: El cajero no recibe ningún mensaje explicativo sobre si el problema es de contraseña, perfil de trabajador o falla de internet.

---

## 8. RECOMENDACIONES TÉCNICAS PARA LA FASE POSTERIOR (FASE D.2.1 / D.3)

Se recomienda abordar la corrección de este hallazgo en la siguiente fase de desarrollo mediante:
1. **Encapsulamiento Global de Inicialización**: Envolver toda la rutina de `useEffect` en una única función `initPOS()` con bloque `try/catch/finally` garantizando que `sessionLoading` pase a `false` bajo cualquier circunstancia de error.
2. **Timeout de Rescate**: Aplicar un `Promise.race` de 10 segundos para la inicialización completa. Si la carga excede los 10s, capturar la excepción y transicionar a un estado de error inicial.
3. **Pantalla de Contingencia**: Mostrar un mensaje explícito en pantalla: *"No se pudo conectar con la caja (Timeout)"* acompañado de un botón visible de **"Reintentar Carga"** y opción para **"Cerrar Sesión"**.

---

## 9. CONFIRMACIÓN FINAL DE AUDITORÍA SOLO LECTURA

- **Archivos modificados durante D.2**: 0.
- **SQL / Mutaciones en Supabase durante D.2**: 0.
- **Commits o pushes creados**: 0.
- **Estado de Git**: Repositorio 100% limpio y preservado de forma no destructiva.

---
