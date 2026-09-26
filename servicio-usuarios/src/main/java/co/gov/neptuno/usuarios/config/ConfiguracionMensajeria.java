package co.gov.neptuno.usuarios.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Topología de mensajería hacia ms-audit-infra: exchange directo de eventos del sistema
 * y cola durable de auditoría. Si el broker no está disponible el servicio sigue
 * operando y los eventos quedan pendientes para reintento.
 */
@Configuration
@EnableScheduling
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
}
