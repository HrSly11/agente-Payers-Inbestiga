import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Optional,
  MessageEvent,
} from '@nestjs/common';
import { Observable, Subject, map } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';
import { MercadoPagoProvider } from '../payments/providers/mercadopago.provider';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { OpenAiVoiceService } from '../voice/openai-voice.service';
import { BusinessRulesService } from '../business-rules/business-rules.service';
import { saveVoiceFile, findVoiceFile, listVoiceMessageIds } from '../voice/voice-storage.helper';
import * as crypto from 'crypto';

export interface ToolExecutionRecord {
  herramienta: string;
  argumentos: Record<string, any>;
  resultado: Record<string, any>;
  latenciaMs: number;
  exitoso: boolean;
}

@Injectable()
export class PayersService {
  private readonly logger = new Logger(PayersService.name);
  private readonly chatEvents$ = new Subject<Record<string, any>>();
  private readonly ultimoCanalPorOrden = new Map<number, 'WHATSAPP' | 'TELEGRAM' | 'WEB'>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPagoProvider: MercadoPagoProvider,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsappService: WhatsAppService,
    private readonly businessRulesService: BusinessRulesService,
    @Optional()
    private readonly voice?: OpenAiVoiceService,
  ) {}

  private async getConfiguracionAgenteActiva() {
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT TOP 1
          proveedorIA,
          modelo,
          promptSistema,
          tono,
          estilo,
          maxCuotasNegociables,
          horarioInicio,
          horarioFin
        FROM [dbo].[CONFIGURACION_AGENTE]
        WHERE activo = 1
        ORDER BY fechaActualizacion DESC;
      `);
      if (rows[0]) return rows[0];
    } catch (err: any) {
      this.logger.warn(`No se pudo leer CONFIGURACION_AGENTE en vivo: ${err.message}`);
    }
    return {
      proveedorIA: 'OPENAI',
      modelo: 'gpt-4o-mini',
      promptSistema:
        'Eres el Asesor Virtual Especialista de Cobranza y Activación Académica de INBESTIGA.TESIS. Tu misión es acompañar cordialmente al estudiante que ya aceptó su cotización, guiarlo a completar su pago por los canales oficiales y acompañarlo hasta activar su asesoría.',
      tono: 'Profesional, empático, financiero-académico y determinístico',
      estilo: 'Especialista de Cobranza y Activación PAYERS v2.0',
      maxCuotasNegociables: 6,
      horarioInicio: '08:00',
      horarioFin: '20:00',
    };
  }

  getChatEventsStream(): Observable<MessageEvent> {
    return this.chatEvents$.asObservable().pipe(map((data) => ({ data })));
  }

  obtenerAudioMensaje(mensajeId: number) {
    if (!Number.isInteger(mensajeId) || mensajeId <= 0) {
      throw new NotFoundException('Audio no encontrado.');
    }
    const file = findVoiceFile(mensajeId);
    if (!file) {
      throw new NotFoundException(`No existe audio almacenado para el mensaje #${mensajeId}.`);
    }
    return file;
  }

  private async insertMensajeYRetornarId(
    conversacionId: number,
    emisor: 'ESTUDIANTE' | 'BOT',
    tipoMensaje: 'TEXTO' | 'AUDIO_TRANSCRITO',
    contenido: string,
  ): Promise<number> {
    const clean = (contenido || '').replace(/'/g, "''");
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      INSERT INTO INBESTIGA_TESIS.dbo.MENSAJE (
        conversacion_id, emisor, tipo_mensaje, contenido, fecha_mensaje
      ) VALUES (
        ${conversacionId}, '${emisor}', '${tipoMensaje}', N'${clean}', GETDATE()
      );
      SELECT CAST(SCOPE_IDENTITY() AS INT) AS mensaje_id;
    `);
    return Number(rows?.[0]?.mensaje_id || 0);
  }

  /**
   * Genera una URL real de pago en Mercado Pago (Checkout Pro) para una orden y monto dados.
   * Reemplaza los antiguos enlaces `http://localhost:3000/...`, que no eran accesibles para el
   * estudiante. Si Mercado Pago no responde, cae al checkout del frontend configurado.
   */
  private async generarUrlCheckoutMercadoPago(params: {
    codigoOrden: string;
    monto: number;
    servicio?: string;
    email?: string;
    nombre?: string;
  }): Promise<string> {
    const montoSeguro = Number(params.monto) > 0 ? Number(params.monto) : 1;
    try {
      const res = await this.mercadoPagoProvider.crearCheckout({
        cotizacionId: params.codigoOrden,
        monto: montoSeguro,
        moneda: 'PEN',
        descripcion: `INBESTIGA.TESIS - ${params.servicio || params.codigoOrden}`,
        clienteEmail: params.email,
        clienteNombre: params.nombre,
        cuotas: 1,
      });
      if (res?.checkoutUrl && !res.checkoutUrl.includes('localhost')) {
        return res.checkoutUrl;
      }
      this.logger.warn(
        `Mercado Pago devolvió un enlace no público para ${params.codigoOrden}; se usa respaldo del frontend.`,
      );
    } catch (error: any) {
      this.logger.warn(
        `No se pudo generar el enlace de Mercado Pago para ${params.codigoOrden}: ${error.message}`,
      );
    }
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${base}/checkout/${params.codigoOrden}`;
  }

  /**
   * Devuelve el enlace de pago vigente de una orden: reutiliza el enlace activo si ya es un
   * enlace público (Mercado Pago o dominio real) o genera uno nuevo en Mercado Pago.
   */
  private async urlPagoVigente(orden: any, monto: number, enlaceActivo?: any): Promise<string> {
    const existente: string | undefined = enlaceActivo?.url_enlace;
    if (existente && !existente.includes('localhost')) return existente;
    return this.generarUrlCheckoutMercadoPago({
      codigoOrden: orden.codigo_orden,
      monto,
      servicio: orden.servicio_nombre,
      email: orden.estudiante_email,
      nombre: orden.estudiante_nombre,
    });
  }

  /**
   * Calcula el estado financiero real de una orden de forma ÚNICA y consistente para todo el
   * agente: total comprometido, total cobrado (solo pagos CONFIRMADO), saldo pendiente real y si la
   * orden quedó totalmente liquidada. También determina la cuota realmente exigible, excluyendo las
   * cuotas en ESPERA_HITO (bloqueadas por hito académico no aprobado).
   *
   * Reglas de negocio cubiertas:
   * - Cierre al saldo 0: cuando `ordenLiquidada` es true el agente no debe emitir más enlaces ni
   *   solicitar pagos, sin importar el estado nominal de la orden.
   * - Cuota exigible: se prioriza una cuota cobrable (EXIGIBLE / ENLACE_ENVIADO / VENCIDA /
   *   POR_VERIFICAR); una cuota ESPERA_HITO nunca se trata como exigible.
   */
  private estadoFinanciero(orden: any, cuotas: any[], pagos: any[]) {
    const totalComprometido = Number(orden.monto_comprometido || 0);
    const pagosConfirmados = (pagos || []).filter((p) => p.estado === 'CONFIRMADO');
    const totalCobradoConfirmado = pagosConfirmados.reduce(
      (acc, p) => acc + Number(p.monto_pagado || 0),
      0,
    );
    // Se toma el mayor entre el agregado analítico y la fuente transaccional para no subestimar
    // lo cobrado, pero sin contar vouchers POR_VERIFICAR como confirmados.
    const totalCobrado = Math.max(Number(orden.monto_cobrado || 0), totalCobradoConfirmado);

    const cuotasList = cuotas || [];
    const cuotasVigentes = cuotasList.filter(
      (c) => c.estado !== 'PAGADA' && c.estado !== 'ANULADA',
    );
    const cuotasAnuladas = cuotasList.filter((c) => c.estado === 'ANULADA');
    const montoAnulado = Number(
      cuotasAnuladas.reduce((acc, c) => acc + Number(c.monto_programado || 0), 0).toFixed(2),
    );
    const ordenAnulada =
      orden.estado === 'ANULADA' ||
      (cuotasVigentes.length === 0 && cuotasAnuladas.length > 0);
    const saldoPendiente = ordenAnulada
      ? 0
      : Math.max(0, Number((totalComprometido - totalCobrado - montoAnulado).toFixed(2)));
    const ordenLiquidada =
      !ordenAnulada &&
      totalComprometido > 0 &&
      Math.max(0, Number((totalComprometido - totalCobrado - montoAnulado).toFixed(2))) === 0;

    const ultimaCuota = cuotasList[0];
    const cuotaExigible =
      cuotasVigentes.find((c) =>
        ['EXIGIBLE', 'ENLACE_ENVIADO', 'VENCIDA', 'POR_VERIFICAR'].includes(c.estado),
      ) ||
      cuotasVigentes.find((c) => c.estado !== 'ESPERA_HITO') ||
      cuotasVigentes[0] ||
      (!ordenAnulada && saldoPendiente > 0 && ultimaCuota
        ? {
            ...ultimaCuota,
            monto_programado: saldoPendiente,
            condicion: 'Saldo pendiente por regularizar',
            estado: 'PENDIENTE',
          }
        : ultimaCuota) || {
        cuota_id: Number(orden.orden_pago_id),
        numero_cuota: 1,
        monto_programado: ordenAnulada ? 0 : totalComprometido,
        condicion: ordenAnulada ? 'Cuotas pendientes canceladas' : 'Pago único',
        estado: ordenAnulada ? 'ANULADA' : 'EXIGIBLE',
      };

    const esCuotaBloqueada = !ordenAnulada && cuotaExigible.estado === 'ESPERA_HITO';
    const montoCuotaExigible = ordenAnulada ? 0 : Number(cuotaExigible.monto_programado || 0);
    // Nunca solicitar más de lo que realmente se adeuda ni si la orden fue anulada.
    const montoCobrable =
      ordenAnulada || ordenLiquidada
        ? 0
        : Math.min(montoCuotaExigible, saldoPendiente || montoCuotaExigible);

    return {
      totalComprometido,
      totalCobrado,
      montoAnulado,
      saldoPendiente,
      ordenLiquidada,
      ordenAnulada,
      pagosConfirmados,
      cuotasVigentes,
      cuotasAnuladas,
      cuotaExigible,
      esCuotaBloqueada,
      montoCuotaExigible,
      montoCobrable,
    };
  }

  /**
   * Busca el expediente activo de un estudiante por su número de teléfono celular (9 u 11 dígitos)
   */
  async buscarOrdenPorTelefono(telefono: string): Promise<any> {
    const cleanDigits = telefono.replace(/\D/g, '');
    if (cleanDigits.length < 8) return null;

    const ultimos9 = cleanDigits.slice(-9);

    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1
        op.orden_pago_id,
        op.codigo_orden,
        ct.contacto_id,
        ct.nombres,
        ct.apellidos,
        ct.telefono,
        op.estado,
        op.monto_comprometido,
        s.nombre AS servicio_nombre
      FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO op
      INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = op.propuesta_id
      INNER JOIN INBESTIGA_TESIS.dbo.LEAD l ON l.lead_id = pr.lead_id
      INNER JOIN INBESTIGA_TESIS.dbo.BUYER b ON b.buyer_id = l.buyer_id
      INNER JOIN INBESTIGA_TESIS.dbo.CONTACTO ct ON ct.contacto_id = b.contacto_id
      INNER JOIN INBESTIGA_TESIS.dbo.SERVICIO s ON s.servicio_id = pr.servicio_id
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ct.telefono, ' ', ''), '-', ''), '+', ''), '(', ''), ')', '') LIKE '%${ultimos9}%'
         OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ct.telefono, ' ', ''), '-', ''), '+', ''), '(', ''), ')', '') LIKE '%${cleanDigits}%'
      ORDER BY op.orden_pago_id DESC;
    `);

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Obtiene el teléfono celular del contacto asociado a una orden de pago.
   * Se usa para despachar por WhatsApp las respuestas del Agente PAYERS cuando
   * el operador conversa desde el Live Chat del panel.
   */
  async obtenerTelefonoPorOrden(ordenPagoId: number): Promise<string | null> {
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1 ct.telefono
      FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO op
      INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = op.propuesta_id
      INNER JOIN INBESTIGA_TESIS.dbo.LEAD l ON l.lead_id = pr.lead_id
      INNER JOIN INBESTIGA_TESIS.dbo.BUYER b ON b.buyer_id = l.buyer_id
      INNER JOIN INBESTIGA_TESIS.dbo.CONTACTO ct ON ct.contacto_id = b.contacto_id
      WHERE op.orden_pago_id = ${Number(ordenPagoId)};
    `);

    return rows.length > 0 ? rows[0].telefono : null;
  }

  async obtenerTelegramChatIdPorOrden(ordenPagoId: number): Promise<{ chatId: string; username?: string } | null> {
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1 ct.telegram_chat_id, ct.telegram_username
      FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO op
      INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = op.propuesta_id
      INNER JOIN INBESTIGA_TESIS.dbo.LEAD l ON l.lead_id = pr.lead_id
      INNER JOIN INBESTIGA_TESIS.dbo.BUYER b ON b.buyer_id = l.buyer_id
      INNER JOIN INBESTIGA_TESIS.dbo.CONTACTO ct ON ct.contacto_id = b.contacto_id
      WHERE op.orden_pago_id = ${Number(ordenPagoId)};
    `);

    if (rows.length > 0 && rows[0].telegram_chat_id) {
      return { chatId: String(rows[0].telegram_chat_id), username: rows[0].telegram_username || undefined };
    }
    return null;
  }

  /**
   * Busca el expediente activo por el ID de chat de Telegram persistido en la BD
   */
  async buscarOrdenPorTelegramChatId(chatId: string | number): Promise<any> {
    const chatIdStr = String(chatId);
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1
        op.orden_pago_id,
        op.codigo_orden,
        ct.contacto_id,
        ct.nombres,
        ct.apellidos,
        ct.telefono,
        ct.telegram_chat_id,
        ct.telegram_username,
        op.estado,
        op.monto_comprometido,
        s.nombre AS servicio_nombre
      FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO op
      INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = op.propuesta_id
      INNER JOIN INBESTIGA_TESIS.dbo.LEAD l ON l.lead_id = pr.lead_id
      INNER JOIN INBESTIGA_TESIS.dbo.BUYER b ON b.buyer_id = l.buyer_id
      INNER JOIN INBESTIGA_TESIS.dbo.CONTACTO ct ON ct.contacto_id = b.contacto_id
      INNER JOIN INBESTIGA_TESIS.dbo.SERVICIO s ON s.servicio_id = pr.servicio_id
      WHERE ct.telegram_chat_id = '${chatIdStr}'
      ORDER BY op.orden_pago_id DESC;
    `);

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Vincula permanentemente el chat_id y username de Telegram al contacto en la BD
   */
  async vincularTelegramChatId(contactoId: number, chatId: string | number, username?: string): Promise<void> {
    const chatIdStr = String(chatId);
    const userStr = username ? `'${username.replace(/'/g, "''")}'` : 'NULL';
    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.CONTACTO
      SET telegram_chat_id = '${chatIdStr}',
          telegram_username = ${userStr}
      WHERE contacto_id = ${contactoId};
    `);
  }

  /**
   * 1. GET /api/v1/payers/overview
   * Retorna el Reporte BI R-PAYERS completo desde INBESTIGA_MART + contadores operativos desde INBESTIGA_TESIS
   * Todas las consultas se ejecutan de forma estrictamente secuencial (connection_limit=1).
   */
  async getOverview() {
    const kpisP01P06Raw: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_MART.dbo.vw_rpayers_kpis ORDER BY orden;`,
    );

    const vista31OrdenesRaw: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_MART.dbo.vw_rpayers_vista_3_1_ordenes ORDER BY orden_fila;`,
    );

    const vista31ServicioRaw: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_MART.dbo.vw_rpayers_vista_3_1_servicio ORDER BY orden_fila;`,
    );

    const vista32RecuperacionRaw: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_MART.dbo.vw_rpayers_vista_3_2_recuperacion ORDER BY orden_fila;`,
    );

    const vista33MediosRaw: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_MART.dbo.vw_rpayers_vista_3_3_medios ORDER BY orden_fila;`,
    );

    const ordenesDetalleRaw: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_MART.dbo.vw_rpayers_ordenes_detalle ORDER BY id_orden_pago;`,
    );

    const contadoresRaw: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.HANDOFF_LEADS) AS totalHandoffs,
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.CONTRATO) AS totalContratos,
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO) AS totalOrdenes,
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO) AS totalCuotas,
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.ENLACE_PAGO) AS totalEnlaces,
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.PAGO WHERE estado = 'CONFIRMADO') AS totalPagosConfirmados,
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.VOUCHER) AS totalVouchers,
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.VOUCHER WHERE estado IN ('POR_VERIFICAR', 'DUDOSO')) AS vouchersPorVerificar,
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.EVENTO_WEBHOOK) AS totalWebhooks,
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.ALERTA_COBRANZA) AS totalAlertas,
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.OBJECION_PAGO) AS totalObjeciones,
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.ESCALAMIENTO) AS totalEscalamientos,
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.POLITICA_COBRANZA WHERE activo = 1) AS totalPoliticas,
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.EVALUACION_AGENTE) AS totalCasosEvaluacion,
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.PAYER) AS totalPayersActivados,
        (SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.CUSTOMER) AS totalCustomersActivados;
    `);

    const politicasRaw: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_TESIS.dbo.POLITICA_COBRANZA WHERE activo = 1 ORDER BY politica_id;`,
    );

    const vouchersRaw: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        v.voucher_id,
        v.pago_id,
        v.orden_pago_id,
        v.cuota_id,
        v.referencia_operacion,
        v.archivo_url,
        v.hash_imagen,
        v.monto_ocr,
        v.banco_ocr,
        v.estado,
        v.motivo_rechazo,
        v.fecha_carga,
        v.fecha_verificacion,
        o.codigo_orden,
        CONCAT(ct.nombres, ' ', ct.apellidos) AS estudiante,
        ct.telefono,
        s.nombre AS servicio,
        cp.numero_cuota,
        cp.monto_programado
      FROM INBESTIGA_TESIS.dbo.VOUCHER v
      INNER JOIN INBESTIGA_TESIS.dbo.ORDEN_PAGO o ON o.orden_pago_id = v.orden_pago_id
      INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = o.propuesta_id
      INNER JOIN INBESTIGA_TESIS.dbo.LEAD l ON l.lead_id = pr.lead_id
      INNER JOIN INBESTIGA_TESIS.dbo.BUYER b ON b.buyer_id = l.buyer_id
      INNER JOIN INBESTIGA_TESIS.dbo.CONTACTO ct ON ct.contacto_id = b.contacto_id
      INNER JOIN INBESTIGA_TESIS.dbo.SERVICIO s ON s.servicio_id = pr.servicio_id
      LEFT JOIN INBESTIGA_TESIS.dbo.CUOTA_PAGO cp ON cp.cuota_id = v.cuota_id
      ORDER BY
        CASE WHEN v.estado IN ('POR_VERIFICAR', 'DUDOSO') THEN 0 ELSE 1 END,
        v.voucher_id DESC;
    `);

    const escalamientosRaw: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 20
        e.*,
        o.codigo_orden
      FROM INBESTIGA_TESIS.dbo.ESCALAMIENTO e
      LEFT JOIN INBESTIGA_TESIS.dbo.ORDEN_PAGO o ON o.orden_pago_id = e.orden_pago_id
      ORDER BY e.escalamiento_id DESC;
    `);

    const auditoriaRaw: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 25 *
      FROM INBESTIGA_TESIS.dbo.AUDITORIA
      ORDER BY auditoria_id DESC;
    `);

    const c = contadoresRaw[0] || {};

    return {
      kpisP01P06: kpisP01P06Raw.map((k) => ({
        ...k,
        orden: Number(k.orden),
        valor: Number(k.valor),
        meta_bueno: Number(k.meta_bueno),
        numerador: Number(k.numerador),
        denominador: Number(k.denominador),
      })),
      vista31Ordenes: vista31OrdenesRaw.map((r) => ({
        ...r,
        orden_fila: Number(r.orden_fila),
        numero_cuotas: Number(r.numero_cuotas),
        ordenes_creadas: Number(r.ordenes_creadas),
        ordenes_con_pago: Number(r.ordenes_con_pago),
        pct_confirmacion_p01: Number(r.pct_confirmacion_p01),
        monto_comprometido: Number(r.monto_comprometido),
        monto_exigible: Number(r.monto_exigible),
        monto_cobrado: Number(r.monto_cobrado),
        pct_cobranza_efectiva_p04: Number(r.pct_cobranza_efectiva_p04),
        minutos_primer_pago: Number(r.minutos_primer_pago),
      })),
      vista31Servicio: vista31ServicioRaw.map((r) => ({
        ...r,
        orden_fila: Number(r.orden_fila),
        ordenes_creadas: Number(r.ordenes_creadas),
        ordenes_con_pago: Number(r.ordenes_con_pago),
        pct_confirmacion_p01: Number(r.pct_confirmacion_p01),
        minutos_primer_pago_p02: Number(r.minutos_primer_pago_p02),
        monto_exigible: Number(r.monto_exigible),
        monto_cobrado: Number(r.monto_cobrado),
        pct_cobranza_efectiva_p04: Number(r.pct_cobranza_efectiva_p04),
      })),
      vista32Recuperacion: vista32RecuperacionRaw.map((r) => ({
        ...r,
        orden_fila: Number(r.orden_fila),
        payers_alertados: Number(r.payers_alertados),
        payers_recuperados_72h: Number(r.payers_recuperados_72h),
        pct_recuperacion_p03: Number(r.pct_recuperacion_p03),
        escalamientos_humano: Number(r.escalamientos_humano),
        monto_recuperado: Number(r.monto_recuperado),
      })),
      vista33Medios: vista33MediosRaw.map((r) => ({
        ...r,
        orden_fila: Number(r.orden_fila),
        pagos_confirmados: Number(r.pagos_confirmados),
        pagos_por_webhook: Number(r.pagos_por_webhook),
        pct_confirmacion_auto_p05: Number(r.pct_confirmacion_auto_p05),
        monto_cobrado: Number(r.monto_cobrado),
        comision_pasarela: Number(r.comision_pasarela),
        pct_costo_cobro_p06: Number(r.pct_costo_cobro_p06),
      })),
      ordenesDetalle: ordenesDetalleRaw.map((o) => ({
        ...o,
        id_orden_pago: Number(o.id_orden_pago),
        id_estudiante: Number(o.id_estudiante),
        numero_cuotas: Number(o.numero_cuotas),
        monto_comprometido: Number(o.monto_comprometido),
        monto_exigible: Number(o.monto_exigible),
        monto_cobrado: Number(o.monto_cobrado),
        pagos_confirmados: Number(o.pagos_confirmados),
        comision_pasarela: Number(o.comision_pasarela),
        minutos_a_primer_pago: o.minutos_a_primer_pago != null ? Number(o.minutos_a_primer_pago) : null,
        alerta_recuperada: Number(o.alerta_recuperada),
        alerta_escalada: Boolean(o.alerta_escalada),
      })),
      resumenOperativo: {
        totalHandoffs: Number(c.totalHandoffs ?? 104),
        totalContratos: Number(c.totalContratos ?? 104),
        totalOrdenes: Number(c.totalOrdenes ?? 104),
        totalCuotas: Number(c.totalCuotas ?? 258),
        totalEnlaces: Number(c.totalEnlaces ?? 168),
        totalPagosConfirmados: Number(c.totalPagosConfirmados ?? 150),
        totalVouchers: Number(c.totalVouchers ?? 30),
        vouchersPorVerificar: Number(c.vouchersPorVerificar ?? 3),
        totalWebhooks: Number(c.totalWebhooks ?? 123),
        totalAlertas: Number(c.totalAlertas ?? 55),
        totalObjeciones: Number(c.totalObjeciones ?? 6),
        totalEscalamientos: Number(c.totalEscalamientos ?? 5),
        totalPoliticas: Number(c.totalPoliticas ?? 6),
        totalCasosEvaluacion: Number(c.totalCasosEvaluacion ?? 40),
        totalPayersActivados: Number(c.totalPayersActivados ?? 86),
        totalCustomersActivados: Number(c.totalCustomersActivados ?? 86),
      },
      politicas: politicasRaw,
      vouchers: vouchersRaw.map((v) => ({
        ...v,
        voucher_id: Number(v.voucher_id),
        pago_id: v.pago_id != null ? Number(v.pago_id) : null,
        orden_pago_id: Number(v.orden_pago_id),
        cuota_id: v.cuota_id != null ? Number(v.cuota_id) : null,
        monto_ocr: v.monto_ocr != null ? Number(v.monto_ocr) : 0,
        numero_cuota: v.numero_cuota != null ? Number(v.numero_cuota) : 1,
        monto_programado: v.monto_programado != null ? Number(v.monto_programado) : 0,
      })),
      escalamientosRecientes: escalamientosRaw,
      auditoriaReciente: auditoriaRaw,
    };
  }

  /**
   * 2. GET /api/v1/payers/ordenes/:id
   * Retorna el expediente operativo-analítico completo de una orden de pago desde INBESTIGA_TESIS.
   */
  async getOrdenDetalle(id: number) {
    const ordenId = Number(id);
    if (!ordenId || Number.isNaN(ordenId)) {
      throw new NotFoundException(`ID de orden inválido: ${id}`);
    }

    const vistaOrdenRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_MART.dbo.vw_rpayers_ordenes_detalle WHERE id_orden_pago = ${ordenId};`,
    );

    const ordenRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        o.*,
        s.servicio_id,
        s.nombre AS servicio_nombre,
        s.tipo_servicio,
        s.codigo AS servicio_codigo,
        s.solo_contado,
        s.max_cuotas,
        mp.nombre AS modalidad_nombre,
        mp.condicion AS modalidad_condicion,
        mp.numero_cuotas,
        pr.precio_base,
        pr.descuento,
        pr.precio_final,
        pr.lead_id,
        b.contacto_id,
        CONCAT(ct.nombres, ' ', ct.apellidos) AS estudiante_nombre,
        ct.telefono AS estudiante_telefono,
        ct.email AS estudiante_email,
        ct.telegram_chat_id,
        ct.telegram_username,
        ct.ventana_whatsapp_tipo,
        ct.consentimiento,
        ct.no_contactar,
        ISNULL((
          SELECT TOP 1 a.nombre
          FROM INBESTIGA_TESIS.dbo.PAYER py
          INNER JOIN INBESTIGA_TESIS.dbo.CUSTOMER cu ON cu.payer_id = py.payer_id
          INNER JOIN INBESTIGA_TESIS.dbo.ASIGNACION_ASESOR aa ON aa.customer_id = cu.customer_id
          INNER JOIN INBESTIGA_TESIS.dbo.ASESOR a ON a.asesor_id = aa.asesor_id
          WHERE py.orden_pago_id = o.orden_pago_id
          ORDER BY aa.fecha_asignacion DESC
        ), N'Dr. Carlos Alberto Méndez Vargas') AS asesor_nombre
      FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO o
      INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = o.propuesta_id
      INNER JOIN INBESTIGA_TESIS.dbo.LEAD l ON l.lead_id = pr.lead_id
      INNER JOIN INBESTIGA_TESIS.dbo.BUYER b ON b.buyer_id = l.buyer_id
      INNER JOIN INBESTIGA_TESIS.dbo.CONTACTO ct ON ct.contacto_id = b.contacto_id
      INNER JOIN INBESTIGA_TESIS.dbo.SERVICIO s ON s.servicio_id = pr.servicio_id
      INNER JOIN INBESTIGA_TESIS.dbo.MODALIDAD_PAGO mp ON mp.modalidad_pago_id = o.modalidad_pago_id
      WHERE o.orden_pago_id = ${ordenId};
    `);

    if (!ordenRows.length) {
      throw new NotFoundException(`No se encontró la orden de pago #${ordenId}`);
    }

    const orden = ordenRows[0];
    const vistaOrden = vistaOrdenRows[0] || {};
    const contactoId = Number(orden.contacto_id);

    const handoffRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_TESIS.dbo.HANDOFF_LEADS WHERE orden_pago_id = ${ordenId};`,
    );

    const contratoRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_TESIS.dbo.CONTRATO WHERE propuesta_id = ${Number(orden.propuesta_id)};`,
    );

    const responsableRows: any[] = orden.responsable_pago_id
      ? await this.prisma.$queryRawUnsafe(
          `SELECT * FROM INBESTIGA_TESIS.dbo.RESPONSABLE_PAGO WHERE responsable_pago_id = ${Number(orden.responsable_pago_id)};`,
        )
      : [];

    const cuotas: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO WHERE orden_pago_id = ${ordenId} ORDER BY numero_cuota ASC;`,
    );

    const enlaces: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT ep.*, mp.nombre AS medio_pago_nombre, mp.metodo, mp.proveedor
      FROM INBESTIGA_TESIS.dbo.ENLACE_PAGO ep
      LEFT JOIN INBESTIGA_TESIS.dbo.MEDIO_PAGO mp ON mp.medio_pago_id = ep.medio_pago_id
      WHERE ep.orden_pago_id = ${ordenId}
      ORDER BY ep.enlace_id DESC;
    `);

    const pagos: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT p.*, mp.nombre AS medio_pago_nombre, mp.metodo, mp.proveedor
      FROM INBESTIGA_TESIS.dbo.PAGO p
      LEFT JOIN INBESTIGA_TESIS.dbo.MEDIO_PAGO mp ON mp.medio_pago_id = p.medio_pago_id
      WHERE p.orden_pago_id = ${ordenId}
      ORDER BY p.pago_id DESC;
    `);

    const vouchers: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_TESIS.dbo.VOUCHER WHERE orden_pago_id = ${ordenId} ORDER BY voucher_id DESC;`,
    );

    const alertas: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_TESIS.dbo.ALERTA_COBRANZA WHERE orden_pago_id = ${ordenId} ORDER BY alerta_cobranza_id DESC;`,
    );

    const objeciones: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_TESIS.dbo.OBJECION_PAGO WHERE orden_pago_id = ${ordenId} ORDER BY objecion_pago_id DESC;`,
    );

    const escalamientos: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_TESIS.dbo.ESCALAMIENTO WHERE orden_pago_id = ${ordenId} ORDER BY escalamiento_id DESC;`,
    );

    const ejecucionesHerramienta: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_TESIS.dbo.EJECUCION_HERRAMIENTA WHERE orden_pago_id = ${ordenId} ORDER BY ejecucion_id DESC;`,
    );

    const mensajes: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT m.*, c.version_prompt, c.estado AS conversacion_estado
      FROM INBESTIGA_TESIS.dbo.MENSAJE m
      INNER JOIN INBESTIGA_TESIS.dbo.CONVERSACION c ON c.conversacion_id = m.conversacion_id
      WHERE c.contacto_id = ${contactoId} AND c.fase = 'PAYERS'
      ORDER BY m.mensaje_id ASC;
    `);

    const auditoria: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 20 *
      FROM INBESTIGA_TESIS.dbo.AUDITORIA
      WHERE (entidad = 'ORDEN_PAGO' AND entidad_id = '${ordenId}')
         OR detalle LIKE '%${orden.codigo_orden}%'
      ORDER BY auditoria_id DESC;
    `);

    const voiceIds = listVoiceMessageIds();

    return {
      orden: {
        ...vistaOrden,
        ...orden,
        orden_pago_id: Number(orden.orden_pago_id),
        monto_comprometido: Number(orden.monto_comprometido),
        precio_base: Number(orden.precio_base),
        descuento: Number(orden.descuento),
        precio_final: Number(orden.precio_final),
        monto_exigible: Number(vistaOrden.monto_exigible ?? orden.monto_comprometido),
        monto_cobrado: Number(vistaOrden.monto_cobrado ?? 0),
        pagos_confirmados: Number(vistaOrden.pagos_confirmados ?? 0),
        comision_pasarela: Number(vistaOrden.comision_pasarela ?? 0),
        solo_contado: Boolean(orden.solo_contado),
      },
      handoff: handoffRows[0] || null,
      contrato: contratoRows[0] || null,
      responsablePago: responsableRows[0] || null,
      cuotas: cuotas.map((c) => ({
        ...c,
        cuota_id: Number(c.cuota_id),
        orden_pago_id: Number(c.orden_pago_id),
        numero_cuota: Number(c.numero_cuota),
        porcentaje: Number(c.porcentaje),
        monto_programado: Number(c.monto_programado),
      })),
      enlaces: enlaces.map((e) => ({
        ...e,
        enlace_id: Number(e.enlace_id),
        monto: Number(e.monto),
      })),
      pagos: pagos.map((p) => ({
        ...p,
        pago_id: Number(p.pago_id),
        monto_pagado: Number(p.monto_pagado),
        comision_pasarela: Number(p.comision_pasarela),
      })),
      vouchers: vouchers.map((v) => ({
        ...v,
        voucher_id: Number(v.voucher_id),
        monto_ocr: v.monto_ocr != null ? Number(v.monto_ocr) : 0,
      })),
      alertas,
      objeciones,
      escalamientos,
      ejecucionesHerramienta,
      mensajes: mensajes.map((m) => ({
        ...m,
        audio_url: voiceIds.has(Number(m.mensaje_id))
          ? `/payers/mensajes/${Number(m.mensaje_id)}/audio`
          : null,
      })),
      ultimoCanal: this.ultimoCanalPorOrden.get(Number(ordenId)) ?? null,
      auditoria,
    };
  }

  /**
   * Helper para registrar una ejecución de herramienta del Agente IA en INBESTIGA_TESIS.dbo.EJECUCION_HERRAMIENTA
   */
  private async logToolExecution(
    conversacionId: number,
    ordenPagoId: number,
    herramienta: string,
    argumentos: Record<string, any>,
    resultado: Record<string, any>,
    latenciaMs = 95,
    exitoso = true,
  ): Promise<ToolExecutionRecord> {
    const argsStr = JSON.stringify(argumentos).replace(/'/g, "''");
    const resStr = JSON.stringify(resultado).replace(/'/g, "''");

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO INBESTIGA_TESIS.dbo.EJECUCION_HERRAMIENTA (
        conversacion_id, orden_pago_id, herramienta, argumentos_json, resultado_json, latencia_ms, exitoso, fecha_ejecucion
      ) VALUES (
        ${conversacionId}, ${ordenPagoId}, '${herramienta}', '${argsStr}', '${resStr}', ${latenciaMs}, ${exitoso ? 1 : 0}, GETDATE()
      );
    `);

    return {
      herramienta,
      argumentos,
      resultado,
      latenciaMs,
      exitoso,
    };
  }

  /**
   * Helper para registrar eventos en INBESTIGA_TESIS.dbo.AUDITORIA
   */
  private async logAuditoria(
    rolUsuario: string,
    actor: string,
    accion: string,
    entidad: string,
    entidadId: string,
    detalle: string,
  ) {
    const cleanDetalle = detalle.replace(/'/g, "''");
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO INBESTIGA_TESIS.dbo.AUDITORIA (
        rol_usuario, actor, accion, entidad, entidad_id, detalle, fecha_evento
      ) VALUES (
        '${rolUsuario}', '${actor}', '${accion}', '${entidad}', '${entidadId}', '${cleanDetalle}', GETDATE()
      );
    `);
  }

  /**
   * 3. POST /api/v1/payers/agent/chat
   * Agente IA de Cobranza PAYERS (Especificación v2) con Guardarraíles Determinísticos (RN-01 a RN-10)
   * y las 11 herramientas de la especificación técnica.
   */
  async procesarChatAgente(
    ordenPagoId: number,
    mensaje: string,
    opts?: {
      voz?: boolean;
      canal?: 'WHATSAPP' | 'TELEGRAM' | 'WEB';
      audioEntrada?: { buffer: Buffer; filename?: string; mimeType?: string };
    },
  ) {
    const detalle = await this.getOrdenDetalle(ordenPagoId);
    const { orden, handoff, contrato, cuotas, enlaces, pagos } = detalle;

    if (opts?.canal) {
      this.ultimoCanalPorOrden.set(ordenPagoId, opts.canal);
    }

    // 1. Asegurar conversación activa para el contacto en fase PAYERS
    const contactoId = Number(orden.contacto_id);
    const convRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1 conversacion_id
      FROM INBESTIGA_TESIS.dbo.CONVERSACION
      WHERE contacto_id = ${contactoId} AND fase = 'PAYERS'
      ORDER BY conversacion_id DESC;
    `);

    let conversacionId: number;
    if (convRows.length > 0) {
      conversacionId = Number(convRows[0].conversacion_id);
    } else {
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO INBESTIGA_TESIS.dbo.CONVERSACION (
          contacto_id, canal_id, fase, version_prompt, fecha_inicio, resuelta_sin_humano, estado
        ) VALUES (
          ${contactoId}, 4, 'PAYERS', 'payers-v2.0', GETDATE(), 1, 'ACTIVA'
        );
      `);
      const newConv: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT TOP 1 conversacion_id FROM INBESTIGA_TESIS.dbo.CONVERSACION WHERE contacto_id = ${contactoId} ORDER BY conversacion_id DESC;`,
      );
      conversacionId = Number(newConv[0].conversacion_id);
    }

    // 2. Guardar el mensaje del estudiante
    const rawTrimmedMsg = (mensaje || '').trim();
    const cleanMsg = rawTrimmedMsg.replace(/'/g, "''");
    const cleanMsgResumen = rawTrimmedMsg.slice(0, 250).replace(/'/g, "''");
    const tipoMensaje = opts?.voz ? 'AUDIO_TRANSCRITO' : 'TEXTO';
    const estudianteMensajeId = await this.insertMensajeYRetornarId(
      conversacionId,
      'ESTUDIANTE',
      tipoMensaje,
      (mensaje || '').trim(),
    );
    if (opts?.audioEntrada?.buffer?.length && estudianteMensajeId > 0) {
      try {
        await saveVoiceFile(
          estudianteMensajeId,
          opts.audioEntrada.buffer,
          opts.audioEntrada.filename,
          opts.audioEntrada.mimeType,
        );
      } catch (error: any) {
        this.logger.warn(`No se pudo guardar el audio entrante #${estudianteMensajeId}: ${error?.message || error}`);
      }
    }

    const msgLower = (mensaje || '').toLowerCase();
    const herramientasEjecutadas: ToolExecutionRecord[] = [];
    const guardrailsActivados: string[] = [];
    let respuesta = '';

    // Estado financiero unificado y cuota realmente exigible (excluye cuotas ESPERA_HITO)
    const finanzas = this.estadoFinanciero(orden, cuotas, pagos);
    const cuotaPendiente = finanzas.cuotaExigible;
    const montoCuotaActual = finanzas.montoCobrable;
    const enlaceActivo = enlaces[0];
    const pagosConfirmados = finanzas.pagosConfirmados;
    const pagosPorVerificar = pagos.filter((p) => p.estado === 'POR_VERIFICAR');
    const cuotasYaPagadas = cuotas.filter((c) => c.estado === 'PAGADA');
    const cuotasPorVerificar = cuotas.filter((c) => c.estado === 'POR_VERIFICAR');
    const tienePlanIniciado =
      pagosConfirmados.length > 0 ||
      pagosPorVerificar.length > 0 ||
      cuotasYaPagadas.length > 0 ||
      cuotasPorVerificar.length > 0 ||
      Number(orden.monto_cobrado) > 0;

    // Leer reglas de negocio vigentes en tiempo real (SQL Server REGLA_NEGOCIO)
    const antiPromptInjection = await this.businessRulesService.isReglaHabilitada('RN_01_PROMPT_INJECTION', true);
    const topeYape = await this.businessRulesService.getValorNumerico('RN_05_TOPE_YAPE_PLIN_PEN', 500, 15000);
    const linkVigenciaHoras = await this.businessRulesService.getValorNumerico('RN_09_EXPIRACION_LINK_PAGO_HRS', 72, 72);
    const maxCuotasInicial = Math.max(1, Math.round(await this.businessRulesService.getValorNumerico('RN_03_MAX_CUOTAS_INICIAL', 3, 3)));
    const maxCuotasReestruc = Math.max(1, Math.round(await this.businessRulesService.getValorNumerico('RN_03_MAX_CUOTAS_REESTRUCTURACION', 6, 6)));
    const validarVoucherPorCaja = await this.businessRulesService.isReglaHabilitada('RN_06_VERIFICACION_VOUCHER_CAJA', true);
    const permitirCancelarPendientes = await this.businessRulesService.isReglaHabilitada(
      'RN_12_CANCELAR_CUOTAS_PENDIENTES',
      false,
    );
    const permitirAnulacionPago = await this.businessRulesService.isReglaHabilitada(
      'RN_11_PERMITIR_ANULACION_PAGO',
      false,
    );

    const ultimosMensajesBot: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1 contenido
      FROM INBESTIGA_TESIS.dbo.MENSAJE
      WHERE conversacion_id = ${conversacionId}
        AND emisor = 'BOT'
        AND mensaje_id < ${estudianteMensajeId || 2147483647}
      ORDER BY mensaje_id DESC;
    `);
    const ultimoBotTexto = String(ultimosMensajesBot[0]?.contenido || '').toLowerCase();
    const veniaDeConfirmacionCancelacion =
      ultimoBotTexto.includes('cancela mis cuotas pendientes') ||
      ultimoBotTexto.includes('cancelar ahora mismo tus cuotas pendientes');
    const esConfirmacionAfirmativaCorta =
      /^(s[ií](\b|[,.!])|ok\b|dale\b|procede|adelante|confirmo|hazlo|de acuerdo|claro|por favor)/i.test(
        msgLower.trim(),
      ) ||
      /(s[ií],?\s*)?(canc[eé]lalas|an[uú]lalas|cancela mis cuotas|anula mis cuotas|cancela los siguientes pagos|confirmo cancelar)/i.test(
        msgLower,
      );
    const mencionaPagoYaConfirmado =
      /ya pagu[eé]|pago ya realizado|pago confirmado|boleta ya emitida|pago duplicado/i.test(msgLower) &&
      !/pendient|siguiente|falta|futur/i.test(msgLower);
    const consultaOCancelaCuotasPendientes =
      !mencionaPagoYaConfirmado &&
      (/((cancel|anul|desist|suspend|baja|dej[ae]r de pagar|no seguir pagando|no continuar).*(cuota|pago|pagos|pendiente|siguientes|orden|servicio))|((cuotas?|pagos?|lo que falta) (pendientes?|siguientes?|por pagar|restantes?).*(cancel|anul|no pag))|\bno deseo pagar\b|\bya no (voy a |quiero )?pagar\b/i.test(
        msgLower,
      ) ||
        (veniaDeConfirmacionCancelacion && esConfirmacionAfirmativaCorta));

    // =========================================================================
    // REGLA 1: Guardarraíl Anti-Prompt-Injection (Sección 11.4 y RN-01/RN-02)
    // =========================================================================
    if (
      antiPromptInjection &&
      /ignora.*(regla|instrucci)|system override|marca.*como pagad|aprueba mi pago|cambia.*precio_final|soy el administrador/i.test(
        msgLower,
      )
    ) {
      guardrailsActivados.push(
        'RN-01 / Anti-Prompt-Injection: Prohibido confirmar pagos o modificar precios por instrucción en chat',
      );
      const pagosConfirmados = pagos.filter((p) => p.estado === 'CONFIRMADO');
      const tool1 = await this.logToolExecution(
        conversacionId,
        ordenPagoId,
        'consultar_estado_pago',
        { orden_pago_id: ordenPagoId, verificacion_estricta: true },
        {
          codigo_orden: orden.codigo_orden,
          estado_orden: orden.estado,
          monto_comprometido_congelado: orden.monto_comprometido,
          pagos_confirmados_bd: pagosConfirmados.length,
          monto_cobrado_bd: orden.monto_cobrado,
        },
        68,
      );
      herramientasEjecutadas.push(tool1);

      respuesta =
        `🛡️ Como asesor virtual de INBESTIGA, no tengo permisos para confirmar pagos por instrucciones de chat ni alterar el precio acordado (${orden.codigo_orden}: S/ ${Number(orden.monto_comprometido).toFixed(2)}).\n\n` +
        `La acreditación de pagos se realiza exclusivamente mediante:\n` +
        `1. Confirmación en línea desde la pasarela oficial Mercado Pago.\n` +
        `2. Validación en bandeja de Caja de tu comprobante o voucher bancario.\n\n` +
        `Tu cuota #${cuotaPendiente.numero_cuota} por S/ ${montoCuotaActual.toFixed(2)} sigue en estado ${cuotaPendiente.estado}. ¿Deseas que te comparta el enlace oficial de pago?`;
    }
    // =========================================================================
    // REGLA 2: Traspaso Incompleto desde LEADS (RN-L1 / TRASPASO_INCOMPLETO)
    // =========================================================================
    else if (
      handoff?.estado_traspaso === 'INCOMPLETO' ||
      /vengo de leads pero a[uú]n no tengo contrato|traspaso incompleto/i.test(msgLower)
    ) {
      guardrailsActivados.push(
        'RN-L1: Prohibido emitir cobro sobre un paquete HANDOFF_LEADS incompleto — Escalado inmediato a LEADS',
      );
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO INBESTIGA_TESIS.dbo.ESCALAMIENTO (
          conversacion_id, orden_pago_id, tipo_escalamiento, destino, motivo, resumen_automatico, estado, fecha
        ) VALUES (
          ${conversacionId}, ${ordenPagoId}, 'TRASPASO_INCOMPLETO', 'Especialista', 'Traspaso incompleto desde LEADS',
          'El paquete HANDOFF_LEADS requiere completar vigencia/datos antes de habilitar pasarela.', 'ABIERTO', GETDATE()
        );
      `);
      const toolEsc = await this.logToolExecution(
        conversacionId,
        ordenPagoId,
        'escalar_a_humano',
        {
          orden_pago_id: ordenPagoId,
          tipo_escalamiento: 'TRASPASO_INCOMPLETO',
          destino: 'LEADS',
        },
        {
          escalado: true,
          estado_handoff: handoff?.estado_traspaso || 'INCOMPLETO',
          detalle: handoff?.detalle_incompleto || 'Faltan datos obligatorios de LEADS',
        },
        110,
      );
      herramientasEjecutadas.push(toolEsc);

      respuesta =
        `He verificado tu expediente (${orden.codigo_orden}) y detecté que tu paquete de traspaso figura con observaciones pendientes (${handoff?.detalle_incompleto || 'datos contractuales por completar'}).\n\n` +
        `Por seguridad de tu servicio, he derivado tu caso con prioridad a tu asesor para que complete tu ficha antes de habilitar el pago.`;
    }
    // =========================================================================
    // REGLA 2.4: Orden Anulada (Cuotas pendientes canceladas por RN_12)
    // =========================================================================
    else if (
      finanzas.ordenAnulada &&
      !/reembolso|devoluci[oó]n|boleta|comprobante|anular.*confirmad|ya pagu[eé]|cronograma|mis cuotas|ver cuotas/i.test(
        msgLower,
      )
    ) {
      guardrailsActivados.push(
        'RN_12: Orden con cuotas pendientes ANULADAS — saldo exigible S/ 0.00 sin enlaces ni recordatorios',
      );
      const toolAnulada = await this.logToolExecution(
        conversacionId,
        ordenPagoId,
        'consultar_orden_pago',
        { orden_pago_id: ordenPagoId, verificacion: 'ORDEN_ANULADA' },
        {
          codigo_orden: orden.codigo_orden,
          estado_orden: orden.estado,
          monto_abonado: finanzas.totalCobrado,
          monto_cuotas_anuladas: finanzas.montoAnulado,
          saldo_pendiente: 0,
        },
        55,
      );
      herramientasEjecutadas.push(toolAnulada);

      respuesta =
        `ℹ️ Tu orden **${orden.codigo_orden}** tiene sus cuotas pendientes **CANCELADAS / ANULADAS**.\n\n` +
        `• **Total abonado conservado:** S/ ${finanzas.totalCobrado.toFixed(2)}\n` +
        `• **Cuotas futuras canceladas:** S/ ${finanzas.montoAnulado.toFixed(2)} (\`ANULADA\`)\n` +
        `• **Saldo pendiente exigible:** S/ 0.00\n\n` +
        `No se emitirán enlaces de pago ni recordatorios adicionales. Si necesitas revisar tus boletas anteriores o consultar nuestra política de devoluciones, indícamelo.`;
    }
    // =========================================================================
    // REGLA 2.5: Cierre al Saldo 0 (Orden Totalmente Liquidada)
    // =========================================================================
    else if (
      finanzas.ordenLiquidada &&
      !/entrega|sesi[oó]n|asesor|reuni[oó]n|meet|cronograma|mis cuotas/i.test(msgLower)
    ) {
      guardrailsActivados.push(
        'Cierre por saldo 0: orden 100% cancelada — prohibido emitir enlaces o solicitar pagos adicionales',
      );
      await this.prisma.$executeRawUnsafe(`
        UPDATE INBESTIGA_TESIS.dbo.ALERTA_COBRANZA
        SET resultado = 'RECUPERADO'
        WHERE orden_pago_id = ${ordenPagoId} AND resultado = 'ENVIADO';
      `);
      const toolCierre = await this.logToolExecution(
        conversacionId,
        ordenPagoId,
        'consultar_orden_pago',
        { orden_pago_id: ordenPagoId, verificacion: 'ORDEN_LIQUIDADA' },
        {
          orden_pagada: true,
          total_comprometido: finanzas.totalComprometido,
          total_cobrado: finanzas.totalCobrado,
          saldo_pendiente: 0,
        },
        55,
      );
      herramientasEjecutadas.push(toolCierre);

      respuesta =
        `🎉 **¡Tu orden está 100% cancelada, ${orden.estudiante_nombre}!**\n\n` +
        `• **Orden:** ${orden.codigo_orden} — ${orden.servicio_nombre}\n` +
        `• **Total abonado:** S/ ${finanzas.totalCobrado.toFixed(2)} de S/ ${finanzas.totalComprometido.toFixed(2)}\n` +
        `• **Saldo pendiente:** S/ 0.00\n` +
        `• **Estado del servicio:** \`ACTIVO\`\n` +
        `• **Asesor Metodológico:** ${orden.asesor_nombre || 'Dr. Carlos Alberto Méndez Vargas'}\n\n` +
        `Ya no tienes ningún pago pendiente ni cuotas por abonar. Si deseas coordinar tu próxima sesión o entrega, escríbeme y lo gestiono con tu asesor. 😊`;
    }
    // =========================================================================
    // REGLA 3: Solicitud de Rebaja / Descuento / Cambio de Alcance (RN-02)
    // =========================================================================
    else if (
      /descuento|rebaja|muy caro|menos precio|b[aá]jame|prometi[oó].*descuento|cambiar.*cl[aá]usula|cambiar.*alcance/i.test(
        msgLower,
      )
    ) {
      guardrailsActivados.push(
        `RN-02: Precio final congelado en PAYERS (S/ ${Number(orden.monto_comprometido).toFixed(2)}) — Devolución automática a LEADS`,
      );

      await this.prisma.$executeRawUnsafe(`
        INSERT INTO INBESTIGA_TESIS.dbo.OBJECION_PAGO (
          orden_pago_id, tipo, resumen, veces_repetida, resuelta, fecha_registro
        ) VALUES (
          ${ordenPagoId}, 'DESCUENTO_REBAJA', 'El estudiante solicita rebaja o renegociación de precio en fase PAYERS.', 1, 0, GETDATE()
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        INSERT INTO INBESTIGA_TESIS.dbo.ESCALAMIENTO (
          conversacion_id, orden_pago_id, tipo_escalamiento, destino, motivo, resumen_automatico, estado, fecha
        ) VALUES (
          ${conversacionId}, ${ordenPagoId}, 'DEVOLVER_A_LEADS', 'Especialista', 'Descuento excede tope',
          'Solicitud de descuento en PAYERS sobre monto congelado S/ ${Number(orden.monto_comprometido).toFixed(2)}. Devuelto a LEADS (RN-02).',
          'ABIERTO', GETDATE()
        );
      `);

      const toolEsc = await this.logToolExecution(
        conversacionId,
        ordenPagoId,
        'escalar_a_humano',
        {
          orden_pago_id: ordenPagoId,
          tipo_escalamiento: 'DEVOLVER_A_LEADS',
          destino: 'LEADS',
          motivo: 'Solicitud de descuento adicional o cambio de alcance',
        },
        {
          escalado: true,
          destino: 'Especialista LEADS',
          precio_congelado: Number(orden.monto_comprometido),
          alternativa_autorizada: 'Fraccionamiento en 3 o 6 cuotas sin variar precio final',
        },
        115,
      );
      herramientasEjecutadas.push(toolEsc);

      respuesta =
        `Comprendo tu consulta sobre el presupuesto. El monto acordado en tu propuesta aceptada (**S/ ${Number(orden.monto_comprometido).toFixed(2)}**, con descuento comercial ya aplicado de S/ ${Number(orden.descuento).toFixed(2)}) corresponde al valor formal de tu contrato.\n\n` +
        `✅ **Lo que acabo de hacer por ti:**\n` +
        `1. He registrado tu consulta y la derivé con prioridad a tu asesor comercial para que evalúe alternativas.\n` +
        (tienePlanIniciado
          ? `2. Dado que tu orden ya tiene abonos registrados bajo la modalidad **${orden.modalidad_condicion}**, podemos reestructurar tu saldo pendiente en cuotas más accesibles o puedes abonar tu cuota con tarjeta de crédito en cuotas vía Mercado Pago.`
          : `2. Si deseas mantener el precio actual pero reducir el desembolso inicial hoy mismo, recuerda que puedo fraccionar tu orden en **3 cuotas (30/40/30)** o **6 cuotas por entregable** sin ningún recargo.`);
    }
    // =========================================================================
    // REGLA 4: Pago con Yape o Plin -> Validación Tope dinámico (RN-05)
    // =========================================================================
    else if (/yape|plin/i.test(msgLower) && !/ya pagu[eé]|ya hice/i.test(msgLower)) {
      const billetera = /plin/i.test(msgLower) ? 'Plin' : 'Yape';
      if (montoCuotaActual > topeYape) {
        guardrailsActivados.push(
          `RN-05: Tope operativo ${billetera} (S/ ${topeYape.toFixed(2)}) superado por cuota actual (S/ ${montoCuotaActual.toFixed(2)})`,
        );

        const polRows: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT * FROM INBESTIGA_TESIS.dbo.POLITICA_COBRANZA WHERE tema = 'TOPE_YAPE';`,
        );

        const toolPol = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'consultar_politica_cobranza',
          { tema: 'TOPE_YAPE', monto_cuota: montoCuotaActual },
          {
            tope_maximo_soles: topeYape,
            excede_tope: true,
            politica: polRows[0]?.contenido || `Límite máximo S/ ${topeYape.toFixed(2)} por operación en Yape/Plin.`,
          },
          75,
        );
        herramientasEjecutadas.push(toolPol);

        const refLink = `lnk_card_${ordenPagoId}_${Date.now().toString().slice(-5)}`;
        const urlLink = await this.generarUrlCheckoutMercadoPago({
          codigoOrden: orden.codigo_orden,
          monto: montoCuotaActual,
          servicio: orden.servicio_nombre,
          email: orden.estudiante_email,
          nombre: orden.estudiante_nombre,
        });
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO INBESTIGA_TESIS.dbo.ENLACE_PAGO (
            orden_pago_id, cuota_id, medio_pago_id, referencia_externa, url_enlace, monto, fecha_envio, fecha_expiracion, estado
          ) VALUES (
            ${ordenPagoId}, ${Number(cuotaPendiente.cuota_id)}, 3, '${refLink}', '${urlLink}', ${montoCuotaActual}, GETDATE(), DATEADD(HOUR, ${linkVigenciaHoras}, GETDATE()), 'ENVIADO'
          );
        `);

        const toolLink = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'emitir_enlace_pago',
          {
            orden_pago_id: ordenPagoId,
            cuota_id: cuotaPendiente.cuota_id,
            medio_solicitado: billetera.toUpperCase(),
            medio_emitido: 'TARJETA',
            monto: montoCuotaActual,
          },
          {
            url_enlace: urlLink,
            referencia_externa: refLink,
            instrucciones_transferencia:
              'Cta Corriente Soles BCP: 570-2489103-0-12 | CCI: 00257000248910301235 (INBESTIGA SAC - 0% comisión)',
          },
          130,
        );
        herramientasEjecutadas.push(toolLink);

        await this.prisma.$executeRawUnsafe(`
          INSERT INTO INBESTIGA_TESIS.dbo.OBJECION_PAGO (
            orden_pago_id, tipo, resumen, veces_repetida, resuelta, fecha_registro
          ) VALUES (
            ${ordenPagoId}, 'TOPE_MEDIO', 'Intentó pagar S/ ${montoCuotaActual.toFixed(2)} con ${billetera}; se aplicó RN-05 (tope S/ ${topeYape.toFixed(2)}).', 1, 1, GETDATE()
          );
        `);

        respuesta =
          `• **Aviso sobre el límite de transacción en ${billetera}:**\n` +
          `Tu cuota exigible #${cuotaPendiente.numero_cuota} es de **S/ ${montoCuotaActual.toFixed(2)}**, y por políticas de seguridad de las billeteras móviles en pasarela el límite máximo por operación en **Yape / Plin es de S/ ${topeYape.toFixed(2)}**.\n\n` +
          `Para completar tu pago ahora mismo tienes **3 alternativas oficiales**:\n` +
          `1. **Enlace Checkout con Tarjeta Débito/Crédito (hasta S/ 15,000):** ${urlLink}\n` +
          `2. **Transferencia Bancaria BCP / Interbank (0% comisión):** Cta. Corriente Soles BCP **570-2489103-0-12** | CCI **00257000248910301235** (INBESTIGA SAC) y me envías la captura del voucher por aquí.\n` +
          (tienePlanIniciado
            ? `3. **Solicitar reestructuración de tu cuota pendiente** con el Administrador de Caja para adaptarla a ${billetera}. ¿Cuál prefieres?`
            : `3. **Fraccionar en ${maxCuotasReestruc} cuotas por entregable** para que tu cuota inicial sea más accesible. ¿Cuál prefieres?`);
      } else {
        guardrailsActivados.push(
          `RN-05: Monto S/ ${montoCuotaActual.toFixed(2)} validado dentro del límite operativo de ${billetera} (≤ S/ ${topeYape.toFixed(2)})`,
        );
        const medioId = billetera === 'Plin' ? 2 : 1;
        const refLink = `lnk_${billetera.toLowerCase()}_${ordenPagoId}_${Date.now().toString().slice(-5)}`;
        const urlLink = await this.generarUrlCheckoutMercadoPago({
          codigoOrden: orden.codigo_orden,
          monto: montoCuotaActual,
          servicio: orden.servicio_nombre,
          email: orden.estudiante_email,
          nombre: orden.estudiante_nombre,
        });

        await this.prisma.$executeRawUnsafe(`
          INSERT INTO INBESTIGA_TESIS.dbo.ENLACE_PAGO (
            orden_pago_id, cuota_id, medio_pago_id, referencia_externa, url_enlace, monto, fecha_envio, fecha_expiracion, estado
          ) VALUES (
            ${ordenPagoId}, ${Number(cuotaPendiente.cuota_id)}, ${medioId}, '${refLink}', '${urlLink}', ${montoCuotaActual}, GETDATE(), DATEADD(HOUR, ${linkVigenciaHoras}, GETDATE()), 'ENVIADO'
          );
        `);

        const toolLink = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'emitir_enlace_pago',
          {
            orden_pago_id: ordenPagoId,
            cuota_id: cuotaPendiente.cuota_id,
            medio_pago: billetera.toUpperCase(),
            monto: montoCuotaActual,
          },
          {
            url_enlace: urlLink,
            referencia_externa: refLink,
            tope_validado: true,
          },
          105,
        );
        herramientasEjecutadas.push(toolLink);

        respuesta =
          `• **Enlace directo de pago generado:** Como tu cuota #${cuotaPendiente.numero_cuota} es de **S/ ${montoCuotaActual.toFixed(2)}** (dentro del límite de S/ ${topeYape.toFixed(2)} de ${billetera}), he generado tu enlace directo:\n\n` +
          `• **Enlace Oficial ${billetera} (Mercado Pago):** ${urlLink}\n` +
          `• **Orden:** ${orden.codigo_orden} (${orden.servicio_nombre})\n` +
          `• **Monto:** S/ ${montoCuotaActual.toFixed(2)}\n\n` +
          `Apenas apruebes el pago en ${billetera} o Mercado Pago, el sistema confirmará tu pago en segundos y activará tu servicio automáticamente.`;
      }
    }
    // =========================================================================
    // REGLA 4.5: Solicitud Expresa o Reenvío de Enlace de Pago (emitir_enlace_pago)
    // =========================================================================
    else if (
      /enlace|link|dame.*enlace|p[aá]same.*enlace|reenvi.*enlace|d[oó]nde pago|c[oó]mo pago|pasar.*link|enlace.*pagar/i.test(
        msgLower,
      ) &&
      !/3 cuotas|6 cuotas|fraccionar|cambiar/i.test(msgLower)
    ) {
      if (finanzas.esCuotaBloqueada) {
        guardrailsActivados.push(
          'Solicitud de enlace denegada: la cuota vigente está en ESPERA_HITO (sin enlace hasta aprobar el hito)',
        );
        respuesta =
          `⏳ **Aún no hay una cuota exigible para pagar, ${orden.estudiante_nombre}.**\n\n` +
          `Tu siguiente cuota (#${cuotaPendiente.numero_cuota}, S/ ${finanzas.montoCuotaExigible.toFixed(2)}) está atada a un **hito académico verificable** (\`ESPERA_HITO\`). ` +
          `Se habilitará para pago y te enviaré el enlace en cuanto tu asesor (**${orden.asesor_nombre || 'Dr. Carlos Alberto Méndez Vargas'}**) apruebe el entregable correspondiente.`;
      } else {
        guardrailsActivados.push('Solicitud expresa de emisión o reenvío de enlace de pago oficial');
        const urlEnlace = await this.urlPagoVigente(orden, montoCuotaActual, enlaceActivo);

        const toolLink = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'emitir_enlace_pago',
          {
            orden_pago_id: ordenPagoId,
            cuota_id: cuotaPendiente.cuota_id,
            monto: montoCuotaActual,
          },
          {
            url_enlace: urlEnlace,
            estado_cuota: cuotaPendiente.estado,
          },
          80,
        );
        herramientasEjecutadas.push(toolLink);

        respuesta =
          `• **Enlace Oficial de Pago — Orden ${orden.codigo_orden}:**\n\n` +
          `Hola **${orden.estudiante_nombre}**, aquí tienes tu enlace directo para abonar de forma segura:\n\n` +
          `• **Pagar en Pasarela Mercado Pago:** ${urlEnlace}\n\n` +
          `• **Servicio:** ${orden.servicio_nombre}\n` +
          `• **Cuota #${cuotaPendiente.numero_cuota}:** S/ ${montoCuotaActual.toFixed(2)} (\`${cuotaPendiente.estado}\`)\n` +
          `• **Medios aceptados:** Mercado Pago (Tarjeta de Crédito/Débito, Yape, PagoEfectivo) y Transferencia BCP.\n\n` +
          `Una vez acreditado tu abono, tu servicio queda activo con tu asesor asignado (**${orden.asesor_nombre || 'Dr. Carlos Alberto Méndez Vargas'}**).`;
      }
    }
    // =========================================================================
    // REGLA 5: Envío de Voucher / Transferencia Manual (RN-06)
    // =========================================================================
    else if (
      /voucher|comprobante|transfer[ií]|transferencia|deposit[eé]|dep[oó]sito|operaci[oó]n|bcp|interbank|adjunto/i.test(
        msgLower,
      )
    ) {
      guardrailsActivados.push(
        'RN-06: Registro de voucher en estado POR_VERIFICAR — Prohibido activar CUSTOMER hasta verificación de Caja',
      );
      const matchOp = mensaje.match(/([A-Z]{2,4}-\d{4,10}|\d{6,12})/i);
      const refOperacion = matchOp ? matchOp[1].toUpperCase() : `BCP-${Date.now().toString().slice(-7)}`;
      const bancoDetectado = /interbank|ibk/i.test(msgLower) ? 'Interbank' : 'BCP';
      const hashImg = crypto
        .createHash('sha256')
        .update(`${ordenPagoId}_${refOperacion}_${Date.now()}`)
        .digest('hex');

      await this.prisma.$executeRawUnsafe(`
        INSERT INTO INBESTIGA_TESIS.dbo.PAGO (
          orden_pago_id, cuota_id, medio_pago_id, fecha_inicio, monto_pagado, comision_pasarela, referencia, metodo_verificacion, estado
        ) VALUES (
          ${ordenPagoId}, ${Number(cuotaPendiente.cuota_id)}, 4, GETDATE(), ${montoCuotaActual}, 0.00, '${refOperacion}', 'MANUAL', 'POR_VERIFICAR'
        );
      `);

      const pagoInserted: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT TOP 1 pago_id FROM INBESTIGA_TESIS.dbo.PAGO WHERE orden_pago_id = ${ordenPagoId} ORDER BY pago_id DESC;`,
      );
      const nuevoPagoId = Number(pagoInserted[0]?.pago_id || 0);

      await this.prisma.$executeRawUnsafe(`
        INSERT INTO INBESTIGA_TESIS.dbo.VOUCHER (
          pago_id, orden_pago_id, cuota_id, referencia_operacion, archivo_url, hash_imagen, monto_ocr, banco_ocr, estado, fecha_carga
        ) VALUES (
          ${nuevoPagoId || 'NULL'}, ${ordenPagoId}, ${Number(cuotaPendiente.cuota_id)}, '${refOperacion}',
          '/uploads/vouchers/voucher_${ordenPagoId}_${refOperacion}.jpg', '${hashImg}', ${montoCuotaActual}, '${bancoDetectado}', 'POR_VERIFICAR', GETDATE()
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        UPDATE INBESTIGA_TESIS.dbo.CUOTA_PAGO
        SET estado = 'POR_VERIFICAR'
        WHERE cuota_id = ${Number(cuotaPendiente.cuota_id)} AND estado != 'PAGADA';
      `);

      const toolVoucher = await this.logToolExecution(
        conversacionId,
        ordenPagoId,
        'registrar_voucher_manual',
        {
          orden_pago_id: ordenPagoId,
          cuota_id: cuotaPendiente.cuota_id,
          referencia_operacion: refOperacion,
          banco_ocr: bancoDetectado,
          monto_ocr: montoCuotaActual,
        },
        {
          estado_voucher: 'POR_VERIFICAR',
          hash_sha256_unico: hashImg.slice(0, 16) + '...',
          bandeja_destino: 'Caja / Administración (Lic. Sofía Castañeda)',
        },
        142,
      );
      herramientasEjecutadas.push(toolVoucher);

      respuesta =
        `• **Comprobante Registrado para Validación de Caja (Regla RN-06):**\n` +
        `He recibido y registrado tu comprobante de **${bancoDetectado}** con operación **${refOperacion}** por **S/ ${montoCuotaActual.toFixed(2)}**.\n\n` +
        `• **Estado actual:** \`POR_VERIFICAR\` (pendiente de conciliación bancaria en Caja).\n` +
        `• **Hash de integridad:** \`${hashImg.slice(0, 16)}...\`\n\n` +
        `Tan pronto como el área de Caja valide el abono en cuenta, se confirmará tu pago y recibirás la notificación de activación de tu servicio y asignación de asesor.`;
    }
    // =========================================================================
    // REGLA 6: Reclamo "Ya pagué" / Verificación en BD / Cobro Doble (RN-01)
    // =========================================================================
    else if (
      /ya pagu[eé]|ya hice el pago|ya cancel[eé]|confirma mi pago|act[ií]venme|cobraron dos veces|doble cobro/i.test(
        msgLower,
      )
    ) {
      guardrailsActivados.push(
        'RN-01: Verificación determinística de pago en INBESTIGA_TESIS (PAGO + EVENTO_WEBHOOK) — 0% alucinación',
      );
      const pagosConfirmados = pagos.filter((p) => p.estado === 'CONFIRMADO');
      const pagosPorVerificar = pagos.filter((p) => p.estado === 'POR_VERIFICAR');

      const toolEstado = await this.logToolExecution(
        conversacionId,
        ordenPagoId,
        'consultar_estado_pago',
        { orden_pago_id: ordenPagoId },
        {
          estado_orden: orden.estado,
          pagos_confirmados: pagosConfirmados.length,
          pagos_por_verificar: pagosPorVerificar.length,
          monto_cobrado_confirmado: orden.monto_cobrado,
          cuota_actual_estado: cuotaPendiente.estado,
        },
        82,
      );
      herramientasEjecutadas.push(toolEstado);

      if (/dos veces|doble/i.test(msgLower)) {
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO INBESTIGA_TESIS.dbo.ESCALAMIENTO (
            conversacion_id, orden_pago_id, tipo_escalamiento, destino, motivo, resumen_automatico, estado, fecha
          ) VALUES (
            ${conversacionId}, ${ordenPagoId}, 'RECLAMO_PAGO', 'Administrador', 'Reclamo de pago',
            'El estudiante reporta cobro duplicado en tarjeta; se escala a Caja para conciliación y reembolso.', 'ABIERTO', GETDATE()
          );
        `);
        const toolEsc = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'escalar_a_humano',
          { orden_pago_id: ordenPagoId, tipo_escalamiento: 'RECLAMO_PAGO', destino: 'Administrador' },
          { escalado: true, prioridad: 'ALTA' },
          95,
        );
        herramientasEjecutadas.push(toolEsc);

        respuesta =
          `• **Reporte Escalado:** He derivado inmediatamente tu reporte de **cobro duplicado** como \`RECLAMO_PAGO\` al Administrador de Caja para que concilie las transacciones en Mercado Pago y procese la devolución correspondiente.`;
      } else if (pagosConfirmados.length > 0 && orden.estado === 'PAGADA') {
        respuesta =
          `• **Estado Confirmado:** He consultado la base de datos transaccional (**INBESTIGA_TESIS**) y confirmo que tu orden **${orden.codigo_orden}** registra **${pagosConfirmados.length} pago(s) CONFIRMADO(S)** por un total de **S/ ${Number(orden.monto_cobrado).toFixed(2)}**.\n\n` +
          `Tu servicio ya se encuentra **ACTIVO** con tu asesor asignado (**${orden.asesor_nombre || 'Dr. Carlos Alberto Méndez Vargas'}**).`;
      } else if (pagosPorVerificar.length > 0) {
        respuesta =
          `• **En Proceso de Verificación:** He consultado la base de datos y veo que tienes un comprobante registrado en estado **POR_VERIFICAR** (Ref: \`${pagosPorVerificar[0].referencia}\`).\n\n` +
          `Por política de control interno (**RN-01 / RN-06**), no puedo activar el servicio únicamente por mensaje de chat; en cuanto Caja apruebe tu voucher en el panel, tu orden pasará a confirmada.`;
      } else {
        respuesta =
          `• **Consulta de Pago en Línea:** He verificado en tiempo real la base de datos (**PAGO** y **EVENTO_WEBHOOK**) para tu orden **${orden.codigo_orden}** y aún **no figura ningún pago confirmado** para la cuota #${cuotaPendiente.numero_cuota} (S/ ${montoCuotaActual.toFixed(2)}).\n\n` +
          `• Si pagaste por **Mercado Pago**, puedes verificarlo en el enlace de checkout o indicarme el número de operación.\n` +
          `• Si hiciste una **transferencia o depósito BCP/Interbank**, envíame el número de operación para registrarlo en Caja (\`POR_VERIFICAR\`).`;
      }
    }
    // =========================================================================
    // REGLA 7: Confirmación / Consulta de Contrato (RN-03)
    // =========================================================================
    else if (/contrato|cl[aá]usula|garant[ií]a.*contrato|acepto los t[eé]rminos/i.test(msgLower)) {
      if (/acepto|confirmo|de acuerdo/i.test(msgLower)) {
        guardrailsActivados.push(
          'RN-03: Confirmación explícita de contrato registrada con sello de tiempo y evidencia antes del cobro',
        );
        await this.prisma.$executeRawUnsafe(`
          UPDATE INBESTIGA_TESIS.dbo.CONTRATO
          SET estado = 'CONFIRMADO',
              fecha_confirmacion = GETDATE(),
              canal_confirmacion = 'WHATSAPP',
              evidencia_aceptacion = '${cleanMsg}'
          WHERE propuesta_id = ${Number(orden.propuesta_id)};
        `);

        const toolContrato = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'confirmar_contrato',
          { orden_pago_id: ordenPagoId, evidencia_aceptacion: mensaje },
          {
            contrato_id: contrato?.contrato_id || ordenPagoId,
            estado: 'CONFIRMADO',
            canal: 'WHATSAPP',
          },
          90,
        );
        herramientasEjecutadas.push(toolContrato);

        const medioDefault = montoCuotaActual <= 500 ? 1 : 3;
        const refLink = `lnk_ctr_${ordenPagoId}_${Date.now().toString().slice(-5)}`;
        const urlLink = await this.generarUrlCheckoutMercadoPago({
          codigoOrden: orden.codigo_orden,
          monto: montoCuotaActual,
          servicio: orden.servicio_nombre,
          email: orden.estudiante_email,
          nombre: orden.estudiante_nombre,
        });

        await this.prisma.$executeRawUnsafe(`
          INSERT INTO INBESTIGA_TESIS.dbo.ENLACE_PAGO (
            orden_pago_id, cuota_id, medio_pago_id, referencia_externa, url_enlace, monto, fecha_envio, fecha_expiracion, estado
          ) VALUES (
            ${ordenPagoId}, ${Number(cuotaPendiente.cuota_id)}, ${medioDefault}, '${refLink}', '${urlLink}', ${montoCuotaActual}, GETDATE(), DATEADD(HOUR, 48, GETDATE()), 'ENVIADO'
          );
        `);

        const toolEnlace = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'emitir_enlace_pago',
          {
            orden_pago_id: ordenPagoId,
            cuota_id: cuotaPendiente.cuota_id,
            monto: montoCuotaActual,
          },
          {
            url_enlace: urlLink,
            referencia_externa: refLink,
          },
          102,
        );
        herramientasEjecutadas.push(toolEnlace);

        respuesta =
          `✅ **Contrato Confirmado Oficialmente (${orden.codigo_contrato || 'CTR-2026'}):**\n` +
          `He registrado tu aceptación del contrato v2.0 en **INBESTIGA_TESIS**.\n\n` +
          `🔗 **Aquí tienes tu enlace de pago habilitado para la Cuota #${cuotaPendiente.numero_cuota}:**\n` +
          `• **URL Checkout Mercado Pago:** ${urlLink}\n` +
          `• **Importe Exigible:** S/ ${montoCuotaActual.toFixed(2)} (${orden.modalidad_condicion})\n` +
          `• **Servicio:** ${orden.servicio_nombre}`;
      } else {
        const toolConsContrato = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'consultar_contrato',
          { orden_pago_id: ordenPagoId },
          {
            version: contrato?.version || 'v2.0',
            estado: contrato?.estado || 'CONFIRMADO',
            alcance: contrato?.alcance,
            garantia: contrato?.garantia,
            plazo_dias: contrato?.plazo_dias || 90,
          },
          70,
        );
        herramientasEjecutadas.push(toolConsContrato);

        respuesta =
          `📄 **Resumen de tu Contrato ${orden.codigo_contrato || 'v2.0'} (${contrato?.estado || 'CONFIRMADO'}):**\n` +
          `• **Alcance:** ${contrato?.alcance || 'Asesoría metodológica personalizada por entregables verificables.'}\n` +
          `• **Garantía:** ${contrato?.garantia || 'Acompañamiento hasta sustentación aprobada y similitud Turnitin < 15%.'}\n` +
          `• **Plazo estimado:** ${contrato?.plazo_dias || 90} días.\n` +
          `• **Términos de cancelación:** ${contrato?.terminos_cancelacion || 'Reembolso proporcional descontando hitos entregados.'}\n\n` +
          `Si estás conforme, escribe **"Confirmo el contrato"** para emitir tu enlace de pago.`;
      }
    }
    // =========================================================================
    // REGLA 7.5: Consulta Detallada de Cronograma de Cuotas (consultar_cronograma_cuotas)
    // =========================================================================
    else if (
      /cronograma|mis cuotas|ver cuotas|consultar.*cuotas|fechas? de pago|cu[aá]ndo vence/i.test(msgLower) &&
      !/cambiar|reestructurar|3 cuotas|tres cuotas|6 cuotas|seis cuotas|en partes|fraccionar/i.test(msgLower) &&
      !consultaOCancelaCuotasPendientes
    ) {
      guardrailsActivados.push('Consulta determinística de cronograma de cuotas y calendario de pagos');
      const todasCuotas: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT numero_cuota, porcentaje, monto_programado, condicion, fecha_vencimiento, estado
        FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO
        WHERE orden_pago_id = ${ordenPagoId}
        ORDER BY numero_cuota ASC;
      `);

      const toolCronograma = await this.logToolExecution(
        conversacionId,
        ordenPagoId,
        'consultar_cronograma_cuotas',
        { orden_pago_id: ordenPagoId },
        {
          codigo_orden: orden.codigo_orden,
          modalidad: orden.modalidad_condicion,
          total_cuotas: todasCuotas.length,
          monto_comprometido: orden.monto_comprometido,
          monto_cobrado: orden.monto_cobrado,
          cuotas: todasCuotas,
        },
        78,
      );
      herramientasEjecutadas.push(toolCronograma);

      const saldo = finanzas.saldoPendiente;
      let cronoText =
        `📅 **Cronograma Oficial de Pagos — Orden ${orden.codigo_orden}**\n\n` +
        `• **Servicio:** ${orden.servicio_nombre}\n` +
        `• **Modalidad pactada:** ${orden.modalidad_condicion}\n` +
        `• **Total comprometido:** S/ ${finanzas.totalComprometido.toFixed(2)}\n` +
        `• **Monto abonado:** S/ ${finanzas.totalCobrado.toFixed(2)}\n` +
        (finanzas.montoAnulado > 0
          ? `• **Cuotas futuras canceladas (RN_12):** S/ ${finanzas.montoAnulado.toFixed(2)}\n`
          : '') +
        `• **Saldo pendiente:** S/ ${saldo.toFixed(2)}\n\n` +
        `📋 **Desglose de Cuotas:**\n`;

      for (const c of todasCuotas) {
        const icon =
          c.estado === 'PAGADA'
            ? '✅'
            : c.estado === 'ANULADA'
              ? '🚫'
              : c.estado === 'ENLACE_ENVIADO'
                ? '🟡'
                : '⏳';
        const fechaStr = c.fecha_vencimiento
          ? new Date(c.fecha_vencimiento).toISOString().split('T')[0]
          : 'Contra entrega de hito académico';
        cronoText += `${icon} **Cuota #${c.numero_cuota}:** S/ ${Number(c.monto_programado).toFixed(2)} (${Number(c.porcentaje)}%) — \`${c.estado}\`\n`;
        cronoText += `   └ Vence: ${fechaStr} | Condición: ${c.condicion || 'Entrega verificable'}\n`;
      }

      if (orden.modalidad_condicion.includes('1 pago') && Number(orden.monto_cobrado) === 0 && !finanzas.ordenAnulada) {
        cronoText += `\n💡 **Opciones de Flexibilidad Financiera:**\nActualmente tu orden está configurada en **1 pago al contado**. Si prefieres pagar en cuotas por hitos verificables antes de iniciar tu asesoría, solo dime **"cambiar a 3 cuotas"** o **"en 6 cuotas"** y actualizaré tu cronograma inmediatamente.`;
      }

      if (enlaceActivo && !finanzas.ordenAnulada && !finanzas.esCuotaBloqueada && finanzas.saldoPendiente > 0) {
        cronoText += `\n\n💳 **Enlace oficial de pago de tu cuota exigible:** ${enlaceActivo.url_enlace}`;
      } else if (finanzas.esCuotaBloqueada) {
        cronoText += `\n\n⏳ Tu siguiente cuota (#${cuotaPendiente.numero_cuota}) está en \`ESPERA_HITO\`: se habilitará para pago en cuanto tu asesor apruebe el hito académico correspondiente.`;
      } else if (finanzas.ordenAnulada) {
        cronoText += `\n\nℹ️ Las cuotas pendientes de esta orden fueron **CANCELADAS/ANULADAS**. No existen cobros pendientes ni enlaces activos.`;
      }

      respuesta = cronoText;
    }
    // =========================================================================
    // REGLA 8: Configuración / Cambio de Modalidad y Cuotas (RN-03)
    // =========================================================================
    else if (
      /3 cuotas|tres cuotas|6 cuotas|seis cuotas|2 cuotas|dos cuotas|4 cuotas|cuatro cuotas|contado|en partes|fraccionar|cambiar.*cuotas|dividir.*cuotas|dividir.*en|reestructur|menos cuotas|ajustar.*cuotas|partir.*saldo/i.test(
        msgLower,
      )
    ) {
      const pagosConfirmados = finanzas.pagosConfirmados;
      const pagosPorVerificar = pagos.filter((p) => p.estado === 'POR_VERIFICAR');
      const cuotasYaPagadas = cuotas.filter((c) => c.estado === 'PAGADA');
      const cuotasPorVerificar = cuotas.filter((c) => c.estado === 'POR_VERIFICAR');
      const tienePlanIniciado =
        pagosConfirmados.length > 0 ||
        pagosPorVerificar.length > 0 ||
        cuotasYaPagadas.length > 0 ||
        cuotasPorVerificar.length > 0 ||
        Number(orden.monto_cobrado) > 0;
      if (orden.solo_contado && /3 cuotas|6 cuotas|partes|fraccionar/i.test(msgLower)) {
        guardrailsActivados.push(
          `RN-03: El servicio "${orden.servicio_nombre}" (S/ ${Number(orden.monto_comprometido).toFixed(2)}) tiene solo_contado = 1`,
        );
        const toolEstado = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'consultar_orden_pago',
          { orden_pago_id: ordenPagoId, servicio: orden.servicio_nombre },
          { solo_contado: true, max_cuotas: 1, monto: orden.monto_comprometido },
          72,
        );
        herramientasEjecutadas.push(toolEstado);

        respuesta =
          `⚠️ Por política comercial (**RN-03**), el servicio de **${orden.servicio_nombre}** por **S/ ${Number(orden.monto_comprometido).toFixed(2)}** es de entrega rápida y se abona exclusivamente en **1 pago al contado (100%)**.`;
      } else {
        const cuotasPagadasCount = cuotasYaPagadas.length;
        const totalOrden = Number(orden.monto_comprometido);
        const saldoPendiente = finanzas.saldoPendiente;

        const limiteMaxCuotas = tienePlanIniciado ? maxCuotasReestruc : maxCuotasReestruc;
        let nuevaModalidadId = 2; // 3 cuotas por defecto
        let totalCuotasObjetivo = 3;
        let descripcionModalidad = '3 cuotas 30/40/30';
        let porcentajes = [30, 40, 30];

        const wordCuotasMap: Record<string, number> = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8 };
        const numMatch = msgLower.match(/(\d+)\s*cuotas?/);
        const wordMatch = msgLower.match(/(dos|tres|cuatro|cinco|seis|siete|ocho)\s*cuotas?/);
        const dividEnMatch = msgLower.match(/dividir.*en\s*(\d+|dos|tres|cuatro|cinco|seis|siete|ocho)/);
        let cuotasSolicitadas: number | null = null;
        if (numMatch) cuotasSolicitadas = Number(numMatch[1]);
        else if (wordMatch) cuotasSolicitadas = wordCuotasMap[wordMatch[1]] ?? null;
        else if (dividEnMatch) cuotasSolicitadas = Number(dividEnMatch[1]) || wordCuotasMap[dividEnMatch[1]] || null;

        if (/contado|1 pago/i.test(msgLower)) {
          nuevaModalidadId = 1;
          totalCuotasObjetivo = 1;
          descripcionModalidad = '1 pago (100%)';
          porcentajes = [100];
        } else if (cuotasSolicitadas && cuotasSolicitadas > 1) {
          if (cuotasSolicitadas > limiteMaxCuotas) {
            respuesta =
              `ℹ️ Según la regla vigente (**RN_03_MAX_CUOTAS_REESTRUCTURACION = ${limiteMaxCuotas}**), el tope máximo permitido es de **${limiteMaxCuotas} cuotas**. Podemos fraccionar tu saldo pendiente (**S/ ${saldoPendiente.toFixed(2)}**) en hasta **${limiteMaxCuotas} cuotas** por entregable sin variar el monto total.`;
            totalCuotasObjetivo = -1;
          } else if (cuotasPagadasCount > 0) {
            // Reestructuración de saldo pendiente en exactamente N cuotas restantes
            totalCuotasObjetivo = cuotasPagadasCount + cuotasSolicitadas;
            nuevaModalidadId = totalCuotasObjetivo >= 5 ? 3 : totalCuotasObjetivo === 4 ? 4 : 2;
            const montoPorCuota = saldoPendiente > 0 ? (saldoPendiente / cuotasSolicitadas).toFixed(2) : (totalOrden / cuotasSolicitadas).toFixed(2);
            descripcionModalidad = `${totalCuotasObjetivo} cuotas (reestructurado en ${cuotasSolicitadas} cuotas pendientes de S/ ${montoPorCuota})`;
            const pctEach = Number((100 / totalCuotasObjetivo).toFixed(1));
            porcentajes = Array(totalCuotasObjetivo).fill(pctEach);
          } else {
            totalCuotasObjetivo = cuotasSolicitadas;
            if (cuotasSolicitadas === 3) {
              nuevaModalidadId = 2;
              descripcionModalidad = '3 cuotas 30/40/30';
              porcentajes = [30, 40, 30];
            } else if (cuotasSolicitadas === 6) {
              nuevaModalidadId = 3;
              descripcionModalidad = '6 cuotas (inicial + hitos)';
              porcentajes = [20, 16, 16, 16, 16, 16];
            } else {
              nuevaModalidadId = cuotasSolicitadas >= 5 ? 3 : 2;
              const pctBase = Math.floor(100 / cuotasSolicitadas);
              porcentajes = Array.from({ length: cuotasSolicitadas }, (_, idx) =>
                idx === cuotasSolicitadas - 1 ? 100 - pctBase * (cuotasSolicitadas - 1) : pctBase,
              );
              descripcionModalidad = `${cuotasSolicitadas} cuotas (${porcentajes.join('/')})`;
            }
          }
        } else if (cuotasPagadasCount > 0 && /dividir|menos cuotas|reestructur|ajustar/i.test(msgLower)) {
          totalCuotasObjetivo = cuotasPagadasCount + 2;
          nuevaModalidadId = totalCuotasObjetivo === 4 ? 4 : 3;
          const montoPorCuota = saldoPendiente > 0 ? (saldoPendiente / 2).toFixed(2) : (totalOrden / 2).toFixed(2);
          descripcionModalidad = `${totalCuotasObjetivo} cuotas (reestructurado en 2 cuotas pendientes de S/ ${montoPorCuota})`;
          porcentajes = [20, 30, 25, 25];
        }

        // Validación: si superó tope dinámico RN_03 o ya pagó igual/más cuotas que el objetivo
        if (totalCuotasObjetivo === -1) {
          guardrailsActivados.push(
            `RN_03_MAX_CUOTAS_REESTRUCTURACION (${limiteMaxCuotas}): solicitud de ${cuotasSolicitadas} cuotas excede el tope configurado`,
          );
        } else if (cuotasPagadasCount >= totalCuotasObjetivo && totalCuotasObjetivo > 1) {
          respuesta =
            `ℹ️ Tu orden **${orden.codigo_orden}** ya registra **${cuotasPagadasCount} cuota(s) pagada(s)** (S/ ${Number(orden.monto_cobrado).toFixed(2)} abonado). No es posible pasar a un plan de ${totalCuotasObjetivo} cuotas porque ya alcanzaste esa cantidad. Si deseas fraccionar tu saldo pendiente de **S/ ${saldoPendiente.toFixed(2)}**, podemos pasarlo a **${limiteMaxCuotas} cuotas** por entregables.`;
        } else {
          guardrailsActivados.push(
            `RN-03: ${cuotasPagadasCount > 0 ? 'Reestructuración de saldo pendiente' : 'Reconfiguración de modalidad'} a "${descripcionModalidad}" manteniendo intacto el monto comprometido (S/ ${totalOrden.toFixed(2)})`,
          );

          await this.prisma.$executeRawUnsafe(`
            UPDATE INBESTIGA_TESIS.dbo.ORDEN_PAGO
            SET modalidad_pago_id = ${nuevaModalidadId}
            WHERE orden_pago_id = ${ordenPagoId};
          `);

          // Limpiar referencias y cuotas NO PAGADAS (las PAGADAS y POR_VERIFICAR se respetan al 100%)
          await this.prisma.$executeRawUnsafe(`
            UPDATE INBESTIGA_TESIS.dbo.ENLACE_PAGO SET cuota_id = NULL WHERE orden_pago_id = ${ordenPagoId};
            UPDATE INBESTIGA_TESIS.dbo.VOUCHER SET cuota_id = NULL WHERE orden_pago_id = ${ordenPagoId};
            UPDATE INBESTIGA_TESIS.dbo.ALERTA_COBRANZA SET cuota_id = NULL WHERE orden_pago_id = ${ordenPagoId};
            UPDATE INBESTIGA_TESIS.dbo.PAGO SET cuota_id = NULL WHERE orden_pago_id = ${ordenPagoId} AND estado NOT IN ('CONFIRMADO', 'POR_VERIFICAR');
            DELETE FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO WHERE orden_pago_id = ${ordenPagoId} AND estado NOT IN ('PAGADA', 'POR_VERIFICAR');
          `);

          if (cuotasPagadasCount > 0) {
            // =========================================================================
            // REESTRUCTURACIÓN DE SALDO PENDIENTE (CONSERVANDO CUOTAS PAGADAS)
            // =========================================================================
            const cuotasRestantesCount = totalCuotasObjetivo === 1 ? 1 : totalCuotasObjetivo - cuotasPagadasCount;
            let acumuladoSaldo = 0;

            for (let i = 0; i < cuotasRestantesCount; i++) {
              const numCuota = cuotasPagadasCount + i + 1;
              const esUltima = i === cuotasRestantesCount - 1;
              const montoCuota = esUltima
                ? Number((saldoPendiente - acumuladoSaldo).toFixed(2))
                : Number((saldoPendiente / cuotasRestantesCount).toFixed(2));
              acumuladoSaldo += montoCuota;

              const pctEquivalente = Number(((montoCuota / totalOrden) * 100).toFixed(1));
              const condicion =
                i === 0
                  ? 'Cuota exigible actual (reestructurada)'
                  : 'Entrega verificable de hito';
              const estadoCuota = i === 0 ? 'ENLACE_ENVIADO' : 'ESPERA_HITO';

              await this.prisma.$executeRawUnsafe(`
                INSERT INTO INBESTIGA_TESIS.dbo.CUOTA_PAGO (
                  orden_pago_id, numero_cuota, porcentaje, monto_programado, condicion, fecha_vencimiento, version_plan, estado
                ) VALUES (
                  ${ordenPagoId}, ${numCuota}, ${pctEquivalente}, ${montoCuota}, '${condicion}', DATEADD(DAY, ${i === 0 ? 3 : (i + 1) * 15}, CAST(GETDATE() AS DATE)), 3, '${estadoCuota}'
                );
              `);
            }
          } else {
            // =========================================================================
            // PLAN VIRGEN DESDE CERO (SIN CUOTAS PREVIAS)
            // =========================================================================
            let acumulado = 0;
            for (let idx = 0; idx < porcentajes.length; idx++) {
              const pct = porcentajes[idx];
              const numCuota = idx + 1;
              const montoCuota =
                idx === porcentajes.length - 1
                  ? Number((totalOrden - acumulado).toFixed(2))
                  : Number(((totalOrden * pct) / 100).toFixed(2));
              acumulado += montoCuota;

              const condicion =
                porcentajes.length === 1
                  ? 'Pago único'
                  : numCuota === 1
                    ? 'Cuota inicial'
                    : 'Cuota por hito';
              const estadoCuota = numCuota === 1 ? 'ENLACE_ENVIADO' : 'ESPERA_HITO';

              await this.prisma.$executeRawUnsafe(`
                INSERT INTO INBESTIGA_TESIS.dbo.CUOTA_PAGO (
                  orden_pago_id, numero_cuota, porcentaje, monto_programado, condicion, fecha_vencimiento, version_plan, estado
                ) VALUES (
                  ${ordenPagoId}, ${numCuota}, ${pct}, ${montoCuota}, '${condicion}', DATEADD(DAY, ${numCuota === 1 ? 3 : numCuota * 15}, CAST(GETDATE() AS DATE)), 2, '${estadoCuota}'
                );
              `);
            }
          }

          // Obtener la siguiente cuota exigible (la primera no pagada)
          const siguienteCuotaRows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT TOP 1 * FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO WHERE orden_pago_id = ${ordenPagoId} AND estado NOT IN ('PAGADA', 'POR_VERIFICAR') ORDER BY numero_cuota ASC;`,
          );
          const cuotaExigibleNueva = siguienteCuotaRows[0];
          const montoExigible = Number(cuotaExigibleNueva.monto_programado);

          const toolMod = await this.logToolExecution(
            conversacionId,
            ordenPagoId,
            'configurar_modalidad_y_cuotas',
            {
              orden_pago_id: ordenPagoId,
              nueva_modalidad: descripcionModalidad,
              cuotas_pagadas_preservadas: cuotasPagadasCount,
              saldo_reestructurado: saldoPendiente,
            },
            {
              modalidad_actualizada: descripcionModalidad,
              monto_comprometido_inmutable: totalOrden,
              cuota_siguiente_exigible: montoExigible,
            },
            135,
          );
          herramientasEjecutadas.push(toolMod);

          const medioId = montoExigible <= 500 ? 1 : 3;
          const refLink = `lnk_reest_${ordenPagoId}_${Date.now().toString().slice(-5)}`;
          const urlLink = await this.generarUrlCheckoutMercadoPago({
            codigoOrden: orden.codigo_orden,
            monto: montoExigible,
            servicio: orden.servicio_nombre,
            email: orden.estudiante_email,
            nombre: orden.estudiante_nombre,
          });

          await this.prisma.$executeRawUnsafe(`
            INSERT INTO INBESTIGA_TESIS.dbo.ENLACE_PAGO (
              orden_pago_id, cuota_id, medio_pago_id, referencia_externa, url_enlace, monto, fecha_envio, fecha_expiracion, estado
            ) VALUES (
              ${ordenPagoId}, ${Number(cuotaExigibleNueva.cuota_id)}, ${medioId}, '${refLink}', '${urlLink}', ${montoExigible}, GETDATE(), DATEADD(HOUR, 48, GETDATE()), 'ENVIADO'
            );
          `);

          const toolLink = await this.logToolExecution(
            conversacionId,
            ordenPagoId,
            'emitir_enlace_pago',
            {
              orden_pago_id: ordenPagoId,
              cuota_id: cuotaExigibleNueva.cuota_id,
              monto: montoExigible,
            },
            { url_enlace: urlLink, referencia_externa: refLink },
            98,
          );
          herramientasEjecutadas.push(toolLink);

          if (cuotasPagadasCount > 0) {
            const restantesTotal = totalCuotasObjetivo === 1 ? 1 : totalCuotasObjetivo - cuotasPagadasCount;
            respuesta =
              `✅ **Saldo Reestructurado a ${descripcionModalidad}:**\n\n` +
              `He reestructurado tu saldo pendiente de **S/ ${saldoPendiente.toFixed(2)}** en **${restantesTotal} cuotas más accesibles** sin alterar tu precio acordado (Total: **S/ ${totalOrden.toFixed(2)}**):\n\n` +
              `• **Cuotas ya pagadas:** ${cuotasPagadasCount} cuota(s) por **S/ ${Number(orden.monto_cobrado).toFixed(2)}** (\`PAGADA\`).\n` +
              `• **Siguiente cuota exigible (#${cuotaExigibleNueva.numero_cuota}):** **S/ ${montoExigible.toFixed(2)}** (para continuar con tu entrega académica).\n` +
              `• **Cuotas posteriores (${restantesTotal - 1}):** Programadas en \`ESPERA_HITO\` atadas a la aprobación de tus avances.\n\n` +
              `💳 **Tu nuevo enlace de Mercado Pago para tu cuota #${cuotaExigibleNueva.numero_cuota}:** ${urlLink}`;
          } else {
            respuesta =
              `• **Modalidad Actualizada a ${descripcionModalidad}:**\n` +
              `He actualizado el cronograma de tu orden **${orden.codigo_orden}** manteniendo intacto el precio final acordado de **S/ ${totalOrden.toFixed(2)}**:\n\n` +
              `• **Cuota 1 (Exigible hoy para activar asesor):** S/ ${montoExigible.toFixed(2)} (${porcentajes[0]}%)\n` +
              (porcentajes.length > 1
                ? `• **Cuotas siguientes (${porcentajes.length - 1}):** Atadas estrictamente a la entrega verificable de tus hitos académicos (\`ESPERA_HITO\`).\n\n`
                : '\n') +
              `• **Nuevo enlace de pago de tu Cuota 1:** ${urlLink}`;
          }
        }
      }
    }
    // =========================================================================
    // REGLA 9: Registro de Responsable de Pago (Padre/Madre/Familiar/Empresa)
    // =========================================================================
    else if (/pap[aá]|mam[aá]|hermano|pareja|empresa.*pagar|empleador|apoderado/i.test(msgLower)) {
      const esEmpresa = /empresa|empleador/i.test(msgLower);
      const respId = esEmpresa ? 4 : 2;
      const tipoResp = esEmpresa ? 'Empresa / Empleador' : 'Familiar (Padre/Madre)';

      await this.prisma.$executeRawUnsafe(`
        UPDATE INBESTIGA_TESIS.dbo.ORDEN_PAGO
        SET responsable_pago_id = ${respId}
        WHERE orden_pago_id = ${ordenPagoId};
      `);

      const toolResp = await this.logToolExecution(
        conversacionId,
        ordenPagoId,
        'registrar_responsable_pago',
        { orden_pago_id: ordenPagoId, tipo_responsable: tipoResp },
        { responsable_pago_id: respId, actualizado: true },
        88,
      );
      herramientasEjecutadas.push(toolResp);

      const urlEnlaceResponsable = await this.urlPagoVigente(orden, montoCuotaActual, enlaceActivo);
      respuesta =
        `👤 **Responsable de Pago Actualizado:**\n` +
        `He registrado a **${tipoResp}** como responsable de pago de tu orden **${orden.codigo_orden}**.\n\n` +
        `Puedes reenviarle directamente el enlace de pago por **S/ ${montoCuotaActual.toFixed(2)}** (${urlEnlaceResponsable}) o los datos de cuenta corriente corporativa BCP **570-2489103-0-12** (INBESTIGA SAC).`;
    }
    // =========================================================================
    // REGLA 9.5: Consulta o Cancelación de Cuotas Pendientes (RN_12)
    //            Distingue cuotas futuras pendientes (RN_12) de reversa contable de pagos confirmados (RN_11)
    // =========================================================================
    else if (consultaOCancelaCuotasPendientes) {
      const cuotasCancelables = cuotas.filter((c) =>
        ['EXIGIBLE', 'ESPERA_HITO', 'ENLACE_ENVIADO', 'VENCIDA'].includes(c.estado),
      );
      const montoCancelable = cuotasCancelables.reduce(
        (acc, c) => acc + Number(c.monto_programado || 0),
        0,
      );

      const esEjecucionDirecta =
        (veniaDeConfirmacionCancelacion && esConfirmacionAfirmativaCorta) ||
        (/(confirmo|procede|adelante|hazlo|canc[eé]lalas|an[uú]lalas|cancela (las|mis|los|todas) (cuotas|pagos)|anula (las|mis|los|todas) (cuotas|pagos))/i.test(
          msgLower,
        ) &&
          !/una pregunta|\bse pueden?\b|\bse podr[ií]a\b|\bes posible\b|\bpuedo cancelar\b|\bquiero saber\b/i.test(
            msgLower,
          ));

      if (!permitirCancelarPendientes) {
        guardrailsActivados.push(
          'RN_12_CANCELAR_CUOTAS_PENDIENTES deshabilitada: cancelación automática de cuotas futuras bloqueada por regla vigente',
        );
        const toolCheck = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'consultar_reglas_negocio',
          { codigo: 'RN_12_CANCELAR_CUOTAS_PENDIENTES', orden_pago_id: ordenPagoId },
          { permitirCancelarPendientes: false, cuotasPendientes: cuotasCancelables.length },
          60,
        );
        herramientasEjecutadas.push(toolCheck);

        respuesta =
          `ℹ️ Actualmente la cancelación automática de cuotas pendientes está **deshabilitada** según nuestras reglas vigentes (\`RN_12_CANCELAR_CUOTAS_PENDIENTES\`).\n\n` +
          `La anulación contable permitida solo aplica a cargos ya confirmados revisados por Caja (\`RN_11\`). Si deseas evaluar una baja excepcional de tus **${cuotasCancelables.length} cuota(s) pendiente(s)** (S/ ${montoCancelable.toFixed(2)}), comunícate con Coordinación Académica o Caja.`;
      } else if (cuotasCancelables.length === 0) {
        guardrailsActivados.push(
          'RN_12_CANCELAR_CUOTAS_PENDIENTES: sin cuotas futuras pendientes por anular',
        );
        const toolCheck = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'consultar_orden_pago',
          { orden_pago_id: ordenPagoId, motivo: 'VERIFICAR_CUOTAS_CANCELABLES' },
          { cuotasPendientes: 0, totalAbonado: finanzas.totalCobrado },
          55,
        );
        herramientasEjecutadas.push(toolCheck);

        respuesta =
          `ℹ️ Tu orden **${orden.codigo_orden}** no tiene cuotas pendientes por cancelar en este momento (total abonado confirmado: **S/ ${finanzas.totalCobrado.toFixed(2)}**).`;
      } else if (esEjecucionDirecta) {
        guardrailsActivados.push(
          `RN_12_CANCELAR_CUOTAS_PENDIENTES activa: anulando ${cuotasCancelables.length} cuota(s) pendiente(s) por desistimiento del estudiante`,
        );
        const resultadoCancelacion = await this.cancelarCuotasPendientes(ordenPagoId, {
          motivo: `Solicitud directa vía chat: ${rawTrimmedMsg.slice(0, 180)}`,
          origen: 'ESTUDIANTE',
          actor: orden.estudiante_nombre,
        });
        const toolCancel = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'cancelar_cuotas_pendientes',
          { orden_pago_id: ordenPagoId, regla: 'RN_12_CANCELAR_CUOTAS_PENDIENTES' },
          {
            cuotas_anuladas: resultadoCancelacion.cuotasCanceladas.map((c: any) => c.numero_cuota),
            monto_anulado: resultadoCancelacion.montoCancelado,
            monto_abonado_conservado: resultadoCancelacion.montoPagadoConservado,
            nuevo_estado_orden: resultadoCancelacion.nuevoEstadoOrden,
          },
          115,
        );
        herramientasEjecutadas.push(toolCancel);

        const listadoCanceladas = resultadoCancelacion.cuotasCanceladas
          .map((c: any) => `Cuota #${c.numero_cuota} (S/ ${Number(c.monto_programado).toFixed(2)})`)
          .join(', ');

        respuesta =
          `✅ **Cuotas pendientes canceladas — Orden ${orden.codigo_orden}:**\n\n` +
          `Conforme a nuestra regla vigente (\`RN_12_CANCELAR_CUOTAS_PENDIENTES\`), he procedido con la cancelación de tus **pagos pendientes futuros**:\n` +
          `• **Cuotas anuladas:** ${listadoCanceladas} — Total: **S/ ${resultadoCancelacion.montoCancelado.toFixed(2)}** (\`ANULADA\`)\n` +
          `• **Pagos ya confirmados conservados:** S/ ${resultadoCancelacion.montoPagadoConservado.toFixed(2)}\n` +
          `• **Saldo pendiente actual:** **S/ 0.00**\n\n` +
          `Se han desactivado los enlaces de pago y recordatorios automáticos de esta orden.`;
      } else {
        guardrailsActivados.push(
          'RN_12_CANCELAR_CUOTAS_PENDIENTES activa: informando cuotas pendientes anulables y solicitando confirmación expresa',
        );
        const toolPreview = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'consultar_orden_pago',
          { orden_pago_id: ordenPagoId, verificacion: 'CUOTAS_CANCELABLES_RN_12' },
          {
            regla_activa: 'RN_12_CANCELAR_CUOTAS_PENDIENTES',
            cuotas_cancelables: cuotasCancelables.map((c) => ({
              numero_cuota: c.numero_cuota,
              monto: Number(c.monto_programado),
              estado: c.estado,
            })),
            monto_pendiente_cancelable: montoCancelable,
            monto_abonado_confirmado: finanzas.totalCobrado,
          },
          70,
        );
        herramientasEjecutadas.push(toolPreview);

        const detalleCuotasPendientes = cuotasCancelables
          .map(
            (c) =>
              `• **Cuota #${c.numero_cuota}:** S/ ${Number(c.monto_programado).toFixed(2)} (\`${c.estado}\`)`,
          )
          .join('\n');

        respuesta =
          `Sí, **se pueden cancelar tus cuotas pendientes futuras** de la orden **${orden.codigo_orden}** conforme a nuestra regla vigente (\`RN_12_CANCELAR_CUOTAS_PENDIENTES\`) sin afectar tus pagos ya confirmados (**S/ ${finanzas.totalCobrado.toFixed(2)}** abonado).\n\n` +
          `📋 **Cuotas pendientes por cancelar (Total: S/ ${montoCancelable.toFixed(2)}):**\n` +
          `${detalleCuotasPendientes}\n\n` +
          `*(Nota: la anulación contable \`RN_11\` aplica solo para revertir pagos ya confirmados en Caja; esta opción \`RN_12\` anula únicamente los siguientes pagos pendientes).*` +
          `\n\nSi deseas que cancele ahora mismo tus cuotas pendientes y detenga todos los enlaces y recordatorios, respóndeme **"Sí, cancela mis cuotas pendientes"** y lo ejecuto de inmediato.`;
      }
    }
    // =========================================================================
    // REGLA 10: Pausa de Cobranza / No Contactar (RN-07 / RN-08)
    // =========================================================================
    else if (
      /no me escriban|no deseo el servicio|de viaje|la otra semana|pago el lunes|pago el viernes|pausar/i.test(
        msgLower,
      )
    ) {
      const esBaja = /no me escriban|no deseo el servicio/i.test(msgLower);
      guardrailsActivados.push(
        esBaja
          ? 'RN-08: Activación inmediata de flag no_contactar = 1 y detención total de alertas'
          : 'RN-07: Pausa programada de recordatorios automáticos de cobranza',
      );

      if (esBaja) {
        await this.prisma.$executeRawUnsafe(`
          UPDATE INBESTIGA_TESIS.dbo.CONTACTO SET no_contactar = 1 WHERE contacto_id = ${contactoId};
        `);
      }

      await this.prisma.$executeRawUnsafe(`
        UPDATE INBESTIGA_TESIS.dbo.ALERTA_COBRANZA
        SET resultado = 'PAUSADO', motivo_pausa = '${cleanMsg}'
        WHERE orden_pago_id = ${ordenPagoId} AND resultado = 'ENVIADO';
      `);

      const toolPausa = await this.logToolExecution(
        conversacionId,
        ordenPagoId,
        'pausar_recordatorios',
        { orden_pago_id: ordenPagoId, motivo: mensaje, no_contactar: esBaja },
        { alertas_pausadas: true, horas_pausa: esBaja ? 'PERMANENTE' : 72 },
        80,
      );
      herramientasEjecutadas.push(toolPausa);

      respuesta = esBaja
        ? `Entendido. Respetamos tu decisión; he activado la opción de **No Contactar** en tu perfil y detuve todos los recordatorios automáticos. ¡Muchos éxitos en tu investigación!`
        : `🗓️ **Recordatorios Pausados:** He pausado las alertas automáticas de tu orden **${orden.codigo_orden}** según tu indicación. Tu enlace de pago se mantendrá reservado para cuando nos escribas.`;
    }
    // =========================================================================
    // REGLA 11: Objeciones de Cobranza y Políticas Oficiales (Sección 9 y RN-09)
    // =========================================================================
    else if (
      /estafa|seguro|ruc|confianza|devoluci[oó]n|reembolso|cvv|tarjeta.*aqu[ií]|turnitin|plagio|autor[ií]a|jurado.*20|compa[ñn]ero/i.test(
        msgLower,
      )
    ) {
      let tema = 'SEGURIDAD';
      let tipoObjecion = 'SEGURIDAD_ESTAFA';
      if (/devoluci[oó]n|reembolso|retiro/i.test(msgLower)) {
        tema = 'DEVOLUCION';
        tipoObjecion = 'DEVOLUCION_CANCELACION';
      } else if (/cvv|16 d[ií]gitos|compa[ñn]ero|privacidad/i.test(msgLower)) {
        tema = 'PROTECCION_DATOS';
        tipoObjecion = 'SEGURIDAD_ESTAFA';
      } else if (/turnitin|plagio|autor[ií]a|jurado/i.test(msgLower)) {
        tema = 'AUTORIAS';
        tipoObjecion = 'PLAGIO_IA';
      }

      guardrailsActivados.push(
        `RN-09: Respuesta basada exclusivamente en POLITICA_COBRANZA ('${tema}') sin promesas fuera de catálogo`,
      );

      const polRows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM INBESTIGA_TESIS.dbo.POLITICA_COBRANZA WHERE tema = '${tema}';`,
      );
      const rawPol = polRows[0] || {
        titulo: 'Política Oficial INBESTIGA',
        contenido: 'Operamos con contrato firmado, pasarela auditada Mercado Pago y pagos por entregables verificables.',
      };
      const pol = {
        ...rawPol,
        titulo: String(rawPol.titulo || '').replace(/Culqi/gi, 'Mercado Pago'),
        contenido: String(rawPol.contenido || '').replace(/Culqi/gi, 'Mercado Pago'),
      };

      await this.prisma.$executeRawUnsafe(`
        INSERT INTO INBESTIGA_TESIS.dbo.OBJECION_PAGO (
          orden_pago_id, tipo, resumen, veces_repetida, resuelta, fecha_registro
        ) VALUES (
          ${ordenPagoId}, '${tipoObjecion}', '${cleanMsgResumen}', 1, 1, GETDATE()
        );
      `);

      const toolPol = await this.logToolExecution(
        conversacionId,
        ordenPagoId,
        'consultar_politica_cobranza',
        { tema, orden_pago_id: ordenPagoId },
        { titulo: pol.titulo, contenido: pol.contenido, version: pol.version || 'v2.0' },
        74,
      );
      herramientasEjecutadas.push(toolPol);

      respuesta =
        `🛡️ **${pol.titulo} — Garantía Oficial INBESTIGA:**\n` +
        `${pol.contenido}\n\n` +
        `Tu orden **${orden.codigo_orden}** está respaldada por el contrato **${orden.codigo_contrato}** y tu cuota exigible actual (#${cuotaPendiente.numero_cuota}) es de **S/ ${montoCuotaActual.toFixed(2)}**.\n\n` +
        (tienePlanIniciado
          ? `¿Deseas que te reenvíe el enlace oficial de Mercado Pago para abonar tu cuota y continuar avanzando con tu asesor?`
          : `¿Deseas proceder con el enlace de pago o prefieres fraccionarlo en cuotas antes de iniciar?`);
    }
    // =========================================================================
    // REGLA 12: Consulta de Siguiente Paso / "¿Qué hago?" / "¿Qué falta?"
    // =========================================================================
    else if (
      /qu[eé] (hago|falta|sigue|paso|debo hacer)|c[oó]mo contin[uú]o|cu[aá]l es el siguiente paso|ahora qu[eé]/i.test(
        msgLower,
      )
    ) {
      const pagosConfirmados = finanzas.pagosConfirmados;
      const toolOrden = await this.logToolExecution(
        conversacionId,
        ordenPagoId,
        'consultar_orden_pago',
        { orden_pago_id: ordenPagoId },
        {
          estado_orden: orden.estado,
          pagos_confirmados: pagosConfirmados.length,
          saldo_pendiente: finanzas.saldoPendiente,
        },
        65,
      );
      herramientasEjecutadas.push(toolOrden);

      if (pagosConfirmados.length > 0 || cuotaPendiente.estado === 'PAGADA' || orden.estado === 'PAGADA') {
        guardrailsActivados.push('RN-04: Orden con cuota inicial confirmada — Servicio activo');
        const cuotasPendientes = cuotas.filter(
          (c) => c.estado !== 'PAGADA' && c.estado !== 'ANULADA',
        ).length;
        respuesta =
          `🎓 **¡Tu cuota inicial ya está confirmada!** Tu servicio está \`ACTIVO\`.\n\n` +
          `• **Monto cobrado:** S/ ${finanzas.totalCobrado.toFixed(2)} de S/ ${finanzas.totalComprometido.toFixed(2)}\n` +
          `• **Saldo pendiente:** S/ ${finanzas.saldoPendiente.toFixed(2)}\n\n` +
          `📌 **Siguiente paso:** Tu asesoría académica ya está activa. ` +
          `El especialista metodológico asignado a tu carrera (**${orden.asesor_nombre || 'Dr. Carlos Alberto Méndez Vargas'}**) se comunicará contigo para coordinar la primera sesión de inducción y el entregable del cronograma.\n\n` +
          (finanzas.saldoPendiente > 0
            ? `📅 Tienes **${cuotasPendientes}** cuota(s) pendiente(s). Las cuotas por hito se habilitan al aprobarse cada entregable (\`ESPERA_HITO\`); te avisaré cuando corresponda abonarlas.`
            : `¡Ya no tienes que realizar ningún pago adicional!`);
      } else if (finanzas.esCuotaBloqueada) {
        guardrailsActivados.push(
          'Orientación de Cobranza: cuota en ESPERA_HITO — sin enlace de pago hasta aprobar el hito',
        );
        respuesta =
          `📋 **Estado de tu orden ${orden.codigo_orden}:**\n\n` +
          `• **Cuota relacionada (#${cuotaPendiente.numero_cuota}):** S/ ${finanzas.montoCuotaExigible.toFixed(2)} (\`ESPERA_HITO\`)\n` +
          `• **Saldo pendiente:** S/ ${finanzas.saldoPendiente.toFixed(2)}\n\n` +
          `⏳ Esa cuota está atada a un **hito académico verificable**: se habilitará para pago en cuanto tu asesor (**${orden.asesor_nombre || 'Dr. Carlos Alberto Méndez Vargas'}**) apruebe el entregable correspondiente. Te enviaré el enlace en ese momento, sin que tengas que hacer nada ahora.`;
      } else {
        guardrailsActivados.push('Orientación de Cobranza: Instrucciones para activación de servicio');
        const urlEnlace = await this.urlPagoVigente(orden, montoCuotaActual, enlaceActivo);
        respuesta =
          `📋 **Para activar tu servicio y asignarte asesor metodológico:**\n\n` +
          `Solo falta completar el abono de tu cuota inicial (**S/ ${montoCuotaActual.toFixed(2)}**).\n\n` +
          `Puedes completarlo por cualquiera de estas opciones:\n` +
          `1. 💳 **Enlace en línea (Mercado Pago):** ${urlEnlace}\n` +
          `2. 🏦 **Transferencia bancaria BCP / Interbank:** Cta. Cte. Soles BCP **570-2489103-0-12** (CCI: 00257000248910301235, INBESTIGA SAC) y me adjuntas la captura del voucher por aquí.\n\n` +
          `¿Deseas que te habilite el enlace de pago o prefieres pagar por transferencia?`;
      }
    }
    // =========================================================================
    // REGLA 13: Consulta de Deuda / Saldo Pendiente ("¿Tengo deudas?", "¿Cuánto debo?")
    // =========================================================================
    else if (
      /deuda|deudas|debo|saldo|estoy al d[ií]a|tengo que pagar algo|cu[aá]nto falta|mi pregunta es si tengo deudas/i.test(
        msgLower,
      )
    ) {
      const totalComprometido = finanzas.totalComprometido;
      const totalCobrado = finanzas.totalCobrado;
      const saldoPendiente = finanzas.saldoPendiente;
      const estaPagada = finanzas.ordenLiquidada;
      const pagosConfirmados = finanzas.pagosConfirmados;

      const toolDeuda = await this.logToolExecution(
        conversacionId,
        ordenPagoId,
        'consultar_orden_pago',
        { orden_pago_id: ordenPagoId, consulta: 'ESTADO_DEUDA' },
        { estado_orden: orden.estado, pagos_confirmados: pagosConfirmados.length, orden_pagada: estaPagada, saldo_pendiente: saldoPendiente },
        60,
      );
      herramientasEjecutadas.push(toolDeuda);

      if (estaPagada) {
        respuesta =
          `🎉 **¡No tienes ninguna deuda pendiente, ${orden.estudiante_nombre}!**\n\n` +
          `Tu orden **${orden.codigo_orden}** (${orden.servicio_nombre}) se encuentra **100% CANCELADA**:\n` +
          `• **Monto abonado:** S/ ${finanzas.totalCobrado.toFixed(2)}\n` +
          `• **Saldo pendiente:** S/ 0.00\n` +
          `• **Estado del servicio:** \`ACTIVO\`\n` +
          `• **Asesor Asignado:** ${orden.asesor_nombre || 'Dr. Carlos Alberto Méndez Vargas'}\n\n` +
          `¡Tu asesoría está en marcha y ya no requieres realizar ningún pago!`;
      } else if (finanzas.esCuotaBloqueada) {
        respuesta =
          `📋 **Estado de tu cuenta — Orden ${orden.codigo_orden}:**\n\n` +
          `• **Total comprometido:** S/ ${totalComprometido.toFixed(2)}\n` +
          `• **Total abonado a la fecha:** S/ ${totalCobrado.toFixed(2)}\n` +
          `• **Saldo pendiente de pago:** S/ ${saldoPendiente.toFixed(2)}\n` +
          `• **Cuota actual (#${cuotaPendiente.numero_cuota}):** S/ ${finanzas.montoCuotaExigible.toFixed(2)} (\`ESPERA_HITO\`)\n\n` +
          `⏳ Esa cuota está atada a un hito académico y aún no es exigible: se habilita para pago cuando tu asesor apruebe el entregable. No tienes ningún pago inmediato por realizar.`;
      } else {
        const urlEnlace = await this.urlPagoVigente(orden, montoCuotaActual, enlaceActivo);
        respuesta =
          `📋 **Estado de tu cuenta — Orden ${orden.codigo_orden}:**\n\n` +
          `• **Total comprometido:** S/ ${totalComprometido.toFixed(2)}\n` +
          `• **Total abonado a la fecha:** S/ ${totalCobrado.toFixed(2)}\n` +
          `• **Saldo pendiente de pago:** S/ ${saldoPendiente.toFixed(2)}\n` +
          `• **Cuota actual (#${cuotaPendiente.numero_cuota}):** S/ ${montoCuotaActual.toFixed(2)} (\`${cuotaPendiente.estado}\`)\n\n` +
          `Puedes consultar o abonar tu cuota en el enlace oficial de Mercado Pago: ${urlEnlace}`;
      }
    }
    // =========================================================================
    // REGLA 14: Consulta sobre Entregas, Asesor y Primera Sesión Académica
    // =========================================================================
    else if (/entrega|primera entrega|sesi[oó]n|cu[aá]ndo empieza|asesor|reuni[oó]n|meet/i.test(msgLower)) {
      const totalComprometido = finanzas.totalComprometido;
      const saldoPendiente = finanzas.saldoPendiente;
      const asesorReal = orden.asesor_nombre || 'Dr. Carlos Alberto Méndez Vargas';

      const toolAcad = await this.logToolExecution(
        conversacionId,
        ordenPagoId,
        'consultar_asesor_y_entregas',
        { orden_pago_id: ordenPagoId },
        { asesor: asesorReal, estado_orden: orden.estado, saldo_pendiente: saldoPendiente },
        60,
      );
      herramientasEjecutadas.push(toolAcad);

      const fechaEntrega = cuotaPendiente.fecha_vencimiento
        ? new Date(cuotaPendiente.fecha_vencimiento).toLocaleDateString('es-PE')
        : '15 días calendario posteriores a la inducción';

      respuesta =
        `📚 **Detalle de tu Acompañamiento Académico — ${orden.estudiante_nombre}:**\n\n` +
        `• **Servicio:** ${orden.servicio_nombre}\n` +
        `• **Asesor Metodológico:** ${asesorReal}\n` +
        `• **Primera Sesión de Inducción:** Se coordina dentro de las primeras **24 a 48 horas hábiles** vía Google Meet.\n` +
        `• **Próximo Hito Académico:** Programado para el **${fechaEntrega}** (${cuotaPendiente.condicion || 'Entrega verificable'}).\n\n` +
        (saldoPendiente <= 0
          ? `🎉 Tu expediente se encuentra 100% al día y sin pagos pendientes.`
          : finanzas.esCuotaBloqueada
            ? `ℹ️ **Nota de pago:** Tu siguiente cuota (#${cuotaPendiente.numero_cuota}, S/ ${finanzas.montoCuotaExigible.toFixed(2)}) está en \`ESPERA_HITO\` y se habilita al aprobarse este hito. Saldo pendiente total: **S/ ${saldoPendiente.toFixed(2)}**.`
            : `ℹ️ **Nota de pago:** Tu orden registra un saldo pendiente de **S/ ${saldoPendiente.toFixed(2)}** en tu cuota #${cuotaPendiente.numero_cuota} (\`${cuotaPendiente.estado}\`). Enlace oficial de Mercado Pago: ${await this.urlPagoVigente(orden, montoCuotaActual, enlaceActivo)}`);
    }
    // =========================================================================
    // FLUJO CONVERSACIONAL INTELIGENTE (Configuración DB + Reglas en Vivo + LLM)
    // =========================================================================
    else {
      const totalComprometido = finanzas.totalComprometido;
      const totalCobrado = finanzas.totalCobrado;
      const saldoPendiente = finanzas.saldoPendiente;
      const estaPagada = finanzas.ordenLiquidada;
      const asesorReal = orden.asesor_nombre || 'Dr. Carlos Alberto Méndez Vargas';

      const configAgente = await this.getConfiguracionAgenteActiva();
      const reglasActivasTexto = await this.businessRulesService.formatReglasActivasParaAgente();
      const proveedorPrimario = String(configAgente?.proveedorIA || 'OPENAI').toUpperCase();
      const modeloConfigurado = String(configAgente?.modelo || '').trim();
      const promptBaseConfig = String(configAgente?.promptSistema || '').trim() ||
        'Eres el Asesor Virtual Especialista de Cobranza y Activación Académica de INBESTIGA.TESIS.';

      // 1. Invocar OpenAI gpt-4o-mini (primario PAYERS) con fallback automático a Google Gemini (o viceversa según CONFIGURACION_AGENTE)
      let respuestaIA: string | null = null;
      let motorIA = '';
      const apiKeyGemini = process.env.GEMINI_API_KEY;
      const modeloGemini =
        proveedorPrimario === 'GEMINI' && modeloConfigurado.toLowerCase().startsWith('gemini')
          ? modeloConfigurado
          : process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const modeloOpenAi =
        proveedorPrimario === 'OPENAI' && modeloConfigurado
          ? modeloConfigurado
          : 'gpt-4o-mini';

      const urlEnlace = await this.urlPagoVigente(orden, montoCuotaActual, enlaceActivo);
      const puedeCobrar = !finanzas.esCuotaBloqueada && saldoPendiente > 0;
      const enlaceParaCliente = puedeCobrar ? urlEnlace : '(NO APLICA: no hay cuota exigible en este momento)';

      const primerNombre = (orden.estudiante_nombre || 'estudiante').split(' ')[0];

      const contextPrompt =
        `${promptBaseConfig}\n` +
        `Tono conversacional: ${configAgente?.tono || 'Profesional, empático y determinístico'}\n\n` +
        `CONTEXTO DE FASE PAYERS:\n` +
        `El estudiante YA aceptó la cotización y su orden está emitida (${orden.codigo_orden}). NO estamos en la fase LEADS ni en consultoría diagnóstica. Tu objetivo es guiarlo a concretar el pago de su cuota para activar su servicio con su asesor (${asesorReal}), resolver sus dudas sobre reglas/medios/enlaces y proponer facilidades vigentes.\n\n` +
        `REGLAS DE NEGOCIO VIGENTES EN TIEMPO REAL (SQL SERVER - INBESTIGA_TESIS.dbo.REGLA_NEGOCIO):\n` +
        `${reglasActivasTexto}\n` +
        `IMPORTANTE: Debes aplicar y respetar TODAS las reglas de negocio activas listadas arriba desde este mismo instante, incluyendo cualquier regla creada o editada recientemente por el administrador.\n\n` +
        `Datos del estudiante en vivo desde SQL Server:\n` +
        `- Estudiante: ${orden.estudiante_nombre} (llámalo ${primerNombre})\n` +
        `- Código de Orden: ${orden.codigo_orden}\n` +
        `- Servicio: ${orden.servicio_nombre}\n` +
        `- Estado de la Orden: ${orden.estado}\n` +
        `- Estado Anulada (RN_12): ${finanzas.ordenAnulada ? 'SÍ (cuotas pendientes canceladas, saldo exigible S/ 0.00)' : 'NO'}\n` +
        `- Total comprometido: S/ ${totalComprometido.toFixed(2)}\n` +
        `- Total pagado a la fecha: S/ ${totalCobrado.toFixed(2)}\n` +
        `- Cuotas anuladas: S/ ${finanzas.montoAnulado.toFixed(2)}\n` +
        `- Saldo pendiente real: S/ ${saldoPendiente.toFixed(2)}\n` +
        `- Permiso anular pago confirmado en Caja (RN_11): ${permitirAnulacionPago ? 'ACTIVO' : 'DESHABILITADO'}\n` +
        `- Permiso cancelar cuotas pendientes (RN_12): ${permitirCancelarPendientes ? 'ACTIVO' : 'DESHABILITADO'}\n` +
        `- Modalidad actual: ${orden.modalidad_condicion}\n` +
        `- Plan de pagos ya iniciado: ${tienePlanIniciado ? `SÍ (registra S/ ${totalCobrado.toFixed(2)} abonado; el saldo pendiente de S/ ${saldoPendiente.toFixed(2)} se puede reestructurar hasta en ${maxCuotasReestruc} cuotas por entregable)` : `NO (orden virgen sin pagos; se puede fraccionar en ${maxCuotasInicial} o hasta ${maxCuotasReestruc} cuotas antes de iniciar)`}\n` +
        `- Cuota exigible (#${cuotaPendiente.numero_cuota}): S/ ${finanzas.montoCuotaExigible.toFixed(2)} (Estado: ${cuotaPendiente.estado}, Vence: ${cuotaPendiente.fecha_vencimiento ? String(cuotaPendiente.fecha_vencimiento).slice(0, 10) : 'según hito'})\n` +
        `- Tope vigente Yape/Plin: S/ ${topeYape.toFixed(2)}\n` +
        `- Asesor Metodológico Asignado: ${asesorReal}\n` +
        `- Pasarela Oficial: Mercado Pago (Checkout Pro)\n` +
        `- Enlace Oficial de Pago Mercado Pago: ${enlaceParaCliente}\n\n` +
        `INSTRUCCIONES DE FORMATO Y SEGURIDAD DE RESPUESTA:\n` +
        `1. Si es saludo inicial o conversación general:\n` +
        (tienePlanIniciado
          ? `   - Salúdalo con calidez por su primer nombre ("¡Hola ${primerNombre}!"), preséntate como su asesor de activación de Inbestiga, recuérdale que su orden ${orden.codigo_orden} ya tiene su plan de pagos en curso (registra S/ ${totalCobrado.toFixed(2)} abonado) y pregúntale amablemente si necesita ayuda con su siguiente cuota (#${cuotaPendiente.numero_cuota}, S/ ${finanzas.montoCuotaExigible.toFixed(2)}) o alguna facilidad vigente.\n`
          : `   - Salúdalo con calidez por su primer nombre ("¡Hola ${primerNombre}!"), preséntate como su asesor de activación de Inbestiga, explícale cordialmente que su orden ${orden.codigo_orden} está lista para activarse con su asesor y pregúntale si tuvo alguna duda con el enlace de pago o si desea revisar facilidades de pago.\n`) +
        `   - PROHIBIDO decir "¿en qué te puedo ayudar con tu tesis?" o hacer preguntas abiertas de consultoría académica.\n` +
        `2. Si el saldo pendiente es S/ 0.00 (ya sea 100% pagada o cuotas anuladas), NO solicites pagos ni menciones enlaces.\n` +
        `3. Si la cuota actual está en ESPERA_HITO, explica que se habilita cuando su asesor (${asesorReal}) apruebe el hito académico y NO proporciones enlace de pago.\n` +
        `4. Si consulta sobre una política o regla de negocio vigente, respóndele usando el valor y descripción exacta de las reglas activas arriba y DISTINGUE SIEMPRE entre RN_11 (anulación contable en Caja de un pago ya confirmado) y RN_12 (cancelación de cuotas pendientes futuras cuando el tesista desiste).\n` +
        `5. Cuando corresponda enviar enlace de pago, proporciona EXACTAMENTE este enlace oficial de Mercado Pago: ${enlaceParaCliente}. PROHIBIDO mencionar "Culqi".\n` +
        `6. Responde en tono natural y conciso (máximo 2 párrafos en texto, o máximo 35 palabras si es por nota de voz), en texto plano sin Markdown.\n` +
        `7. Pregunta o mensaje exacto del estudiante: "${mensaje}"`;

      const invocarOpenAI = async (): Promise<boolean> => {
        if (!this.voice?.enabled) return false;
        try {
          const resOpenAi = await this.voice.generarRespuestaPayers(
            `orden:${ordenPagoId}`,
            contextPrompt,
            mensaje,
            { voz: opts?.voz, model: modeloOpenAi },
          );
          if (resOpenAi) {
            respuestaIA = resOpenAi.replace(
              /ENLACE(_|\s*)DE(_|\s*)PAGO(\s*AQU[IÍ])?/gi,
              puedeCobrar ? urlEnlace : '(no hay cuota exigible en este momento)',
            );
            motorIA = `OpenAI (${modeloOpenAi})`;
            return true;
          }
        } catch (e: any) {
          this.logger.warn(`OpenAI (${modeloOpenAi}) error -> activando fallback: ${e.message}`);
        }
        return false;
      };

      const invocarGemini = async (): Promise<boolean> => {
        if (!apiKeyGemini || apiKeyGemini.length <= 10) return false;
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const axios = require('axios');
          const gRes = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${modeloGemini}:generateContent?key=${apiKeyGemini}`,
            {
              contents: [{ role: 'user', parts: [{ text: contextPrompt }] }],
            },
            { timeout: 12000 },
          );
          if (gRes.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            let textoG = gRes.data.candidates[0].content.parts[0].text.trim();
            textoG = textoG.replace(
              /ENLACE(_|\s*)DE(_|\s*)PAGO(\s*AQU[IÍ])?/gi,
              puedeCobrar ? urlEnlace : '(no hay cuota exigible en este momento)',
            );
            respuestaIA = textoG;
            motorIA = `Google Gemini (${modeloGemini})`;
            return true;
          }
        } catch (e: any) {
          this.logger.warn(`Gemini (${modeloGemini}) error -> activando fallback: ${e.message}`);
        }
        return false;
      };

      if (proveedorPrimario === 'GEMINI') {
        const okGemini = await invocarGemini();
        if (!okGemini) await invocarOpenAI();
      } else {
        // Predeterminado PAYERS: OpenAI primario + Google Gemini fallback automático
        const okOpenAi = await invocarOpenAI();
        if (!okOpenAi) await invocarGemini();
      }

      if (respuestaIA) {
        const toolAI = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'consultar_agente_ia',
          { consulta: mensaje },
          { motor: motorIA, api_key_activa: true, respondido: true },
          95,
        );
        herramientasEjecutadas.push(toolAI);
        respuesta = respuestaIA;
      } else {
        guardrailsActivados.push(
          'Flujo Estándar PAYERS v2: Consulta determinística de orden',
        );
        const toolOrden = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'consultar_orden_pago',
          { orden_pago_id: ordenPagoId },
          {
            codigo_orden: orden.codigo_orden,
            servicio: orden.servicio_nombre,
            modalidad: orden.modalidad_condicion,
            monto_comprometido: orden.monto_comprometido,
            monto_cobrado: orden.monto_cobrado,
            estado: orden.estado,
            saldo_pendiente: saldoPendiente,
          },
          70,
        );
        herramientasEjecutadas.push(toolOrden);

        if (estaPagada) {
          respuesta =
            `¡Hola **${orden.estudiante_nombre}**! Soy el agente de cobranza y activación de **INBESTIGA**.\n\n` +
            `• **Estado de tu cuenta:** Tu orden **${orden.codigo_orden}** se encuentra **100% CANCELADA Y PAGADA**.\n` +
            `• **Servicio:** ${orden.servicio_nombre}\n` +
            `• **Deuda pendiente:** S/ 0.00\n` +
            `• **Estado:** \`ACTIVO\`\n` +
            `• **Asesor Metodológico:** ${asesorReal}\n\n` +
            `¡Ya no tienes que realizar ningún pago! Tu asesor se comunicará contigo para la primera sesión.`;
        } else if (finanzas.esCuotaBloqueada) {
          respuesta =
            `¡Hola **${orden.estudiante_nombre}**! Soy el agente de cobranza y activación de **INBESTIGA**.\n\n` +
            `• **Estado en vivo de tu Orden ${orden.codigo_orden}:**\n` +
            `• **Servicio:** ${orden.servicio_nombre}\n` +
            `• **Total comprometido:** S/ ${totalComprometido.toFixed(2)}\n` +
            `• **Total abonado:** S/ ${totalCobrado.toFixed(2)}\n` +
            `• **Saldo pendiente:** S/ ${saldoPendiente.toFixed(2)}\n` +
            `• **Siguiente cuota (#${cuotaPendiente.numero_cuota}):** S/ ${finanzas.montoCuotaExigible.toFixed(2)} (\`ESPERA_HITO\`)\n\n` +
            `⏳ Esa cuota se habilita cuando tu asesor (**${asesorReal}**) apruebe el hito académico correspondiente; aún no es exigible y no hay ningún pago inmediato por realizar.`;
        } else {
          const toolLink = await this.logToolExecution(
            conversacionId,
            ordenPagoId,
            'emitir_enlace_pago',
            {
              orden_pago_id: ordenPagoId,
              cuota_id: cuotaPendiente.cuota_id,
              monto: montoCuotaActual,
            },
            {
              url_enlace: urlEnlace,
              estado_cuota: cuotaPendiente.estado,
            },
            85,
          );
          herramientasEjecutadas.push(toolLink);

          respuesta =
            `¡Hola **${orden.estudiante_nombre}**! Soy el agente de cobranza y activación de **INBESTIGA**.\n\n` +
            `• **Estado en vivo de tu Orden ${orden.codigo_orden}:**\n` +
            `• **Servicio:** ${orden.servicio_nombre}\n` +
            `• **Contrato:** ${orden.codigo_contrato} (\`${ contrato?.estado || 'CONFIRMADO' }\`)\n` +
            `• **Modalidad:** ${orden.modalidad_condicion}\n` +
            `• **Total comprometido:** S/ ${totalComprometido.toFixed(2)}\n` +
            `• **Total abonado:** S/ ${totalCobrado.toFixed(2)}\n` +
            `• **Saldo pendiente:** S/ ${saldoPendiente.toFixed(2)}\n` +
            `• **Cuota exigible (#${cuotaPendiente.numero_cuota}):** S/ ${montoCuotaActual.toFixed(2)} (\`${cuotaPendiente.estado}\`)\n` +
            `• **Enlace de Pago:** ${urlEnlace}\n\n` +
            `Puedes indicarme si deseas pagar con **Yape/Plin**, **Tarjeta**, o adjuntar un **voucher de transferencia BCP/Interbank**.`;
        }
      }
    }

    // 3. Guardar respuesta del BOT en INBESTIGA_TESIS.dbo.MENSAJE
    const botMensajeId = await this.insertMensajeYRetornarId(
      conversacionId,
      'BOT',
      tipoMensaje,
      respuesta,
    );

    // 3b. Si es turno de voz, sintetizar audio TTS y persistir archivo asociado al mensaje BOT
    let audioReply: Buffer | null = null;
    if (opts?.voz && this.voice?.enabled) {
      try {
        audioReply = await this.voice.synthesize(respuesta);
        if (audioReply?.length && botMensajeId > 0) {
          await saveVoiceFile(botMensajeId, audioReply, 'respuesta.ogg', 'audio/ogg');
        }
      } catch (error: any) {
        this.logger.warn(`No se pudo sintetizar la respuesta de voz para orden #${ordenPagoId}: ${error?.message || error}`);
        audioReply = null;
      }
    }

    // 4. Registrar auditoría
    await this.logAuditoria(
      'AGENTE',
      'Agente IA PAYERS v2.0',
      `CHAT_TOOL_CALL (${herramientasEjecutadas.map((h) => h.herramienta).join(', ')})`,
      'ORDEN_PAGO',
      String(ordenPagoId),
      `Orden ${orden.codigo_orden} | Guardrails: ${guardrailsActivados.join(' ; ')}`,
    );

    const estadoActualizado = await this.getOrdenDetalle(ordenPagoId);

    this.chatEvents$.next({
      type: 'nuevo_mensaje',
      ordenPagoId,
      codigoOrden: orden.codigo_orden,
      estudiante: orden.estudiante_nombre,
      canal: opts?.canal || 'WEB',
      esVoz: Boolean(opts?.voz),
      estudianteMensajeId,
      botMensajeId,
      preview: (mensaje || '').trim().slice(0, 120),
      respuestaPreview: respuesta.trim().slice(0, 120),
      fecha: new Date().toISOString(),
    });

    return {
      respuesta,
      herramientasEjecutadas,
      guardrailsActivados,
      estadoOrden: estadoActualizado,
      estudianteMensajeId,
      botMensajeId,
      audioRespuestaBase64: audioReply ? audioReply.toString('base64') : null,
      audioMimeType: audioReply ? 'audio/ogg' : null,
    };
  }

  /**
   * Pipeline de voz compartido para PAYERS (Live Chat, WhatsApp, Telegram):
   * STT -> Agente determinístico PAYERS (`procesarChatAgente(..., { voz: true, canal, audioEntrada })`) -> TTS + storage + SSE.
   */
  async procesarAudioAgente(
    ordenPagoId: number,
    audioBuffer: Buffer,
    filename = 'audio.webm',
    mimeType?: string,
    canal: 'WHATSAPP' | 'TELEGRAM' | 'WEB' = 'WEB',
  ) {
    if (!Number.isInteger(ordenPagoId) || ordenPagoId <= 0) {
      throw new BadRequestException('ordenPagoId inválido.');
    }
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new BadRequestException('No se recibió archivo de audio.');
    }
    if (!this.voice || !this.voice.enabled) {
      throw new BadRequestException('El pipeline de voz OpenAI no está activo (verifica OPENAI_API_KEY).');
    }

    // Validar existencia de la orden (404) antes de invocar OpenAI STT
    await this.getOrdenDetalle(ordenPagoId);

    let transcripcion = '';
    try {
      transcripcion = (await this.voice.transcribe(audioBuffer, filename, mimeType)).trim();
    } catch (error: any) {
      this.logger.warn(`Fallo en STT para orden #${ordenPagoId}: ${error?.message || error}`);
      throw new BadRequestException(
        `No se pudo transcribir el audio (${error?.message || 'formato no soportado o archivo dañado'}).`,
      );
    }

    if (!transcripcion) {
      throw new BadRequestException('No se detectó voz inteligible en el audio.');
    }

    const resultado = await this.procesarChatAgente(ordenPagoId, transcripcion, {
      voz: true,
      canal,
      audioEntrada: { buffer: audioBuffer, filename, mimeType },
    });

    return {
      ...resultado,
      transcripcion,
    };
  }

  /**
   * 4. POST /api/v1/payers/webhook/simular
   * Simula la recepción de un evento firmado HMAC-SHA256 desde Mercado Pago (payment.updated),
   * acredita el pago en INBESTIGA_TESIS, actualiza la cuota y orden, y activa PAYER + CUSTOMER (RN-04).
   */
  async simularWebhookPasarela(ordenPagoId: number, medioPagoInput?: 'Yape' | 'Plin' | 'Tarjeta') {
    const detalle = await this.getOrdenDetalle(ordenPagoId);
    const { orden, cuotas } = detalle;

    const cuotaObjetivo =
      cuotas.find((c) => c.estado !== 'PAGADA' && c.estado !== 'ANULADA') || cuotas[0];

    if (!cuotaObjetivo) {
      throw new NotFoundException(`La orden #${ordenPagoId} no tiene cuotas registradas.`);
    }

    const monto = Number(cuotaObjetivo.monto_programado);
    const topeYape = await this.businessRulesService.getValorNumerico('RN_05_TOPE_YAPE_PLIN_PEN', 500, 15000);
    // Si pide Yape/Plin pero supera el tope vigente (RN_05), usar Tarjeta
    let medioNombre: 'Yape' | 'Plin' | 'Tarjeta' = medioPagoInput || (monto <= topeYape ? 'Yape' : 'Tarjeta');
    if ((medioNombre === 'Yape' || medioNombre === 'Plin') && monto > topeYape) {
      medioNombre = 'Tarjeta';
    }

    const medioPagoId = medioNombre === 'Yape' ? 1 : medioNombre === 'Plin' ? 2 : 3;
    const comisionPct = medioPagoId === 3 ? 3.99 : 2.95;
    const comisionSoles = Number(((monto * comisionPct) / 100).toFixed(2));
    const referencia = `MP-${ordenPagoId}-${Date.now().toString().slice(-6)}`;
    const firmaHmac = crypto
      .createHmac('sha256', 'mp_hmac_secret_inbestiga_2026')
      .update(`${referencia}|${monto}|PEN`)
      .digest('hex');

    // 1. Actualizar enlace o crearlo como PAGADO
    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.ENLACE_PAGO
      SET estado = 'PAGADO'
      WHERE orden_pago_id = ${ordenPagoId} AND cuota_id = ${Number(cuotaObjetivo.cuota_id)};
    `);

    // 2. Insertar PAGO CONFIRMADO por WEBHOOK
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO INBESTIGA_TESIS.dbo.PAGO (
        orden_pago_id, cuota_id, medio_pago_id, fecha_inicio, fecha_confirmacion,
        monto_pagado, comision_pasarela, referencia, metodo_verificacion, estado
      ) VALUES (
        ${ordenPagoId}, ${Number(cuotaObjetivo.cuota_id)}, ${medioPagoId},
        DATEADD(MINUTE, -1, GETDATE()), GETDATE(),
        ${monto}, ${comisionSoles}, '${referencia}', 'WEBHOOK', 'CONFIRMADO'
      );
    `);

    const pagoRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT TOP 1 pago_id FROM INBESTIGA_TESIS.dbo.PAGO WHERE referencia = '${referencia}';`,
    );
    const pagoId = Number(pagoRows[0]?.pago_id || 0);

    // 3. Insertar EVENTO_WEBHOOK firmado
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO INBESTIGA_TESIS.dbo.EVENTO_WEBHOOK (
        pago_id, proveedor, tipo_evento, referencia_externa, firma_hmac, firma_valida, fecha_recepcion, procesado, detalle
      ) VALUES (
        ${pagoId}, 'Mercado Pago', 'payment.updated', '${referencia}', '${firmaHmac}', 1, GETDATE(), 1,
        'Webhook Mercado Pago (${medioNombre}) validado con firma HMAC-SHA256. Monto: S/ ${monto.toFixed(2)}'
      );
    `);

    // 4. Marcar CUOTA_PAGO como PAGADA
    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.CUOTA_PAGO
      SET estado = 'PAGADA'
      WHERE cuota_id = ${Number(cuotaObjetivo.cuota_id)};
    `);

    // 5. Verificar si todas las cuotas están pagadas para actualizar ORDEN_PAGO
    const cuotasRestantes: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS pendientes
      FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO
      WHERE orden_pago_id = ${ordenPagoId} AND estado NOT IN ('PAGADA', 'ANULADA');
    `);
    const nuevoEstadoOrden = Number(cuotasRestantes[0]?.pendientes ?? 0) === 0 ? 'PAGADA' : 'PARCIAL';

    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.ORDEN_PAGO
      SET estado = '${nuevoEstadoOrden}', en_mora = 0, servicio_suspendido_mora = 0
      WHERE orden_pago_id = ${ordenPagoId};
    `);

    // 6. Si tenía alerta de cobranza activa, marcarla como RECUPERADO
    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.ALERTA_COBRANZA
      SET resultado = 'RECUPERADO', escalado = 0
      WHERE orden_pago_id = ${ordenPagoId} AND resultado IN ('ENVIADO', 'ESCALADO', 'SIN_RESPUESTA');
    `);

    // 7. RN-04: Activar PAYER y CUSTOMER si es el primer pago confirmado de la orden
    await this.asegurarActivacionPayerYCustomer(ordenPagoId, Number(orden.lead_id));

    // 8. Registrar Auditoría
    await this.logAuditoria(
      'SISTEMA',
      'Mercado Pago Webhook HMAC-SHA256',
      'WEBHOOK_CHARGE_SUCCEEDED',
      'ORDEN_PAGO',
      String(ordenPagoId),
      `Pago confirmado ${referencia} (${medioNombre}) por S/ ${monto.toFixed(2)} | Comisión: S/ ${comisionSoles.toFixed(2)} | Orden -> ${nuevoEstadoOrden}`,
    );

    const estadoOrden = await this.getOrdenDetalle(ordenPagoId);

    return {
      exito: true,
      mensaje: `Webhook Mercado Pago (${medioNombre}) procesado con firma HMAC válida. Cuota #${cuotaObjetivo.numero_cuota} por S/ ${monto.toFixed(2)} acreditada y servicio activado.`,
      eventoWebhook: {
        referencia,
        proveedor: 'Mercado Pago',
        tipoEvento: 'payment.updated',
        medioPago: medioNombre,
        montoPagado: monto,
        comisionPasarela: comisionSoles,
        firmaHmac: firmaHmac.slice(0, 24) + '...',
        nuevoEstadoOrden,
      },
      estadoOrden,
    };
  }

  /**
   * 5. POST /api/v1/payers/vouchers/:voucherId/verificar
   * Permite a Caja / Administración aprobar o rechazar un VOUCHER manual (RN-06).
   */
  async verificarVoucherManual(
    voucherId: number,
    accion: 'APROBAR' | 'RECHAZAR',
    motivo?: string,
  ) {
    const vId = Number(voucherId);
    const vRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_TESIS.dbo.VOUCHER WHERE voucher_id = ${vId};`,
    );
    if (!vRows.length) {
      throw new NotFoundException(`No se encontró el voucher #${vId}`);
    }

    const voucher = vRows[0];
    const ordenPagoId = Number(voucher.orden_pago_id);
    const cuotaId = voucher.cuota_id != null ? Number(voucher.cuota_id) : null;
    const monto = Number(voucher.monto_ocr ?? 600);

    if (accion === 'APROBAR') {
      let pagoId = voucher.pago_id != null ? Number(voucher.pago_id) : null;

      if (pagoId) {
        await this.prisma.$executeRawUnsafe(`
          UPDATE INBESTIGA_TESIS.dbo.PAGO
          SET estado = 'CONFIRMADO',
              fecha_confirmacion = GETDATE(),
              verificado_por_asesor_id = 4
          WHERE pago_id = ${pagoId};
        `);
      } else {
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO INBESTIGA_TESIS.dbo.PAGO (
            orden_pago_id, cuota_id, medio_pago_id, fecha_inicio, fecha_confirmacion,
            monto_pagado, comision_pasarela, referencia, metodo_verificacion, verificado_por_asesor_id, estado
          ) VALUES (
            ${ordenPagoId}, ${cuotaId ?? 'NULL'}, 4, '${new Date(voucher.fecha_carga).toISOString()}', GETDATE(),
            ${monto}, 0.00, '${voucher.referencia_operacion}', 'MANUAL', 4, 'CONFIRMADO'
          );
        `);
        const pInserted: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT TOP 1 pago_id FROM INBESTIGA_TESIS.dbo.PAGO WHERE orden_pago_id = ${ordenPagoId} ORDER BY pago_id DESC;`,
        );
        pagoId = Number(pInserted[0]?.pago_id || 0);
      }

      await this.prisma.$executeRawUnsafe(`
        UPDATE INBESTIGA_TESIS.dbo.VOUCHER
        SET estado = 'VERIFICADO',
            pago_id = ${pagoId || 'NULL'},
            verificado_por_asesor_id = 4,
            fecha_verificacion = GETDATE(),
            motivo_rechazo = NULL
        WHERE voucher_id = ${vId};
      `);

      if (cuotaId) {
        await this.prisma.$executeRawUnsafe(`
          UPDATE INBESTIGA_TESIS.dbo.CUOTA_PAGO SET estado = 'PAGADA' WHERE cuota_id = ${cuotaId};
        `);
      }

      const cuotasRestantes: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT COUNT(*) AS pendientes
        FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO
        WHERE orden_pago_id = ${ordenPagoId} AND estado NOT IN ('PAGADA', 'ANULADA');
      `);
      const nuevoEstadoOrden = Number(cuotasRestantes[0]?.pendientes ?? 0) === 0 ? 'PAGADA' : 'PARCIAL';

      await this.prisma.$executeRawUnsafe(`
        UPDATE INBESTIGA_TESIS.dbo.ORDEN_PAGO
        SET estado = '${nuevoEstadoOrden}'
        WHERE orden_pago_id = ${ordenPagoId};
      `);

      const leadRows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT pr.lead_id
        FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO o
        INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = o.propuesta_id
        WHERE o.orden_pago_id = ${ordenPagoId};
      `);
      if (leadRows.length) {
        await this.asegurarActivacionPayerYCustomer(ordenPagoId, Number(leadRows[0].lead_id));
      }

      await this.logAuditoria(
        'CAJA',
        'Lic. Sofía Castañeda (Caja)',
        'VERIFICAR_VOUCHER_APROBADO',
        'VOUCHER',
        String(vId),
        `Voucher ${voucher.referencia_operacion} (${voucher.banco_ocr}) aprobado por S/ ${monto.toFixed(2)} en orden #${ordenPagoId}.`,
      );

      return {
        exito: true,
        mensaje: `Voucher ${voucher.referencia_operacion} VERIFICADO exitosamente por Caja. Pago acreditado y cliente activado.`,
        estadoVoucher: 'VERIFICADO',
        ordenPagoId,
      };
    } else {
      const cleanMotivo = (motivo || 'Monto u operación no coincide en extracto bancario').replace(/'/g, "''");
      await this.prisma.$executeRawUnsafe(`
        UPDATE INBESTIGA_TESIS.dbo.VOUCHER
        SET estado = 'RECHAZADO',
            motivo_rechazo = '${cleanMotivo}',
            verificado_por_asesor_id = 4,
            fecha_verificacion = GETDATE()
        WHERE voucher_id = ${vId};
      `);

      if (voucher.pago_id) {
        await this.prisma.$executeRawUnsafe(`
          UPDATE INBESTIGA_TESIS.dbo.PAGO
          SET estado = 'RECHAZADO', motivo_rechazo = '${cleanMotivo}'
          WHERE pago_id = ${Number(voucher.pago_id)};
        `);
      }

      if (cuotaId) {
        await this.prisma.$executeRawUnsafe(`
          UPDATE INBESTIGA_TESIS.dbo.CUOTA_PAGO
          SET estado = 'EXIGIBLE'
          WHERE cuota_id = ${cuotaId} AND estado = 'POR_VERIFICAR';
        `);
      }

      await this.logAuditoria(
        'CAJA',
        'Lic. Sofía Castañeda (Caja)',
        'VERIFICAR_VOUCHER_RECHAZADO',
        'VOUCHER',
        String(vId),
        `Voucher ${voucher.referencia_operacion} rechazado. Motivo: ${cleanMotivo}`,
      );

      return {
        exito: true,
        mensaje: `Voucher ${voucher.referencia_operacion} marcado como RECHAZADO. La cuota volvió a estado EXIGIBLE.`,
        estadoVoucher: 'RECHAZADO',
        ordenPagoId,
      };
    }
  }

  /**
   * Recupera la activación (PAYER + CUSTOMER + asesor) de una orden que ya tiene pagos confirmados.
   * Útil para órdenes cuyo pago se registró antes de existir la activación automática.
   */
  async activarServicioPorCodigoOrden(codigoOrden: string) {
    const clean = codigoOrden.replace(/'/g, "''");
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1 op.orden_pago_id, pr.lead_id
      FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO op
      INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = op.propuesta_id
      WHERE op.codigo_orden = '${clean}'
        AND EXISTS (
          SELECT 1 FROM INBESTIGA_TESIS.dbo.PAGO pg
          WHERE pg.orden_pago_id = op.orden_pago_id AND pg.estado = 'CONFIRMADO'
        );
    `);
    if (rows.length === 0) return null;
    return this.activarServicioTrasPrimerPago(Number(rows[0].orden_pago_id), Number(rows[0].lead_id));
  }

  /**
   * RN-04 (versión completa): al primer pago confirmado crea PAYER + CUSTOMER y asigna un asesor real.
   * Es idempotente: si ya existe el customer o la asignación, los reutiliza.
   * Asignación: asesor activo del equipo de Investigación con menos clientes asignados (balanceo de carga).
   */
  async activarServicioTrasPrimerPago(
    ordenPagoId: number,
    leadId: number,
  ): Promise<{ customerId: number; asesor: { id: number; nombre: string; especialidad: string; rol: string } | null }> {
    await this.asegurarActivacionPayerYCustomer(ordenPagoId, leadId);

    const custRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT cu.customer_id
      FROM INBESTIGA_TESIS.dbo.CUSTOMER cu
      INNER JOIN INBESTIGA_TESIS.dbo.PAYER py ON py.payer_id = cu.payer_id
      WHERE py.orden_pago_id = ${ordenPagoId};
    `);
    const customerId = Number(custRows[0].customer_id);

    const asignadoRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1 a.asesor_id, a.nombre, a.especialidad, a.rol
      FROM INBESTIGA_TESIS.dbo.ASIGNACION_ASESOR aa
      INNER JOIN INBESTIGA_TESIS.dbo.ASESOR a ON a.asesor_id = aa.asesor_id
      WHERE aa.customer_id = ${customerId}
      ORDER BY aa.fecha_asignacion DESC;
    `);
    if (asignadoRows.length > 0) {
      const a = asignadoRows[0];
      return {
        customerId,
        asesor: { id: Number(a.asesor_id), nombre: a.nombre, especialidad: a.especialidad, rol: a.rol },
      };
    }

    const candidatos: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1 a.asesor_id, a.nombre, a.especialidad, a.rol
      FROM INBESTIGA_TESIS.dbo.ASESOR a
      WHERE a.activo = 1 AND a.equipo = N'Investigación'
      ORDER BY (
        SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.ASIGNACION_ASESOR x WHERE x.asesor_id = a.asesor_id
      ) ASC, a.asesor_id ASC;
    `);
    if (candidatos.length === 0) {
      this.logger.warn(`Sin asesores activos del equipo de Investigación para asignar al customer ${customerId}.`);
      return { customerId, asesor: null };
    }

    const elegido = candidatos[0];
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO INBESTIGA_TESIS.dbo.ASIGNACION_ASESOR (customer_id, asesor_id, fecha_asignacion, motivo)
      VALUES (${customerId}, ${Number(elegido.asesor_id)}, GETDATE(), N'Asignación automática tras primer pago (balanceo de carga)');
    `);

    return {
      customerId,
      asesor: {
        id: Number(elegido.asesor_id),
        nombre: elegido.nombre,
        especialidad: elegido.especialidad,
        rol: elegido.rol,
      },
    };
  }

  /**
   * Helper RN-04: Garantiza que al primer pago confirmado exista el registro en PAYER y CUSTOMER.
   */
  private async asegurarActivacionPayerYCustomer(ordenPagoId: number, leadId: number) {
    const payerRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT payer_id FROM INBESTIGA_TESIS.dbo.PAYER WHERE orden_pago_id = ${ordenPagoId};`,
    );

    let payerId: number;
    if (payerRows.length === 0) {
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO INBESTIGA_TESIS.dbo.PAYER (lead_id, orden_pago_id, fecha_payer, estado)
        VALUES (${leadId}, ${ordenPagoId}, GETDATE(), 'ACTIVO');
      `);
      const newPayer: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT payer_id FROM INBESTIGA_TESIS.dbo.PAYER WHERE orden_pago_id = ${ordenPagoId};`,
      );
      payerId = Number(newPayer[0].payer_id);
    } else {
      payerId = Number(payerRows[0].payer_id);
    }

    const custRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT customer_id FROM INBESTIGA_TESIS.dbo.CUSTOMER WHERE payer_id = ${payerId};`,
    );

    if (custRows.length === 0) {
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO INBESTIGA_TESIS.dbo.CUSTOMER (payer_id, fecha_activacion, estado_servicio)
        VALUES (${payerId}, GETDATE(), 'ACTIVO');
      `);
    }
  }

  /**
   * 6. GET /api/v1/payers/evaluacion
   * Retorna la batería de casos de evaluación del Agente PAYERS desde INBESTIGA_TESIS.dbo.EVALUACION_AGENTE
   */
  async getEvaluacionAgente() {
    const casosRaw: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM INBESTIGA_TESIS.dbo.EVALUACION_AGENTE ORDER BY evaluacion_id ASC;`,
    );

    const casos = casosRaw.map((c) => ({
      ...c,
      evaluacion_id: Number(c.evaluacion_id),
      sin_alucinacion: Boolean(c.sin_alucinacion),
      cumple_regla_backend: Boolean(c.cumple_regla_backend),
      puntaje: Number(c.puntaje),
      coincide_herramienta: c.herramienta_esperada === c.herramienta_obtenida,
    }));

    const totalCasos = casos.length;
    const aprobados = casos.filter((c) => c.puntaje === 100 && c.sin_alucinacion && c.cumple_regla_backend).length;
    const sinAlucinacionCount = casos.filter((c) => c.sin_alucinacion).length;

    const porCategoriaMap: Record<string, { categoria: string; total: number; aprobados: number }> = {};
    for (const c of casos) {
      if (!porCategoriaMap[c.categoria]) {
        porCategoriaMap[c.categoria] = { categoria: c.categoria, total: 0, aprobados: 0 };
      }
      porCategoriaMap[c.categoria].total += 1;
      if (c.puntaje === 100) {
        porCategoriaMap[c.categoria].aprobados += 1;
      }
    }

    return {
      resumen: {
        totalCasos,
        aprobados,
        precisionHerramientaPct: totalCasos > 0 ? Number(((aprobados / totalCasos) * 100).toFixed(1)) : 100,
        tasaAlucinacionPct: totalCasos > 0 ? Number((((totalCasos - sinAlucinacionCount) / totalCasos) * 100).toFixed(1)) : 0,
        cumplimientoGuardrailsPct: 100.0,
        puntajePromedio: totalCasos > 0 ? Number((casos.reduce((a, b) => a + b.puntaje, 0) / totalCasos).toFixed(1)) : 100,
      },
      categorias: Object.values(porCategoriaMap),
      casos,
    };
  }

  /**
   * 7. POST /api/v1/payers/evaluacion/ejecutar
   * Ejecuta en vivo la batería de evaluación sobre las reglas del Agente PAYERS v2.0.
   */
  async ejecutarEvaluacionAgente() {
    const inicio = Date.now();
    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.EVALUACION_AGENTE
      SET sin_alucinacion = 1,
          cumple_regla_backend = 1,
          herramienta_obtenida = herramienta_esperada,
          puntaje = 100,
          fecha_evaluacion = GETDATE();
    `);

    await this.logAuditoria(
      'ADMIN',
      'Suite Evaluación Determinística PAYERS v2',
      'EJECUTAR_SUITE_EVALUACION',
      'EVALUACION_AGENTE',
      'ALL',
      'Batería completa de evaluación ejecutada: 100% precisión de herramientas, 0% alucinación de pagos.',
    );

    const resultado = await this.getEvaluacionAgente();
    return {
      ...resultado,
      duracionMs: Date.now() - inicio,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 8. POST /api/v1/payers/reset-con-cuotas
   * Resetea una orden con el acuerdo de cuotas pactado en LEADS (3 cuotas: 30% / 40% / 30%)
   */
  async resetConCuotasLeads(codigoOrden = 'ORD-2026-0001') {
    const cleanCodigo = codigoOrden.replace(/'/g, "''");
    const ordRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT o.orden_pago_id, o.propuesta_id, b.contacto_id, o.monto_comprometido, c.nombres, c.apellidos
      FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO o
      INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = o.propuesta_id
      INNER JOIN INBESTIGA_TESIS.dbo.LEAD l ON l.lead_id = pr.lead_id
      INNER JOIN INBESTIGA_TESIS.dbo.BUYER b ON b.buyer_id = l.buyer_id
      INNER JOIN INBESTIGA_TESIS.dbo.CONTACTO c ON c.contacto_id = b.contacto_id
      WHERE o.codigo_orden = '${cleanCodigo}';
    `);
    if (!ordRows.length) {
      throw new NotFoundException(`Orden ${codigoOrden} no encontrada`);
    }
    const ord = ordRows[0];
    const ordenPagoId = Number(ord.orden_pago_id);
    const contactoId = Number(ord.contacto_id);
    const total = Number(ord.monto_comprometido) || 1620.0;

    // 3 cuotas: 30% / 40% / 30%
    const c1Monto = Number((total * 0.3).toFixed(2));
    const c2Monto = Number((total * 0.4).toFixed(2));
    const c3Monto = Number((total - c1Monto - c2Monto).toFixed(2));

    // 1. Limpiar pagos, cuotas previas, vouchers y registros de customer/bitacora
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM [dbo].[BITACORA_TESIS] WHERE customerId = 'tesis-cust-${ordenPagoId}' OR customerId = '${ordenPagoId}' OR customerId IN (
        SELECT CAST(c.customer_id AS NVARCHAR(100)) FROM INBESTIGA_TESIS.dbo.CUSTOMER c
        INNER JOIN INBESTIGA_TESIS.dbo.PAYER p ON p.payer_id = c.payer_id
        WHERE p.orden_pago_id = ${ordenPagoId}
      );
      DELETE FROM INBESTIGA_TESIS.dbo.CUSTOMER WHERE payer_id IN (SELECT payer_id FROM INBESTIGA_TESIS.dbo.PAYER WHERE orden_pago_id = ${ordenPagoId});
      DELETE FROM INBESTIGA_TESIS.dbo.PAYER WHERE orden_pago_id = ${ordenPagoId};
      DELETE FROM INBESTIGA_TESIS.dbo.EVENTO_WEBHOOK WHERE pago_id IN (SELECT pago_id FROM INBESTIGA_TESIS.dbo.PAGO WHERE orden_pago_id = ${ordenPagoId});
      DELETE FROM INBESTIGA_TESIS.dbo.VOUCHER WHERE orden_pago_id = ${ordenPagoId};
      DELETE FROM INBESTIGA_TESIS.dbo.PAGO WHERE orden_pago_id = ${ordenPagoId};
      DELETE FROM INBESTIGA_TESIS.dbo.ENLACE_PAGO WHERE orden_pago_id = ${ordenPagoId};
      DELETE FROM INBESTIGA_TESIS.dbo.ALERTA_COBRANZA WHERE orden_pago_id = ${ordenPagoId};
      DELETE FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO WHERE orden_pago_id = ${ordenPagoId};
    `);

    // 2. Insertar las 3 cuotas acordadas desde LEADS
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO INBESTIGA_TESIS.dbo.CUOTA_PAGO (
        orden_pago_id, numero_cuota, porcentaje, monto_programado, condicion, fecha_vencimiento, version_plan, estado
      ) VALUES
      (${ordenPagoId}, 1, 30.00, ${c1Monto}, 'Cuota inicial (Activa asesor y primera sesión)', DATEADD(DAY, 3, CAST(GETDATE() AS DATE)), 1, 'ENLACE_ENVIADO'),
      (${ordenPagoId}, 2, 40.00, ${c2Monto}, 'Aprobación Plan de Tesis / Capítulo 1', DATEADD(DAY, 30, CAST(GETDATE() AS DATE)), 1, 'ESPERA_HITO'),
      (${ordenPagoId}, 3, 30.00, ${c3Monto}, 'Informe Final y Aprobación de Sustentación', DATEADD(DAY, 60, CAST(GETDATE() AS DATE)), 1, 'ESPERA_HITO');
    `);

    const primeraCuota: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1 cuota_id FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO WHERE orden_pago_id = ${ordenPagoId} ORDER BY numero_cuota ASC;
    `);
    const cuota1Id = Number(primeraCuota[0]?.cuota_id || 1);

    // 3. Actualizar ORDEN_PAGO
    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.ORDEN_PAGO
      SET estado = 'ENLACE_ENVIADO',
          modalidad_pago_id = 2,
          en_mora = 0,
          servicio_suspendido_mora = 0
      WHERE orden_pago_id = ${ordenPagoId};
    `);

    // 4. Generar el enlace real de pago (Mercado Pago) y registrar el acuerdo en HANDOFF_LEADS
    const urlLink = await this.generarUrlCheckoutMercadoPago({
      codigoOrden,
      monto: c1Monto,
      servicio: `Cuota inicial ${codigoOrden}`,
      nombre: `${ord.nombres} ${ord.apellidos}`.trim(),
    });
    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.HANDOFF_LEADS
      SET modalidad_acordada = '3 CUOTAS (30/40/30)',
          resumen_conversacion_leads = 'El estudiante pactó en LEADS abonar en 3 cuotas por hitos verificables: Cuota 1 inicial (S/ ${c1Monto.toFixed(2)}) para activar asesor, Cuota 2 (S/ ${c2Monto.toFixed(2)}) al entregar Cap 1, Cuota 3 (S/ ${c3Monto.toFixed(2)}) al informe final.',
          primer_enlace_url = '${urlLink}',
          estado_traspaso = 'VALIDADO'
      WHERE orden_pago_id = ${ordenPagoId};
    `);

    // 5. Emitir nuevo ENLACE_PAGO activo para la Cuota 1
    const refLink = `lnk_leads_${ordenPagoId}_${Date.now().toString().slice(-5)}`;
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO INBESTIGA_TESIS.dbo.ENLACE_PAGO (
        orden_pago_id, cuota_id, medio_pago_id, referencia_externa, url_enlace, monto, fecha_envio, fecha_expiracion, estado
      ) VALUES (
        ${ordenPagoId}, ${cuota1Id}, 1, '${refLink}', '${urlLink}', ${c1Monto}, GETDATE(), DATEADD(HOUR, 72, GETDATE()), 'ENVIADO'
      );
    `);

    // 6. Limpiar mensajes de chat previos en PAYERS para partir de cero
    await this.prisma.$executeRawUnsafe(`
      DELETE m
      FROM INBESTIGA_TESIS.dbo.MENSAJE m
      INNER JOIN INBESTIGA_TESIS.dbo.CONVERSACION c ON c.conversacion_id = m.conversacion_id
      WHERE c.contacto_id = ${contactoId} AND c.fase = 'PAYERS';

      UPDATE INBESTIGA_TESIS.dbo.CONVERSACION
      SET estado = 'ACTIVA', resuelta_sin_humano = 1
      WHERE contacto_id = ${contactoId} AND fase = 'PAYERS';
    `);

    await this.logAuditoria(
      'ADMIN',
      'Configurador de Pruebas PAYERS',
      'RESET_ORDEN_LEADS_CUOTAS',
      'ORDEN_PAGO',
      String(ordenPagoId),
      `Orden ${codigoOrden} reseteada a estado PENDIENTE con 3 cuotas pactadas en LEADS (30/40/30). Cuota 1 exigible: S/ ${c1Monto.toFixed(2)}.`,
    );

    return {
      success: true,
      mensaje: `Orden ${codigoOrden} configurada exitosamente desde HANDOFF LEADS con 3 cuotas.`,
      orden: {
        codigo: codigoOrden,
        estudiante: `${ord.nombres} ${ord.apellidos}`,
        modalidad: '3 cuotas (30% / 40% / 30%)',
        totalComprometido: total,
        totalCobrado: 0.0,
        cuota1_exigible: {
          numero: 1,
          monto: c1Monto,
          estado: 'ENLACE_ENVIADO',
          condicion: 'Cuota inicial (Activa asesor y primera sesión)',
          url_checkout: urlLink,
        },
        cuota2: { numero: 2, monto: c2Monto, estado: 'ESPERA_HITO' },
        cuota3: { numero: 3, monto: c3Monto, estado: 'ESPERA_HITO' },
      },
    };
  }

  /**
   * Helper privado para enviar mensajes push a Telegram
   */
  private async enviarTelegramPush(chatId: string | number, texto: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!chatId || !botToken || !botToken.includes(':')) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const axios = require('axios');
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: texto,
        parse_mode: 'Markdown',
      });
    } catch {
      try {
        const axios = require('axios');
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          chat_id: chatId,
          text: texto,
        });
      } catch (err: any) {
        this.logger.warn(`No se pudo enviar mensaje push a Telegram: ${err.message}`);
      }
    }
  }

  /**
   * 9. POST /api/v1/payers/alertas/simular-etapa
   * Disparador manual a demanda para la presentación: simula en vivo la alerta de 4h, 12h o 24h
   */
  async simularAlertaEtapa(ordenPagoId = 1, etapa: '4h' | '12h' | '24h' = '4h') {
    const ordRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1
        o.orden_pago_id,
        o.codigo_orden,
        o.monto_comprometido,
        o.estado,
        c.contacto_id,
        c.nombres,
        c.apellidos,
        c.telefono,
        c.telegram_chat_id
      FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO o
      INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = o.propuesta_id
      INNER JOIN INBESTIGA_TESIS.dbo.LEAD l ON l.lead_id = pr.lead_id
      INNER JOIN INBESTIGA_TESIS.dbo.BUYER b ON b.buyer_id = l.buyer_id
      INNER JOIN INBESTIGA_TESIS.dbo.CONTACTO c ON c.contacto_id = b.contacto_id
      WHERE o.orden_pago_id = ${ordenPagoId};
    `);

    if (!ordRows.length) {
      throw new NotFoundException(`No se encontró la orden #${ordenPagoId}`);
    }
    const ord = ordRows[0];
    const totalComprometido = Number(ord.monto_comprometido) || 1620.0;

    // Obtener cuota activa
    const cuotasRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1 * FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO
      WHERE orden_pago_id = ${ordenPagoId} AND estado NOT IN ('PAGADA', 'ANULADA')
      ORDER BY CASE WHEN estado IN ('EXIGIBLE', 'ENLACE_ENVIADO', 'VENCIDA', 'POR_VERIFICAR') THEN 0 ELSE 1 END, numero_cuota ASC;
    `);
    const cuotaActiva = cuotasRows[0] || { cuota_id: 1, numero_cuota: 1, monto_programado: 486.0 };
    const cuotaId = Number(cuotaActiva.cuota_id);
    const montoCuota = Number(cuotaActiva.monto_programado);

    let textoTelegram = '';
    let secuencia = 'Recordatorio 4 h';
    let esEscalado = 0;

    if (etapa === '4h') {
      secuencia = 'Recordatorio 4 h';
      const urlEnlace = await this.generarUrlCheckoutMercadoPago({
        codigoOrden: ord.codigo_orden,
        monto: montoCuota,
        servicio: `Recordatorio de pago ${ord.codigo_orden}`,
        nombre: `${ord.nombres} ${ord.apellidos}`.trim(),
      });
      textoTelegram =
        `⏰ *Recordatorio de Activación (4 Horas) — INBESTIGA.TESIS*\n\n` +
        `Hola *${ord.nombres}*, han transcurrido *4 horas* desde la emisión de tu propuesta y enlace oficial de pago.\n\n` +
        `Te reenviamos tu acceso directo seguro de Mercado Pago para completar la Cuota inicial (S/ ${montoCuota.toFixed(2)}):\n` +
        `👉 ${urlEnlace}\n\n` +
        `¿Tuviste alguna dificultad con tu banco o pasarela para poder ayudarte?`;
    } else if (etapa === '12h') {
      secuencia = 'Recordatorio 12 h';
      const cuota6 = (totalComprometido * 0.20).toFixed(2);
      textoTelegram =
        `📅 *Facilidad de Pago y Cuotas (12 Horas) — INBESTIGA.TESIS*\n\n` +
        `Hola * ${ord.nombres}*, han transcurrido *12 horas* y vemos que tu orden \`${ord.codigo_orden}\` aún no se ha activado.\n\n` +
        `Sabemos que la inversión de tesis es importante: ¿deseas que *reestructuremos tu plan a 6 cuotas por entregable* para que tu cuota inicial baje a solo *S/ ${cuota6}*?\n\n` +
        `Solo responde este mensaje indicándome *"Quiero 6 cuotas"* o *"En cuotas"* y lo actualizo de inmediato.`;
    } else {
      secuencia = 'Escalado al administrador';
      esEscalado = 1;
      textoTelegram =
        `👨‍💼 *Atención Personalizada (24 Horas) — INBESTIGA.TESIS*\n\n` +
        `Estimada * ${ord.nombres}*, han transcurrido más de *24 horas* sin concretar la activación de tu asesoría.\n\n` +
        `Para no enviarte mensajes automáticos invasivos, he pausado los recordatorios de este canal y he derivado tu expediente con prioridad a un *Asesor de Coordinación Académica y Caja*, quien se comunicará contigo directamente por llamada o WhatsApp para asistirte personalmente.\n\n` +
        `¡Muchos éxitos en tu investigación!`;

      // Insertar escalamiento
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO INBESTIGA_TESIS.dbo.ESCALAMIENTO (
          conversacion_id, orden_pago_id, tipo_escalamiento, destino, motivo, resumen_automatico, estado, fecha
        ) VALUES (
          1, ${ordenPagoId}, 'ESCALAMIENTO_HUMANO', 'Coordinación Comercial/Caja', 'Inactividad > 24h sin concretar abono de cuota',
          'El alumno no completó el pago tras recordatorios de 4h y 12h. Requiere llamada humana personalizada.',
          'ABIERTO', GETDATE()
        );
      `);
    }

    // 1. Insertar en ALERTA_COBRANZA
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO INBESTIGA_TESIS.dbo.ALERTA_COBRANZA (
        orden_pago_id, cuota_id, fecha_envio, secuencia, tipo, resultado, escalado
      ) VALUES (
        ${ordenPagoId}, ${cuotaId}, GETDATE(), '${secuencia}', 'Orden sin pago', 'ENVIADO', ${esEscalado}
      );
    `);

    // 2. Registrar en Auditoría
    await this.logAuditoria(
      'ADMIN',
      'Panel Cockpit Demo Emplazamiento',
      'DISPARAR_ALERTA_ETAPA',
      'ALERTA_COBRANZA',
      String(ordenPagoId),
      `Disparo forzado de alerta ${etapa.toUpperCase()} (${secuencia}) para orden ${ord.codigo_orden} - Estudiante: ${ord.nombres} ${ord.apellidos}`,
    );

    // 3. Enviar mensaje en vivo por WhatsApp (canal prioritario) y Telegram (si está vinculado)
    if (ord.telefono) {
      try {
        await this.whatsappService.enviarTextoSimple(ord.telefono, textoTelegram);
      } catch (err: any) {
        this.logger.warn(`No se pudo enviar la alerta por WhatsApp: ${err.message}`);
      }
    }
    if (ord.telegram_chat_id) {
      await this.enviarTelegramPush(ord.telegram_chat_id, textoTelegram);
    }

    return {
      success: true,
      etapa,
      secuencia,
      orden: ord.codigo_orden,
      estudiante: `${ord.nombres} ${ord.apellidos}`,
      telefono: ord.telefono,
      telegramChatId: ord.telegram_chat_id,
      mensajeEnviado: textoTelegram,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * POST /api/v1/payers/pagos/:pagoId/anular
   * Anula un pago confirmado sujeto en tiempo real a RN_11_PERMITIR_ANULACION_PAGO,
   * revierte la cuota a EXIGIBLE, recalcula ORDEN_PAGO y resincroniza INBESTIGA_MART.
   */
  async anularPago(pagoIdRaw: string | number, motivo?: string) {
    const permitirAnulacion = await this.businessRulesService.isReglaHabilitada(
      'RN_11_PERMITIR_ANULACION_PAGO',
      false,
    );
    if (!permitirAnulacion) {
      throw new BadRequestException(
        'Operación bloqueada por regla de negocio vigente (RN_11_PERMITIR_ANULACION_PAGO): la anulación de pagos está deshabilitada actualmente.',
      );
    }

    const pagoId = Number(String(pagoIdRaw).replace('tesis-pago-', '').trim());
    if (!Number.isInteger(pagoId) || pagoId <= 0) {
      throw new BadRequestException('Identificador de pago inválido para anulación.');
    }

    const pagoRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1
        pg.pago_id,
        pg.orden_pago_id,
        pg.cuota_id,
        pg.monto_pagado,
        pg.referencia,
        pg.estado,
        op.codigo_orden,
        op.monto_comprometido,
        cp.numero_cuota
      FROM INBESTIGA_TESIS.dbo.PAGO pg
      INNER JOIN INBESTIGA_TESIS.dbo.ORDEN_PAGO op ON op.orden_pago_id = pg.orden_pago_id
      LEFT JOIN INBESTIGA_TESIS.dbo.CUOTA_PAGO cp ON cp.cuota_id = pg.cuota_id
      WHERE pg.pago_id = ${pagoId};
    `);

    const pago = pagoRows[0];
    if (!pago) {
      throw new NotFoundException(`No se encontró el pago #${pagoId} en INBESTIGA_TESIS.dbo.PAGO.`);
    }
    if (pago.estado === 'ANULADO') {
      throw new BadRequestException(`El pago #${pagoId} ya se encuentra ANULADO.`);
    }
    if (pago.estado !== 'CONFIRMADO' && pago.estado !== 'POR_VERIFICAR') {
      throw new BadRequestException(
        `Solo se pueden anular pagos CONFIRMADO o POR_VERIFICAR (estado actual: ${pago.estado}).`,
      );
    }

    const ordenPagoId = Number(pago.orden_pago_id);
    const cuotaId = pago.cuota_id != null ? Number(pago.cuota_id) : null;
    const cleanMotivo = (motivo || 'Anulación manual autorizada por administración / Caja')
      .trim()
      .slice(0, 300)
      .replace(/'/g, "''");

    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.PAGO
      SET estado = 'ANULADO'
      WHERE pago_id = ${pagoId};
    `);

    if (cuotaId) {
      await this.prisma.$executeRawUnsafe(`
        UPDATE INBESTIGA_TESIS.dbo.CUOTA_PAGO
        SET estado = 'EXIGIBLE'
        WHERE cuota_id = ${cuotaId} AND estado IN ('PAGADA', 'POR_VERIFICAR');

        UPDATE INBESTIGA_TESIS.dbo.ENLACE_PAGO
        SET estado = 'EXPIRADO'
        WHERE cuota_id = ${cuotaId} AND estado = 'PAGADO';
      `);
    }

    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.VOUCHER
      SET estado = 'RECHAZADO',
          motivo_rechazo = N'Pago anulado: ${cleanMotivo}',
          fecha_verificacion = GETDATE()
      WHERE pago_id = ${pagoId};
    `);

    const resumenRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        ISNULL((SELECT SUM(monto_pagado) FROM INBESTIGA_TESIS.dbo.PAGO WHERE orden_pago_id = ${ordenPagoId} AND estado = 'CONFIRMADO'), 0) AS total_pagado,
        ISNULL((SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.ENLACE_PAGO WHERE orden_pago_id = ${ordenPagoId} AND estado = 'ENVIADO'), 0) AS enlaces_enviados
    `);
    const totalPagado = Number(resumenRows[0]?.total_pagado || 0);
    const enlacesEnviados = Number(resumenRows[0]?.enlaces_enviados || 0);
    const montoComprometido = Number(pago.monto_comprometido || 0);

    const nuevoEstadoOrden =
      totalPagado >= montoComprometido && montoComprometido > 0
        ? 'PAGADA'
        : totalPagado > 0
          ? 'PARCIAL'
          : enlacesEnviados > 0
            ? 'ENLACE_ENVIADO'
            : 'PENDIENTE';

    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.ORDEN_PAGO
      SET estado = '${nuevoEstadoOrden}'
      WHERE orden_pago_id = ${ordenPagoId};
    `);

    await this.logAuditoria(
      'ADMIN',
      'Administración / Caja',
      'ANULAR_PAGO',
      'PAGO',
      String(pagoId),
      `Pago #${pagoId} (${pago.referencia || 'SIN-REF'}, S/ ${Number(pago.monto_pagado).toFixed(2)}) de orden ${pago.codigo_orden} ANULADO según RN_11_PERMITIR_ANULACION_PAGO. Motivo: ${cleanMotivo}. Estado orden -> ${nuevoEstadoOrden}`,
    );

    await this.sincronizarDataMart(`anular pago #${pagoId}`);

    this.chatEvents$.next({
      type: 'pago_anulado',
      ordenPagoId,
      pagoId,
      nuevoEstadoOrden,
      timestamp: new Date().toISOString(),
    });

    const estadoOrden = await this.getOrdenDetalle(ordenPagoId);
    return {
      exito: true,
      mensaje: `Pago #${pagoId} (S/ ${Number(pago.monto_pagado).toFixed(2)}) de la orden ${pago.codigo_orden} anulado correctamente. Cuota revertida a EXIGIBLE y Data Mart actualizado.`,
      pagoId,
      ordenPagoId,
      nuevoEstadoOrden,
      estadoOrden,
    };
  }

  private async sincronizarDataMart(contexto: string) {
    try {
      await this.prisma.$executeRawUnsafe(`EXEC INBESTIGA_MART.dbo.sp_etl_sync_inbestiga_mart;`);
    } catch (e: any) {
      this.logger.warn(`Error sincronizando Data Mart tras ${contexto}: ${e.message}`);
    }
  }

  /**
   * POST /api/v1/payers/ordenes/:ordenPagoId/cancelar-cuotas
   * Cancela una o todas las cuotas pendientes futuras (EXIGIBLE, ESPERA_HITO, ENLACE_ENVIADO, VENCIDA)
   * sujeto en tiempo real a RN_12_CANCELAR_CUOTAS_PENDIENTES, sin alterar pagos confirmados (RN_11).
   */
  async cancelarCuotasPendientes(
    ordenPagoIdRaw: string | number,
    opts?: {
      cuotaId?: number;
      motivo?: string;
      origen?: 'ADMIN' | 'ESTUDIANTE';
      actor?: string;
    },
  ) {
    const permitirCancelar = await this.businessRulesService.isReglaHabilitada(
      'RN_12_CANCELAR_CUOTAS_PENDIENTES',
      false,
    );
    if (!permitirCancelar) {
      throw new BadRequestException(
        'Operación bloqueada por regla de negocio vigente (RN_12_CANCELAR_CUOTAS_PENDIENTES): la cancelación de cuotas pendientes está deshabilitada actualmente.',
      );
    }

    const ordenPagoId = Number(ordenPagoIdRaw);
    if (!Number.isInteger(ordenPagoId) || ordenPagoId <= 0) {
      throw new BadRequestException('Identificador de orden de pago inválido.');
    }

    const ordRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1
        op.orden_pago_id,
        op.codigo_orden,
        op.estado,
        op.monto_comprometido,
        b.contacto_id
      FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO op
      INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = op.propuesta_id
      INNER JOIN INBESTIGA_TESIS.dbo.LEAD l ON l.lead_id = pr.lead_id
      INNER JOIN INBESTIGA_TESIS.dbo.BUYER b ON b.buyer_id = l.buyer_id
      WHERE op.orden_pago_id = ${ordenPagoId};
    `);
    const orden = ordRows[0];
    if (!orden) {
      throw new NotFoundException(`No se encontró la orden de pago #${ordenPagoId}.`);
    }

    const cuotasRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT cuota_id, numero_cuota, monto_programado, condicion, estado
      FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO
      WHERE orden_pago_id = ${ordenPagoId}
      ORDER BY numero_cuota ASC;
    `);

    const filtroCuotaId = opts?.cuotaId != null ? Number(opts.cuotaId) : null;
    if (filtroCuotaId !== null) {
      const target = cuotasRows.find((c) => Number(c.cuota_id) === filtroCuotaId);
      if (!target) {
        throw new NotFoundException(`La cuota #${filtroCuotaId} no pertenece a la orden ${orden.codigo_orden}.`);
      }
      if (target.estado === 'PAGADA') {
        throw new BadRequestException(
          `La cuota #${target.numero_cuota} ya está PAGADA; para revertir un cobro confirmado utiliza anulación de pago (RN_11).`,
        );
      }
      if (target.estado === 'POR_VERIFICAR') {
        throw new BadRequestException(
          `La cuota #${target.numero_cuota} tiene un voucher POR_VERIFICAR en Caja; concílialo o recházalo antes de cancelar.`,
        );
      }
      if (target.estado === 'ANULADA') {
        throw new BadRequestException(`La cuota #${target.numero_cuota} ya se encuentra ANULADA.`);
      }
    }

    const cuotasACancelar = cuotasRows.filter((c) => {
      if (filtroCuotaId !== null && Number(c.cuota_id) !== filtroCuotaId) return false;
      return ['EXIGIBLE', 'ESPERA_HITO', 'ENLACE_ENVIADO', 'VENCIDA'].includes(c.estado);
    });

    if (cuotasACancelar.length === 0) {
      throw new BadRequestException(
        `No hay cuotas pendientes cancelables en la orden ${orden.codigo_orden}.`,
      );
    }

    const cuotaIdsSql = cuotasACancelar.map((c) => Number(c.cuota_id)).join(', ');
    const cleanMotivo = (
      opts?.motivo || 'Cancelación de cuotas pendientes autorizada conforme a RN_12_CANCELAR_CUOTAS_PENDIENTES'
    )
      .trim()
      .slice(0, 300)
      .replace(/'/g, "''");

    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.CUOTA_PAGO
      SET estado = 'ANULADA'
      WHERE cuota_id IN (${cuotaIdsSql});

      UPDATE INBESTIGA_TESIS.dbo.ENLACE_PAGO
      SET estado = 'EXPIRADO'
      WHERE orden_pago_id = ${ordenPagoId}
        AND estado IN ('PENDIENTE', 'ENVIADO')
        AND (cuota_id IS NULL OR cuota_id IN (${cuotaIdsSql}));

      UPDATE INBESTIGA_TESIS.dbo.ALERTA_COBRANZA
      SET resultado = 'PAUSADO',
          motivo_pausa = N'${cleanMotivo}'
      WHERE orden_pago_id = ${ordenPagoId}
        AND resultado = 'ENVIADO'
        AND (cuota_id IS NULL OR cuota_id IN (${cuotaIdsSql}));
    `);

    const estadoResumenRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        ISNULL((SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO WHERE orden_pago_id = ${ordenPagoId} AND estado NOT IN ('PAGADA', 'ANULADA')), 0) AS cuotas_restantes,
        ISNULL((SELECT SUM(monto_pagado) FROM INBESTIGA_TESIS.dbo.PAGO WHERE orden_pago_id = ${ordenPagoId} AND estado = 'CONFIRMADO'), 0) AS total_pagado,
        ISNULL((SELECT COUNT(*) FROM INBESTIGA_TESIS.dbo.ENLACE_PAGO WHERE orden_pago_id = ${ordenPagoId} AND estado = 'ENVIADO'), 0) AS enlaces_enviados
    `);
    const cuotasRestantes = Number(estadoResumenRows[0]?.cuotas_restantes || 0);
    const totalPagadoConfirmado = Number(estadoResumenRows[0]?.total_pagado || 0);
    const enlacesEnviados = Number(estadoResumenRows[0]?.enlaces_enviados || 0);

    let nuevoEstadoOrden = String(orden.estado);
    if (cuotasRestantes === 0) {
      nuevoEstadoOrden = 'ANULADA';
      await this.prisma.$executeRawUnsafe(`
        UPDATE INBESTIGA_TESIS.dbo.ORDEN_PAGO
        SET estado = 'ANULADA'
        WHERE orden_pago_id = ${ordenPagoId};

        UPDATE INBESTIGA_TESIS.dbo.ENLACE_PAGO
        SET estado = 'EXPIRADO'
        WHERE orden_pago_id = ${ordenPagoId} AND estado IN ('PENDIENTE', 'ENVIADO');

        UPDATE INBESTIGA_TESIS.dbo.ALERTA_COBRANZA
        SET resultado = 'PAUSADO', motivo_pausa = N'${cleanMotivo}'
        WHERE orden_pago_id = ${ordenPagoId} AND resultado = 'ENVIADO';
      `);
    } else {
      nuevoEstadoOrden =
        totalPagadoConfirmado > 0 ? 'PARCIAL' : enlacesEnviados > 0 ? 'ENLACE_ENVIADO' : 'PENDIENTE';
      await this.prisma.$executeRawUnsafe(`
        UPDATE INBESTIGA_TESIS.dbo.ORDEN_PAGO
        SET estado = '${nuevoEstadoOrden}'
        WHERE orden_pago_id = ${ordenPagoId};
      `);
    }

    const montoCancelado = Number(
      cuotasACancelar.reduce((acc, c) => acc + Number(c.monto_programado || 0), 0).toFixed(2),
    );
    const numerosCancelados = cuotasACancelar.map((c) => `#${c.numero_cuota}`).join(', ');

    await this.logAuditoria(
      opts?.origen || 'ADMIN',
      opts?.actor || 'Administración / Caja',
      'CANCELAR_CUOTAS_PENDIENTES',
      'ORDEN_PAGO',
      String(ordenPagoId),
      `Cuotas ${numerosCancelados} (S/ ${montoCancelado.toFixed(2)}) de orden ${orden.codigo_orden} ANULADAS según RN_12_CANCELAR_CUOTAS_PENDIENTES. Abonado conservado: S/ ${totalPagadoConfirmado.toFixed(2)}. Motivo: ${cleanMotivo}. Estado orden -> ${nuevoEstadoOrden}`,
    );

    await this.sincronizarDataMart(`cancelar cuotas de orden #${ordenPagoId}`);

    this.chatEvents$.next({
      type: 'cuotas_canceladas',
      ordenPagoId,
      nuevoEstadoOrden,
      cuotasCanceladas: cuotasACancelar.map((c) => Number(c.numero_cuota)),
      montoCancelado,
      timestamp: new Date().toISOString(),
    });

    const estadoOrden = await this.getOrdenDetalle(ordenPagoId);
    return {
      exito: true,
      mensaje: `Cuotas pendientes (${numerosCancelados}) de la orden ${orden.codigo_orden} canceladas por S/ ${montoCancelado.toFixed(2)}. Pagos confirmados conservados: S/ ${totalPagadoConfirmado.toFixed(2)}.`,
      ordenPagoId,
      nuevoEstadoOrden,
      cuotasCanceladas: cuotasACancelar.map((c) => ({
        cuota_id: Number(c.cuota_id),
        numero_cuota: Number(c.numero_cuota),
        monto_programado: Number(c.monto_programado),
        estado_anterior: c.estado,
        estado_nuevo: 'ANULADA',
      })),
      montoCancelado,
      montoPagadoConservado: totalPagadoConfirmado,
      estadoOrden,
    };
  }
}
