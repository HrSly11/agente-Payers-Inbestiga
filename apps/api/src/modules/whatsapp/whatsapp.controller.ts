import {
  Controller,
  Post,
  Body,
  Get,
  Logger,
  Inject,
  forwardRef,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { EvolutionDbService } from './evolution-db.service';
import { NegotiationService } from '../negotiation/negotiation.service';
import { PayersService } from '../payers/payers.service';
import { OpenAiVoiceService } from '../voice/openai-voice.service';
import { VOICE_UPLOAD_LIMITS, validarUploadVoz } from '../voice/voice-upload.helper';

interface WhatsAppDebounceItem {
  cleanPhone: string | null;
  remoteJid: string;
  messages: string[];
  esAudio: boolean;
  audioEntrada?: { buffer: Buffer; filename?: string; mimeType?: string };
  timer: NodeJS.Timeout;
}

@ApiTags('WhatsApp / Evolution API')
@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);
  private readonly debounceMap = new Map<string, WhatsAppDebounceItem>();
  private readonly DEBOUNCE_MS = 3500; // Ventana de 3.5 segundos para consolidar mensajes consecutivos

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly evolutionDb: EvolutionDbService,
    @Inject(forwardRef(() => NegotiationService))
    private readonly negotiationService: NegotiationService,
    @Inject(forwardRef(() => PayersService))
    private readonly payersService: PayersService,
    private readonly voice: OpenAiVoiceService,
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

    const msgObj = this.unwrapWhatsAppMessage(data?.message);

    const esAudio = !!msgObj?.audioMessage;
    // Indicador inmediato ("grabando audio…" / "escribiendo…") mientras se procesa
    void this.whatsappService.enviarPresencia(remoteJid, esAudio ? 'recording' : 'composing');
    let contenido: string | null = null;
    let audioEntrada: { buffer: Buffer; filename?: string; mimeType?: string } | undefined;

    if (esAudio) {
      if (!this.voice.enabled) {
        return { status: 'ignored', reason: 'audio_sin_openai' };
      }
      try {
        const stt = await this.transcribirAudio(data, msgObj, key);
        contenido = stt.texto;
        audioEntrada = { buffer: stt.buffer, filename: stt.filename, mimeType: stt.mimeType };
      } catch (error: any) {
        this.logger.error(`Fallo al transcribir audio de WhatsApp: ${error.message}`);
        return { status: 'error', reason: 'stt_failed' };
      }
    } else {
      contenido = this.extraerTexto(msgObj) || msgObj?.conversation;
    }

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

    if (!telefono && !this.voice.enabled) {
      return { status: 'ignored', reason: 'lid_sin_telefono', remoteJid };
    }

    // Buffer con debounce: agrupa mensajes consecutivos enviados en una ventana de 3.5s
    const bufferKey = telefono || remoteJid;
    this.bufferIncomingMessage(bufferKey, telefono, remoteJid, contenido, esAudio, audioEntrada);

    return {
      status: 'buffered',
      remoteJid,
      telefono: telefono || null,
      debounceMs: this.DEBOUNCE_MS,
    };
  }

  /**
   * Acumula mensajes consecutivos del mismo remitente. Si llega otro mensaje antes
   * de 3.5 segundos, resetea el temporizador y une el contenido.
   */
  private bufferIncomingMessage(
    key: string,
    cleanPhone: string | null,
    remoteJid: string,
    contenido: string,
    esAudio: boolean,
    audioEntrada?: { buffer: Buffer; filename?: string; mimeType?: string },
  ) {
    const existing = this.debounceMap.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      existing.messages.push(contenido);
      if (esAudio) existing.esAudio = true;
      if (audioEntrada) existing.audioEntrada = audioEntrada;
      this.logger.log(
        `[Debounce WA] Mensaje acumulado para ${key} (${existing.messages.length} mensajes en cola). Reiniciando reloj de ${this.DEBOUNCE_MS}ms.`,
      );
      existing.timer = setTimeout(() => this.flushBuffer(key), this.DEBOUNCE_MS);
    } else {
      const item: WhatsAppDebounceItem = {
        cleanPhone,
        remoteJid,
        messages: [contenido],
        esAudio,
        audioEntrada,
        timer: setTimeout(() => this.flushBuffer(key), this.DEBOUNCE_MS),
      };
      this.debounceMap.set(key, item);
      this.logger.log(`[Debounce WA] Ventana de ${this.DEBOUNCE_MS}ms iniciada para ${key}...`);
    }
  }

  /**
   * Dispara el procesamiento del mensaje una vez que expira la ventana de silencio.
   */
  private async flushBuffer(key: string) {
    const item = this.debounceMap.get(key);
    if (!item) return;
    this.debounceMap.delete(key);

    const textoConsolidado = item.messages.join('. ').trim();
    this.logger.log(
      `[Debounce WA] ⏳ Ventana expirada para ${key}. Procesando lote de ${item.messages.length} mensaje(s): "${textoConsolidado}" (modo: ${item.esAudio ? 'voz' : 'texto'})`,
    );

    // Mantener la presencia en WhatsApp mientras el LLM genera la respuesta y sintetiza el audio
    void this.whatsappService.enviarPresencia(item.remoteJid, item.esAudio ? 'recording' : 'composing');

    try {
      if (item.cleanPhone) {
        await this.enrutarEntrante(item.cleanPhone, textoConsolidado, item.esAudio, item.audioEntrada);
      } else if (this.voice.enabled) {
        this.logger.warn(`Teléfono no resuelto para ${item.remoteJid}: respondiendo con gpt-4o-mini sin contexto.`);
        await this.responderConOpenAi(item.remoteJid, textoConsolidado, item.esAudio);
      }
    } catch (err: any) {
      this.logger.error(`Error procesando lote de WhatsApp para ${key}: ${err.message}`);
    }
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

    // Mapeo manual opcional: WHATSAPP_LID_MAP="122707249234090=51919632928,otro=519..."
    const mapa = (process.env.WHATSAPP_LID_MAP || '')
      .split(',')
      .map((p) => p.trim().split('='))
      .find(([lid]) => lid && lid === remoteJid.split('@')[0]);
    if (mapa?.[1]) return mapa[1].replace(/\D/g, '');

    return this.evolutionDb.resolverTelefonoDesdeLid(remoteJid);
  }

  /**
   * Enruta un mensaje entrante de WhatsApp:
   *   1. Si el número corresponde a una ORDEN_PAGO con contrato en INBESTIGA_TESIS → Agente PAYERS
   *      (el mismo que alimenta el Live Chat de cobranza) y se responde por WhatsApp.
   *   2. Si no coincide con ninguna orden → Agente de negociación (inbestiga_db / Prisma).
   */
  private async enrutarEntrante(
    cleanPhone: string,
    contenido: string,
    esAudio = false,
    audioEntrada?: { buffer: Buffer; filename?: string; mimeType?: string },
  ) {
    const orden = await this.payersService.buscarOrdenPorTelefono(cleanPhone);

    if (orden?.orden_pago_id) {
      const ordenPagoId = Number(orden.orden_pago_id);
      this.logger.log(
        `→ Enrutando a Agente PAYERS (Live Chat): ${orden.codigo_orden} · ${orden.nombres} ${orden.apellidos} (modo: ${esAudio ? 'voz' : 'texto'})`,
      );

      const resultado = await this.payersService.procesarChatAgente(ordenPagoId, contenido, {
        voz: esAudio,
        canal: 'WHATSAPP',
        audioEntrada,
      });

      const despacho = esAudio
        ? await this.enviarVozConRespaldo(
            cleanPhone,
            resultado.respuesta,
            async () => resultado.audioRespuestaBase64 || null,
          )
        : {
            modo: 'texto' as const,
            envio: await this.whatsappService.enviarTextoSimple(cleanPhone, resultado.respuesta),
          };
      const envio = despacho.envio;

      return {
        status: 'processed',
        agente: 'PAYERS',
        orden: orden.codigo_orden,
        modo: despacho.modo,
        transcripcion: esAudio ? contenido : undefined,
        respuesta: resultado.respuesta,
        guardrailsActivados: resultado.guardrailsActivados,
        herramientasEjecutadas: resultado.herramientasEjecutadas,
        envio,
      };
    }

    if (this.voice.enabled) {
      return this.responderConOpenAi(cleanPhone, contenido, esAudio);
    }

    const resultado = await this.negotiationService.procesarMensajeEstudiante(cleanPhone, contenido);
    return { status: 'processed', agente: 'NEGOCIACION', resultado };
  }

  /** Desenvuelve wrappers anidados de Baileys (ephemeral, viewOnce, documentWithCaption). */
  private unwrapWhatsAppMessage(rawMsg: any): any {
    let current = rawMsg || {};
    let depth = 0;
    while (depth < 5) {
      const inner =
        current?.ephemeralMessage?.message ||
        current?.viewOnceMessage?.message ||
        current?.viewOnceMessageV2?.message ||
        current?.viewOnceMessageV2Extension?.message ||
        current?.documentWithCaptionMessage?.message;
      if (!inner) break;
      current = inner;
      depth++;
    }
    return current;
  }

  /** Intenta enviar nota de voz; ante error de TTS o fallo de Evolution API cae a texto simple. */
  private async enviarVozConRespaldo(
    phone: string,
    texto: string,
    getAudioBase64: () => Promise<string | null>,
  ): Promise<{ modo: 'voz' | 'texto'; envio: any }> {
    try {
      const audioBase64 = await getAudioBase64();
      if (audioBase64) {
        const vRes = await this.whatsappService.enviarNotaDeVoz(phone, audioBase64);
        if (vRes?.exito) {
          return { modo: 'voz', envio: vRes };
        }
        const detalleErr =
          typeof vRes?.detalles === 'string'
            ? vRes.detalles
            : vRes?.detalles
              ? JSON.stringify(vRes.detalles)
              : 'sin detalle';
        this.logger.warn(
          `Fallo enviando nota de voz a ${phone} (${detalleErr}); enviando texto de respaldo.`,
        );
      }
    } catch (error: any) {
      this.logger.warn(
        `Error sintetizando o enviando voz a ${phone} (${error?.message || error}); enviando texto de respaldo.`,
      );
    }
    const envio = await this.whatsappService.enviarTextoSimple(phone, texto);
    return { modo: 'texto', envio };
  }

  /**
   * Obtiene el audio del mensaje: primero desde el Base64 del webhook (si Evolution lo envía)
   * y, si no, vía POST /chat/getBase64FromMediaMessage/{instance}. Luego lo transcribe (STT).
   */
  private async transcribirAudio(
    data: any,
    msgObj: any,
    key: any,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string; texto: string }> {
    const audioMsg = msgObj?.audioMessage || data?.message?.audioMessage;
    let b64: string | null = data?.message?.base64 || data?.base64 || null;
    if (!b64) {
      b64 = await this.whatsappService.getMediaBase64(key);
    }
    if (!b64) throw new Error('no se pudo obtener el audio en Base64');
    const pure = b64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(pure, 'base64');
    const mimeType = String(audioMsg?.mimetype || 'audio/ogg');
    const cleanMime = mimeType.split(';')[0].trim().toLowerCase();
    const ext = cleanMime.includes('webm')
      ? 'webm'
      : cleanMime.includes('mp4') || cleanMime.includes('m4a')
        ? 'mp4'
        : cleanMime.includes('mpeg') || cleanMime.includes('mp3')
          ? 'mp3'
          : cleanMime.includes('wav')
            ? 'wav'
            : 'ogg';
    const filename = `whatsapp-audio.${ext}`;
    const texto = await this.voice.transcribe(buffer, filename, mimeType);
    return { buffer, filename, mimeType, texto };
  }

  /** Cerebro gpt-4o-mini. Audio entrante -> nota de voz (TTS) con respaldo en texto; texto entrante -> texto. */
  private async responderConOpenAi(phone: string, contenido: string, esAudio: boolean) {
    const respuesta = await this.voice.reply(`wa:${phone}`, contenido, { voz: esAudio });
    if (!respuesta) return { status: 'ignored', reason: 'respuesta_vacia' };

    if (esAudio) {
      const despacho = await this.enviarVozConRespaldo(phone, respuesta, async () => {
        const audio = await this.voice.synthesize(respuesta);
        return audio.toString('base64');
      });
      return {
        status: 'processed',
        agente: 'OPENAI',
        modo: despacho.modo,
        transcripcion: contenido,
        respuesta,
        envio: despacho.envio,
      };
    }

    const envio = await this.whatsappService.enviarTextoSimple(phone, respuesta);
    return { status: 'processed', agente: 'OPENAI', modo: 'texto', respuesta, envio };
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

    const resultado = await this.payersService.procesarChatAgente(ordenPagoId, texto, { canal: 'WHATSAPP' });

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

  @Post('agent-voice')
  @UseInterceptors(FileInterceptor('audio', VOICE_UPLOAD_LIMITS))
  @ApiOperation({
    summary:
      'Procesa una nota de voz desde el Live Chat de cobranza y envía la respuesta de voz (o texto) del Agente PAYERS al WhatsApp real del estudiante',
  })
  async agentVoice(
    @Body() body: { ordenPagoId?: string | number },
    @UploadedFile() file: { buffer: Buffer; originalname?: string; mimetype?: string } | undefined,
  ) {
    const { ordenPagoId, buffer, filename, mimeType } = validarUploadVoz(body?.ordenPagoId, file);
    const resultado = await this.payersService.procesarAudioAgente(
      ordenPagoId,
      buffer,
      filename,
      mimeType,
      'WHATSAPP',
    );

    let envio: any = null;
    const telefono = await this.payersService.obtenerTelefonoPorOrden(ordenPagoId);
    if (telefono) {
      const cleanPhone = String(telefono).replace(/\D/g, '');
      envio = resultado.audioRespuestaBase64
        ? await this.whatsappService.enviarNotaDeVoz(cleanPhone, resultado.audioRespuestaBase64)
        : await this.whatsappService.enviarTextoSimple(cleanPhone, resultado.respuesta);
      this.logger.log(`→ Live Chat (voz): respuesta del Agente PAYERS despachada a WhatsApp ${cleanPhone}`);
    } else {
      this.logger.warn(
        `Live Chat (voz): no se encontró teléfono para la orden ${ordenPagoId}; la respuesta quedó solo en el panel.`,
      );
    }

    return { ...resultado, envio };
  }
}
