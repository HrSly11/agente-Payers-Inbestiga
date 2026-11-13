import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EvolutionProvider, SendMessageResult } from './evolution.provider';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly evolution: EvolutionProvider,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Al arrancar el backend: asegura la instancia en Evolution API y registra
   * el webhook para que los mensajes entrantes lleguen a /api/v1/whatsapp/webhook.
   */
  async onModuleInit() {
    if (!this.evolution.configured) {
      this.logger.warn(
        'WhatsApp (Evolution API) inactivo: define EVO_URL y EVO_KEY en el .env del backend.',
      );
      return;
    }

    const ensure = await this.evolution.ensureInstance();
    if (!ensure.ok) return;

    const port = process.env.API_PORT || process.env.PORT || 4000;
    const webhookUrl =
      process.env.WHATSAPP_WEBHOOK_URL || `http://host.docker.internal:${port}/api/v1/whatsapp/webhook`;
    await this.evolution.setWebhook(webhookUrl);

    const status = await this.evolution.getSessionStatus();
    if (status.conectado) {
      this.logger.log('✓ WhatsApp (Evolution API) conectado y escuchando mensajes.');
    } else {
      this.logger.warn(
        `WhatsApp (Evolution API) sin sesión activa (estado: ${status.status}). Escanea el QR en GET /api/v1/whatsapp/status.`,
      );
    }
  }

  /**
   * Envía mensaje y lo persiste en la tabla MENSAJE
   */
  async enviarMensaje(params: {
    conversacionId: string;
    telefono: string;
    contenido: string;
    tipoMensaje?: string;
    remitente?: string;
    metadata?: any;
  }): Promise<SendMessageResult> {
    const { conversacionId, telefono, contenido, tipoMensaje = 'TEXT', remitente = 'AGENTE_IA', metadata } = params;

    const result = await this.evolution.sendTextMessage({
      chatId: telefono,
      text: contenido,
    });

    const metaToSave = {
      ...(typeof metadata === 'object' ? metadata : {}),
      waMessageId: result.messageId,
      sentTo: telefono,
    };

    // Registrar en BD
    await this.prisma.mensaje.create({
      data: {
        conversacionId,
        direccion: 'OUTGOING',
        remitente,
        contenido,
        tipoMensaje,
        estadoEntrega: result.exito ? 'SENT' : 'FAILED',
        metadata: JSON.stringify(metaToSave),
      },
    });

    await this.prisma.conversacion.update({
      where: { id: conversacionId },
      data: { fechaUltimaActividad: new Date() },
    });

    return result;
  }

  /**
   * Envía un texto por WhatsApp SIN persistir en la tabla Prisma MENSAJE.
   * Se usa desde el agente PAYERS, cuyo historial vive en INBESTIGA_TESIS.dbo.MENSAJE
   * (el mismo que alimenta el Live Chat de cobranza).
   */
  async enviarTextoSimple(telefono: string, contenido: string): Promise<SendMessageResult> {
    return this.evolution.sendTextMessage({ chatId: telefono, text: contenido });
  }

  enviarPresencia(telefono: string, presence: 'composing' | 'recording') {
    return this.evolution.sendPresence(telefono, presence);
  }

  getMediaBase64(messageKey: any) {
    return this.evolution.getMediaBase64(messageKey);
  }

  enviarNotaDeVoz(telefono: string, audioBase64: string): Promise<SendMessageResult> {
    return this.evolution.sendVoiceNote(telefono, audioBase64);
  }

  async getStatus() {
    return this.evolution.getSessionStatus();
  }
}
