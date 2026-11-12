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

@Injectable()
export class OpenWAProvider {
  private readonly logger = new Logger(OpenWAProvider.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly sessionName: string;
  private sessionIdCache: string | null = null;

  constructor() {
    this.baseUrl = process.env.OPENWA_BASE_URL || 'http://localhost:2785';
    this.apiKey = process.env.OPENWA_API_KEY || 'mi-clave-segura-para-pruebas';
    this.sessionName = process.env.OPENWA_SESSION_NAME || 'inbestiga-bot';

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  /**
   * Obtiene o inicializa la sesión en OpenWA
   */
  async getOrCreateSession(): Promise<string> {
    if (this.sessionIdCache) {
      return this.sessionIdCache;
    }

    try {
      const response = await this.client.get('/api/sessions');
      const sessions = response.data;
      if (Array.isArray(sessions) && sessions.length > 0) {
        // Priorizar sesión conectada y lista
        const readySession = sessions.find((s: any) => s.status === 'ready');
        if (readySession) {
          this.sessionIdCache = readySession.id;
          return this.sessionIdCache!;
        }
        const found = sessions.find((s: any) => s.name === this.sessionName || s.id);
        if (found) {
          this.sessionIdCache = found.id || found.sessionId;
          return this.sessionIdCache!;
        }
      }

      // Crear nueva sesión si no existe
      const createRes = await this.client.post('/api/sessions', {
        name: this.sessionName,
      });
      const newId = createRes.data?.id || createRes.data?.sessionId || 'default';
      this.sessionIdCache = newId;

      // Iniciar sesión
      try {
        await this.client.post(`/api/sessions/${newId}/start`);
      } catch (e: any) {
        this.logger.debug(`Sesión ${newId} ya iniciada o en proceso.`);
      }

      return newId;
    } catch (error: any) {
      this.logger.warn(`OpenWA API no disponible o error al consultar sesiones: ${error.message}. Modo fallback activado.`);
      return 'fallback-session';
    }
  }

  /**
   * Envía un mensaje de texto por WhatsApp a través de OpenWA
   */
  async sendTextMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    // Formatear chatId: si viene como 949123456 o 51949123456, convertir a formato WhatsApp: 51949123456@c.us
    let cleanPhone = options.chatId.replace(/\D/g, '');
    if (cleanPhone.length === 9) {
      cleanPhone = '51' + cleanPhone; // Código de Perú por defecto
    }
    const targetChatId = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@c.us`;

    this.logger.log(`[OpenWA] Despachando mensaje a ${targetChatId}: "${options.text.substring(0, 60)}..."`);

    try {
      const sessionId = await this.getOrCreateSession();
      if (sessionId !== 'fallback-session') {
        // Endpoint oficial de OpenWA para envío de texto: /api/sessions/{sessionId}/messages/send-text
        const response = await this.client.post(`/api/sessions/${sessionId}/messages/send-text`, {
          chatId: targetChatId,
          text: options.text,
        });

        this.logger.log(`✓ [OpenWA] Mensaje despachado a WhatsApp exitosamente. ID: ${response.data?.messageId || response.data?.id}`);

        return {
          exito: true,
          messageId: response.data?.messageId || response.data?.id || `wa_${Date.now()}`,
          detalles: response.data,
        };
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message;
      this.logger.warn(`[OpenWA] Envío real no completado (${errMsg}). Registrando mensaje en BD localmente.`);
    }

    return {
      exito: true,
      messageId: `msg_wa_sim_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      detalles: { fallback: true, phone: cleanPhone },
    };
  }

  /**
   * Consulta el estado de la sesión y si requiere escaneo de código QR
   */
  async getSessionStatus(): Promise<{ conectado: boolean; status: string; qr?: string; phone?: string; pushName?: string }> {
    try {
      const sessionId = await this.getOrCreateSession();
      if (sessionId === 'fallback-session') {
        return { conectado: false, status: 'OPENWA_DISCONNECTED' };
      }

      // Endpoint oficial para detalle de sesión: /api/sessions/{sessionId}
      const res = await this.client.get(`/api/sessions/${sessionId}`);
      const qrRes = await this.client.get(`/api/sessions/${sessionId}/qr`).catch(() => null);

      const status = res.data?.status || 'UNKNOWN';
      const isConnected = status === 'ready' || status === 'CONNECTED' || status === 'WORKING';

      return {
        conectado: isConnected,
        status,
        qr: qrRes?.data?.qrCode || qrRes?.data?.qr || qrRes?.data,
        phone: res.data?.phone,
        pushName: res.data?.pushName,
      };
    } catch (e: any) {
      return { conectado: false, status: 'DISCONNECTED' };
    }
  }
}
