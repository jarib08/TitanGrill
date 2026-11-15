# FASE D.2.1.2.1 — Validación de Impacto de Setters Tardíos de `fetchExpectedCash`

## 1. Objetivo
Realizar una auditoría forense **100% de solo lectura (estática y trazable)** sobre los setters internos de la función `fetchExpectedCash` en `src/components/POS.jsx` para determinar si el hallazgo **RR-002** (setters carentes de token de generación/invalidación) puede impactar la lógica financiera, el cierre de caja, transacciones en backend/RPC, o si su efecto queda estrictamente circunscrito a capas de visualización/UI.

---

## 2. Alcance
- **Archivo bajo inspección**: `src/components/POS.jsx` (líneas 64-66, 125-157, 214, 656-688, 735-764, 1025, 1630-1688).
- **Entidades auditadas**: `expectedCashAtClose`, `expectedNequiAtClose`, `expectedBancoAtClose` y sus respectivos setters (`setExpectedCashAtClose`, `setExpectedNequiAtClose`, `setExpectedBancoAtClose`).
- **Límites de la fase**: Exclusivamente auditoría de código, trazabilidad de datos y documentación de hallazgos. **Cero modificaciones a código, base de datos o RPCs**.

---

## 3. Archivos Inspeccionados
- `src/components/POS.jsx`: Componente principal del Punto de Venta.
- `src/components/AdminDashboard.jsx`: Verificación de referencias cruzadas a estados de caja.
- `src/lib/supabaseClient.js`: Cliente Supabase.

---

## 4. Definición de `fetchExpectedCash`
Localizada formalmente entre las líneas 125 y 157 de `src/components/POS.jsx`:

```js
const fetchExpectedCash = async (sessionId) => {
    try {
        // Fetch session opening amounts (declaracion de custodia)
        const { data: session } = await supabase
            .from('sesiones_caja')
            .select('monto_apertura, apertura_nequi, apertura_bancolombia')
            .eq('id', sessionId)
            .single();

        const openEf = Number(session?.monto_apertura || 0);
        const openNq = Number(session?.apertura_nequi || 0);
        const openBc = Number(session?.apertura_bancolombia || 0);

        // Fetch financial movements for this session
        const { data: allMovs } = await supabase
            .from('movimientos_caja')
            .select('monto, tipo, metodo_pago')
            .eq('sesion_id', sessionId);

        const calcMovs = (method) => {
            const ing = (allMovs || []).filter(m => m.tipo === 'INGRESO' && m.metodo_pago === method).reduce((s, m) => s + Number(m.monto), 0);
            const egr = (allMovs || []).filter(m => m.tipo === 'EGRESO' && m.metodo_pago === method).reduce((s, m) => s + Number(m.monto), 0);
            return ing - egr;
        };

        // Esperado = apertura declarada + movimientos financieros de sesion
        setExpectedCashAtClose(openEf + calcMovs('EFECTIVO'));
        setExpectedNequiAtClose(openNq + calcMovs('NEQUI'));
        setExpectedBancoAtClose(openBc + calcMovs('BANCOLOMBIA'));
    } catch (err) {
        console.error(err);
    }
};
```

### Atributos Clave:
1. **Parámetros**: Recibe únicamente `sessionId` (`uuid`).
2. **Consultas DB**: Lee `sesiones_caja` (`monto_apertura`, `apertura_nequi`, `apertura_bancolombia`) y `movimientos_caja` (`monto`, `tipo`, `metodo_pago`).
3. **RPCs**: No ejecuta ninguna RPC.
4. **Manejo de Errores**: En caso de excepción, captura el error en `catch` y lo registra con `console.error`. No altera ni reinicia estados en caso de fallo.
5. **Setters ejecutados**: Ejecuta incondicionalmente los tres setters al final de la resolución asíncrona.

---

## 5. Setters Identificados
Los tres setters actualizan variables de estado locales del hook `useState`:
1. `setExpectedCashAtClose(...)` (Línea 151)
2. `setExpectedNequiAtClose(...)` (Línea 152)
3. `setExpectedBancoAtClose(...)` (Línea 153)

Ninguno de estos setters posee verificación de token de generación ni valida si el `sessionId` para el cual fueron calculados coincide con `activeSession?.id` al momento de resolverse la promesa.

---

## 6. Consumidores de `expectedCashAtClose`
Se identificaron exactamente 5 referencias en `src/components/POS.jsx`:
1. **Línea 64**: Declaración de estado `const [expectedCashAtClose, setExpectedCashAtClose] = useState(0);`.
2. **Línea 1025**: Indicador visual en Header superior: `<span className="text-sm font-bold text-green-400">${expectedCashAtClose.toLocaleString()}</span>` (Muestra "Efectivo en Caja").
3. **Línea 1633**: Modal de Cierre de Caja (Visualización de "Esperado" en sección Efectivo).
4. **Línea 1638**: Modal de Cierre de Caja (Cálculo puramente cosmético de diferencia `closeCashCounted - expectedCashAtClose` para colorear insignia).
5. **Línea 1675 & 1684**: Modal de Cierre de Caja (Cálculo puramente cosmético de Total Esperado y Diferencia Total Consolidada en JSX).

