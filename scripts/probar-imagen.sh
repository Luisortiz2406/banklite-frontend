#!/bin/sh
# Construye la imagen de nginx y comprueba:
# - que sin EVAL_CODE (o con uno inválido) el contenedor no arranque y diga por qué;
# - que sin la cookie de acceso todo redirija a acceso.html, incluido /admin/, salvo las
#   rutas públicas (acceso.html y sus CSS/JS, robots.txt y la verificación de Google);
# - que POST /acceso/entrar deje la cookie solo con el código correcto;
# - que con la cookie se sirvan la app y el panel admin, con la CSP;
# - que el código no aparezca en lo público y que no queden publicados archivos de configuración.
# El código de la prueba se genera al azar en cada corrida (no hay ninguno en el repo).
# La corre el pipeline (prueba-extra de banklite-pipelines); en local necesita Docker.
set -e

base=http://localhost:8080
docker build -t banklite-frontend .
limpiar() { docker rm -f frontend-prueba frontend-sin-codigo frontend-codigo-malo > /dev/null 2>&1 || true; }
limpiar
trap limpiar EXIT

# no_arranca <nombre> <texto esperado en el log> [opciones de docker run...]
no_arranca() {
  nombre=$1; texto=$2; shift 2
  docker run -d --name "$nombre" "$@" banklite-frontend > /dev/null
  for i in $(seq 1 20); do
    [ "$(docker inspect -f '{{.State.Running}}' "$nombre")" = false ] && break
    sleep 1
  done
  estado=$(docker inspect -f '{{.State.Running}} {{.State.ExitCode}}' "$nombre")
  echo "$nombre -> running/exit: $estado"
  case "$estado" in
    true* | "false 0") echo "El contenedor $nombre arrancó (o terminó sin error)"; exit 1 ;;
  esac
  if ! docker logs "$nombre" 2>&1 | grep -qF "$texto"; then
    echo "El contenedor $nombre no explica por qué no arranca:"; docker logs "$nombre"; exit 1
  fi
}

# 1. Sin EVAL_CODE, o con uno inválido, el contenedor no arranca.
#    (EVAL_USER/EVAL_PASSWORD ya no sirven para nada: no lo hacen arrancar.)
no_arranca frontend-sin-codigo "falta la variable de entorno EVAL_CODE" -e EVAL_USER=x -e EVAL_PASSWORD=y
no_arranca frontend-codigo-malo "EVAL_CODE no es válido" -e 'EVAL_CODE=corto"; }'

# 2. Con un código de prueba al azar.
codigo="ci-$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
docker run -d --name frontend-prueba -e EVAL_CODE="$codigo" -p 8080:80 banklite-frontend > /dev/null
for i in $(seq 1 20); do curl -fs "$base/robots.txt" > /dev/null && break; sleep 1; done
cookie="banklite_eval=$codigo"

# esperar <código HTTP> <descripción> <ruta> [opciones de curl...]
esperar() {
  esperado=$1; desc=$2; ruta=$3; shift 3
  code=$(curl -s -o /dev/null -w '%{http_code}' "$@" "$base$ruta")
  echo "$ruta ($desc) -> $code"
  [ "$code" = "$esperado" ] || { echo "se esperaba $esperado"; exit 1; }
}
# redirige_a_acceso <descripción> <ruta> [opciones de curl...]
redirige_a_acceso() {
  desc=$1; ruta=$2; shift 2
  r=$(curl -s --path-as-is -o /dev/null -w '%{http_code} %header{location}' "$@" "$base$ruta")
  echo "$ruta ($desc) -> $r"
  [ "$r" = "302 /acceso.html" ] || { echo "se esperaba 302 a /acceso.html"; exit 1; }
}

# Sin cookie (o con una incorrecta): todo lo privado va a la página de acceso.
for ruta in / /index.html /login.html /dashboard.html /api.js /styles.css /admin/ /admin/clientes \
  /admin/admin.js /no-existe /acceso /acceso.html/../dashboard.html; do
  redirige_a_acceso "sin cookie" "$ruta"
done
redirige_a_acceso "cookie incorrecta" / -H "Cookie: banklite_eval=otro-codigo-cualquiera"
redirige_a_acceso "cookie con el código + basura" / -H "Cookie: banklite_eval=${codigo}x"
if curl -sI "$base/" | grep -qi '^www-authenticate'; then echo "Sigue la autenticación básica"; exit 1; fi

# Rutas públicas sin código, con su contenido.
esperar 200 "pública" /acceso.html
pagina=$(curl -fs "$base/acceso.html")
for texto in "BankLite" "Proyecto académico de la Universidad Cooperativa de Colombia" \
  "Código de evaluación" ">Entrar<" 'src="acceso.js"' 'href="acceso.css"'; do
  echo "$pagina" | grep -qF "$texto" || { echo "acceso.html no tiene: $texto"; exit 1; }
