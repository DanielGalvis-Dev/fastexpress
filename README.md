# FastExpress — Módulo de Cotización de Envíos y Descuentos

Proyecto Integrador de Calidad de Software. Repositorio único con Frontend, Backend, pruebas y documentación.

## Estructura

| Carpeta | Contenido | Responsable |
|---|---|---|
| [`frontend/`](frontend/) | Interfaz React + Vite + Tailwind (TypeScript) | Frontend |
| [`backend/`](backend/) | API REST (Google Apps Script) y sus pruebas | Backend |
| [`pruebas/`](pruebas/) | Caja negra, caja blanca, integración y cobertura | QA |
| [`docs/`](docs/) | Enunciado, informe técnico, contrato de la API, diseño | Todos |

## Cómo correr

- **Frontend:** `cd frontend && npm install && npm run dev` (pruebas: `npm test`). Ver `frontend/README.md`.
- **Backend:** ver `backend/README.md`.

## Reglas de negocio

BR-01 tarifa base $5.00 · BR-02 $2/kg hasta 5 kg, $4/kg hasta 20 kg, más se rechaza · BR-03 descuento NUEVO 0 %, FRECUENTE 10 %, VIP 20 % · BR-04 recargo EXPRESS +25 %.
Detalle en `.claude/rules/reglas-negocio.md`.
