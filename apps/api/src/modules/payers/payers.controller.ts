import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  Sse,
  MessageEvent,
  Req,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import * as fs from 'fs';
import { PayersService } from './payers.service';
import { CuotasHitoService } from './cuotas-hito.service';
import { VOICE_UPLOAD_LIMITS, validarUploadVoz } from '../voice/voice-upload.helper';

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

  @Sse('events')
  @ApiOperation({ summary: 'Stream SSE en tiempo real con eventos de nuevos mensajes de WhatsApp, Telegram y Live Chat' })
  streamEvents(): Observable<MessageEvent> {
    return this.payersService.getChatEventsStream();
  }

  @Get('mensajes/:mensajeId/audio')
  @ApiOperation({ summary: 'Sirve el audio persistido asociado a un mensaje de nota de voz' })
  getMensajeAudio(
    @Param('mensajeId') mensajeId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const file = this.payersService.obtenerAudioMensaje(Number(mensajeId));
    const pipeStream = (stream: fs.ReadStream) => {
      res.on('close', () => {
        if (!stream.destroyed) stream.destroy();
      });
      stream.on('error', () => {
        if (!res.headersSent) res.status(404).end();
        else res.end();
      });
      stream.pipe(res);
    };

    const rawRange = Array.isArray(req.headers.range) ? req.headers.range[0] : req.headers.range;
    const rangeMatch = typeof rawRange === 'string' ? /^bytes=(\d*)-(\d*)$/.exec(rawRange.trim()) : null;

    if (rangeMatch) {
      const [, startRaw, endRaw] = rangeMatch;
      let start: number;
      let end: number;

      if (startRaw === '' && endRaw === '') {
        res.status(416).set('Content-Range', `bytes */${file.size}`).end();
        return;
      } else if (startRaw === '') {
        const suffixLength = Number(endRaw);
        if (!Number.isFinite(suffixLength) || suffixLength <= 0 || file.size <= 0) {
          res.status(416).set('Content-Range', `bytes */${file.size}`).end();
          return;
        }
        start = Math.max(0, file.size - suffixLength);
        end = file.size - 1;
      } else {
        start = Number(startRaw);
        end = endRaw === '' ? file.size - 1 : Math.min(Number(endRaw), file.size - 1);
      }

      if (
        file.size <= 0 ||
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 0 ||
        start >= file.size ||
        end < start
      ) {
        res.status(416).set('Content-Range', `bytes */${file.size}`).end();
        return;
      }

      res.status(206).set({
        'Content-Type': file.mimeType,
        'Content-Range': `bytes ${start}-${end}/${file.size}`,
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      });
      pipeStream(fs.createReadStream(file.filePath, { start, end }));
      return;
    }

    res.status(200).set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    });
    pipeStream(fs.createReadStream(file.filePath));
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

  @Post('agent/voice-chat')
  @UseInterceptors(FileInterceptor('audio', VOICE_UPLOAD_LIMITS))
  @ApiOperation({
    summary:
      'Procesa una nota de voz en el Agente IA de Cobranza PAYERS (STT -> Agente determinístico -> TTS)',
  })
  async procesarVoiceChat(
    @Body() body: { ordenPagoId?: string | number; canal?: string },
    @UploadedFile() file: { buffer: Buffer; originalname?: string; mimetype?: string } | undefined,
  ) {
    const { ordenPagoId, buffer, filename, mimeType } = validarUploadVoz(body?.ordenPagoId, file);
    const canal = body?.canal === 'WHATSAPP' || body?.canal === 'TELEGRAM' ? body.canal : 'WEB';
    return this.payersService.procesarAudioAgente(ordenPagoId, buffer, filename, mimeType, canal);
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
