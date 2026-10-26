# Contrato de la API (consumo desde el Frontend)

La API no es responsabilidad del equipo de Frontend; solo se consume. Está en Google Apps Script (web app) y puede cambiar de ubicación, por eso la URL va en una variable de entorno y no en el código.

## Lo verificado

- Un GET a la URL base devuelve `{"success":true,"mensaje":"API FastExpress en funcionamiento Integrador 1.4"}` (health check).
- Patrón de respuesta observado: `{ success: boolean, mensaje: string }`.

## Historial (verificado, 2026-10-14)

`GET <URL>?action=getHistorial` → `{ success, totalRegistros, data: [{ fechaHora, peso, tipoCliente, tipoEnvio, totalUSD, estado }] }`, con `estado` EXITOSO | RECHAZADO. Peso > 20 queda RECHAZADO con `totalUSD` 0. Pesos con muchos decimales (19.3214) se aceptan y el total se redondea a 2 decimales. Descuento y recargo son multiplicativos. Implementado en `src/api/historial.ts` y `HistorialList`.

## Autenticación (verificado contra la API real v3.7, 2026-10-23)

POST a la URL base (`text/plain`, JSON con `action`). Errores `{ success: false, codigo, mensaje }` (HTTP 200).
- `register {nombre,email,password}` → `{success,mensaje,usuario{id,nombre,email,creadoEn,ultimoLogin}}`; errores `EMAIL_EXISTENTE`, `NOMBRE_INVALIDO`.
- `login {email,password}` → `{success,token,expiraEn,usuario}` (8 h); error `CREDENCIALES_INVALIDAS`.
- `logout {token}` → `{success,mensaje}`.
- `changePassword {token,actual,nueva}` → `{success,mensaje}`; errores `PASSWORD_ACTUAL_INCORRECTA`, `PASSWORD_DEBIL` (mínimo 5), `SESION_INVALIDA`.
- `forgot {email}` → mensaje genérico (código fuera de banda); `reset {email,codigo,nueva}` → `{success,mensaje}`; error `CODIGO_INVALIDO`.
- El Frontend envía el token de sesión en `cotizar` y `chat` (cuerpo); hoy la API lo ignora ahí. `getHistorial` NO usa el token de sesión: se autoriza con una clave fija en `?token=` (variable `VITE_HISTORIAL_TOKEN`, valor en el `.env.local` del Frontend; con otro token responde `NO_AUTORIZADO`). Su respuesta ahora incluye `limit` (50) y `offset`.
- El Frontend cierra la sesión solo con `codigo` `SESION_INVALIDA`; `NO_AUTORIZADO` se muestra como error (hoy sale también con token válido).

## Cotización (verificado en `index.html` del proyecto)

POST a la URL base, `Content-Type: text/plain;charset=utf-8`, cuerpo `JSON.stringify({ peso, tipoCliente, tipoEnvio })`. Éxito: `{ success: true, desglose: { tarifaBase, costoPeso, subtotal, descuentoAplicado, recargoAplicado, total } }`. Error: `{ success: false, mensaje }`. El `index.html` de la raíz es una página de pruebas del equipo (guarda un historial local de 5 y embebe un agente de Copilot Studio); sirve de referencia del contrato.

## Lo que ya no está pendiente / lo que sigue (históricamente por confirmar)

1. Método de la cotización (GET con parámetros o POST con JSON).
2. Nombres exactos de los campos: peso, tipo de cliente, tipo de envío.
3. Forma de la respuesta exitosa (desglose o solo total).
4. Cómo se informan los rechazos (peso > 20 kg, datos inválidos).

## Reglas de consumo propias de Apps Script

- No hay preflight CORS: en POST enviar `Content-Type: text/plain;charset=utf-8` con el JSON como texto, sin cabeceras personalizadas.
- La petición pasa por una redirección 302; `fetch` la sigue por defecto.
- El código HTTP casi siempre es 200: decidir éxito o error leyendo `success` y `mensaje` del cuerpo.
- Puede haber arranque en frío de 1–3 s: estado de carga, timeout y mensaje de reintento.
- Si CORS falla, usar un rewrite/proxy del hosting (Vercel).
- Centralizar las llamadas en un único módulo (p. ej. `src/api/`), para cambiar el contrato en un solo lugar y poder simularlo en las pruebas.