done
for ruta in /acceso.css /acceso.js /theme-init.js; do esperar 200 "pública" "$ruta"; done
curl -fsI "$base/acceso.html" | grep -i "content-security-policy"
esperar 200 "pública" /robots.txt
if ! curl -fs "$base/robots.txt" | grep -qx 'Disallow: /'; then echo "robots.txt sin Disallow: /"; exit 1; fi
verif=googlec275dac7ffdbde9a.html
esperar 200 "pública" "/$verif"
if ! curl -fs "$base/$verif" | grep -qx "google-site-verification: $verif"; then
  echo "/$verif no se publica: se pierde la verificación de Search Console"; exit 1
fi

# El código no aparece en nada público.
for ruta in /acceso.html /acceso.js /acceso.css /theme-init.js /robots.txt "/$verif"; do
  if curl -s "$base$ruta" | grep -qF "$codigo"; then echo "El código aparece en $ruta"; exit 1; fi
done

# POST /acceso/entrar: cookie solo con POST y el código correcto.
sin_cookie() { # <descripción> <código HTTP esperado> [opciones de curl...]
  desc=$1; esperado=$2; shift 2
  h=$(curl -s -D - -o /dev/null "$@" "$base/acceso/entrar")
  code=$(echo "$h" | head -1 | cut -d' ' -f2)
  echo "/acceso/entrar ($desc) -> $code"
  [ "$code" = "$esperado" ] || { echo "se esperaba $esperado"; exit 1; }
  if echo "$h" | grep -qi '^set-cookie'; then echo "dejó cookie con $desc"; exit 1; fi
}
sin_cookie "POST sin código" 401 -X POST
sin_cookie "POST código incorrecto" 401 -X POST -H "X-Codigo-Evaluacion: otro-codigo-cualquiera"
sin_cookie "POST código + basura" 401 -X POST -H "X-Codigo-Evaluacion: ${codigo}x"
sin_cookie "GET código correcto" 405 -H "X-Codigo-Evaluacion: $codigo"
h=$(curl -s -D - -o /dev/null -X POST -H "X-Codigo-Evaluacion: $codigo" "$base/acceso/entrar")
echo "/acceso/entrar (POST código correcto) -> $(echo "$h" | head -1 | cut -d' ' -f2)"
echo "$h" | head -1 | grep -q ' 204' || { echo "se esperaba 204"; exit 1; }
set_cookie=$(echo "$h" | grep -i '^set-cookie:' | tr -d '\r')
for parte in "banklite_eval=$codigo;" "Path=/" "HttpOnly" "Secure" "SameSite=Lax"; do
  echo "$set_cookie" | grep -qF "$parte" || { echo "Set-Cookie sin $parte"; exit 1; }
done

# Con la cookie correcta: la app y el panel.
for ruta in / /login.html /dashboard.html /api.js /styles.css /admin/ /admin/clientes /acceso.html; do
  esperar 200 "con cookie" "$ruta" -H "Cookie: $cookie"
done
if ! curl -fs -H "Cookie: $cookie" "$base/" | grep -q '<html'; then echo "/ no sirve index.html"; exit 1; fi
curl -fsI -H "Cookie: $cookie" "$base/" | grep -i "content-security-policy"
curl -fsI -H "Cookie: $cookie" "$base/admin/" | grep -i "content-security-policy"

# Archivos de configuración que no deben quedar publicados (aun con la cookie). Una ruta
# desconocida responde index.html (try_files de nginx), así que se revisa el contenido.
c="Cookie: $cookie"
if curl -s -H "$c" "$base/Dockerfile" | grep -q 'FROM nginx'; then echo "Dockerfile publicado"; exit 1; fi
if curl -s -H "$c" "$base/nginx.conf" | grep -q 'try_files'; then echo "nginx.conf publicado"; exit 1; fi
if curl -s -H "$c" "$base/nginx-seguridad.conf" | grep -q 'add_header'; then echo "nginx-seguridad.conf publicado"; exit 1; fi
if curl -s -H "$c" "$base/package.json" | grep -q 'devDependencies'; then echo "package.json publicado"; exit 1; fi
if curl -s -H "$c" "$base/eslint.config.mjs" | grep -q 'defineConfig'; then echo "eslint.config.mjs publicado"; exit 1; fi
if curl -s -H "$c" "$base/scripts/entrypoint.sh" | grep -q 'EVAL_CODE'; then echo "entrypoint.sh publicado"; exit 1; fi

# Fotos de destinos de Beneficios: se publican, pero detrás del código como el resto del sitio.
fotos=$(ls img/destinos/*.webp)
[ -n "$fotos" ] || { echo "No hay fotos en img/destinos/"; exit 1; }
for foto in $fotos; do
  redirige_a_acceso "sin cookie" "/$foto"
  r=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' -H "$c" "$base/$foto")
  echo "/$foto (con cookie) -> $r"
  [ "$r" = "200 image/webp" ] || { echo "se esperaba 200 image/webp"; exit 1; }
done
redirige_a_acceso "sin cookie" /fotos-destinos.js
esperar 200 "con cookie" /fotos-destinos.js -H "$c"
# El listado de créditos en texto queda en el repo; en la página salen de fotos-destinos.js.
if curl -s -H "$c" "$base/img/destinos/CREDITOS.md" | grep -q 'Créditos de las fotos de destinos'; then
  echo "CREDITOS.md publicado"; exit 1
fi
