package operacion

import (
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"neptuno/auditoria/internal/comun"
	"neptuno/auditoria/internal/config"
)

// duracionRespaldo acota lo que puede tardar una copia o una restauración. Es generoso a
// propósito: una base grande tarda, pero un proceso colgado no puede quedarse para siempre.
const duracionRespaldo = 30 * time.Minute

// Servicio ejecuta las copias de seguridad y las restauraciones (HU-081, HU-082).
//
// Las copias se hacen con `mysqldump` contra las bases configuradas y se guardan
// comprimidas en el directorio de respaldos, que debe ser un volumen para sobrevivir al
// contenedor. El servicio no backupea los objetos de MinIO: los documentos viven en su
// propio almacenamiento y se respaldan con la herramienta del almacenamiento; la
// programación guarda el indicador y la vista lo muestra, pero la copia incluida aquí
// son las bases de datos.
type Servicio struct {
	repositorio *Repositorio
	respaldos   config.Respaldos
	base        config.DB
	colector    *Colector
}

// NuevoServicio construye el servicio de operación.
func NuevoServicio(repositorio *Repositorio, respaldos config.Respaldos, base config.DB) *Servicio {
	return &Servicio{
		repositorio: repositorio,
		respaldos:   respaldos,
		base:        base,
		colector:    NuevoColector(time.Hour),
	}
}

// AplicarMigracion deja las tablas de operación en su sitio.
func (s *Servicio) AplicarMigracion(ctx context.Context) error {
	return s.repositorio.AplicarMigracion(ctx)
}

// Programacion devuelve la copia programada (HU-081).
func (s *Servicio) Programacion(ctx context.Context) (Programacion, error) {
	return s.repositorio.Programacion(ctx)
}

// GuardarProgramacion valida y guarda la programación; solo el administrador llega aquí.
func (s *Servicio) GuardarProgramacion(ctx context.Context, programacion Programacion, actor string) (Programacion, error) {
	if programacion.Frecuencia == "" {
		programacion.Frecuencia = FrecuenciaDiaria
	}
	switch programacion.Frecuencia {
	case FrecuenciaDiaria, FrecuenciaCada12Horas, FrecuenciaSemanal:
	default:
		return Programacion{}, comun.ReglaInvalida("La frecuencia debe ser DIARIA, CADA_12_HORAS o SEMANAL.",
			programacion.Frecuencia+" no es una frecuencia válida")
	}
	if _, err := time.Parse("15:04", programacion.Hora); err != nil {
		return Programacion{}, comun.ReglaInvalida("La hora debe tener el formato HH:MM.",
			programacion.Hora+" no es una hora válida")
	}
	if programacion.RetencionDias <= 0 {
		return Programacion{}, comun.ReglaInvalida("La retención debe ser de al menos un día.")
	}
	if programacion.RetencionDias > 3650 {
		return Programacion{}, comun.ReglaInvalida("La retención no puede superar los 10 años.")
	}
	return s.repositorio.GuardarProgramacion(ctx, programacion, actor)
}

// ListarRespaldos devuelve las ejecuciones recientes.
func (s *Servicio) ListarRespaldos(ctx context.Context, limite int) ([]Respaldo, error) {
	if limite <= 0 {
		limite = 25
	}
	return s.repositorio.ListarRespaldos(ctx, limite)
}

// ObtenerRespaldo devuelve una ejecución por su id.
func (s *Servicio) ObtenerRespaldo(ctx context.Context, id string) (Respaldo, error) {
	return s.repositorio.ObtenerRespaldo(ctx, id)
}

// EjecutarRespaldo hace la copia ahora, a pedido de un administrador (HU-081).
func (s *Servicio) EjecutarRespaldo(ctx context.Context, actor string) (Respaldo, error) {
	programacion, err := s.repositorio.Programacion(ctx)
	if err != nil {
		return Respaldo{}, err
	}
	retencion := time.Duration(programacion.RetencionDias) * 24 * time.Hour
	if retencion <= 0 {
		retencion = 30 * 24 * time.Hour
	}
	manual := actor
	return s.ejecutar(ctx, &Respaldo{IniciadoPor: &manual}, retencion)
}

