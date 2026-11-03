# 1. Plan de Pruebas de Caja Negra (QA + Frontend)

Técnicas: **Particiones de Equivalencia (E.P.)**, **Análisis de Valores Límite (BVA)** y **Tabla de Decisión**, aplicadas a las reglas de negocio BR-01 a BR-04 del enunciado.

- Unidad bajo prueba: la cotización (`calcularTarifa`, expuesta por `doPost`) y su validación de entradas.
- Los resultados esperados se calcularon **a mano** desde las reglas, sin mirar la salida del código:
  `subtotal = 5.00 + peso × (2.00 si peso ≤ 5, 4.00 si no)` y `total = subtotal × (1 − descuento) × (1 + recargo)`, con redondeo a 2 decimales en cada paso.
- Automatización: `backend/tests/unitarias/calcularTarifa.cajaNegra.test.js` (Jest). Ejecución del 2026-11-03: **todos los casos pasan** (resultado obtenido = esperado).
- Comando: `cd backend && npm test`.

## 1.1 Campo Peso (kg)

### Particiones de equivalencia

| ID | Partición | Rango | Representante | Resultado esperado | Estado |
|---|---|---|---|---|---|
| EP-P1 | Inválida: no numérica | texto | `"abc"` | Rechazo `PESO_INVALIDO` | Pasa |
| EP-P2 | Inválida: vacío | sin valor | `undefined` | Rechazo `PESO_INVALIDO` | Pasa |
| EP-P3 | Inválida: negativa | < 0 | −3 | Rechazo `PESO_INVALIDO` | Pasa |
| EP-P4 | Inválida: cero | = 0 | 0 | Rechazo `PESO_INVALIDO` | Pasa |
| EP-P5 | Inválida: bajo el mínimo | 0 < p < 0.01 | 0.005 | Rechazo `PESO_INVALIDO` | Pasa |
| EP-P6 | **Válida 1** | 0.01 – 5.00 | 3 | $2.00/kg → costo 6.00, total 11.00 | Pasa |
| EP-P7 | **Válida 2** | 5.01 – 20.00 | 10 | $4.00/kg → costo 40.00, total 45.00 | Pasa |
| EP-P8 | Inválida: excede el límite | > 20.00 | 25 | Rechazo `PESO_EXCEDIDO` | Pasa |

### Valores límite (BVA), cliente NUEVO + envío ESTANDAR

| ID | Peso | Frontera | Costo por peso | Total esperado | Estado |
|---|---|---|---|---|---|
| BVA-01 | 0.00 | límite inferior (fuera) | — | Rechazo `PESO_INVALIDO` | Pasa |
| BVA-02 | −1.00 | bajo el límite (fuera) | — | Rechazo `PESO_INVALIDO` | Pasa |
| BVA-03 | 0.01 | mínimo válido | 0.02 | **5.02** | Pasa |
| BVA-04 | 0.02 | sobre el mínimo | 0.04 | **5.04** | Pasa |
| BVA-05 | 4.99 | bajo el cambio de tramo | 9.98 | **14.98** | Pasa |
| BVA-06 | 5.00 | último valor del tramo $2 | 10.00 | **15.00** | Pasa |
| BVA-07 | 5.01 | primer valor del tramo $4 | 20.04 | **25.04** | Pasa |
| BVA-08 | 5.02 | sobre el cambio de tramo | 20.08 | **25.08** | Pasa |
| BVA-09a | 19.99 | bajo el máximo | 79.96 | **84.96** | Pasa |
| BVA-09b | 20.00 | máximo válido | 80.00 | **85.00** | Pasa |
| BVA-10 | 20.01 | primer valor fuera | — | Rechazo `PESO_EXCEDIDO` | Pasa |
| BVA-11 | 25.00 | sobre el límite | — | Rechazo `PESO_EXCEDIDO` | Pasa |

Los valores BVA coinciden con los sugeridos para la UI: 0.00, 0.01, 0.02, 4.99, 5.00, 5.01, 5.02, 19.99, 20.00 y 20.01.

## 1.2 Campo Monto

> **Supuesto que el equipo debe confirmar.** El enunciado pide E.P. y BVA para `Peso` y `Monto`, pero no define qué es `Monto`, y ninguna regla (BR-01 a BR-04) usa un monto como dato de entrada. Se interpreta como **el monto total cotizado en USD** (la salida; el historial de la API lo guarda como `totalUSD`). Si el equipo decide que es un campo de entrada, hay que definir primero su regla de negocio.

El rango alcanzable del Monto se deduce de las reglas: el **mínimo** es VIP + ESTANDAR con 0.01 kg → 5.02 − 1.00 = **4.02**; el **máximo** es NUEVO + EXPRESS con 20 kg → 85.00 × 1.25 = **106.25**.

### Particiones de equivalencia

| ID | Partición | Condición | Resultado esperado | Estado |
|---|---|---|---|---|
| EP-M1 | Sin Monto | envío rechazado (peso inválido o > 20) | No se genera total ni desglose; `success=false` | Pasa |
| EP-M2 | Monto válido | 4.02 ≤ Monto ≤ 106.25 | Positivo y con 2 decimales, para cualquier combinación | Pasa |

