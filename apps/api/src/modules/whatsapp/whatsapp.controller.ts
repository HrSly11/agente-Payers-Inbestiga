import { Controller, Post, Body, Get, Logger, Inject, forwardRef } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { EvolutionDbService } from './evolution-db.service';
import { NegotiationService } from '../negotiation/negotiation.service';
import { PayersService } from '../payers/payers.service';

@ApiTags('WhatsApp / Evolution API')
@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly evolutionDb: EvolutionDbService,
    @Inject(forwardRef(() => NegotiationService))
    private readonly negotiationService: NegotiationService,
    @Inject(forwardRef(() => PayersService))
    private readonly payersService: PayersService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Obtener estado de la sesión de WhatsApp en Evolution API y QR si aplica' })
  async getStatus() {
    return this.whatsappService.getStatus();
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Receptor de Webhooks entrantes de Evolution API (evento MESSAGES_UPSERT)' })
  async handleWebhook(@Body() payload: any) {
    this.logger.log(`Webhook entrante de Evolution: ${JSON.stringify(payload).substring(0, 150)}...`);

    // Evolution API v2 emite { event: 'messages.upsert' | 'MESSAGES_UPSERT', data: {...} }
    const evento = String(payload?.event || '').toLowerCase();
    if (evento && !evento.includes('messages.upsert')) {
      return { status: 'ignored', event: evento };
    }

    const data = payload?.data || payload;
    const key = data?.key || {};

    // Ignorar mensajes enviados por el propio bot
    if (key.fromMe === true || data.fromMe === true) {
      return { status: 'ignored', reason: 'fromMe' };
    }

    // remoteJid: "51949123456@s.whatsapp.net" | grupos "@g.us" | estados "status@broadcast"
    const remoteJid = String(key.remoteJid || data.from || '');
    if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid.includes('status@')) {
      return { status: 'ignored', reason: 'group_or_status' };
    }

    const contenido = this.extraerTexto(data.message) || data.message?.conversation;
    if (!contenido || !remoteJid) {
      return { status: 'ignored', reason: 'sin_texto' };
    }

    // WhatsApp usa direccionamiento por LID: los ENTRANTES llegan como "...@lid"
    // (un identificador opaco) en lugar del teléfono. Se traduce a teléfono real
    // para poder localizar la ORDEN_PAGO y responder con el Agente PAYERS.
    const telefono = await this.resolverTelefonoEntrante(remoteJid, key, data);
    this.logger.log(
      `Mensaje entrante de WhatsApp ${remoteJid} (teléfono: ${telefono || 'NO_RESUELTO'}): "${contenido}"`,
    );

    if (!telefono) {
      return { status: 'ignored', reason: 'lid_sin_telefono', remoteJid };
    }

    return this.enrutarEntrante(telefono, contenido);
  }

  /**
   * Obtiene el número de teléfono real (PN) del remitente de un mensaje entrante.
   *  1. Si Evolution ya adjuntó el alterno del JID (`remoteJidAlt` / `senderPn`), se usa.
   *  2. Si el remitente es un LID (`...@lid`), se resuelve contra la BD de Evolution.
   *  3. Si es un JID normal (`...@s.whatsapp.net`), se extraen los dígitos.
   */
  private async resolverTelefonoEntrante(
    remoteJid: string,
    key: any,
    data: any,
  ): Promise<string | null> {
    const alt = key?.remoteJidAlt || key?.participantAlt || data?.remoteJidAlt || data?.senderPn;
    if (alt && String(alt).includes('@s.whatsapp.net')) {
      return String(alt).split('@')[0].replace(/\D/g, '');
    }

    if (!remoteJid.endsWith('@lid')) {
      const digits = remoteJid.split('@')[0].replace(/\D/g, '');
      return digits || null;
    }

    return this.evolutionDb.resolverTelefonoDesdeLid(remoteJid);
  }

  /**
   * Enruta un mensaje entrante de WhatsApp:
   *   1. Si el número corresponde a una ORDEN_PAGO con contrato en INBESTIGA_TESIS → Agente PAYERS
   *      (el mismo que alimenta el Live Chat de cobranza) y se responde por WhatsApp.
   *   2. Si no coincide con ninguna orden → Agente de negociación (inbestiga_db / Prisma).
   */
  private async enrutarEntrante(cleanPhone: string, contenido: string) {
    const orden = await this.payersService.buscarOrdenPorTelefono(cleanPhone);

    if (orden?.orden_pago_id) {
      const ordenPagoId = Number(orden.orden_pago_id);
      this.logger.log(
        `→ Enrutando a Agente PAYERS (Live Chat): ${orden.codigo_orden} · ${orden.nombres} ${orden.apellidos}`,
      );

      const resultado = await this.payersService.procesarChatAgente(ordenPagoId, contenido);
      const envio = await this.whatsappService.enviarTextoSimple(cleanPhone, resultado.respuesta);

      return {
        status: 'processed',
        agente: 'PAYERS',
        orden: orden.codigo_orden,
        respuesta: resultado.respuesta,
        guardrailsActivados: resultado.guardrailsActivados,
        herramientasEjecutadas: resultado.herramientasEjecutadas,
        envio,
      };
    }

    const resultado = await this.negotiationService.procesarMensajeEstudiante(cleanPhone, contenido);
    return { status: 'processed', agente: 'NEGOCIACION', resultado };
  }

  /**
   * Extrae el texto de los distintos tipos de mensaje de WhatsApp (Baileys).
   */
  private extraerTexto(message: any): string | null {
    if (!message) return null;
    if (typeof message === 'string') return message;
    return (
      message.conversation ||
      message.extendedTextMessage?.text ||
      message.imageMessage?.caption ||
      message.videoMessage?.caption ||
      message.documentMessage?.caption ||
      message.buttonsResponseMessage?.selectedDisplayText ||
      message.templateButtonReplyMessage?.selectedDisplayText ||
      message.listResponseMessage?.title ||
      message.listResponseMessage?.singleSelectReply?.selectedRowId ||
      null
    );
  }

  @Post('simulate-incoming')
  @ApiOperation({ summary: 'Simula la llegada de un mensaje de WhatsApp para pruebas de demostración en vivo' })
  async simulateIncoming(@Body() body: { telefono: string; contenido?: string; mensaje?: string; text?: string }) {
    const texto = body.contenido || body.mensaje || body.text || '';
    this.logger.log(`Simulación de mensaje entrante de estudiante: ${body.telefono} -> "${texto}"`);
    return this.enrutarEntrante(String(body.telefono || '').replace(/\D/g, ''), texto);
  }

  /**
   * Live Chat del panel: procesa el mensaje como si viniera del estudiante y
   * despacha la respuesta del Agente PAYERS al WhatsApp real del contacto.
   * Así el panel de cobranza y el celular quedan sincronizados.
   */
  @Post('agent-chat')
  @ApiOperation({
    summary:
      'Procesa un mensaje desde el Live Chat de cobranza y envía la respuesta del Agente PAYERS al WhatsApp real del estudiante',
  })
  async agentChat(@Body() body: { ordenPagoId: number; mensaje?: string; contenido?: string }) {
    const ordenPagoId = Number(body.ordenPagoId);
    const texto = body.mensaje || body.contenido || '';

    const resultado = await this.payersService.procesarChatAgente(ordenPagoId, texto);

    let envio: any = null;
    const telefono = await this.payersService.obtenerTelefonoPorOrden(ordenPagoId);
    if (telefono) {
      const cleanPhone = String(telefono).replace(/\D/g, '');
      envio = await this.whatsappService.enviarTextoSimple(cleanPhone, resultado.respuesta);
      this.logger.log(`→ Live Chat: respuesta del Agente PAYERS despachada a WhatsApp ${cleanPhone}`);
    } else {
      this.logger.warn(
        `Live Chat: no se encontró teléfono para la orden ${ordenPagoId}; la respuesta quedó solo en el panel.`,
      );
    }

    return { ...resultado, envio };
  }
}