// ejecutar arma el volcado, lo comprime y guarda el resultado.
func (s *Servicio) ejecutar(ctx context.Context, respaldo *Respaldo, retencion time.Duration) (Respaldo, error) {
	bases := s.respaldos.Bases
	expiracion := time.Now().UTC().Add(retencion)
	respaldo.ExpiraEn = &expiracion
	registrado, err := s.repositorio.CrearRespaldo(ctx, *respaldo, bases)
	if err != nil {
		return Respaldo{}, err
	}

	ubicacion, tamano, checksum, fallo := s.volcar(ctx)
	estado := RespaldoCompletado
	mensaje := ""
	if fallo != nil {
		estado = RespaldoFallido
		mensaje = recortar(fallo.Error(), 1000)
		slog.Error("el respaldo falló", "respaldo", registrado.ID, "error", fallo)
	}
	if err := s.repositorio.FinalizarRespaldo(ctx, registrado.ID, estado, ubicacion, tamano, checksum, mensaje); err != nil {
		return Respaldo{}, err
	}
	// La retención se aplica después de copiar, no antes: un respaldo nuevo nunca se borra
	// por su propia ejecución.
	s.aplicarRetencion(ctx)
	return s.repositorio.ObtenerRespaldo(ctx, registrado.ID)
}

// volcar ejecuta mysqldump y deja el archivo comprimido en el directorio de respaldos.
//
// Devuelve la ruta relativa, el tamaño y el sha256 del archivo. Un fallo del volcado no
// deja un archivo a medias: se borra para que la retención no conserve basura.
func (s *Servicio) volcar(ctx context.Context) (string, int64, string, error) {
	if err := os.MkdirAll(s.respaldos.Directorio, 0o750); err != nil {
		return "", 0, "", fmt.Errorf("no se pudo crear el directorio de respaldos: %w", err)
	}
	nombre := "neptuno-" + time.Now().UTC().Format("20060102-150405") + ".sql.gz"
	ruta := filepath.Join(s.respaldos.Directorio, nombre)

	// El volcado se hace en streaming: un `mysqldump > archivo` en memoria no cabe para una
	// base grande. gzip comprime al vuelo para que el respaldo ocupe menos.
	archivo, err := os.Create(ruta)
	if err != nil {
		return "", 0, "", fmt.Errorf("no se pudo crear el archivo del respaldo: %w", err)
	}
	compresor := gzip.NewWriter(archivo)
	exito := false
	defer func() {
		if !exito {
			_ = compresor.Close()
			_ = archivo.Close()
			_ = os.Remove(ruta)
		}
	}()

	limite, cancelar := context.WithTimeout(ctx, duracionRespaldo)
	defer cancelar()

	argumentos := []string{
		"--host=" + s.base.Host,
		fmt.Sprintf("--port=%d", s.base.Puerto),
		"--user=" + s.base.Usuario,
		"--single-transaction",
		"--routines",
		"--triggers",
		"--databases",
	}
	argumentos = append(argumentos, s.respaldos.Bases...)
	comando := exec.CommandContext(limite, s.respaldos.Mysqldump, argumentos...)
	comando.Env = append(os.Environ(), "MYSQL_PWD="+s.base.Clave)
	comando.Stdout = compresor
	var errores strings.Builder
	comando.Stderr = &errores

	if err := comando.Run(); err != nil {
		return "", 0, "", fmt.Errorf("mysqldump falló: %w: %s", err, strings.TrimSpace(errores.String()))
	}
	if err := compresor.Close(); err != nil {
		return "", 0, "", fmt.Errorf("no se pudo cerrar el archivo comprimido: %w", err)
	}
	if err := archivo.Close(); err != nil {
		return "", 0, "", fmt.Errorf("no se pudo cerrar el archivo del respaldo: %w", err)
	}
	exito = true

	tamano, checksum, err := huella(ruta)
	if err != nil {
		return "", 0, "", err
	}
	return nombre, tamano, checksum, nil
}

// huella devuelve el tamaño y el sha256 de un archivo, leyéndolo en streaming.
func huella(ruta string) (int64, string, error) {
	archivo, err := os.Open(ruta)
	if err != nil {
		return 0, "", fmt.Errorf("no se pudo leer el respaldo: %w", err)
	}
	defer func() { _ = archivo.Close() }()

	resumen := sha256.New()
	tamano, err := io.Copy(resumen, archivo)
	if err != nil {
		return 0, "", fmt.Errorf("no se pudo calcular el checksum del respaldo: %w", err)
	}
	return tamano, hex.EncodeToString(resumen.Sum(nil)), nil
}

