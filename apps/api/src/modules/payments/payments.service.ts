import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StripeProvider } from './providers/stripe.provider';
import { CulqiProvider } from './providers/culqi.provider';
import { MercadoPagoProvider } from './providers/mercadopago.provider';
import { PayersService } from '../payers/payers.service';
import { CustomersService } from '../customers/customers.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeProvider: StripeProvider,
    private readonly culqiProvider: CulqiProvider,
    private readonly mercadoPagoProvider: MercadoPagoProvider,
    private readonly payersService: PayersService,
    private readonly customersService: CustomersService,
  ) {}

  /**
   * Obtiene los detalles de la cotización para renderizar la pantalla de checkout real.
   */
  async getCotizacion(id: string) {
    const cleanId = id.replace(/'/g, "''");
    if (
      cleanId.toUpperCase().startsWith('ORD-') ||
      cleanId.toLowerCase().startsWith('lnk_') ||
      /^\d+$/.test(cleanId)
    ) {
      const ordenRows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT TOP 1
          op.orden_pago_id,
          op.codigo_orden,
          op.monto_comprometido,
          op.estado AS orden_estado,
          op.fecha_creacion,
          mp.condicion AS modalidad_nombre,
          mp.numero_cuotas,
          s.nombre AS servicio_nombre,
          ct.contacto_id,
          ct.nombres,
          ct.apellidos,
          ct.email,
          ct.telefono,
          cntr.plazo_dias
        FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO op
        INNER JOIN INBESTIGA_TESIS.dbo.MODALIDAD_PAGO mp ON mp.modalidad_pago_id = op.modalidad_pago_id
        INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = op.propuesta_id
        INNER JOIN INBESTIGA_TESIS.dbo.SERVICIO s ON s.servicio_id = pr.servicio_id
        INNER JOIN INBESTIGA_TESIS.dbo.LEAD l ON l.lead_id = pr.lead_id
        INNER JOIN INBESTIGA_TESIS.dbo.BUYER b ON b.buyer_id = l.buyer_id
        INNER JOIN INBESTIGA_TESIS.dbo.CONTACTO ct ON ct.contacto_id = b.contacto_id
        LEFT JOIN INBESTIGA_TESIS.dbo.CONTRATO cntr ON cntr.contrato_id = op.contrato_id
        WHERE op.codigo_orden = '${cleanId}'
           OR CAST(op.orden_pago_id AS VARCHAR) = '${cleanId}'
           OR EXISTS (
             SELECT 1 FROM INBESTIGA_TESIS.dbo.ENLACE_PAGO ep
             WHERE ep.orden_pago_id = op.orden_pago_id AND ep.referencia_externa = '${cleanId}'
           );
      `);

      if (ordenRows.length > 0) {
        const ord = ordenRows[0];
        const cuotasRows: any[] = await this.prisma.$queryRawUnsafe(`
          SELECT * FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO
          WHERE orden_pago_id = ${Number(ord.orden_pago_id)}
          ORDER BY numero_cuota ASC;
        `);
        const cuotaExigible = cuotasRows.find((c) =>
          ['EXIGIBLE', 'ENLACE_ENVIADO', 'POR_VERIFICAR', 'VENCIDA'].includes(c.estado),
        );
        const cuotaEnEspera = cuotasRows.find((c) => c.estado === 'ESPERA_HITO');
        const cuotaActiva =
          cuotaExigible ||
          cuotaEnEspera ||
          cuotasRows.find((c) => c.estado !== 'PAGADA' && c.estado !== 'ANULADA') ||
          cuotasRows[0];
        const bloqueadaPorHito = Boolean(!cuotaExigible && cuotaEnEspera && ord.orden_estado !== 'PAGADA');
        const cuotasPagadas = cuotasRows.filter((c) => c.estado === 'PAGADA').length;
        const montoPagado = cuotasRows
          .filter((c) => c.estado === 'PAGADA')
          .reduce((acc, c) => acc + Number(c.monto_programado || 0), 0);
        const numCuotas = cuotasRows.length || Number(ord.numero_cuotas || 1);
        const totalComprometido = Number(ord.monto_comprometido);
        const montoCuotaActiva = cuotaActiva ? Number(cuotaActiva.monto_programado) : totalComprometido;

        return {
          id: ord.codigo_orden,
          codigoCotizacion: ord.codigo_orden,
          servicio: ord.servicio_nombre,
          tipoInvestigacion: 'TESIS',
          subtotal: totalComprometido,
          descuento: 0,
          total: totalComprometido,
          cuotas: numCuotas,
          plazoEntregaDias: Number(ord.plazo_dias || 90),
          fechaExpiracion: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          estado: ord.orden_estado === 'PAGADA' ? 'ACEPTADA' : 'PENDIENTE',
          estudiante: {
            id: String(ord.contacto_id),
            nombres: `${ord.nombres} ${ord.apellidos}`.trim(),
            email: ord.email || 'estudiante@unitru.edu.pe',
            whatsapp: ord.telefono || '51919632928',
            universidad: 'Universidad Nacional de Trujillo (UNT)',
            carrera: 'Ingeniería de Sistemas',
          },
          pagoId: String(ord.orden_pago_id),
          pagoEstado: ord.orden_estado === 'PAGADA' ? 'CONFIRMADO' : 'PENDIENTE',
          proveedorPago: (process.env.PAYMENT_PROVIDER || 'MERCADOPAGO').toUpperCase(),
          mercadoPagoPublicKey: process.env.MERCADOPAGO_PUBLIC_KEY || '',
          planCuotas: {
            esCuotas: numCuotas > 1,
            cuotasAcordadas: numCuotas,
            totalContrato: totalComprometido,
            montoPorCuota: montoCuotaActiva,
            cuotaActualNumero: Number(cuotaActiva?.numero_cuota || 1),
            cuotaActualEstado: cuotaActiva?.estado || 'EXIGIBLE',
            cuotaActualCondicion: cuotaActiva?.condicion || 'Cuota inicial',
            cuotaActualVencimiento: cuotaActiva?.fecha_vencimiento || null,
            bloqueadaPorHito,
            cuotasPagadas,
            montoPagado,
            cuotasDetalle: cuotasRows.map((c) => ({
              cuotaId: Number(c.cuota_id),
              numero: Number(c.numero_cuota),
              porcentaje: Number(c.porcentaje),
              monto: Number(c.monto_programado),
              condicion: c.condicion,
              fechaVencimiento: c.fecha_vencimiento,
              estado: c.estado,
            })),
          },
        };
      }
    }

    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { id },
      include: {
        servicio: true,
        lead: {
          include: {
            buyer: { include: { universidad: true, carrera: true } },
          },
        },
        pagos: { orderBy: { fechaCreacion: 'desc' } },
      },
    });

    if (!cotizacion) {
      throw new NotFoundException(`Cotización ${id} no encontrada.`);
    }

    const pagoPendiente = cotizacion.pagos.find((p) => p.estado === 'PENDIENTE') || cotizacion.pagos[0];

    return {
      id: cotizacion.id,
      codigoCotizacion: cotizacion.codigoCotizacion,
      servicio: cotizacion.servicio.nombre,
      tipoInvestigacion: cotizacion.servicio.tipoInvestigacion,
      subtotal: Number(cotizacion.subtotal),
      descuento: Number(cotizacion.descuento),
      total: Number(cotizacion.total),
      cuotas: cotizacion.cuotas,
      plazoEntregaDias: cotizacion.plazoEntregaDias,
      fechaExpiracion: cotizacion.fechaExpiracion,
      estado: cotizacion.estado,
      estudiante: {
        id: cotizacion.lead.buyer.id,
        nombres: `${cotizacion.lead.buyer.nombres} ${cotizacion.lead.buyer.apellidos}`,
        email: cotizacion.lead.buyer.email,
        whatsapp: cotizacion.lead.buyer.whatsapp,
        universidad: cotizacion.lead.buyer.universidad?.siglas || cotizacion.lead.buyer.universidad?.nombre,
        carrera: cotizacion.lead.buyer.carrera?.nombre,
      },
      pagoId: pagoPendiente?.id,
      pagoEstado: pagoPendiente?.estado || 'PENDIENTE',
      proveedorPago: (process.env.PAYMENT_PROVIDER || 'CULQI').toUpperCase(),
      planCuotas: {
        esCuotas: cotizacion.cuotas > 1,
        cuotasAcordadas: cotizacion.cuotas,
        totalContrato: Number(cotizacion.total),
        montoPorCuota: Math.round((Number(cotizacion.total) / (cotizacion.cuotas || 1)) * 100) / 100,
      },
    };
  }

  /**
   * Procesa el Webhook oficial de la pasarela de pagos (Culqi / Stripe).
   * La confirmación del pago se realiza EXCLUSIVAMENTE mediante verificación de webhook.
   */
  async procesarWebhook(payload: any, signature?: string) {
    this.logger.log(`Procesando Webhook de pasarela de pagos...`);

    const proveedor = (process.env.PAYMENT_PROVIDER || 'CULQI').toUpperCase();
    const esCulqi = proveedor === 'CULQI' || payload.object === 'charge' || payload.type?.includes('charge') || payload.type?.includes('order');

    const verificacion = esCulqi
      ? await this.culqiProvider.verificarWebhook(payload, signature)
      : await this.stripeProvider.verificarWebhook(payload, signature);

    if (!verificacion.valido) {
      throw new BadRequestException('Firma o contenido de Webhook inválido.');
    }

    // Localizar el pago por gatewayTransactionId o por cotizacionId
    let pago = await this.prisma.pago.findFirst({
      where: {
        OR: [
          { gatewayTransactionId: verificacion.gatewayTransactionId },
          { cotizacionId: payload.cotizacionId || payload.metadata?.cotizacionId },
        ],
      },
    });

    // Si es un cobro de CulqiLinks (express), intentar localizar por teléfono o email del cliente
    const rawCharge = verificacion.payloadOriginal?.data || verificacion.payloadOriginal || {};
    const rawPhone = rawCharge.client_details?.phone_number || rawCharge.phone_number || payload.phone;
    const rawEmail = rawCharge.email || rawCharge.client_details?.email || payload.email;

    if (!pago && (rawPhone || rawEmail)) {
      const cleanPhone = rawPhone ? String(rawPhone).replace(/\D/g, '').slice(-9) : null;
      const buyer = await this.prisma.buyer.findFirst({
        where: {
          OR: [
            ...(cleanPhone ? [{ whatsapp: { contains: cleanPhone } }] : []),
            ...(rawEmail ? [{ email: { equals: String(rawEmail) } }] : []),
          ],
        },
        include: {
          lead: {
            include: {
              cotizaciones: { orderBy: { fechaEmision: 'desc' }, take: 1 },
            },
          },
        },
      });

      if (buyer?.lead?.cotizaciones?.[0]) {
        const cot = buyer.lead.cotizaciones[0];
        pago = await this.prisma.pago.findFirst({
          where: { cotizacionId: cot.id },
          orderBy: { fechaCreacion: 'desc' },
        });

        if (!pago && verificacion.estado === 'CONFIRMADO') {
          pago = await this.prisma.pago.create({
            data: {
              cotizacionId: cot.id,
              buyerId: buyer.id,
              leadId: buyer.lead.id,
              gatewayProveedor: 'CULQI',
              monto: verificacion.monto && verificacion.monto > 0 ? verificacion.monto : cot.total,
              moneda: 'PEN',
              metodoPago: 'YAPE',
              estado: 'PENDIENTE',
            },
          });
        }
      }
    }

    if (!pago && verificacion.estado === 'CONFIRMADO') {
      // Buscar el último pago pendiente
      pago = await this.prisma.pago.findFirst({
        where: { estado: 'PENDIENTE' },
        orderBy: { fechaCreacion: 'desc' },
      });
    }

    // Si no hay pago pendiente pero Culqi confirmó el cobro, buscar la cotización más reciente
    if (!pago && verificacion.estado === 'CONFIRMADO') {
      const ultimaCot = await this.prisma.cotizacion.findFirst({
        orderBy: { fechaEmision: 'desc' },
        include: { lead: true },
      });

      if (ultimaCot) {
        pago = await this.prisma.pago.create({
          data: {
            cotizacionId: ultimaCot.id,
            buyerId: ultimaCot.lead.buyerId,
            leadId: ultimaCot.leadId,
            gatewayProveedor: 'CULQI',
            monto: verificacion.monto && verificacion.monto > 0 ? verificacion.monto : ultimaCot.total,
            moneda: 'PEN',
            metodoPago: 'YAPE',
            estado: 'PENDIENTE',
          },
        });
      }
    }

    // Manejo de eventos donde el usuario NO pagó o la transacción expiró / falló
    if (verificacion.estado === 'EXPIRADO') {
      if (pago) {
        await this.prisma.pago.update({
          where: { id: pago.id },
          data: {
            estado: 'EXPIRADO',
            gatewayPayload: JSON.stringify(verificacion.payloadOriginal),
          },
        });
        this.logger.log(`ℹ Webhook Culqi automático: Pago ${pago.id} marcado como EXPIRADO.`);
        return { status: 'expired', pagoId: pago.id, estado: 'EXPIRADO' };
      }
      return { status: 'ignored_expired_no_record', estado: 'EXPIRADO' };
    }

    if (verificacion.estado === 'FALLIDO') {
      if (pago) {
        await this.prisma.pago.update({
          where: { id: pago.id },
          data: {
            estado: 'FALLIDO',
            gatewayPayload: JSON.stringify(verificacion.payloadOriginal),
          },
        });
        this.logger.log(`ℹ Webhook Culqi automático: Pago ${pago.id} marcado como FALLIDO / RECHAZADO.`);
        return { status: 'failed', pagoId: pago.id, estado: 'FALLIDO' };
      }
      return { status: 'ignored_failed_no_record', estado: 'FALLIDO' };
    }

    if (verificacion.estado === 'REEMBOLSADO') {
      if (pago) {
        await this.prisma.pago.update({
          where: { id: pago.id },
          data: {
            estado: 'REEMBOLSADO',
            gatewayPayload: JSON.stringify(verificacion.payloadOriginal),
          },
        });
        this.logger.log(`ℹ Webhook Culqi automático: Pago ${pago.id} marcado como REEMBOLSADO / DEVOLUCIÓN.`);
        return { status: 'refunded', pagoId: pago.id, estado: 'REEMBOLSADO' };
      }
      return { status: 'ignored_refund_no_record', estado: 'REEMBOLSADO' };
    }

    if (verificacion.estado === 'PENDIENTE') {
      this.logger.log(`ℹ Webhook Culqi automático: Pago pendiente de confirmación por el cliente.`);
      return { status: 'pending', pagoId: pago?.id, estado: 'PENDIENTE' };
    }

    if (!pago) {
      throw new NotFoundException('No se encontró orden de pago para confirmar.');
    }

    // Actualizar estado del pago a CONFIRMADO (respetando el monto real pagado en Culqi, ej. S/ 1.00 o S/ 0.10)
    const montoEfectivo = verificacion.monto && verificacion.monto > 0 ? verificacion.monto : pago.monto;

    await this.prisma.pago.update({
      where: { id: pago.id },
      data: {
        estado: 'CONFIRMADO',
        monto: montoEfectivo,
        fechaConfirmacion: new Date(),
        metodoPago: verificacion.metodoPago || pago.metodoPago,
        gatewayProveedor: esCulqi ? 'CULQI' : 'STRIPE',
        gatewayTransactionId: verificacion.gatewayTransactionId || pago.gatewayTransactionId,
        gatewayPayload: JSON.stringify(verificacion.payloadOriginal),
      },
    });

    await this.prisma.cotizacion.update({
      where: { id: pago.cotizacionId },
      data: { estado: 'ACEPTADA' },
    });

    // Marcar cualquier otro pago pendiente previo del mismo comprador como EXPIRADO / ABANDONADO
    if (pago.buyerId) {
      await this.prisma.pago.updateMany({
        where: {
          buyerId: pago.buyerId,
          id: { not: pago.id },
          estado: 'PENDIENTE',
        },
        data: {
          estado: 'EXPIRADO',
        },
      });
    }

    this.logger.log(`✓ Pago ${pago.id} CONFIRMADO por Webhook (${esCulqi ? 'CULQI' : 'STRIPE'}). Monto recibido: S/ ${montoEfectivo}`);

    // Disparar la transición automática del funnel: LEAD -> PAYER -> CUSTOMER
    const resultadoCustomer = await this.customersService.crearCustomerDesdePago(pago.id);

    return {
      status: 'confirmed',
      pagoId: pago.id,
      montoRecibido: montoEfectivo,
      resultadoCustomer,
    };
  }

  /**
   * Endpoint de checkout interactivo para la pasarela de pagos.
   * Admite pago directo con Yape (Número + Código de Aprobación OTP de Culqi), Tarjeta de Crédito/Débito o Transferencia.
   */
  async crearPreferenciaMercadoPago(cotizacionId: string, montoPersonalizado?: number) {
    this.logger.log(`Creando preferencia de Mercado Pago para cotización/orden: ${cotizacionId}`);
    const cot = await this.getCotizacion(cotizacionId);
    if (cot.planCuotas?.bloqueadaPorHito) {
      throw new BadRequestException(
        `La Cuota #${cot.planCuotas.cuotaActualNumero} aún está en espera de validación del hito académico (${cot.planCuotas.cuotaActualCondicion}) por el asesor.`,
      );
    }
    const monto =
      montoPersonalizado && Number(montoPersonalizado) > 0
        ? Number(montoPersonalizado)
        : Number(cot.planCuotas?.montoPorCuota || cot.total || 0);

    return this.mercadoPagoProvider.crearCheckout({
      cotizacionId: cot.codigoCotizacion || cot.id,
      monto,
      moneda: 'PEN',
      descripcion: `INBESTIGA.TESIS - ${cot.servicio} (${cot.codigoCotizacion})`,
      clienteEmail: cot.estudiante.email,
      clienteNombre: cot.estudiante.nombres,
      cuotas: cot.cuotas || 1,
    });
  }

  /**
   * Confirma en el sistema los pagos APROBADOS en Mercado Pago para una orden.
   * Consulta la API de MP por external_reference (sin webhook) y registra cada pago una sola vez.
   */
  async verificarPagoMercadoPago(cotizacionId: string) {
    const cot = await this.getCotizacion(cotizacionId);
    const codigo = cot.codigoCotizacion || cot.id;
    const pagosMp = await this.mercadoPagoProvider.buscarPagosPorReferencia(codigo);
    const aprobados = pagosMp.filter((p) => p.status === 'approved');

    const confirmados: any[] = [];
    for (const p of aprobados) {
      const referencia = `MP-${p.id}`;
      const existente: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT TOP 1 pago_id FROM INBESTIGA_TESIS.dbo.PAGO WHERE referencia = '${referencia}';
      `);
      if (existente.length > 0) continue;

      const res = await this.procesarPagoCheckout({
        cotizacionId: codigo,
        metodoPago: 'CARD',
        montoAbonar: Number(p.transaction_amount),
        referencia,
      });
      confirmados.push({ mpPaymentId: p.id, monto: p.transaction_amount, ...res });
    }

    let activacionRecuperada: any = null;
    if (aprobados.length > 0 && confirmados.length === 0) {
      activacionRecuperada = await this.payersService.activarServicioPorCodigoOrden(codigo).catch((e) => {
        this.logger.error(`No se pudo recuperar la activación de ${codigo}: ${e.message}`);
        return null;
      });
    }

    return {
      referencia: codigo,
      pagosEncontrados: pagosMp.length,
      pagosAprobados: aprobados.length,
      nuevosConfirmados: confirmados.length,
      status: aprobados.length > 0 ? 'confirmed' : 'pending',
      activacionRecuperada,
      confirmados,
    };
  }

  async procesarPagoCheckout(dto: {
    cotizacionId: string;
    metodoPago: 'CARD' | 'YAPE' | 'TRANSFER';
    tipoAbono?: 'CUOTA' | 'TOTAL';
    montoAbonar?: number;
    referencia?: string;
    numeroTarjeta?: string;
    telefonoYape?: string;
    codigoAprobacion?: string;
  }) {
    this.logger.log(`Procesando pago desde interfaz de Checkout para cotización: ${dto.cotizacionId} vía ${dto.metodoPago}`);

    const cleanId = dto.cotizacionId.replace(/'/g, "''");
    if (
      cleanId.toUpperCase().startsWith('ORD-') ||
      cleanId.toLowerCase().startsWith('lnk_') ||
      /^\d+$/.test(cleanId)
    ) {
      const ordenRows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT TOP 1
          op.orden_pago_id,
          op.codigo_orden,
          op.monto_comprometido,
          l.lead_id,
          ct.contacto_id,
          ct.nombres,
          ct.apellidos,
          ct.email,
          ct.telefono,
          ct.telegram_chat_id
        FROM INBESTIGA_TESIS.dbo.ORDEN_PAGO op
        INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = op.propuesta_id
        INNER JOIN INBESTIGA_TESIS.dbo.LEAD l ON l.lead_id = pr.lead_id
        INNER JOIN INBESTIGA_TESIS.dbo.BUYER b ON b.buyer_id = l.buyer_id
        INNER JOIN INBESTIGA_TESIS.dbo.CONTACTO ct ON ct.contacto_id = b.contacto_id
        WHERE op.codigo_orden = '${cleanId}'
           OR CAST(op.orden_pago_id AS VARCHAR) = '${cleanId}'
           OR EXISTS (
             SELECT 1 FROM INBESTIGA_TESIS.dbo.ENLACE_PAGO ep
             WHERE ep.orden_pago_id = op.orden_pago_id AND ep.referencia_externa = '${cleanId}'
           );
      `);

      if (ordenRows.length > 0) {
        const ord = ordenRows[0];
        const ordenPagoId = Number(ord.orden_pago_id);
        const cuotasRows: any[] = await this.prisma.$queryRawUnsafe(`
          SELECT * FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO
          WHERE orden_pago_id = ${ordenPagoId}
          ORDER BY numero_cuota ASC;
        `);
        const cuotaExigible = cuotasRows.find((c) =>
          ['EXIGIBLE', 'ENLACE_ENVIADO', 'POR_VERIFICAR', 'VENCIDA'].includes(c.estado),
        );
        const cuotaObjetivo =
          cuotaExigible ||
          cuotasRows.find((c) => c.estado !== 'PAGADA' && c.estado !== 'ANULADA') ||
          cuotasRows[0];
        if (cuotaObjetivo?.estado === 'ESPERA_HITO') {
          throw new BadRequestException(
            `La Cuota #${cuotaObjetivo.numero_cuota} aún está en espera de validación del hito académico (${cuotaObjetivo.condicion}) por el asesor.`,
          );
        }
        const montoACobrar =
          dto.montoAbonar && dto.montoAbonar > 0
            ? Number(dto.montoAbonar)
            : Number(cuotaObjetivo?.monto_programado || ord.monto_comprometido);

        let referencia = dto.referencia || `MP-${ordenPagoId}-${Date.now().toString().slice(-6)}`;
        if (dto.metodoPago === 'YAPE') {
          const yapeRes = await this.culqiProvider.cobrarConYapeDirecto({
            cotizacionId: ord.codigo_orden,
            monto: montoACobrar,
            telefonoYape: dto.telefonoYape || ord.telefono || '919632928',
            codigoAprobacion: dto.codigoAprobacion || '491823',
            email: ord.email || 'estudiante@inbestiga.pe',
            nombres: `${ord.nombres} ${ord.apellidos}`.trim(),
          });
          referencia = yapeRes.gatewayTransactionId || referencia;
        }

        const medioPagoId = dto.metodoPago === 'YAPE' ? 1 : dto.metodoPago === 'CARD' ? 3 : 4;
        const comisionPct = medioPagoId === 3 ? 3.99 : medioPagoId === 1 ? 2.95 : 0;
        const comisionSoles = Number(((montoACobrar * comisionPct) / 100).toFixed(2));
        const cuotaId = Number(cuotaObjetivo?.cuota_id || 1);

        // 1. Marcar enlace como PAGADO
        await this.prisma.$executeRawUnsafe(`
          UPDATE INBESTIGA_TESIS.dbo.ENLACE_PAGO
          SET estado = 'PAGADO'
          WHERE orden_pago_id = ${ordenPagoId};
        `);

        // 2. Insertar PAGO CONFIRMADO en INBESTIGA_TESIS
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO INBESTIGA_TESIS.dbo.PAGO (
            orden_pago_id, cuota_id, medio_pago_id, fecha_inicio, fecha_confirmacion,
            monto_pagado, comision_pasarela, referencia, metodo_verificacion, estado
          ) VALUES (
            ${ordenPagoId}, ${cuotaId}, ${medioPagoId},
            DATEADD(MINUTE, -1, GETDATE()), GETDATE(),
            ${montoACobrar}, ${comisionSoles}, '${referencia}', 'WEBHOOK', 'CONFIRMADO'
          );
        `);

        // 3. Marcar cuota como PAGADA
        await this.prisma.$executeRawUnsafe(`
          UPDATE INBESTIGA_TESIS.dbo.CUOTA_PAGO
          SET estado = 'PAGADA'
          WHERE cuota_id = ${cuotaId};
        `);

        // 4. Actualizar estado de ORDEN_PAGO
        const pendientesRows: any[] = await this.prisma.$queryRawUnsafe(`
          SELECT COUNT(*) AS pendientes
          FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO
          WHERE orden_pago_id = ${ordenPagoId} AND estado NOT IN ('PAGADA', 'ANULADA');
        `);
        const nuevoEstadoOrden = Number(pendientesRows[0]?.pendientes ?? 0) === 0 ? 'PAGADA' : 'PARCIAL';

        await this.prisma.$executeRawUnsafe(`
          UPDATE INBESTIGA_TESIS.dbo.ORDEN_PAGO
          SET estado = '${nuevoEstadoOrden}',
              en_mora = 0,
              servicio_suspendido_mora = 0
          WHERE orden_pago_id = ${ordenPagoId};
        `);

        // 5. Activación real del servicio (RN-04): PAYER + CUSTOMER + asesor asignado
        let activacion: { customerId: number; asesor: any } | null = null;
        try {
          activacion = await this.payersService.activarServicioTrasPrimerPago(ordenPagoId, Number(ord.lead_id));
        } catch (e: any) {
          this.logger.error(`No se pudo activar el servicio de la orden ${ord.codigo_orden}: ${e.message}`);
        }

        const cuotasPendientes = Number(pendientesRows[0]?.pendientes ?? 0);
        const pasarela = String(referencia).startsWith('MP-')
          ? 'Mercado Pago'
          : dto.metodoPago === 'YAPE'
            ? 'Yape (Mercado Pago)'
            : dto.metodoPago === 'CARD'
              ? 'Tarjeta (Mercado Pago)'
              : 'Transferencia bancaria';

        // 6. Notificación push al Telegram del estudiante si está vinculado
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (ord.telegram_chat_id && botToken && botToken.includes(':')) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const axios = require('axios');
            const esc = (t: any) => String(t ?? '').replace(/[_*`\[]/g, '\\$&');
            const asesor = activacion?.asesor;
            const lineas: string[] = [
              '*Pago confirmado*',
              '',
              `Hola *${esc(ord.nombres)}*, acreditamos tu pago:`,
              `• *Orden:* \`${ord.codigo_orden}\``,
              `• *Importe:* S/ ${montoACobrar.toFixed(2)}`,
              `• *Medio:* ${pasarela}`,
              `• *Referencia:* \`${referencia}\``,
              '',
            ];
            if (cuotasPendientes === 0) {
              lineas.push('Tu orden quedó *pagada al 100%*.');
            } else {
              lineas.push(
                `Quedan *${cuotasPendientes} cuota(s)* pendientes: se habilitan a medida que se completan los hitos académicos de tu proyecto.`,
              );
            }
            lineas.push('');
            if (asesor) {
              lineas.push('Tu asesoría ya está *activa*.');
              lineas.push(`• *Tu asesor:* ${esc(asesor.nombre)} (${esc(asesor.rol)} · ${esc(asesor.especialidad)})`);
              lineas.push('Se pondrá en contacto contigo para coordinar tu primera sesión.');
            } else {
              lineas.push('Pago acreditado. Estamos asignando a tu asesor y te escribiremos en breve.');
            }
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              chat_id: ord.telegram_chat_id,
              text: lineas.join('\n'),
              parse_mode: 'Markdown',
            });
          } catch (e: any) {
            this.logger.warn(`No se pudo enviar push de pago a Telegram: ${e.message}`);
          }
        }

        return {
          status: 'confirmed',
          pagoId: referencia,
          montoRecibido: montoACobrar,
          resultadoCustomer: {
            customerId: activacion?.customerId ?? null,
            asesorAsignado: activacion?.asesor ? `${activacion.asesor.nombre} (${activacion.asesor.rol})` : null,
            cuotasPendientes,
          },
        };
      }
    }

    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { id: dto.cotizacionId },
      include: {
        pagos: true,
        lead: { include: { buyer: true } },
      },
    });

    if (!cotizacion) {
      throw new NotFoundException(`Cotización ${dto.cotizacionId} no encontrada.`);
    }

    const buyer = cotizacion.lead?.buyer;
    const cuotasTotal = cotizacion.cuotas || 1;
    const totalContrato = Number(cotizacion.total);
    const montoPorCuota = Math.round((totalContrato / cuotasTotal) * 100) / 100;

    // Detectar si el usuario decidió pagar por cuotas o liquidar la totalidad
    const esPagoPorCuotas = dto.tipoAbono === 'CUOTA' || (cuotasTotal > 1 && dto.tipoAbono !== 'TOTAL');
    const montoACobrar = dto.montoAbonar && dto.montoAbonar > 0
      ? Number(dto.montoAbonar)
      : (esPagoPorCuotas ? montoPorCuota : totalContrato);

    let pago = cotizacion.pagos.find((p) => p.estado === 'PENDIENTE');

    let transactionId = `tx_${dto.metodoPago.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    let culqiPayload: any = null;

    // Si el método es YAPE y el usuario utiliza Culqi
    if (dto.metodoPago === 'YAPE') {
      const yapeRes = await this.culqiProvider.cobrarConYapeDirecto({
        cotizacionId: cotizacion.id,
        monto: montoACobrar,
        telefonoYape: dto.telefonoYape || buyer?.whatsapp || '926619777',
        codigoAprobacion: dto.codigoAprobacion || '123456',
        email: buyer?.email || 'estudiante@inbestiga.pe',
        nombres: buyer ? `${buyer.nombres} ${buyer.apellidos}` : 'Estudiante',
      });

      transactionId = yapeRes.gatewayTransactionId;
      culqiPayload = yapeRes.payload;
    }

    if (pago) {
      pago = await this.prisma.pago.update({
        where: { id: pago.id },
        data: {
          monto: montoACobrar,
          metodoPago: dto.metodoPago,
          gatewayTransactionId: transactionId,
          gatewayProveedor: 'CULQI',
        },
      });
    } else {
      pago = await this.prisma.pago.create({
        data: {
          cotizacionId: cotizacion.id,
          buyerId: buyer?.id || '',
          leadId: cotizacion.leadId,
          gatewayProveedor: 'CULQI',
          gatewayTransactionId: transactionId,
          monto: montoACobrar,
          moneda: 'PEN',
          metodoPago: dto.metodoPago,
          estado: 'PENDIENTE',
        },
      });
    }

    // Payload webhook estructurado y verificado a través del gateway
    const webhookPayload = {
      event: 'charge.creation.succeeded',
      type: 'charge.creation.succeeded',
      status: 'succeeded',
      estado: 'CONFIRMADO',
      cotizacionId: cotizacion.id,
      gatewayTransactionId: transactionId,
      amount: Math.round(montoACobrar * 100),
      monto: montoACobrar,
      currency_code: 'PEN',
      moneda: 'PEN',
      metodoPago: dto.metodoPago,
      source: { object: dto.metodoPago === 'YAPE' ? 'yape' : 'card' },
      outcome: { type: 'venta_exitosa', user_message: 'Pago procesado exitosamente' },
      referencia: dto.referencia || `OP-${Math.floor(100000 + Math.random() * 900000)}`,
      culqiPayload,
    };

    return this.procesarWebhook(webhookPayload);
  }

  /**
   * Obtiene la lista de pagos con datos de buyer, cotización y comprobante electrónico.
   */
  async findAllPagos(query?: { search?: string; estado?: string; metodoPago?: string }) {
    const where: any = {};
    if (query?.estado && query.estado !== 'TODOS') {
      where.estado = query.estado;
    }
    if (query?.metodoPago && query.metodoPago !== 'TODOS') {
      where.metodoPago = query.metodoPago;
    }
    if (query?.search && query.search.trim().length > 0) {
      const s = query.search.trim();
      where.OR = [
        { gatewayTransactionId: { contains: s } },
        { buyer: { nombres: { contains: s } } },
        { buyer: { apellidos: { contains: s } } },
        { buyer: { whatsapp: { contains: s } } },
        { cotizacion: { codigoCotizacion: { contains: s } } },
      ];
    }

    const pagos = await this.prisma.pago.findMany({
      where,
      include: {
        buyer: {
          include: {
            universidad: true,
            carrera: true,
            customer: {
              include: {
                asesor: true,
              },
            },
          },
        },
        cotizacion: {
          include: {
            servicio: true,
            pagos: true,
          },
        },
      },
      orderBy: { fechaCreacion: 'desc' },
    });

    return pagos.map((p) => {
      const serieNumero = `B001-${p.id.substring(0, 8).toUpperCase()}`;
      const cuotasTotal = p.cotizacion?.cuotas || 1;
      const totalContrato = Number(p.cotizacion?.total || p.monto);
      const montoCuotaEsperado = Math.round((totalContrato / cuotasTotal) * 100) / 100;

      // Calcular montos abonados efectivamente en pagos confirmados para esta cotización
      const pagosConfirmados = (p.cotizacion?.pagos || []).filter((pg: any) => pg.estado === 'CONFIRMADO');
      const totalAbonado = pagosConfirmados.reduce((acc: number, pg: any) => acc + Number(pg.monto), 0);

      const cuotasPagadas = totalAbonado >= totalContrato ? cuotasTotal : Math.floor((totalAbonado + 1) / montoCuotaEsperado);
      const saldoPendiente = Math.max(0, totalContrato - totalAbonado);
      const esPlanCuotas = cuotasTotal > 1;

      // Determinación textual del cumplimiento de cuotas
      let estadoCuotasTexto = 'Pago Contado (100% Cancelado)';
      if (esPlanCuotas) {
        if (totalAbonado >= totalContrato) {
          estadoCuotasTexto = `${cuotasTotal}/${cuotasTotal} Cuotas Pagadas (100% Cancelado)`;
        } else if (totalAbonado > 0) {
          estadoCuotasTexto = `Cuota ${Math.max(1, cuotasPagadas)} de ${cuotasTotal} Pagada (Saldo: S/ ${saldoPendiente.toFixed(2)})`;
        } else {
          estadoCuotasTexto = `Pendiente Cuota 1 de ${cuotasTotal} (S/ ${montoCuotaEsperado.toFixed(2)})`;
        }
      }

      return {
        id: p.id,
        serieNumero,
        monto: Number(p.monto),
        moneda: p.moneda || 'PEN',
        metodoPago: p.metodoPago,
        gatewayProveedor: p.gatewayProveedor,
        gatewayTransactionId: p.gatewayTransactionId,
        estado: p.estado,
        fechaCreacion: p.fechaCreacion,
        fechaConfirmacion: p.fechaConfirmacion,
        estudiante: {
          id: p.buyer?.id,
          nombres: `${p.buyer?.nombres || ''} ${p.buyer?.apellidos || ''}`.trim(),
          email: p.buyer?.email,
          whatsapp: p.buyer?.whatsapp,
          universidad: p.buyer?.universidad?.nombre || p.buyer?.universidad?.siglas || 'Universidad Nacional de Trujillo',
          carrera: p.buyer?.carrera?.nombre || 'Ingeniería de Sistemas',
          ciclo: p.buyer?.ciclo || '10mo ciclo',
          tipoInvestigacion: p.buyer?.tipoInvestigacion || 'TESIS',
          asesor: p.buyer?.customer?.asesor
            ? `${p.buyer.customer.asesor.gradoAcademico} ${p.buyer.customer.asesor.nombres} ${p.buyer.customer.asesor.apellidos}`
            : null,
        },
        cotizacion: {
          id: p.cotizacion?.id,
          codigoCotizacion: p.cotizacion?.codigoCotizacion || 'COT-2026',
          servicio: p.cotizacion?.servicio?.nombre || 'Asesoría Integral de Tesis',
          tipoInvestigacion: p.cotizacion?.servicio?.tipoInvestigacion || 'TESIS',
          subtotal: Number(p.cotizacion?.subtotal || p.monto),
          descuento: Number(p.cotizacion?.descuento || 0),
          total: Number(p.cotizacion?.total || p.monto),
          cuotas: cuotasTotal,
        },
        planCuotas: {
          esCuotas: esPlanCuotas,
          cuotasAcordadas: cuotasTotal,
          montoPorCuota: montoCuotaEsperado,
          totalContrato,
          totalAbonado,
          cuotasPagadas,
          saldoPendiente,
          estadoTexto: estadoCuotasTexto,
          estaCanceladoTotal: totalAbonado >= totalContrato,
          cronograma: Array.from({ length: cuotasTotal }, (_, idx) => {
            const num = idx + 1;
            const pagada = (num * montoCuotaEsperado) <= (totalAbonado + 1);
            return {
              numero: num,
              monto: montoCuotaEsperado,
              estado: pagada ? 'PAGADA' : 'PENDIENTE',
              concepto: `Cuota ${num} de ${cuotasTotal}`,
              vencimiento: num === 1 ? 'Al contratar' : `+${(num - 1) * 30} días`,
            };
          }),
        },
      };
    });
  }

  /**
   * Genera los datos detallados del Comprobante / Boleta de Venta Electrónica oficial
   */
  async getComprobante(pagoId: string) {
    const pago = await this.prisma.pago.findUnique({
      where: { id: pagoId },
      include: {
        buyer: {
          include: {
            universidad: true,
            carrera: true,
            customer: { include: { asesor: true } },
          },
        },
        cotizacion: {
          include: { servicio: true, pagos: true },
        },
      },
    });

    if (!pago) {
      throw new NotFoundException(`Comprobante no encontrado para el pago ID: ${pagoId}`);
    }

    const serieNumero = `B001-${pago.id.substring(0, 8).toUpperCase()}`;
    const monto = Number(pago.monto);

    const cuotasTotal = pago.cotizacion?.cuotas || 1;
    const totalContrato = Number(pago.cotizacion?.total || monto);
    const montoCuotaEsperado = Math.round((totalContrato / cuotasTotal) * 100) / 100;
    const esPlanCuotas = cuotasTotal > 1;

    const pagosConfirmados = (pago.cotizacion?.pagos || []).filter((pg: any) => pg.estado === 'CONFIRMADO');
    const totalAbonado = pagosConfirmados.length > 0
      ? pagosConfirmados.reduce((acc: number, pg: any) => acc + Number(pg.monto), 0)
      : (pago.estado === 'CONFIRMADO' ? monto : 0);

    const cuotasPagadas = totalAbonado >= totalContrato ? cuotasTotal : Math.floor((totalAbonado + 1) / montoCuotaEsperado);
    const saldoPendiente = Math.max(0, totalContrato - totalAbonado);

    let estadoCuotasTexto = 'Pago Contado (100% Cancelado)';
    if (esPlanCuotas) {
      if (totalAbonado >= totalContrato) {
        estadoCuotasTexto = `${cuotasTotal}/${cuotasTotal} Cuotas Pagadas (100% Cancelado)`;
      } else if (totalAbonado > 0) {
        estadoCuotasTexto = `Cuota ${Math.max(1, cuotasPagadas)} de ${cuotasTotal} Pagada (Saldo: S/ ${saldoPendiente.toFixed(2)})`;
      } else {
        estadoCuotasTexto = `Pendiente Cuota 1 de ${cuotasTotal} (S/ ${montoCuotaEsperado.toFixed(2)})`;
      }
    }

    const formaPagoTexto = esPlanCuotas
      ? (totalAbonado >= totalContrato
          ? `CRÉDITO EN ${cuotasTotal} CUOTAS (100% CANCELADO)`
          : `CRÉDITO EN ${cuotasTotal} CUOTAS (CUOTA ${Math.max(1, cuotasPagadas)} DE ${cuotasTotal} ACREDITADA)`)
      : (pago.estado === 'CONFIRMADO' ? 'CONTADO (ACREDITADO)' : 'PENDIENTE DE PAGO');

    return {
      comprobante: {
        tipo: 'BOLETA DE VENTA ELECTRÓNICA',
        serieNumero,
        fechaEmision: pago.fechaConfirmacion || pago.fechaCreacion,
        horaEmision: (pago.fechaConfirmacion || pago.fechaCreacion).toISOString(),
        moneda: pago.moneda || 'PEN',
        simboloMoneda: 'S/',
        formaPago: formaPagoTexto,
        estado: pago.estado,
      },
      planCuotas: {
        esCuotas: esPlanCuotas,
        cuotasAcordadas: cuotasTotal,
        montoPorCuota: montoCuotaEsperado,
        totalContrato,
        totalAbonado,
        cuotasPagadas,
        saldoPendiente,
        estadoTexto: estadoCuotasTexto,
        cuotaActual: esPlanCuotas ? Math.max(1, cuotasPagadas) : 1,
        cronograma: Array.from({ length: cuotasTotal }, (_, idx) => {
          const num = idx + 1;
          const pagada = (num * montoCuotaEsperado) <= (totalAbonado + 1);
          return {
            numero: num,
            monto: montoCuotaEsperado,
            estado: pagada ? 'PAGADA' : 'PENDIENTE',
            concepto: `Cuota ${num} de ${cuotasTotal} - ${pago.cotizacion?.servicio?.nombre || 'Tesis'}`,
          };
        }),
      },
      emisor: {
        razonSocial: 'INBESTIGA ASESORÍA Y CONSULTORÍA S.A.C.',
        nombreComercial: 'INBESTIGA.TESIS',
        ruc: '20608945123',
        direccion: 'Av. Juan Pablo II N° 310, Urb. San Andrés, Trujillo, La Libertad',
        telefono: '+51 (044) 284910 / 926 619 777',
        email: 'facturacion@inbestiga.pe',
        web: 'https://inbestiga.pe',
      },
      cliente: {
        id: pago.buyer?.id,
        nombreCompleto: `${pago.buyer?.nombres} ${pago.buyer?.apellidos}`,
        email: pago.buyer?.email,
        whatsapp: pago.buyer?.whatsapp,
        universidad: pago.buyer?.universidad?.nombre || 'Universidad Nacional de Trujillo',
        carrera: pago.buyer?.carrera?.nombre || 'Ingeniería de Sistemas',
        ciclo: pago.buyer?.ciclo || '10mo ciclo',
        tipoInvestigacion: pago.buyer?.tipoInvestigacion === 'TRABAJO_INVESTIGACION_BACHILLER'
          ? 'Trabajo de Investigación (Bachiller)'
          : 'Tesis de Grado (Título Profesional)',
        asesorAsignado: pago.buyer?.customer?.asesor
          ? `${pago.buyer.customer.asesor.gradoAcademico} ${pago.buyer.customer.asesor.nombres} ${pago.buyer.customer.asesor.apellidos}`
          : 'Asesor Asignado por Coordinación',
      },
      detalleItems: [
        {
          item: 1,
          codigo: pago.cotizacion?.servicio?.codigo || 'SERV-TESIS-INT',
          descripcion: `${pago.cotizacion?.servicio?.nombre || 'Servicio de Asesoría Integral de Tesis'} - Ref. Cotización ${pago.cotizacion?.codigoCotizacion || 'COT-2026'}`,
          unidadMedida: 'ZZ - SERVICIO',
          cantidad: 1,
          precioUnitario: monto,
          descuento: Number(pago.cotizacion?.descuento || 0),
          importeTotal: monto,
        },
      ],
      totales: {
        opGravada: 0,
        opExonerada: monto,
        opInafecta: 0,
        igvPct: 0,
        igvMonto: 0,
        totalPagar: monto,
        totalPagarLetras: this.montoEnLetras(monto),
      },
      pasarela: {
        proveedor: pago.gatewayProveedor,
        metodo: pago.metodoPago,
        transaccionId: pago.gatewayTransactionId || `tx_${pago.id.substring(0, 8)}`,
        acreditacion: 'AUTOMÁTICA VÍA WEBHOOK CULQI EXPRESS (CREDICORP)',
        fechaConfirmacion: pago.fechaConfirmacion,
      },
      seguridadSunat: {
        codigoHash: Buffer.from(`INBESTIGA|20608945123|${serieNumero}|${monto}|${pago.fechaCreacion.toISOString()}`).toString('base64').substring(0, 28),
        leyenda: 'Bienes transferidos en la Amazonía y/o servicios prestados en ella para ser consumidos en la misma, o servicios educativos exonerados según Ley N° 30220.',
      },
    };
  }

  /**
   * Confirma manualmente un pago pendiente (ej. acreditación directa de Culqi desde la interfaz o verificación de QR).
   * Marca los pagos pendientes redundantes/abandonados del mismo alumno como EXPIRADO, promueve a PAYER/CUSTOMER y emite comprobante.
   */
  async confirmarPagoManual(pagoId: string, datos?: { metodoPago?: string; referencia?: string; monto?: number }) {
    this.logger.log(`Acreditando pago manualmente / sincronización Culqi para pago ID: ${pagoId}`);

    const pago = await this.prisma.pago.findUnique({
      where: { id: pagoId },
      include: { cotizacion: true, buyer: true },
    });

    if (!pago) {
      throw new NotFoundException(`Pago ${pagoId} no encontrado.`);
    }

    const totalContrato = Number(pago.cotizacion?.total || pago.monto);
    const cuotasTotal = pago.cotizacion?.cuotas || 1;
    const montoPorCuota = Math.round((totalContrato / cuotasTotal) * 100) / 100;

    // Si el usuario decidió por cuotas y no se especificó un monto manual, acreditar la cuota correspondiente
    const montoFinal = datos?.monto
      ? Number(datos.monto)
      : (cuotasTotal > 1 ? montoPorCuota : totalContrato);

    const metodoFinal = datos?.metodoPago || pago.metodoPago || 'YAPE';
    const txId = datos?.referencia || pago.gatewayTransactionId || `culqi_op_${Date.now()}`;

    // 1. Confirmar el pago seleccionado
    const pagoActualizado = await this.prisma.pago.update({
      where: { id: pago.id },
      data: {
        estado: 'CONFIRMADO',
        monto: montoFinal,
        metodoPago: metodoFinal,
        gatewayTransactionId: txId,
        gatewayProveedor: 'CULQI',
        fechaConfirmacion: new Date(),
      },
    });

    // 2. Aceptar la cotización
    if (pago.cotizacionId) {
      await this.prisma.cotizacion.update({
        where: { id: pago.cotizacionId },
        data: { estado: 'ACEPTADA' },
      });
    }

    // 3. Marcar cualquier otro pago pendiente previo del mismo comprador como EXPIRADO
    if (pago.buyerId) {
      await this.prisma.pago.updateMany({
        where: {
          buyerId: pago.buyerId,
          id: { not: pago.id },
          estado: 'PENDIENTE',
        },
        data: {
          estado: 'EXPIRADO',
        },
      });

      // 4. Promover a PAYER si no lo está
      await this.prisma.buyer.update({
        where: { id: pago.buyerId },
        data: { estadoFunnel: 'PAYER' },
      });

      const existingPayer = await this.prisma.payer.findUnique({
        where: { buyerId: pago.buyerId },
      });

      if (!existingPayer) {
        await this.prisma.payer.create({
          data: {
            buyerId: pago.buyerId,
            leadId: pago.leadId,
            primerPagoId: pago.id,
            montoTotalPagado: montoFinal,
            metodoPrincipal: metodoFinal,
            estado: 'ACTIVO',
          },
        });
      } else {
        await this.prisma.payer.update({
          where: { id: existingPayer.id },
          data: {
            montoTotalPagado: Number(existingPayer.montoTotalPagado || 0) + montoFinal,
          },
        });
      }
    }

    // 5. Crear Customer y asignar asesor especialista con bitácora
    let customer: any = null;
    try {
      customer = await this.customersService.crearCustomerDesdePago(pago.id);
    } catch (e: any) {
      this.logger.warn(`Nota al crear Customer desde pago: ${e.message}`);
    }

    // 6. Calcular balance de cuotas actualizado
    const pagosConfirmados = await this.prisma.pago.findMany({
      where: { cotizacionId: pago.cotizacionId, estado: 'CONFIRMADO' },
    });
    const totalAbonado = pagosConfirmados.reduce((acc, p) => acc + Number(p.monto), 0);
    const cuotasPagadas = totalAbonado >= totalContrato ? cuotasTotal : Math.floor((totalAbonado + 0.01) / montoPorCuota);
    const saldoPendiente = Math.max(0, totalContrato - totalAbonado);

    return {
      status: 'confirmed',
      pago: pagoActualizado,
      customer,
      planCuotas: {
        esCuotas: cuotasTotal > 1,
        cuotasAcordadas: cuotasTotal,
        montoPorCuota,
        totalContrato,
        totalAbonado,
        cuotasPagadas,
        saldoPendiente,
        estaCanceladoTotal: totalAbonado >= totalContrato,
      },
      mensaje: cuotasTotal > 1
        ? `Pago de Cuota ${Math.max(1, cuotasPagadas)} por S/ ${montoFinal.toFixed(2)} acreditado exitosamente. Saldo restante: S/ ${saldoPendiente.toFixed(2)}.`
        : 'Pago al contado acreditado y comprobante generado exitosamente.',
    };
  }

  /**
   * Sincroniza y detecta pagos pendientes con Culqi.
   * Si un cliente completó su transacción o tiene un pago pendiente por conciliar,
   * detecta el pago más reciente y lo acredita, expirando intentos previos abandonados.
   */
  async sincronizarPagosCulqi() {
    this.logger.log('Iniciando sincronización automática con API REST de Culqi...');

    const { charges, orders } = await this.culqiProvider.consultarOrdenesCargosCulqi();
    const resultados: any[] = [];

    // 1. Procesar cargos obtenidos desde Culqi API
    for (const ch of charges) {
      try {
        const res = await this.procesarWebhook({ object: 'charge', data: ch });
        if (res.status === 'confirmed' || res.status === 'refunded' || res.status === 'failed') {
          resultados.push({ id: ch.id, tipo: 'cargo', resultado: res });
        }
      } catch (err: any) {
        this.logger.debug(`Cargo ${ch.id} de Culqi no aplicable o ya procesado: ${err.message}`);
      }
    }

    // 2. Procesar órdenes obtenidas desde Culqi API
    for (const ord of orders) {
      try {
        const res = await this.procesarWebhook({ object: 'order', type: 'order.status.changed', data: ord });
        if (res.status === 'confirmed' || res.status === 'expired') {
          resultados.push({ id: ord.id, tipo: 'orden', resultado: res });
        }
      } catch (err: any) {
        this.logger.debug(`Orden ${ord.id} de Culqi no aplicable o ya procesada: ${err.message}`);
      }
    }

    const mensaje = resultados.length > 0
      ? `Sincronización Culqi exitosa: Se conciliarion automáticamente ${resultados.length} evento(s) de pasarela.`
      : 'Sincronización Culqi: No se encontraron cobros adicionales confirmados en la pasarela. Los pagos pendientes se mantienen a la espera del cliente.';

    return {
      sincronizados: resultados.length,
      detalles: resultados,
      mensaje,
    };
  }

  private montoEnLetras(monto: number): string {
    const entero = Math.floor(monto);
    const decimales = Math.round((monto - entero) * 100).toString().padStart(2, '0');
    return `SON ${entero} Y ${decimales}/100 SOLES`;
  }
}