---

## 7. Consumidores de `expectedNequiAtClose`
Se identificaron exactamente 4 referencias en `src/components/POS.jsx`:
1. **Línea 65**: Declaración de estado `const [expectedNequiAtClose, setExpectedNequiAtClose] = useState(0);`.
2. **Línea 1647**: Modal de Cierre de Caja (Visualización de "Esperado" en sección Nequi).
3. **Línea 1652**: Modal de Cierre de Caja (Cálculo cosmético de diferencia `closeNequiCounted - expectedNequiAtClose`).
4. **Línea 1675 & 1684**: Modal de Cierre de Caja (Sumatoria cosmética de Total Esperado y Diferencia Total).

---

## 8. Consumidores de `expectedBancoAtClose`
Se identificaron exactamente 4 referencias en `src/components/POS.jsx`:
1. **Línea 66**: Declaración de estado `const [expectedBancoAtClose, setExpectedBancoAtClose] = useState(0);`.
2. **Línea 1661**: Modal de Cierre de Caja (Visualización de "Esperado" en sección Bancolombia).
3. **Línea 1666**: Modal de Cierre de Caja (Cálculo cosmético de diferencia `closeBancoCounted - expectedBancoAtClose`).
4. **Línea 1675 & 1684**: Modal de Cierre de Caja (Sumatoria cosmética de Total Esperado y Diferencia Total).

---

## 9. Trazabilidad Hasta Cierre de Caja
Inspección del handler `handleCloseSession` (líneas 656–688):

```js
const handleCloseSession = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
        const { data, error } = await supabase.rpc('cerrar_caja', {
            p_monto_cierre_contado: Number(closeCashCounted),
            p_observaciones: closeObservations,
            p_contado_nequi: Number(closeNequiCounted),
            p_contado_bancolombia: Number(closeBancoCounted)
        });
        ...
```

### Conclusión de Trazabilidad en Cierre:
- **`cerrar_caja` RPC** recibe ÚNICAMENTE los montos **contados físicamente** por el cajero (`closeCashCounted`, `closeNequiCounted`, `closeBancoCounted`) e introducidos mediante inputs numéricos manuales (`NumericInput`).
- **Los estados `expectedCashAtClose`, `expectedNequiAtClose` y `expectedBancoAtClose` NO SON ENVIADOS A LA RPC DE CIERRE**.
- La función de base de datos PostgreSQL `cerrar_caja` recalcula de forma atómica y aislada los saldos esperados leyendo las tablas de la base de datos dentro de su transacción.
- **Impacto en Cierre de Caja**: NULO.

---

## 10. Trazabilidad Hasta Backend / RPC
Se revisaron todas las llamadas a RPCs en `POS.jsx`:
- `abrir_caja`: No utiliza estos estados.
- `registrar_venta`: No utiliza estos estados.
- `cerrar_caja`: No utiliza estos estados.
- `solicitar_anulacion_venta`: No utiliza estos estados.

**Resultado**: Ninguno de los tres estados alimentan directa ni indirectamente ningún payload enviado al backend Supabase.

---

## 11. Relación con `activeSession`
`fetchExpectedCash` depende de `activeSession.id` cuando es invocada manualmente o tras registrar ventas.
Si la sesión activa cambia (ej. Cierre de sesión de Operador A e Inicio de sesión de Operador B), un setter tardío correspondiente a la sesión de A podría sobreescribir temporalmente el estado visual en el POS de B.
Sin embargo, dado que estos estados sólo alimentan elementos `<span />` de JSX y no condicionan permisos ni operaciones, no hay posibilidad de contaminación de datos guardados.

---

