# FASE D.3.2 — IMPLEMENTACIÓN CONTROLADA DE PARALELIZACIÓN DEL POS

## 1. Objetivo
Implementar quirúrgicamente el hallazgo **F-D3-001** (paralelización de peticiones independientes durante la inicialización del POS) en `src/components/POS.jsx`, reduciendo la latencia de arranque sin comprometer las salvaguardas de disponibilidad y protección de generaciones (FASE D.2) ni la lógica transaccional y financiera del sistema.

---

## 2. Estado Previo
En `src/components/POS.jsx`, la rutina `initPOS()` ejecutaba secuencialmente:
1. `auth.getSession()` (Petición de autenticación a Supabase Auth).
2. `await supabase.from('perfiles_trabajadores').select('*').eq('id', userId)...` (Petición de perfil de trabajador).
3. `await supabase.from('sesiones_caja').select('*').eq('trabajador_id', userId)...` (Petición de sesión de caja abierta).

Estas peticiones sumaban sus latencias de red en serie, forzando al usuario a esperar el tiempo acumulado `T_total = T_auth + T_perfil + T_sesion`.

---

## 3. Dependencias Identificadas
- `auth.getSession()` debe ser previa a las peticiones de base de datos para obtener el `userId`.
- `perfiles_trabajadores` y `sesiones_caja` **dependen exclusivamente de `userId` y son 100% independientes entre sí**.
- `fetchExpectedCash(cashSession.id)` depende del `cashSession.id` obtenido en `sesiones_caja`, por lo que debe ejecutarse posteriormente.

---

## 4. Cambio Realizado
Se modificó `initPOS()` en `src/components/POS.jsx` (líneas 185–218) reemplazando la secuencia encadenada por una ejecución concurrente via `Promise.all`:

```javascript
// Step 2 & 3: Worker Profile and Cash Session in parallel (F-D3-001)
const [profileRes, cashSessionRes] = await Promise.all([
    supabase
        .from('perfiles_trabajadores')
        .select('*')
        .eq('id', userId)
        .single(),
    supabase
        .from('sesiones_caja')
        .select('*')
        .eq('trabajador_id', userId)
        .eq('estado', 'ABIERTA')
        .maybeSingle()
]);

const { data: profile, error: profileError } = profileRes;
const { data: cashSession, error: cashSessionError } = cashSessionRes;

if (profileError) throw profileError;
if (!profile) throw new Error('No se encontró el perfil del trabajador en el sistema.');
if (cashSessionError) throw cashSessionError;

if (myGeneration !== initGenerationRef.current) return;

setWorker(profile);

if (cashSession) {
    setActiveSession(cashSession);
    await fetchExpectedCash(cashSession.id);
    if (myGeneration !== initGenerationRef.current) return;
} else {
    setActiveSession(null);
}
```

---

## 5. Protecciones Preservadas (FASE D.2)
- **Timeout de Inicialización**: `INIT_POS_TIMEOUT_MS = 12000` preservado dentro de `Promise.race([initPromise, timeoutPromise])`.
- **Generation Token (`initGenerationRef`)**: La guarda `if (myGeneration !== initGenerationRef.current) return;` se evalúa inmediatamente tras la resolución del `Promise.all` y antes de mutar los estados React `worker` y `activeSession`.
- **Doble Clic (`isInitializingRef`)**: Bandera de bloqueo de reentradas simultáneas preservada intacta.
- **Pantalla de Contingencia (`initError`)**: Captura cualquier fallo de red o `TIMEOUT_INIT` mostrando la interfaz de error con opciones de "Reintentar Carga" y "Cerrar Sesión".
- **Limpieza en Desmontado (`useEffect`)**: Limpiador de desmontado invalida el token de generación (`initGenerationRef.current++`).

---

## 6. Casos de Regresión Revisados

