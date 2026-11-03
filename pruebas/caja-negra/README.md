# Caja negra (QA + Frontend)

Diseño de pruebas de la sección 1 del informe (`docs/informe-tecnico/01-caja-negra.md`):

- Particiones de equivalencia y BVA para `Peso` y `Monto`.
- Tabla de decisión Tipo de cliente × Tipo de envío (6 combinaciones).
- Matriz de casos: datos de entrada, resultado esperado, resultado obtenido y estado.

Automatización: `backend/tests/unitarias/calcularTarifa.cajaNegra.test.js` y `backend/tests/api/cotizacion.api.test.js` (`cd backend && npm test`). Parte de la interfaz: `frontend/src/lib/validation.test.ts`.

Referencia de valores límite y combinaciones: `.claude/rules/validaciones-ui.md`.

Pendiente del equipo: confirmar qué es `Monto` (el informe lo trata como el total cotizado).
