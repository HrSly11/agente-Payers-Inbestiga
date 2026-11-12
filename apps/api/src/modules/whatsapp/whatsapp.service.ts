import { Injectable, Logger } from '@nestjs/common';
import { OpenWAProvider, SendMessageResult } from './openwa.provider';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly openWA: OpenWAProvider,
    private readonly prisma: PrismaService,
  ) {}

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

    const result = await this.openWA.sendTextMessage({
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

  async getStatus() {
    return this.openWA.getSessionStatus();
  }
}
