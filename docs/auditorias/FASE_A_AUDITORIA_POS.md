# FASE A — AUDITORÍA FORENSE POS / ABRIR CAJA
**Titan Grill — Sistema Operativo Gastronómico**  
**Fecha de Ejecución:** 24 de Septiembre de 2026  
**Tipo de Auditoría:** SOLO LECTURA (Forense, Arquitectónica, UI y Base de Datos)  
**Entorno Verificado:** Vite 7.3.1 (React 19) + Supabase PostgreSQL 17 (Live Production Database)  

---

## 1. Alcance
La presente auditoría forense corresponde exclusivamente a la **FASE A: POS / ABRIR CAJA**, siguiendo los lineamientos de [TITAN_GRILL_FUENTE_DE_VERDAD.md](file:///e:/Documents/titan_grill/TITAN_GRILL_FUENTE_DE_VERDAD.md) y [TITAN_GRILL_PLAN_MAESTRO_AUDITORIA.md](file:///e:/Documents/titan_grill/TITAN_GRILL_PLAN_MAESTRO_AUDITORIA.md).

El alcance contempla:
- **Capa UI / Browser:** Carga visual del POS, formulario de "Caja Cerrada", detección reactiva de sesión activa, validaciones de interfaz y navegación.
- **Capa Frontend Code:** Análisis exhaustivo de [POS.jsx](file:///e:/Documents/titan_grill/src/components/POS.jsx), estados React, hooks (`useRef`, `useEffect`, `useState`), almacenamiento local (`localStorage`), control de reintentos y llamadas Supabase RPC.
- **Capa Transaccional / Backend:** Análisis de la función RPC `public.abrir_caja`, `public.fn_get_active_session`, `public.registrar_saldo_inicial` y su contraparte `public.cerrar_caja`.
- **Capa Base de Datos:** Integridad y restricciones de las tablas `sesiones_caja`, `movimientos_caja`, `ventas` y `perfiles_trabajadores`.
- **Seguridad y RLS:** Políticas de Row Level Security, control de roles (`fn_is_worker`, `fn_is_socio`, `fn_is_admin`).
- **Concurrencia e Idempotencia:** Resistencia ante dobles clicks, llamadas asíncronas simultáneas, reintentos de red y generación de claves únicas.
- **Impacto Financiero y Reconciliaciones:** Comprobación empírica con datos en vivo sobre saldo, ingresos, gastos y rentabilidad.

---

## 2. Metodología
Se aplicó un protocolo forense estrictamente **NO DESTRUCTIVO (READ-ONLY)** compuesto por:
1. **Inspección Visual y de DOM (Browser Subagent):** Sesión iniciada con credenciales administrativas (`mdeviajob@gmail.com`) en servidor local Vite (`https://localhost:5173/`). Inspección del árbol DOM, estado inactivo/activo del botón de apertura y reactividad ante refrescos de página. Cualquier acción de clic sobre "Abrir Caja" que pudiera insertar un registro real fue documentada como **NO EJECUTADA — DESTRUCTIVA**.
2. **Análisis Estático de Código Fuente:** Rastreo de variables de estado, referencias de exclusión mutua (`useRef`), persistencia de transacciones indeterminadas y handlers de red en [POS.jsx](file:///e:/Documents/titan_grill/src/components/POS.jsx) y componentes dependientes como [NumericInput.jsx](file:///e:/Documents/titan_grill/src/components/ui/NumericInput.jsx) y [ProtectedRoute.jsx](file:///e:/Documents/titan_grill/src/components/ProtectedRoute.jsx).
3. **Inspección de Esquema y Migraciones SQL:** Revisión del historial de migraciones (`supabase/migrations/20260912_fase_a_correccion.sql`), índices parciales, disparadores y scripts de hardening de seguridad.
4. **Consultas Forenses Read-Only a Base de Datos en Vivo:** Scripts aislados de lectura en Node.js conectándose vía `@supabase/supabase-js` autenticado, evaluando datos reales históricos, conteo de cajas abiertas, consistencia referencial de movimientos y claves de idempotencia.

---

## 3. Arquitectura Encontrada
El subsistema de apertura y control de caja de Titan Grill opera bajo el siguiente patrón arquitectónico:

```
                    ┌────────────────────────┐
                    │      Navegador         │
                    │   React 19 (POS.jsx)   │
                    └───────────┬────────────┘
                                │
                     Llama Supabase RPC:
                     abrir_caja(apertura_efectivo, nequi, bancolombia)
                                │
                                ▼
            ┌────────────────────────────────────────┐
            │         PostgreSQL RPC Function        │
            │         public.abrir_caja()            │
            │          (SECURITY DEFINER)            │
            └───────────┬────────────────┬───────────┘
                        │                │
            1. Valida Rol:               2. Valida Sesión Previa:
            public.fn_is_worker()        public.fn_get_active_session(auth.uid())
                        │                │
                        ▼                ▼
            ┌────────────────────────────────────────┐
            │           Inserción en Tabla           │
            │         public.sesiones_caja           │
            │   (estado = 'ABIERTA', trabajador_id)  │
            └───────────────────┬────────────────────┘
                                │
                    Protegido por Índice Único:
             idx_sesion_unica_abierta ON (trabajador_id)
                       WHERE estado = 'ABIERTA'
                                │
                        Try/Catch Postgres:
                   EXCEPTION WHEN unique_violation
                                │
                                ▼
            ┌────────────────────────────────────────┐
            │ Retorna JSON: { success: true, ... }   │
            │ y activa el POS en el Cliente          │
            └────────────────────────────────────────┘
```

**Principios arquitectónicos detectados:**
- **Sesión por Trabajador (No Caja Única Global):** Cada trabajador autenticado administra su propia sesión de caja. Dos trabajadores pueden tener turnos abiertos concurrentemente.
- **Fondo Inicial Declarativo:** `abrir_caja` no emite dinero al libro diario de caja; registra una declaración de custodia física inicial.
- **Inyección Transaccional Separada:** El fondeo formal de caja matriz (`SALDO_INICIAL`) lo realiza exclusivamente un Socio Administrador mediante el RPC `registrar_saldo_inicial`, impactando `movimientos_caja`.

---

## 4. Flujo Real de Apertura
El ciclo de vida de la apertura transcurre exactamente en la siguiente secuencia de capas:

1. **Montaje del Componente POS:**
   - [POS.jsx](file:///e:/Documents/titan_grill/src/components/POS.jsx#L155-L173) ejecuta `useEffect` -> consulta `supabase.auth.getSession()`.
   - Consulta `perfiles_trabajadores` para obtener nombre, rol y estado.
   - Llama a `fetchSession(profile.id)`, ejecutando:
     ```javascript
     supabase.from('sesiones_caja')
       .select('*')
       .eq('trabajador_id', userId)
       .eq('estado', 'ABIERTA')
       .maybeSingle();
     ```
2. **Evaluación de Estado de Caja:**
   - Si `activeSession === null`: Se renderiza el panel de bloqueo modal **"Caja Cerrada"** ([POS.jsx línea 811](file:///e:/Documents/titan_grill/src/components/POS.jsx#L811)).
   - Los campos de entrada se inicializan en: Efectivo: `$50,000` (predeterminado), Nequi: `$0`, Bancolombia: `$0`.
3. **Disparo de Apertura:**
   - El operador presiona el botón `Abrir Caja`.
   - Se invoca `handleOpenSession()` ([POS.jsx línea 542](file:///e:/Documents/titan_grill/src/components/POS.jsx#L542)).
   - Se activa el estado `loading = true` (bloquea el botón visualmente).
   - Se ejecuta el RPC `abrir_caja` con los valores numéricos correspondientes.
4. **Ejecución en Base de Datos (`abrir_caja`):**
   - Evalúa `fn_is_worker()`. Si no es trabajador activo, aborta con `success: false`.
   - Evalúa `fn_get_active_session(auth.uid())`. Si ya posee una caja abierta, devuelve `success: true` junto con el ID de la sesión existente (idempotencia optimista).
   - Intenta insertar en `public.sesiones_caja`.
   - Si colisiona con el índice único `idx_sesion_unica_abierta`, captura `unique_violation` y retorna `success: true` con la sesión ya existente.
5. **Transición a Pantalla de Ventas:**
   - Al recibir `success: true`, el frontend ejecuta `await fetchSession(worker.id)`.
   - Al poblarse `activeSession`, el componente oculta el formulario de caja cerrada y despliega el catálogo interactivo de ventas, carrito y monitoreo de arqueo.

---

## 5. Código Frontend (`POS.jsx`)
Se identificaron las siguientes características y debilidades estructurales:

### 5.1 Gestión de Estado y Hooks
- **States Principales:** `activeSession`, `sessionLoading`, `openCashAmount`, `openNequiAmount`, `openBancoAmount`, `loading`, `errorMessage`.
- **Protección de Doble Envío (`useRef`):**
  - Se declara `const isSubmittingRef = useRef(false);` en la línea 14.
  - **Hallazgo Crítico:** `isSubmittingRef` es utilizado rigurosamente en `handleRegisterSale` (líneas 741, 790, 798) y en `handleRetryVerification` (línea 728), **pero NO se utiliza en `handleOpenSession`** (líneas 542-563).
  - La función `handleOpenSession` descansa únicamente en `setLoading(true)`:
    ```javascript
    const handleOpenSession = async () => {
        setLoading(true);
        setErrorMessage('');
        try {
            const { data, error } = await supabase.rpc('abrir_caja', {
                p_monto_apertura: Number(openCashAmount),
                p_apertura_nequi: Number(openNequiAmount),
                p_apertura_bancolombia: Number(openBancoAmount)
            });
            ...
    ```
    Dado que las actualizaciones de estado en React 19 son asíncronas y se procesan por microtareas, dos clics ultrarrápidos (o eventos táctiles duplicados) antes del rerender del botón pueden despachar 2 peticiones HTTP concurrentes hacia Supabase.

### 5.2 Manejo de Almacenamiento Local (`localStorage`)
- El POS almacena `titan_grill_pending_sale` para recuperar ventas indeterminadas tras caídas de red o timeouts.
- **Para la apertura de caja no existe persistencia en `localStorage` ni `sessionStorage`:** Si la red se cae durante el despacho de `abrir_caja`, el frontend muestra un error simple; sin embargo, al reconectar y pulsar F5, el POS se autorecupera gracias al `fetchSession` contra la base de datos.

### 5.3 Fallo de inicialización cuando el usuario no tiene sesión
- En [POS.jsx líneas 155-173](file:///e:/Documents/titan_grill/src/components/POS.jsx#L155-L173):
  ```javascript
  useEffect(() => {
      const getWorkerProfile = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
              const { data: profile } = await supabase
                  .from('perfiles_trabajadores')
                  .select('*')
                  .eq('id', session.user.id)
                  .single();
              setWorker(profile);
              if (profile) {
                  await fetchSession(profile.id);
              }
          }
      };
      getWorkerProfile();
      fetchProducts();
  }, []);
  ```
  Si `session?.user` es nulo o el perfil falla, `setSessionLoading(false)` nunca es invocado (está dentro del finally de `fetchSession`), lo que deja el POS en una pantalla con texto parpadeante "Cargando caja..." indefinidamente. Aunque [ProtectedRoute.jsx](file:///e:/Documents/titan_grill/src/components/ProtectedRoute.jsx) mitiga este escenario en rutas normales, constituye una falla de robustez ante desincronizaciones de tokens.

---

## 6. RPC (`abrir_caja`, `fn_get_active_session`, `registrar_saldo_inicial`)

### 6.1 `abrir_caja`
Definida en PostgreSQL como `SECURITY DEFINER`:
```sql
CREATE OR REPLACE FUNCTION public.abrir_caja(
    p_monto_apertura numeric, 
    p_apertura_nequi numeric DEFAULT 0, 
    p_apertura_bancolombia numeric DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_active_sesion_id uuid;
  v_new_sesion_id uuid;
  v_is_worker boolean;
BEGIN
  SELECT public.fn_is_worker() INTO v_is_worker;
  IF NOT v_is_worker THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere ser trabajador activo');
  END IF;

  SELECT public.fn_get_active_session(auth.uid()) INTO v_active_sesion_id;
  IF v_active_sesion_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'message', 'Ya tienes una sesion de caja abierta', 'sesion_id', v_active_sesion_id);
  END IF;

  BEGIN
    INSERT INTO public.sesiones_caja (trabajador_id, monto_apertura, apertura_nequi, apertura_bancolombia, estado)
    VALUES (auth.uid(), p_monto_apertura, COALESCE(p_apertura_nequi, 0), COALESCE(p_apertura_bancolombia, 0), 'ABIERTA')
    RETURNING id INTO v_new_sesion_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_new_sesion_id FROM public.sesiones_caja WHERE trabajador_id = auth.uid() AND estado = 'ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1;
    RETURN json_build_object('success', true, 'message', 'La caja ya estaba abierta (Concurrencia)', 'sesion_id', v_new_sesion_id);
  END;

  RETURN json_build_object(
    'success', true,
    'message', 'Caja abierta con exito',
    'sesion_id', v_new_sesion_id
  );
END;
$function$;
```

**Evaluación Forense del RPC:**
- **Autorización:** Valida `fn_is_worker()`. Ningún usuario anónimo ni cliente puede ejecutar apertura.
- **Suplantación Imposible:** Fuerza `trabajador_id = auth.uid()`. Un operador no puede abrir caja a nombre de otro.
- **Determinismo y Resiliencia:** El bloque `EXCEPTION WHEN unique_violation` previene errores HTTP 500 y colapsos de concurrencia, retornando con gracia la sesión ya creada.
- **Vulnerabilidad de Entrada:** **NO valida valores negativos.** Si se le envía `p_monto_apertura = -50000`, la base de datos lo inserta sin arrojar error (falta `CHECK (p_monto_apertura >= 0)`).

### 6.2 `fn_get_active_session`
```sql
CREATE OR REPLACE FUNCTION public.fn_get_active_session(p_trabajador_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sesion_id uuid;
BEGIN
  SELECT id INTO v_sesion_id
  FROM public.sesiones_caja
  WHERE trabajador_id = p_trabajador_id AND estado = 'ABIERTA'
  ORDER BY fecha_apertura DESC
  LIMIT 1;
  
  RETURN v_sesion_id;
END;
$function$;
```
- Posee `ORDER BY fecha_apertura DESC LIMIT 1`, garantizando determinismo estricto.

### 6.3 `registrar_saldo_inicial`
- Protegido por `fn_is_socio()`.
- Exige `p_sesion_id uuid` explícito.
- Aplica bloqueo transaccional `SELECT ... FOR UPDATE` sobre la fila de `sesiones_caja` para impedir condiciones de carrera de inyección de fondos.

---

## 7. Base de Datos
Estructura forense real verificada en el cluster de Supabase:

### Tabla: `public.sesiones_caja`
| Columna | Tipo | Nulable | Propósito |
|---------|------|---------|-----------|
| `id` | uuid | NO | Identificador único primario |
| `trabajador_id` | uuid | NO | FK a `perfiles_trabajadores.id` |
| `fecha_apertura` | timestamptz | NO | Marca de tiempo de apertura |
| `fecha_cierre` | timestamptz | SÍ | Marca de tiempo de cierre |
| `monto_apertura` | numeric | NO | Fondo inicial en efectivo declarado |
| `apertura_nequi` | numeric | SÍ (def 0)| Saldo inicial Nequi declarado |
| `apertura_bancolombia` | numeric | SÍ (def 0)| Saldo inicial Bancolombia declarado |
| `estado` | text | NO | `ABIERTA` o `CERRADA` |
| `monto_cierre_esperado` | numeric | SÍ | Esperado calculado al cierre |
| `monto_cierre_contado` | numeric | SÍ | Dinero real contado por el operador |
| `diferencia` | numeric | SÍ | Descuadre (`contado - esperado`) |
| `esperado_efectivo` | numeric | SÍ | Desglose efectivo esperado |
| `contado_efectivo` | numeric | SÍ | Desglose efectivo contado |
| `diferencia_efectivo` | numeric | SÍ | Descuadre en efectivo |
| `esperado_nequi` | numeric | SÍ | Desglose Nequi esperado |
| `contado_nequi` | numeric | SÍ | Desglose Nequi contado |
| `diferencia_nequi` | numeric | SÍ | Descuadre en Nequi |
| `esperado_bancolombia` | numeric | SÍ | Desglose Bancolombia esperado |
| `contado_bancolombia` | numeric | SÍ | Desglose Bancolombia contado |
| `diferencia_bancolombia` | numeric | SÍ | Descuadre en Bancolombia |
| `observaciones` | text | SÍ | Justificación del arqueo |
| `cerrado_por` | uuid | SÍ | Usuario que ejecutó el cierre |

**Índice de Concurrencia Activo:**
- `idx_sesion_unica_abierta`: `CREATE UNIQUE INDEX idx_sesion_unica_abierta ON public.sesiones_caja (trabajador_id) WHERE estado = 'ABIERTA';` (Activo y verificado).

---

## 8. RLS (Row Level Security) y Permisos

1. **Permiso de Apertura:**
   - Exclusivo para trabajadores activos autenticados (`fn_is_worker() = true`).
2. **Apertura para Terceros:**
   - Imposible. La función ignora cualquier ID externo y fuerza `trabajador_id = auth.uid()`.
3. **Visibilidad de Sesiones:**
   - La política de lectura en `sesiones_caja` permite a administradores y trabajadores consultar sesiones.
   - En auditoría de datos, `mdeviajob@gmail.com` tiene acceso de lectura a las 7 sesiones históricas de los 3 trabajadores del negocio.
4. **Visibilidad de Movimientos:**
   - La política `movimientos_caja_select_all` permite a cualquier trabajador activo leer todos los registros de movimientos de caja.
5. **Modificación Directa de Sesiones y Movimientos:**
   - El acceso de modificación directa (`UPDATE`/`DELETE`) está denegado para clientes y workers sin elevación. Las alteraciones ocurren a través de los RPCs certificados (`cerrar_caja`, `resolver_diferencia_caja`).

---

## 9. Idempotencia

Se evaluó la idempotencia en las 3 capas requeridas:

| Criterio | Frontend (`POS.jsx`) | RPC (`abrir_caja`) | Base de Datos (`PostgreSQL`) |
|----------|----------------------|--------------------|------------------------------|
| **¿Genera UUID idempotency?** | ❌ NO | ❌ NO | ❌ Columna no existe en `sesiones_caja` |
| **¿Duración de la clave?** | N/A | N/A | N/A |
| **¿Persiste en LocalStorage?** | ❌ NO | N/A | N/A |
| **¿Cambia en un reintento?** | N/A | N/A | N/A |
| **¿Mecanismo de protección?** | Estado React (`loading`) | Control `fn_get_active_session` | Índice `UNIQUE` condicional `WHERE estado = 'ABIERTA'` |
| **Resultado de duplicación** | Si pasa el botón, viaja petición doble | Captura excepción y devuelve ID previo | Bloquea a nivel de motor físico |

**Diferenciación Técnica:**
- **Protección visual del botón:** Existe parcialmente mediante `loading`, pero sin debounce ni semáforo en `useRef`.
- **Idempotencia Transaccional:** Aunque no usa un parámetro `p_idempotency_key`, la función posee **idempotencia de estado natural**: invocar `abrir_caja` 1 vez o 10 veces seguidas resulta siempre en exactamente **1 sola sesión ABIERTA en base de datos**, retornando el mismo `sesion_id`.

---

## 10. Concurrencia

Análisis riguroso de los 6 escenarios especificados:

1. **Caso 1: Trabajador A abre caja.**
   - Resultado: Inserción exitosa. Se crea la sesión `id` con estado `ABIERTA`.
2. **Caso 2: Trabajador A intenta abrir nuevamente.**
   - Resultado: `fn_get_active_session` detecta la sesión abierta inmediatamente y devuelve `{ success: true, message: 'Ya tienes una sesion de caja abierta', sesion_id: ... }`. No hay inserción duplicada.
3. **Caso 3: Trabajador A hace doble clic rápido en la UI.**
   - Resultado: Las dos peticiones viajan a PostgreSQL en paralelo. La primera adquiere el cerrojo del índice e inserta. La segunda sufre `unique_violation`. El bloque `EXCEPTION` captura el error y devuelve la misma sesión con `success: true`. **Integridad salvaguardada.**
4. **Caso 4: Dos peticiones llegan simultáneamente (milidécimas).**
   - Resultado: Resuelto a nivel de transacción por el índice único `idx_sesion_unica_abierta`. Una de ellas se serializa primero y la otra entra en la rama de recuperación.
5. **Caso 5: Trabajador A abre caja y Trabajador B intenta abrir otra.**
   - Resultado: **Ambas aperturas se ejecutan con éxito.** La restricción única es por `trabajador_id`. Esto cumple el modelo de negocio multidependiente de Titan Grill, donde cada cajero liquida su propio turno.
6. **Caso 6: La primera petición tarda por lentitud de red y el frontend reintenta.**
   - Resultado: Cuando la segunda petición llega, la primera ya habrá confirmado la sesión; el reintento simplemente recibe la sesión activa ya creada y desbloquea el POS.

---

## 11. Relación con Caja y Cierre

1. **Acoplamiento de Sesión:**
   - La sesión es el ancla unívoca de toda la operación de turno.
   - En [POS.jsx línea 108](file:///e:/Documents/titan_grill/src/components/POS.jsx#L108), `fetchSession` almacena el objeto de sesión activo en memoria.
2. **Asociación de Movimientos:**
   - Cada venta procesada en `POS.jsx` envía obligatoriamente `p_sesion_id: activeSession.id` a `registrar_venta`.
   - `registrar_venta` inserta en `movimientos_caja` registrando ese `sesion_id`.
3. **Cálculo de Efectivo Esperado (`fetchExpectedCash`):**
   - En [POS.jsx líneas 121-153](file:///e:/Documents/titan_grill/src/components/POS.jsx#L121-L153), la UI calcula:
     $$\text{Esperado Efectivo} = \text{monto\_apertura} + \sum \text{Ingresos Efectivo} - \sum \text{Egresos Efectivo}$$
4. **Cierre de Caja (`cerrar_caja`):**
   - El operador declara los valores reales contados en mano (`closeCashCounted`, `closeNequiCounted`, `closeBancoCounted`).
   - El backend contrasta lo contado contra los registros en `movimientos_caja` de esa sesión específica más el fondo inicial.
   - Si la sesión se cierra en servidor mientras el POS local permanece abierto, cualquier intento de registrar una nueva venta será rechazado por `registrar_venta` al comprobar que el estado de la sesión ya no es `ABIERTA`.

---

## 12. Relación con Ventas

- **Precondición Inflexible:** En [POS.jsx líneas 749-752](file:///e:/Documents/titan_grill/src/components/POS.jsx#L749-L752):
  ```javascript
  if (!activeSession) {
      setErrorMessage('Se requiere abrir caja antes de registrar ventas.');
      return;
  }
  ```
  Ningún producto puede venderse sin una sesión de caja activa vinculada.
- **Auditoría de Reconciliación Venta <-> Sesión:**
  - Se verificaron las **99 ventas** registradas en la base de datos live.
  - **99 de 99 ventas (100%)** tienen `sesion_id` válido.
  - **0 ventas** poseen `sesion_id` huérfano.
  - **0 ventas** fueron registradas con posterioridad a la `fecha_cierre` de la sesión asignada.
  - **0 ventas** tienen discrepancia entre el `trabajador_id` de la venta y el `trabajador_id` de la sesión.

---

## 13. Relación con Inventario

- `abrir_caja` no tiene impacto directo sobre el inventario.
- La apertura de caja actúa como **habilitador transaccional indirecto**:
  $$\text{Abrir Caja} \longrightarrow \text{Sesión ABIERTA} \longrightarrow \text{Habilita Ventas} \longrightarrow \text{Dispara Explosión de Recetas en Kardex (MERMA)}$$
- Si la caja está cerrada, no hay mutaciones en `insumos` ni en `movimientos_inventario` provenientes del POS.

---

## 14. Impacto Financiero
Respuestas periciales basadas en evidencia matemática y transaccional:

1. **¿Abrir caja afecta saldo?**
   - **NO.** `abrir_caja` únicamente inserta en la tabla `sesiones_caja`. No genera ningún registro en `movimientos_caja`.
2. **¿Abrir caja afecta ingresos?**
   - **NO.** No computa como venta ni como ganancia operativa.
3. **¿Abrir caja afecta gastos?**
   - **NO.** No constituye un egreso ni costo.
4. **¿Abrir caja afecta rentabilidad?**
   - **NO.** El balance de pérdidas y ganancias (P&L) en el Dashboard no incluye los montos de apertura.
5. **¿El fondo inicial es movimiento financiero o dato declarativo?**
   - En el flujo de `abrir_caja`, es un **DATO DECLARATIVO** (fondo de maniobra / base para cambio).
6. **¿El cierre genera movimiento?**
   - **NO.** `cerrar_caja` realiza un arqueo contable comparativo; actualiza `monto_cierre_esperado`, `monto_cierre_contado` y `diferencia` en `sesiones_caja`, sin crear movimientos compensatorios automáticos en `movimientos_caja`.
7. **¿La sesión determina qué movimientos pertenecen a una caja?**
   - **SÍ.** Cada movimiento financiero contiene el campo `sesion_id` que delimita la responsabilidad de custodia del operador durante su turno.

---

## 15. Casos Extremos

| Caso Extremo | Comportamiento en Código / BD | Estado de Protección | Riesgo |
|--------------|-------------------------------|----------------------|--------|
| **Doble click en botón** | No tiene `isSubmittingRef`; envía 2 HTTP requests; la BD absorbe la 2da vía `unique_violation` | Mitigado en BD | 🟡 MEDIO |
| **Doble request concurrente** | Serializado por `idx_sesion_unica_abierta` en Postgres | Protegido | 🟢 BAJO |
| **Timeout de red** | POS muestra error; la sesión se crea en BD; un refresh o reintento la carga limpiamente | Recuperable | 🟡 MEDIO |
| **Refresh de página (F5)** | Recuperación limpia mediante `getWorkerProfile()` -> `fetchSession()` | Protegido | 🟢 BAJO |
| **Pérdida de conexión** | Error de fetch; al volver el internet se detecta la sesión activa | Protegido | 🟢 BAJO |
| **Respuesta tardía (>15s)** | Botón permanece en "Abriendo Caja..."; no duplica datos | Protegido | 🟢 BAJO |
| **Sesión cerrada externamente** | `fetchSession` da `null`; POS se bloquea automáticamente | Protegido | 🟢 BAJO |
| **Sesión inexistente** | Muestra pantalla de bloqueo "Caja Cerrada" | Protegido | 🟢 BAJO |
| **Dos sesiones mismo cajero** | Imposible por restricción `idx_sesion_unica_abierta` | Protegido | 🟢 BAJO |
| **Dos trabajadores distintos** | Permite 2 cajas independientes (diseño correcto) | Protegido | 🟢 BAJO |
| **Admin + Trabajador** | Permite operación simultánea de ambos | Protegido | 🟢 BAJO |
| **Fondo inicial nulo/vacío** | `Number('') = 0`, envía apertura en $0 | Protegido | 🟢 BAJO |
| **Monto negativo en apertura** | `NumericInput` permite `-`; `abrir_caja` no valida `>= 0` | **VULNERABLE** | 🟡 MEDIO |
| **Monto decimal** | Columna `numeric` acepta decimales; sin impacto de error | Tolerado | 🟢 BAJO |
| **Usuario no autenticado** | `ProtectedRoute` redirige a `/login`; RPC deniega por `fn_is_worker()` | Protegido | 🟢 BAJO |
| **Trabajador inactivo** | `ProtectedRoute` y `fn_is_worker()` bloquean acceso | Protegido | 🟢 BAJO |

---

## 16. Reconciliaciones Forenses (Base de Datos Live)

Se ejecutaron scripts de inspección profunda sobre la base de datos de producción arrojando los siguientes resultados forenses:

1. **Sesiones Huérfanas de Trabajador:**
   - Consulta: `SELECT COUNT(*) FROM sesiones_caja WHERE trabajador_id IS NULL;`
   - **Resultado: 0** (Ninguna sesión sin responsable).
2. **Sesiones Abiertas Duplicadas por Trabajador:**
   - Consulta: `SELECT trabajador_id, count(*) FROM sesiones_caja WHERE estado = 'ABIERTA' GROUP BY trabajador_id HAVING count(*) > 1;`
   - **Resultado: 0** (No existen cajas abiertas duplicadas para un mismo usuario).
3. **Total de Sesiones Abiertas Actualmente:**
   - **Exactamente 1 sesión abierta en todo el sistema:**
     - ID: `d23831d6-2e10-4475-b13b-78ae2f25b407`
     - Trabajador: `fbd7bacb-f275-4544-ab07-d567ebbba944` ("Trabajador 1")
     - Fecha de Apertura: `2026-09-07T21:52:31.924659+00:00`
     - Estado: `ABIERTA`
     - Fondo declarado: `$87,000`
     - Antigüedad: **17 días abierta ininterrumpidamente (Sesión Zombie)**.
4. **Ventas sin Sesión Asignada:**
   - Consulta: `SELECT COUNT(*) FROM ventas WHERE sesion_id IS NULL;`
   - **Resultado: 0** (100% de las ventas tienen sesión).
5. **Movimientos sin Sesión Asignada:**
   - Consulta: `SELECT * FROM movimientos_caja WHERE sesion_id IS NULL;`
   - **Resultado: 1 movimiento encontrado:**
     - ID: `d6f798e9-6b55-4a57-986c-ec58ab5febe8`
     - Monto: `$38,650` (EGRESO, Bancolombia)
     - Fecha: `2026-09-08T16:24:18`
     - Operador: `6731b487-c90f-43d5-8118-c688c6ca00b4` ("Administrador Principal")
     - Motivo: `compra_id: 45ed9db2-33d3-4f5e-b49e-9a0d31cd6597` ("Pago de compra de insumos").
     - Diagnóstico: Se realizó un pago de compra de insumos mediante el módulo de compras en un momento en que el administrador no tenía un turno de caja abierto en el POS.
6. **Integridad de Idempotency Keys:**
   - **Ventas con `idempotency_key`:** 99 de 99 (100%). Claves duplicadas: **0**.
   - **Movimientos de caja con `idempotency_key`:** 4 de 120 (3.3%). 116 movimientos no poseen clave única.

---

## 17. Hallazgos Identificados

### 🔴 HALLAZGO FASE-A-001: Sesión Zombie Abierta en Producción desde hace 17 días
- **Severidad:** 🔴 CRÍTICO
- **Descripción:** La sesión de caja `d23831d6-2e10-4475-b13b-78ae2f25b407` perteneciente a "Trabajador 1" fue abierta el 7 de septiembre de 2026 y **nunca ha sido cerrada**. Posee 10 ventas y 20 movimientos de caja asociados.
- **Evidencia:** Registro en `sesiones_caja` con `fecha_apertura = '2026-09-07T21:52:31'`, `fecha_cierre = NULL`, `estado = 'ABIERTA'`.
- **Archivo:** N/A (Dato en Base de Datos).
- **Tabla:** `public.sesiones_caja`
- **RPC:** `fn_get_active_session`, `abrir_caja`, `cerrar_caja`.
- **Impacto:** Si "Trabajador 1" inicia sesión hoy en el POS, el sistema no le solicitará arqueo de apertura ni fondo de inicio, sino que reactivará inmediatamente la sesión del 7 de septiembre, mezclando las ventas de hoy con transacciones de hace semanas y falseando el arqueo de cierre. Además, impide que dicho trabajador inicie un nuevo turno limpio.
- **Módulos afectados:** POS, Arqueo de Caja, Reportes de Ventas, Dashboard.
- **Probabilidad:** 100% (Condición actual activa en producción).
- **Recomendación:** Implementar una verificación de expiración de sesión (por ejemplo, alertar o forzar cierre si una sesión abierta supera las 24 horas continuas sin cierre) y ejecutar el cierre administrativo de la sesión zombie identificada.
- **Estado:** CONFIRMADO.

---

### 🟠 HALLAZGO FASE-A-002: Riesgo de Doble Contabilización del Fondo Inicial en el Saldo Esperado del POS
- **Severidad:** 🟠 ALTO
- **Descripción:** En [POS.jsx línea 147](file:///e:/Documents/titan_grill/src/components/POS.jsx#L147), el cálculo del dinero esperado en caja suma el `monto_apertura` directamente con todos los movimientos tipo `INGRESO` de la sesión:
  $$\text{expectedCashAtClose} = \text{openEf} + \text{calcMovs('EFECTIVO')}$$
  Si un Socio Administrador ejecuta el RPC `registrar_saldo_inicial` para inyectar la base a la sesión abierta, este RPC inserta un registro en `movimientos_caja` con `tipo = 'INGRESO'` y `tipo_operacion = 'SALDO_INICIAL'`. Por consiguiente, `calcMovs('EFECTIVO')` suma ese valor, y luego la fórmula le suma nuevamente `openEf`, **duplicando el fondo inicial en el saldo esperado**.
- **Evidencia:** Verificado empíricamente en la sesión histórica `283e7d33-bf81-4779-a025-f33071554b60` de Karen Berrío:
  - `monto_apertura`: `$82,000`
  - Movimiento `SALDO_INICIAL` en efectivo: `$189,400`
  - Total ventas en efectivo: `$107,900`
  - `calcMovs('EFECTIVO')`: $189,400 + $107,900 = `$297,300`
  - `openEf + calcMovs('EFECTIVO')`: $82,000 + $297,300 = **$379,300**.
- **Archivo:** [POS.jsx](file:///e:/Documents/titan_grill/src/components/POS.jsx#L121-L153)
- **Líneas:** 140-150
- **Tabla:** `public.sesiones_caja`, `public.movimientos_caja`
- **RPC:** `registrar_saldo_inicial`
- **Impacto:** Si los socios y los cajeros no tienen una convención unívoca, el sistema espera el doble de base física al momento del arqueo de cierre, generando un falso faltante de caja equivalente a la base inicial.
- **Módulos afectados:** POS, Arqueo y Cierre de Caja, Finanzas.
- **Probabilidad:** ALTA.
- **Recomendación:** Ajustar la fórmula de `calcMovs` para excluir movimientos donde `tipo_operacion === 'SALDO_INICIAL'` si `openEf` ya es sumado, o unificar si el saldo inicial es puramente declarativo o exclusivamente un movimiento transaccional.
- **Estado:** CONFIRMADO.

---

### 🟡 HALLAZGO FASE-A-003: Carencia de `isSubmittingRef` en `handleOpenSession` (Frontend POS)
- **Severidad:** 🟡 MEDIO
- **Descripción:** El guardián contra dobles clicks `isSubmittingRef` implementado en `POS.jsx` solo está activo para registrar ventas y reintentar ventas pendientes, omitiendo por completo el handler de apertura `handleOpenSession`.
- **Evidencia:** [POS.jsx líneas 542-563](file:///e:/Documents/titan_grill/src/components/POS.jsx#L542-L563). No se verifica `if (isSubmittingRef.current) return;` ni se asigna `isSubmittingRef.current = true;`.
- **Archivo:** [POS.jsx](file:///e:/Documents/titan_grill/src/components/POS.jsx)
- **Líneas:** 542-563
- **Tabla:** `public.sesiones_caja`
- **RPC:** `abrir_caja`
- **Impacto:** Un doble click en una red de alta latencia dispara peticiones paralelas hacia el servidor Supabase. Aunque la base de datos lo absorbe gracias a `idx_sesion_unica_abierta`, el cliente genera tráfico redundante y depende enteramente del catch del motor SQL.
- **Módulos afectados:** POS UI.
- **Probabilidad:** MEDIA.
- **Recomendación:** Proteger `handleOpenSession` con `isSubmittingRef.current` idéntico al patrón aplicado en `handleRegisterSale`.
- **Estado:** CONFIRMADO.

---

### 🟡 HALLAZGO FASE-A-004: Ausencia de Validación de Valores Negativos en Apertura
- **Severidad:** 🟡 MEDIO
- **Descripción:** Ni el frontend en [POS.jsx](file:///e:/Documents/titan_grill/src/components/POS.jsx) ni la función backend `abrir_caja` validan que los montos de apertura (`p_monto_apertura`, `p_apertura_nequi`, `p_apertura_bancolombia`) sean números no negativos ($\ge 0$). [NumericInput.jsx](file:///e:/Documents/titan_grill/src/components/ui/NumericInput.jsx) permite escribir el signo negativo.
- **Evidencia:** Función `abrir_caja` en [20260912_fase_a_correccion.sql](file:///e:/Documents/titan_grill/supabase/migrations/20260912_fase_a_correccion.sql#L29-L66) inserta directamente `p_monto_apertura` sin clausula `IF p_monto_apertura < 0 THEN`.
- **Archivo:** [POS.jsx](file:///e:/Documents/titan_grill/src/components/POS.jsx), [20260912_fase_a_correccion.sql](file:///e:/Documents/titan_grill/supabase/migrations/20260912_fase_a_correccion.sql)
- **Líneas:** [POS.jsx:547-549](file:///e:/Documents/titan_grill/src/components/POS.jsx#L547-L549)
- **Tabla:** `public.sesiones_caja`
- **RPC:** `abrir_caja`
- **Impacto:** Si un operador tipea inadvertidamente un valor negativo, la caja se inicia con base deficitaria, alterando negativamente todos los saldos esperados de cierre.
- **Módulos afectados:** POS, Arqueo de Caja.
- **Probabilidad:** BAJA.
- **Recomendación:** Agregar validación explícita en frontend `Math.max(0, ...)` y comprobación en Postgres `IF p_monto_apertura < 0 THEN RAISE EXCEPTION 'El monto no puede ser negativo';`.
- **Estado:** CONFIRMADO.

---

### 🟡 HALLAZGO FASE-A-005: Asimetría de Idempotency Key en Módulos de Caja
- **Severidad:** 🟡 MEDIO
- **Descripción:** Mientras el módulo de Ventas implementa `idempotency_key` con índice `UNIQUE` y almacenamiento en `localStorage`, la tabla `sesiones_caja` no posee columna para `idempotency_key` y el RPC `abrir_caja` no la admite. Además, en `movimientos_caja`, 116 de 120 movimientos no poseen clave de idempotencia.
- **Evidencia:** Inspección de columnas de `sesiones_caja` y consulta forense a `movimientos_caja`.
- **Archivo:** [POS.jsx](file:///e:/Documents/titan_grill/src/components/POS.jsx), `sesiones_caja`
- **Tabla:** `public.sesiones_caja`, `public.movimientos_caja`
- **RPC:** `abrir_caja`
- **Impacto:** Aunque la concurrencia de sesiones está protegida por `idx_sesion_unica_abierta`, no existe trazabilidad distribuida para relacionar reintentos de red del cliente con una clave UUID emitida por el frontend.
- **Módulos afectados:** POS, Auditoría de Transacciones.
- **Probabilidad:** BAJA.
- **Recomendación:** Estandarizar la columna `idempotency_key` en futuras revisiones si se requiere auditoría de red de extremo a extremo.
- **Estado:** CONFIRMADO.

---

### 🟢 HALLAZGO FASE-A-006: Movimiento de Caja Huérfano de Sesión (`sesion_id = NULL`)
- **Severidad:** 🟢 BAJO
- **Descripción:** Existe en producción 1 movimiento en `movimientos_caja` (`d6f798e9-6b55-4a57-986c-ec58ab5febe8`) por valor de $38,650 con `sesion_id = null`, generado por el RPC `recibir_compra`.
- **Evidencia:** Query forense en `movimientos_caja`.
- **Archivo:** N/A (Módulo Compras / Base de Datos).
- **Tabla:** `public.movimientos_caja`
- **RPC:** `recibir_compra`
- **Impacto:** Ese egreso no es imputable a ningún turno de cajero específico. En el Dashboard general sí suma al balance global, pero no entra en ningún arqueo de cierre de turno de caja.
- **Módulos afectados:** Caja, Compras.
- **Probabilidad:** BAJA (Afecta compras sin turno activo).
- **Recomendación:** Documentar formalmente como regla de negocio si las compras realizadas fuera de turno deben permanecer sin sesión o asociarse a una sesión administrativa especial.
- **Estado:** CONFIRMADO.

---

## 18. Riesgos

1. **Riesgo Operativo Crítico (Sesiones sin Caducidad):**
   Cajeros que olvidan cerrar su turno dejan sesiones perpetuas activas (como la sesión del Trabajador 1). Esto distorsiona las métricas de corte diario y acumula arqueos de múltiples días en uno solo.
2. **Riesgo Financiero Alto (Doble Saldo Inicial):**
   Confusión entre el fondo físico en caja declarado en `monto_apertura` y el registro de `SALDO_INICIAL` en `movimientos_caja`. Si ambos se usan en la misma jornada, el arqueo de cierre exigirá el doble del dinero base real.
3. **Riesgo de Disponibilidad Bajo (Pantalla parpadeante si no hay Auth):**
   La falta de un `finally` que apague `sessionLoading` en `POS.jsx` puede bloquear visualmente a un usuario si el token se vence silenciosamente.

---

## 19. Elementos NO VERIFICADOS

Debido a la **REGLA ABSOLUTA DE SOLO LECTURA** y la prohibición estricta de generar transacciones reales o mutar el esquema de base de datos en esta fase, los siguientes aspectos no fueron verificados mediante ejecución destructiva directa y requieren una ventana de pruebas controlada:

1. **Inyección en Vivo de Montos Negativos:**
   No se ejecutó `abrir_caja` con `-50000` en la base de datos live para no contaminar el historial de auditoría ni alterar los turnos vigentes. Se concluyó la vulnerabilidad mediante análisis estático del código PL/pgSQL y de las restricciones en catálogo.
2. **Doble Clic Simultáneo en Vivo sobre el Botón del Navegador:**
   El botón `Abrir Caja` en la pantalla del navegador no fue pulsado repetidamente para evitar la apertura de una caja real a nombre del Administrador Principal en la base de datos productiva. Se documenta como **NO EJECUTADA — DESTRUCTIVA**.
3. **Cierre Forzoso de la Sesión Zombie:**
   No se invocó `cerrar_caja` sobre la sesión `d23831d6-2e10-4475-b13b-78ae2f25b407` del Trabajador 1, preservando intacto el estado encontrado para decisiones del propietario del negocio.

---

## 20. Recomendaciones

### Críticas / Inmediatas:
1. **Atender la Sesión Zombie de Producción:**
   Cerrar administrativamente la sesión `d23831d6-2e10-4475-b13b-78ae2f25b407` previa consulta con el propietario de Titan Grill, registrando el arqueo correspondiente.
2. **Unificar el Tratamiento del Saldo Inicial:**
   Ajustar en `POS.jsx` la función `fetchExpectedCash` para que si existe un movimiento con `tipo_operacion = 'SALDO_INICIAL'`, no se duplique sumando además el `monto_apertura`, o bien establecer por regla de negocio que la base se define únicamente en un solo lugar.

### Secundarias / De Calidad:
3. **Incorporar `isSubmittingRef` en `handleOpenSession`:**
   Blindar el botón de apertura en el frontend ante dobles clics accidentales de operadores en pantallas táctiles o móviles.
4. **Validación de Rango Numérico ($\ge 0$):**
   Agregar comprobación `IF p_monto_apertura < 0` en el RPC `abrir_caja` y en [POS.jsx](file:///e:/Documents/titan_grill/src/components/POS.jsx).
5. **Manejo Seguro de Expiración de Cajas:**
   Implementar una regla en frontend o RPC que alerte al operador si la sesión abierta tiene más de 16 horas de antigüedad, sugiriendo arqueo y cierre antes de continuar operando.

---

## 21. Evidencia

### A. Inspección en Vivo del DOM del POS (Browser)
- URL: `https://localhost:5173/pos`
- Usuario autenticado: `mdeviajob@gmail.com`
- Título visual: `TITAN GRILL POS`
- Estado renderizado: Modal centrado **"Caja Cerrada"** con ícono de llave dorado/fuego.
- Etiqueta de operador: `Operador: Administrador Principal`.
- Botón evaluado: `Abrir Caja` (clase `bg-fire`, estado `enabled`).
- Prueba de clic en apertura: **NO EJECUTADA — DESTRUCTIVA** (Siguiendo protocolo estricto).

### B. Evidencia de Base de Datos Live (Extracto Forense)
```json
{
  "total_sesiones_historicas": 7,
  "sesiones_abiertas_actuales": 1,
  "sesion_abierta_zombie": {
    "id": "d23831d6-2e10-4475-b13b-78ae2f25b407",
    "trabajador_id": "fbd7bacb-f275-4544-ab07-d567ebbba944",
    "nombre_trabajador": "Trabajador 1",
    "fecha_apertura": "2026-09-07T21:52:31.924659+00:00",
    "fecha_cierre": null,
    "estado": "ABIERTA",
    "monto_apertura": 87000,
    "ventas_asociadas": 10,
    "movimientos_asociados": 20
  },
  "ventas_totales_registradas": 99,
  "ventas_con_sesion_valida": 99,
  "ventas_sin_sesion": 0,
  "ventas_con_idempotency_key": 99,
  "ventas_con_idempotency_key_duplicada": 0,
  "movimientos_sin_sesion": 1,
  "movimiento_sin_sesion_detalle": {
    "id": "d6f798e9-6b55-4a57-986c-ec58ab5febe8",
    "monto": 38650,
    "tipo": "EGRESO",
    "metodo_pago": "BANCOLOMBIA",
    "descripcion": "Pago de compra de insumos",
    "compra_id": "45ed9db2-33d3-4f5e-b49e-9a0d31cd6597"
  }
}
```

---

## 22. Conclusión de la Fase A

### VERIFICADO
1. Se demostró que el mecanismo de exclusión mutua de cajas mediante el índice único `idx_sesion_unica_abierta` en PostgreSQL funciona y previene físicamente que un trabajador mantenga más de una caja abierta a la vez.
2. Se verificó que el RPC `abrir_caja` está protegido por autenticación y rol de trabajador (`fn_is_worker()`), impidiendo suplantación o accesos no autorizados.
3. Se constató que el 100% de las ventas en producción (99/99) se encuentran asociadas a una sesión de caja formal y poseen claves únicas de idempotencia sin colisiones.
4. Se comprobó que la apertura de caja es estrictamente declarativa y no altera los saldos contables, ingresos ni rentabilidad del negocio.

### RIESGOS
1. **Sesión Zombie:** Existe actualmente en la base de datos de producción una caja abierta desde hace 17 días para el Trabajador 1, lo cual vicia cualquier operación inmediata de ese usuario y desvirtúa los arqueos temporales.
2. **Doble Contabilización de Fondo:** La fórmula de efectivo esperado en el frontend suma el fondo de apertura y los movimientos de saldo inicial indistintamente, con riesgo de generar falsos faltantes de caja.
3. **Debilidad de Interfaz en Apertura:** Falta de bloqueo `isSubmittingRef` en el botón de abrir caja y ausencia de validación de números negativos en backend y frontend.

### NO VERIFICADO
1. La inyección intencional de parámetros anómalos o negativos vía HTTP directo contra el RPC `abrir_caja` (reservado para ambiente de pruebas sin datos reales).
2. El cierre físico de la sesión zombie abierta en producción (requiere aval explícito del administrador de Titan Grill).

### IMPACTO
- **Módulos Afectados:** Punto de Venta (POS), Arqueo de Caja, Ventas y Finanzas/Tesorería.
- **Impacto Financiero:** No hay corrupción histórica de cifras de ventas, pero existe un riesgo latente de reporte erróneo en el efectivo esperado de caja de hasta el 100% del fondo de inicio cuando se utilicen saldos iniciales del socio.

---
**FIN DE LA AUDITORÍA FORENSE DE LA FASE A**
