# TechDebtRadar — MVP (Hito 3)

Prototipo funcional: a partir de la URL de un repositorio **público** de GitHub en Python o
JavaScript/TypeScript, detecta los archivos con más señales de deuda técnica, los explica en
lenguaje natural con un LLM y los ordena por prioridad de refactorización.

```
URL → validar → git clone --depth 1 → leer .py/.js/.ts → métricas estáticas (CC, SATD, DUP, tamaño)
    → normalizar (min-max por repo) → top-N → LLM (explicación + severidad 1-5 + sugerencia)
    → Score = 0.25·CC + 0.15·SATD + 0.20·DUP + 0.40·Sev → lista priorizada (web / API / CLI)
```

## Requisitos

- Node.js 20 o superior (probado con Node 24)
- `git` en el PATH (se usa para clonar el repositorio a analizar)
- Opcional: una API key de Anthropic para usar Claude como componente LLM

## Instalación y ejecución

```powershell
cd mvp
npm install
npm start
```

Abre <http://localhost:3000>, pega por ejemplo `github.com/psf/requests` y presiona **Analizar**.

### Activar el LLM (Claude)

Sin credenciales, el sistema funciona con un **evaluador heurístico** (reglas sobre las métricas)
y lo indica claramente en la interfaz. Para usar Claude:

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
npm start
```

Variables opcionales:

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `TDR_LLM` | `auto` | `anthropic`, `heuristica` o `auto` (Claude si hay credenciales) |
| `TDR_MODEL` | `claude-opus-5-5` | Modelo de Claude |
| `TDR_EFFORT` | `medium` | Esfuerzo de razonamiento (`low`, `medium`, `high`) |
| `TDR_TOP_N` | `10` | Archivos que se envían al LLM (control de costo) |
| `TDR_MAX_FILES` | `1500` | Máximo de archivos a analizar por repositorio |
| `TDR_INCLUDE_TESTS` | (vacío) | `1` para incluir archivos de pruebas (por defecto se excluyen) |
| `PORT` | `3000` | Puerto del servidor |

La llamada a Claude usa salida estructurada (JSON schema validado con zod), y si el modelo
rechaza la solicitud por política activa el *fallback* del servidor (`fallbacks: "default"`).
Si una llamada falla, ese archivo se evalúa con la heurística y la interfaz lo marca.

## Línea de comandos

```powershell
npm run analyze -- github.com/pallets/flask --top 10 --json flask.json
```

## Pruebas

```powershell
npm test                                  # 39 pruebas unitarias y de integración (sin red)
$env:TDR_E2E = "1"; npm test              # + 3 pruebas de extremo a extremo que clonan repos reales
```

Cubren: lexer (strings, comentarios, regex), complejidad ciclomática de Python/JS/TS contra
conteos manuales, SATD, duplicación, normalización y fórmula de score, selección top-N,
componente LLM con un cliente falso (formato de la solicitud, rechazos, salida inválida),
respaldo heurístico ante fallas, API HTTP completa y servido de la interfaz.

## Evaluación (Hito 3)

```powershell
npm run evaluate                          # analiza 6 repos → ../eval/<proveedor>/
node scripts/validate-cc.js               # compara la CC con ESLint en 3 repos JS/TS
npm run spearman -- ../eval/anthropic     # objetivos 2 y 3, tras llenar las plantillas CSV
```

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado y proveedor de LLM activo |
| POST | `/api/analyses` `{url, force?}` | Inicia un análisis asíncrono → `{id}` (reusa uno < 1 h salvo `force`) |
| GET | `/api/analyses` | Análisis recientes |
| GET | `/api/analyses/:id` | Progreso o resultado completo |
| GET | `/api/analyses/:id/source?path=` | Código de un archivo priorizado |
| POST | `/api/analyses/:id/findings/:fid/status` `{status}` | `pendiente` / `resuelto` / `ignorado` |

## Estructura

```
mvp/
├── src/
│   ├── server.js          # API HTTP + servidor de la interfaz (node:http, sin frameworks)
│   ├── pipeline.js        # orquestación del flujo completo
│   ├── github.js          # validación de URL, clonación, recorrido y exclusiones
│   ├── metrics/
│   │   ├── lexer.js       # separa código / comentarios / strings (Python y JS/TS)
│   │   ├── complexity.js  # complejidad ciclomática de McCabe por función
│   │   ├── satd.js        # TODO / FIXME / HACK / XXX en comentarios
│   │   ├── duplication.js # duplicación entre archivos (hash de ventanas de 6 líneas)
│   │   └── index.js       # métricas por archivo y por repositorio
│   ├── prioritization.js  # normalización, selección top-N, fórmula de score, niveles
│   ├── llm.js             # componente LLM (Claude) + evaluador heurístico de respaldo
│   └── store.js           # persistencia de análisis en data/analyses/*.json
├── public/                # interfaz web (3 pantallas del prototipo, ahora con datos reales)
├── scripts/               # CLI, evaluación, validación de CC, Spearman
└── test/                  # pruebas (node:test) y repositorio de prueba (fixtures/)
```

## Decisiones de implementación respecto al diseño del Hito 2

- **Node.js en lugar de Python (radon/lizard).** Un solo lenguaje para el backend y la interfaz,
  sin dependencias nativas. Las métricas se calculan con un analizador propio basado en
  *tokens* (el mismo enfoque de lizard) para Python y JS/TS. Su exactitud se validó contra
  la regla `complexity` de ESLint (parser AST real): ver `eval/cc-validation.json`.
- **Archivos de pruebas excluidos por defecto**, porque la deuda en pruebas está fuera del
  alcance definido en la Sección 5.
- **Evaluador heurístico de respaldo**, para que el sistema funcione sin credenciales, para
  pruebas reproducibles, y como línea base contra la cual comparar el aporte del LLM.
