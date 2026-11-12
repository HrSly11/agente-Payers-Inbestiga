export interface CreateCheckoutInput {
  cotizacionId: string;
  monto: number;
  moneda: string;
  descripcion: string;
  clienteEmail: string;
  clienteNombre: string;
  cuotas: number;
}

export interface CreateCheckoutResult {
  gatewayTransactionId: string;
  checkoutUrl: string;
  proveedor: string;
  payload?: any;
}

export interface WebhookVerificationResult {
  valido: boolean;
  gatewayTransactionId: string;
  estado: 'CONFIRMADO' | 'PENDIENTE' | 'FALLIDO' | 'EXPIRADO' | 'REEMBOLSADO';
  monto: number;
  moneda: string;
  metodoPago: string;
  payloadOriginal: any;
}

export interface PaymentProvider {
  crearCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  verificarWebhook(payload: any, signature?: string): Promise<WebhookVerificationResult>;
}
