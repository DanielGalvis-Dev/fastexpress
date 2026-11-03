# Informe técnico

Documento final de Calidad de Software, con las tres secciones que pide el enunciado. Las evidencias salen de `pruebas/` y de `backend/tests/`.

| Sección | Archivo | Responsables |
|---|---|---|
| 1. Plan de Pruebas de Caja Negra | [01-caja-negra.md](01-caja-negra.md) | QA + Frontend |
| 2. Plan de Pruebas de Caja Blanca | [02-caja-blanca.md](02-caja-blanca.md) | QA + Backend |
| 3. Reporte de Cobertura | [03-cobertura.md](03-cobertura.md) | QA |

## Resumen de resultados (2026-11-03)

- **Caja negra:** E.P. y BVA de Peso y de Monto, y tabla de decisión Cliente × Envío (6 reglas). Todos los casos pasan.
- **Caja blanca:** CFG de `calcularTarifa` con 19 nodos y 27 aristas, **V(G) = 10**, 10 caminos independientes, cada uno con su caso de prueba. Cobertura de aristas 100 %.
- **Cobertura:** **100 % de líneas y 98 % de ramas** sobre `Codigo.js` (mínimo exigido: 85 %), con 144 pruebas automatizadas.

## Decisión pendiente del equipo

- **Campo `Monto`:** el enunciado lo menciona pero no lo define. En §1.2 se interpretó como el total cotizado (salida). Hay que confirmarlo o definir su regla si es un dato de entrada.