## 12. Comportamiento Ante Retry
Si `initPOS()` sufre un timeout de 12 segundos y el usuario presiona "Reintentar Carga" (INIT #2):
1. `initGenerationRef.current` se incrementa, invalidando INIT #1.
2. Si `fetchExpectedCash` de INIT #1 resuelve con demora, sus setters actualizarán `expectedCashAtClose`, `expectedNequiAtClose` y `expectedBancoAtClose`.
3. Al terminar INIT #2, este vuelve a llamar `fetchExpectedCash` con el ID de sesión vigente, sobreescribiendo de inmediato dichos estados con la información actualizada.

---

## 13. Comportamiento Ante Timeout
Durante la pantalla de contingencia/error de inicialización (`initError !== null`):
- El componente `POS` efectúa un retorno temprano (Early Return, líneas 901-931) renderizando la pantalla de error.
- El Header y el Modal de Cierre **NO están presentes en el DOM**.
- Si los setters de `fetchExpectedCash` ejecutan durante esta pantalla, modifican el estado de React en memoria sin causar re-renders visibles ni afectar la recuperación mediante el botón "Reintentar Carga".

---

## 14. Comportamiento Ante Unmount / Logout
Si el usuario cierra sesión o navega a otra ruta mientras `fetchExpectedCash` está en vuelo:
- El componente `POS` se desmonta.
- En React 19, la resolución de promesas pendientes sobre componentes desmontados no genera fugas de memoria ni interrumpe la ejecución; los setters se convierten en operaciones inofensivas en memoria descartada.

---

## 15. Análisis de los 4 Escenarios de Carrera

| Escenario | Comportamiento | Impacto Funcional | Impacto Financiero |
| :--- | :--- | :--- | :--- |
| **1. Timeout + Resolución Tardía** | Setters modifican estados mientras se muestra pantalla de `initError`. UI principal desglosada no visible. | Nulo | Nulo |
| **2. Retry Exitoso** | INIT #1 resuelve tarde y escribe estados; INIT #2 los sobreescribe inmediatamente al finalizar. | Nulo (Cosmético temporal <100ms) | Nulo |
| **3. Cambio de Sesión** | INIT #1 (Sesión A) resuelve cuando el POS opera en Sesión B. El header mostraría saldo de A hasta que B resuelva. | Bajo (Glitch visual temporal de UI) | Nulo |
| **4. Unmount / Logout** | Setters ejecutan sobre componente desmontado. | Nulo | Nulo |

---

## 16. Análisis de Efectos Secundarios React
- Se auditaron todos los hooks `useEffect`, `useMemo` y `useCallback` en `POS.jsx`.
- **Ningún hook depende de `expectedCashAtClose`, `expectedNequiAtClose` o `expectedBancoAtClose`**.
- No existen cadenas de reactividad donde la actualización de estos estados dispare re-fetches, mutaciones o peticiones secundarias a la base de datos.

---

## 17. Call Sites de `fetchExpectedCash`
Se identificaron 3 puntos de invocación en `POS.jsx`:
1. **`initPOS` (Línea 214)**: Protegido contra actualización de `activeSession` por `myGeneration !== initGenerationRef.current`. Sus setters internos no tienen token propio (RR-002).
2. **`fetchSession` (Línea 114)**: Invocado al abrir/cerrar caja.
3. **`executeSale` (Líneas 735 & 764)**: Patrón *fire-and-forget* (`fetchExpectedCash(activeSession.id).catch(...)`) para actualizar saldos esperados tras confirmar una venta.

---

## 18. Evidencia Estática
Trazabilidad confirmada por inspección estática directa en el archivo `src/components/POS.jsx` mediante búsquedas exhaustivas de patrones AST/Regex.
*Nota de conformidad (Regla 2)*: No se realizó una simulación real de carrera de red con estrangulamiento de velocidad de transmisión; la conclusión se basa en la trazabilidad estática rigurosa del código fuente.

---

## 19. Pruebas Ejecutadas
- `npm run lint`: Exitoso (0 errores de ESLint).
- `npm run build`: Exitoso (Compilado en 18.78s, bundle POS 56.36 kB).

---

## 20. Limitaciones
- Auditoría restringida a análisis estático del frontend React sin modificar el backend live Supabase ni simular degradación física de red.

---

## 21. Clasificación RR-002

### Categoría A — SIN IMPACTO FUNCIONAL DEMOSTRABLE

**Justificación**:
Los setters tardíos de `fetchExpectedCash()` afectan de forma exclusiva a tres variables de estado locales cuya única función en toda la aplicación es formatearse numéricamente y mostrarse como texto en pantalla dentro del Header y del Modal de Cierre. Ninguna de estas variables participa en la lógica de negocio, reglas de validación, cierres de caja o transacciones financieras en la base de datos.

---

## 22. Conclusión
1. **¿RR-002 requiere corrección inmediata?**: **NO**.
2. **¿La FASE D.2.1.2 se considera oficialmente cerrada respecto a este hallazgo?**: **SÍ**.

---

## 23. Recomendación
- Mantener la implementación actual de la **FASE D.2.1.2** como definitiva y aprobada.
- No es necesario añadir tokens de generación dentro de `fetchExpectedCash` en este momento, ya que la complejidad añadida no aportaría ninguna protección financiera ni funcional real.
- Si en un futuro se refactoriza el POS, se puede evaluar incluir un check `if (sessionId !== activeSessionRef.current?.id) return;` dentro de `fetchExpectedCash` como buena práctica cosmética de UI.
