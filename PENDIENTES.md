# Pendientes

## Contrato de la API
Confirmado con `GET ?action=getHistorial` (ya integrado en `src/api/historial.ts`):
`{ success, totalRegistros, data: [{ fechaHora, peso, tipoCliente, tipoEnvio, totalUSD, estado }] }`, con `estado` EXITOSO | RECHAZADO (peso > 20 → RECHAZADO, total 0).

Cotización (confirmada con el `index.html` de prueba del equipo, que ya funciona; implementada en `src/api/cotizar.ts`):
POST con `Content-Type: text/plain` y cuerpo `{ peso, tipoCliente, tipoEnvio }` → `{ success, desglose: { tarifaBase, costoPeso, subtotal, descuentoAplicado, recargoAplicado, total } }`. Rechazo: `{ success: false, mensaje }`.
- [x] POST probado desde esta app contra la API real (2026-10-14): 5 kg, Frecuente, Estándar → $13.50 (base 5 + peso 10 − descuento 1.50), y el historial se refrescó solo.
- [ ] Confirmar los textos de `mensaje` para peso > 20 kg y datos inválidos.
- [x] `VITE_API_URL` en `.env.local` (ignorado por git). Falta cargarla en Vercel.

## Autenticación (implementada en `src/api/auth.ts`)
Todas son POST text/plain a la misma URL con `action`; errores `{ success: false, codigo, mensaje }`. Verificado contra la API real (v3.7, 2026-10-23):
- `register` `{nombre,email,password}` → `{success,mensaje,usuario}`. Errores: `EMAIL_EXISTENTE`, `NOMBRE_INVALIDO`.
- `login` `{email,password}` → `{success,token,expiraEn,usuario}` (sesión de 8 h). Error: `CREDENCIALES_INVALIDAS`.
- `logout` `{token}` → `{success,mensaje:"Sesión cerrada."}` (también con token falso).
- `changePassword` `{token,actual,nueva}` → `{success,mensaje:"Contraseña actualizada."}`. Errores: `PASSWORD_ACTUAL_INCORRECTA`, `PASSWORD_DEBIL` (mínimo 5 caracteres), `SESION_INVALIDA`.
- `forgot` `{email}` → `{success,mensaje:"Si el correo existe, recibirás un código de recuperación."}` (igual exista o no el correo; el código llega fuera de la app).
- `reset` `{email,codigo,nueva}` → `{success,mensaje:"Contraseña restablecida. Ya puedes iniciar sesión."}`. Error: `CODIGO_INVALIDO`.
- [x] `getHistorial` se autoriza con una **clave fija** de la API en `?token=` (no el token de sesión): se lee de `VITE_HISTORIAL_TOKEN` (en `.env.local`; falta cargarla en Vercel). Con el token de sesión o sin token responde `NO_AUTORIZADO`, que el Frontend muestra como error pero NO trata como sesión vencida; solo `SESION_INVALIDA` cierra la sesión. Respuesta nueva: trae `limit` (50) y `offset`; el Frontend aún no pagina contra el servidor.
- [ ] Cualquier variable `VITE_` queda dentro del JS público: quien abra la web puede leer la clave del historial, así que el login no protege esos datos. Backend debería autorizar el historial con el token de sesión.
- [ ] `cotizar` y `chat` hoy **ignoran** el token (con token falso responden normal). Confirmar si Backend lo va a exigir; el Frontend ya lo envía.
- [ ] No se pudo probar `reset` de punta a punta (el código no se devuelve). Probar con un correo real.
- [ ] Reglas de nombre y correo del servidor (el cliente solo valida formato básico).
- [ ] Rol/permisos: ¿todas las cuentas ven todo el historial o solo el propio?
- [ ] Cuenta de prueba creada en la API real durante la verificación: `prueba.frontend.auth@example.com` (contraseña `nueva123`). Borrarla de la hoja de usuarios.

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
- [x] Chat conectado a la API real (2026-10-15): `VITE_CHAT=on`. Verificados contra la API: estadística, saludo, fuera de contexto (chiste) y cálculo de tarifa; latencia 3–10 s (timeout del cliente: 25 s). Falta probar el resto de los 22 casos de la especificación §11 (inyecciones, límites, mensaje de 600 caracteres) y definir `VITE_CHAT=on` en Vercel.
- [x] Responsive verificado (2026-10-14) de 320 a 1920 px de ancho, incluido celular en horizontal: sin scroll de página, sin texto cortado, chat y modal dentro de la pantalla. Limitación: en una altura de ~520 px o menos el modal usa scroll interno de respaldo, y en horizontal (375 px de alto) la lista muestra solo 2 filas.
- [x] En móvil (<640 px) el chat abre a pantalla completa, el botón flotante desaparece y se cierra con la X (la lista de debajo queda inerte). En escritorio sigue como panel flotante.
- [ ] Probar en un celular real (táctil, teclado virtual en Android/iOS) y revisar el chat con lector de pantalla.
- [x] Chat publicado en Vercel con `VITE_CHAT=on` (2026-10-15): https://fastexpress-frontend.vercel.app/

## Entrega y proceso
- [x] Git inicializado y repo **privado** creado en https://github.com/DanielGalvis-Dev/fastexpress-frontend (2026-10-15). Commits con el correo noreply de GitHub, solo en este repo.
- [ ] Decidir si el repo pasa a público o se transfiere/comparte con el equipo y el docente (hoy es privado: nadie más lo ve).
- [ ] Confirmar con el docente que dos repositorios son aceptables (el enunciado dice "un repositorio estructurado").
- [ ] Conectar el repo a Vercel (previews por rama para QA).
- [ ] Decidir si se agregan pruebas E2E (Playwright o Cypress) y CI.
- [ ] Acordar con QA la convención de `data-testid` (hoy: `peso-input`, `peso-error`, `cliente-select`, `cliente-error`, `envio-estandar`, `envio-express`, `envio-error`, `cotizar-btn`, auth: `login-email-input/-error`, `login-password-input/-error`, `login-btn`, `login-api-error`, `login-aviso`, `registro-{nombre,email,password,confirmacion}-input/-error`, `registro-btn`, `registro-api-error`, `recuperar-{email,codigo,nueva,confirmacion}-input/-error`, `recuperar-enviar-btn`, `recuperar-btn`, `recuperar-api-error`, `cambiar-password-{actual,nueva,confirmacion}-input/-error`, `cambiar-password-btn`, `cambiar-password-api-error`, `usuario-menu-btn`, `usuario-nombre`, `cerrar-sesion-btn`, `ir-a-login/registro/recuperar`, `resultado`, `resultado-total`, `desglose-*`, `api-error`).
- [ ] Cobertura de pruebas del Frontend y su aporte al informe (la meta de 85 % es del Backend).
