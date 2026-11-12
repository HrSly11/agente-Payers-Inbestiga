import { Controller, Post, Get, Param, Body, Headers, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';

@ApiTags('Pagos / Pasarela Real')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los pagos y comprobantes electrónicos emitidos' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'metodoPago', required: false })
  async getPagos(
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('metodoPago') metodoPago?: string,
  ) {
    return this.paymentsService.findAllPagos({ search, estado, metodoPago });
  }

  @Get('comprobante/:id')
  @ApiOperation({ summary: 'Obtener datos oficiales de la Boleta de Venta Electrónica por Pago ID' })
  async getComprobante(@Param('id') id: string) {
    return this.paymentsService.getComprobante(id);
  }

  @Get('cotizacion/:id')
  @ApiOperation({ summary: 'Obtener datos de la cotización para la pantalla de Checkout' })
  async getCotizacion(@Param('id') id: string) {
    return this.paymentsService.getCotizacion(id);
  }

  @Get('webhook')
  @ApiOperation({ summary: 'Verificación de estado del Webhook' })
  async checkWebhook() {
    return {
      status: 'active',
      servicio: 'INBESTIGA.TESIS Payment Webhook',
      proveedor: 'CULQI',
      mensaje: 'Endpoint público activo y listo para recibir eventos POST desde Culqi.',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook oficial de la pasarela de pagos (Culqi / Stripe)' })
  async handleWebhook(@Body() payload: any, @Headers('stripe-signature') signature?: string) {
    return this.paymentsService.procesarWebhook(payload, signature);
  }

  @Post('mercadopago/preference')
  @ApiOperation({ summary: 'Genera una preferencia en Mercado Pago Checkout Pro (Sandbox o Producción)' })
  async crearPreferenciaMercadoPago(@Body() body: { cotizacionId: string; monto?: number }) {
    return this.paymentsService.crearPreferenciaMercadoPago(body.cotizacionId, body.monto);
  }

  @Post('mercadopago/verificar')
  @ApiOperation({ summary: 'Verifica en Mercado Pago los pagos aprobados de una orden y los confirma en el sistema' })
  async verificarPagoMercadoPago(@Body() body: { cotizacionId: string }) {
    return this.paymentsService.verificarPagoMercadoPago(body.cotizacionId);
  }

  @Post('checkout/procesar')
  @ApiOperation({ summary: 'Procesar pago desde la interfaz web de Checkout con Yape directo (Culqi) o Tarjeta' })
  async procesarCheckout(
    @Body()
    dto: {
      cotizacionId: string;
      metodoPago: 'CARD' | 'YAPE' | 'TRANSFER';
      referencia?: string;
      numeroTarjeta?: string;
      telefonoYape?: string;
      codigoAprobacion?: string;
    },
  ) {
    return this.paymentsService.procesarPagoCheckout(dto);
  }

  @Post('sincronizar-culqi')
  @ApiOperation({ summary: 'Detectar y sincronizar pagos pendientes realizados vía pasarela Culqi' })
  async sincronizarCulqi() {
    return this.paymentsService.sincronizarPagosCulqi();
  }

  @Post(':id/confirmar')
  @ApiOperation({ summary: 'Acreditar o confirmar manualmente un pago pendiente (genera Boleta Electrónica)' })
  async confirmarPago(
    @Param('id') id: string,
    @Body() body?: { metodoPago?: string; referencia?: string; monto?: number },
  ) {
    return this.paymentsService.confirmarPagoManual(id, body);
  }
}
