package co.gov.neptuno.usuarios.roles;

import java.util.List;

/**
 * Catálogo de permisos sobre funcionalidades del sistema.
 *
 * <p>Es la fuente única de verdad del catálogo: se siembra en la base de datos al
 * arrancar y se expone en {@code GET /api/usuarios/permisos} para poder asignarlos a
 * los roles (HU-011). Cada funcionalidad protegida del sistema valida uno de estos
 * códigos en cada solicitud (HU-013).</p>
 */
public final class CatalogoPermisos {

    public static final String MODULO_USUARIOS = "Usuarios y roles";
    public static final String MODULO_CATALOGOS = "Catálogos maestros";
    public static final String MODULO_RADICACION = "Radicación";
    public static final String MODULO_FLUJO = "Flujo de trabajo";
    public static final String MODULO_EXPEDIENTE = "Expediente y auditoría";

    public static final String USUARIOS_CONSULTAR = "usuarios:consultar";
    public static final String USUARIOS_CREAR = "usuarios:crear";
    public static final String USUARIOS_EDITAR = "usuarios:editar";
    public static final String USUARIOS_ELIMINAR = "usuarios:eliminar";
    public static final String USUARIOS_ASIGNAR_ROLES = "usuarios:asignar-roles";
    public static final String ROLES_CONSULTAR = "roles:consultar";
    public static final String ROLES_CREAR = "roles:crear";
    public static final String ROLES_EDITAR = "roles:editar";
    public static final String ROLES_ELIMINAR = "roles:eliminar";
    public static final String ROLES_ASIGNAR_PERMISOS = "roles:asignar-permisos";
    public static final String CATALOGOS_CONSULTAR = "catalogos:consultar";
    public static final String CATALOGOS_ADMINISTRAR = "catalogos:administrar";

    /** HU-024: radicar documentos de origen Recibido; exclusivo del rol Radicador. */
    public static final String RADICADOS_RADICAR_RECIBIDO = "radicados:radicar-recibido";

    /** Definición de un permiso del catálogo. */
    public record Definicion(String codigo, String nombre, String modulo, String descripcion) {
    }

    private static final List<Definicion> DEFINICIONES = List.of(
            new Definicion(USUARIOS_CONSULTAR, "Consultar y buscar usuarios", MODULO_USUARIOS,
                    "Listar usuarios y filtrarlos por nombre, rol o estado (HU-006)."),
            new Definicion(USUARIOS_CREAR, "Crear usuarios", MODULO_USUARIOS,
                    "Registrar un usuario con nombre, correo, área y estado (HU-003)."),
            new Definicion(USUARIOS_EDITAR, "Editar usuarios", MODULO_USUARIOS,
                    "Actualizar los datos de un usuario existente (HU-004)."),
            new Definicion(USUARIOS_ELIMINAR, "Eliminar usuarios (baja lógica)", MODULO_USUARIOS,
                    "Revocar el acceso de un usuario conservando su historial (HU-005)."),
            new Definicion(USUARIOS_ASIGNAR_ROLES, "Asignar roles", MODULO_USUARIOS,
                    "Asignar o quitar roles a un usuario (HU-012)."),
            new Definicion(ROLES_CONSULTAR, "Consultar roles", MODULO_USUARIOS,
                    "Listar los roles con sus permisos y usuarios asignados (HU-010)."),
            new Definicion(ROLES_CREAR, "Crear roles", MODULO_USUARIOS,
                    "Crear un rol para agrupar los permisos de un perfil (HU-007)."),
            new Definicion(ROLES_EDITAR, "Editar roles", MODULO_USUARIOS,
                    "Editar el nombre, la descripción y el tipo de un rol (HU-008)."),
            new Definicion(ROLES_ELIMINAR, "Eliminar roles", MODULO_USUARIOS,
                    "Eliminar un rol sin usuarios asignados (HU-009)."),
            new Definicion(ROLES_ASIGNAR_PERMISOS, "Administrar permisos de rol", MODULO_USUARIOS,
                    "Asignar o quitar permisos sobre funcionalidades a un rol (HU-011)."),
            new Definicion(CATALOGOS_CONSULTAR, "Consultar catálogos maestros", MODULO_CATALOGOS,
                    "Consultar áreas, tipos documentales y entidades (HU-015, HU-016, HU-022)."),
            new Definicion(CATALOGOS_ADMINISTRAR, "Administrar catálogos maestros", MODULO_CATALOGOS,
                    "Crear, editar y desactivar áreas, tipos documentales y entidades (HU-015, HU-016, HU-022)."),
            new Definicion("radicados:consultar", "Consultar radicados", MODULO_RADICACION,
                    "Ver el detalle y el listado de radicados con sus filtros (HU-020, HU-023)."),
            new Definicion("radicados:crear", "Registrar radicados", MODULO_RADICACION,
                    "Registrar documentos y asignarles su código de radicado (HU-017)."),
            new Definicion("radicados:editar", "Editar metadatos de radicado", MODULO_RADICACION,
                    "Corregir los metadatos de un radicado sin alterar su código (HU-021)."),
            new Definicion("anexos:cargar", "Cargar anexos", MODULO_RADICACION,
                    "Adjuntar archivos a un radicado (HU-025…HU-027)."),
            new Definicion("anexos:eliminar", "Eliminar anexos", MODULO_RADICACION,
                    "Eliminar un anexo cargado por error (HU-029)."),
            new Definicion(RADICADOS_RADICAR_RECIBIDO, "Radicar origen Recibido", MODULO_RADICACION,
                    "Registrar documentos de origen Recibido; solo lo tienen los Radicadores."),
            new Definicion("radicados:clase", "Marcar clase Original / Copia", MODULO_RADICACION,
                    "Definir si el documento es original o copia (HU-040)."),
            new Definicion("flujo:iniciar", "Iniciar flujo", MODULO_FLUJO,
                    "Enviar un radicado a un flujo de trabajo activo (HU-062)."),
            new Definicion("flujo:aprobar", "Aprobar documento", MODULO_FLUJO,
                    "Aprobar un documento para que avance de estado (HU-066)."),
            new Definicion("flujo:rechazar", "Rechazar documento", MODULO_FLUJO,
                    "Rechazar un documento con observación obligatoria (HU-067)."),
            new Definicion("firma:aplicar", "Aplicar firma electrónica", MODULO_FLUJO,
                    "Firmar electrónicamente un documento autorizado (HU-075)."),
            new Definicion("expediente:ver", "Ver expediente central", MODULO_EXPEDIENTE,
                    "Consultar las carpetas y documentos del expediente (HU-032)."),
            new Definicion("bitacora:consultar", "Consultar bitácora", MODULO_EXPEDIENTE,
                    "Consultar el historial de acciones del sistema (HU-046)."),
            new Definicion("bitacora:filtrar", "Filtrar bitácora", MODULO_EXPEDIENTE,
                    "Filtrar la bitácora por usuario, fecha y acción (HU-047)."));

    private CatalogoPermisos() {
    }

    public static List<Definicion> definiciones() {
        return DEFINICIONES;
    }
}
