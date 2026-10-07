# ---------- Etapa 1: build de Vite ----------
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Etapa 2: servidor web ----------
# nginx sirve la SPA y hace de punto de entrada de la API: el navegador solo
# habla con un origen y los microservicios no necesitan puertos públicos.
FROM nginx:alpine

ENV USUARIOS_SERVICE_HOST=servicio-usuarios \
    USUARIOS_SERVICE_PORT=8081

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
