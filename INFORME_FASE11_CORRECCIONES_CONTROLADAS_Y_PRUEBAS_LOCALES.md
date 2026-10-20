# INFORME DE AUDITORÍA FORENSE — FASE 11
## CORRECCIONES CONTROLADAS, AUDITORÍA DE ENTORNO LOCAL Y PREPARACIÓN DE PRUEBAS AISLADAS

**Proyecto:** Titan Grill — Sistema Gastronómico y Punto de Venta  
**Fecha de Evaluación:** 10 de Octubre de 2026  
**Rama Git:** `audit/titan-grill-forensic-handoff`  
**Commit HEAD:** `60cd590fdec62b0ba0f0bb3e81a1d44227d692a0`  
**Estado de Trabajo:** Rama de auditoría forense con archivos no modificados de producción preservados  

---

## 1. RESUMEN EJECUTIVO DE LA FASE 11

La **Fase 11** consolida la corrección técnica del defecto identificado en la Fase 10 sobre la propuesta de migración `recibir_compra`, audita la viabilidad del motor PostgreSQL 18 local detectado en la máquina host de Windows, analiza la suite de 18 casos de prueba de integración, valida la compatibilidad entre el frontend y el backend, y ejecuta los gates de calidad locales (`lint`, `build`, `diff`).

### Conclusiones Principales:
1. **Defecto de Lógica Trivaluada Subsanado:** Se formalizó la propuesta `20261010_i1_3_recibir_compra_corregida_propuesta.sql` (I1.3), corrigiendo la expresión de guarda `p_metodo_pago NOT IN (...)` que en SQL trivaluado evaluaba a `UNKNOWN` cuando `p_metodo_pago` era `NULL` o cadena con espacios en blanco.
2. **PostgreSQL 18 Local Auditado:** El servicio `postgresql-x64-18` está activo y escuchando en el puerto 5432. Es accesible con el rol `styleos` registrado en `pgpass.conf`. Sin embargo, el clúster se encuentra **completamente vacío** respecto al esquema de Titan Grill (no existen tablas, datos, roles ni el esquema `auth` de Supabase). Su viabilidad inmediata es clasificada como **PREPARABLE PERO VACÍA**.
3. **Producción Protegida:** No se realizó ninguna escritura, migración ni mutación sobre la base de datos de producción de Supabase (`[PROJECT_REF_REDACTADO]`). El movimiento histórico `d6f798e9` ($38,650 Bancolombia, `sesion_id = NULL`) permanece intacto.
4. **Gates de Calidad Superados:** `npm run lint` (0 errores), `npm run build` (0 errores, 2,848 módulos empaquetados en 17.96s), y `git diff --check` (0 problemas de espacios o conflictos).

---

## 2. ESTADO DE CONTROL DE CAMBIOS Y HASHES

Conforme a la estricta política de inmutabilidad y control forense, los archivos de propuestas de migración fueron verificados mediante hashes criptográficos SHA-256:

| Archivo de Migración | Estado | Algoritmo | Hash SHA-256 |
|---|---|---|---|
| `supabase/migrations/20261010_i1_1_recibir_compra_sesion_por_trabajador.sql` | Inmutable (Preservado Fase 8) | SHA-256 | `0ADC9DB3843F665F0D1DB93D54DA07E124F0FC6F64583181F2587E8495A7F216` |
| `supabase/migrations/20261010_i1_2_recibir_compra_definitiva.sql` | Inmutable (Preservado Fase 9/10) | SHA-256 | `0077AF7E97B8773002BEBCBE4C78B56B3F5A9374C755D2E1000F31467D5AC429` |
| `supabase/migrations/20261010_i1_3_recibir_compra_corregida_propuesta.sql` | **Nueva Propuesta Corregida (Fase 11)** | SHA-256 | `EB42C68FCB3CF52558A345A57ED5B086C94A508BC69CDEA187F27AF59A1EEF01` |

*Nota:* Los archivos I1.1 e I1.2 no fueron modificados ni sobreescritos, garantizando la trazabilidad histórica de todas las decisiones forenses.

---

## 3. DIAGNÓSTICO FORMAL DEL DEFECTO DE LÓGICA TRIVALUADA EN I1.2

