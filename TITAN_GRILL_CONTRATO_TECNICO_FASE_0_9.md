# TITAN GRILL — CONTRATO TÉCNICO TRANSACCIONAL (FASE 0.9)
## DISEÑO Y ESPECIFICACIÓN DETALLADA — READ-ONLY

Este documento establece el **Contrato Técnico Transaccional** definitivo para Titan Grill. Define de forma inequívoca el comportamiento de la base de datos (Supabase/PostgreSQL), la lógica de RLS/RPC, las estructuras de las tablas modificadas y las reglas de negocio acordadas con el propietario para guiar el desarrollo de las fases de implementación sin ambigüedades.

---

## 1. ADMINISTRADORES Y ROLES (PROPIETARIO VS ADMINISTRADOR)

### 1.1 Definición del Rol `PROPIETARIO`
Para mantener un acceso equitativo entre los 3 administradores iniciales sin perder la capacidad de segregar funciones críticas, se adopta la **Opción B: Nivel de Permisos por Columna de Rol en la tabla de Personal**.

Tanto administradores como el dueño de negocio residen en `perfiles_trabajadores` con diferentes valores en la columna `rol`:
- `TRABAJADOR`: Acceso limitado al POS (crear ventas, consultar clientes, registrar sus propios turnos).
- `ADMINISTRADOR`: Acceso completo a la gestión diaria (inventario, recetas, ver estados financieros, liquidar trabajadores, arqueos normales).
- `PROPIETARIO`: Acceso total y exclusivo a operaciones de alto riesgo (anulación definitiva de auditorías, edición de configuración global de fidelización, eliminación física de insumos/productos obsoletos).

### 1.2 Justificación
Es la solución más sencilla, escalable y robusta para PostgreSQL. Permite implementar políticas RLS directas del tipo:
```sql
CREATE POLICY "Solo propietarios pueden modificar la configuración"
ON configuracion_sistema
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM perfiles_trabajadores
    WHERE id = auth.uid() AND rol = 'PROPIETARIO'
  )
);
```

---

## 2. ADMINISTRADORES TAMBIÉN TRABAJAN (DESACOPLE DE IDENTIDAD Y LABOR)

Se establece un desacople estricto entre la **Identidad de Autenticación** y la **Actividad Laboral**:

```text
  auth.users (Identidad física y Credenciales)
       │
       ▼ (1:1)
  perfiles_trabajadores (Rol de acceso y Configuración de nómina)
       │
       ├─► turnos_trabajadores (Actividad laboral / Horas trabajadas)
       ├─► liquidaciones_trabajadores (Pagos generados vs pagados)
       └─► ventas.creado_por (Ventas registradas por esta persona)
```

### 2.1 Reglas del Contrato Técnico:
1. **Registro obligatorio**: Todo administrador que trabaje físicamente debe estar registrado en `perfiles_trabajadores`.
2. **Acceso vs. Liquidación**: Tener rol `ADMINISTRADOR` o `PROPIETARIO` no exime del registro de turnos. Si el administrador genera cobro de nómina, se configura su `modalidad_pago` y `tarifa`. Si no cobra sueldo operativo, su `tarifa` se establece en `0.00` (las horas se registran para auditoría de productividad, pero la liquidación genera `$0`).
3. **Productividad**: Las ventas registradas por un administrador en el POS se asocian a su `auth.uid()`, permitiendo medir métricas de ventas y comisiones si se configuran.

---

## 3. TRABAJADORES Y UX MOBILE-FIRST (DISEÑO DEL POS)

Dado que los trabajadores operan el POS desde sus **propios teléfonos celulares**:
- **Consumo de Red Mínimo**: El POS local en React manejará el estado del carrito en memoria y realizará **una sola llamada HTTP (RPC)** para registrar la transacción. No se realizarán inserts separados en el frontend para evitar ventas huérfanas por desconexión a mitad de camino.
- **Mobile UX**: La interfaz debe diseñarse con layouts de una sola columna colapsable y botones de acción rápida de al menos `48px x 48px` para evitar pulsaciones erróneas.

---

## 4. FIDELIZACIÓN (1 VENTA ELEGIBLE = 1 SELLO)

- **Regla Inmutable**: `1 Venta Elegible = 1 Sello`.
- No hay acumulación por cantidad de ítems. Si la venta califica como elegible, se inserta una única fila en `stamp_logs`.

---

## 5. SELLO MANUAL / CORTESÍA (TRAZABILIDAD TOTAL)

Los sellos extraordinarios (no comerciales) se modelan directamente en la tabla `stamp_logs` mediante la columna `tipo` para evitar la desincronización de saldos.

### 5.1 Estructura en `stamp_logs`:
- `tipo` (`text`, NOT NULL) - Valores: `VENTA`, `REFERIDO`, `MANUAL`, `PROMOCIONAL`.
- `venta_id` (`uuid`, FK -> `ventas.id`, Nullable) - Obligatorio si `tipo = 'VENTA'`.
- `otorgado_por` (`uuid`, FK -> `auth.users.id`, NOT NULL) - Registra qué administrador autorizó el sello (para tipos `MANUAL` y `PROMOCIONAL`).
- `motivo` (`text`, Nullable) - Obligatorio si `tipo = 'MANUAL'`. Describe la justificación (ej. "Publicó en redes sociales").

---

## 6. DEVOLUCIONES Y REVERSIÓN DE SELLOS

