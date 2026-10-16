# Guion de video de presentación — Hito 2 (≤ 5 minutos)

Duración objetivo: 5:00. Los tiempos son acumulados y realistas para hablar a ritmo normal
(~140-150 palabras/minuto); se puede grabar con uno o los dos integrantes.

---

## 1. Problema y alcance (0:00 – 0:45)

**En pantalla:** portada del documento o una diapositiva simple con el nombre del proyecto.

**Guion:**

"Hola, somos [nombres], y este es el Hito 2 de TechDebtRadar. El problema de fondo es que la
deuda técnica se acumula en casi cualquier proyecto de software, y las herramientas tradicionales
de análisis estático generan muchas alertas sin explicarlas ni priorizarlas en lenguaje claro.

Para este semestre acotamos el problema a algo concreto: dado un repositorio público de GitHub en
Python o JavaScript, detectar automáticamente los archivos con mayores señales de deuda técnica
—complejidad alta, comentarios TODO/FIXME, código duplicado y funciones muy largas—, explicarlas
en lenguaje natural, y producir una lista priorizada de qué refactorizar primero."

## 2. Objetivo general (0:45 – 1:05)

**Guion:**

"Nuestro objetivo general es desarrollar un asistente que, a partir de la URL de un repositorio,
detecte, explique y priorice automáticamente estos hallazgos, de forma que un equipo pequeño
pueda decidir en minutos qué atender primero, sin tener que leer cientos de alertas de una
herramienta tradicional."

## 3. Estrategia metodológica, técnica y rol del LLM (1:05 – 2:15)

**En pantalla:** diagrama de arquitectura (`img/arquitectura.png`) y, si alcanza el tiempo, el
diagrama de flujo de datos.

**Guion:**

"Nuestra estrategia es híbrida: combinamos métricas de análisis estático —baratas, reproducibles
y bien validadas en la literatura— con un modelo de lenguaje. Las métricas deciden *qué* archivos
mirar, acotando el costo; el LLM decide *cómo* explicarlos y qué tan graves son en contexto.

La arquitectura tiene ocho componentes: interfaz, validación de la URL, obtención del código,
análisis estático, selección de fragmentos relevantes, el componente LLM, un motor de
priorización y la presentación de resultados. En este diagrama, lo verde es lo que ya es
navegable en este hito; lo rojo es lo que está diseñado pero todavía no implementado, para el
Hito 3.

El LLM recibe el código de los archivos más sospechosos, junto con sus métricas, y genera tres
cosas: una explicación en lenguaje natural, una severidad de uno a cinco, y una sugerencia de
refactor. Pero el orden final de la lista no lo decide el LLM solo: lo calcula una fórmula
determinista que combina esas métricas con la severidad del modelo, para que la priorización se
pueda auditar y explicar, no solo justificar diciendo 'porque el modelo lo dijo'. Esos pesos de la
fórmula son una propuesta inicial que todavía no hemos validado con pruebas; eso es justamente
parte de lo que calibraremos en el Hito 3."

## 4. Demo navegable de las 3 pantallas (2:15 – 3:45)

**En pantalla:** grabación de pantalla recorriendo el prototipo real (`prototype/index.html`).

**Guion:**

"Les mostramos el prototipo navegable. [Pegar la URL de demostración y presionar Analizar].
Como ven arriba, el prototipo deja explícito en todo momento que estos son datos simulados: no
hay todavía un análisis real de un repositorio ni una llamada real a un modelo de lenguaje, eso es
justamente lo que vamos a implementar para el Hito 3.

Esta es la pantalla de resultados: una lista de archivos ordenada por el score de prioridad, con
una frase corta de por qué cada uno importa. [Clic en el primer hallazgo]. Y este es el detalle:
la explicación en lenguaje natural, la sugerencia de refactor, las métricas de respaldo, y
acciones para marcar el hallazgo como resuelto o ignorarlo. [Opcional: clic en 'Ver código
fuente' para mostrar el fragmento de ejemplo]."

## 5. Avance real, limitaciones y próximos pasos (3:45 – 4:40)

**Guion:**

"Para ser honestos sobre dónde estamos: en este hito tenemos el diseño completo de la solución y
un prototipo de interfaz totalmente navegable, pero con datos simulados. Lo que todavía no existe
es el análisis real de un repositorio, el cálculo real de las métricas, ni la integración real con
un modelo de lenguaje: eso es exactamente lo que construiremos para el Hito 3, siguiendo la
arquitectura que les mostramos, que ya está pensada para evolucionar hacia ese MVP sin tener que
rediseñarla desde cero.

También dejamos documentadas algunas medidas de control que todavía no están implementadas pero sí
consideradas en el diseño: límites de tamaño y tiempo para no sobrecargar el sistema, manejo de
URLs inválidas o repositorios privados, y saneamiento del código antes de enviarlo al LLM, dado
que el código de un repositorio de terceros es una entrada no confiable."

## 6. Cierre (4:40 – 5:00)

**Guion:**

"En resumen: acotamos bien el problema, diseñamos una arquitectura híbrida auditable, y
construimos un prototipo navegable que comunica claramente el flujo completo sin fingir
funcionalidad que todavía no existe. Gracias."

---

### Notas de grabación

- Grabar la demo de pantalla (sección 4) por separado y editarla encima del guion hablado si es
  más cómodo, o narrar en vivo mientras se interactúa con `prototype/index.html` en el navegador.
- Si el tiempo se ajusta corto, la sección más fácil de recortar sin perder requisitos oficiales
  es el detalle de "Ver código fuente" en la demo (es opcional en el guion).
- Verificar la duración total con un cronómetro antes de la entrega; el límite oficial es 5
  minutos.
