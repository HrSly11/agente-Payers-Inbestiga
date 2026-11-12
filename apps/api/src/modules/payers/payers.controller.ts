import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PayersService } from './payers.service';
import { CuotasHitoService } from './cuotas-hito.service';

@ApiTags('Fase 3: PAYERS — Agente de Cobranza v2 & Reporte BI R-PAYERS')
@Controller('payers')
export class PayersController {
  constructor(
    private readonly payersService: PayersService,
    private readonly cuotasHitoService: CuotasHitoService,
  ) {}

  @Post('ordenes/:id/cuotas/:numero/aprobar-hito')
  @ApiOperation({
    summary: 'El asesor aprueba el hito académico de una cuota: pasa de ESPERA_HITO a EXIGIBLE y se notifica al estudiante por Telegram',
  })
  async aprobarHito(@Param('id') id: string, @Param('numero') numero: string) {
    return this.cuotasHitoService.aprobarHito(Number(id), Number(numero));
  }

  @Post('ordenes/:id/cuotas/:numero/revertir-hito')
  @ApiOperation({
    summary: 'Revierte una cuota de EXIGIBLE a ESPERA_HITO (si aún no fue pagada)',
  })
  async revertirHito(@Param('id') id: string, @Param('numero') numero: string) {
    return this.cuotasHitoService.revertirHito(Number(id), Number(numero));
  }

  @Post('cuotas/recordatorios/ejecutar')
  @ApiOperation({ summary: 'Ejecuta ahora el ciclo de recordatorios de cuotas exigibles y escalamiento de hitos vencidos' })
  async ejecutarRecordatorios() {
    return this.cuotasHitoService.procesarRecordatorios();
  }

  @Get('overview')
  @ApiOperation({
    summary:
      'Obtiene el Reporte BI R-PAYERS (KPIs P01-P06, Vistas 3.1, 3.2, 3.3, 104 órdenes) desde INBESTIGA_MART + contadores operativos desde INBESTIGA_TESIS',
  })
  async getOverview() {
    return this.payersService.getOverview();
  }

  @Get('ordenes/:id')
  @ApiOperation({
    summary:
      'Obtiene el expediente operativo completo de una orden de pago (HANDOFF_LEADS, CONTRATO, CUOTA_PAGO, ENLACE_PAGO, PAGO, VOUCHER, ALERTA_COBRANZA, EJECUCION_HERRAMIENTA, MENSAJE)',
  })
  async getOrdenDetalle(@Param('id') id: string) {
    return this.payersService.getOrdenDetalle(Number(id));
  }

  @Post('agent/chat')
  @ApiOperation({
    summary:
      'Procesa un mensaje en el Agente IA de Cobranza PAYERS (Especificación v2) aplicando guardarraíles RN-01..RN-10 y las 11 herramientas determinísticas',
  })
  async procesarChat(
    @Body()
    body: {
      ordenPagoId: number;
      mensaje: string;
    },
  ) {
    return this.payersService.procesarChatAgente(Number(body.ordenPagoId), body.mensaje || '');
  }

  @Post('webhook/simular')
  @ApiOperation({
    summary:
      'Simula un evento firmado HMAC-SHA256 de pasarela Mercado Pago (payment.updated), acredita la cuota, actualiza ORDEN_PAGO y activa PAYER + CUSTOMER (RN-04)',
  })
  async simularWebhook(
    @Body()
    body: {
      ordenPagoId: number;
      medioPago?: 'Yape' | 'Plin' | 'Tarjeta';
    },
  ) {
    return this.payersService.simularWebhookPasarela(Number(body.ordenPagoId), body.medioPago);
  }

  @Post('vouchers/:voucherId/verificar')
  @ApiOperation({
    summary:
      'Permite a Caja / Administración aprobar o rechazar un VOUCHER manual (POR_VERIFICAR -> VERIFICADO | RECHAZADO)',
  })
  async verificarVoucher(
    @Param('voucherId') voucherId: string,
    @Body()
    body: {
      accion: 'APROBAR' | 'RECHAZAR';
      motivo?: string;
    },
  ) {
    return this.payersService.verificarVoucherManual(Number(voucherId), body.accion, body.motivo);
  }

  @Get('evaluacion')
  @ApiOperation({
    summary:
      'Retorna la matriz de evaluación del Agente PAYERS (EVALUACION_AGENTE) con verificación de 0% alucinación y precisión de herramientas',
  })
  async getEvaluacion() {
    return this.payersService.getEvaluacionAgente();
  }

  @Post('evaluacion/ejecutar')
  @ApiOperation({
    summary: 'Ejecuta en vivo la suite de evaluación determinística sobre el Agente PAYERS v2.0',
  })
  async ejecutarEvaluacion() {
    return this.payersService.ejecutarEvaluacionAgente();
  }

  @Post('reset-con-cuotas')
  @ApiOperation({
    summary:
      'Configura o resetea una orden con el acuerdo de cuotas proveniente de LEADS (3 cuotas: 30%/40%/30%) para pruebas integrales de cobranza',
  })
  async resetConCuotas(@Body() body: { codigoOrden?: string }) {
    return this.payersService.resetConCuotasLeads(body.codigoOrden || 'ORD-2026-0001');
  }

  @Post('alertas/simular-etapa')
  @ApiOperation({
    summary:
      'Disparador manual a demanda para la presentación: simula en vivo la alerta de 4h, 12h o 24h con mensaje a Telegram y registro en BD',
  })
  async simularAlertaEtapa(
    @Body() body: { ordenPagoId?: number; etapa: '4h' | '12h' | '24h' },
  ) {
    return this.payersService.simularAlertaEtapa(
      Number(body.ordenPagoId || 1),
      body.etapa || '4h',
    );
  }
}
