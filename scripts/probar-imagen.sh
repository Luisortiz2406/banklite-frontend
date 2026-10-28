#!/bin/sh
# Construye la imagen de nginx y comprueba que sirva la app y el panel admin, que
# los archivos de configuración no queden publicados y que mande la CSP.
# La corre el pipeline (prueba-extra de banklite-pipelines); en local necesita Docker.
set -e

docker build -t banklite-frontend .
docker rm -f frontend-prueba > /dev/null 2>&1 || true
docker run -d --name frontend-prueba -p 8080:80 banklite-frontend
trap 'docker rm -f frontend-prueba > /dev/null 2>&1 || true' EXIT

for i in $(seq 1 20); do curl -fs http://localhost:8080/ > /dev/null && break; sleep 1; done
for ruta in / /login.html /dashboard.html /api.js /styles.css /admin/ /robots.txt; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:8080$ruta")
  echo "$ruta -> $code"
  [ "$code" = 200 ] || exit 1
done
# Archivos de configuración que no deben quedar publicados. Una ruta desconocida
# responde index.html (try_files de nginx), así que se revisa el contenido.
if curl -s http://localhost:8080/Dockerfile | grep -q 'FROM nginx'; then echo "Dockerfile publicado"; exit 1; fi
if curl -s http://localhost:8080/nginx.conf | grep -q 'try_files'; then echo "nginx.conf publicado"; exit 1; fi
if curl -s http://localhost:8080/package.json | grep -q 'devDependencies'; then echo "package.json publicado"; exit 1; fi
if curl -s http://localhost:8080/eslint.config.mjs | grep -q 'defineConfig'; then echo "eslint.config.mjs publicado"; exit 1; fi
curl -fsI http://localhost:8080/ | grep -i "content-security-policy"
