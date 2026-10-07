package co.gov.neptuno.usuarios.config;

import co.gov.neptuno.usuarios.catalogos.Area;
import co.gov.neptuno.usuarios.catalogos.Entidad;
import co.gov.neptuno.usuarios.catalogos.RepositorioArea;
import co.gov.neptuno.usuarios.catalogos.RepositorioEntidad;
import co.gov.neptuno.usuarios.catalogos.RepositorioTipoDocumental;
import co.gov.neptuno.usuarios.catalogos.TipoDocumental;
import co.gov.neptuno.usuarios.comun.EstadoCatalogo;
import co.gov.neptuno.usuarios.comun.EstadoUsuario;
import co.gov.neptuno.usuarios.comun.OrigenDocumento;
import co.gov.neptuno.usuarios.comun.TipoRol;
import co.gov.neptuno.usuarios.roles.CatalogoPermisos;
import co.gov.neptuno.usuarios.roles.Permiso;
import co.gov.neptuno.usuarios.roles.RepositorioPermiso;
import co.gov.neptuno.usuarios.roles.RepositorioRol;
import co.gov.neptuno.usuarios.roles.Rol;
import co.gov.neptuno.usuarios.usuarios.RepositorioUsuario;
import co.gov.neptuno.usuarios.usuarios.Usuario;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Siembra idempotente de los datos base del sistema: catálogo de permisos, roles del
 * organigrama, áreas, tipos documentales, entidades y el usuario administrador inicial.
 * Se ejecuta una vez al arrancar y no sobrescribe cambios hechos desde la interfaz.
 */
@Component
public class DatosIniciales implements ApplicationRunner {

    private static final Logger registro = LoggerFactory.getLogger(DatosIniciales.class);

    private final PropiedadesNeptuno propiedades;
    private final RepositorioPermiso permisos;
    private final RepositorioRol roles;
    private final RepositorioArea areas;
    private final RepositorioTipoDocumental tipos;
    private final RepositorioEntidad entidades;
    private final RepositorioUsuario usuarios;
    private final PasswordEncoder codificador;