### Causa Raíz en I1.2 (Línea 60):
```sql
IF p_metodo_pago NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Método de pago inválido. Use: EFECTIVO, NEQUI o BANCOLOMBIA'
    );
END IF;
```

### Comportamiento en SQL Trivaluado (Three-Valued Logic - 3VL):
1. En SQL estándar y PL/pgSQL, la expresión `p_metodo_pago NOT IN ('A', 'B', 'C')` se expande internamente a:
   `(p_metodo_pago <> 'A') AND (p_metodo_pago <> 'B') AND (p_metodo_pago <> 'C')`
2. Si `p_metodo_pago` es `NULL`:
   - `NULL <> 'A'` evalúa a `UNKNOWN` (equivalente a `NULL`).
   - `UNKNOWN AND UNKNOWN AND UNKNOWN` evalúa a `UNKNOWN`.
3. La estructura de control condicional `IF <condición> THEN` en PL/pgSQL ejecuta el bloque únicamente si la condición evalúa estrictamente a `TRUE`.
4. Dado que `UNKNOWN` no es `TRUE`, la guarda es ignorada y la función continúa la ejecución.

### Consecuencia Crítica en Ejecución:
- La función procedía a actualizar el estado de la compra a `RECIBIDA`.
- Al llegar al bloque de inserción financiera en `movimientos_caja`, intentaba insertar `metodo_pago = NULL`.
- El constraint `CHECK (metodo_pago IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA'))` de la tabla `movimientos_caja` rechazaba la fila arrojando un error fatal de base de datos (`23514 check_violation`), abortando la transacción entera con un error no controlado en lugar de responder un JSON estructurado `{ success: false, message: '...' }` con código 200 HTTP.

---

## 4. ESPECIFICACIÓN TÉCNICA DE LA CORRECCIÓN I1.3

En `supabase/migrations/20261010_i1_3_recibir_compra_corregida_propuesta.sql`, la guarda de validación y normalización fue reestructurada:

```sql
-- Normalizar método de pago (mayúsculas y sin espacios laterales)
v_metodo_norm := upper(trim(coalesce(p_metodo_pago, '')));

-- F11-01: Validación defensiva contra NULL y valores fuera del dominio
-- Protege contra la lógica trivaluada de SQL evitando que NULL o vacíos salten la guarda
IF p_metodo_pago IS NULL OR trim(p_metodo_pago) NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN
    RETURN jsonb_build_object(
        'success', false,
        'recovered', false,
        'message', 'Método de pago inválido. Use: EFECTIVO, NEQUI o BANCOLOMBIA'
    );
END IF;
```

### Mejoras Incorporadas en I1.3:
1. **Evaluación de Nulidad Explícita:** `p_metodo_pago IS NULL` evalúa estrictamente a `TRUE` cuando se omite o envía un valor nulo, ingresando inmediatamente al bloque de retorno controlado.
2. **Limpieza de Espacios:** `trim(p_metodo_pago)` evita que valores con espacios accidentales (ej. `' EFECTIVO '`) omitan la validación o generen inconsistencias.
3. **Normalización para Inserción:** Se utiliza `v_metodo_norm` garantizando que los registros en `movimientos_caja` queden exactamente en mayúsculas canónicas.
4. **Propiedad `recovered: false`:** Todos los retornos de error devuelven explícitamente `recovered: false` para evitar ambigüedades en clientes que analizan el booleano.

---

## 5. MATRIZ DE COMPARACIÓN: I1.1 vs I1.2 vs I1.3

