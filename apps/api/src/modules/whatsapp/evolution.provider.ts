import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface SendMessageOptions {
  chatId: string;
  text: string;
}

export interface SendMessageResult {
  exito: boolean;
  messageId: string;
  detalles?: any;
}

/**
 * Cliente HTTP para Evolution API v2 (WhatsApp vía Baileys).
 * Autenticación por header `apikey`. Todas las rutas se anidan bajo la instancia configurada.
 * Docs: https://doc.evolution-api.com/v2/api-reference/get-information
 */
@Injectable()
export class EvolutionProvider {
  private readonly logger = new Logger(EvolutionProvider.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly instanceName: string;

  constructor() {
    this.baseUrl = (process.env.EVO_URL || 'http://localhost:8080').replace(/\/+$/, '');
    this.apiKey = process.env.EVO_KEY || '';
    this.instanceName = process.env.EVO_INSTANCE || 'inbestiga';

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        apikey: this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });
  }

  get configured(): boolean {
    return !!this.apiKey && !!this.baseUrl;
  }

  get instance(): string {
    return this.instanceName;
  }

  /**
   * Normaliza un teléfono al formato que espera Evolution API: solo dígitos con código de país.
   * Acepta "949103345", "51949103345", "51949103345@s.whatsapp.net" o "+51 949 103 345".
   */
  private normalizarNumero(telefono: string): string {
    // Los LID (identificadores opacos de WhatsApp) se envían tal cual, como JID completo
    if (String(telefono).endsWith('@lid')) return String(telefono);
    let clean = String(telefono).split('@')[0].replace(/\D/g, '');
    clean = clean.replace(/^0+/, '');
    if (clean.length === 9 && clean.startsWith('9')) {
      clean = '51' + clean; // Móvil de Perú sin código de país
    }
    return clean;
  }

  /**
   * Verifica que la instancia exista y esté registrada; la crea si no existe (idempotente).
   */
  async ensureInstance(): Promise<{ ok: boolean; creada?: boolean; estado?: string }> {
    if (!this.configured) {
      this.logger.warn('[Evolution] EVO_URL / EVO_KEY no configurados. Integración inactiva.');
      return { ok: false };
    }

    try {
      const estado = await this.getConnectionState();
      if (estado) {
        return { ok: true, creada: false, estado };
      }

      await this.client.post('/instance/create', {
        instanceName: this.instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      });
      this.logger.log(`✓ [Evolution] Instancia "${this.instanceName}" creada en ${this.baseUrl}.`);
      return { ok: true, creada: true };
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      this.logger.warn(`[Evolution] No se pudo crear/verificar la instancia "${this.instanceName}": ${msg}`);
      return { ok: false };
    }
  }

  /**
   * Estado de conexión de la instancia: `open` (conectada), `connecting` o `close`.
   */
  async getConnectionState(): Promise<string | null> {
    if (!this.configured) return null;
    try {
      const res = await this.client.get(`/instance/connectionState/${this.instanceName}`);
      return res.data?.instance?.state || res.data?.state || null;
    } catch {
      return null;
    }
  }

  /**
   * Registra (o actualiza) el webhook de eventos apuntando al agente.
   */
  async setWebhook(url: string): Promise<boolean> {
    if (!this.configured || !url) return false;
    try {
      await this.client.post(`/webhook/set/${this.instanceName}`, {
        webhook: {
          enabled: true,
          url,
          byEvents: false,
          base64: true,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
        },
      });
      this.logger.log(`✓ [Evolution] Webhook registrado -> ${url}`);
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      this.logger.warn(`[Evolution] No se pudo registrar el webhook: ${msg}`);
      return false;
    }
  }

  /**
   * Envía un mensaje de texto por WhatsApp a través de Evolution API.
   */
  async sendTextMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const number = this.normalizarNumero(options.chatId);
    this.logger.log(`[Evolution] Despachando mensaje a ${number}: "${options.text.substring(0, 60)}..."`);

    if (!this.configured) {
      this.logger.warn('[Evolution] Integración no configurada: el mensaje NO se envió realmente.');
      return { exito: false, messageId: `evo_no_config_${Date.now()}`, detalles: { enviado: false, number } };
    }

    try {
      const response = await this.client.post(`/message/sendText/${this.instanceName}`, {
        number,
        text: options.text,
      });

      const messageId = response.data?.key?.id || response.data?.id || `evo_${Date.now()}`;
      this.logger.log(`✓ [Evolution] Mensaje despachado a WhatsApp ${number}. ID: ${messageId}`);

      return { exito: true, messageId, detalles: response.data };
    } catch (error: any) {
      const errMsg =
        error.response?.data?.message || error.response?.data?.response?.message || error.message;
      this.logger.error(`[Evolution] Falló el envío a ${number}: ${errMsg}`);
      return { exito: false, messageId: `evo_fail_${Date.now()}`, detalles: { error: errMsg, number } };
    }
  }

  /** Muestra "escribiendo…" / "grabando audio…" mientras el agente procesa (mejora la latencia percibida). */
  async sendPresence(telefono: string, presence: 'composing' | 'recording'): Promise<void> {
    if (!this.configured) return;
    try {
      await this.client.post(
        `/chat/sendPresence/${this.instanceName}`,
        { number: this.normalizarNumero(telefono), presence, delay: 25000 },
        { timeout: 5000 },
      );
    } catch {
      // Indicador cosmético: nunca debe romper el flujo
    }
  }

  /**
   * Descarga el contenido de un mensaje multimedia (audio) como Base64 puro.
   * POST /chat/getBase64FromMediaMessage/{instance}
   */
  async getMediaBase64(messageKey: any): Promise<string | null> {
    if (!this.configured) return null;
    try {
      const res = await this.client.post(`/chat/getBase64FromMediaMessage/${this.instanceName}`, {
        message: { key: messageKey },
        convertToMp4: false,
      });
      const b64: string | undefined = res.data?.base64;
      return b64 ? b64.replace(/^data:[^;]+;base64,/, '') : null;
    } catch (error: any) {
      this.logger.error(
        `[Evolution] getBase64FromMediaMessage falló: ${error.response?.data?.message || error.message}`,
      );
      return null;
    }
  }

  /**
   * Envía una nota de voz nativa (PTT). `audioBase64` debe ser Base64 puro (sin prefijo data:).
   * POST /message/sendWhatsAppAudio/{instance}
   */
  async sendVoiceNote(telefono: string, audioBase64: string): Promise<SendMessageResult> {
    const number = this.normalizarNumero(telefono);
    if (!this.configured) {
      return { exito: false, messageId: `evo_no_config_${Date.now()}`, detalles: { enviado: false, number } };
    }
    try {
      const response = await this.client.post(
        `/message/sendWhatsAppAudio/${this.instanceName}`,
        { number, audio: audioBase64.replace(/^data:[^;]+;base64,/, ''), encoding: true },
        { timeout: 60000 },
      );
      const messageId = response.data?.key?.id || response.data?.id || `evo_${Date.now()}`;
      return { exito: true, messageId, detalles: response.data };
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.response?.data?.response?.message || error.message;
      this.logger.error(`[Evolution] Falló el envío de nota de voz a ${number}: ${JSON.stringify(errMsg)}`);
      return { exito: false, messageId: `evo_fail_${Date.now()}`, detalles: { error: errMsg, number } };
    }
  }

  /**
   * Consulta el estado de la sesión y, si no está conectada, devuelve el QR para escanear.
   */
  async getSessionStatus(): Promise<{
    conectado: boolean;
    status: string;
    qr?: string;
    phone?: string;
    pushName?: string;
  }> {
    if (!this.configured) {
      return { conectado: false, status: 'EVOLUTION_NOT_CONFIGURED' };
    }

    const estado = await this.getConnectionState();
    const conectado = estado === 'open';

    let qr: string | undefined;
    if (!conectado) {
      try {
        const res = await this.client.get(`/instance/connect/${this.instanceName}`);
        qr = res.data?.base64 || res.data?.qrcode?.base64 || res.data?.code;
      } catch {
        // Sin QR disponible (instancia inexistente o ya vinculada)
      }
    }

    return { conectado, status: estado || 'UNKNOWN', qr };
  }
}
