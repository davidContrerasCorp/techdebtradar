# TechDebtRadar — Prototipo de interfaz (Hito 2)

Prototipo navegable de las 3 pantallas del flujo (analizar → priorizar → entender el hallazgo),
construido como réplica de alta fidelidad del prototipo de papel del Hito 1.

## Qué es esto (y qué no es)

- **Navegación funcional:** las 3 pantallas existen como páginas reales, enlazadas entre sí.
- **Datos simulados:** todo el contenido (métricas, scores, explicaciones, sugerencias de
  refactor) fue escrito a mano por el equipo. Ningún dato proviene de analizar un repositorio real.
- **No implementado todavía:** no hay backend, ni análisis real de un repositorio de GitHub, ni
  ninguna llamada real a un modelo de lenguaje. Si pegas una URL distinta a la de demostración, el
  prototipo lo indica explícitamente en vez de simular un resultado inventado.

Ver la Sección 6.7 ("Prototipo: qué es navegable, qué es simulado y qué está implementado") del
documento del Hito 2 (`docs/latex/content/diseno.tex`) para la explicación completa.

## Cómo ejecutarlo

Es HTML/CSS/JavaScript estático, sin build ni dependencias. Dos formas de abrirlo:

1. **Doble clic:** abre `index.html` directamente en el navegador.
2. **Servidor local (opcional, recomendado si el navegador restringe `file://`):**
   ```bash
   cd prototype
   python3 -m http.server 8000
   # luego abre http://localhost:8000 en el navegador
   ```

## Cómo recorrer el flujo de demostración

1. En la pantalla principal (`index.html`), pega `github.com/miequipo/mi-proyecto` en el campo de
   URL (o haz clic en el enlace de la pista bajo el campo, que la completa automáticamente) y
   presiona **Analizar**. También puedes hacer clic directamente en el ítem "mi-proyecto" de
   "Análisis recientes".
2. Verás la lista priorizada de 4 hallazgos de ejemplo (`resultados.html`), ordenada por score
   simulado, igual que el Boceto 2 del Hito 1.
3. Haz clic en cualquier fila para ver el detalle del hallazgo (`detalle.html`): explicación en
   lenguaje natural, sugerencia de refactor, métricas de respaldo y las acciones "Marcar
   resuelto" / "Ignorar" / "Ver código fuente" (estas dos primeras son interacciones simuladas que
   solo cambian el estado en el navegador, no hay persistencia real).
4. Si en la pantalla principal pegas cualquier otra URL, o haces clic en "api-pagos" o
   "landing-page" del historial, el prototipo te avisa explícitamente que esos datos no están
   disponibles en esta demo, en vez de inventar un resultado.

## Estructura de archivos

```
prototype/
├── index.html        # Pantalla 1: analizar repositorio
├── resultados.html    # Pantalla 2: deuda técnica priorizada
├── detalle.html        # Pantalla 3: detalle de un hallazgo
├── css/styles.css      # Estilos compartidos
├── js/data.js           # Datos de ejemplo (simulados), documentados en el propio archivo
└── js/app.js             # Lógica de navegación y de renderizado (sin backend)
```

## Tecnología y justificación

Se eligió HTML, CSS y JavaScript estático (sin framework) porque, para 3 pantallas navegables con
datos simulados en este hito, es suficiente, no requiere proceso de construcción (*build*) ni
backend, y es trivial de ejecutar y revisar para el docente (ver justificación completa en la
Sección 6.3 del documento del Hito 2).