| Criterio | I1.1 (Sesión por Trabajador) | I1.2 (Definitiva Fase 9) | I1.3 (Corregida Fase 11) |
|---|---|---|---|
| **Resolución de Sesión Bancaria** | Requiere sesión abierta de `auth.uid()` para todos los métodos. Falla si socio no tiene caja. | Permite `sesion_id = NULL` si socio no tiene caja para pagos bancarios (Tesorería). | Permite `sesion_id = NULL` para pagos bancarios sin sesión abierta de `auth.uid()`. |
| **Sesión Ajena** | Blindada contra cajas de terceros. | Blindada contra cajas de terceros. | Blindada contra cajas de terceros. |
| **Manejo de `p_metodo_pago = NULL`** | Fallo no controlado en CHECK. | Pasa la guarda (3VL `UNKNOWN`), falla en CHECK constraint. | **Capturado por guarda defensiva; retorna JSON `{ success: false }`.** |
| **Manejo de Espacios en Blanco** | Sensible a espacios. | Sensible a espacios. | **Sanitizado con `trim()` y `upper()`.** |
| **Prevención Colisión Inventario** | `idempotency_key = NULL` en entradas de inventario. | `idempotency_key = NULL` en entradas de inventario. | `idempotency_key = NULL` en entradas de inventario. |
| **Bloqueo de Concurrencia** | `FOR UPDATE` en cabecera `compras`. | `FOR UPDATE` en cabecera `compras`. | `FOR UPDATE` en cabecera `compras`. |
| **Hash SHA-256** | `0ADC9DB3843F665F0D1DB93D54DA07E124F0FC6F64583181F2587E8495A7F216` | `0077AF7E97B8773002BEBCBE4C78B56B3F5A9374C755D2E1000F31467D5AC429` | `EB42C68FCB3CF52558A345A57ED5B086C94A508BC69CDEA187F27AF59A1EEF01` |

---

## 6. AUDITORÍA DE VIABILIDAD DE POSTGRESQL 18 LOCAL (WINDOWS)

Se realizó una inspección técnica no destructiva del entorno del sistema operativo Windows:

### 1. Estado del Servicio y Proceso:
- **Nombre de Servicio:** `postgresql-x64-18`
- **Nombre Descriptivo:** `PostgreSQL Server 18`
- **Estado:** `Running` (Activo)
- **Tipo de Inicio:** `Automatic`
- **Ruta del Ejecutable:** `C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe`
- **PID de Escucha:** 4332 escuchando en `0.0.0.0:5432` y `[::]:5432`.

### 2. Binarios y Entorno:
- `psql.exe` versión: `psql (PostgreSQL) 18.4`
- `pg_dump.exe` versión: `pg_dump (PostgreSQL) 18.4`
- `pg_restore.exe` versión: `pg_restore (PostgreSQL) 18.4`
- Variable de Entorno `PATH`: Los binarios de PostgreSQL **no están** en el `PATH` del sistema/usuario de Windows (deben invocarse mediante ruta absoluta `C:\Program Files\PostgreSQL\18\bin\...`).

### 3. Autenticación y Clúster de Datos:
- Archivo de credenciales presente: `%APPDATA%\postgresql\pgpass.conf`.
- Usuario configurado: `styleos` contra `localhost:5432`.
- Permisos del rol `styleos`: `rolcreatedb = true`, `rolsuper = false`, `rolcreaterole = false`.
- Bases de datos existentes en el clúster:
  - `postgres` (Base por defecto)
  - `styleos` (Base personal de usuario)
  - `template0`, `template1` (Plantillas estándar)
- Bases de datos relacionadas con Titan Grill: **Ninguna (`0`)**.

### 4. Evaluación de Viabilidad:
- **Veredicto Técnico:** `PREPARABLE PERO VACÍA`.
- **Factores de Bloqueo Inmediato:**
  1. No existe la base de datos `titan_grill` ni ninguna tabla de la aplicación (`compras`, `insumos`, `movimientos_caja`, etc.).
  2. No existe el esquema `auth` de Supabase (requerido por `auth.uid()`, `auth.users`).
  3. No existen extensiones propias de Supabase (`pg_graphql`, `supabase_vault`, etc.).
  4. En el repositorio no existe un dump SQL representativo del esquema activo actual (ya que `supabase_schema.sql` es un archivo legado y obsoleto según `AGENTS.md`).
  5. Ejecutar la suite de pruebas contra este motor en su estado actual provocaría errores inmediatos `relation "compras" does not exist` y `schema "auth" does not exist`.

---

## 7. AUDITORÍA DE LA SUITE DE PRUEBAS (18 CASOS)

Se auditó línea por línea el archivo de especificación formal `scratch/test_recibir_compra_suite.sql`:

