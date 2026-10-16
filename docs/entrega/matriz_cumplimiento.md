# Matriz de cumplimiento — Hito 2, TechDebtRadar

Esta matriz mapea cada requisito oficial del enunciado del Hito 2 (según el "prompt maestro" de
trabajo) con el entregable concreto donde se cumple, y su estado real. Ningún ítem se marca
"Completo" sin evidencia verificable (archivo, compilación exitosa o prueba ejecutada).

| # | Requisito oficial | Dónde se cumple | Estado |
|---|---|---|---|
| 1 | Mantener intactas las Secciones 1-4 del Hito 1, con solo ajustes de coherencia | `docs/latex/content/introduccion.tex`, `trabajos_relacionados.tex`, `descripcion_problema.tex`, `justificacion.tex` | Completo |
| 2 | Sección 5 — problema específico a resolver | `content/alcance_objetivos.tex`, §"Problema específico a resolver" | Completo |
| 3 | Sección 5 — por qué la simplificación es adecuada | `content/alcance_objetivos.tex`, §"¿Por qué es una simplificación adecuada?" (4 razones justificadas y citadas) | Completo |
| 4 | Sección 5 — objetivo general (cuantitativo/cualitativo) | `content/alcance_objetivos.tex`, §"Objetivo general" | Completo |
| 5 | Sección 5 — objetivos específicos medibles con criterios de éxito, sin inventar resultados | `content/alcance_objetivos.tex`, Tabla "Objetivos específicos y sus criterios de éxito" + nota explícita de que son metas del Hito 3, no resultados logrados | Completo |
| 6 | Sección 5 — delimitación realista del alcance (entradas, tipos de deuda, salidas, fuera de alcance) | `content/alcance_objetivos.tex`, Tabla "Qué entra y qué no entra en el alcance" | Completo |
| 7 | Sección 6 — estrategia general y su justificación | `content/diseno.tex`, §6.1 "Estrategia general" | Completo |
| 8 | Sección 6 — dónde se concentra la inteligencia (conocimiento vs. razonamiento) | `content/diseno.tex`, §6.2 | Completo |
| 9 | Sección 6 — herramienta seleccionada y por qué (incluye por qué no *fine-tuning*) | `content/diseno.tex`, §6.3, Tabla "Herramientas seleccionadas por componente" | Completo |
| 10 | Sección 6 — arquitectura (componentes y relaciones) con diagramas | `content/diseno.tex`, §6.4, `img/arquitectura.png` (Graphviz), Tabla de responsabilidades/entradas/salidas | Completo |
| 11 | Sección 6 — componente principal detallado | `content/diseno.tex`, §6.5 "Componente principal: LLM y motor de priorización" | Completo |
| 12 | Sección 6 — diferenciación reglas deterministas / métricas estáticas / capacidades del LLM | Transversal en §6.1, 6.2 y 6.5 (ver también Tabla de herramientas) | Completo |
| 13 | Sección 6 — fórmula de priorización con variables, escala, normalización, pesos justificados | `content/diseno.tex`, §6.6, con tabla de variables y advertencia explícita de que los pesos son una propuesta inicial no validada | Completo |
| 14 | Sección 6 — identificar qué es propuesta inicial no validada vs. respaldado por pruebas | Advertencia explícita al final de §6.6; también en la nota de la Tabla de objetivos (Sección 5) | Completo |
| 15 | Prototipo navegable de las 3 pantallas del Hito 1 (analizar, resultados, detalle) | `prototype/index.html`, `resultados.html`, `detalle.html` | Completo |
| 16 | Prototipo — distinción explícita entre navegación funcional, datos simulados y funcionalidad no implementada | Banner visible en las 3 pantallas + `prototype/js/data.js` (comentado) + `content/diseno.tex` §6.7 + `prototype/README.md` | Completo |
| 17 | Prototipo — tecnología de interfaz elegida y justificada | `content/diseno.tex` Tabla de herramientas (fila "Interfaz del prototipo"); `prototype/README.md` §"Tecnología y justificación" | Completo |
| 18 | Prototipo — fuentes de diseño/código entregadas con instrucciones de ejecución | `prototype/` completo + `prototype/README.md` | Completo |
| 19 | Avance de la solución con diseño y fuentes de código | Diseño completo (Sección 6) + código fuente del prototipo de interfaz. El motor de análisis estático, la obtención de repositorios y la integración con el LLM quedan **diseñados pero no implementados**, de forma consistente con la delimitación de alcance de este hito (ver Sección 5) y con el plan de evolución hacia el MVP del Hito 3 | Completo según el alcance de este hito (no es un pendiente, es una decisión de alcance documentada) |
| 20 | Arquitectura evolutiva hacia el MVP del Hito 3, con capas, responsabilidades/entradas/salidas, medidas de control razonables, sin sobre-implementar | `content/diseno.tex` §6.4 (tabla de componentes) y el párrafo "Medidas de control consideradas para el Hito 3" | Completo |
| 21 | Documento en la plantilla oficial LaTeX, compilable, con citas verificables, diagramas y tablas, sin afirmaciones no demostradas | `docs/latex/main.pdf`, compilado con éxito (XeLaTeX + biber, 3+ pasadas, sin referencias indefinidas) | Completo |
| 22 | Identificar qué archivos de la plantilla debieron modificarse | `docs/entrega/archivos_plantilla_modificados.md` | Completo |
| 23 | Guion de video de presentación (≤ 5 minutos) | `docs/entrega/guion_video.md` | Completo |
| 24 | Dejar todo en un repositorio de GitHub | Repositorio git local completo, con historial de commits, listo en el entorno de trabajo | Parcial — ver nota abajo |
| 25 | Checklist final de pre-entrega | `docs/entrega/checklist_entrega.md` | Completo |

## Notas sobre ítems no 100% cerrados

- **GitHub (ítem 24):** el entorno de ejecución de este asistente tiene bloqueado, a nivel de red,
  el acceso a GitHub salvo mediante el conector oficial de GitHub de Anthropic (no instalado en
  esta organización). Por esta razón no fue posible hacer `git push` directamente con el token que
  el usuario compartió, incluso después de confirmarse que el problema es del entorno y no del
  token. El repositorio local **sí** quedó completo, con todos los archivos y commits
  (`git log` lo muestra), listo para que el usuario mismo ejecute el push en 3 comandos (ver
  `docs/entrega/checklist_entrega.md`). El token compartido en el chat no se usó para nada más y se
  recomendó revocarlo por buena práctica, dado que quedó expuesto en la conversación.
- **Número de grupo:** el usuario indicó los nombres del equipo pero no el número de grupo del
  curso. La portada (`content/portada.tex`) quedó con el marcador "Grupo [por confirmar con el
  docente]"; debe completarse antes de la entrega final.
- **Fecha de entrega:** el usuario indicó el 12 de octubre de 2026, que es anterior a la fecha en
  la que se completó este trabajo (16 de octubre de 2026 según el entorno de esta sesión). Se dejó
  la fecha tal como la indicó el usuario, pero conviene que la confirme o la corrija antes de
  entregar.
