# Sirve el frontend de BankLite (páginas, scripts y estilos) y el panel admin
# (admin/, publicado en /admin/) como sitio estático. Contexto de build: raíz del repo.
# Solo se copian .html, .js y .css: el Dockerfile y los .conf no quedan publicados.
# Todo el sitio pide el código de evaluación (acceso.html + cookie): scripts/entrypoint.sh
# genera la configuración desde EVAL_CODE al arrancar, y sin ella no arranca.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-seguridad.conf /etc/nginx/banklite-seguridad.conf
COPY scripts/entrypoint.sh /usr/local/bin/banklite-entrypoint.sh
RUN chmod 755 /usr/local/bin/banklite-entrypoint.sh
COPY *.html *.js *.css /usr/share/nginx/html/
COPY admin/*.html admin/*.js admin/*.css /usr/share/nginx/html/admin/
# Fotos de destinos de Beneficios (créditos en fotos-destinos.js e img/destinos/CREDITOS.md)
COPY img/destinos/*.webp /usr/share/nginx/html/img/destinos/
EXPOSE 80
# Definir ENTRYPOINT borra el CMD de la imagen base: se repite el de nginx.
ENTRYPOINT ["/usr/local/bin/banklite-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
