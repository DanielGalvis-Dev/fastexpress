# Reporte de cobertura

Evidencias de la sección 3 del informe (`docs/informe-tecnico/03-cobertura.md`). Mínimo requerido: **85 %** de líneas y de ramas.

| Archivo | Qué es |
|---|---|
| `captura-cobertura-resumen.png` | Captura del reporte: 100 % líneas, 98.03 % ramas |
| `salida-jest.txt` | Salida de consola de `npm run coverage` |
| `reporte/lcov-report/index.html` | Reporte navegable, línea por línea |
| `reporte/lcov.info`, `reporte/coverage-summary.json` | Datos crudos |

Para regenerarlo: `cd backend && npm install && npm run coverage`.
