#!/bin/sh
# Entrypoint de la imagen: genera /etc/nginx/banklite-codigo.conf con el código de
# evaluación (variable de entorno EVAL_CODE, definida en Railway) y sigue con el
# entrypoint oficial de nginx. Sin un EVAL_CODE válido el contenedor NO arranca: así el
# sitio nunca queda publicado sin la página de acceso por un olvido.
# El código no está en el repositorio, ni en la imagen, ni en el JavaScript.
set -eu

if [ -z "${EVAL_CODE:-}" ]; then
  echo "ERROR: falta la variable de entorno EVAL_CODE (código de evaluación)." >&2
  echo "El frontend no arranca sin ella para no publicar el sitio sin la página de acceso." >&2
  echo "Defínela en Railway (servicio frontend -> Variables) o en local con:" >&2
  echo "  docker run -e EVAL_CODE=... -p 5500:80 banklite-frontend" >&2
  exit 1
fi
# Solo letras sin tilde, números, '-' y '_', de 12 a 128 caracteres: el valor entra tal
# cual en la configuración de nginx, en una cookie y en un encabezado HTTP.
if ! printf '%s' "$EVAL_CODE" | grep -Eqx '[A-Za-z0-9_-]{12,128}'; then
  echo "ERROR: EVAL_CODE no es válido: usa de 12 a 128 caracteres, solo letras sin tilde," >&2
  echo "números, '-' y '_' (sin espacios). El frontend no arranca con ese valor." >&2
  exit 1
fi

umask 077
{
  printf 'map $cookie_banklite_eval $banklite_eval_ok { default 0; "%s" 1; }\n' "$EVAL_CODE"
  printf 'map $http_x_codigo_evaluacion $banklite_codigo_ok { default 0; "%s" 1; }\n' "$EVAL_CODE"
} > /etc/nginx/banklite-codigo.conf
unset EVAL_CODE

exec /docker-entrypoint.sh "$@"
