import { Injectable, Logger, NotFoundException, BadRequestException, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Milestone-gated installments (Option B):
 * - Installments 2..N start as ESPERA_HITO.
 * - When the advisor approves the academic milestone, the installment becomes EXIGIBLE
 *   and the student is notified with the checkout link.
 * - Reminders run only for EXIGIBLE installments; an unapproved milestone past its deadline
 *   is escalated internally (no message to the student).
 */
@Injectable()
export class CuotasHitoService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CuotasHitoService.name);
  private interval: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    this.interval = setInterval(
      () => this.procesarRecordatorios().catch((e) => this.logger.error(`Error en recordatorios de cuotas: ${e.message}`)),
      60 * 60 * 1000,
    );
  }

  private async enviarTelegram(chatId: any, texto: string): Promise<boolean> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!chatId || !botToken || !botToken.includes(':')) return false;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const axios = require('axios');
    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: texto,
        parse_mode: 'Markdown',
      });
      return true;
    } catch {
      try {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, { chat_id: chatId, text: texto });
        return true;
      } catch (err: any) {
        this.logger.warn(`No se pudo enviar Telegram: ${err.message}`);
        return false;
      }
    }
  }

  private checkoutUrl(codigo: string) {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${base}/checkout/${codigo}`;
  }

  private async registrarAlerta(
    ordenPagoId: number,
    cuotaId: number,
    secuencia: string,
    tipo: string,
    resultado: string,
    escalado: boolean,
  ) {
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO INBESTIGA_TESIS.dbo.ALERTA_COBRANZA (orden_pago_id, cuota_id, fecha_envio, secuencia, tipo, resultado, escalado)
      VALUES (${ordenPagoId}, ${cuotaId}, GETDATE(), N'${secuencia}', N'${tipo}', '${resultado}', ${escalado ? 1 : 0});
    `);
  }

  private async cuotasConContacto(where: string): Promise<any[]> {
    return this.prisma.$queryRawUnsafe(`
      SELECT cp.cuota_id, cp.orden_pago_id, cp.numero_cuota, cp.monto_programado, cp.condicion, cp.estado,
             cp.fecha_vencimiento, op.codigo_orden, c.nombres, c.telegram_chat_id,
             DATEDIFF(DAY, CAST(GETDATE() AS DATE), cp.fecha_vencimiento) AS dias_para_vencer
      FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO cp
      INNER JOIN INBESTIGA_TESIS.dbo.ORDEN_PAGO op ON op.orden_pago_id = cp.orden_pago_id
      INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = op.propuesta_id
      INNER JOIN INBESTIGA_TESIS.dbo.LEAD l ON l.lead_id = pr.lead_id
      INNER JOIN INBESTIGA_TESIS.dbo.BUYER b ON b.buyer_id = l.buyer_id
      INNER JOIN INBESTIGA_TESIS.dbo.CONTACTO c ON c.contacto_id = b.contacto_id
      WHERE ${where}
      ORDER BY cp.orden_pago_id, cp.numero_cuota;
    `);
  }

  private async yaEnviado(cuotaId: number, secuencia: string): Promise<boolean> {
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1 1 AS ok FROM INBESTIGA_TESIS.dbo.ALERTA_COBRANZA
      WHERE cuota_id = ${cuotaId} AND secuencia = N'${secuencia}';
    `);
    return rows.length > 0;
  }

  /**
   * Advisor approves the academic milestone tied to an installment: ESPERA_HITO -> EXIGIBLE.
   */
  async aprobarHito(ordenPagoId: number, numeroCuota: number) {
    const rows = await this.cuotasConContacto(
      `cp.orden_pago_id = ${Number(ordenPagoId)} AND cp.numero_cuota = ${Number(numeroCuota)}`,
    );
    if (!rows.length) throw new NotFoundException(`Cuota ${numeroCuota} de la orden ${ordenPagoId} no encontrada.`);
    const cuota = rows[0];
    if (cuota.estado !== 'ESPERA_HITO') {
      throw new BadRequestException(`La cuota ${numeroCuota} está en estado ${cuota.estado}; solo se habilita desde ESPERA_HITO.`);
    }

    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.CUOTA_PAGO SET estado = 'EXIGIBLE' WHERE cuota_id = ${Number(cuota.cuota_id)};
    `);

    const monto = Number(cuota.monto_programado);
    const texto =
      `Hito académico aprobado\n\n` +
      `Hola ${cuota.nombres}, tu asesor validó este avance de tu proyecto. ` +
      `Ya está habilitada la cuota ${cuota.numero_cuota} de tu orden ${cuota.codigo_orden}.\n\n` +
      `• Monto: S/ ${monto.toFixed(2)}\n` +
      `• Vence: ${String(cuota.fecha_vencimiento).slice(0, 10)}\n` +
      `• Pagar aquí: ${this.checkoutUrl(cuota.codigo_orden)}`;
    const enviado = await this.enviarTelegram(cuota.telegram_chat_id, texto);

    await this.registrarAlerta(
      Number(cuota.orden_pago_id),
      Number(cuota.cuota_id),
      'Cuota exigible',
      'Cuota de hito pendiente',
      enviado ? 'ENVIADO' : 'SIN_RESPUESTA',
      false,
    );

    return {
      status: 'exigible',
      orden: cuota.codigo_orden,
      cuota: Number(cuota.numero_cuota),
      monto,
      notificado: enviado,
    };
  }

  /**
   * Reverts an EXIGIBLE installment back to ESPERA_HITO (if not yet paid).
   */
  async revertirHito(ordenPagoId: number, numeroCuota: number) {
    const rows = await this.cuotasConContacto(
      `cp.orden_pago_id = ${Number(ordenPagoId)} AND cp.numero_cuota = ${Number(numeroCuota)}`,
    );
    if (!rows.length) throw new NotFoundException(`Cuota ${numeroCuota} de la orden ${ordenPagoId} no encontrada.`);
    const cuota = rows[0];
    if (cuota.estado === 'PAGADA') {
      throw new BadRequestException(`La cuota ${numeroCuota} ya está PAGADA y no puede revertirse.`);
    }
    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.CUOTA_PAGO SET estado = 'ESPERA_HITO' WHERE cuota_id = ${Number(cuota.cuota_id)};
      DELETE FROM INBESTIGA_TESIS.dbo.ALERTA_COBRANZA WHERE cuota_id = ${Number(cuota.cuota_id)};
    `);
    return {
      status: 'espera_hito',
      orden: cuota.codigo_orden,
      cuota: Number(cuota.numero_cuota),
      monto: Number(cuota.monto_programado),
    };
  }

  /**
   * Runs reminders for EXIGIBLE installments and escalates overdue unapproved milestones.
   */
  async procesarRecordatorios() {
    const resumen = { recordatorios: 0, vencimientoProximo: 0, escaladosVencidas: 0, hitosVencidosSinAprobar: 0 };

    const exigibles = await this.cuotasConContacto(`cp.estado = 'EXIGIBLE' AND cp.numero_cuota > 1`);
    for (const c of exigibles) {
      const cuotaId = Number(c.cuota_id);
      const ordenId = Number(c.orden_pago_id);
      const dias = Number(c.dias_para_vencer);
      const monto = Number(c.monto_programado).toFixed(2);
      const url = this.checkoutUrl(c.codigo_orden);

      if (dias < 0) {
        if (await this.yaEnviado(cuotaId, 'Escalado por vencimiento')) continue;
        await this.registrarAlerta(ordenId, cuotaId, 'Escalado por vencimiento', 'Cuota de hito pendiente', 'ESCALADO', true);
        await this.enviarTelegram(
          c.telegram_chat_id,
          `Tu cuota ${c.numero_cuota} (S/ ${monto}) de la orden ${c.codigo_orden} venció. ` +
            `Derivamos tu caso a Coordinación de Caja para ayudarte a regularizarla: ${url}`,
        );
        resumen.escaladosVencidas++;
      } else if (dias <= 1) {
        if (await this.yaEnviado(cuotaId, 'Vence pronto')) continue;
        await this.registrarAlerta(ordenId, cuotaId, 'Vence pronto', 'Cuota de hito pendiente', 'ENVIADO', false);
        await this.enviarTelegram(
          c.telegram_chat_id,
          `Hola ${c.nombres}, tu cuota ${c.numero_cuota} (S/ ${monto}) vence ${dias === 0 ? 'hoy' : 'mañana'}. Pagá acá: ${url}`,
        );
        resumen.vencimientoProximo++;
      } else {
        const rec: any[] = await this.prisma.$queryRawUnsafe(`
          SELECT MAX(fecha_envio) AS ultimo FROM INBESTIGA_TESIS.dbo.ALERTA_COBRANZA WHERE cuota_id = ${cuotaId};
        `);
        const ultimo = rec[0]?.ultimo ? new Date(rec[0].ultimo).getTime() : 0;
        if (Date.now() - ultimo < 3 * 24 * 60 * 60 * 1000) continue;
        await this.registrarAlerta(ordenId, cuotaId, 'Recordatorio 3 d', 'Cuota de hito pendiente', 'ENVIADO', false);
        await this.enviarTelegram(
          c.telegram_chat_id,
          `Hola ${c.nombres}, te recordamos que tu cuota ${c.numero_cuota} (S/ ${monto}) está habilitada y vence en ${dias} días. Pagá acá: ${url}`,
        );
        resumen.recordatorios++;
      }
    }

    // Milestone not approved by its deadline: internal escalation only (student is not charged or messaged).
    const vencidos = await this.cuotasConContacto(`cp.estado = 'ESPERA_HITO' AND cp.fecha_vencimiento < CAST(GETDATE() AS DATE)`);
    for (const c of vencidos) {
      const cuotaId = Number(c.cuota_id);
      if (await this.yaEnviado(cuotaId, 'Hito vencido sin aprobar')) continue;
      await this.registrarAlerta(Number(c.orden_pago_id), cuotaId, 'Hito vencido sin aprobar', 'Hito sin aprobar', 'ESCALADO', true);
      this.logger.warn(`Hito vencido sin aprobar: orden ${c.codigo_orden}, cuota ${c.numero_cuota} (${c.condicion}).`);
      resumen.hitosVencidosSinAprobar++;
    }

    return resumen;
  }
}
