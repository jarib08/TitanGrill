# Migraciones que NO deben aplicarse

## `20261005_j1_1_fecha_corte_confiabilidad.sql`

**Estado: obsoleta. No aplicar.**

Creaba `configuracion_sistema` y las funciones `fn_fecha_corte_confiabilidad()`
y `actualizar_fecha_corte_confiabilidad(date)` para marcar como no confiables
los datos anteriores al 1 de octubre de 2026 (COGS incompleto, arqueos sin
conteo ciego, inventario sin movimientos de origen).

Quedó sin propósito el **22 de octubre de 2026**, cuando el reset operativo
eliminó precisamente esos datos: no queda nada anterior que marcar. La
operación arrancó de cero con el libro de inventario vacío y el COGS
registrándose correctamente desde la primera venta.

Se conserva por dos razones: documenta el diseño, y el patrón de
`configuracion_sistema` (clave-valor con RLS y escritura solo vía RPC) puede
reutilizarse si más adelante hace falta configuración persistente.

Además, su etiqueta `j1_1` colisiona con `20261025_j1_1_membresia_aneiap.sql`,
que sí está aplicada en producción. Si alguna vez se recupera algo de este
archivo, hay que renumerarlo.
