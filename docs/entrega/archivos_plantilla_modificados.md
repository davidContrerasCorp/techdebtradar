# Archivos de la plantilla oficial modificados — Hito 2

La plantilla oficial (`Plantilla_Proyectos_PTIA_ECI_LaTeX.zip`) se usó como base sin alterar su
estructura general. Se modificaron los siguientes archivos:

| Archivo | Tipo de cambio | Justificación |
|---|---|---|
| `main.tex` | Ninguno (sin cambios respecto al original) | El orden de `\input{}` ya incluía `content/diseno` y `content/alcance_objetivos`; no fue necesario tocarlo. |
| `style.cls` | Corrección de una macro (`\fig`, `\figposition`) | Se eliminó el entorno `measuredfigure` (de `threeparttable`) dentro de estas dos macros y se reordenó a imagen → `\caption` → `\label`. El propio paquete `caption` documenta en su código fuente que `\label` no funciona dentro de `measuredfigure` (lo redirige a un mecanismo interno de `threeparttable` pensado para notas de tabla), lo que dejaba **todas** las referencias cruzadas a figuras (`\ref`) en blanco o en "??", sin importar el orden en que se llamaran `\label`/`\caption`. Se verificó experimentalmente (con y sin `measuredfigure`, en los tres órdenes posibles) antes de aplicar el cambio. La corrección no altera el ancho ni la apariencia visual de las figuras, solo corrige las referencias. Ver el comentario dejado en el propio `style.cls` junto al cambio. |
| `content/portada.tex` | Contenido (relleno de plantilla) | Nombre del proyecto, integrantes, fecha de entrega. **El número de grupo quedó pendiente de confirmación del docente/usuario.** |
| `content/declaracion.tex` | Contenido (relleno de plantilla) | Nombres de los dos integrantes y fecha en los dos recuadros de firma. |
| `content/introduccion.tex`, `content/trabajos_relacionados.tex`, `content/descripcion_problema.tex`, `content/justificacion.tex` | Contenido nuevo | Transcripción fiel de las Secciones 1-4 del documento del Hito 1 (el zip de la plantilla es una plantilla en blanco, no el `.tex` original del equipo, así que no existían estos archivos con contenido). |
| `content/alcance_objetivos.tex` | Archivo nuevo | Sección 5 completa (ver matriz de cumplimiento). |
| `content/diseno.tex` | Archivo nuevo | Sección 6 completa (ver matriz de cumplimiento). |
| `bibliography/references.bib` | Reemplazo completo | Las referencias de ejemplo del template (sobre analítica deportiva) se reemplazaron por las 13 referencias reales usadas en este proyecto. |
| `img/arquitectura.png`, `img/flujo_datos.png` | Archivos nuevos | Diagramas de arquitectura y de flujo de datos (fuente Graphviz en `diagrams/`). |
| `ulem.sty`, `soul.sty`, `dirtree.sty` (nuevos, en la raíz de `docs/latex/`) | Archivos nuevos (stubs locales) | El entorno de compilación usado por el asistente no tenía estos tres paquetes CTAN instalados, y no tenía acceso de red a CTAN para instalarlos (solo a los repositorios del sistema operativo, que tampoco los incluían). `style.cls` los requiere pero **ninguna de sus macros se usa en el contenido final** del documento (solo aparecían de ejemplo en `content/tutorial.tex`, que está deshabilitado en `main.tex`). Se escribieron versiones mínimas, autocontenidas y comentadas que definen las mismas macros públicas, para que el documento compile en cualquier instalación de TeX Live completa igual que si estos paquetes estuvieran instalados de verdad. **Si quien compile este documento en su propia máquina ya tiene el `ulem`/`soul`/`dirtree` oficiales instalados, puede borrar estos tres archivos sin ningún otro cambio** (TeX Live dará prioridad a la instalación del sistema solo si estos archivos no están en la misma carpeta que `main.tex`; lo más simple es eliminarlos si no se necesitan). |

Ningún otro archivo de la plantilla fue modificado. `content/resultados.tex` y
`content/conclusiones.tex` se dejaron intencionalmente como el placeholder original de la
plantilla ("Recomendaciones"), porque corresponden a hitos futuros, no a este.
