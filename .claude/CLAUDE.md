# Proyecto Integrador — FastExpress (Calidad de Software)

Módulo de Cotización de Envíos y Descuentos "FastExpress". Equipo de 3 integrantes: Backend, Frontend y QA.
Fuente de verdad: `docs/enunciado/PROYECTO_INTEGRADOR.docx`.

## Estructura del repositorio (repo único, 2026-10-26)

Todo lo que pide el profesor vive en un solo repo (`DanielGalvis-Dev/fastexpress-frontend`; el nombre es histórico):

- `frontend/` — React + Vite + Tailwind + TypeScript. Todos los comandos `npm` se corren aquí.
- `backend/` — API (Google Apps Script) y sus pruebas (`src/`, `tests/unitarias/`, `tests/api/`). Lo sube Backend.
- `pruebas/` — documentos y evidencias de QA: `caja-negra/`, `caja-blanca/` (con `cfg/`), `integracion/`, `cobertura/`. El código de las pruebas automatizadas va junto a cada stack.
- `docs/` — `enunciado/`, `informe-tecnico/`, `api/` (contrato), `diseno/`, `referencia/` (`index.html` de pruebas del equipo).
- `.claude/` — instrucciones de Claude Code (este archivo y `rules/`).

## Rol activo: Desarrollador Frontend

Responsabilidades (según el documento):
- Diseñar e implementar la interfaz de usuario.
- Conectar formularios y vistas con la API REST del Backend.
- Aplicar validaciones básicas de entrada en el cliente (UI).

Colaboración con otros roles:
- **QA**: el Plan de Pruebas de Caja Negra es compartido (QA + Frontend). La UI debe ser testeable: usar atributos `data-testid` en inputs, selects, botón y resultado.
- **Backend**: el contrato de la API manda. Las validaciones del cliente NO reemplazan las del servidor; la UI debe mostrar los errores que devuelva la API (p. ej. peso > 20 kg rechazado).

## Alcance de la UI

Formulario de cotización con los campos:
- `Peso` (kg, numérico, decimales)
- `Tipo de cliente`: `NUEVO` | `FRECUENTE` | `VIP`
- `Tipo de envío`: `ESTANDAR` | `EXPRESS`
- `Monto` — el documento lo menciona en el plan de pruebas (E.P. y BVA para `Peso` y `Monto`) pero no lo define. Confirmar con el equipo si es el monto calculado (salida) o un campo de entrada.

Vista de resultado: desglose de la cotización (tarifa base, costo por peso, descuento, recargo, total) o mensaje de rechazo.

## Reglas de negocio de referencia

Ver `.claude/rules/reglas-negocio.md`. La UI no calcula tarifas; solo valida entradas y presenta lo que responde la API.

## Validaciones del cliente

Ver `.claude/rules/validaciones-ui.md`.

## Entregables donde participa Frontend

1. Código del Frontend en `frontend/` del repositorio GitHub, junto al Backend (`backend/`), con suite de pruebas automatizadas configurada (Jest o equivalente según el stack).
2. Informe técnico, sección 1: Plan de Pruebas de Caja Negra (con QA) — particiones de equivalencia, BVA y tabla de decisión Tipo de Cliente + Tipo de Envío.
3. Colaboración en la documentación final (todos los miembros).

## Hoja de ruta (Frontend)

- **Semana 1**: leer requisitos, apoyar a QA en la matriz de caja negra, bocetar la UI.
- **Semana 2**: crear las vistas y conectarlas a la API del Backend.
- **Semana 3**: apoyar pruebas y corregir defectos de UI.
- **Semana 4**: pruebas de caja negra e integración final, redacción del informe.

## Stack y comandos

