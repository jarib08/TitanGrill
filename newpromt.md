TITAN GRILL — PROMPT DE TRANSICIÓN Y CIERRE DE FASE 6 → FASE 7

CONTEXTO OBLIGATORIO

Acabas de completar una auditoría forense READ-ONLY de transición entre la Fase 6 y la Fase 7 del roadmap de negocio de Titan Grill.

El reporte generado es:

auditoria_transicion_fase6_fase7.md

Debes tratar ese reporte, junto con:

- TITAN_GRILL_FUENTE_DE_VERDAD.md
- TITAN_GRILL_CONTEXTO_Y_HOJA_DE_RUTA.md
- diseno_arquitectura.md
- AGENTS.md
- estado real del código
- schema/RPCs reales de Supabase

como contexto de trabajo.

NO asumas que la Fase 6 está cerrada.
NO asumas que existe una Fase 6.4.
NO inventes fases, requisitos, tablas, RPCs ni reglas de negocio.

==================================================
OBJETIVO DE ESTA SESIÓN
==================================================

Realizar exclusivamente la FASE B — PROTECCIÓN Y SEGURIDAD DE LA TRANSICIÓN.

El objetivo es:

1. Proteger mediante Git todo el trabajo existente que actualmente está fuera de commit.
2. Resolver el hallazgo crítico de seguridad de `liquidaciones`.
3. Verificar las políticas RLS resultantes.
4. Auditar que la corrección no rompa los flujos existentes.
5. Determinar con evidencia cuál debe ser el siguiente bloque de implementación.

NO implementar todavía:
- módulo de Gastos
- transferencias entre cuentas
- arqueo multi-cuenta
- turnos
- cálculo automático de liquidaciones
- frecuencia de pago
- comisión por venta
- nuevas tablas de negocio no aprobadas

Esta sesión NO es todavía la implementación de los pendientes funcionales de Fase 6/7.

==================================================
REGLA CERO — NO DESTRUCTIVO
==================================================

Antes de modificar cualquier cosa:

- Ejecuta `git status`.
- Ejecuta `git diff --stat`.
- Ejecuta `git diff --name-status`.
- Identifica todos los archivos modificados y untracked.
- NO hagas `git reset`, `git clean`, `checkout`, `restore` ni ninguna operación destructiva.
- NO sobrescribas trabajo existente.
- NO elimines archivos.
- NO reformatees archivos no relacionados.

Debes preservar absolutamente todo el trabajo existente.

==================================================
PASO 1 — BASELINE GIT
==================================================

Audita exactamente qué trabajo existe actualmente fuera de Git.

Clasifica:

A. Código funcional
B. Componentes UI
C. POS
D. AdminDashboard
E. Menú digital
F. Documentación
G. Assets
H. Configuración

Después prepara un commit estructurado que proteja el estado actual.

IMPORTANTE:

Antes del commit:

- revisa `git diff`;
- revisa los archivos nuevos;
- confirma que no haya secretos, `.env`, credenciales, dumps ni archivos temporales;
- verifica que `.gitignore` esté funcionando;
- no incluyas archivos que claramente sean secretos o artefactos temporales.

Luego realiza el commit.

El mensaje debe describir que se está creando un baseline de transición del sistema operativo actual.

NO hagas squash.
NO reescribas historial.
NO modifiques commits anteriores.

Después del commit:

- ejecuta `git status`;
- confirma que el working tree esté limpio, salvo que exista algún archivo deliberadamente excluido y documentado;
- muestra hash del nuevo commit;
- muestra `git log --oneline -3`.

==================================================
PASO 2 — AUDITORÍA PROFUNDA DE RLS
==================================================

Ahora investiga exclusivamente la seguridad de `liquidaciones`.

El reporte indica:

- `public.liquidaciones` tiene RLS deshabilitado.
- Esto es un hallazgo crítico.
- No debe permanecer así.

ANTES de aplicar cambios:

Inspecciona mediante Supabase:

1. columnas de `liquidaciones`;
2. foreign keys;
3. constraints;
4. índices;
5. RLS actual;
6. policies actuales;
7. funciones:
   - `fn_is_worker()`
   - `fn_is_admin()`
   - `fn_is_socio()`
