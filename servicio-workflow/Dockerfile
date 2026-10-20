# NestJS necesita tsc para compilar; el compilador no viaja a la imagen final.
FROM node:24-alpine AS compilacion
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Imagen final: solo dependencias de producción y el JavaScript ya compilado.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=compilacion /app/dist ./dist
COPY db ./db
USER node
EXPOSE 8084
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD wget -qO- http://127.0.0.1:8084/healthz || exit 1
CMD ["node", "dist/main.js"]