// aplicarRetencion marca y borra los respaldos que ya pasaron su plazo.
func (s *Servicio) aplicarRetencion(ctx context.Context) {
	vencidos, err := s.repositorio.RespaldosVencidos(ctx, time.Now().UTC())
	if err != nil {
		slog.Warn("no se pudo revisar la retención de respaldos", "error", err)
		return
	}
	for _, respaldo := range vencidos {
		if respaldo.Ubicacion != nil {
			if err := os.Remove(filepath.Join(s.respaldos.Directorio, filepath.Base(*respaldo.Ubicacion))); err != nil && !errors.Is(err, os.ErrNotExist) {
				slog.Warn("no se pudo borrar el archivo de un respaldo vencido", "respaldo", respaldo.ID, "error", err)
				continue
			}
		}
		if err := s.repositorio.MarcarExpirado(ctx, respaldo.ID); err != nil {
			slog.Warn("no se pudo marcar un respaldo vencido", "respaldo", respaldo.ID, "error", err)
			continue
		}
		slog.Info("respaldo fuera de retención", "respaldo", respaldo.ID)
	}
}

// SolicitarRestauracion registra el pedido (HU-082). No restaura nada: restaurar
// sobrescribe datos, así que exige una segunda persona que lo confirme.
func (s *Servicio) SolicitarRestauracion(ctx context.Context, respaldoID, motivo, actor string) (Restauracion, error) {
	if strings.TrimSpace(motivo) == "" {
		return Restauracion{}, comun.ReglaInvalida("Una restauración exige un motivo.")
	}
	if aBinario(respaldoID) == nil {
		return Restauracion{}, comun.ReglaInvalida("El identificador del respaldo no es válido.")
	}
	respaldo, err := s.repositorio.ObtenerRespaldo(ctx, respaldoID)
	if err != nil {
		return Restauracion{}, err
	}
	if respaldo.Estado != RespaldoCompletado {
		return Restauracion{}, comun.ReglaInvalida("Solo se puede restaurar un respaldo completado.",
			"El respaldo está "+respaldo.Estado)
	}
	return s.repositorio.CrearRestauracion(ctx, Restauracion{
		RespaldoID:    respaldoID,
		Motivo:        recortar(motivo, 500),
		SolicitadaPor: actor,
	})
}

// ListarRestauraciones devuelve las solicitudes recientes.
func (s *Servicio) ListarRestauraciones(ctx context.Context, limite int) ([]Restauracion, error) {
	if limite <= 0 {
		limite = 25
	}
	return s.repositorio.ListarRestauraciones(ctx, limite)
}

// Restaurar carga el respaldo sobre las bases, después de que otra persona lo confirmó.
//
// Es la operación más destructiva del sistema: reemplaza el contenido de las tablas
// incluidas. Por eso exige que quien confirma no sea quien pidió, y deja registrado a
// ambos en la tabla restauracion.
func (s *Servicio) Restaurar(ctx context.Context, id, actor string) (Restauracion, error) {
	restauracion, err := s.repositorio.ObtenerRestauracion(ctx, id)
	if err != nil {
		return Restauracion{}, err
	}
	if err := validarConfirmacion(restauracion, actor); err != nil {
		return Restauracion{}, err
	}
	respaldo, err := s.repositorio.ObtenerRespaldo(ctx, restauracion.RespaldoID)
	if err != nil {
		return Restauracion{}, err
	}
	if respaldo.Estado != RespaldoCompletado || respaldo.Ubicacion == nil {
		return Restauracion{}, comun.ReglaInvalida("El respaldo ya no está disponible.",
			"Estado actual: "+respaldo.Estado)
	}
	if err := s.repositorio.IniciarRestauracion(ctx, id, actor); err != nil {
		return Restauracion{}, err
	}

	fallo := s.cargar(ctx, filepath.Join(s.respaldos.Directorio, filepath.Base(*respaldo.Ubicacion)))
	estado := RestauracionCompletada
	resultado := "El respaldo se cargó sobre las bases incluidas."
	if fallo != nil {
		estado = RestauracionFallida
		resultado = recortar(fallo.Error(), 1000)
		slog.Error("la restauración falló", "restauracion", id, "error", fallo)
	}
	if err := s.repositorio.FinalizarRestauracion(ctx, id, estado, resultado); err != nil {
		return Restauracion{}, err
	}
	return s.repositorio.ObtenerRestauracion(ctx, id)
}

