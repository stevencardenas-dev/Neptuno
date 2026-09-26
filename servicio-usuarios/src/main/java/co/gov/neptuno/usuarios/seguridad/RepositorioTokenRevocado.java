package co.gov.neptuno.usuarios.seguridad;

import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Tokens revocados por cierre de sesión (HU-002). */
public interface RepositorioTokenRevocado extends JpaRepository<TokenRevocado, String> {

    boolean existsByJti(String jti);

    @Modifying
    @Query("delete from TokenRevocado t where t.expiraEn < :ahora")
    int purgarExpirados(@Param("ahora") Instant ahora);
}
