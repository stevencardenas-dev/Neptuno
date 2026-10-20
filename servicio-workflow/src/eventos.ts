import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import amqp from 'amqplib';
import { CONFIG, Config } from './config';

/** Una fila de la bandeja de salida, tal como la devuelve el repositorio. */
export interface EventoPendiente {
  id: string;
  tipo: string;
  entidad: string;
  entidadId: string | null;
  actorId: string | null;
  actorCorreo: string | null;
  detalle: unknown;
  ocurridoEn: Date;
}

/** Lo mínimo que el publicador necesita del repositorio; así la prueba puede falsearlo. */
export interface BandejaDeSalida {
  eventosPendientes(limite: number): Promise<EventoPendiente[]>;
  marcarPublicados(ids: string[]): Promise<void>;
}

export const BANDEJA = 'BANDEJA';

/**
 * Publica la bandeja de salida en RabbitMQ para ms-audit-infra (mismo exchange, cola y
 * sobre que servicio-usuarios y servicio-documentos). Si el broker no responde, los
 * eventos quedan pendientes y se reintentan en el siguiente ciclo: las operaciones del
 * usuario nunca esperan al broker.
 */
@Injectable()
export class PublicadorEventos implements OnModuleInit, OnModuleDestroy {
  private conexion: any = null;
  private canal: any = null;
  private temporizador?: NodeJS.Timeout;
  private enCurso = false;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(BANDEJA) private readonly repo: BandejaDeSalida,
  ) {}

  onModuleInit(): void {
    if (this.config.eventos.publicar) {
      this.temporizador = setInterval(() => void this.enviarPendientes(), this.config.eventos.intervaloMs);
    }
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.temporizador);
    try {
      await this.conexion?.close();
    } catch {
      /* ya estaba cerrada */
    }
  }

  private async conectar(): Promise<void> {
    this.conexion = await amqp.connect(this.config.eventos.url);
    this.conexion.on('error', () => {});
    this.conexion.on('close', () => {
      this.conexion = null;
      this.canal = null;
    });
    this.canal = await this.conexion.createChannel();
    await this.canal.assertExchange(this.config.eventos.exchange, 'direct', { durable: true });
    await this.canal.assertQueue(this.config.eventos.cola, { durable: true });
    await this.canal.bindQueue(this.config.eventos.cola, this.config.eventos.exchange, this.config.eventos.routingKey);
  }

  async enviarPendientes(): Promise<void> {
    if (this.enCurso) return;
    this.enCurso = true;
    try {
      const pendientes = await this.repo.eventosPendientes(100);
      if (!pendientes.length) return;
      if (!this.canal) await this.conectar();
      const publicados: string[] = [];
      for (const e of pendientes) {
        const sobre = {
          id: e.id,
          tipo: e.tipo,
          entidad: e.entidad,
          entidadId: e.entidadId,
          actorId: e.actorId,
          actorCorreo: e.actorCorreo,
          detalle: e.detalle,
          ocurridoEn: new Date(e.ocurridoEn).toISOString(),
          servicio: 'servicio-workflow',
        };
        this.canal.publish(this.config.eventos.exchange, this.config.eventos.routingKey, Buffer.from(JSON.stringify(sobre)), {
          persistent: true,
          contentType: 'application/json',
        });
        publicados.push(e.id);
      }
      await this.repo.marcarPublicados(publicados);
    } catch (error: any) {
      console.warn(`No se pudieron publicar los eventos (${error.message}); se reintentará.`);
      try {
        await this.conexion?.close();
      } catch {
        /* ya cerrada */
      }
      this.conexion = null;
      this.canal = null;
    } finally {
      this.enCurso = false;
    }
  }
}
