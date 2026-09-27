## TRANSFERENCIA GIT — TITAN GRILL

Objetivo: preparar y subir una rama independiente para entregar Titan Grill a otro programador/Claude.

### 1. PRECHECK — SOLO LECTURA

Ejecuta:

* `git status`
* `git branch -vv`
* `git diff --stat`
* `git diff -- newpromt.md src/components/AdminDashboard.jsx src/components/POS.jsx`
* `git ls-files '*.md'`

Revisa qué cambios son parte de la auditoría/remediación D2.1-D2.3 y cuáles son preexistentes.

NO descartes, sobrescribas ni hagas reset de ningún cambio.

### 2. CREAR RAMA

Desde el estado actual crea:

`audit/titan-grill-forensic-handoff`

Cambia a esa rama.

### 3. PREPARAR ENTREGA

La rama debe contener:

* código actual necesario;
* migraciones realizadas;
* `CONTEXTO_GLOBAL_TITAN_GRILL.md`;
* `FASE_D2_1_IMPLEMENTACION_SCHEMA_MIGRACIONES.md`;
* `FASE_D2_2_IMPLEMENTACION_RPC_IDEMPOTENCIA_SNAPSHOT.md`;
* `FASE_D2_3_COMPRAS_TRAZABILIDAD_AJUSTES.md`;
* demás `.md` que sean evidencia directa de esta auditoría.

NO incluir:

* secretos;
* `.env`;
* credenciales;
* archivos temporales;
* builds;
* `node_modules`.

Si `AdminDashboard.jsx`, `POS.jsx` o `newpromt.md` contienen cambios preexistentes, NO eliminarlos. Determina si forman parte del estado funcional actual que debe recibir el nuevo programador y documenta cualquier ambigüedad.

### 4. COMMIT

Antes del commit muestra:

* `git status`
* `git diff --cached --stat`
* `git diff --cached --name-status`

Luego crea UN commit descriptivo:

`chore: prepare forensic audit handoff`

NO hagas otros commits.

### 5. PUSH

Sube únicamente:

`audit/titan-grill-forensic-handoff`

a `origin`.

NO hagas push a `main`.

### 6. VERIFICACIÓN FINAL

Ejecuta:

`git status`
`git branch -vv`
`git log -1 --oneline`
`git ls-tree -r --name-only HEAD`

Confirma:

* rama actual;
* commit creado;
* push exitoso;
* rama remota;
* archivos incluidos;
* que `main` no fue modificado.

NO modificar Supabase.
NO ejecutar migraciones.
NO hacer cambios funcionales.
STOP.

ENTREGA FINAL:
Indica exactamente:

Rama:
Commit:
Remote:
Push:
Estado:
Archivos relevantes incluidos:
Archivos deliberadamente excluidos:
