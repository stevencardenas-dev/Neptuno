# Compila en una etapa con el SDK y deja un contenedor final mínimo: la imagen que
# corre en la instancia no lleva el compilador, ni las dependencias, ni el código fuente.
FROM golang:1.27-alpine AS compilacion
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Un binario estático (CGO desactivado) no necesita libc en la imagen final.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /salida/auditoria ./cmd/auditoria

FROM alpine:3.21
# El servicio no escribe en disco ni necesita root: solo habla con MySQL y RabbitMQ.
RUN adduser -D -u 10001 neptuno
COPY --from=compilacion /salida/auditoria /usr/local/bin/auditoria
USER neptuno
EXPOSE 8083
HEALTHCHECK --interval=15s --timeout=4s --start-period=25s --retries=4 \
  CMD wget -qO- http://127.0.0.1:8083/healthz || exit 1
ENTRYPOINT ["/usr/local/bin/auditoria"]