// validarConfirmacion aplica las dos reglas de una restauración: que siga solicitada y que
// la confirme otra persona distinta de quien la pidió.
func validarConfirmacion(restauracion Restauracion, actor string) error {
	if restauracion.Estado != RestauracionSolicitada {
		return comun.ReglaInvalida("Esta restauración ya no se puede ejecutar.",
			"Estado actual: "+restauracion.Estado)
	}
	if actor == restauracion.SolicitadaPor {
		return comun.Prohibido("Quien solicita una restauración no puede confirmarla: hace falta otra persona.")
	}
	return nil
}

// cargar pasa el volcado por el cliente `mysql`, que recrea las bases y sus tablas.
func (s *Servicio) cargar(ctx context.Context, ruta string) error {
	archivo, err := os.Open(ruta)
	if err != nil {
		return fmt.Errorf("no se pudo abrir el respaldo: %w", err)
	}
	defer func() { _ = archivo.Close() }()

	descompresor, err := gzip.NewReader(archivo)
	if err != nil {
		return fmt.Errorf("el respaldo no está comprimido como se esperaba: %w", err)
	}
	defer func() { _ = descompresor.Close() }()

	limite, cancelar := context.WithTimeout(ctx, duracionRespaldo)
	defer cancelar()

	comando := exec.CommandContext(limite, s.respaldos.Mysql,
		"--host="+s.base.Host,
		fmt.Sprintf("--port=%d", s.base.Puerto),
		"--user="+s.base.Usuario,
		"--protocol=tcp",
		"--default-character-set=utf8mb4",
	)
	comando.Env = append(os.Environ(), "MYSQL_PWD="+s.base.Clave)
	comando.Stdin = descompresor
	var errores strings.Builder
	comando.Stderr = &errores
	if err := comando.Run(); err != nil {
		return fmt.Errorf("mysql falló al cargar el respaldo: %w: %s", err, strings.TrimSpace(errores.String()))
	}
	return nil
}

// Programar ejecuta la copia programada mientras el contexto siga vivo (HU-081).
//
// Revisa cada minuto si toca: la frecuencia y la hora se comparan con el último respaldo
// programado, no con un temporizador en memoria, así que reiniciar el contenedor no
// duplica ni se salta la copia del día.
func (s *Servicio) Programar(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case ahora := <-ticker.C:
			s.revisarProgramacion(ctx, ahora.UTC())
		}
	}
}

// revisarProgramacion lanza la copia si la programación está activa y ya toca.
func (s *Servicio) revisarProgramacion(ctx context.Context, ahora time.Time) {
	programacion, err := s.repositorio.Programacion(ctx)
	if err != nil {
		slog.Warn("no se pudo leer la programación de respaldos", "error", err)
		return
	}
	if !programacion.Activa || programacion.ID == "" {
		return
	}
	ultimo, err := s.repositorio.UltimoRespaldoDe(ctx, programacion.ID)
	if err != nil {
		slog.Warn("no se pudo leer el último respaldo programado", "error", err)
		return
	}
	if !tocaCopiar(programacion, ultimo, ahora) {
		return
	}
	retencion := time.Duration(programacion.RetencionDias) * 24 * time.Hour
	programacionID := programacion.ID
	respaldo := &Respaldo{ProgramacionID: &programacionID}
	if _, err := s.ejecutar(ctx, respaldo, retencion); err != nil {
		slog.Error("la copia programada falló", "error", err)
	}
}

// tocaCopiar decide si la programación ya cumplió su intervalo desde la última copia.
func tocaCopiar(programacion Programacion, ultimo *time.Time, ahora time.Time) bool {
	hora, err := time.Parse("15:04", programacion.Hora)
	if err != nil {
		return false
	}
	programada := time.Date(ahora.Year(), ahora.Month(), ahora.Day(), hora.Hour(), hora.Minute(), 0, 0, time.UTC)
	if ahora.Before(programada) {
		return false
	}
	if ultimo == nil {
		return true
	}
	var intervalo time.Duration
	switch programacion.Frecuencia {
	case FrecuenciaCada12Horas:
		intervalo = 12 * time.Hour
	case FrecuenciaSemanal:
		intervalo = 7 * 24 * time.Hour
	default:
		intervalo = 24 * time.Hour
	}
	return ahora.Sub(*ultimo) >= intervalo
}

// recortar limita un texto al tamaño de su columna, sin partir un carácter multibyte.
func recortar(valor string, maximo int) string {
	if len(valor) <= maximo {
		return valor
	}
	recortado := valor[:maximo]
	for len(recortado) > 0 && !utf8.ValidString(recortado) {
		recortado = recortado[:len(recortado)-1]
	}
	return recortado
}