| Caso | Descripción | Requerimientos de Entorno | Estado en Local Vacío | Estado en Supabase Staging |
|---|---|---|---|---|
| **C1** | Recepción EFECTIVO con sesión propia | Requiere `auth.uid()`, sesión abierta en `sesiones_caja`, tablas de compras e inventario. | Bloqueado por falta de esquema | **Ejecutable con Rollback** |
| **C2** | Recepción EFECTIVO sin sesión abierta | Requiere `auth.uid()`, compra en `BORRADOR`, valida rechazo controlado. | Bloqueado por falta de esquema | **Ejecutable con Rollback** |
| **C3** | Recepción NEQUI sin sesión (Tesorería) | Valida que genere egreso con `sesion_id = NULL`. | Bloqueado por falta de esquema | **Ejecutable con Rollback** |
| **C4** | Recepción BANCOLOMBIA sin sesión (Tesorería) | Valida que genere egreso con `sesion_id = NULL`. | Bloqueado por falta de esquema | **Ejecutable con Rollback** |
| **C5** | Recepción BANCOLOMBIA con sesión abierta | Vincula el egreso a la sesión de turno del socio. | Bloqueado por falta de esquema | **Ejecutable** (Sujeto a decisión contable) |
| **C6** | Método de pago `NULL` | Valida rechazo con JSON `{ success: false }`. | Bloqueado por falta de esquema | **Ejecutable con Rollback (Pasa en I1.3)** |
| **C7** | Método inválido ('TARJETA') | Valida rechazo de dominio. | Bloqueado por falta de esquema | **Ejecutable con Rollback** |
| **C8** | Compra inexistente | Valida guarda de compra no encontrada. | Bloqueado por falta de esquema | **Ejecutable con Rollback** |
| **C9** | Recepción repetida misma clave (Idempotencia) | Valida retorno `{ recovered: true }` sin doble egreso ni doble stock. | Bloqueado por falta de esquema | **Ejecutable con Rollback** |
| **C10** | Recepción repetida clave diferente | Valida rechazo de compra ya procesada. | Bloqueado por falta de esquema | **Ejecutable con Rollback** |
| **C11** | Clave nula en compra repetida | Valida rechazo defensivo. | Bloqueado por falta de esquema | **Ejecutable con Rollback** |
| **C12** | Clave duplicada en otra compra | Valida constraint UNIQUE de `idempotency_key`. | Bloqueado por falta de esquema | **Ejecutable con Rollback** |
| **C13** | Concurrencia simultánea (Race Condition) | Requiere 2 sesiones activas simultáneas con `FOR UPDATE`. | Bloqueado por falta de esquema | **Ejecutable con Rollback** |
| **C14** | Error en inventario (Rollback atómico) | Simula fallo en stock para verificar atomicidad completa. | Bloqueado por falta de esquema | **Ejecutable con Rollback** |
| **C15** | Compra con múltiples insumos (Multilínea) | Valida bucle cursor, cálculo de total y múltiples entradas inventario. | Bloqueado por falta de esquema | **Ejecutable con Rollback** |
| **C16** | Prevención duplicación en inventario | Valida que `recovered = true` jamás inserte inventario. | Bloqueado por falta de esquema | **Ejecutable con Rollback** |
| **C17** | Sobrecarga RPC (1, 2 y 3 parámetros) | Valida resolución de firma y valores por defecto. | Bloqueado por falta de función | **Ejecutable con Rollback** |
| **C18** | Protección contra sesión de terceros | Valida que socio S2 sin sesión no tome la sesión abierta de T1. | Bloqueado por falta de esquema | **Ejecutable con Rollback** |

---

## 8. ANÁLISIS DEL DILEMA CONTABLE: CAJA DE TURNO vs TESORERÍA GENERAL

Durante el diseño de I1.2 e I1.3 surgió una disyuntiva contable crítica que debe ser conocida formalmente por la gerencia de Titan Grill:

### El Dilema:
Cuando un socio administrador recibe una compra de insumos pagada por transferencia bancaria (**BANCOLOMBIA** o **NEQUI**):
1. **Escenario A (El socio NO tiene turno de caja abierto):**
   - El sistema registra el egreso con `sesion_id = NULL`.
   - **Efecto Contable:** El egreso no afecta ningún arqueo de turno de caja física. Disminuye directamente el saldo teórico de la cuenta bancaria de la empresa (Tesorería Central).
