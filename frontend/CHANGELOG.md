# Changelog

Todos los cambios relevantes de este proyecto se documentan aquí. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido
- Autenticación contra la API (Apps Script, `action` en el cuerpo): registro, ingreso, recuperación de contraseña en dos pasos (`forgot` + `reset`), cambio de contraseña (`changePassword`) y cierre de sesión (`logout`). Cliente en `src/api/auth.ts`.
- Ingreso obligatorio: sin sesión solo se ve la pantalla de ingreso/registro/recuperación; con sesión, la lista de cotizaciones y el asistente. Menú de cuenta (inicial de la persona) con «Cambiar contraseña» y «Cerrar sesión».
- Sesión en `localStorage` (`fastexpress.sesion`): se descarta al vencer `expiraEn`, se cierra sola a esa hora y vuelve al ingreso si la API responde `SESION_INVALIDA`.
- El token de sesión viaja en `cotizar` y `chat` (cuerpo JSON). `getHistorial` usa una clave fija de la API (`VITE_HISTORIAL_TOKEN`, en `?token=`), distinta del token de sesión.
- Validaciones del cliente para nombre, correo, contraseña (mínimo 5 caracteres, confirmada por la API), confirmación y código.
- `ApiError` conserva el `codigo` de la API.
- `data-testid` nuevos para QA (`login-*`, `registro-*`, `recuperar-*`, `cambiar-password-*`, `usuario-*`, `cerrar-sesion-btn`).
- 296 pruebas automatizadas (130 nuevas sobre las 166 anteriores).

## [0.2.0] - 2026-10-15

### Cambiado
- El asistente de IA se conecta a la API real (`action: "chat"`, Gemini) con `VITE_CHAT=on`; el mock queda disponible con `VITE_CHAT=mock` para demostraciones.

### Desplegado
- Frontend publicado en https://fastexpress-frontend.vercel.app/ con `VITE_API_URL` y `VITE_CHAT=on`.

## [0.1.0] - 2026-10-15

Primera versión funcional del Frontend.

### Añadido
- Vista principal con las cotizaciones registradas (historial de la API), con búsqueda por cualquier columna (sin distinguir tildes ni mayúsculas) y paginación que se ajusta a la altura de la pantalla, sin scroll de página.
- Formulario «Nueva cotización» en un modal: peso, tipo de cliente y tipo de envío, con el resultado y su desglose en el mismo modal.
- Validaciones en el cliente: el peso solo admite números y un separador decimal, entre 0.01 y 20.00 kg; selects obligatorios; errores junto a cada campo.
- Confirmaciones con SweetAlert2: antes de registrar una cotización y al cerrar el formulario cuando hay datos sin registrar.
- Botón «Actualizar» (ícono) que avisa cuántas cotizaciones nuevas hay.
- Cliente de la API de Google Apps Script para cotización e historial.
- Asistente de IA flotante (pantalla completa en móvil) conectado a un mock de demostración (`VITE_CHAT=mock`); la especificación para Backend está en `docs/ESPECIFICACION_BACKEND_ASISTENTE_IA.md`.
- Diseño responsive de 320 a 1920 px de ancho.
- 166 pruebas automatizadas (Vitest y Testing Library).
