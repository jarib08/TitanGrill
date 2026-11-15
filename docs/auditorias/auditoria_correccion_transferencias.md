# Auditoría — Corrección Transferencias Internas

## Causa raíz
Los filtros en `AdminDashboard.jsx` asumían que todo movimiento con `tipo === 'EGRESO'` sin `compra_id`, `gasto_id` o `liquidacion_id` era un gasto operativo real. Las transferencias internas (`tipo_operacion === 'TRANSFERENCIA_INTERNA'`) no estaban excluidas, inflando artificialmente los gastos y reduciendo el Resultado Operativo Neto.

## Solución aplicada
Se agregó `m.tipo_operacion !== 'TRANSFERENCIA_INTERNA'` en 5 puntos:
1. `fetchDashboardMetrics` → `totalIngresos` (línea 1103)
2. `fetchDashboardMetrics` → `totalEgresos` (línea 1104)
3. KPI "Total Gastos Operativos" → `otrosEgresos` (línea 4040)
4. KPI "Utilidad Neta Operativa" → `otrosEgresos` (línea 4058)
5. Estado de Resultados → display "Otros Egresos de Caja" (línea 4105)
6. Estado de Resultados → cálculo "Resultado Operativo Neto" (línea 4110)

## Archivos modificados
- `src/components/AdminDashboard.jsx` (6 líneas cambiadas)

## Validación de datos (solo lectura)
La transferencia histórica de $115.999 permanece intacta:
- EFECTIVO: EGRESO $115.999, tipo_operacion = TRANSFERENCIA_INTERNA ✅
- BANCOLOMBIA: INGRESO $115.999, tipo_operacion = TRANSFERENCIA_INTERNA ✅

## Validación matemática
- Utilidad Bruta: $97.397
- Nómina: -$40.000
- Transferencia (ahora excluida): $115.999
- Resultado Operativo Neto correcto: $97.397 - $40.000 = **$57.397** ✅
- (Antes mostraba erróneamente: -$58.602)

## Lint
`npm run lint` → exit code 0 ✅

## Build
`npm run build` → exit code 0 ✅

## Resultado del diff
Solo cambios en `AdminDashboard.jsx` (6 líneas, condición `!== 'TRANSFERENCIA_INTERNA'`). Sin archivos funcionales inesperados.

## Riesgos/regresiones revisadas
- Saldos individuales (Efectivo, Nequi, Bancolombia): NO afectados — los cálculos por cuenta (`efectivoIngresos`, `efectivoEgresos`, etc.) no fueron tocados.
- Ventas, compras, gastos reales, nómina, inventario: NO afectados.
- Un EGRESO real sin `tipo_operacion` o con valor distinto a `TRANSFERENCIA_INTERNA` sigue contabilizándose normalmente.
