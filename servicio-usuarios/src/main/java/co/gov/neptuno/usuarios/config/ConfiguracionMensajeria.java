package co.gov.neptuno.usuarios.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Topología de mensajería hacia ms-audit-infra: exchange directo de eventos del sistema
 * y cola durable de auditoría. Si el broker no está disponible el servicio sigue
 * operando y los eventos quedan pendientes para reintento.
 *
 * <p>Los eventos viajan en JSON, que es el contrato que comparten los tres servicios:
 * servicio-documentos ya publica así en esta misma cola y ms-audit-infra está escrito
 * en otro lenguaje, así que no puede leer un objeto serializado por la JVM.</p>
 */
@Configuration
@ConditionalOnProperty(prefix = "neptuno.eventos", name = "publicar", havingValue = "true", matchIfMissing = true)
public class ConfiguracionMensajeria {

    @Bean
    DirectExchange exchangeEventos(PropiedadesNeptuno propiedades) {
        return new DirectExchange(propiedades.getEventos().getExchange(), true, false);
    }

    @Bean
    Queue colaAuditoria(PropiedadesNeptuno propiedades) {
        return QueueBuilder.durable(propiedades.getEventos().getColaAuditoria()).build();
    }

    @Bean
    Binding enlaceAuditoria(Queue colaAuditoria, DirectExchange exchangeEventos, PropiedadesNeptuno propiedades) {
        return BindingBuilder.bind(colaAuditoria).to(exchangeEventos).with(propiedades.getEventos().getRoutingKey());
    }

    /**
     * Publica los eventos como JSON en lugar de dejarlos serializados por la JVM.
     *
     * <p>Sin este convertidor Spring usa el suyo por defecto, que escribe el mapa con
     * serialización de Java: el mensaje solo lo podría leer otra aplicación Java, y deja
     * marcado su tipo en el sobre ({@code content_type}). El formato del evento es parte
     * del contrato entre servicios, no un detalle de la implementación de uno.</p>
     */
    @Bean
    MessageConverter convertidorDeEventos() {
        return new Jackson2JsonMessageConverter();
    }
}
