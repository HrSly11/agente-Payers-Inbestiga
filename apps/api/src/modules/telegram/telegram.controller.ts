import {
  Controller,
  Post,
  Get,
  Body,
  Logger,
  Inject,
  forwardRef,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';
import { PayersService } from '../payers/payers.service';
import { VOICE_UPLOAD_LIMITS, validarUploadVoz } from '../voice/voice-upload.helper';

@ApiTags('Telegram Bot')
@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly telegramService: TelegramService,
    @Inject(forwardRef(() => PayersService))
    private readonly payersService: PayersService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Obtiene el estado de conexión del Bot de Telegram (Polling / Webhook)' })
  async getStatus() {
    return this.telegramService.getStatus();
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Receptor de Webhooks entrantes de Telegram (modo producción)' })
  async handleWebhook(@Body() update: any) {
    if (update?.message) {
      // Procesar de manera asíncrona
      this.telegramService.procesarMensajeTelegram(update.message);
    }
    return { ok: true };
  }

  @Post('conectar')
  @ApiOperation({ summary: 'Reintenta la conexión y arranque del bot de Telegram' })
  async reconnect() {
    return this.telegramService.verificarBotYIniciarPolling();
  }

  @Post('agent-chat')
  @ApiOperation({
    summary:
      'Procesa un mensaje desde el Live Chat de cobranza y envía la respuesta del Agente PAYERS al Telegram real del estudiante',
  })
  async agentChat(@Body() body: { ordenPagoId: number; mensaje?: string; contenido?: string }) {
    const ordenPagoId = Number(body.ordenPagoId);
    const texto = body.mensaje || body.contenido || '';

    const resultado = await this.payersService.procesarChatAgente(ordenPagoId, texto, { canal: 'TELEGRAM' });

    let envio: any = null;
    const tg = await this.payersService.obtenerTelegramChatIdPorOrden(ordenPagoId);
    if (tg?.chatId) {
      const envioRes = await this.telegramService.enviarMensaje(tg.chatId, resultado.respuesta);
      envio = {
        exito: Boolean(envioRes?.exito ?? true),
        canal: 'TELEGRAM',
        chatId: tg.chatId,
        username: tg.username,
        error: envioRes?.error,
      };
      if (envio.exito) {
        this.logger.log(`→ Live Chat: respuesta del Agente PAYERS despachada a Telegram ${tg.chatId}`);
      } else {
        this.logger.warn(
          `→ Live Chat: falló despacho a Telegram ${tg.chatId}: ${envioRes?.error || 'error desconocido'}`,
        );
      }
    } else {
      this.logger.warn(
        `Live Chat: no se encontró telegram_chat_id para la orden ${ordenPagoId}; la respuesta quedó en el panel.`,
      );
      envio = { exito: false, canal: 'TELEGRAM', razon: 'sin_telegram_chat_id' };
    }

    return { ...resultado, envio };
  }

  @Post('agent-voice')
  @UseInterceptors(FileInterceptor('audio', VOICE_UPLOAD_LIMITS))
  @ApiOperation({
    summary:
      'Procesa una nota de voz desde el Live Chat de cobranza y envía la respuesta de voz (o texto) del Agente PAYERS al Telegram real del estudiante',
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
      'TELEGRAM',
    );

    let envio: any = null;
    const tg = await this.payersService.obtenerTelegramChatIdPorOrden(ordenPagoId);
    if (tg?.chatId) {
      const sendRes = resultado.audioRespuestaBase64
        ? await this.telegramService.enviarVoz(tg.chatId, Buffer.from(resultado.audioRespuestaBase64, 'base64'))
        : await this.telegramService.enviarMensaje(tg.chatId, resultado.respuesta);
      envio = {
        exito: sendRes.exito,
        canal: 'TELEGRAM',
        chatId: tg.chatId,
        username: tg.username,
        error: sendRes.error,
      };
      this.logger.log(`→ Live Chat (voz): respuesta del Agente PAYERS despachada a Telegram ${tg.chatId}`);
    } else {
      this.logger.warn(
        `Live Chat (voz): no se encontró telegram_chat_id para la orden ${ordenPagoId}; la respuesta quedó en el panel.`,
      );
      envio = { exito: false, canal: 'TELEGRAM', razon: 'sin_telegram_chat_id' };
    }

    return { ...resultado, envio };
  }
}
