# Sirve index.html (raíz del repo) como sitio estático. Contexto de build: raíz del repo.
FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
EXPOSE 80
