# Reglas de negocio (referencia para Frontend)

Origen: sección 2 de `PROYECTO_INTEGRADOR.docx`. Se implementan en el Backend; el Frontend las usa para validar entradas, mostrar el desglose y diseñar casos de prueba.

- **BR-01 Tarifa base**: toda orden cuesta $5.00 USD.
- **BR-02 Cálculo por peso**:
  - 0.01 a 5.00 kg → $2.00 por kg
  - 5.01 a 20.00 kg → $4.00 por kg
  - Más de 20.00 kg → rechazar envío (límite excedido)
- **BR-03 Descuento por tipo de cliente**: `NUEVO` 0 %, `FRECUENTE` 10 %, `VIP` 20 %.
- **BR-04 Recargo por tipo de envío**: `ESTANDAR` 0 %, `EXPRESS` +25 % sobre la tarifa subtotal.

## Ambigüedades a confirmar con Backend/QA

- Orden de aplicación: ¿el descuento (BR-03) y el recargo (BR-04) se aplican sobre el subtotal (base + peso)? ¿en qué orden?
- Peso entre 5.00 y 5.01 (valores como 5.005): definir redondeo/precisión (¿2 decimales?).
- Peso 0 o negativo: no cubierto por BR-02; se rechaza en cliente y se espera error 4xx de la API.
- Campo `Monto`: ver `.claude/CLAUDE.md`.
