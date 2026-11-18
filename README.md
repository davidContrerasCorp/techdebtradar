# TechDebtRadar

Asistente basado en un modelo de lenguaje que, a partir de la URL de un repositorio público de
GitHub en Python o JavaScript, **detecta, explica en lenguaje natural y prioriza** los archivos
con mayores señales de deuda técnica. Proyecto del curso PTIA (Escuela Colombiana de Ingeniería).

## Contenido del repositorio

| Carpeta | Hito | Qué es |
|---|---|---|
| [`mvp/`](mvp/) | 3 | **Prototipo funcional (MVP)**: backend Node.js, métricas, LLM, priorización e interfaz web. Ver [mvp/README.md](mvp/README.md). |
| [`eval/`](eval/) | 3 | Resultados de la evaluación: análisis de 6 repositorios, validación de la complejidad contra ESLint y plantillas para la evaluación humana. |
| [`prototype/`](prototype/) | 2 | Prototipo de interfaz navegable con datos simulados (se conserva como registro del Hito 2). |
| [`docs/latex/`](docs/latex/) | 1-3 | Documento del proyecto (LaTeX). |
| [`diagrams/`](diagrams/) | 2-3 | Diagramas de arquitectura y de flujo de datos. |

## Inicio rápido

```powershell
cd mvp
npm install
npm start          # http://localhost:3000
npm test           # pruebas automáticas
```

Para usar Claude como componente LLM, define `ANTHROPIC_API_KEY` antes de `npm start`; sin
credenciales el sistema usa un evaluador heurístico y lo indica en la interfaz.

## Videos

- Hito 2: ver `Video.txt`
