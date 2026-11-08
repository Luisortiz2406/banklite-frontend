# Frontend (`banklite-frontend`)

[![Despliegue](https://github.com/Luisortiz2406/banklite-frontend/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/Luisortiz2406/banklite-frontend/actions/workflows/deploy.yml)

Aplicación web de **BankLite** (banco digital académico) y panel administrativo de
empleados. Sitio estático (HTML, JavaScript y CSS sin framework) servido con nginx;
todos los datos vienen de la API a través del **api-gateway**.

## Estructura

- Páginas del cliente: `index.html` (landing), `registro.html`, `login.html`,
  `dashboard.html`, `transferir.html`, `llaves.html`, `movimientos.html`,
  `pagos.html`, `qr.html`, `puntos.html`, `inversiones.html`, `ayuda.html` y las
  páginas legales.
- Un `<vista>.js` por página, cargado después de `comun.js` (utilidades de interfaz)
  y `api.js` (cliente de la API, sesión y URL del gateway).
- `admin/`: panel de empleados, publicado en `/admin/` (clientes, cuentas,
  movimientos, fraude, cumplimiento, monitoreo, auditoría y empleados).
- `nginx.conf`: encabezados de seguridad (CSP sin scripts inline, `frame-ancestors
  'none'`, …), `robots.txt` que bloquea el rastreo y el enrutamiento del panel. La
  CSP solo admite scripts de terceros para el widget de Wompi (`checkout.wompi.co` y
  sus scripts antifraude) y su iframe.
- `recargas.js`: «Recargar saldo» en el inicio. Pide la recarga a deposit-service
  (`/deposits`), abre el widget de Wompi (tarjeta, PSE, Nequi; sandbox) y consulta el
  resultado; el saldo lo abona el backend cuando Wompi confirma.
- `cierre-cuenta.js`: «Cancelar mi cuenta» (Mi perfil). Muestra lo que falta para
  cancelar (`GET /accounts/cierre/requisitos`; si hay saldo ofrece enviarlo con
  `transferir.html?monto=`), pide la clave y el código por WhatsApp
  (`/auth/cierre/iniciar` y `/auth/cierre/confirmar`, que entregan un ticket de cierre)
  y la palabra CANCELAR (`POST /accounts/cierre`). Al terminar cierra la sesión local y
  el login muestra la confirmación (`login.html?sesion=cancelada`).
- `admin/` › Cumplimiento: alertas «cuenta cerrada con saldo»
  (`/accounts/admin/closure-alerts`): un administrador reversa el movimiento y
  cumplimiento marca la alerta como resuelta.
- `qr-lib.js`: librerías de terceros para generar y leer QR (no se editan a mano).

## URL de la API

`api.js` usa el gateway de producción (https://api-gateway-production-dd7f.up.railway.app) siempre que la página **no**
se sirva desde `localhost`/`127.0.0.1`. Servida desde `localhost`, apunta al gateway
local (`http://localhost:8080`).

## Ejecutar en local

```bash
python -m http.server 5500     # http://localhost:5500 (sin encabezados de nginx)
```

Con Docker (igual que en producción, con los encabezados de nginx):

```bash
docker build -t banklite-frontend .
docker run -e EVAL_CODE=codigo-local-1234 -p 5500:80 banklite-frontend   # luego abre /acceso.html
```

### Acceso de evaluación (página de acceso)

Todo el sitio, incluido `/admin/`, pide un **código de evaluación**. Sin él, nginx redirige
a `/acceso.html`: la persona escribe el código, `acceso.js` lo manda a `POST /acceso/entrar`
y nginx lo compara con la variable de entorno `EVAL_CODE`. Si coincide, deja la cookie
`banklite_eval` (`HttpOnly`, `Secure`, `SameSite=Lax`, 7 días); si no, la página muestra
un mensaje. El código **no** está en el repositorio, ni en la imagen, ni en el JavaScript:
`scripts/entrypoint.sh` genera la configuración de nginx al arrancar el contenedor.

| Variable    | Uso                                                                    |
| ----------- | ---------------------------------------------------------------------- |
| `EVAL_CODE` | código de evaluación: 12 a 128 caracteres, solo `A-Z a-z 0-9 - _`       |

En Railway se define en el servicio del frontend (*Variables*). Si falta o no cumple el
formato, el contenedor no arranca y lo dice en el log, para no publicar el sitio sin protección.
Públicos sin código: `/acceso.html`, `/acceso.css`, `/acceso.js`, `/theme-init.js`,
`/acceso/entrar`, `/robots.txt` (también es el health check de Railway) y
`/googlec275dac7ffdbde9a.html` (verificación de Google Search Console).

### Fotos de destinos (Beneficios > Viajes)

Fotos reales de [Wikimedia Commons](https://commons.wikimedia.org/) (CC0, CC BY, CC BY-SA o dominio
público), guardadas en `img/destinos/` como WebP de 800×450: nada se carga desde afuera y la CSP no
cambia. Quedan detrás del código de evaluación, como el resto del sitio. Los créditos que exige cada
licencia (autor, licencia y enlace) están en `fotos-destinos.js`, que es la fuente del pie *Créditos
de las fotos*, y en `img/destinos/CREDITOS.md`. Al cambiar una foto hay que actualizar los dos:
`npm test` comprueba que coincidan.

## Estilo de código

```bash
npm install
npm run lint             # ESLint
npm run format:check     # Prettier (comillas dobles, 4 espacios)
```

Los scripts no son módulos y comparten funciones globales; `eslint.config.mjs` las
detecta solo. `qr-lib.js` y los `.html` no se formatean.

## Pruebas

El pipeline (`.github/workflows/deploy.yml`, job **test**) corre lint y formato y luego
`scripts/probar-imagen.sh`: construye la imagen de nginx y comprueba que no arranque sin
`EVAL_CODE` válido, que sin la cookie de acceso todo redirija a `/acceso.html` (salvo las
rutas públicas), que `/acceso/entrar` deje la cookie solo con el código correcto, que con
la cookie sirva la app, el panel `/admin/` y la CSP, y que no publique el código ni
archivos de configuración (`Dockerfile`, `nginx.conf`, `package.json`). En local se corre igual con `sh scripts/probar-imagen.sh`
(necesita Docker).

## Despliegue

Lo despliega **GitHub Actions** (`.github/workflows/deploy.yml`, que usa el workflow
reutilizable de [banklite-pipelines](https://github.com/Luisortiz2406/banklite-pipelines)):

1. **test**: lint, formato y prueba de la imagen de nginx (`scripts/probar-imagen.sh`: rutas de la app y del panel, archivos de configuración no publicados y CSP) (también en cada pull request).
2. **docker** (solo `main`): imagen en GHCR `ghcr.io/luisortiz2406/banklite-frontend`,
   etiquetada con el SHA del commit y `latest` (se guardan las últimas 5).
3. **deploy** (solo `main`): `railway up --ci` sube el commit a Railway, que lo
   construye con el `Dockerfile` y aplica `railway.json` (health check en `/robots.txt`, que no pide clave);
   el job espera a que el despliegue quede activo.

El repositorio está desconectado del autodeploy de Railway: un push a `main` despliega
solo a través de este pipeline, y únicamente si las pruebas pasan. Rollback: panel de
Railway → *Deployments* → versión anterior → *Rollback*.

- Aplicación web: [https://frontend-production-eff3c.up.railway.app](https://frontend-production-eff3c.up.railway.app)
- Panel administrativo: [https://frontend-production-eff3c.up.railway.app/admin/](https://frontend-production-eff3c.up.railway.app/admin/)
- Estado de la API (los 13 servicios y sus bases): [https://api-gateway-production-dd7f.up.railway.app/health](https://api-gateway-production-dd7f.up.railway.app/health)

## Repositorios relacionados

Servicios de BankLite con los que se comunica este. **Llama a** / **Lo llama**: HTTP
por la red interna; **Recibe** / **Envía**: eventos en RabbitMQ. Cada uno vive y se
despliega desde su propio repositorio.

| Repositorio | Relación con este servicio |
|---|---|
| [banklite-api-gateway](https://github.com/Luisortiz2406/banklite-api-gateway) | **Llama a:** toda la API (es el único servicio que consume) |