- Framework UI: **React** (decidido).
- Estilos: **Tailwind CSS** (decidido). Sin librería de componentes por ahora; usar utilidades de Tailwind y tokens en la configuración (colores, tipografía) en vez de valores sueltos.
- API: Google Apps Script (web app), ajena al alcance del Frontend. URL en variable de entorno (`VITE_API_URL` si se usa Vite). Ver `.claude/rules/api-contrato.md`.
- Despliegue: **Vercel** (decidido). Frontend en `frontend/` del repo único (en Vercel, *Root Directory* = `frontend`); Vercel genera previews por rama/PR para que QA pruebe contra una URL real.
- Bundler: **Vite** (decidido). Con Tailwind v4 se usa el plugin `@tailwindcss/vite` y los tokens van en el CSS con `@theme`.
- Pruebas: **Vitest** (viene de la mano de Vite) + React Testing Library — _por confirmar_.
- Variables de entorno: prefijo `VITE_` (p. ej. `VITE_API_URL`).
- Lenguaje: **TypeScript** (decidido). Tipar el contrato de la API y los enums (`TipoCliente`, `TipoEnvio`); evitar `any`.
- Gestor de paquetes: **npm** (decidido). Commitear `package-lock.json`.
- Comandos (desde `frontend/`): `npm run dev` · `npm test` · `npm run build` · `npm run lint`
- URL base de la API: _por definir_ (se configura en `VITE_API_URL`)

## Estado del código (2026-10-23)

- El repo único vive en **`C:\Users\DG\proyectos\fastexpress-frontend`**, fuera de Google Drive: `npm install` falla en Drive con `EBADF`. La carpeta de Drive del proyecto solo conserva el enunciado y documentación de trabajo. Subido (2026-10-15) a **https://github.com/DanielGalvis-Dev/fastexpress-frontend** (privado, rama `main`). Reestructurado el 2026-10-26: el código del Frontend pasó a `frontend/` y se crearon `backend/`, `pruebas/` y `docs/`.
- Vista principal: lista de cotizaciones (del historial de la API) con búsqueda y paginación, sin scroll de página: la tabla calcula cuántas filas caben en la altura y pagina según eso; en pantallas angostas se compacta (sin scroll horizontal). El formulario va en un **modal** que abre «Nueva cotización» y muestra el resultado en el mismo modal. SweetAlert2 (envuelto en `src/lib/alertas.ts`) se usa en 3 sitios: confirmar antes de registrar una cotización, avisar cuántas nuevas hay al pulsar «Actualizar», y confirmar el cierre del modal solo si hay datos sin registrar (X, Escape o clic fuera). La validación de campos sigue en línea, sin alertas. Asistente de IA: widget flotante (botón circular abajo a la derecha) conectado a la API real (`action: "chat"`, Gemini) desde 2026-10-15; se activa con `VITE_CHAT=on` (`mock` para demo sin backend) y su contrato está en `frontend/docs/ESPECIFICACION_BACKEND_ASISTENTE_IA.md`. Producción: https://fastexpress-frontend.vercel.app/. **Autenticación (2026-10-23, sin commitear aún):** ingreso obligatorio, registro, recuperación (`forgot`/`reset`), cambio de contraseña y logout contra la API real; sesión en `localStorage`; token enviado en cotizar, chat e historial. El historial se autoriza con una clave fija (`VITE_HISTORIAL_TOKEN`, falta cargarla en Vercel). Versión 0.3.0 (ver `frontend/CHANGELOG.md`). 296 pruebas, build y lint pasan.
- Contrato de la API **confirmado y probado** contra la API real (POST de cotización y `GET ?action=getHistorial`); ver `.claude/rules/api-contrato.md`. Aislado en `src/api/`.
- Lista de pendientes: `frontend/PENDIENTES.md`.

## Skills de diseño frontend

Ver `.claude/rules/skills-frontend.md` (frontend-design de Claude + Impeccable). Por ahora solo se prepara el ambiente; no se instala ni ejecuta nada hasta que se indique.

## Convenciones

- Idioma de la interfaz y la documentación: español.
- Valores de enums enviados a la API en MAYÚSCULAS exactamente como en las reglas de negocio.
- Mensajes de error claros y cercanos al campo; no depender solo del color.
