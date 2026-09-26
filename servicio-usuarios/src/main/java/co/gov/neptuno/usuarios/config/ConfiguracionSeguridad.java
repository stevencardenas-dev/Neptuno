package co.gov.neptuno.usuarios.config;

import co.gov.neptuno.usuarios.seguridad.FiltroClaveServicios;
import co.gov.neptuno.usuarios.seguridad.ManejadorSeguridad;
import co.gov.neptuno.usuarios.seguridad.TipoToken;
import co.gov.neptuno.usuarios.seguridad.ValidadorRevocacion;
import co.gov.neptuno.usuarios.seguridad.ValidadorTipoToken;
import co.gov.neptuno.usuarios.seguridad.ValidadorUsuarioActivo;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Seguridad del servicio: sesiones sin estado con JWT (HU-001, HU-002) y control de
 * acceso basado en roles y permisos (HU-013).
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class ConfiguracionSeguridad {

    private static final String RUTA_LOGIN = "/api/usuarios/auth/login";
    private static final String RUTA_REFRESCO = "/api/usuarios/auth/refrescar";
    private static final String RUTA_INTERNA = "/api/usuarios/interno/**";

    @Bean
    PasswordEncoder codificadorClaves() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityFilterChain cadenaDeSeguridad(HttpSecurity http,
                                          JwtDecoder decodificadorAcceso,
                                          JwtAuthenticationConverter convertidorJwt,
                                          ManejadorSeguridad manejadorSeguridad,
                                          PropiedadesNeptuno propiedades) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(sesion -> sesion.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(autorizacion -> autorizacion
                        .requestMatchers(HttpMethod.POST, RUTA_LOGIN, RUTA_REFRESCO).permitAll()
                        .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers("/api/usuarios/openapi/**", "/api/usuarios/documentacion/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers(RUTA_INTERNA).hasAuthority(FiltroClaveServicios.AUTORIDAD_SERVICIO)
                        .anyRequest().authenticated())
                .oauth2ResourceServer(recurso -> recurso
                        .jwt(jwt -> jwt.decoder(decodificadorAcceso).jwtAuthenticationConverter(convertidorJwt))
                        .authenticationEntryPoint(manejadorSeguridad)
                        .accessDeniedHandler(manejadorSeguridad))
                .exceptionHandling(excepciones -> excepciones
                        .authenticationEntryPoint(manejadorSeguridad)
                        .accessDeniedHandler(manejadorSeguridad))
                .addFilterBefore(new FiltroClaveServicios(propiedades.getServicios().getClaveInterna()),
                        UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    JwtEncoder codificadorJwt(PropiedadesNeptuno propiedades) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(claveFirma(propiedades)));
    }

    /**
     * Decodificador de tokens de acceso: valida firma, emisor, expiración, que el token
     * sea de acceso, que no haya sido revocado y que el usuario siga activo.
     */
    @Bean
    @Primary
    JwtDecoder decodificadorAcceso(PropiedadesNeptuno propiedades,
                                   ValidadorRevocacion validadorRevocacion,
                                   ValidadorUsuarioActivo validadorUsuarioActivo) {
        return construirDecodificador(propiedades, validadorRevocacion, validadorUsuarioActivo, TipoToken.ACCESO);
    }

    @Bean
    JwtDecoder decodificadorRefresco(PropiedadesNeptuno propiedades,
                                     ValidadorRevocacion validadorRevocacion,
                                     ValidadorUsuarioActivo validadorUsuarioActivo) {
        return construirDecodificador(propiedades, validadorRevocacion, validadorUsuarioActivo, TipoToken.REFRESCO);
    }

    /** Convierte los claims de roles y permisos en autoridades de Spring Security (HU-013). */
    @Bean
    JwtAuthenticationConverter convertidorJwt() {
        JwtGrantedAuthoritiesConverter porDefecto = new JwtGrantedAuthoritiesConverter();
        porDefecto.setAuthoritiesClaimName("permisos");
        porDefecto.setAuthorityPrefix("");

        JwtAuthenticationConverter convertidor = new JwtAuthenticationConverter();
        convertidor.setPrincipalClaimName("sub");
        convertidor.setJwtGrantedAuthoritiesConverter(jwt -> {
            List<GrantedAuthority> autoridades = new ArrayList<>(porDefecto.convert(jwt));
            List<String> roles = jwt.getClaimAsStringList("roles");
            if (roles != null) {
                roles.forEach(rol -> autoridades.add(new SimpleGrantedAuthority("ROLE_" + rol)));
            }
            return autoridades;
        });
        return convertidor;
    }

    @Bean
    CorsConfigurationSource configuracionCors() {
        CorsConfiguration configuracion = new CorsConfiguration();
        configuracion.setAllowedOriginPatterns(List.of("*"));
        configuracion.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuracion.setAllowedHeaders(List.of("*"));
        configuracion.setExposedHeaders(List.of("Location"));
        UrlBasedCorsConfigurationSource origen = new UrlBasedCorsConfigurationSource();
        origen.registerCorsConfiguration("/**", configuracion);
        return origen;
    }

    private JwtDecoder construirDecodificador(PropiedadesNeptuno propiedades,
                                              ValidadorRevocacion validadorRevocacion,
                                              ValidadorUsuarioActivo validadorUsuarioActivo,
                                              TipoToken tipo) {
        NimbusJwtDecoder decodificador = NimbusJwtDecoder.withSecretKey(claveFirma(propiedades))
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        OAuth2TokenValidator<Jwt> validadores = new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(propiedades.getJwt().getEmisor()),
                new ValidadorTipoToken(tipo),
                validadorRevocacion,
                validadorUsuarioActivo);
        decodificador.setJwtValidator(validadores);
        return decodificador;
    }

    private SecretKey claveFirma(PropiedadesNeptuno propiedades) {
        byte[] secreto = propiedades.getJwt().getSecreto().getBytes(StandardCharsets.UTF_8);
        if (secreto.length < 32) {
            throw new IllegalStateException("neptuno.jwt.secreto debe tener al menos 32 caracteres para firmar con HS256.");
        }
        return new SecretKeySpec(secreto, "HmacSHA256");
    }
}
