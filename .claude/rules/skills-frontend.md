# Skills de diseño frontend (React)

Estado: **Impeccable instalado** (v0.1.11, alcance proyecto, sin hooks) en `.claude/skills/impeccable/` y `.claude/agents/`. Falta correr `/impeccable init`. Esos archivos no se versionan (el repo único solo incluye `.claude/CLAUDE.md` y `rules/`): en una máquina nueva, repetir `npx impeccable install --providers=claude --scope=project --no-hooks` en la raíz del repo.

## 1. frontend-design (Anthropic)

- Origen: https://github.com/anthropics/skills/tree/main/skills/frontend-design
- Ya está disponible como skill `frontend-design:frontend-design` en el entorno de Claude Code del usuario, así que no requiere instalación adicional.
- Uso: al diseñar o rediseñar la UI (tipografía, color, layout con intención; evitar el aspecto genérico de plantilla).

## 2. Impeccable (pbakaus/impeccable)

- Origen: https://github.com/pbakaus/impeccable — licencia Apache 2.0. Sitio: https://impeccable.style
- Qué es: una skill (`/impeccable`) con 24 comandos (`craft`, `shape`, `critique`, `audit`, `polish`, `harden`, `adapt`, `clarify`, etc.) y 61 reglas deterministas de detección de "AI slop" y calidad de diseño.
- Instalación prevista (cuando se autorice), desde la raíz del proyecto:
  1. `npx impeccable install` → elegir proveedor `claude` y alcance `project`.
  2. Dentro de Claude Code: `/impeccable init` (genera `PRODUCT.md`).
  3. Alternativa sin Node: `/plugin marketplace add pbakaus/impeccable` y luego instalar desde `/plugin`.
- Detalles a tener en cuenta:
  - La instalación añade un hook en `.claude/settings.local.json` que ejecuta el detector tras editar archivos UI, y descarga un binario a `~/.impeccable/bin/` la primera vez. Revisar antes de aceptar.
  - Crea la carpeta `.impeccable/`; añadir al `.gitignore` el bloque `impeccable-ignore-start … end` del README del repo.
  - Comandos más útiles para este proyecto: `/impeccable shape` (planear el formulario), `/impeccable harden` (errores y casos borde), `/impeccable audit` (a11y/responsive), `/impeccable polish` (revisión final). El detector también corre sin IA: `npx impeccable detect src/`.

## Cómo se combinan

- `frontend-design` para la dirección estética inicial; `Impeccable` para estructurar el flujo (shape → craft), auditar y pulir.
- Si ambas dan guías que chocan, prevalecen las reglas de `validaciones-ui.md` y `reglas-negocio.md` (el diseño no cambia el comportamiento).
- La UI es un formulario de cotización: priorizar claridad, jerarquía del resultado, estados de error y accesibilidad por encima de efectos visuales.