    public DatosIniciales(PropiedadesNeptuno propiedades,
                          RepositorioPermiso permisos,
                          RepositorioRol roles,
                          RepositorioArea areas,
                          RepositorioTipoDocumental tipos,
                          RepositorioEntidad entidades,
                          RepositorioUsuario usuarios,
                          PasswordEncoder codificador) {
        this.propiedades = propiedades;
        this.permisos = permisos;
        this.roles = roles;
        this.areas = areas;
        this.tipos = tipos;
        this.entidades = entidades;
        this.usuarios = usuarios;
        this.codificador = codificador;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!propiedades.getDatosIniciales().isActivo()) {
            return;
        }
        sembrarPermisos();
        sembrarRoles();
        sembrarAreas();
        sembrarTiposDocumentales();
        sembrarEntidades();
        sembrarAdministrador();
    }

    private void sembrarPermisos() {
        int creados = 0;
        for (CatalogoPermisos.Definicion definicion : CatalogoPermisos.definiciones()) {
            if (!permisos.existsByCodigo(definicion.codigo())) {
                permisos.save(new Permiso(definicion.codigo(), definicion.nombre(), definicion.modulo(), definicion.descripcion()));
                creados++;
            }
        }
        if (creados > 0) {
            registro.info("Catálogo de permisos: {} permisos nuevos de {} definidos.",
                    creados, CatalogoPermisos.definiciones().size());
        }
    }

    private void sembrarRoles() {
        // HU-024: radicar documentos de origen Recibido es exclusivo del rol Radicador,
        // por eso el Administrador recibe el catálogo completo menos ese permiso.
        List<String> todos = CatalogoPermisos.definiciones().stream()
                .map(CatalogoPermisos.Definicion::codigo)
                .filter(codigo -> !codigo.equals(CatalogoPermisos.RADICADOS_RADICAR_RECIBIDO))
                .toList();
        sembrarRol(Rol.ADMINISTRADOR, "Acceso total a configuración, usuarios, roles y parámetros del sistema; "
                        + "la radicación de origen Recibido es exclusiva del rol Radicador (HU-024).",
                TipoRol.SISTEMA, todos);
        sembrarRol("Radicador", "Registra y clasifica documentos, gestiona anexos y radica correspondencia.",
                TipoRol.OPERATIVO, List.of(
                        "radicados:crear", "radicados:editar", "anexos:cargar", "anexos:eliminar",
                        CatalogoPermisos.RADICADOS_RADICAR_RECIBIDO, "radicados:clase", "expediente:ver",
                        CatalogoPermisos.CATALOGOS_CONSULTAR));
        sembrarRol("Tesorero", "Gestiona pagos, valida cuentas de cobro y aprueba documentos financieros.",
                TipoRol.OPERATIVO, List.of(
                        "radicados:editar", "flujo:aprobar", "expediente:ver", CatalogoPermisos.CATALOGOS_CONSULTAR));
        sembrarRol("Gerente", "Aprueba documentos estratégicos y aplica firma electrónica.",
                TipoRol.APROBADOR, List.of(
                        "flujo:aprobar", "firma:aplicar", "expediente:ver", "bitacora:consultar"));
        sembrarRol("Auditor", "Consulta la bitácora y el historial documental sin poder modificarlo.",
                TipoRol.CONTROL, List.of("bitacora:consultar", "bitacora:filtrar", "expediente:ver"));
        sembrarRol("Aprobador", "Atiende tareas de flujo y aprueba, rechaza o devuelve documentos.",
                TipoRol.APROBADOR, List.of("flujo:aprobar", "flujo:rechazar", "expediente:ver"));
    }

    private void sembrarRol(String nombre, String descripcion, TipoRol tipo, List<String> codigosPermisos) {
        if (roles.existsByNombreIgnoreCase(nombre)) {
            return;
        }
        Set<Permiso> asignados = new LinkedHashSet<>(permisos.findByCodigoIn(codigosPermisos));
        Rol rol = new Rol();
        rol.setNombre(nombre);
        rol.setDescripcion(descripcion);
        rol.setTipo(tipo);
        rol.setPermisos(asignados);
        roles.save(rol);
        registro.info("Rol base creado: {} con {} permisos.", nombre, asignados.size());
    }

    private void sembrarAreas() {
        sembrarArea("ARE-01", "Subdirección Administrativa", "Laura Restrepo");
        sembrarArea("ARE-02", "Contabilidad y Tesorería", "Andrés Molina");
        sembrarArea("ARE-03", "Gerencia General", "Claudia Vega");
        sembrarArea("ARE-04", "Gestión Humana", "Paola Suárez");
        sembrarArea("ARE-05", "Jurídica", "Diego Ramírez");
        sembrarArea("ARE-06", "Compras y Proveedores", "Mateo Arias");
    }

    private void sembrarArea(String codigo, String nombre, String responsable) {
        if (areas.existsByNombreIgnoreCase(nombre)) {
            return;
        }
        Area area = new Area();
        area.setCodigo(codigo);
        area.setNombre(nombre);
        area.setResponsable(responsable);
        area.setEstado(EstadoCatalogo.ACTIVO);
        areas.save(area);
    }

    private void sembrarTiposDocumentales() {
        sembrarTipoDocumental("Factura", "FAC", OrigenDocumento.RECIBIDO);
        sembrarTipoDocumental("Orden de compra", "OC", OrigenDocumento.INTERNO);
        sembrarTipoDocumental("Contrato", "CON", OrigenDocumento.INTERNO, OrigenDocumento.EXTERNO);
        sembrarTipoDocumental("Resolución", "RES", OrigenDocumento.INTERNO);
        sembrarTipoDocumental("Cuenta de cobro", "CC", OrigenDocumento.RECIBIDO);
        sembrarTipoDocumental("Memorando", "MEM", OrigenDocumento.INTERNO);
        sembrarTipoDocumental("Acta", "ACT", OrigenDocumento.INTERNO);
    }

    private void sembrarTipoDocumental(String nombre, String prefijo, OrigenDocumento... origenes) {
        if (tipos.existsByNombreIgnoreCase(nombre)) {
            return;
        }
        TipoDocumental tipo = new TipoDocumental();
        tipo.setNombre(nombre);
        tipo.setPrefijo(prefijo);
        tipo.setEstado(EstadoCatalogo.ACTIVO);
        tipo.setOrigenes(new LinkedHashSet<>(List.of(origenes)));
        tipos.save(tipo);
    }

    private void sembrarEntidades() {
        sembrarEntidad("900.123.456-1", "Suministros del Norte S.A.S.", "Bogotá", "Proveedor");
        sembrarEntidad("830.998.221-7", "CloudTech Ingeniería Ltda.", "Medellín", "Proveedor");
        sembrarEntidad("800.445.102-3", "Alcaldía Municipal de Soacha", "Soacha", "Entidad pública");
        sembrarEntidad("901.220.778-5", "Papelería Central S.A.", "Cali", "Proveedor");
        sembrarEntidad("860.011.909-2", "Transportes Andinos", "Bucaramanga", "Proveedor");
    }

    private void sembrarEntidad(String nit, String razonSocial, String ciudad, String tipo) {
        if (entidades.existsByNit(nit)) {
            return;
        }
        Entidad entidad = new Entidad();
        entidad.setNit(nit);
        entidad.setRazonSocial(razonSocial);
        entidad.setCiudad(ciudad);
        entidad.setTipo(tipo);
        entidad.setEstado(EstadoCatalogo.ACTIVO);
        entidades.save(entidad);
    }

    private void sembrarAdministrador() {
        PropiedadesNeptuno.DatosIniciales datos = propiedades.getDatosIniciales();
        if (datos.getAdministradorCorreo() == null || datos.getAdministradorCorreo().isBlank()
                || datos.getAdministradorClave() == null || datos.getAdministradorClave().isBlank()) {
            throw new IllegalStateException("Define ADMIN_CORREO y ADMIN_CLAVE para crear el administrador inicial "
                    + "(o desactiva la siembra con DATOS_INICIALES=false).");
        }
        String correo = datos.getAdministradorCorreo().trim().toLowerCase(Locale.ROOT);
        if (usuarios.existsByCorreoIgnoreCase(correo)) {
            return;
        }
        Area area = areas.findAllByOrderByNombreAsc().stream()
                .filter(candidata -> candidata.getNombre().equalsIgnoreCase("Subdirección Administrativa"))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No hay áreas sembradas para crear el usuario administrador."));
        Rol administrador = roles.findByNombreIgnoreCase(Rol.ADMINISTRADOR)
                .orElseThrow(() -> new IllegalStateException("No existe el rol Administrador."));

        Usuario usuario = new Usuario();
        usuario.setNombre(datos.getAdministradorNombre());
        usuario.setCorreo(correo);
        usuario.setClaveHash(codificador.encode(datos.getAdministradorClave()));
        usuario.setArea(area);
        usuario.setEstado(EstadoUsuario.ACTIVO);
        usuario.setRoles(new LinkedHashSet<>(List.of(administrador)));
        usuarios.save(usuario);
        registro.info("Usuario administrador inicial creado: {} (cambia la contraseña en producción).", correo);
    }
}
