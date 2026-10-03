# Sirve index.html (raíz del repo) y el panel admin (frontend/admin.html) como sitio estático. Contexto de build: raíz del repo.
FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY frontend/admin.html /usr/share/nginx/html/admin.html
EXPOSE 80