8. RPCs:
   - `generar_liquidacion`
   - `pagar_liquidacion`

También determina cómo funciona realmente la autenticación y qué relación existe entre `auth.uid()` y `perfiles_trabajadores`.

NO diseñes políticas basándote solamente en nombres intuitivos.

Debes utilizar el schema y las funciones reales.

==================================================
PASO 3 — DISEÑO DE POLÍTICAS
==================================================

Antes de ejecutar SQL de modificación:

presenta un mini-plan con:

- política SELECT propuesta;
- política INSERT propuesta;
- política UPDATE propuesta;
- si DELETE debe permitirse o no;
- qué roles pueden ejecutar cada operación;
- cómo interactúan las policies con los RPC existentes;
- si `SECURITY DEFINER` o `SECURITY INVOKER` afecta el comportamiento.

MUY IMPORTANTE:

No otorgues permisos más amplios de los necesarios.

La seguridad debe preservar el principio:

- trabajadores/admin autorizados pueden consultar lo necesario;
- acciones sensibles de generación/pago deben seguir pasando por las funciones/RPC correspondientes;
- socios/admin autorizados mantienen control administrativo;
- ningún usuario no autorizado puede manipular directamente liquidaciones.

No conviertas automáticamente `fn_is_worker()` en permiso universal de INSERT/UPDATE.

Primero demuestra qué necesita realmente el frontend actual.

==================================================
PASO 4 — APLICACIÓN CONTROLADA
==================================================

Una vez validado el diseño:

- habilita RLS en `public.liquidaciones`;
- crea únicamente las policies necesarias;
- no cambies el schema funcional de liquidaciones;
- no cambies `generar_liquidacion` ni `pagar_liquidacion` salvo que la auditoría demuestre que es estrictamente necesario para que el flujo existente funcione bajo RLS.

Si es necesario modificar un RPC:

- explica primero por qué;
- conserva su contrato;
- no rompas llamadas existentes;
- no introduzcas cambios funcionales no relacionados.

==================================================
PASO 5 — PRUEBAS DE SEGURIDAD
==================================================

Después de aplicar RLS debes comprobar, con evidencia real de Supabase, como mínimo:

1. Usuario no autenticado:
   - SELECT liquidaciones → DENEGADO
   - INSERT liquidaciones → DENEGADO
   - UPDATE liquidaciones → DENEGADO

2. Usuario autenticado trabajador:
   - acceso permitido únicamente según la política definida;
   - no puede modificar arbitrariamente liquidaciones si no corresponde.

3. Usuario con privilegio socio/admin:
   - puede realizar las operaciones administrativas previstas.

4. Flujo existente:
   - generar liquidación mediante RPC;
   - consultar liquidación;
   - pagar liquidación mediante RPC;
   - verificar que continúa generando `movimientos_caja`;
   - verificar que actualiza `estado`;
   - verificar `movimiento_caja_id`.

NO uses datos destructivos reales para probar.

Si necesitas crear registros de prueba, utiliza una estrategia segura y documenta su limpieza.

==================================================
PASO 6 — AUDITORÍA SECUNDARIA DE MOVIMIENTOS_CAJA
==================================================

El reporte también detectó:

`movimientos_caja INSERT` sin `WITH CHECK`.

NO lo corrijas automáticamente en esta sesión.

Primero determina:

- qué código realiza INSERT directo;
- qué código utiliza RPC;
- si POS/AdminDashboard dependen de INSERT directo;
- qué usuarios deberían poder insertar;
- si agregar `WITH CHECK (fn_is_worker())` rompería algún flujo.

Si encuentras riesgo real, documenta el hallazgo y la remediación recomendada.

NO mezcles esa corrección con RLS de liquidaciones sin evidencia.

==================================================
PASO 7 — VERIFICACIÓN DE RECIBIR_COMPRA
==================================================

El reporte dejó expresamente como "NO DETERMINADO":

`recibir_compra → movimientos_caja`

Inspecciona el RPC real `recibir_compra`.

Determina:

- si genera movimiento financiero;
- qué tipo de movimiento genera;
- con qué cuenta/método;
- si puede duplicar egresos;
- si existe trazabilidad hacia compra;
- si cumple F6-05.

NO modifiques `recibir_compra`.

Solo documenta el resultado.