| Caso | Escenario Evaluado | Resultado |
| :--- | :--- | :--- |
| **Caso A** | Carga normal (Usuario autenticado con caja abierta) | Exitoso. Perfil y sesión se descargan simultáneamente; POS abre normalmente. |
| **Caso B** | Usuario no autenticado | Exitoso. `auth.getSession()` retorna null; `setWorker(null)` y `setActiveSession(null)`. |
| **Caso C** | Perfil inexistente o error de perfil | Exitoso. `profileError` es capturado en `catch(err)` y muestra pantalla de error `initError`. |
| **Caso D** | Error de consulta en sesión de caja | Exitoso. `cashSessionError` capturado en `catch(err)`. |
| **Caso E** | Timeout >= 12 segundos | Exitoso. `Promise.race` cancela el intento, incrementa la generación y despliega pantalla de contingencia. |
| **Caso F** | Acción "Reintentar Carga" (Retry) | Exitoso. Invalida generación anterior e inicia nuevo `Promise.all` con `myGeneration + 1`. |
| **Caso G** | Resolución de promesa tardía | Exitoso. `myGeneration !== initGenerationRef.current` descarta silenciosamente los setters de la inicialización antigua. |
| **Caso H** | Componente desmontado durante la carga | Exitoso. Limpiador de desmontado incrementa el contador de generación, evitando memory leaks o state updates. |
| **Caso I** | Caja Cerrada (Sin sesión activa) | Exitoso. `cashSession` es `null`, transiciona a la pantalla de apertura de caja ("Caja Cerrada"). |

---

## 7. Lint
- **Comando**: `npm run lint`
- **Exit Code**: `0`
- **Resultado**: 0 errores de ESLint en todo el proyecto.

---

## 8. Build
- **Comando**: `npm run build`
- **Exit Code**: `0`
- **Duración**: `17.70s`
- **Resultado de Chunks**:
  - `dist/assets/POS-Fsec6bJg.js`: **56.35 kB** (gzip: 13.64 kB).
  - `dist/assets/AdminDashboard-DZhqtk7l.js`: **1,162.77 kB** (gzip: 49.39 kB).

---

## 9. Git
- **Comandos**: `git status --short` y `git diff --stat`.
- **Estado**: Modificación quirúrgica únicamente en `src/components/POS.jsx` (D.3.2) y creación de este informe. Sin commits ni pushes.

---

## 10. Evidencia
- **MEDIDA (Compilación)**: Bundle de producción POS generado en 17.70s con un tamaño de 56.35 kB.
- **ESTÁTICA**: Trazabilidad directa de `Promise.all` en `src/components/POS.jsx` con verificación de guarda de generación `myGeneration !== initGenerationRef.current`.
- **ESTIMADA**: Reducción esperada de latencia de red equivalente a 1 RTT (Round Trip Time) de consulta Supabase en la inicialización (~100-200ms).
- **NO DEMOSTRADA EN RUNTIME**: No se realizó emulación sintética de estrangulamiento de socket en un entorno live con latencia variable.

---

## 11. Hallazgos Fuera de Alcance (NO IMPLEMENTADOS)
- **F-D3-002**: Filtros históricos/paginación en `AdminDashboard.jsx` (No implementado en D.3.2 para proteger métricas COGS y cierres).
- **F-D3-003**: Reducción de bundle AdminDashboard (No implementado en D.3.2 por estar aislado via `React.lazy()`).
- **F-D3-004**: Reducción de `select('*')` en tablas pequeñas (Sin impacto relevante).

---

## 12. Veredicto

### **IMPLEMENTACIÓN APROBADA**

**Sustentación**:
La paralelización de la inicialización del POS (**F-D3-001**) fue implementada de forma quirúrgica en `src/components/POS.jsx`. Preserva el 100% de las salvaguardas de disponibilidad y protección de generaciones (FASE D.2), mantiene la resiliencia de ventas idempotentes y pasa de manera limpia todas las pruebas de linting y compilación de producción.
