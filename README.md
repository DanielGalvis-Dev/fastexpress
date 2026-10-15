# FastExpress — Frontend

Interfaz del Módulo de Cotización de Envíos y Descuentos "FastExpress" (Proyecto Integrador, Calidad de Software).
Consume la API REST del Backend; no calcula tarifas.

**Stack:** React + TypeScript, Vite, Tailwind CSS v4, SweetAlert2, Vitest + React Testing Library, npm. Despliegue previsto: Vercel.

## Comandos

```bash
npm install
cp .env.example .env.local   # completar VITE_API_URL
npm run dev                  # servidor de desarrollo
npm test                     # pruebas (vitest run)
npm run build                # tsc + vite build
npm run lint
```

## Estructura

- `src/types.ts` — enums (`TipoCliente`, `TipoEnvio`) y tipos de solicitud/resultado.
- `src/lib/validation.ts` — validaciones del cliente (peso 0.01–20.00, selects obligatorios).
- `src/api/cotizar.ts` — único punto de contacto con la API (contrato por confirmar).
- `src/api/chat.ts` + `chatMock.ts` — cliente del asistente de IA y su mock de demostración (`VITE_CHAT=mock|on`; vacío lo oculta). Contrato en `docs/ESPECIFICACION_BACKEND_ASISTENTE_IA.md`.
- `src/components/` — `ChatWidget` (asistente flotante), `HistorialList` (vista principal: búsqueda + paginación sin scroll), `Modal`, `CotizadorForm` y `ResultadoView`.
- `src/lib/` — validaciones, búsqueda (`busqueda.ts`, sin tildes y por palabras), formato y el hook `useFilasPorPagina`.
- `data-testid` en campos, errores, botón y resultado para las pruebas de caja negra de QA.

## Pendientes

Ver [PENDIENTES.md](./PENDIENTES.md).

> Nota: no ubicar este proyecto dentro de Google Drive (`H:\Mi unidad`); `npm install` falla ahí con `EBADF`.
