# Nota técnica · Los eventos de bitácora viajaban en dos formatos distintos

**Asunto:** por qué `servicio-usuarios` publicaba eventos que ningún servicio escrito en
otro lenguaje podía leer, y qué se cambió
**Fecha:** 17 de octubre de 2026 · Avance 2
**Fuente:** cola `audit.infrastructure` del entorno desplegado en EC2

---

## 1. El hallazgo

La cola `audit.infrastructure` llevaba desde el Avance 1 recibiendo eventos sin que
nadie los leyera. Al conectar por fin el consumidor de `ms-audit-infra` (Go), aceptó
sin problema los eventos de `servicio-documentos` y rechazó todos los de
`servicio-usuarios`. El motivo estaba en el sobre del mensaje, no en su contenido:

| Productor | `content_type` del mensaje |
|---|---|
| `servicio-documentos` | `application/json` |
| `servicio-usuarios` | `application/x-java-serialized-object` |

El cuerpo de los mensajes de `servicio-usuarios` empezaba con
`rO0ABXNyABdqYXZhLnV0aWwuTGlua2VkSGFzaE1hcA…`: eran un `java.util.LinkedHashMap`
**serializado con el mecanismo nativo de Java**, no un documento JSON. Los nombres de
los campos eran correctos (`id`, `tipo`, `entidad`, `actorCorreo`, `detalle`,
`ocurridoEn`, `servicio`) porque el contenido sí era el que se había diseñado; lo que
no coincidía era la forma de escribirlo.

## 2. Por qué es un problema y no un detalle

- **El formato del evento es parte del contrato entre servicios.** Los tres servicios
  comparten `neptuno.eventos` y una cola; si cada uno elige cómo escribir el mensaje,
  lo que se comparte no es un contrato sino una coincidencia.
- **Ataba la arquitectura a la JVM.** Un objeto serialado por Java solo lo puede leer
  otra aplicación Java —y con la misma versión de las clases—. El microservicio de
  bitácora está escrito en Go: era incapaz de leerlo, y cualquier consumidor futuro
  (una consola, un exportador, un tablero) estaría en la misma situación.
- **Fallaba en silencio.** El patrón outbox marcaba esos eventos como `PUBLICADO` al
  enviarlos, así que la pérdida no se notaba: el evento salía del servicio, entraba en
  la cola y moría ahí. Sin un segundo consumidor que lo dijera, nadie lo sabría.

Es justamente el tipo de fallo que aparece cuando el sistema deja de ser monolingüe:
lo que en un solo lenguaje es un detalle de implementación, en varios es una
incompatibilidad.

## 3. La causa

`PublicadorEventos` construye el evento como un `LinkedHashMap` y lo entrega con
`RabbitTemplate.convertAndSend(...)`. Spring AMQP, si no se le indica un convertidor,
usa `SimpleMessageConverter`, que para un `Serializable` aplica la serialización de
Java y deja marcado el `content_type` como `application/x-java-serialized-object`.
`servicio-documentos` publica JSON porque su cliente de mensajería lo escribe
explícitamente; de ahí la diferencia entre los dos productores.

## 4. La corrección

Un único bean en `ConfiguracionMensajeria` (la clase que ya declara el exchange y la
cola):

```java
@Bean
MessageConverter convertidorDeEventos() {
    return new Jackson2JsonMessageConverter();
}
```

Spring Boot toma el `MessageConverter` único del contexto y se lo pone al
`RabbitTemplate`, así que no hay que tocar el publicador ni la topología. Desde ese
cambio, los eventos de los dos servicios llegan a la bitácora con la misma forma.

## 5. Lo que se revisó de paso

El episodio dejó tres cosas del lado del consumidor que convenía cerrar:

1. **Mensaje ilegible.** Un evento que no se puede interpretar se descarta con un
   registro de error (`evento descartado`) en lugar de reintentarse para siempre, que
   dejaría la cola atascada.
2. **Consumo repetido.** `evento_id` es clave única: si el mismo evento llega dos
   veces, la segunda no se encadena. La cadena no se duplica ni se rompe, y el mensaje
   se confirma.
3. **Durabilidad de la cola.** Recrear el contenedor de RabbitMQ borraba los mensajes
   que estuvieran esperando, y como el outbox ya los daba por publicados, nadie los
   reponía. El broker ahora guarda sus datos en un volumen: los eventos sobreviven a un
   reinicio del contenedor.

## 6. Segundo hallazgo: un detalle con llaves rompía la cadena

Al conectar `ms-workflow-bpm` apareció un fallo distinto y más silencioso. Sus eventos
llevan el detalle como **objeto** (`{"flujoId":…,"nombre":…,"cambios":[…]}`), mientras que
los quince registros anteriores lo llevaban como **texto** (`"Inicio de sesión exitoso…"`).
Con el primer evento de objeto, la verificación de la cadena pasó a decir
`{"integra":false,"primerCorte":{"secuencia":18,"motivo":"El hash no corresponde al
contenido del registro."}}` sin que nadie hubiera tocado la base.

La causa está en el ida y vuelta por la columna `detalle`, que es de tipo `JSON`:

| Momento | Texto |
|---|---|
| Al sellar (Go) | `{"cambios":["descripcion"],"flujoId":"…"}` |
| Al leer (MySQL) | `{"cambios": ["descripcion"], "flujoId": "…"}` |

MySQL no guarda el texto: guarda el documento y lo vuelve a escribir al devolverlo, con
las claves ordenadas y un espacio tras `,` y `:`. El hash se calculaba sobre la forma
canónica al insertar, pero al verificar se recalculaba sobre el texto tal como lo
devolvía MySQL. Con un detalle de texto el ida y vuelta no cambia nada —por eso el fallo
sobrevivió a las pruebas de manipulación del Avance 2— y con uno de objeto la cadena se
daba por rota sola.

La corrección vuelve a canonizar el detalle al leer la fila (`detalleDeLaFila`), que es
lo que el propio comentario del código ya decía que había que hacer:

```go
detalle, err := detalleDeLaFila(detalleCrudo) // re-serializa con las claves ordenadas
```

Es un fallo del mismo tipo que el de la sección 1: el formato del dato no era parte del
contrato. Los quince registros anteriores siguen verificando porque canonizar un texto lo
deja igual.

## 7. Cómo comprobarlo

- `podman exec neptuno-rabbitmq rabbitmqctl list_queues name messages consumers`
  → `audit.infrastructure` con un consumidor y sin mensajes atascados.
- Menú **Auditoría → Bitácora** → el sello «Íntegra» y las cifras de registros verificados.
- Interfaz de gestión en `http://127.0.0.1:15672` (solo desde la propia instancia).
