// Comando auditoria: el microservicio de bitácora (HU-043…HU-047).
//
// Consume los eventos que los demás servicios publican en RabbitMQ con el patrón outbox,
// los encadena por hash en su propia base de datos y los expone por HTTP para
// consultarlos, ver el historial de un documento y comprobar que la cadena sigue íntegra.
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	// El driver de MySQL se registra por su efecto al importarlo.
	_ "github.com/go-sql-driver/mysql"

	"neptuno/auditoria/internal/bitacora"
	"neptuno/auditoria/internal/comun"
	"neptuno/auditoria/internal/config"
	"neptuno/auditoria/internal/operacion"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := ejecutar(); err != nil {
		slog.Error("el servicio de bitácora no pudo arrancar", "error", err)
		os.Exit(1)
	}
}

func ejecutar() error {
	cfg, err := config.Cargar()
	if err != nil {
		return err
	}
	ctx, detener := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer detener()

	base, err := abrirBase(ctx, cfg)
	if err != nil {
		return err
	}
	defer func() { _ = base.Close() }()

	repositorio := bitacora.NuevoRepositorio(base)
	servicio := bitacora.NuevoServicio(repositorio)
	if err := servicio.AplicarMigracion(ctx); err != nil {
		return err
	}
	if err := servicio.Comprobar(ctx); err != nil {
		return err
	}

	// Copias de seguridad, restauración y métricas (HU-081, HU-082, HU-084, HU-085).
	servicioOperacion := operacion.NuevoServicio(
		operacion.NuevoRepositorio(base), cfg.Respaldos, cfg.DB)
	if err := servicioOperacion.AplicarMigracion(ctx); err != nil {
		return err
	}
	if err := os.MkdirAll(cfg.Respaldos.Directorio, 0o750); err != nil {
		return fmt.Errorf("no se pudo preparar el directorio de respaldos: %w", err)
	}
	go servicioOperacion.Programar(ctx)

	// El consumidor corre en su propia goroutine: la cadena se escribe en el orden en que
	// RabbitMQ entrega los eventos, sin bloquear las consultas de la bitácora.
	consumidor := bitacora.NuevoConsumidor(cfg.Eventos, servicio)
	go func() {
		if err := consumidor.Consumir(ctx); err != nil {
			slog.Error("el consumidor de bitácora terminó con error", "error", err)
		}
	}()

	manejadores := bitacora.NuevoManejadores(servicio)
	rutas := http.NewServeMux()
	manejadores.Registrar(rutas)
	operacion.NuevoManejadores(servicioOperacion).Registrar(rutas)

	// El healthcheck no lleva token: lo consulta el contenedor, no una persona.
	raiz := http.NewServeMux()
	raiz.HandleFunc("GET /healthz", manejadores.Salud)
	// La instrumentación va por fuera de la autenticación para medir también el 401 y el
	// 403: si el servicio se degrada autenticando, la métrica lo muestra.
	raiz.Handle("/", comun.Autenticar(cfg.JWT.Secreto, cfg.JWT.Emisor)(
		servicioOperacion.Colector().Instrumentar(rutas)))

	servidor := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Puerto),
		Handler:           raiz,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      60 * time.Second,
	}
	go func() {
		slog.Info("servicio de bitácora escuchando", "puerto", cfg.Puerto, "cola", cfg.Eventos.Cola)
		if err := servidor.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("el servidor HTTP se detuvo", "error", err)
			detener()
		}
	}()

	<-ctx.Done()
	slog.Info("apagando el servicio de bitácora")
	apagado, cancelar := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelar()
	return servidor.Shutdown(apagado)
}

// abrirBase conecta con MySQL reintentando: al arrancar el compose la base puede tardar
// más que el servicio, y es mejor esperar que morir y reiniciar en bucle.
func abrirBase(ctx context.Context, cfg config.Config) (*sql.DB, error) {
	base, err := sql.Open("mysql", cfg.DB.DSN())
	if err != nil {
		return nil, fmt.Errorf("no se pudo preparar la conexión: %w", err)
	}
	base.SetMaxOpenConns(8)
	base.SetMaxIdleConns(4)
	base.SetConnMaxLifetime(time.Hour)

	espera := time.Second
	for intento := 1; intento <= 30; intento++ {
		err := base.PingContext(ctx)
		if err == nil {
			return base, nil
		}
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		if intento == 30 {
			return nil, fmt.Errorf("la base de datos no respondió tras %d intentos: %w", intento, err)
		}
		slog.Info("esperando a la base de datos", "intento", intento)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(espera):
		}
		if espera < 10*time.Second {
			espera *= 2
		}
	}
	return nil, errors.New("no se pudo conectar con la base de datos")
}
