# Sirve el frontend de BankLite (páginas, scripts y estilos) y el panel admin
# (admin/, publicado en /admin/) como sitio estático. Contexto de build: raíz del repo.
# Solo se copian .html, .js y .css: el Dockerfile y nginx.conf no quedan publicados.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY *.html *.js *.css /usr/share/nginx/html/
COPY admin/*.html admin/*.js admin/*.css /usr/share/nginx/html/admin/
EXPOSE 80
