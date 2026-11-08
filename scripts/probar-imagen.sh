#!/bin/sh
# Construye la imagen de nginx y comprueba:
# - que sin EVAL_USER/EVAL_PASSWORD el contenedor no arranque y diga por qué;
# - que sin credenciales todo responda 401, salvo robots.txt y la verificación de Google;
# - que con credenciales sirva la app y el panel admin, con la CSP;
# - que los archivos de configuración no queden publicados.
# Las credenciales de la prueba se generan al azar en cada corrida (no hay ninguna en el repo).
# La corre el pipeline (prueba-extra de banklite-pipelines); en local necesita Docker.
set -e

base=http://localhost:8080
docker build -t banklite-frontend .
limpiar() { docker rm -f frontend-prueba frontend-sin-clave > /dev/null 2>&1 || true; }
limpiar
trap limpiar EXIT

# 1. Sin variables de evaluación el contenedor debe terminar con error y un mensaje claro.
docker run -d --name frontend-sin-clave banklite-frontend > /dev/null
for i in $(seq 1 20); do
  [ "$(docker inspect -f '{{.State.Running}}' frontend-sin-clave)" = false ] && break
  sleep 1
done
estado=$(docker inspect -f '{{.State.Running}} {{.State.ExitCode}}' frontend-sin-clave)
echo "sin EVAL_USER/EVAL_PASSWORD -> running/exit: $estado"
case "$estado" in
  true* | "false 0") echo "El contenedor arrancó (o terminó sin error) sin credenciales de evaluación"; exit 1 ;;
esac
if ! docker logs frontend-sin-clave 2>&1 | grep -q 'faltan las variables de entorno EVAL_USER y/o EVAL_PASSWORD'; then
  echo "El contenedor no explica por qué no arranca:"; docker logs frontend-sin-clave; exit 1
fi

# 2. Con credenciales de prueba (al azar; la clave lleva caracteres especiales a propósito).
usuario=evaluador-ci
clave="ci \$&:'$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')"
docker run -d --name frontend-prueba -e EVAL_USER="$usuario" -e EVAL_PASSWORD="$clave" \
  -p 8080:80 banklite-frontend > /dev/null
for i in $(seq 1 20); do curl -fs "$base/robots.txt" > /dev/null && break; sleep 1; done

# esperar <código> <descripción> <ruta> [opciones de curl...]
esperar() {
  esperado=$1; desc=$2; ruta=$3; shift 3
  code=$(curl -s -o /dev/null -w '%{http_code}' "$@" "$base$ruta")
  echo "$ruta ($desc) -> $code"
  [ "$code" = "$esperado" ] || { echo "se esperaba $esperado"; exit 1; }
}

for ruta in / /login.html /dashboard.html /api.js /styles.css /admin/ /no-existe; do
  esperar 401 "sin credenciales" "$ruta"
done
esperar 401 "clave incorrecta" / -u "$usuario:otra-clave"
for ruta in / /login.html /dashboard.html /api.js /styles.css /admin/; do
  esperar 200 "con credenciales" "$ruta" -u "$usuario:$clave"
done

# Rutas abiertas para Google, sin credenciales y con su contenido exacto (una ruta que
# no existe respondería index.html o 401, así que se revisa también el cuerpo).
esperar 200 "sin credenciales" /robots.txt
if ! curl -fs "$base/robots.txt" | grep -qx 'Disallow: /'; then echo "robots.txt sin Disallow: /"; exit 1; fi
verif=googlec275dac7ffdbde9a.html
esperar 200 "sin credenciales" "/$verif"
if ! curl -fs "$base/$verif" | grep -qx "google-site-verification: $verif"; then
  echo "/$verif no se publica: se pierde la verificación de Search Console"; exit 1
fi

# Archivos de configuración que no deben quedar publicados (aun con credenciales). Una
# ruta desconocida responde index.html (try_files de nginx), así que se revisa el contenido.
auth="$usuario:$clave"
if curl -s -u "$auth" "$base/Dockerfile" | grep -q 'FROM nginx'; then echo "Dockerfile publicado"; exit 1; fi
if curl -s -u "$auth" "$base/nginx.conf" | grep -q 'try_files'; then echo "nginx.conf publicado"; exit 1; fi
if curl -s -u "$auth" "$base/package.json" | grep -q 'devDependencies'; then echo "package.json publicado"; exit 1; fi
if curl -s -u "$auth" "$base/eslint.config.mjs" | grep -q 'defineConfig'; then echo "eslint.config.mjs publicado"; exit 1; fi
if curl -s -u "$auth" "$base/scripts/entrypoint.sh" | grep -q 'EVAL_PASSWORD'; then echo "entrypoint.sh publicado"; exit 1; fi
curl -fsI -u "$auth" "$base/" | grep -i "content-security-policy"