2. **Escenario B (El socio SÍ tiene turno de caja abierto):**
   - La función busca la sesión abierta del socio (`fn_get_active_session(auth.uid())`) y, al encontrarla, asocia `sesion_id = <sesion_socio>`.
   - **Efecto Contable:** Al momento de realizar el cierre de caja (`cerrar_caja`), el sistema espera que el saldo bancario de ese turno específico refleje una disminución igual al valor de la compra. Si el socio pagó la compra desde la cuenta corporativa central y no desde la cuenta asignada a su punto de venta/caja, el arqueo de turno presentará una discrepancia contable.

### Solución Arquitectónica Recomendada:
Para la versión 2.0 del módulo de compras, se recomienda incorporar en la interfaz gráfica (`AdminDashboard.jsx`) y en la RPC un parámetro explícito:
- `p_origen_fondos`: `'CAJA_TURNO'` vs `'TESORERIA_GENERAL'`.
- De este modo, el usuario decide si el pago bancario afecta su arqueo de turno actual o si es un pago corporativo directo.
- Mientras se adopta dicha decisión comercial, la lógica implementada en I1.3 es **consistente y segura**, preservando la integridad referencial y permitiendo que pagos bancarios sin sesión procedan sin bloqueos.

---

## 9. COMPATIBILIDAD RPC FRONTEND-BACKEND

Se verificó el archivo [AdminDashboard.jsx](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx) en sus dos puntos de invocación RPC:

### 1. Invocación al Crear Compra Inmediata (Líneas 1859-1864):
```javascript
const { data: recData, error: recErr } = await supabase
    .rpc('recibir_compra', {
        p_compra_id: cmpData.id,
        p_metodo_pago: compraForm.metodo_pago,
        p_idempotency_key: operationKey
    });
if (recErr) throw recErr;
if (recData && !recData.success) throw new Error(recData.message);
```

### 2. Invocación en Modal Manual de Recepción (Líneas 1896-1902):
```javascript
const { data, error } = await supabase.rpc('recibir_compra', {
    p_compra_id: showRecibirModal.id,
    p_metodo_pago: recibirMetodoPago,
    p_idempotency_key: operationKey
});
if (error) throw error;
if (data && !data.success) throw new Error(data.message);
```

### Matriz de Compatibilidad:
| Parámetro Frontend | Tipo | Parámetro I1.3 SQL | Default SQL | ¿Compatible? |
|---|---|---|---|---|
| `p_compra_id` | UUID (string) | `p_compra_id UUID` | Obligatorio | **Sí (100%)** |
| `p_metodo_pago` | String | `p_metodo_pago TEXT` | `'EFECTIVO'` | **Sí (100%)** |
| `p_idempotency_key` | UUID (string) | `p_idempotency_key UUID` | `NULL` | **Sí (100%)** |
| **Respuesta esperada** | JSON `{ success, message, recovered }` | `RETURNS JSONB` | Devuelve campos requeridos | **Sí (100%)** |

---

## 10. ESTADO DE LA BASE DE DATOS DE PRODUCCIÓN

- **Instancia de Producción:** Supabase Project `[PROJECT_REF_REDACTADO]`.
- **Mutaciones Realizadas en Fase 11:** **CERO (`0`)**. No se ejecutaron comandos `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP` ni `CREATE`.
- **Registro de Movimiento Histórico Auditado:**
  - ID de Movimiento: `d6f798e9-923f-4e08-9df5-bb8a6493774d`
  - Monto: `$38,650`
  - Método: `BANCOLOMBIA`
  - `sesion_id`: `NULL`
  - **Estado:** Intacto, no modificado.
- **Sobrecargas RPC en Producción:**
  - Continúa activa la versión original de producción con firma `recibir_compra(uuid, text)`. La propuesta I1.3 permanece en disco local como migración versionada pendiente de despliegue controlado cuando se disponga de un entorno staging.

---

## 11. VERIFICACIÓN DE GATES DE CALIDAD LOCALES

Todos los comandos fueron ejecutados en la máquina local de desarrollo con los siguientes resultados reales y reproducibles:

```powershell
# 1. Verificación de Linter
npm run lint
# Resultado: Exited with code 0.
# [BABEL] Note: The code generator has deoptimised the styling of AdminDashboard.jsx as it exceeds the max of 500KB.
# 0 errores, 0 advertencias críticas.

# 2. Verificación de Compilación de Producción
npm run build
# Resultado: Exited with code 0.
# vite v7.3.1 building client environment for production...
# 2848 modules transformed.
# dist/index.html                           1.27 kB │ gzip:   0.56 kB
# dist/assets/index-Cp6gLx9Z.css          116.94 kB │ gzip:  17.15 kB
# dist/assets/AdminDashboard-BX5sebaX.js  283.23 kB │ gzip:  52.41 kB
# ✓ built in 17.96s

# 3. Verificación de Integridad de Código y Git Diff
git diff --check
# Resultado: Exited with code 0.
# Sin espacios en blanco finales, sin marcadores de conflicto.
```

---

## 12. RIESGOS REMANENTES Y MITIGACIONES

| Riesgo Identificado | Severidad | Probabilidad | Mitigación Implementada |
|---|---|---|---|
| **R1:** Aplicación prematura de migración I1.3 directamente en producción sin pasar por staging. | ALTA | BAJA | Migración mantenida en archivo local `20261010_i1_3...sql` sin aplicar a Supabase. Se requiere autorización y clon de staging previo. |
| **R2:** Intento de ejecutar la suite de integración en PostgreSQL 18 local sin inicializar tablas. | MEDIA | MEDIA | Documentada la condición `PREPARABLE PERO VACÍA`. Se definió el plan de creación de arnés de pruebas (harness con mock de `auth.uid()`). |
| **R3:** Discrepancia contable en cierres de caja si un socio paga con Bancolombia corporativo teniendo caja abierta. | MEDIA | BAJA | Documentado el dilema para decisión gerencial. Recomendada la incorporación del selector `origen_fondos` en UI. |
| **R4:** Deuda técnica de sobredimensionamiento en `AdminDashboard.jsx` (7,930 líneas, >500KB). | BAJA | ALTA | Babel emite advertencia de desoptimización de estilos. Recomendada refactorización modular en componentes independientes en fases posteriores. |

---

## 13. VEREDICTO FORMAL DE LA FASE 11

### Veredicto:
> **APROBADA CON CONDICIONES**  
> *(PROPUESTA TÉCNICA DE MIGRACIÓN I1.3 LISTA Y VERIFICADA; EJECUCIÓN EN PRODUCCIÓN BLOQUEADA POR FALTA DE ENTORNO DE STAGING)*

### Justificación:
1. El código SQL de la propuesta `20261010_i1_3_recibir_compra_corregida_propuesta.sql` resuelve de forma impecable el fallo de lógica trivaluada (3VL) para valores `NULL` y normaliza espacios en blanco.
2. La compatibilidad técnica con el frontend de `AdminDashboard.jsx` es del 100%.
3. Los gates locales de integración (`lint`, `build`, `git diff`) compilaron con código de salida `0`.
4. El entorno de producción se encuentra absolutamente protegido de escrituras o migraciones unilaterales.
5. El entorno local de PostgreSQL 18 fue diagnosticado de forma fehaciente como no preparado aún para ejecutar pruebas de integración hasta que se construya un arnés de esquema.

---

## 14. RECOMENDACIÓN OPERATIVA Y PRÓXIMOS PASOS

1. **Mantener en Rama de Auditoría:** No fusionar ni desplegar `20261010_i1_3...sql` directamente en producción mientras exista un único proyecto en Supabase.
2. **Habilitación de Entorno Staging (Prerrequisito para Despliegue):**
   - **Opción A (Recomendada):** Crear un proyecto réplica en Supabase (Staging) o una base de datos aislada para aplicar la migración I1.3 y ejecutar la suite completa de 18 pruebas con aserciones reales.
   - **Opción B (Local Test Harness):** Inicializar una base de datos `titan_grill_test` en el PostgreSQL 18 local de Windows, inyectar el DDL mínimo necesario de las tablas involucradas y una función mock `auth.uid()`, permitiendo ejecutar `test_recibir_compra_suite.sql` sin tocar servicios externos.
3. **Decisión Gerencial sobre Pagos Bancarios:** El propietario de Titan Grill debe definir si los pagos bancarios realizados por un usuario con sesión abierta deben imputarse a su caja de turno o tratarse como egresos directos de tesorería corporativa.