### Valores límite

| ID | Caso | Entrada | Monto esperado | Estado |
|---|---|---|---|---|
| BVA-M1 | Mínimo posible | VIP + ESTANDAR, 0.01 kg | **4.02** | Pasa |
| BVA-M2 | Máximo posible | NUEVO + EXPRESS, 20 kg | **106.25** | Pasa |
| BVA-M3 | Salto de tramo | NUEVO + ESTANDAR, 5.00 → 5.01 kg | 15.00 → **25.04** | Pasa |
| BVA-M4 | Barrido de todo el rango | todos los pesos de 0.01 a 20.00 (paso 0.01) × 6 combinaciones | siempre entre 4.02 y 106.25 | Pasa |
| BVA-M5 | Monotonía | NUEVO + ESTANDAR, de 0.01 a 5.00 kg | el Monto crece con el peso | Pasa |

## 1.3 Tabla de decisión: Tipo de Cliente × Tipo de Envío

Condiciones: tipo de cliente (3 valores) y tipo de envío (2 valores) → **6 reglas**. Acciones: porcentaje de descuento y de recargo.

| Regla | Cliente | Envío | Descuento | Recargo |
|---|---|---|---|---|
| R1 | NUEVO | ESTANDAR | 0 % | 0 % |
| R2 | NUEVO | EXPRESS | 0 % | +25 % |
| R3 | FRECUENTE | ESTANDAR | 10 % | 0 % |
| R4 | FRECUENTE | EXPRESS | 10 % | +25 % |
| R5 | VIP | ESTANDAR | 20 % | 0 % |
| R6 | VIP | EXPRESS | 20 % | +25 % |

Casos ejecutados con **10 kg** (costo por peso 40.00, subtotal 45.00). El recargo se aplica sobre el subtotal ya con descuento (los dos son multiplicativos).

| Regla | Descuento | Subtotal con desc. | Recargo | Total esperado | Estado |
|---|---|---|---|---|---|
| R1 | 0.00 | 45.00 | 0.00 | **45.00** | Pasa |
| R2 | 0.00 | 45.00 | 11.25 | **56.25** | Pasa |
| R3 | 4.50 | 40.50 | 0.00 | **40.50** | Pasa |
| R4 | 4.50 | 40.50 | 10.13 | **50.63** | Pasa |
| R5 | 9.00 | 36.00 | 0.00 | **36.00** | Pasa |
| R6 | 9.00 | 36.00 | 9.00 | **45.00** | Pasa |

Las 6 reglas se repiten con 3 kg (tramo liviano, subtotal 11.00): 11.00, 13.75, 9.90, 12.38, 8.80 y 11.00. Todas pasan.

> **Observación de redondeo.** En R4 el recargo es 40.50 × 0.25 = 10.125, que se redondea a 10.13 (total 50.63). Con 3 kg, FRECUENTE + EXPRESS da 9.90 × 0.25 = 2.475 → 2.48 (total 12.38). La regla de redondeo (a 2 decimales en cada paso) es consistente, pero el enunciado no la especifica; conviene dejarla documentada.

## 1.4 Entradas inválidas de selección

| ID | Entrada | Resultado esperado | Estado |
|---|---|---|---|
| SEL-01 | Tipo de cliente inexistente (`XYZ`), vacío o ausente | Rechazo `CLIENTE_INVALIDO`, sin registrar | Pasa |
| SEL-02 | Tipo de envío inexistente (`AEREO`) o ausente | Rechazo `ENVIO_INVALIDO` | Pasa |
| SEL-03 | Valores en minúsculas o con espacios (`" vip "`, `express`) | Se normalizan y se aceptan | Pasa |
| SEL-04 | Una fórmula de hoja (`=HYPERLINK(...)`) como tipo de cliente | Rechazo por la lista blanca | Pasa |
| SEL-05 | Peso con coma decimal (`"5,5"`) | Se acepta como 5.5 | Pasa |

Estos casos están en `backend/tests/api/cotizacion.api.test.js`.

## 1.5 Parte del Frontend

La validación del cliente (`frontend/src/lib/validation.ts`, reglas en `.claude/rules/validaciones-ui.md`) aplica las mismas particiones antes de enviar: peso vacío, no numérico, ≤ 0 o > 20 kg se rechaza junto al campo (acepta coma o punto decimal), y los selectores solo ofrecen valores válidos. Sus pruebas están en `frontend/src/lib/validation.test.ts` y `frontend/src/components/CotizadorForm.test.tsx` (Vitest; `cd frontend && npm test`).

La validación del cliente es una ayuda de usabilidad: el Backend sigue siendo la autoridad. Como la UI ya bloquea los pesos mayores a 20 kg, el rechazo `PESO_EXCEDIDO` del Backend no se alcanza desde el formulario; se prueba directamente contra la API (BVA-10, BVA-11).
