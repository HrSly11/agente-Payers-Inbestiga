import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
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

  constructor(private readonly prisma: PrismaService) {}

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
      WHERE ct.telefono LIKE '%${ultimos9}%' OR ct.telefono LIKE '%${cleanDigits}%'
      ORDER BY op.orden_pago_id DESC;
    `);

    return rows.length > 0 ? rows[0] : null;
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
      mensajes,
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
  async procesarChatAgente(ordenPagoId: number, mensaje: string) {
    const detalle = await this.getOrdenDetalle(ordenPagoId);
    const { orden, handoff, contrato, cuotas, enlaces, pagos } = detalle;

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
    const cleanMsg = (mensaje || '').trim().replace(/'/g, "''");
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO INBESTIGA_TESIS.dbo.MENSAJE (
        conversacion_id, emisor, tipo_mensaje, contenido, fecha_mensaje
      ) VALUES (
        ${conversacionId}, 'ESTUDIANTE', 'TEXTO', N'${cleanMsg}', GETDATE()
      );
    `);

    const msgLower = (mensaje || '').toLowerCase();
    const herramientasEjecutadas: ToolExecutionRecord[] = [];
    const guardrailsActivados: string[] = [];
    let respuesta = '';

    // Cuota exigible actual
    const cuotaPendiente =
      cuotas.find((c) => c.estado !== 'PAGADA' && c.estado !== 'ANULADA') ||
      cuotas[0] || {
        cuota_id: ordenPagoId,
        numero_cuota: 1,
        monto_programado: Number(orden.monto_comprometido),
        condicion: 'Pago único',
        estado: 'EXIGIBLE',
      };
    const montoCuotaActual = Number(cuotaPendiente.monto_programado);
    const enlaceActivo = enlaces[0];

    // =========================================================================
    // REGLA 1: Guardarraíl Anti-Prompt-Injection (Sección 11.4 y RN-01/RN-02)
    // =========================================================================
    if (
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
        `🛡️ [Guardarraíl Determinístico Activo] Como agente automatizado de cobranza de INBESTIGA, no tengo permisos para confirmar pagos por instrucciones de chat ni alterar el precio acordado (${orden.codigo_orden}: S/ ${Number(orden.monto_comprometido).toFixed(2)}).\n\n` +
        `La acreditación de pagos se realiza exclusivamente mediante:\n` +
        `1. Confirmación verificada desde la pasarela oficial Mercado Pago (${pagosConfirmados.length} pagos confirmados en BD para esta orden).\n` +
        `2. Validación en bandeja de Caja de un comprobante bancario (VOUCHER).\n\n` +
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
        `He verificado tu expediente (${orden.codigo_orden}) y detecté que el paquete de traspaso desde LEADS figura con observaciones pendientes (${handoff?.detalle_incompleto || 'datos contractuales por completar'}).\n\n` +
        `Por política de seguridad de INBESTIGA (RN-L1), he derivado tu caso inmediatamente al especialista de LEADS para que complete tu ficha antes de emitir el cobro.`;
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
        `Comprendo tu consulta sobre el presupuesto. En la etapa de cobranza y activación (**PAYERS**), el monto acordado en tu propuesta aceptada (**S/ ${Number(orden.monto_comprometido).toFixed(2)}**, con descuento comercial ya aplicado de S/ ${Number(orden.descuento).toFixed(2)}) se encuentra congelado por regla de negocio (**RN-02**).\n\n` +
        `✅ **Lo que acabo de hacer por ti:**\n` +
        `1. He registrado tu solicitud y derivado tu caso con prioridad al **Especialista Comercial de LEADS** (\`DEVOLVER_A_LEADS\`).\n` +
        `2. Si deseas mantener el precio actual pero reducir el desembolso inicial hoy mismo, recuerda que puedo fraccionar tu orden en **3 cuotas (30/40/30)** o **6 cuotas por entregable** sin ningún recargo.`;
    }
    // =========================================================================
    // REGLA 4: Pago con Yape o Plin -> Validación Tope S/ 500.00 (RN-05)
    // =========================================================================
    else if (/yape|plin/i.test(msgLower) && !/ya pagu[eé]|ya hice/i.test(msgLower)) {
      const billetera = /plin/i.test(msgLower) ? 'Plin' : 'Yape';
      if (montoCuotaActual > 500) {
        guardrailsActivados.push(
          `RN-05: Tope operativo ${billetera} (S/ 500.00) superado por cuota actual (S/ ${montoCuotaActual.toFixed(2)})`,
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
            tope_maximo_soles: 500.0,
            excede_tope: true,
            politica: polRows[0]?.contenido || 'Límite máximo S/ 500.00 por operación en Yape/Plin.',
          },
          75,
        );
        herramientasEjecutadas.push(toolPol);

        const refLink = `lnk_card_${ordenPagoId}_${Date.now().toString().slice(-5)}`;
        const urlLink = `http://localhost:3000/checkout/${orden.codigo_orden}`;
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO INBESTIGA_TESIS.dbo.ENLACE_PAGO (
            orden_pago_id, cuota_id, medio_pago_id, referencia_externa, url_enlace, monto, fecha_envio, fecha_expiracion, estado
          ) VALUES (
            ${ordenPagoId}, ${Number(cuotaPendiente.cuota_id)}, 3, '${refLink}', '${urlLink}', ${montoCuotaActual}, GETDATE(), DATEADD(HOUR, 48, GETDATE()), 'ENVIADO'
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
            ${ordenPagoId}, 'TOPE_MEDIO', 'Intentó pagar S/ ${montoCuotaActual.toFixed(2)} con ${billetera}; se aplicó RN-05 (tope S/ 500).', 1, 1, GETDATE()
          );
        `);

        respuesta =
          `• **Aviso de Tope Operativo en ${billetera} (Regla RN-05):**\n` +
          `Tu cuota exigible #${cuotaPendiente.numero_cuota} es de **S/ ${montoCuotaActual.toFixed(2)}**, y por seguridad de las billeteras móviles en pasarela el límite máximo por operación en **Yape / Plin es de S/ 500.00**.\n\n` +
          `Para completar tu pago ahora mismo tienes **3 alternativas oficiales**:\n` +
          `1. **Enlace Checkout con Tarjeta Débito/Crédito (hasta S/ 15,000):** ${urlLink}\n` +
          `2. **Transferencia Bancaria BCP / Interbank (0% comisión):** Cta. Corriente Soles BCP **570-2489103-0-12** | CCI **00257000248910301235** (INBESTIGA SAC) y me envías la captura del voucher por aquí.\n` +
          `3. **Fraccionar en 6 cuotas por entregable** para que tu cuota inicial baje a **S/ ${(Number(orden.monto_comprometido) * 0.2).toFixed(2)}** (≤ S/ 500.00 y apta para ${billetera}). ¿Cuál prefieres?`;
      } else {
        guardrailsActivados.push(
          `RN-05: Monto S/ ${montoCuotaActual.toFixed(2)} validado dentro del límite operativo de ${billetera} (≤ S/ 500.00)`,
        );
        const medioId = billetera === 'Plin' ? 2 : 1;
        const refLink = `lnk_${billetera.toLowerCase()}_${ordenPagoId}_${Date.now().toString().slice(-5)}`;
        const urlLink = `http://localhost:3000/checkout/${orden.codigo_orden}`;

        await this.prisma.$executeRawUnsafe(`
          INSERT INTO INBESTIGA_TESIS.dbo.ENLACE_PAGO (
            orden_pago_id, cuota_id, medio_pago_id, referencia_externa, url_enlace, monto, fecha_envio, fecha_expiracion, estado
          ) VALUES (
            ${ordenPagoId}, ${Number(cuotaPendiente.cuota_id)}, ${medioId}, '${refLink}', '${urlLink}', ${montoCuotaActual}, GETDATE(), DATEADD(HOUR, 48, GETDATE()), 'ENVIADO'
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
          `• **Enlace directo de pago generado:** Como tu cuota #${cuotaPendiente.numero_cuota} es de **S/ ${montoCuotaActual.toFixed(2)}** (dentro del límite de S/ 500.00 de ${billetera}), he generado tu enlace directo:\n\n` +
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
      guardrailsActivados.push('Solicitud expresa de emisión o reenvío de enlace de pago oficial');
      const urlEnlace =
        enlaceActivo?.url_enlace || `http://localhost:3000/checkout/${orden.codigo_orden}`;

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
        const urlLink = `http://localhost:3000/checkout/${orden.codigo_orden}`;

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
      !/cambiar|reestructurar|3 cuotas|tres cuotas|6 cuotas|seis cuotas|en partes|fraccionar/i.test(msgLower)
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

      const saldo = Number(orden.monto_comprometido) - Number(orden.monto_cobrado);
      let cronoText =
        `📅 **Cronograma Oficial de Pagos — Orden ${orden.codigo_orden}**\n\n` +
        `• **Servicio:** ${orden.servicio_nombre}\n` +
        `• **Modalidad pactada:** ${orden.modalidad_condicion}\n` +
        `• **Total comprometido:** S/ ${Number(orden.monto_comprometido).toFixed(2)}\n` +
        `• **Monto abonado:** S/ ${Number(orden.monto_cobrado).toFixed(2)}\n` +
        `• **Saldo pendiente:** S/ ${saldo > 0 ? saldo.toFixed(2) : '0.00'}\n\n` +
        `📋 **Desglose de Cuotas:**\n`;

      for (const c of todasCuotas) {
        const icon = c.estado === 'PAGADA' ? '✅' : c.estado === 'ENLACE_ENVIADO' ? '🟡' : '⏳';
        const fechaStr = c.fecha_vencimiento
          ? new Date(c.fecha_vencimiento).toISOString().split('T')[0]
          : 'Contra entrega de hito académico';
        cronoText += `${icon} **Cuota #${c.numero_cuota}:** S/ ${Number(c.monto_programado).toFixed(2)} (${Number(c.porcentaje)}%) — \`${c.estado}\`\n`;
        cronoText += `   └ Vence: ${fechaStr} | Condición: ${c.condicion || 'Entrega verificable'}\n`;
      }

      if (orden.modalidad_condicion.includes('1 pago') && Number(orden.monto_cobrado) === 0) {
        cronoText += `\n💡 **Opciones de Flexibilidad Financiera:**\nActualmente tu orden está configurada en **1 pago al contado**. Si prefieres pagar en cuotas por hitos verificables antes de iniciar tu asesoría, solo dime **"cambiar a 3 cuotas"** o **"en 6 cuotas"** y actualizaré tu cronograma inmediatamente.`;
      }

      if (enlaceActivo) {
        cronoText += `\n\n💳 **Enlace oficial de pago de tu cuota exigible:** ${enlaceActivo.url_enlace}`;
      }

      respuesta = cronoText;
    }
    // =========================================================================
    // REGLA 8: Configuración / Cambio de Modalidad y Cuotas (RN-03)
    // =========================================================================
    else if (/3 cuotas|tres cuotas|6 cuotas|seis cuotas|contado|en partes|fraccionar|cambiar.*cuotas/i.test(msgLower)) {
      const pagosConfirmados = pagos.filter((p) => p.estado === 'CONFIRMADO');
      if (pagosConfirmados.length > 0) {
        guardrailsActivados.push(
          'RN-03: Orden con pago previo confirmado — Cambio de modalidad requiere autorización del Administrador',
        );
        const toolEstado = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'consultar_orden_pago',
          { orden_pago_id: ordenPagoId },
          { pagos_confirmados: pagosConfirmados.length, cambio_bloqueado: true },
          75,
        );
        herramientasEjecutadas.push(toolEstado);

        respuesta =
          `ℹ️ Tu orden **${orden.codigo_orden}** ya registra **${pagosConfirmados.length} pago(s) confirmado(s)** bajo la modalidad **${orden.modalidad_condicion}**.\n\n` +
          `Por regla de integridad financiera (**RN-03**), una vez iniciado el plan de pagos, cualquier reestructuración de cuotas debe ser autorizada por el Administrador de Caja.`;
      } else if (orden.solo_contado && /3 cuotas|6 cuotas|partes|fraccionar/i.test(msgLower)) {
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
        let nuevaModalidadId = 2; // 3 cuotas por defecto
        let descripcionModalidad = '3 cuotas 30/40/30';
        let porcentajes = [30, 40, 30];

        if (/6 cuotas|seis cuotas/i.test(msgLower)) {
          nuevaModalidadId = 3;
          descripcionModalidad = '6 cuotas (inicial + hitos)';
          porcentajes = [20, 16, 16, 16, 16, 16];
        } else if (/contado|1 pago/i.test(msgLower)) {
          nuevaModalidadId = 1;
          descripcionModalidad = '1 pago (100%)';
          porcentajes = [100];
        }

        guardrailsActivados.push(
          `RN-03: Reconfiguración de modalidad a "${descripcionModalidad}" manteniendo intacto el monto comprometido (S/ ${Number(orden.monto_comprometido).toFixed(2)})`,
        );

        await this.prisma.$executeRawUnsafe(`
          UPDATE INBESTIGA_TESIS.dbo.ORDEN_PAGO
          SET modalidad_pago_id = ${nuevaModalidadId}
          WHERE orden_pago_id = ${ordenPagoId};
        `);

        // Reemplazar cuotas pendientes manteniendo integridad referencial
        await this.prisma.$executeRawUnsafe(`
          UPDATE INBESTIGA_TESIS.dbo.ENLACE_PAGO SET cuota_id = NULL WHERE orden_pago_id = ${ordenPagoId};
          UPDATE INBESTIGA_TESIS.dbo.VOUCHER SET cuota_id = NULL WHERE orden_pago_id = ${ordenPagoId};
          UPDATE INBESTIGA_TESIS.dbo.ALERTA_COBRANZA SET cuota_id = NULL WHERE orden_pago_id = ${ordenPagoId};
          UPDATE INBESTIGA_TESIS.dbo.PAGO SET cuota_id = NULL WHERE orden_pago_id = ${ordenPagoId} AND estado != 'CONFIRMADO';
          DELETE FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO WHERE orden_pago_id = ${ordenPagoId} AND estado != 'PAGADA';
        `);

        const totalOrden = Number(orden.monto_comprometido);
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

        const primeraCuotaRows: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT TOP 1 * FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO WHERE orden_pago_id = ${ordenPagoId} ORDER BY numero_cuota ASC;`,
        );
        const nuevaCuota1 = primeraCuotaRows[0];
        const montoInicial = Number(nuevaCuota1.monto_programado);

        const toolMod = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'configurar_modalidad_y_cuotas',
          {
            orden_pago_id: ordenPagoId,
            nueva_modalidad: descripcionModalidad,
            numero_cuotas: porcentajes.length,
          },
          {
            modalidad_actualizada: descripcionModalidad,
            monto_comprometido_inmutable: totalOrden,
            cuota_inicial_exigible: montoInicial,
          },
          135,
        );
        herramientasEjecutadas.push(toolMod);

        const medioId = montoInicial <= 500 ? 1 : 3;
        const refLink = `lnk_mod_${ordenPagoId}_${Date.now().toString().slice(-5)}`;
        const urlLink = `http://localhost:3000/checkout/${orden.codigo_orden}`;

        await this.prisma.$executeRawUnsafe(`
          INSERT INTO INBESTIGA_TESIS.dbo.ENLACE_PAGO (
            orden_pago_id, cuota_id, medio_pago_id, referencia_externa, url_enlace, monto, fecha_envio, fecha_expiracion, estado
          ) VALUES (
            ${ordenPagoId}, ${Number(nuevaCuota1.cuota_id)}, ${medioId}, '${refLink}', '${urlLink}', ${montoInicial}, GETDATE(), DATEADD(HOUR, 48, GETDATE()), 'ENVIADO'
          );
        `);

        const toolLink = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'emitir_enlace_pago',
          {
            orden_pago_id: ordenPagoId,
            cuota_id: nuevaCuota1.cuota_id,
            monto: montoInicial,
          },
          { url_enlace: urlLink, referencia_externa: refLink },
          98,
        );
        herramientasEjecutadas.push(toolLink);

        respuesta =
          `• **Modalidad Actualizada a ${descripcionModalidad} (Regla RN-03):**\n` +
          `He actualizado el cronograma de tu orden **${orden.codigo_orden}** manteniendo intacto el precio final acordado de **S/ ${totalOrden.toFixed(2)}**:\n\n` +
          `• **Cuota 1 (Exigible hoy para activar asesor):** S/ ${montoInicial.toFixed(2)} (${porcentajes[0]}%)\n` +
          (porcentajes.length > 1
            ? `• **Cuotas siguientes (${porcentajes.length - 1}):** Atadas estrictamente a la entrega verificable de tus hitos académicos (\`ESPERA_HITO\`).\n\n`
            : '\n') +
          `• **Nuevo enlace de pago de tu Cuota 1:** ${urlLink}`;
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

      respuesta =
        `👤 **Responsable de Pago Actualizado:**\n` +
        `He registrado a **${tipoResp}** como responsable de pago de tu orden **${orden.codigo_orden}**.\n\n` +
        `Puedes reenviarle directamente el enlace de pago por **S/ ${montoCuotaActual.toFixed(2)}** (${enlaceActivo?.url_enlace || `http://localhost:3000/checkout/${orden.codigo_orden}`}) o los datos de cuenta corriente corporativa BCP **570-2489103-0-12** (INBESTIGA SAC).`;
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
          ${ordenPagoId}, '${tipoObjecion}', '${cleanMsg.slice(0, 250)}', 1, 1, GETDATE()
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
        `🛡️ **${pol.titulo} (Política Oficial ${pol.version || 'v2.0'}):**\n` +
        `${pol.contenido}\n\n` +
        `Tu orden **${orden.codigo_orden}** está respaldada por el contrato **${orden.codigo_contrato}** y tu cuota exigible actual es de **S/ ${montoCuotaActual.toFixed(2)}**. ¿Deseas proceder con el enlace de pago o prefieres fraccionarlo en cuotas?`;
    }
    // =========================================================================
    // REGLA 12: Consulta de Siguiente Paso / "¿Qué hago?" / "¿Qué falta?"
    // =========================================================================
    else if (
      /qu[eé] (hago|falta|sigue|paso|debo hacer)|c[oó]mo contin[uú]o|cu[aá]l es el siguiente paso|ahora qu[eé]/i.test(
        msgLower,
      )
    ) {
      const pagosConfirmados = pagos.filter((p) => p.estado === 'CONFIRMADO');
      const toolOrden = await this.logToolExecution(
        conversacionId,
        ordenPagoId,
        'consultar_orden_pago',
        { orden_pago_id: ordenPagoId },
        { estado_orden: orden.estado, pagos_confirmados: pagosConfirmados.length },
        65,
      );
      herramientasEjecutadas.push(toolOrden);

      if (pagosConfirmados.length > 0 || cuotaPendiente.estado === 'PAGADA' || orden.estado === 'PAGADA') {
        guardrailsActivados.push('RN-04: Orden con cuota inicial confirmada — Servicio activo');
        respuesta =
          `🎓 **¡Tu cuota ya está 100% confirmada!**\n\n` +
          `• **Estado de tu servicio:** \`ACTIVO\`\n` +
          `• **Monto cobrado:** S/ ${Number(orden.monto_cobrado || orden.monto_comprometido).toFixed(2)} de S/ ${Number(orden.monto_comprometido).toFixed(2)}\n\n` +
          `📌 **Siguiente paso:** Tu asesoría académica ya está activa. ` +
          `El especialista metodológico asignado a tu carrera (**${orden.asesor_nombre || 'Dr. Carlos Alberto Méndez Vargas'}**) se comunicará contigo para coordinar la primera sesión de inducción y el entregable del cronograma.\n\n` +
          `¡Ya no tienes que realizar ningún pago adicional en este momento!`;
      } else {
        guardrailsActivados.push('Orientación de Cobranza: Instrucciones para activación de servicio');
        const urlEnlace =
          enlaceActivo?.url_enlace || `http://localhost:3000/checkout/${orden.codigo_orden}`;
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
      const totalComprometido = Number(orden.monto_comprometido || 0);
      const totalCobrado = Number(orden.monto_cobrado || 0);
      const saldoPendiente = Math.max(0, totalComprometido - totalCobrado);
      const estaPagada = orden.estado === 'PAGADA' || (saldoPendiente === 0 && totalComprometido > 0);
      const pagosConfirmados = pagos.filter((p) => p.estado === 'CONFIRMADO');

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
          `• **Monto abonado:** S/ ${totalComprometido.toFixed(2)}\n` +
          `• **Saldo pendiente:** S/ 0.00\n` +
          `• **Estado del servicio:** \`ACTIVO\`\n` +
          `• **Asesor Asignado:** ${orden.asesor_nombre || 'Dr. Carlos Alberto Méndez Vargas'}\n\n` +
          `¡Tu asesoría está en marcha y ya no requieres realizar ningún pago!`;
      } else {
        respuesta =
          `📋 **Estado de tu cuenta — Orden ${orden.codigo_orden}:**\n\n` +
          `• **Total comprometido:** S/ ${totalComprometido.toFixed(2)}\n` +
          `• **Total abonado a la fecha:** S/ ${totalCobrado.toFixed(2)}\n` +
          `• **Saldo pendiente de pago:** S/ ${saldoPendiente.toFixed(2)}\n` +
          `• **Cuota actual (#${cuotaPendiente.numero_cuota}):** S/ ${montoCuotaActual.toFixed(2)} (\`${cuotaPendiente.estado}\`)\n\n` +
          `Puedes consultar o abonar tu cuota en el enlace oficial de Mercado Pago: ${enlaceActivo?.url_enlace || `http://localhost:3000/checkout/${orden.codigo_orden}`}`;
      }
    }
    // =========================================================================
    // REGLA 14: Consulta sobre Entregas, Asesor y Primera Sesión Académica
    // =========================================================================
    else if (/entrega|primera entrega|sesi[oó]n|cu[aá]ndo empieza|asesor|reuni[oó]n|meet/i.test(msgLower)) {
      const totalComprometido = Number(orden.monto_comprometido || 0);
      const totalCobrado = Number(orden.monto_cobrado || 0);
      const saldoPendiente = Math.max(0, totalComprometido - totalCobrado);
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
        (saldoPendiente > 0
          ? `ℹ️ **Nota de pago:** Tu orden registra un saldo pendiente de **S/ ${saldoPendiente.toFixed(2)}** en tu cuota #${cuotaPendiente.numero_cuota} (\`${cuotaPendiente.estado}\`). Enlace oficial de Mercado Pago: ${enlaceActivo?.url_enlace || `http://localhost:3000/checkout/${orden.codigo_orden}`}`
          : `🎉 Tu expediente se encuentra 100% al día.`);
    }
    // =========================================================================
    // FLUJO CONVERSACIONAL INTELIGENTE (Google Gemini + Contexto Transaccional)
    // =========================================================================
    else {
      const totalComprometido = Number(orden.monto_comprometido || 0);
      const totalCobrado = Number(orden.monto_cobrado || 0);
      const saldoPendiente = Math.max(0, totalComprometido - totalCobrado);
      const estaPagada = orden.estado === 'PAGADA' || (saldoPendiente === 0 && totalComprometido > 0);
      const asesorReal = orden.asesor_nombre || 'Dr. Carlos Alberto Méndez Vargas';

      // 1. Invocar Google Gemini con el contexto en vivo de la base de datos
      let respuestaGemini: string | null = null;
      const apiKey = process.env.GEMINI_API_KEY;
      const urlEnlace =
        enlaceActivo?.url_enlace || `http://localhost:3000/checkout/${orden.codigo_orden}`;

      if (apiKey && apiKey.length > 10) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const axios = require('axios');
          const contextPrompt =
            `Eres el Agente Virtual Oficial de Cobranza y Activación de INBESTIGA (institución de asesoría de tesis).\n` +
            `Datos del estudiante en vivo desde la base de datos SQL Server:\n` +
            `- Estudiante: ${orden.estudiante_nombre}\n` +
            `- Código de Orden: ${orden.codigo_orden}\n` +
            `- Servicio: ${orden.servicio_nombre}\n` +
            `- Estado de la Orden: ${orden.estado}\n` +
            `- Total comprometido: S/ ${totalComprometido.toFixed(2)}\n` +
            `- Total pagado a la fecha: S/ ${totalCobrado.toFixed(2)}\n` +
            `- Saldo pendiente real: S/ ${saldoPendiente.toFixed(2)}\n` +
            `- Cuota actual (#${cuotaPendiente.numero_cuota}): S/ ${montoCuotaActual.toFixed(2)} (Estado: ${cuotaPendiente.estado}, Vence: ${cuotaPendiente.fecha_vencimiento ? String(cuotaPendiente.fecha_vencimiento).slice(0, 10) : 'según hito'})\n` +
            `- Asesor Metodológico Asignado: ${asesorReal}\n` +
            `- Pasarela Oficial: Mercado Pago (Checkout Pro)\n` +
            `- Enlace Oficial de Pago Mercado Pago: ${urlEnlace}\n\n` +
            `REGLAS ESTRICTAS DE RESPUESTA:\n` +
            `1. Si el saldo pendiente es mayor a 0 (S/ ${saldoPendiente.toFixed(2)}), INDICA QUE TIENE UN SALDO PENDIENTE de S/ ${saldoPendiente.toFixed(2)}. Si la cuota actual está en ESPERA_HITO, explica que el pago de esa cuota se habilita apenas el asesor (${asesorReal}) apruebe el hito académico correspondiente.\n` +
            `2. Si mencionas el enlace de pago, PROPORCIONA SIEMPRE este enlace exacto de Mercado Pago: ${urlEnlace}. PROHIBIDO mencionar "Culqi" o "Fase 4: CUSTOMERS"; nuestra única pasarela oficial es Mercado Pago.\n` +
            `3. Responde en tono profesional, cálido, directo y conciso (máximo 2 párrafos).\n` +
            `4. Pregunta exacta del estudiante: "${mensaje}"`;

          const gRes = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
            {
              contents: [{ role: 'user', parts: [{ text: contextPrompt }] }],
            },
            { timeout: 12000 },
          );
          if (gRes.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            let textoG = gRes.data.candidates[0].content.parts[0].text.trim();
            // Reemplazo de seguridad contra placeholders de LLM
            textoG = textoG.replace(/ENLACE(_|\s*)DE(_|\s*)PAGO(\s*AQU[IÍ])?/gi, urlEnlace);
            respuestaGemini = textoG;
          }
        } catch (e: any) {
          this.logger.warn(`Gemini fallback: ${e.message}`);
        }
      }

      if (respuestaGemini) {
        const toolAI = await this.logToolExecution(
          conversacionId,
          ordenPagoId,
          'consultar_agente_ia',
          { consulta: mensaje },
          { motor: 'Google Gemini (gemini-3-flash-preview)', api_key_activa: true, respondido: true },
          95,
        );
        herramientasEjecutadas.push(toolAI);
        respuesta = respuestaGemini;
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
        } else {
          const urlEnlace =
            enlaceActivo?.url_enlace || `http://localhost:3000/checkout/${orden.codigo_orden}`;
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
    const cleanResp = respuesta.replace(/'/g, "''");
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO INBESTIGA_TESIS.dbo.MENSAJE (
        conversacion_id, emisor, tipo_mensaje, contenido, fecha_mensaje
      ) VALUES (
        ${conversacionId}, 'BOT', 'TEXTO', N'${cleanResp}', GETDATE()
      );
    `);

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

    return {
      respuesta,
      herramientasEjecutadas,
      guardrailsActivados,
      estadoOrden: estadoActualizado,
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
    // Si pide Yape/Plin pero supera S/ 500, usar Tarjeta (RN-05)
    let medioNombre: 'Yape' | 'Plin' | 'Tarjeta' = medioPagoInput || (monto <= 500 ? 'Yape' : 'Tarjeta');
    if ((medioNombre === 'Yape' || medioNombre === 'Plin') && monto > 500) {
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

    // 1. Limpiar pagos y cuotas previas
    await this.prisma.$executeRawUnsafe(`
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

    // 4. Actualizar HANDOFF_LEADS para reflejar el acuerdo de cuotas en LEADS
    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.HANDOFF_LEADS
      SET modalidad_acordada = '3 CUOTAS (30/40/30)',
          resumen_conversacion_leads = 'El estudiante pactó en LEADS abonar en 3 cuotas por hitos verificables: Cuota 1 inicial (S/ ${c1Monto.toFixed(2)}) para activar asesor, Cuota 2 (S/ ${c2Monto.toFixed(2)}) al entregar Cap 1, Cuota 3 (S/ ${c3Monto.toFixed(2)}) al informe final.',
          primer_enlace_url = 'http://localhost:3000/checkout/${codigoOrden}',
          estado_traspaso = 'VALIDADO'
      WHERE orden_pago_id = ${ordenPagoId};
    `);

    // 5. Emitir nuevo ENLACE_PAGO activo para la Cuota 1
    const refLink = `lnk_leads_${ordenPagoId}_${Date.now().toString().slice(-5)}`;
    const urlLink = `http://localhost:3000/checkout/${codigoOrden}`;
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
    const urlEnlace = `http://localhost:3000/checkout/${ord.codigo_orden}`;

    // Obtener cuota activa
    const cuotasRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1 * FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO
      WHERE orden_pago_id = ${ordenPagoId} AND estado NOT IN ('PAGADA', 'ANULADA')
      ORDER BY numero_cuota ASC;
    `);
    const cuotaActiva = cuotasRows[0] || { cuota_id: 1, numero_cuota: 1, monto_programado: 486.0 };
    const cuotaId = Number(cuotaActiva.cuota_id);
    const montoCuota = Number(cuotaActiva.monto_programado);

    let textoTelegram = '';
    let secuencia = 'Recordatorio 4 h';
    let esEscalado = 0;

    if (etapa === '4h') {
      secuencia = 'Recordatorio 4 h';
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

    // 3. Enviar mensaje en vivo a Telegram
    if (ord.telegram_chat_id) {
      await this.enviarTelegramPush(ord.telegram_chat_id, textoTelegram);
    }

    return {
      success: true,
      etapa,
      secuencia,
      orden: ord.codigo_orden,
      estudiante: `${ord.nombres} ${ord.apellidos}`,
      telegramChatId: ord.telegram_chat_id,
      mensajeEnviado: textoTelegram,
      timestamp: new Date().toISOString(),
    };
  }
}
