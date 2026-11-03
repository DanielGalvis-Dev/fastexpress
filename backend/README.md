# Backend — FastExpress

API REST del módulo de cotización de envíos y descuentos, en **Google Apps Script** (web app) con datos en **Supabase**.
**Responsable:** Backend.

## Estructura

```
backend/
├── src/
│   ├── Codigo.js        Punto de entrada y lógica de negocio
│   ├── Supabase.js      Capa de datos (cliente REST de Supabase)
│   ├── Login.js         Autenticación (prefijo auth*)
│   └── appsscript.json  Manifiesto del proyecto (zona horaria, runtime V8, web app)
├── tests/
│   ├── unitarias/       Caja negra y caja blanca de calcularTarifa, utilidades y herramientas
│   ├── api/             doGet, doPost, cotización y chat con IA (servicios simulados)
│   └── helpers/         Simulación de Apps Script y transformador de Jest
├── jest.config.js       Configuración de Jest y umbral de cobertura (85 %)
└── package.json         Scripts: npm test · npm run coverage
```

## Pruebas

```
cd backend
npm install
npm test               # 144 pruebas
npm run coverage       # + cobertura; falla si líneas o ramas < 85 %
```

Resultado actual sobre `src/Codigo.js`: **100 % de líneas y 98 % de ramas**. El código de `src/` no se modifica para probarlo: un transformador de Jest añade el `module.exports` solo en memoria. Detalle y evidencias en `docs/informe-tecnico/` y `pruebas/`.

Las pruebas no tocan servicios reales: Supabase, Gemini y los servicios de Google están simulados.

El código es una copia exacta del proyecto de Apps Script, descargada con `clasp`.
En Apps Script los archivos se llaman `Código.gs`, `Supabase.gs` y `Login.gs`; aquí llevan extensión `.js`, que es la que usa `clasp`.

## Qué hace cada archivo

| Archivo | Contenido |
|---|---|
| `Codigo.js` | `doGet` y `doPost` (único punto de entrada: la URL del web app no cambia), `CONFIG` con las reglas BR-01 a BR-04, `procesarCotizacion`, `calcularTarifa`, asistente de IA con Gemini (`atendedorChatIA`, `llamarGeminiAPI`, límite de uso por sesión) y funciones de prueba manuales (`probarCalcularTarifa`, `probarHistorial`). |
| `Supabase.js` | Cliente REST (`sbFetch_`) y persistencia: `registrarCotizacionEnSheet`, `obtenerHistorialCompleto`, `generarSnapshotEstadistico`, `registrarEnBitacora`, `supabaseProbarConexion`. |
| `Login.js` | `register`, `login`, `logout`, `validate`, `changePassword`, `forgot`, `reset`; hash de contraseñas, bloqueo por intentos fallidos y limpieza de sesiones (`authLimpiarSesiones`, `authInstalarTrigger`, `authDesbloquear`). |

## Endpoints

- `GET ?action=getConfig` — reglas vigentes.
- `GET ?action=getHistorial` — historial de cotizaciones (autorizado con `?token=`).
- `POST` (cuerpo JSON, `Content-Type: text/plain`):
  - Sin `action`: cotización `{ peso, tipoCliente, tipoEnvio }`.
  - `action: "chat"`: asistente de IA.
  - `action`: `register`, `login`, `logout`, `validate`, `changePassword`, `forgot`, `reset` (ver `Login.js`).

El contrato visto desde el Frontend está en `docs/api/contrato-api.md`.

## Configuración (Propiedades del script)

Se definen en Apps Script, en *Configuración del proyecto → Propiedades del script*. **Nunca van en el repo.**

| Propiedad | Uso |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Obligatorias: conexión a Supabase. |
| `GEMINI_API_KEY` | Obligatoria para el chat. |
| `GEMINI_MODEL`, `ZONA_HORARIA` | Opcionales (por defecto `gemini-2.5-flash` y `America/Bogota`). |
| `API_TOKEN` | Si existe, `getHistorial` exige `?token=`. |
| `CODIGO_REGISTRO` | Si existe, `register` exige ese código. |
| `SPREADSHEET_ID`, `HOJA_COTIZACIONES` | Heredadas de la versión con Google Sheets; solo aparecen en código comentado. |

## Sincronizar con Apps Script

Con [`clasp`](https://github.com/google/clasp) y la cuenta dueña del proyecto:

```
npx @google/clasp login
npx @google/clasp clone <scriptId> --rootDir backend/src   # bajar
npx @google/clasp push                                      # subir
npx @google/clasp logout
```

Lo que está en ejecución es el proyecto de Apps Script; este repo es su copia versionada. Si se edita allí, hay que volver a bajarlo y commitearlo.

## Notas

- El encabezado de `Codigo.js` aún dice «Versión: 3.0», pero `CONFIG.VERSION` dice «v4.1». Conviene unificarlo.
- `Login.js` de Apps Script trae 3 funciones más que el antiguo `Backend.zip` (`authLimpiarSesiones`, `authInstalarTrigger`, `authDesbloquear`).
- En Apps Script existe además `LoginAuth.gs`, una copia antigua de `Login` toda comentada; no se versiona.

## Pendiente de completar por Backend

- Cubrir también `Login.js` y `Supabase.js` con pruebas (hoy la medición de cobertura es solo sobre `Codigo.js`).
- Cómo desplegar la web app y dónde queda la URL (el Frontend la lee de `VITE_API_URL`).
