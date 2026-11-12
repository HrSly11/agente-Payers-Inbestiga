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
          base64: false,
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
