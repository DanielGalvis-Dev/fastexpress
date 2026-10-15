# Pendientes

## Contrato de la API
Confirmado con `GET ?action=getHistorial` (ya integrado en `src/api/historial.ts`):
`{ success, totalRegistros, data: [{ fechaHora, peso, tipoCliente, tipoEnvio, totalUSD, estado }] }`, con `estado` EXITOSO | RECHAZADO (peso > 20 → RECHAZADO, total 0).

Cotización (confirmada con el `index.html` de prueba del equipo, que ya funciona; implementada en `src/api/cotizar.ts`):
POST con `Content-Type: text/plain` y cuerpo `{ peso, tipoCliente, tipoEnvio }` → `{ success, desglose: { tarifaBase, costoPeso, subtotal, descuentoAplicado, recargoAplicado, total } }`. Rechazo: `{ success: false, mensaje }`.
- [x] POST probado desde esta app contra la API real (2026-10-14): 5 kg, Frecuente, Estándar → $13.50 (base 5 + peso 10 − descuento 1.50), y el historial se refrescó solo.
- [ ] Confirmar los textos de `mensaje` para peso > 20 kg y datos inválidos.
- [x] `VITE_API_URL` en `.env.local` (ignorado por git). Falta cargarla en Vercel.

## Decisiones funcionales (Backend / QA)
- [ ] Campo `Monto`: ¿entrada o resultado calculado? Hoy el formulario no lo tiene. (El historial lo llama `totalUSD`, lo que sugiere que es el resultado.)
- [x] Orden descuento/recargo: según el historial son multiplicativos, así que el orden no cambia el total (FRECUENTE + EXPRESS, 3 kg → 12.38).
- [x] Decimales: el Backend acepta pesos como 19.3214 y redondea el total a 2 decimales. La UI no limita decimales. Falta confirmar con QA si se debe limitar.
- [ ] Peso > 20 kg: hoy se bloquea en el cliente. Si QA quiere ejercitar el rechazo del Backend desde la UI, quitar ese tope en `validarPeso`.

## Diseño
- [ ] Dirección visual definitiva (paleta y tipografía): hoy hay tokens provisionales en `src/index.css`.
- [ ] Instalar Impeccable en este repo (`npx impeccable install --providers=claude --scope=project --no-hooks`) y correr `/impeccable init`.
- [ ] Revisión de accesibilidad y responsive (`/impeccable audit`) y revisión visual en navegador.

## Asistente de IA (chat estadístico con Gemini)
Especificación para Backend: `docs/ESPECIFICACION_BACKEND_ASISTENTE_IA.md`.
- [ ] Enviar la especificación a Backend y resolver las 5 decisiones abiertas (§13).
- [x] Diseño del chat en el Frontend: widget flotante con panel, burbujas, chiste, «escribiendo…», error con «Reintentar», cuenta regresiva del límite y botón hacia «Nueva cotización». Funciona contra un mock del contrato (`VITE_CHAT=mock`, con aviso de modo demostración).
- [ ] Conectar el chat a la API real cuando Backend la publique: poner `VITE_CHAT=on` (el cliente real ya está en `src/api/chat.ts`) y probar los 22 casos de la especificación §11.
- [x] Responsive verificado (2026-10-14) de 320 a 1920 px de ancho, incluido celular en horizontal: sin scroll de página, sin texto cortado, chat y modal dentro de la pantalla. Limitación: en una altura de ~520 px o menos el modal usa scroll interno de respaldo, y en horizontal (375 px de alto) la lista muestra solo 2 filas.
- [x] En móvil (<640 px) el chat abre a pantalla completa, el botón flotante desaparece y se cierra con la X (la lista de debajo queda inerte). En escritorio sigue como panel flotante.
- [ ] Probar en un celular real (táctil, teclado virtual en Android/iOS) y revisar el chat con lector de pantalla.
- [ ] Decidir si el chat se publica en Vercel antes de que exista el Backend (sin `VITE_CHAT` queda oculto).

## Entrega y proceso
- [ ] Inicializar git y crear el repositorio en GitHub (el Frontend es un repo separado del Backend).
- [ ] Confirmar con el docente que dos repositorios son aceptables (el enunciado dice "un repositorio estructurado").
- [ ] Conectar el repo a Vercel (previews por rama para QA).
- [ ] Decidir si se agregan pruebas E2E (Playwright o Cypress) y CI.
- [ ] Acordar con QA la convención de `data-testid` (hoy: `peso-input`, `peso-error`, `cliente-select`, `cliente-error`, `envio-estandar`, `envio-express`, `envio-error`, `cotizar-btn`, `resultado`, `resultado-total`, `desglose-*`, `api-error`).
- [ ] Cobertura de pruebas del Frontend y su aporte al informe (la meta de 85 % es del Backend).
