import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  PaymentProvider,
  CreateCheckoutInput,
  CreateCheckoutResult,
  WebhookVerificationResult,
} from '../payment-provider.interface';

@Injectable()
export class MercadoPagoProvider implements PaymentProvider {
  private readonly logger = new Logger(MercadoPagoProvider.name);
  private readonly accessToken: string;
  private readonly publicKey: string;
  private readonly apiUrl = 'https://api.mercadopago.com';

  constructor() {
    this.accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
    this.publicKey = process.env.MERCADOPAGO_PUBLIC_KEY || '';

    if (this.accessToken && !this.accessToken.includes('...')) {
      const esPrueba = this.accessToken.startsWith('TEST-') || this.accessToken.includes('TESTUSER') || this.accessToken.startsWith('APP_USR-');
      this.logger.log(`✓ Mercado Pago Provider inicializado con credenciales (${esPrueba ? 'MODO SANDBOX / TEST' : 'MODO PRODUCCIÓN'}).`);
    } else {
      this.logger.log('ℹ Mercado Pago Provider en modo DEMO. Configure MERCADOPAGO_ACCESS_TOKEN en .env.');
    }
  }

  /**
   * Crea una Preferencia de Pago en Mercado Pago (Checkout Pro).
   * Devuelve el enlace directo sandbox_init_point (para pruebas) o init_point (producción).
   */
  async crearCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const monto = Number(input.monto);

    if (this.accessToken) {
      try {
        const bodyPreference: any = {
          items: [
            {
              id: input.cotizacionId,
              title: input.descripcion || `INBESTIGA.TESIS - ${input.cotizacionId}`,
              quantity: 1,
              unit_price: monto,
              currency_id: input.moneda.toUpperCase() === 'USD' ? 'USD' : 'PEN',
            },
          ],
          payer: {
            name: input.clienteNombre?.split(' ')[0] || 'Estudiante',
            surname: input.clienteNombre?.split(' ').slice(1).join(' ') || 'Investigador',
            email: input.clienteEmail || 'estudiante@inbestiga.pe',
          },
          ...(appUrl.startsWith('https://')
            ? {
                back_urls: {
                  success: `${appUrl}/checkout/${input.cotizacionId}?status=approved`,
                  failure: `${appUrl}/checkout/${input.cotizacionId}?status=rejected`,
                  pending: `${appUrl}/checkout/${input.cotizacionId}?status=pending`,
                },
              }
            : {}),
          external_reference: input.cotizacionId,
          statement_descriptor: 'INBESTIGA TESIS',
        };

        const response = await axios.post(`${this.apiUrl}/checkout/preferences`, bodyPreference, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
        });

        const prefData = response.data;
        const checkoutUrl = this.accessToken.startsWith('TEST-')
          ? prefData.sandbox_init_point || prefData.init_point
          : prefData.init_point || prefData.sandbox_init_point;
        this.logger.log(`✓ Preferencia Mercado Pago creada: ${prefData.id} -> ${checkoutUrl}`);

        return {
          gatewayTransactionId: prefData.id,
          checkoutUrl,
          proveedor: 'MERCADOPAGO',
          payload: prefData,
        };
      } catch (error: any) {
        const errMsg = error.response?.data?.message || error.message;
        this.logger.warn(`Error llamando a Mercado Pago Preferences API: ${errMsg}. Fallback a checkout integrado.`);
      }
    }

    const fallbackTx = `mp_pref_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return {
      gatewayTransactionId: fallbackTx,
      checkoutUrl: `${appUrl}/checkout/${input.cotizacionId}`,
      proveedor: 'MERCADOPAGO',
      payload: { mode: 'sandbox', cotizacionId: input.cotizacionId, transactionId: fallbackTx },
    };
  }

  /**
   * Busca los pagos de Mercado Pago asociados a una orden (external_reference).
   * Permite confirmar pagos sin webhook, ideal para entornos locales sin URL pública.
   */
  async buscarPagosPorReferencia(externalReference: string): Promise<any[]> {
    if (!this.accessToken) return [];
    try {
      const response = await axios.get(`${this.apiUrl}/v1/payments/search`, {
        params: { external_reference: externalReference, sort: 'date_created', criteria: 'asc' },
        headers: { Authorization: `Bearer ${this.accessToken}` },
        timeout: 8000,
      });
      return response.data?.results || [];
    } catch (err: any) {
      this.logger.warn(`Error buscando pagos de ${externalReference} en Mercado Pago: ${err.message}`);
      return [];
    }
  }

  /**
   * Consulta el estado de un pago específico en la API de Mercado Pago por ID
   */
  async obtenerPago(paymentId: string | number): Promise<any> {
    if (!this.accessToken) return null;
    try {
      const response = await axios.get(`${this.apiUrl}/v1/payments/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        timeout: 7000,
      });
      return response.data;
    } catch (err: any) {
      this.logger.warn(`Error consultando pago ${paymentId} en Mercado Pago: ${err.message}`);
      return null;
    }
  }

  /**
   * Procesa la notificación / webhook enviada por Mercado Pago
   */
  async verificarWebhook(payload: any): Promise<WebhookVerificationResult> {
    this.logger.log(`Webhook Mercado Pago recibido: ${JSON.stringify(payload)}`);

    const paymentId = payload?.data?.id || payload?.id;
    if (paymentId && (payload.type === 'payment' || payload.action === 'payment.created' || payload.action === 'payment.updated')) {
      const paymentData = await this.obtenerPago(paymentId);
      if (paymentData) {
        const status = paymentData.status;
        const estadoFinal =
          status === 'approved'
            ? 'CONFIRMADO'
            : status === 'in_process' || status === 'pending'
              ? 'PENDIENTE'
              : 'FALLIDO';

        return {
          valido: true,
          gatewayTransactionId: String(paymentData.id),
          estado: estadoFinal,
          monto: Number(paymentData.transaction_amount || 0),
          moneda: paymentData.currency_id || 'PEN',
          metodoPago: paymentData.payment_type_id || 'MERCADOPAGO',
          payloadOriginal: paymentData,
        };
      }
    }

    return {
      valido: false,
      gatewayTransactionId: String(paymentId || 'desconocido'),
      estado: 'PENDIENTE',
      monto: 0,
      moneda: 'PEN',
      metodoPago: 'MERCADOPAGO',
      payloadOriginal: payload,
    };
  }
}
