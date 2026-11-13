const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store',
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.message || `Error en la petición: ${res.status} ${res.statusText}`);
    }

    return data;
  } catch (error: any) {
    console.error(`[API Error] ${endpoint}:`, error);
    throw error;
  }
}

function postAudio(endpoint: string, ordenPagoId: number, audioBlob: Blob, filename = 'nota-voz.webm') {
  const formData = new FormData();
  formData.append('ordenPagoId', String(ordenPagoId));
  formData.append('audio', audioBlob, filename);
  return fetchApi(endpoint, {
    method: 'POST',
    body: formData,
  });
}

export const api = {
  // Buyers & Formulario
  getBuyers: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/buyers${query ? `?${query}` : ''}`);
  },
  getBuyer: (id: string) => fetchApi(`/buyers/${id}`),
  getCatalogos: () => fetchApi('/buyers/catalogos'),
  submitFormulario: (data: any) =>
    fetchApi('/buyers/formulario', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Negociación
  iniciarNegociacion: (buyerId: string) =>
    fetchApi(`/negotiation/iniciar/${buyerId}`, {
      method: 'POST',
    }),
  getConversacion: (id: string) => fetchApi(`/negotiation/conversacion/${id}`),
  enviarMensajeNegociacion: (telefono: string, contenido: string) =>
    fetchApi('/negotiation/enviar-mensaje', {
      method: 'POST',
      body: JSON.stringify({ telefono, contenido }),
    }),
  limpiarConversacion: (id: string) =>
    fetchApi(`/negotiation/conversacion/${id}/limpiar`, {
      method: 'POST',
    }),
  limpiarConversacionPorBuyer: (buyerId: string) =>
    fetchApi(`/negotiation/buyer/${buyerId}/limpiar`, {
      method: 'POST',
    }),

  // Dashboard & ETL
  getDashboardOverview: () => fetchApi('/dashboard/overview'),
  runEtl: () => fetchApi('/etl/run', { method: 'POST' }),
  getEtlOverview: () => fetchApi('/etl/overview'),

  // Configuración del Agente IA
  getAgentConfig: () => fetchApi('/agent/config'),
  updateAgentConfig: (data: any) =>
    fetchApi('/agent/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Servicios y Reglas
  getServices: () => fetchApi('/services'),
  getCommercialRules: () => fetchApi('/services/rules'),
  updateCommercialRule: (id: string, data: any) =>
    fetchApi(`/services/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Catálogo Dinámico de Reglas de Negocio (REGLA_NEGOCIO en SQL Server)
  getBusinessRules: () => fetchApi('/business-rules'),
  createBusinessRule: (data: any) =>
    fetchApi('/business-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateBusinessRule: (codigo: string, data: any) =>
    fetchApi(`/business-rules/${codigo}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteBusinessRule: (codigo: string) =>
    fetchApi(`/business-rules/${codigo}`, {
      method: 'DELETE',
    }),

  // Clientes, Bitácora y Trazabilidad de Tesis
  getCustomers: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/customers${query ? `?${query}` : ''}`);
  },
  getCustomer: (id: string) => fetchApi(`/customers/${id}`),
  getCustomerTrazabilidad: (id: string) => fetchApi(`/customers/${id}/trazabilidad`),
  crearEntradaBitacora: (id: string, data: any) =>
    fetchApi(`/customers/${id}/bitacora`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  actualizarEstadoCustomer: (id: string, data: any) =>
    fetchApi(`/customers/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getAdvisors: () => fetchApi('/advisors'),

  // Pagos, Checkout y Comprobantes Oficiales (Legacy / Pasarela Real)
  getCotizacionCheckout: (cotizacionId: string) => fetchApi(`/payments/cotizacion/${cotizacionId}`),
  crearPreferenciaMercadoPago: (cotizacionId: string, monto?: number) =>
    fetchApi('/payments/mercadopago/preference', {
      method: 'POST',
      body: JSON.stringify({ cotizacionId, monto }),
    }),
  verificarPagoMercadoPago: (cotizacionId: string) =>
    fetchApi('/payments/mercadopago/verificar', {
      method: 'POST',
      body: JSON.stringify({ cotizacionId }),
    }),
  procesarCheckout: (data: any) =>
    fetchApi('/payments/checkout/procesar', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getComprobantes: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/payments${query ? `?${query}` : ''}`);
  },
  getComprobanteById: (pagoId: string) => fetchApi(`/payments/comprobante/${pagoId}`),
  confirmarPago: (pagoId: string, data: any = {}) =>
    fetchApi(`/payments/${pagoId}/confirmar`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sincronizarPagosCulqi: () =>
    fetchApi('/payments/sincronizar-culqi', {
      method: 'POST',
    }),

  // Fase 3: PAYERS — Agente de Cobranza Automatizada v2 & Reporte BI R-PAYERS (INBESTIGA_TESIS + INBESTIGA_MART)
  getPayersOverview: () => fetchApi('/payers/overview'),
  getPayerOrden: (id: number | string) => fetchApi(`/payers/ordenes/${id}`),
  enviarMensajePayerAgent: (ordenPagoId: number, mensaje: string) =>
    fetchApi('/payers/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ ordenPagoId, mensaje }),
    }),
  enviarMensajeWhatsapp: (ordenPagoId: number, mensaje: string) =>
    fetchApi('/whatsapp/agent-chat', {
      method: 'POST',
      body: JSON.stringify({ ordenPagoId, mensaje }),
    }),
  enviarMensajeTelegram: (ordenPagoId: number, mensaje: string) =>
    fetchApi('/telegram/agent-chat', {
      method: 'POST',
      body: JSON.stringify({ ordenPagoId, mensaje }),
    }),
  enviarAudioPayerAgent: (ordenPagoId: number, audioBlob: Blob, filename = 'nota-voz.webm') =>
    postAudio('/payers/agent/voice-chat', ordenPagoId, audioBlob, filename),
  enviarAudioWhatsapp: (ordenPagoId: number, audioBlob: Blob, filename = 'nota-voz.webm') =>
    postAudio('/whatsapp/agent-voice', ordenPagoId, audioBlob, filename),
  enviarAudioTelegram: (ordenPagoId: number, audioBlob: Blob, filename = 'nota-voz.webm') =>
    postAudio('/telegram/agent-voice', ordenPagoId, audioBlob, filename),
  simularWebhookPayers: (ordenPagoId: number, medioPago?: 'Yape' | 'Plin' | 'Tarjeta') =>
    fetchApi('/payers/webhook/simular', {
      method: 'POST',
      body: JSON.stringify({ ordenPagoId, medioPago }),
    }),
  verificarVoucherPayers: (voucherId: number, accion: 'APROBAR' | 'RECHAZAR', motivo?: string) =>
    fetchApi(`/payers/vouchers/${voucherId}/verificar`, {
      method: 'POST',
      body: JSON.stringify({ accion, motivo }),
    }),
  getPayersEvaluacion: () => fetchApi('/payers/evaluacion'),
  ejecutarPayersEvaluacion: () =>
    fetchApi('/payers/evaluacion/ejecutar', {
      method: 'POST',
    }),
  simularAlertaEtapaPayers: (ordenPagoId: number, etapa: '4h' | '12h' | '24h') =>
    fetchApi('/payers/alertas/simular-etapa', {
      method: 'POST',
      body: JSON.stringify({ ordenPagoId, etapa }),
    }),
  resetConCuotasPayers: (codigoOrden = 'ORD-2026-0001') =>
    fetchApi('/payers/reset-con-cuotas', {
      method: 'POST',
      body: JSON.stringify({ codigoOrden }),
    }),
  aprobarHitoCuota: (ordenPagoId: number, numeroCuota: number) =>
    fetchApi(`/payers/ordenes/${ordenPagoId}/cuotas/${numeroCuota}/aprobar-hito`, {
      method: 'POST',
    }),
  revertirHitoCuota: (ordenPagoId: number, numeroCuota: number) =>
    fetchApi(`/payers/ordenes/${ordenPagoId}/cuotas/${numeroCuota}/revertir-hito`, {
      method: 'POST',
    }),
  ejecutarRecordatoriosCuotas: () =>
    fetchApi('/payers/cuotas/recordatorios/ejecutar', {
      method: 'POST',
    }),

  // WhatsApp Status
  getWhatsAppStatus: () => fetchApi('/whatsapp/status'),

  // Media & Real-Time Events (PAYERS Live Chat)
  getMediaUrl: (path: string) => {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = API_BASE.replace(/\/$/, '');
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  },
  getPayersEventsUrl: () => `${API_BASE.replace(/\/$/, '')}/payers/events`,
};
