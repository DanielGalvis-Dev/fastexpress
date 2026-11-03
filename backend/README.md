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
└── tests/
    ├── unitarias/       Pruebas de la función de cálculo (pendiente)
    └── api/             Pruebas de endpoints y del contrato (pendiente)
```

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

- Extraer `calcularTarifa` a una función aislada y testeable (hoy vive junto al resto de `Codigo.js`).
- `package.json` con la suite de pruebas (Jest o equivalente) y script de cobertura (`npm test`, `npm run coverage`); mínimo 85 % de líneas y ramas.
- Cómo desplegar la web app y dónde queda la URL (el Frontend la lee de `VITE_API_URL`).
