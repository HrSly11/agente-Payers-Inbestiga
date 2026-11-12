import { Controller, Post, Body, Get, Logger, Inject, forwardRef } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { NegotiationService } from '../negotiation/negotiation.service';

@ApiTags('WhatsApp / OpenWA')
@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly whatsappService: WhatsAppService,
    @Inject(forwardRef(() => NegotiationService))
    private readonly negotiationService: NegotiationService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Obtener estado de la sesión de WhatsApp en OpenWA y QR si aplica' })
  async getStatus() {
    return this.whatsappService.getStatus();
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Receptor de Webhooks entrantes de OpenWA para mensajes de WhatsApp' })
  async handleWebhook(@Body() payload: any) {
    this.logger.log(`Webhook entrante de OpenWA: ${JSON.stringify(payload).substring(0, 150)}...`);

    // OpenWA despacha eventos con estructura { event: 'message.received', data: { from, body, direction } }
    const mensajeData = payload.data || payload;
    const isOutgoing = mensajeData.direction === 'outgoing' || mensajeData.fromMe === true;
    const remitente = mensajeData.from || mensajeData.sender || mensajeData.chatId;
    const contenido = mensajeData.body || mensajeData.text || mensajeData.content;

    // Ignorar mensajes enviados por el propio bot
    if (isOutgoing || !contenido || !remitente) {
      return { status: 'ignored' };
    }

    const cleanPhone = String(remitente).replace(/\D/g, '');
    this.logger.log(`Mensaje entrante de WhatsApp desde teléfono ${cleanPhone}: "${contenido}"`);

    // Procesar a través del orquestador de negociación
    const resultado = await this.negotiationService.procesarMensajeEstudiante(cleanPhone, contenido);
    return { status: 'processed', resultado };
  }

  @Post('simulate-incoming')
  @ApiOperation({ summary: 'Simula la llegada de un mensaje de WhatsApp para pruebas de demostración en vivo' })
  async simulateIncoming(@Body() body: { telefono: string; contenido?: string; mensaje?: string; text?: string }) {
    const texto = body.contenido || body.mensaje || body.text || '';
    this.logger.log(`Simulación de mensaje entrante de estudiante: ${body.telefono} -> "${texto}"`);
    return this.negotiationService.procesarMensajeEstudiante(body.telefono, texto);
  }
}