==================================================
PASO 8 — NO IMPLEMENTAR TODAVÍA LOS GAPS FUNCIONALES
==================================================

NO crear todavía:

- `gastos`
- `cuentas_financieras`
- `turnos_trabajadores`
- `comision_porcentaje`
- `frecuencia_pago`

NO implementar:

- transferencias;
- arqueo multi-cuenta;
- cálculo automático de liquidaciones.

La finalidad de esta sesión es cerrar seguridad y dejar un baseline confiable antes de entrar en esos trabajos.

==================================================
PASO 9 — REPORTE FINAL
==================================================

Actualiza o crea:

auditoria_transicion_fase6_fase7.md

Agrega una sección:

## FASE B — PROTECCIÓN Y SEGURIDAD

Debe incluir:

### Git
- estado inicial;
- archivos protegidos;
- commit creado;
- hash;
- estado final.

### RLS liquidaciones
- estado anterior;
- políticas diseñadas;
- políticas aplicadas;
- motivo de cada policy;
- pruebas realizadas;
- resultado.

### movimientos_caja
- hallazgo;
- flujo actual;
- riesgo;
- recomendación.

### recibir_compra
- comportamiento real;
- evidencia;
- cumplimiento F6-05.

### Riesgos restantes
Separar:
- críticos;
- importantes;
- menores.

==================================================
PASO 10 — DETERMINAR EL SIGUIENTE BLOQUE
==================================================

NO inventes una nueva fase.

Al finalizar debes determinar, basándote exclusivamente en:

- TITAN_GRILL_FUENTE_DE_VERDAD.md;
- auditoria_transicion_fase6_fase7.md;
- schema real;
- código real;

cuál es el siguiente bloque oficial de implementación.

La recomendación preliminar de la auditoría es:

1. Seguridad RLS
2. Completar Fase 6:
   - Gastos
   - arqueo multi-cuenta
   - transferencias
   - verificar compras → caja
3. Completar Fase 7:
   - turnos/horas
   - comisión por venta
   - frecuencia de pago
   - cálculo automático

Pero NO debes asumir este orden como verdad absoluta.

Después de la auditoría debes CONFIRMARLO o corregirlo con evidencia documental.

==================================================
REGLAS ABSOLUTAS
==================================================

1. No inventar requisitos.
2. No inventar tablas.
3. No inventar RPCs.
4. No asumir que una funcionalidad existe porque aparece en UI.
5. No asumir que una funcionalidad falta porque no aparece en un archivo.
6. Verificar siempre schema + RPC + frontend cuando corresponda.
7. No romper funcionalidad existente.
8. No tocar Fase 6.3 UX.
9. No crear Fase 6.4.
10. No comenzar todavía la implementación de Gastos ni de liquidaciones automáticas.
11. No hacer cambios destructivos en Git.
12. Toda modificación de Supabase debe quedar documentada.
13. Toda conclusión debe distinguir:
    - confirmado;
    - parcial;
    - no determinado;
    - pendiente.
14. Si encuentras una contradicción entre documentación y sistema real, NO la ocultes: documenta ambas y explica cuál debe gobernar según la Fuente de la Verdad.
15. Si una modificación de seguridad puede romper un flujo existente, detente y audita antes de continuar.

==================================================
CRITERIO DE FINALIZACIÓN
==================================================

La sesión solo se considera completada si:

[ ] Todo el trabajo existente quedó protegido en Git.
[ ] Existe un commit baseline verificable.
[ ] `liquidaciones` tiene RLS correctamente habilitado.
[ ] Las policies están justificadas y probadas.
[ ] Los RPC de liquidaciones siguen funcionando.
[ ] El pago sigue generando movimiento de caja.
[ ] `movimientos_caja` fue auditado pero no modificado sin justificación.
[ ] `recibir_compra` fue verificado.
[ ] No se implementaron funcionalidades fuera del alcance.
[ ] El reporte de transición fue actualizado.
[ ] Se identificó con evidencia el siguiente bloque oficial.
[ ] Git termina en un estado limpio o con cualquier excepción explícitamente documentada.

COMIENZA AHORA.

Primero ejecuta únicamente la auditoría inicial de Git y Supabase necesaria para la FASE B.

NO implementes funcionalidades de negocio todavía.