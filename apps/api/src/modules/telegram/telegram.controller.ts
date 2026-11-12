import { Controller, Post, Get, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';

@ApiTags('Telegram Bot')
@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private readonly telegramService: TelegramService) {}

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
}
