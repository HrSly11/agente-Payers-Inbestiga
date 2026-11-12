import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import axios from 'axios';
import { PayersService } from '../payers/payers.service';

interface ChatSession {
  ordenPagoId: number;
  lastActive: Date;
}

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private token: string;
  private isPolling = false;
  private shouldStopPolling = false;
  private lastUpdateId = 0;
  private readonly chatSessions = new Map<number, ChatSession>();

  constructor(
    @Inject(forwardRef(() => PayersService))
    private readonly payersService: PayersService,
  ) {
    this.token = process.env.TELEGRAM_BOT_TOKEN || '';
  }

  async onModuleInit() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || '';
    if (this.isTokenValid()) {
      this.logger.log(`✓ Token de Telegram configurado. Verificando bot en Telegram...`);
      await this.verificarBotYIniciarPolling();
    } else {
      this.logger.log(`Telegram Bot en modo inactivo (TELEGRAM_BOT_TOKEN no configurado o es placeholder).`);
    }
  }

  onModuleDestroy() {
    this.shouldStopPolling = true;
  }

  private isTokenValid(): boolean {
    return (
      !!this.token &&
      this.token.length > 20 &&
      this.token.includes(':') &&
      !this.token.startsWith('mock_')
    );
  }

  /**
   * Consulta getMe en Telegram y arranca el Long-Polling si el token es válido
   */
  async verificarBotYIniciarPolling() {
    try {
      const url = `https://api.telegram.org/bot${this.token}/getMe`;
      const res = await axios.get(url, { timeout: 10000 });
      if (res.data?.ok) {
        const botInfo = res.data.result;
        this.logger.log(`🤖 Bot de Telegram conectado exitosamente: @${botInfo.username} (${botInfo.first_name})`);

        // Si no está corriendo el polling y no se especificó usar solo webhook, arrancamos polling
        if (!this.isPolling) {
          this.iniciarLongPolling();
        }
        return { ok: true, bot: botInfo };
      }
    } catch (error: any) {
      this.logger.warn(`Error al conectar con la API de Telegram: ${error.message}`);
      return { ok: false, error: error.message };
    }
    return { ok: false };
  }

  /**
   * Bucle de Long-Polling para desarrollo local (¡sin necesidad de ngrok ni puertos públicos!)
   */
  private async iniciarLongPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.shouldStopPolling = false;
    this.logger.log(`🚀 Iniciando bucle de Long-Polling de Telegram para recibir mensajes en tiempo real...`);

    // Limpiar cualquier webhook previo para permitir getUpdates
    try {
      await axios.get(`https://api.telegram.org/bot${this.token}/deleteWebhook`);
    } catch {
      // Ignorar si no había webhook
    }

    const pollingLoop = async () => {
      while (!this.shouldStopPolling) {
        try {
          const url = `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=25`;
          const response = await axios.get(url, { timeout: 35000 });

          if (response.data?.ok && Array.isArray(response.data.result)) {
            for (const update of response.data.result) {
              this.lastUpdateId = update.update_id;
              if (update.message) {
                await this.procesarMensajeTelegram(update.message);
              }
            }
          }
        } catch (error: any) {
          if (this.shouldStopPolling) break;
          // Esperar 3 segundos antes de reintentar si hubo error de red
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      this.isPolling = false;
      this.logger.log(`Bucle de Long-Polling de Telegram detenido.`);
    };

    pollingLoop();
  }

  /**
   * Extrae un número celular peruano de 9 dígitos del texto
   */
  private extraerTelefono(texto: string): string | null {
    if (!texto) return null;
    const regex = /(?:(?:\+?51)[\s.-]?)?(9(?:\d[\s.-]?){8})/;
    const match = regex.exec(texto);
    if (match && match[1]) {
      const clean = match[1].replace(/\D/g, '');
      if (clean.length === 9 && clean.startsWith('9')) {
        return clean;
      }
    }
    return null;
  }

  /**
   * Procesa un mensaje entrante (desde Polling o desde Webhook)
   */
  async procesarMensajeTelegram(message: any) {
    const chatId = message.chat?.id;
    let text = (message.text || '').trim();
    const fromUser = message.from?.first_name || 'Estudiante';
    const contactPhone = message.contact?.phone_number;

    if (!chatId) return;
    if (!text && !contactPhone) return;

    this.logger.log(`[Telegram] Mensaje de @${message.from?.username || fromUser} (${chatId}): "${text || contactPhone}"`);

    // 1. Verificar si este chat_id de Telegram ya está registrado permanentemente en la Base de Datos
    let expediente = await this.payersService.buscarOrdenPorTelegramChatId(chatId);
    let session = this.chatSessions.get(chatId);

    if (expediente) {
      if (!session || session.ordenPagoId !== expediente.orden_pago_id) {
        session = { ordenPagoId: expediente.orden_pago_id, lastActive: new Date() };
        this.chatSessions.set(chatId, session);
      }
    }

    // 2. Comando /start o saludo inicial
    if (text === '/start') {
      if (expediente) {
        // Estudiante ya registrado en la BD: el agente consulta su orden y emite su enlace directamente
        try {
          const resultado = await this.payersService.procesarChatAgente(
            expediente.orden_pago_id,
            'consultar estado de mi orden y enlace de pago',
          );
          let respuestaFinal = resultado.respuesta;
          if (resultado.herramientasEjecutadas && resultado.herramientasEjecutadas.length > 0) {
            const toolsNames = resultado.herramientasEjecutadas
              .map((t: any) => `\`${t.herramienta}\``)
              .join(', ');
            respuestaFinal += `\n\n🛠️ *Herramientas ejecutadas:* ${toolsNames}`;
          }
          await this.enviarMensaje(chatId, respuestaFinal);
          return;
        } catch {
          const bienvenidaRegistrado =
            `👋 ¡Hola **${expediente.nombres}**! Bienvenido a **INBESTIGA** 🎓.\n\n` +
            `📋 *Tu expediente activo:* \`${expediente.codigo_orden}\`\n` +
            `• *Servicio:* ${expediente.servicio_nombre}\n` +
            `• *Estado:* \`${expediente.estado}\`\n` +
            `• *Total:* S/ ${Number(expediente.monto_comprometido).toFixed(2)}\n\n` +
            `¿En qué puedo ayudarte hoy? Puedes solicitar tu enlace oficial de pago de Mercado Pago, consultar tus cuotas o reportar una transferencia.`;
          await this.enviarMensaje(chatId, bienvenidaRegistrado);
          return;
        }
      }

      // Estudiante nuevo en Telegram: solicitar vinculación sin exponer datos de prueba
      const bienvenidaNuevo =
        `👋 ¡Hola **${fromUser}**! Te saluda el Agente Virtual de Cobranza y Activación de **INBESTIGA** 🎓.\n\n` +
        `Puedo ayudarte a:\n` +
        `• 📋 Consultar el estado de tu expediente y cronograma de cuotas\n` +
        `• 💳 Obtener tu enlace oficial de pasarela (Mercado Pago / Tarjeta / Yape)\n` +
        `• 🏦 Solicitar datos de transferencia bancaria BCP / Interbank\n` +
        `• 📝 Confirmar tu contrato de asesoría y garantías\n\n` +
        `👉 *Para vincular permanentemente tu cuenta:* \n` +
        `1. Presiona el botón **[📱 Compartir mi número de celular]** abajo, o\n` +
        `2. Escribe tu **número de celular** registrado al contratar tu asesoría.`;

      const keyboard = {
        keyboard: [
          [
            {
              text: '📱 Compartir mi número de celular',
              request_contact: true,
            },
          ],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      };

      await this.enviarMensaje(chatId, bienvenidaNuevo, keyboard);
      return;
    }

    // 3. Identificación y Registro permanente por Celular (vía Botón de Contacto o escrito en texto)
    const telDetectado = contactPhone
      ? contactPhone.replace(/\D/g, '').slice(-9)
      : this.extraerTelefono(text);

    if (telDetectado) {
      const expEncontrado = await this.payersService.buscarOrdenPorTelefono(telDetectado);
      if (expEncontrado) {
        // Persistir permanentemente el chat_id y username de Telegram en la BD (INBESTIGA_TESIS.dbo.CONTACTO)
        await this.payersService.vincularTelegramChatId(
          expEncontrado.contacto_id,
          chatId,
          message.from?.username,
        );

        session = {
          ordenPagoId: expEncontrado.orden_pago_id,
          lastActive: new Date(),
        };
        this.chatSessions.set(chatId, session);
        this.logger.log(`[Telegram] Contacto #${expEncontrado.contacto_id} (${expEncontrado.nombres}) vinculado permanentemente a Telegram chat_id ${chatId}`);

        const mensajeConfirmacion =
          `✅ *¡Cuenta vinculada con éxito, ${expEncontrado.nombres} ${expEncontrado.apellidos}!* 🎓\n\n` +
          `Tu usuario de Telegram ha quedado registrado permanentemente en nuestro sistema con tu expediente \`${expEncontrado.codigo_orden}\`.\n\n` +
          `• *Servicio:* ${expEncontrado.servicio_nombre}\n` +
          `• *Estado:* \`${expEncontrado.estado}\`\n` +
          `• *Total comprometido:* S/ ${Number(expEncontrado.monto_comprometido).toFixed(2)}\n\n` +
          `A partir de ahora te reconoceré automáticamente sin pedirte tus datos. ¿En qué te puedo ayudar hoy? (Por ejemplo: ver cuotas, enlace de pago Mercado Pago o reportar voucher de transferencia).`;

        // Si el usuario envió SOLO el teléfono o el botón de contacto
        const textoSinTelefono = text.replace(/(?:(?:\+?51)[\s.-]?)?(9(?:\d[\s.-]?){8})/, '').trim();
        if (!textoSinTelefono || contactPhone) {
          await this.enviarMensaje(chatId, mensajeConfirmacion, { remove_keyboard: true });
          return;
        } else {
          // El usuario mandó teléfono + consulta en el mismo mensaje
          await this.enviarMensaje(
            chatId,
            `✅ *Cuenta registrada:* ${expEncontrado.nombres} ${expEncontrado.apellidos} (\`${expEncontrado.codigo_orden}\`)`,
            { remove_keyboard: true },
          );
          text = textoSinTelefono;
        }
      } else {
        await this.enviarMensaje(
          chatId,
          `⚠️ No encontramos ningún expediente registrado con el número *${telDetectado}*.\n\nPor favor verifica que sea el número con el que contrataste tu asesoría o indícanos directamente tu código de orden.`,
        );
        return;
      }
    }

    // 4. Identificación por Código de Orden explícito (ej. ORD-2026-0042 o ORD 42)
    const matchOrden = text.match(/ORD[-_ ]?2026[-_ ]?(\d{1,4})/i) || text.match(/\b(orden\s*#?\s*)(\d{1,3})\b/i);
    if (matchOrden) {
      const num = parseInt(matchOrden[1] || matchOrden[2], 10);
      if (num >= 1 && num <= 104) {
        session = { ordenPagoId: num, lastActive: new Date() };
        this.chatSessions.set(chatId, session);
        this.logger.log(`[Telegram] Chat ${chatId} vinculado a Orden #${num} por código de orden`);
      }
    }

    // 5. Verificar si ya existe una sesión identificada
    if (!session) {
      const promptIdentificacion =
        `👋 ¡Hola ${fromUser}! Para brindarte información sobre tus cuotas o emitir tu enlace de pago oficial, necesito identificar tu expediente.\n\n` +
        `Por favor, presiona el botón inferior para compartir tu número o escribe tu celular registrado al contratar tu asesoría.`;

      const keyboard = {
        keyboard: [
          [
            {
              text: '📱 Compartir mi número de celular',
              request_contact: true,
            },
          ],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      };

      await this.enviarMensaje(chatId, promptIdentificacion, keyboard);
      return;
    }

    // 5. Pasar el mensaje al Agente IA de Cobranza PAYERS
    try {
      const resultado = await this.payersService.procesarChatAgente(session.ordenPagoId, text);

      // Formatear la respuesta para Telegram
      let respuestaFinal = resultado.respuesta;

      // Si se ejecutaron herramientas, agregar pie informativo
      if (resultado.herramientasEjecutadas && resultado.herramientasEjecutadas.length > 0) {
        const toolsNames = resultado.herramientasEjecutadas.map((t: any) => `\`${t.herramienta}\``).join(', ');
        respuestaFinal += `\n\n🛠️ *Herramientas ejecutadas:* ${toolsNames}`;
      }

      await this.enviarMensaje(chatId, respuestaFinal);
    } catch (error: any) {
      this.logger.error(`Error al procesar mensaje en PayersService: ${error.message}`);
      await this.enviarMensaje(
        chatId,
        `Lo siento, ocurrió una incidencia temporal al procesar tu solicitud. Por favor intenta nuevamente en unos momentos.`,
      );
    }
  }

  /**
   * Envía un mensaje a un chat de Telegram
   */
  async enviarMensaje(chatId: number | string, texto: string, replyMarkup?: any) {
    if (!this.isTokenValid()) return;

    const payload: any = {
      chat_id: chatId,
      text: texto,
      parse_mode: 'Markdown',
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    try {
      const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
      await axios.post(url, payload);
    } catch (error: any) {
      // Fallback sin Markdown si el formateo falla
      try {
        const fallbackPayload: any = {
          chat_id: chatId,
          text: texto,
        };
        if (replyMarkup) fallbackPayload.reply_markup = replyMarkup;
        const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
        await axios.post(url, fallbackPayload);
      } catch (innerError: any) {
        this.logger.error(`Error al enviar mensaje a Telegram ${chatId}: ${innerError.message}`);
      }
    }
  }

  /**
   * Retorna el estado actual del conector de Telegram
   */
  async getStatus() {
    const configured = this.isTokenValid();
    let botInfo = null;

    if (configured) {
      try {
        const res = await axios.get(`https://api.telegram.org/bot${this.token}/getMe`, { timeout: 5000 });
        if (res.data?.ok) {
          botInfo = res.data.result;
        }
      } catch {}
    }

    return {
      configurado: configured,
      pollingActivo: this.isPolling,
      bot: botInfo,
      sesionesActivas: this.chatSessions.size,
    };
  }
}
