# Auditoría Forense: Transferencias Internas y Resultado Operativo Neto

## 1. Movimiento Real Encontrado
Se encontró el movimiento reportado en la base de datos `movimientos_caja`.
Al realizar una transferencia interna de EFECTIVO a BANCOLOMBIA, el sistema creó dos registros el 08 de septiembre de 2026:
- Un registro de **Salida**: `tipo: 'EGRESO'`, `monto: 115999`, `metodo_pago: 'EFECTIVO'`, `tipo_operacion: 'TRANSFERENCIA_INTERNA'`.
- Un registro de **Entrada**: `tipo: 'INGRESO'`, `monto: 115999`, `metodo_pago: 'BANCOLOMBIA'`, `tipo_operacion: 'TRANSFERENCIA_INTERNA'`.

## 2. Cómo está almacenado
Ambos movimientos se almacenan en la tabla `movimientos_caja`. Se identifican claramente porque su campo `tipo_operacion` tiene el valor `"TRANSFERENCIA_INTERNA"`. Adicionalmente, el registro negativo tiene `tipo = 'EGRESO'` y no está asociado a ningún `gasto_id`, `compra_id` ni `liquidacion_id`.

## 3. Flujo actual del dato
1. El movimiento se crea desde la interfaz y se inserta en `movimientos_caja`.
2. El componente `AdminDashboard.jsx` descarga toda la lista de movimientos y los almacena en el estado `movementsList` global y también los procesa dentro de `fetchDashboardMetrics` (para métricas del periodo).
3. Los módulos de Dashboard y Rentabilidad usan estos arrays para calcular sumatorias.

## 4. Dónde se convierte incorrectamente en egreso/gasto
En `AdminDashboard.jsx` (líneas ~4038-4060 y ~4104), el cálculo de **Otros Egresos de Caja** es el siguiente:
```javascript
const otrosEgresos = movementsList
  .filter(m => m.tipo === 'EGRESO' && !m.compra_id && !m.gasto_id && !m.liquidacion_id)
  .reduce((sum, m) => sum + Number(m.monto || 0), 0);
```
Como la transferencia es un `EGRESO` y no tiene ids de compra/gasto/nómina, la fórmula asume que es un gasto genérico ("Otro Egreso"), sumándolo a los Gastos Operativos.

## 5. Impacto en Caja
Ninguno negativo. En la vista de Caja de Movimientos, aparece como salida de efectivo y entrada a Bancolombia, lo cual es correcto para mantener los saldos cuadrados.

## 6. Impacto en Dashboard
El indicador **"Total Egresado"** suma incondicionalmente todos los movimientos con `tipo === 'EGRESO'`. Esto significa que si transfieres $1.000.000 de Efectivo a Nequi, el Dashboard mostrará $1.000.000 más en "Total Egresado" y $1.000.000 más en "Total Ingresado", inflando el flujo de caja del negocio. Debería excluir `tipo_operacion === 'TRANSFERENCIA_INTERNA'`.

## 7. Impacto en Finanzas
El módulo de Rentabilidad lo suma incorrectamente a la métrica de **"Total Gastos Operativos"** y **"Otros Egresos de Caja"**.

## 8. Impacto en Estado de Resultados
El **Resultado Operativo Neto** se ve reducido artificialmente por el valor de la transferencia interna, mostrando una pérdida que no existe operativamente.

## 9. Cantidad de transferencias históricas afectadas
Actualmente existe **1** transferencia interna registrada bajo este concepto en la base de datos. 

## 10. Cálculo del impacto
- **Utilidad Bruta**: $97.397
- **Nómina y Liquidaciones Pagadas**: -$40.000
- **Gastos Operativos Registrados**: $0
- **Otros Egresos de Caja (con el error)**: -$115.999
- **Resultado Operativo Neto Actual**: -$58.602

Al corregir el error excluyendo la transferencia:
- **Otros Egresos de Caja (Corregido)**: $0
- **Resultado Operativo Neto (Corregido)**: $97.397 - $40.000 = **$57.397** (Diferencia de $115.999 a favor del negocio).

## 11. Causa raíz
Los filtros en el frontend (`AdminDashboard.jsx`) asumen implícitamente que "todo `EGRESO` sin relación a compra/gasto/nómina es un gasto", olvidando que existe el `tipo_operacion === 'TRANSFERENCIA_INTERNA'`.

## 12. Solución recomendada
Modificar `AdminDashboard.jsx` en tres lugares clave para agregar explícitamente `m.tipo_operacion !== 'TRANSFERENCIA_INTERNA'`:
1. En el cálculo de `otrosEgresos` en la tarjeta de **Total Gastos Operativos**.
2. En el cálculo de `otrosEgresos` en la tarjeta de **Utilidad Neta Operativa**.
3. En el cálculo de `otrosEgresos` en la tabla del **Estado de Resultados Consolidado**.
4. En `fetchDashboardMetrics`, actualizar el cálculo global de `totalIngresos` y `totalEgresos` del objeto `cashStats` para ignorar transferencias internas y no inflar el volumen de ingresos/gastos globales.

## 13. Archivos/componentes involucrados
- `src/components/AdminDashboard.jsx`

## 14. RPC/queries involucradas
Ninguna. Es un error puramente de agregación de datos (reducción de arrays) en el frontend. La base de datos guarda los registros correctamente.

## 15. Riesgos de implementar la solución
- **Saldos de Caja:** Es vital que al ajustar `fetchDashboardMetrics` solo se excluyan las transferencias del `totalIngresos` y `totalEgresos` globales, pero **NO** de `efectivoIngresos`, `efectivoEgresos`, `nequiIngresos`, etc., porque eso rompería los saldos individuales ("Efectivo Neto").
- **Egresos Reales Anónimos:** Si algún gasto real se guardó sin `gasto_id` y además sin `tipo_operacion` (vacío o nulo), al añadir la cláusula explícita `!== 'TRANSFERENCIA_INTERNA'` no se vería afectado (seguirá contando como gasto), por lo que es una corrección segura.

## 16. Plan de corrección
1. Identificar cada `reduce` y `filter` en `AdminDashboard.jsx` que define `otrosEgresos` dentro del tab `rentabilidad`.
2. Agregar la condición `m.tipo_operacion !== 'TRANSFERENCIA_INTERNA'`.
3. Ajustar `totalIngresos` y `totalEgresos` dentro de `fetchDashboardMetrics` agregando la misma condición.
4. No tocar los cálculos de `efectivoIngresos` ni los saldos individuales por cuenta.

## 17. Plan de pruebas posterior
- Ir a Dashboard: "Total Ingresado" y "Total Egresado" deberían bajar en $115.999.
- Ir a Rentabilidad: "Total Gastos Operativos" debe mostrar $40.000.
- Ir a Rentabilidad: "Resultado Operativo Neto" debe mostrar $57.397.
- Ir a la tarjeta de Efectivo Neto / Bancolombia en Dashboard para verificar que los saldos siguen reflejando el movimiento correctamente.

VEREDICTO FINAL:
PASS — CAUSA RAÍZ IDENTIFICADA
