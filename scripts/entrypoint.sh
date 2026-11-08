#!/bin/sh
# Entrypoint de la imagen: genera /etc/nginx/htpasswd con la cuenta de evaluación
# (variables de entorno EVAL_USER y EVAL_PASSWORD, definidas en Railway) y sigue con
# el entrypoint oficial de nginx. Sin esas variables el contenedor NO arranca: así el
# sitio nunca queda publicado sin la autenticación básica por un olvido.
# Las credenciales no están en el repositorio ni en la imagen, solo en el entorno.
set -eu

if [ -z "${EVAL_USER:-}" ] || [ -z "${EVAL_PASSWORD:-}" ]; then
  echo "ERROR: faltan las variables de entorno EVAL_USER y/o EVAL_PASSWORD." >&2
  echo "El frontend no arranca sin ellas para no publicar el sitio sin autenticación básica." >&2
  echo "Defínelas en Railway (servicio frontend -> Variables) o en local con:" >&2
  echo "  docker run -e EVAL_USER=... -e EVAL_PASSWORD=... -p 5500:80 banklite-frontend" >&2
  exit 1
fi
case "$EVAL_USER" in
  *:*)
    echo "ERROR: EVAL_USER no puede contener ':' (separa usuario y hash en el htpasswd)." >&2
    exit 1
    ;;
esac

# Hash SHA-512 crypt ($6$), que nginx valida con crypt() de musl. La clave entra por stdin.
hash=$(printf '%s\n' "$EVAL_PASSWORD" | openssl passwd -6 -stdin)
umask 027
printf '%s:%s\n' "$EVAL_USER" "$hash" > /etc/nginx/htpasswd
chown root:nginx /etc/nginx/htpasswd
chmod 640 /etc/nginx/htpasswd
unset EVAL_PASSWORD

exec /docker-entrypoint.sh "$@"
