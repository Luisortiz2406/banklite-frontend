# Frontend (`banklite-frontend`)

[![CI](https://github.com/Luisortiz2406/banklite-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/Luisortiz2406/banklite-frontend/actions/workflows/ci.yml)

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
docker run -p 5500:80 banklite-frontend
```

## Estilo de código

```bash
npm install
npm run lint             # ESLint
npm run format:check     # Prettier (comillas dobles, 4 espacios)
```

Los scripts no son módulos y comparten funciones globales; `eslint.config.mjs` las
detecta solo. `qr-lib.js` y los `.html` no se formatean.

## Pruebas

El CI (`.github/workflows/ci.yml`) corre lint y formato, construye la imagen de nginx
y comprueba que sirva la app, el panel `/admin/` y la CSP, y que no publique
archivos de configuración (`Dockerfile`, `nginx.conf`, `package.json`).

## Despliegue

Desplegado en Railway **desde este repositorio** (rama `main`): `railway.json` en la
raíz define el build por `Dockerfile` (nginx) y el health check en `/`; cada push a
`main` redespliega el sitio.

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
