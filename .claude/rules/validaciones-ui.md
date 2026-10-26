# Validaciones de entrada en el cliente (UI)

Validaciones básicas derivadas de las reglas de negocio. Sirven de base para el Plan de Pruebas de Caja Negra (E.P. y BVA).

## Campo Peso (kg)

| Partición | Rango | Resultado esperado |
|---|---|---|
| Inválida (no numérico / vacío) | texto, vacío | Error en el campo, no se envía |
| Inválida (≤ 0) | ≤ 0.00 | Error en el campo, no se envía |
| Válida 1 | 0.01 – 5.00 | Se envía; tarifa $2.00/kg |
| Válida 2 | 5.01 – 20.00 | Se envía; tarifa $4.00/kg |
| Inválida (excede límite) | > 20.00 | Rechazo: límite excedido |

Valores límite (BVA) sugeridos: 0.00, 0.01, 0.02, 4.99, 5.00, 5.01, 5.02, 19.99, 20.00, 20.01.

## Campos de selección

- `Tipo de cliente`: solo `NUEVO`, `FRECUENTE`, `VIP`. Obligatorio.
- `Tipo de envío`: solo `ESTANDAR`, `EXPRESS`. Obligatorio.
- Usar `select`/radio con opciones fijas para evitar entradas inválidas.

## Tabla de decisión (Cliente × Envío) — 6 combinaciones

| Cliente | Envío | Descuento | Recargo |
|---|---|---|---|
| NUEVO | ESTANDAR | 0 % | 0 % |
| NUEVO | EXPRESS | 0 % | +25 % |
| FRECUENTE | ESTANDAR | 10 % | 0 % |
| FRECUENTE | EXPRESS | 10 % | +25 % |
| VIP | ESTANDAR | 20 % | 0 % |
| VIP | EXPRESS | 20 % | +25 % |

## Comportamiento de la UI

- Validar al salir del campo y al enviar; deshabilitar o bloquear el envío con datos inválidos.
- Mostrar errores junto al campo con texto explícito (no solo color).
- Mostrar el rechazo del Backend (p. ej. peso > 20 kg) y errores de red/servidor sin romper el formulario.
- Estado de carga durante la petición; evitar envíos duplicados.
- Añadir `data-testid` a campos, mensajes de error, botón de cotizar y resultado, para QA.
- La validación del cliente es una ayuda de usabilidad; el Backend sigue siendo la autoridad.
