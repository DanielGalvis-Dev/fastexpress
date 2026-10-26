# FastExpress — Frontend

Interfaz del Módulo de Cotización de Envíos y Descuentos "FastExpress" (Proyecto Integrador, Calidad de Software).
Consume la API REST del Backend; no calcula tarifas.

Esta carpeta es el Frontend del repositorio único de FastExpress (junto a `backend/`, `pruebas/` y `docs/`; ver el [README de la raíz](../README.md)).

**Stack:** React + TypeScript, Vite, Tailwind CSS v4, SweetAlert2, Vitest + React Testing Library, npm. Despliegue: Vercel, con *Root Directory* = `frontend`.

## Comandos

Se corren desde esta carpeta (`frontend/`):

```bash
npm install
cp .env.example .env.local   # completar VITE_API_URL
npm run dev                  # servidor de desarrollo
npm test                     # pruebas (vitest run)
npm run build                # tsc + vite build
npm run lint
```

## Variables de entorno

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL de la web app de Apps Script (termina en `/exec`). Obligatoria. |
| `VITE_HISTORIAL_TOKEN` | Clave fija con la que la API autoriza `getHistorial` (la entrega Backend). Obligatoria. Cárgala también en Vercel. |
| `VITE_CHAT` | Asistente de IA: `mock` (respuestas de demostración), `on` (API real, en uso en producción) o vacío (oculto). |

Se definen en `.env.local` (no se commitea); `.env.example` es la plantilla.

## Estructura

- `src/types.ts` — enums (`TipoCliente`, `TipoEnvio`) y tipos de solicitud/resultado.
- `src/lib/validation.ts` — validaciones del cliente (peso 0.01–20.00, selects obligatorios).
- `src/api/` — cliente de la API de Apps Script: cotización (`cotizar.ts`), historial (`historial.ts`) y autenticación (`auth.ts`: registro, ingreso, recuperación, cambio de contraseña, cierre de sesión); contrato verificado contra la API real.
- `src/lib/sesion.ts` + `SesionProvider.tsx` + `useSesion.ts` — sesión en `localStorage`, vencimiento automático y cierre cuando la API rechaza el token.
- `src/api/chat.ts` + `chatMock.ts` — cliente del asistente de IA contra la API real (`VITE_CHAT=on`) y su mock de demostración (`mock`); vacío lo oculta. Contrato en `docs/ESPECIFICACION_BACKEND_ASISTENTE_IA.md`.
- `src/components/` — `ChatWidget` (asistente flotante), `HistorialList` (vista principal: búsqueda + paginación sin scroll), `Modal`, `CotizadorForm` y `ResultadoView`; de autenticación: `PantallaAuth`, `LoginForm`, `RegistroForm`, `RecuperarForm`, `CambiarPasswordForm`, `MenuUsuario` y `CampoTexto`.
- `src/lib/` — validaciones, búsqueda (`busqueda.ts`, sin tildes y por palabras), formato y el hook `useFilasPorPagina`.
- `data-testid` en campos, errores, botón y resultado para las pruebas de caja negra de QA.

## Historial de cambios y pendientes

Ver [CHANGELOG.md](./CHANGELOG.md) y [PENDIENTES.md](./PENDIENTES.md).

> Nota: no ubicar el repositorio dentro de Google Drive (`H:\Mi unidad`); `npm install` falla ahí con `EBADF`.
