# FASE 50B — REVISIÓN PREVIA A PUBLICACIÓN DE LA RAMA DE CONTINUIDAD

## Objetivo

Revisar el resultado de la FASE 50A y preparar una lista exacta, segura y reproducible de los archivos que se publicarán en GitHub para que otro desarrollador pueda continuar Titan Grill.

Repositorio: `E:\Documents\titan_grill`

Rama de trabajo esperada: `audit/titan-grill-forensic-handoff`

HEAD histórico de referencia: `ec72b28ff6178a788e4aa0c9f53aa1db82b5c0f7`

Rama propuesta: `handoff/titan-grill-continuidad-tecnica`

Documento de continuidad: `TRASPASO_TECNICO_TITAN_GRILL.md`

## A. Restricciones obligatorias

1. Realizar únicamente inspección de solo lectura.
2. No ejecutar `git checkout`, `git switch`, `git branch` para crear ramas, `git add`, `git commit`, `git push`, `git pull`, `git reset`, `git clean`, `git restore` ni `git stash`.
3. No modificar, sobrescribir, mover ni eliminar ningún archivo.
4. No modificar `newpromt.md`: es un archivo editable intencional del propietario.
5. No ejecutar SQL, migraciones, RPC, pruebas que modifiquen datos ni operaciones remotas.
6. No ejecutar scripts que puedan conectarse a producción.
7. No mostrar secretos, tokens, contraseñas, claves privadas ni valores sensibles.
8. No asumir que el estado de Git, el contenido de los archivos o la rama actual coincide con informes históricos: verificarlo localmente.
9. Detenerse si la revisión exige una operación no permitida.

## B. Verificar el estado actual

Ejecutar y registrar, sin alterar el repositorio:

- `git branch --show-current`
- `git rev-parse HEAD`
- `git status --short`
- `git diff --stat`
- `git diff -- newpromt.md`
- `git ls-files`
- `git remote -v`, mostrando únicamente el nombre del remoto y su host; no divulgar credenciales embebidas en URL.
- Comprobar si existe `TRASPASO_TECNICO_TITAN_GRILL.md` y registrar su tamaño.
- Comprobar si ya existe la rama local propuesta, sin crearla.

No afirmar que el árbol está limpio si hay modificaciones o archivos sin seguimiento.

## C. Revisar el documento de continuidad

Leer `TRASPASO_TECNICO_TITAN_GRILL.md` y comprobar:

- Que diferencie código confirmado, pruebas reproducibles, documentación histórica, inferencias y asuntos no demostrados.
- Que las 20/20 pruebas se describan con el alcance real que pueda verificarse.
- Que no se afirme que I1.4 está aplicada en producción sin evidencia directa.
- Que las tres decisiones de negocio aparezcan como decisiones aprobadas y no como código ya implementado.
- Que no se presente una conclusión de auditoría histórica como prueba del estado actual.
- Que los defectos financieros estén vinculados a evidencia verificable.
- Que se distinga la creación de una rama local de su publicación en GitHub.
- Que las instrucciones para el siguiente desarrollador no autoricen implícitamente operaciones destructivas o remotas.

No modificar el documento. Si se detectan problemas, describir los cambios propuestos por separado.

## D. Auditoría de seguridad de publicación

Revisar los archivos candidatos y sus contenidos sin divulgar datos sensibles.

Clasificar cada archivo o grupo en:

- INCLUIR PROPUESTO
- EXCLUIR
- REVISIÓN HUMANA OBLIGATORIA

Prestar especial atención a:

- `newpromt.md`, que debe conservarse y puede proponerse para inclusión.
- `TRASPASO_TECNICO_TITAN_GRILL.md`.
- `opencode.json`.
- `.env` y archivos de configuración.
- `scratch/` y scripts ejecutables.
- `test_results.json` y los identificadores de la base local.
- Migraciones I1.1, I1.2 e I1.3.
- Migración I1.4 y migraciones versionadas existentes.
- Informes históricos de FASE10 a FASE39.
- Archivos que incluyan datos personales, credenciales, información de producción o instrucciones operativas sensibles.

No publicar ni preparar archivos automáticamente. La presencia de un archivo en Git no demuestra que sea seguro divulgarlo.

## E. Analizar la estrategia de rama

Preparar una propuesta que:

1. Preserve intacta la rama de auditoría.
2. Identifique el HEAD real desde el que se propone crear la rama.
3. Explique qué cambios locales no se incluirían automáticamente al crearla desde el commit base.
4. Enumere los archivos que se incorporarían expresamente mediante un futuro commit autorizado.
5. No incluya cambios de código financiero ni borradores SQL no aprobados.
6. Mantenga `newpromt.md` sin modificar.
7. Distinga claramente entre rama local, commit local y publicación remota.

No ejecutar ninguna operación Git de escritura.

## F. Informe final obligatorio

Generar el informe en la respuesta, sin crear ni modificar archivos, con estas secciones:

1. Estado real de Git.
2. Validación del documento de continuidad.
3. Matriz de archivos: incluir, excluir o revisión humana.
4. Riesgos de seguridad detectados, sin revelar secretos.
5. Lista exacta de archivos candidatos al primer commit.
6. Archivos que requieren autorización adicional.
7. Comandos propuestos para la siguiente fase, claramente etiquetados como NO EJECUTADOS.
8. Limitaciones de la inspección y cuestiones no demostradas.
9. Recomendación final para publicar la rama.

Si no es posible comprobar un dato, indicarlo expresamente.

## Criterio de cierre

La FASE 50B termina con el informe y espera revisión humana.

No crear ramas, no preparar el índice, no generar commits y no publicar en GitHub. La siguiente fase requerirá autorización explícita del propietario.