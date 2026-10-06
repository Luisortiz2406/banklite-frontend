# Sirve el frontend de BankLite (páginas, scripts y estilos de frontend/) y el
# panel admin (frontend/admin/, publicado en /admin/) como sitio estático. Contexto de build: raíz del repo.
# Solo se copian .html, .js y .css: el Dockerfile y nginx.conf no quedan publicados.
FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/*.html frontend/*.js frontend/*.css /usr/share/nginx/html/
COPY frontend/admin/*.html frontend/admin/*.js frontend/admin/*.css /usr/share/nginx/html/admin/
EXPOSE 80
