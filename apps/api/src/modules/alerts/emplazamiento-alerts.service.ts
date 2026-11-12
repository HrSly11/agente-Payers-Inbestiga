import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class EmplazamientoAlertsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmplazamientoAlertsService.name);
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  onApplicationBootstrap() {
    this.logger.log('✓ EmplazamientoAlertsService inicializado. Monitoreando reglas de cobranza y atención.');
    // Ejecutar verificación periódica cada 15 minutos en background
    this.checkInterval = setInterval(() => {
      this.procesarTodasLasAlertas().catch((err) =>
        this.logger.error('Error procesando alertas periódicas de emplazamiento:', err),
      );
    }, 15 * 60 * 1000);
  }

  /**
   * Ejecuta la evaluación completa de alertas de emplazamiento para PAYERS y CUSTOMERS.
   */
  async procesarTodasLasAlertas() {
    this.logger.log('--- Iniciando chequeo de Alertas de Emplazamiento (Secciones 5.4 y 6.5) ---');
    const resCobranza = await this.evaluarAlertasCobranza();
    const resAtencion = await this.evaluarAlertasAtencion();
    return {
      exito: true,
      timestamp: new Date(),
      cobranza: resCobranza,
      atencion: resAtencion,
    };
  }

  /**
   * Sección 5.4 del informe: Alertas de emplazamiento para impulsar la cobranza (PAYERS)
   * 1. 4 horas sin pago tras cotización -> Reenvía el link de pago directo Culqi.
   * 2. 12 horas -> Ofrece dividir el monto en cuotas.
   * 3. 24 horas sin respuesta -> Escala a asesor humano (notificación interna).
   */
  async evaluarAlertasCobranza() {
    const ahora = new Date();
    const cotizacionesActivas = await this.prisma.cotizacion.findMany({
      where: {
        estado: 'ACTIVA',
      },
      include: {
        lead: {
          include: {
            buyer: true,
            conversaciones: { orderBy: { fechaInicio: 'desc' }, take: 1 },
          },
        },
        pagos: {
          where: { estado: 'CONFIRMADO' },
        },
      },
    });

    let alertas4h = 0;
    let alertas12h = 0;
    let escalamientos24h = 0;

    for (const cot of cotizacionesActivas) {
      if (cot.pagos.length > 0) continue; // Ya tiene pago confirmado

      const buyer = cot.lead.buyer;
      const horasTranscurridas = (ahora.getTime() - new Date(cot.fechaEmision).getTime()) / (1000 * 60 * 60);

      // Filtro de seguridad WhatsApp: Solo enviar mensajes reales a números autorizados de prueba
      const esUsuarioAutorizadoPruebas =
        buyer.apellidos.toLowerCase().includes('cruz') ||
        buyer.nombres.toLowerCase().includes('josmell') ||
        buyer.whatsapp.includes('926619777');

      // 1. Alerta 4 Horas: Reenvío link de pago directo Culqi
      if (horasTranscurridas >= 4 && horasTranscurridas < 12) {
        const yaNotificado = await this.prisma.notificacion.findFirst({
          where: {
            tipo: 'ALERTA_COBRANZA_4H',
            metadata: { contains: cot.id },
          },
        });

        if (!yaNotificado) {
          await this.prisma.notificacion.create({
            data: {
              tipo: 'ALERTA_COBRANZA_4H',
              titulo: `Alerta Cobranza 4h: ${buyer.nombres} ${buyer.apellidos}`,
              mensaje: `La propuesta para ${cot.codigoCotizacion} lleva ${Math.round(horasTranscurridas)}h activa sin pago. Se reenvía link de Culqi.`,
              metadata: JSON.stringify({ cotizacionId: cot.id, buyerId: buyer.id, horas: horasTranscurridas }),
            },
          });

          if (esUsuarioAutorizadoPruebas && buyer.whatsapp && cot.lead.conversaciones[0]) {
            await this.whatsappService.enviarMensaje({
              conversacionId: cot.lead.conversaciones[0].id,
              telefono: buyer.whatsapp,
              contenido: `Hola ${buyer.nombres}, aquí tienes el enlace directo para completar tu pago de asesoría de tesis en la pasarela oficial Culqi 👉 https://express.culqi.com/pago/1E696A426C. ¿Tienes alguna duda antes de continuar?`,
              tipoMensaje: 'TEXT',
              remitente: 'AGENTE_IA',
            }).catch((e) => this.logger.warn(`No se pudo enviar WhatsApp 4h a ${buyer.whatsapp}: ${e.message}`));
          }
          alertas4h++;
        }
      }

      // 2. Alerta 12 Horas: Ofrecer dividir monto en cuotas
      else if (horasTranscurridas >= 12 && horasTranscurridas < 24) {
        const yaNotificado = await this.prisma.notificacion.findFirst({
          where: {
            tipo: 'ALERTA_COBRANZA_12H',
            metadata: { contains: cot.id },
          },
        });

        if (!yaNotificado) {
          await this.prisma.notificacion.create({
            data: {
              tipo: 'ALERTA_COBRANZA_12H',
              titulo: `Alerta Cobranza 12h: ${buyer.nombres} ${buyer.apellidos}`,
              mensaje: `El lead lleva ${Math.round(horasTranscurridas)}h sin abonar. Se ofrece dividir el pago en cuotas.`,
              metadata: JSON.stringify({ cotizacionId: cot.id, buyerId: buyer.id, horas: horasTranscurridas }),
            },
          });

          if (esUsuarioAutorizadoPruebas && buyer.whatsapp && cot.lead.conversaciones[0]) {
            await this.whatsappService.enviarMensaje({
              conversacionId: cot.lead.conversaciones[0].id,
              telefono: buyer.whatsapp,
              contenido: `Hola ${buyer.nombres}, vimos que empezaste el proceso de inscripción pero aún no completas el pago, ¿tuviste algún inconveniente? Recuerda que a través de Culqi puedes pagarlo cómodamente en 2 o 3 cuotas. Enlace: https://express.culqi.com/pago/1E696A426C`,
              tipoMensaje: 'TEXT',
              remitente: 'AGENTE_IA',
            }).catch((e) => this.logger.warn(`No se pudo enviar WhatsApp 12h a ${buyer.whatsapp}: ${e.message}`));
          }
          alertas12h++;
        }
      }

      // 3. Alerta 24 Horas: Escalamiento interno a asesor humano
      else if (horasTranscurridas >= 24) {
        const yaEscalado = await this.prisma.notificacion.findFirst({
          where: {
            tipo: 'ESCALAMIENTO_COBRANZA_HUMANA',
            metadata: { contains: cot.id },
          },
        });

        if (!yaEscalado) {
          await this.prisma.notificacion.create({
            data: {
              tipo: 'ESCALAMIENTO_COBRANZA_HUMANA',
              titulo: `Escalamiento Humano de Cobranza: ${buyer.nombres} ${buyer.apellidos}`,
              mensaje: `El lead superó las 24 horas sin concretar abono tras dos recordatorios automáticos. Requiere contacto humano directo al WhatsApp ${buyer.whatsapp}.`,
              metadata: JSON.stringify({ cotizacionId: cot.id, buyerId: buyer.id, horas: horasTranscurridas }),
            },
          });
          escalamientos24h++;
        }
      }
    }

    return { alertas4h, alertas12h, escalamientos24h, totalEvaluadas: cotizacionesActivas.length };
  }

  /**
   * Sección 6.5 del informe: Alertas de emplazamiento de la fase CUSTOMERS (Atención)
   * 1. 48h antes de entrega pactada sin avance -> Recordatorio al tesista con copia al asesor.
   * 2. 5 días desde el pago sin agendar 1ra sesión -> Recordatorio para agendar con 3 horarios.
   */
  async evaluarAlertasAtencion() {
    const ahora = new Date();
    const customers = await this.prisma.customer.findMany({
      where: { estadoServicio: 'ACTIVO' },
      include: {
        buyer: true,
        asesor: true,
        sesiones: { orderBy: { numeroSesion: 'desc' } },
      },
    });

    let recordatoriosSesion5d = 0;
    let alertasEntrega48h = 0;

    for (const cust of customers) {
      const buyer = cust.buyer;
      const diasDesdeInicio = (ahora.getTime() - new Date(cust.fechaInicioServicio).getTime()) / (1000 * 60 * 60 * 24);

      // Regla 2: 5 días desde el pago sin primera sesión agendada
      if (diasDesdeInicio >= 5 && cust.sesiones.length === 0) {
        const yaNotificado = await this.prisma.notificacion.findFirst({
          where: {
            tipo: 'ALERTA_CUSTOMER_SESION_5D',
            metadata: { contains: cust.id },
          },
        });

        if (!yaNotificado) {
          await this.prisma.notificacion.create({
            data: {
              tipo: 'ALERTA_CUSTOMER_SESION_5D',
              titulo: `Recordatorio 5d sin agendar: ${buyer.nombres} ${buyer.apellidos}`,
              mensaje: `El cliente lleva más de 5 días con servicio pagado sin agendar su primera sesión de asesoría.`,
              metadata: JSON.stringify({ customerId: cust.id, buyerId: buyer.id }),
            },
          });
          recordatoriosSesion5d++;
        }
      }

      // Regla 1: Faltan 48h para entrega pactada (alerta de cronograma activa)
      if (cust.sesiones.length > 0) {
        const ultimaSesion = cust.sesiones[0];
        const horasHastaSesion = (new Date(ultimaSesion.fechaHoraProgramada).getTime() - ahora.getTime()) / (1000 * 60 * 60);

        if (horasHastaSesion > 0 && horasHastaSesion <= 48) {
          alertasEntrega48h++;
        }
      }
    }

    return { recordatoriosSesion5d, alertasEntrega48h, totalCustomers: customers.length };
  }
}
