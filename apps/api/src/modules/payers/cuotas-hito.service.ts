import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnApplicationBootstrap,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MercadoPagoProvider } from '../payments/providers/mercadopago.provider';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

/**
 * Milestone-gated installments (Option B):
 * - Installments 2..N start as ESPERA_HITO.
 * - When the advisor approves the academic milestone, the installment becomes EXIGIBLE
 *   and the student is notified with the checkout link.
 * - Reminders run only for EXIGIBLE installments; an unapproved milestone past its deadline
 *   is escalated internally (no message to the student).
 *
 * Canal prioritario: WhatsApp (Evolution API). Telegram se usa como canal secundario si el
 * contacto compartió su chat_id. Los recordatorios son ESCALONADOS y con tono variable según
 * los días restantes para el vencimiento.
 */
@Injectable()
export class CuotasHitoService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CuotasHitoService.name);
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPagoProvider: MercadoPagoProvider,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsappService: WhatsAppService,
  ) {}

  onApplicationBootstrap() {
    this.interval = setInterval(
      () => this.procesarRecordatorios().catch((e) => this.logger.error(`Error en recordatorios de cuotas: ${e.message}`)),
      60 * 60 * 1000,
    );
  }

  /**
   * Enlace real de pago en Mercado Pago (Checkout Pro). Si la pasarela no responde, cae al
   * checkout del frontend configurado en lugar de un enlace localhost inválido.
   */
  private async enlacePago(codigoOrden: string, monto: number, nombre?: string, email?: string): Promise<string> {
    const montoSeguro = Number(monto) > 0 ? Number(monto) : 1;
    try {
      const res = await this.mercadoPagoProvider.crearCheckout({
        cotizacionId: codigoOrden,
        monto: montoSeguro,
        moneda: 'PEN',
        descripcion: `INBESTIGA.TESIS - ${codigoOrden}`,
        clienteEmail: email || 'estudiante@inbestiga.pe',
        clienteNombre: nombre,
        cuotas: 1,
      });
      if (res?.checkoutUrl && !res.checkoutUrl.includes('localhost')) return res.checkoutUrl;
    } catch (error: any) {
      this.logger.warn(`No se pudo generar el enlace de Mercado Pago para ${codigoOrden}: ${error.message}`);
    }
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${base}/checkout/${codigoOrden}`;
  }

  private async enviarWhatsApp(telefono: string | null, texto: string): Promise<boolean> {
    if (!telefono) return false;
    try {
      const res = await this.whatsappService.enviarTextoSimple(telefono, texto);
      return res.exito;
    } catch (err: any) {
      this.logger.warn(`No se pudo enviar WhatsApp a ${telefono}: ${err.message}`);
      return false;
    }
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

  /**
   * Envía el aviso por el canal prioritario (WhatsApp) y, si está disponible, por Telegram.
   * Devuelve true si al menos un canal entregó el mensaje.
   */
  private async enviarAviso(cuota: any, texto: string): Promise<boolean> {
    const enviadoWhatsApp = await this.enviarWhatsApp(cuota.telefono, texto);
    const enviadoTelegram = await this.enviarTelegram(cuota.telegram_chat_id, texto);
    return enviadoWhatsApp || enviadoTelegram;
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
             cp.fecha_vencimiento, op.codigo_orden, c.nombres, c.email, c.telefono, c.telegram_chat_id,
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

  private async horasDesdeUltimoEnvio(cuotaId: number): Promise<number> {
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT MAX(fecha_envio) AS ultimo FROM INBESTIGA_TESIS.dbo.ALERTA_COBRANZA WHERE cuota_id = ${cuotaId};
    `);
    const ultimo = rows[0]?.ultimo ? new Date(rows[0].ultimo).getTime() : 0;
    if (!ultimo) return Number.POSITIVE_INFINITY;
    return (Date.now() - ultimo) / (1000 * 60 * 60);
  }

  /**
   * Plan escalonado y variable de recordatorios según los días restantes para el vencimiento.
   * Cada etapa tiene su propia secuencia (evita duplicados) y una ventana mínima entre avisos.
   */
  private planRecordatorio(dias: number): { secuencia: string; gapHoras: number; escalado: boolean } {
    if (dias < 0) return { secuencia: 'Escalado por vencimiento', gapHoras: 24, escalado: true };
    if (dias === 0) return { secuencia: 'Vence hoy', gapHoras: 12, escalado: false };
    if (dias === 1) return { secuencia: 'Vence mañana', gapHoras: 12, escalado: false };
    if (dias <= 3) return { secuencia: 'Recordatorio cercano', gapHoras: 24, escalado: false };
    if (dias <= 7) return { secuencia: 'Recordatorio semanal', gapHoras: 48, escalado: false };
    if (dias <= 15) return { secuencia: 'Recordatorio quincenal', gapHoras: 96, escalado: false };
    return { secuencia: 'Recordatorio mensual', gapHoras: 168, escalado: false };
  }

  private textoRecordatorio(c: any, dias: number, url: string): string {
    const monto = Number(c.monto_programado).toFixed(2);
    const saludo = `Hola ${c.nombres}`;
    const pie = `\n\nPuedes abonar de forma segura aquí: ${url}`;

    if (dias < 0) {
      return (
        `📌 ${saludo}, tu cuota ${c.numero_cuota} (S/ ${monto}) de la orden ${c.codigo_orden} venció hace ${Math.abs(dias)} día(s). ` +
        `Derivamos tu caso a Coordinación de Caja para ayudarte a regularizarla sin recargos.` +
        pie
      );
    }
    if (dias === 0) {
      return `⏰ ${saludo}, hoy vence tu cuota ${c.numero_cuota} (S/ ${monto}) de la orden ${c.codigo_orden}. Regularízala hoy y mantén tu asesoría al día.` + pie;
    }
    if (dias === 1) {
      return `🔔 ${saludo}, tu cuota ${c.numero_cuota} (S/ ${monto}) vence mañana. Evita contratiempos con tu hito académico pagándola ahora.` + pie;
    }
    if (dias <= 3) {
      return `📅 ${saludo}, te recordamos que tu cuota ${c.numero_cuota} (S/ ${monto}) vence en ${dias} días. Tu asesor ya validó el avance; solo falta este paso para continuar.` + pie;
    }
    if (dias <= 7) {
      return `✍️ ${saludo}, tu cuota ${c.numero_cuota} de la orden ${c.codigo_orden} (S/ ${monto}) está habilitada y vence en ${dias} días. Te dejamos el enlace para que la programes con calma.` + pie;
    }
    if (dias <= 15) {
      return `📩 ${saludo}, tienes una cuota habilitada de S/ ${monto} (cuota ${c.numero_cuota}) que vence en ${dias} días. Puedes adelantarla cuando mejor te convenga.` + pie;
    }
    return `ℹ️ ${saludo}, tu cuota ${c.numero_cuota} (S/ ${monto}) ya está habilitada y vence en ${dias} días. Aquí tienes el enlace por si deseas abonarla con anticipación.` + pie;
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
    const url = await this.enlacePago(cuota.codigo_orden, monto, cuota.nombres, cuota.email);
    const texto =
      `Hito académico aprobado\n\n` +
      `Hola ${cuota.nombres}, tu asesor validó este avance de tu proyecto. ` +
      `Ya está habilitada la cuota ${cuota.numero_cuota} de tu orden ${cuota.codigo_orden}.\n\n` +
      `• Monto: S/ ${monto.toFixed(2)}\n` +
      `• Vence: ${String(cuota.fecha_vencimiento).slice(0, 10)}\n` +
      `• Pagar aquí: ${url}`;
    const enviado = await this.enviarAviso(cuota, texto);

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
   * Runs variable/staggered reminders for cobrable installments and escalates overdue ones.
   */
  async procesarRecordatorios() {
    const resumen = { recordatorios: 0, vencimientoProximo: 0, escaladosVencidas: 0, hitosVencidosSinAprobar: 0 };

    const cobrables = await this.cuotasConContacto(
      `cp.estado IN ('EXIGIBLE', 'ENLACE_ENVIADO', 'VENCIDA') AND cp.numero_cuota > 1`,
    );
    for (const c of cobrables) {
      const cuotaId = Number(c.cuota_id);
      const ordenId = Number(c.orden_pago_id);
      const dias = Number(c.dias_para_vencer);
      const plan = this.planRecordatorio(dias);

      if (await this.yaEnviado(cuotaId, plan.secuencia)) continue;
      const horas = await this.horasDesdeUltimoEnvio(cuotaId);
      if (horas < plan.gapHoras) continue;

      const url = await this.enlacePago(c.codigo_orden, Number(c.monto_programado), c.nombres, c.email);
      const texto = this.textoRecordatorio(c, dias, url);
      const enviado = await this.enviarAviso(c, texto);

      await this.registrarAlerta(
        ordenId,
        cuotaId,
        plan.secuencia,
        plan.escalado ? 'Cuota de hito vencida' : 'Cuota de hito pendiente',
        enviado ? 'ENVIADO' : 'SIN_RESPUESTA',
        plan.escalado,
      );

      if (plan.escalado) resumen.escaladosVencidas++;
      else if (dias <= 1) resumen.vencimientoProximo++;
      else resumen.recordatorios++;
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
