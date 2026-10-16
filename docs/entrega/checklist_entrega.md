# Checklist final de pre-entrega — Hito 2, TechDebtRadar

## 1. Pendientes que SOLO el usuario puede resolver

- [ ] **Número de grupo.** `docs/latex/content/portada.tex` quedó con el texto "Grupo [por
      confirmar con el docente]". Reemplazarlo por el número real y volver a compilar (ver
      sección 4 de este checklist).
- [ ] **Fecha de entrega.** Se usó el 12 de octubre de 2026, tal como lo indicaste, pero esa fecha
      es anterior a cuando se terminó este trabajo (16 de octubre de 2026). Confirma que sigue
      siendo la fecha correcta o corrígela en `content/portada.tex` y `content/declaracion.tex`.
- [ ] **Revocar el token de GitHub** que compartiste en el chat (`ghp_...`), por buena práctica:
      quedó expuesto en la conversación aunque no se usó para nada más que intentar autenticar
      (sin éxito, ver más abajo). Puedes revocarlo desde GitHub → Settings → Developer settings →
      Personal access tokens.
- [ ] **Subir el repositorio a GitHub tú mismo** (ver instrucciones exactas en la sección 2):
      el entorno donde corrió este asistente bloquea el acceso directo a la API de GitHub salvo
      por el conector oficial de Anthropic, que esta organización no tiene instalado. El repo
      local quedó completo con todos los commits; solo falta el `push`.

## 2. Cómo subir el repositorio a GitHub (3 pasos)

El repositorio ya existe localmente, con todo el contenido y el historial de commits. Para
subirlo a un repositorio privado llamado `techdebtradar` en tu cuenta de GitHub:

1. Crea el repositorio vacío en GitHub (sin README, sin licencia, sin `.gitignore`, para no tener
   conflictos): entra a https://github.com/new, nómbralo `techdebtradar`, márcalo como **privado**,
   y presiona "Create repository". **No actives** ninguna opción de inicializarlo con archivos.
2. En tu computador, descarga/copia la carpeta `techdebtradar` que te entregó este asistente.
3. Desde una terminal, dentro de esa carpeta:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/techdebtradar.git
   git branch -M main
   git push -u origin main
   ```
   (Reemplaza `TU_USUARIO` por tu usuario de GitHub. Te pedirá autenticarte; usa un token personal
   nuevo o el método que prefieras, no el que ya compartiste y vas a revocar.)

## 3. Verificación de deliverables (ya hecha por el asistente)

- [x] Documento LaTeX compila sin errores con XeLaTeX + biber (3 pasadas), sin referencias
      indefinidas (`docs/latex/main.pdf`, 24 páginas).
- [x] Secciones 1-4 del Hito 1 migradas íntegramente.
- [x] Sección 5 (Alcance y Objetivos) y Sección 6 (Diseño metodológico) completas.
- [x] Diagramas de arquitectura y flujo de datos generados, verificados visualmente y embebidos
      en el documento con referencias cruzadas funcionando.
- [x] Prototipo navegable de las 3 pantallas, probado de punta a punta con Playwright (sin
      errores de JavaScript), con capturas de pantalla verificadas visualmente.
- [x] Bibliografía reemplazada con 13 referencias reales, citadas en el texto.
- [x] Matriz de cumplimiento (`docs/entrega/matriz_cumplimiento.md`).
- [x] Archivos de plantilla modificados identificados y justificados
      (`docs/entrega/archivos_plantilla_modificados.md`).
- [x] Guion de video ≤ 5 minutos (`docs/entrega/guion_video.md`).
- [x] Repositorio git local con historial de commits (pendiente solo el `push`, ver sección 2).

## 4. Cómo volver a compilar el documento si lo editas

Requiere una instalación de TeX Live completa (o similar) con XeLaTeX y biber.

```bash
cd docs/latex
xelatex -shell-escape main.tex
biber main
xelatex -shell-escape main.tex
xelatex -shell-escape main.tex
```

Si tu instalación de TeX Live **sí** tiene los paquetes `ulem`, `soul` y `dirtree` originales
(la mayoría de instalaciones completas los tienen), puedes borrar los tres archivos
`docs/latex/ulem.sty`, `docs/latex/soul.sty` y `docs/latex/dirtree.sty` antes de compilar; se
incluyeron solo porque el entorno de compilación usado por el asistente no los tenía disponibles
(ver detalle en `docs/entrega/archivos_plantilla_modificados.md`).

## 5. Antes de grabar el video

- [ ] Practicar el guion (`docs/entrega/guion_video.md`) con cronómetro; el límite es 5 minutos.
- [ ] Tener `prototype/index.html` abierto y probado en el navegador antes de grabar la demo.
- [ ] Decidir si se graban dos voces (una por integrante) o una sola persona narra todo.
