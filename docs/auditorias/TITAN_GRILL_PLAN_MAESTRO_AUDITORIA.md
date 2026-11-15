# TITAN GRILL — PLAN MAESTRO DE AUDITORÍA FORENSE DEFINITIVO

Este documento establece el flujo de ejecución estricto para realizar la auditoría forense del sistema Titan Grill.

## FASES DE AUDITORÍA

Se determina que la auditoría debe seguir el orden lógico del flujo del ciclo de vida del dato.

- **FASE A — POS / ABRIR CAJA**
- **FASE B — DASHBOARD**
- **FASE C — INVENTARIO**
- **FASE D — CAJA Y ARQUEO**
- **FASE E — VENTAS**
- **FASE F — CLIENTES / FIDELIZACIÓN**
- **FASE G — TRABAJADORES**
- **FASE H — RENTABILIDAD / FINANZAS**
- **FASE I — GASTOS OPERATIVOS**
- **FASE J — ANALÍTICA PARETO**
- **FASE K — LIQUIDACIONES STAFF**
- **FASE L — PRODUCTOS / MENÚ**
- **FASE M — CONFIGURACIÓN**
- **FASE N — MOTOR TRANSACCIONAL**
- **FASE O — AUDITORÍA TRANSVERSAL**
- **FASE P — RECONCILIACIÓN FINANCIERA GLOBAL**

## COMPOSICIÓN DE CADA FASE

Cada módulo debe documentarse exhaustivamente al inicio de su auditoría con los siguientes campos:

1. **Objetivo**: Propósito de la auditoría de ese módulo.
2. **Archivos/componentes a revisar**: Archivos clave `.jsx`, `.js` involucrados.
3. **Tablas**: Entidades de Supabase utilizadas.
4. **RPC**: Lógica ejecutada en Supabase.
5. **Functions**: Funciones de BD.
6. **Triggers**: Efectos secundarios (ej. Referidos).
7. **RLS**: Qué puede hacer Worker vs Admin.
8. **Reglas de negocio**: Qué se asume verdadero.
9. **Impacto financiero**: Aumenta/Disminuye utilidades.
10. **Impacto de caja**: Aumenta/Disminuye flujos de caja.
11. **Impacto de inventario**: Suma o resta al Kardex.
12. **Dependencias con otros módulos**: Conexiones a otros módulos (Fidelización -> Ventas, Ventas -> Caja).
13. **Riesgos de doble contabilización**: Qué podría sumar x2 en caso de errores de concurrencia.
14. **Riesgos de concurrencia**: Peligros ante conexiones lentas / doble click.
15. **Casos extremos**: Datos faltantes, montos negativos o valores absurdos.
16. **Browser/E2E no destructivo**: Validaciones visuales y de network en UI.
17. **Queries READ-ONLY**: Ejercicios de verificación de los datos de la DB vs lo esperado.
18. **Reconciliaciones**: Comparaciones (Totales Front vs Totales DB).
19. **Evidencia requerida**: Lo documentado en cada etapa.
20. **Criterios PASS**: El módulo cumple las garantías necesarias.
21. **Criterios FAIL**: El módulo pone en riesgo las operaciones (Financieras/Dato Corrupto).
22. **Entregable**: Ficha final del módulo.

## REGLAS DE ORO
1. **SOLO LECTURA:** No se ejecutará ningún UPDATE, INSERT, DELETE ni ALTER en bases de datos. No se modificará el código funcional (JavaScript/Supabase).
2. **DOCUMENTAR, NO CORREGIR:** Se registrarán los hallazgos en forma de ticket (ID, Severidad, Riesgo, Recomendación).
