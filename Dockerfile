# Sirve el frontend de BankLite (páginas, scripts y estilos) y el panel admin
# (admin/, publicado en /admin/) como sitio estático. Contexto de build: raíz del repo.
# Solo se copian .html, .js y .css: el Dockerfile y nginx.conf no quedan publicados.
# Todo el sitio pide usuario y clave de evaluación (auth_basic): scripts/entrypoint.sh
# genera el htpasswd al arrancar desde EVAL_USER y EVAL_PASSWORD, y sin ellas no arranca.
FROM nginx:1.27-alpine
# openssl calcula el hash de la clave de evaluación al arrancar.
RUN apk add --no-cache openssl
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY scripts/entrypoint.sh /usr/local/bin/banklite-entrypoint.sh
RUN chmod 755 /usr/local/bin/banklite-entrypoint.sh
COPY *.html *.js *.css /usr/share/nginx/html/
COPY admin/*.html admin/*.js admin/*.css /usr/share/nginx/html/admin/
EXPOSE 80
# Definir ENTRYPOINT borra el CMD de la imagen base: se repite el de nginx.
ENTRYPOINT ["/usr/local/bin/banklite-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