### 6.1 Reglas Técnicas de Negocio:
1. **Devolución Parcial**: El sello **se mantiene**. No se modifica `stamp_logs` ni `clientes.stamps_count`.
2. **Devolución Total / Anulación Completa**: El sello **se revierte**.
3. **Mecanismo de Reversión**: Para no romper el historial de auditoría ni generar huecos en los IDs de sellos, **NUNCA** se borra la fila original en `stamp_logs`. En su lugar:
   - Se cambia el estado de la fila original a `estado = 'REVERTIDO'`.
   - Se decrementa transaccionalmente la columna `stamps_count` en la tabla `clientes`.
   - Si el cliente ya había canjeado una recompensa usando ese sello y su saldo queda en negativo, el sistema lo permite temporalmente, marcando un estado de alerta en su perfil.

---

## 7. DEFINICIÓN DE VENTA ELEGIBLE

Una venta califica para otorgar un sello de fidelización si y solo si cumple las siguientes condiciones dentro del RPC de confirmación:

$$	ext{Elegible} = (	ext{cliente\_id} 
eq 	ext{NULL}) \land (	ext{fidelizacion\_aplicada} = 	ext{true}) \land (	ext{estado} = 	ext{'COMPLETADA'}) \land (	ext{total\_neto} \ge 	ext{monto\_minimo\_fidelizacion})$$

### 7.1 Configuración Dinámica
El valor de `monto_minimo_fidelizacion` no se escribe en duro en el código. Se almacena en la tabla `configuracion_sistema` (columna `valor` del registro `monto_minimo_fidelizacion`, por defecto `$10.000`), permitiendo al propietario cambiarlo en el futuro desde la interfaz sin alterar la base de datos.

---

## 8. PAGOS MÚLTIPLES (1 VENTA : N PAGOS)

El POS soporta que una sola transacción se liquide con diferentes métodos de pago.

### 8.1 Relación de Entidades:
```text
  ventas (1) ───► pagos_venta (N) ───► movimientos_caja (N)
```

- Cada fila en `pagos_venta` representa una porción de la transacción imputada a una cuenta financiera.
- **Restricción Transaccional (Constraint)**: El RPC de venta debe verificar bajo transacción que:
  $$\sum (	ext{pagos\_venta.monto}) = 	ext{ventas.total\_neto}$$
  Si la suma no coincide al centavo, la venta completa se aborta (Rollback).

---

## 9. VUELTO / CAMBIO (MODELADO CONTABLE Y DE TESORERÍA)

Cuando el cliente paga en efectivo con un billete de mayor denominación que el total de la venta:
- **POS UX**: Muestra la calculadora de cambio (`Recibido - Total = Cambio`).
- **En `pagos_venta`**: Se almacena la información de auditoría del efectivo entregado:
  - `monto` = Valor neto a ingresar a la caja (ej. `$18.000`).
  - `monto_recibido` = Valor entregado por el cliente (ej. `$20.000`).
  - `monto_cambio` = Vuelto devuelto (ej. `$2.000`).
- **En `movimientos_caja`**: Se registra un único movimiento por el valor NETO ingresado:
  - `monto` = `$18.000`.
- **Justificación**: Esto evita registrar un ingreso ficticio de `$20.000` seguido de un egreso de `$2.000`, simplificando la conciliación de caja de fin de día y manteniendo la veracidad del flujo de caja real.

---

## 10. ARQUEO DE CAJA (EXPECTED VS REAL)

### 10.1 Elección Técnica: **Arqueo Configurable con preferencia "A Ciegas" para Efectivo y "Directo" para Medios Digitales**
- **Justificación**: Para el **Efectivo**, el cajero no debe conocer el saldo teórico del sistema al momento de contar los billetes. Esto evita que el operador "ajuste" el conteo para maquillar faltantes. Para **Nequi** y **Bancolombia**, al ser saldos electrónicos instantáneamente verificables en las apps bancarias, el arqueo es **Directo** (el sistema muestra el saldo esperado para conciliar de forma ágil contra el extracto digital).

### 10.2 Registro de Diferencias:
Cuando el arqueo físico difiere del saldo teórico:
1. Se crea un registro en `arqueos_caja` guardando `monto_sistema`, `monto_declarado` y `diferencia` (sobrante o faltante).
2. Se genera automáticamente un registro en `movimientos_caja` con tipo `AJUSTE_ARQUEO` para cuadrar el saldo contable de la cuenta al valor físico real.
3. Se genera una alerta de alta prioridad en `admin_audit_log` si la diferencia supera el umbral tolerable (configurable, por defecto `$5.000`).

---

## 11. CUENTAS FINANCIERAS DINÁMICAS

Las cuentas de dinero (billeteras, bancos, caja física) no están codificadas de forma rígida en la base de datos ni en el frontend.
- Se crean, activan y desactivan dinámicamente en la tabla `cuentas_financieras`.
- El POS y los módulos de compras/gastos cargan de forma dinámica la lista de cuentas activas para poblar las opciones de pago.

---

## CONFIRMACIÓN DE RESTRICCIONES DE FASE

> NO SE MODIFICÓ CÓDIGO DE LA APLICACIÓN.
> NO SE MODIFICÓ LA BASE DE DATOS DE SUPABASE.
> NO SE CREARON TABLAS NI MIGRACIONES.
> NO SE MODIFICARON RLS NI RPC.
> NO SE REALIZARON COMMITS NI PUSHES EN GIT.

Este documento actúa como el contrato de diseño final (Fase 0.9) para el inicio de las fases de desarrollo.
