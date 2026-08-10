# TITAN GRILL — CIERRE DE DECISIONES DE SEGURIDAD E INTEGRIDAD (FASE 1.1)
## ESPECIFICACIÓN DETALLADA DE REGLAS DE NEGOCIO — READ-ONLY

Este documento establece el cierre definitivo de las decisiones de la Fase 1.1 sobre el modelo de fidelización y los roles de seguridad de Titan Grill.

---

## 1. DECISIÓN 1 — MODELO DE HISTORIAL Y SALDO DE SELLOS

Se establece que la tabla `stamp_logs` (historial de eventos) es la **única fuente de verdad** del saldo del cliente. La columna `clientes.stamps_count` actuará como una proyección caché sincronizada por trigger para mantener compatibilidad con el frontend actual.

### 1.1 Ecuación de Cálculo del Saldo Neto
El saldo neto del cliente se deriva del histórico mediante la siguiente fórmula:

$$	ext{Saldo Neto} = \sum (	ext{stamp\_logs.valor}) - \sum (	ext{redemptions.stamps\_exchanged})$$

Donde:
- `stamp_logs.valor` es un entero que puede ser `+1` (otorgado) o `-1` (reversión).
- `redemptions.stamps_exchanged` es siempre `10` (por canje).

---

### 1.2 Simulación de Casos Obligatorios

#### Caso A: Cliente sin sellos
- `stamp_logs`: 0 registros.
- `redemptions`: 0 registros.
- **Saldo Neto**: 0.

#### Caso B: 1 venta elegible
- Se inserta 1 log: `tipo = 'VENTA'`, `valor = 1`.
- **Saldo Neto**: 1.

#### Caso C: 3 productos en una sola venta elegible
- Se inserta 1 log (1 venta elegible = 1 sello): `tipo = 'VENTA'`, `valor = 1`.
- **Saldo Neto**: 1. (Confirmado: no se acumula por ítem).

#### Caso D: Sello por referido
- Se inserta 1 log: `tipo = 'REFERIDO'`, `valor = 1`.
- **Saldo Neto**: 1.

#### Caso E: Sello manual/promocional
- Se inserta 1 log: `tipo = 'MANUAL'`, `valor = 1`, con `motivo` y `otorgado_por` poblados.
- **Saldo Neto**: 1.

#### Caso F: Venta anulada / Reversión
- La venta se anula. El log original de la venta se mantiene intacto.
- Se inserta un nuevo log: `tipo = 'REVERSION'`, `valor = -1`, `venta_id = [ID_VENTA]`, `estado = 'ACTIVO'`.
- **Saldo Neto**: El sello original y el de reversión se cancelan mutuamente. El evento histórico se conserva para auditoría.

#### Caso G: Devolución parcial
- El cliente devuelve solo una parte de los ítems de la venta.
- **Saldo Neto**: El sello permanece intacto. No se genera log de reversión.

#### Caso H: Devolución total
- Se inserta un log de reversión: `tipo = 'REVERSION'`, `valor = -1`.
- **Saldo Neto**: El sello se descuenta del balance.

#### Caso I: Canje de recompensa (Redemption)
- El cliente tiene 10 sellos y decide reclamar un premio.
- Se inserta un registro en la tabla `redemptions` con `stamps_exchanged = 10`.
- El balance disminuye en 10. El canje es un evento financiero y operativo separado que no altera la tabla `stamp_logs`.

---

### 1.3 Caso J: Reversión de Sello Post-Canje (Prevención de Negativos)

#### El Escenario de Riesgo
Un cliente acumula 10 sellos, los canjea (su saldo baja a 0), y posteriormente se anula la venta que originó uno de esos sellos.
Si restamos el sello, la ecuación daría:

$$	ext{Saldo} = 9 	ext{ (ganados)} - 10 	ext{ (canjeados)} = -1$$

Para evitar mostrar números negativos en el frontend que confundan al cliente, se adopta la **Estrategia de Deuda Amortizable**:

1. **La columna `clientes.stamps_count` se calcula como**:
   $$	ext{stamps\_count} = \max(0, 	ext{Earned} - 	ext{Spent})$$
   Así, el contador visual en la tarjeta del cliente **nunca será menor que 0**.

2. **Se introduce la columna `clientes.stamps_debt` (deuda de sellos)**:
   $$	ext{stamps\_debt} = \max(0, 	ext{Spent} - 	ext{Earned})$$
   Esta columna almacena de forma invisible cuántos sellos "debe" el cliente al sistema debido a cancelaciones post-canje.

3. **Amortización en compras futuras**:
   Cuando el cliente realiza una nueva compra elegible:
   - Si `stamps_debt > 0`: Se reduce la deuda en 1 (`stamps_debt = stamps_debt - 1`) y **no** se incrementa `stamps_count` (se consume el sello para pagar la deuda). Se registra en `stamp_logs` como `tipo = 'PAGO_DEUDA'`.
   - Si `stamps_debt = 0`: Se suma el sello a `stamps_count` normalmente.

*Ventaja*: Evita inconsistencias de saldos negativos visibles, bloquea la duplicación de recompensas y permite auditar canjes sin perder el historial.

---

## 2. DECISIÓN 2 — ROLES DE SEGURIDAD (CONTRATO SIMPLIFICADO)

Se unifica el modelo de seguridad en 2 roles operativos y 1 flag administrativo especial.

```text
  perfiles_trabajadores.rol (Afecta permisos RLS de Supabase)
  ├── ADMINISTRADOR: Acceso completo a inventario, recetas, caja, personal.
  └── TRABAJADOR: Acceso limitado al POS (crear ventas y turnos).

  Flag especial: perfiles_trabajadores.es_socio (Boolean)
  └── true: Permite acceso a configuración del sistema y anulación de logs.
```

### 2.1 Justificación
Simplifica la estructura de roles a nivel de RLS. No requiere la creación de un tercer rol `PROPIETARIO` que sobrecargue el código. Los 3 socios administradores tendrán `rol = 'ADMINISTRADOR'` y `es_socio = true`, permitiendo una segregación limpia de tareas críticas en Supabase.

---

## CONFIRMACIÓN DE RESTRICCIONES DE FASE

> NO SE MODIFICÓ CÓDIGO DE LA APLICACIÓN.
> NO SE MODIFICÓ LA BASE DE DATOS DE SUPABASE.
> NO SE CREARON TABLAS NI MIGRACIONES.
> NO SE MODIFICARON RLS NI RPC.
> NO SE REALIZARON COMMITS NI PUSHES EN GIT.

Este documento de cierre de decisiones (Fase 1.1) queda listo para guiar las fases de implementación técnica.
