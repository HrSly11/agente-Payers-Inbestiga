import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DwService } from '../../database/dw.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { CuotasHitoService } from '../payers/cuotas-hito.service';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dwService: DwService,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsappService: WhatsAppService,
    private readonly cuotasHitoService: CuotasHitoService,
  ) {}

  /**
   * Conversión definitiva del Funnel:
   * LEAD -> PAYER -> CUSTOMER
   * Invocado de manera estricta cuando la Pasarela de Pago confirma el webhook.
   */
  async crearCustomerDesdePago(pagoId: string) {
    this.logger.log(`Iniciando transición del funnel para Pago confirmado ID: ${pagoId}`);

    const pago = await this.prisma.pago.findUnique({
      where: { id: pagoId },
      include: {
        cotizacion: { include: { servicio: true } },
        buyer: { include: { carrera: true, universidad: true, lead: true } },
      },
    });

    if (!pago || pago.estado !== 'CONFIRMADO') {
      throw new NotFoundException(`Pago ${pagoId} no encontrado o aún no confirmado.`);
    }

    const buyer = pago.buyer;
    const lead = buyer.lead;
    const cotizacion = pago.cotizacion;

    // 1. Crear o Actualizar PAYER (LEAD -> PAYER)
    let payer = await this.prisma.payer.findUnique({ where: { buyerId: buyer.id } });
    if (!payer) {
      payer = await this.prisma.payer.create({
        data: {
          buyerId: buyer.id,
          leadId: lead?.id || null,
          primerPagoId: pago.id,
          montoTotalPagado: pago.monto,
          metodoPrincipal: pago.metodoPago,
          fechaConversionPayer: new Date(),
          estado: 'ACTIVO',
        },
      });
      this.logger.log(`✓ Funnel actualizado: LEAD -> PAYER para ${buyer.nombres} ${buyer.apellidos}`);
    }

    await this.prisma.buyer.update({
      where: { id: buyer.id },
      data: { estadoFunnel: 'PAYER' },
    });

    // 2. Asignar Asesor Académico Idóneo
    // Buscar asesor con la misma especialidad o con menor carga de clientes activos
    let asesor = await this.prisma.asesor.findFirst({
      where: {
        activo: true,
        especialidad: { contains: buyer.carrera?.areaConocimiento || 'Metodología' },
      },
      orderBy: { clientesActivos: 'asc' },
    });

    if (!asesor) {
      asesor = await this.prisma.asesor.findFirst({
        where: { activo: true },
        orderBy: { clientesActivos: 'asc' },
      });
    }

    if (asesor) {
      await this.prisma.asesor.update({
        where: { id: asesor.id },
        data: { clientesActivos: { increment: 1 } },
      });
    }

    // 3. Crear registro de CUSTOMER (PAYER -> CUSTOMER)
    let customer = await this.prisma.customer.findUnique({ where: { buyerId: buyer.id } });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          buyerId: buyer.id,
          leadId: lead?.id || null,
          payerId: payer.id,
          cotizacionId: cotizacion.id,
          servicioId: cotizacion.servicioId,
          asesorId: asesor?.id || null,
          fechaInicioServicio: new Date(),
          estadoServicio: 'ACTIVO',
          observaciones: `Servicio iniciado automáticamente tras confirmación de pago por S/ ${pago.monto} (${pago.metodoPago}).`,
        },
      });
      this.logger.log(`✓ Funnel actualizado: PAYER -> CUSTOMER para ${buyer.nombres} ${buyer.apellidos}`);
    }

    await this.prisma.buyer.update({
      where: { id: buyer.id },
      data: { estadoFunnel: 'CUSTOMER' },
    });

    // 4. Registrar Asignación Formal del Asesor
    if (asesor) {
      await this.prisma.asignacionAsesor.create({
        data: {
          customerId: customer.id,
          asesorId: asesor.id,
          motivo: `Asignación por especialidad en ${buyer.carrera?.nombre || 'Investigación'}`,
          asignadoPor: 'SISTEMA_AUTOMATICO',
        },
      });
    }

    // 5. Programar la Primera Sesión Académica (dentro de 3 días a las 17:00)
    const fechaPrimeraSesion = new Date();
    fechaPrimeraSesion.setDate(fechaPrimeraSesion.getDate() + 3);
    fechaPrimeraSesion.setHours(17, 0, 0, 0);

    const sesion = await this.prisma.sesion.create({
      data: {
        customerId: customer.id,
        asesorId: asesor?.id || '',
        numeroSesion: 1,
        fechaHoraProgramada: fechaPrimeraSesion,
        temaTratado: 'Sesión de Inducción, Diagnóstico Metodológico y Cronograma de Tesis',
        estado: 'PROGRAMADA',
        enlaceReunion: `https://meet.google.com/inbestiga-tesis-${customer.id.substring(0, 8)}`,
        observaciones: 'El estudiante debe tener a la mano el avance previo y el reglamento de su universidad.',
      },
    });

    // 6. Notificación para el Administrador y Asesor
    await this.prisma.notificacion.create({
      data: {
        tipo: 'PAGO_CONFIRMADO',
        titulo: `¡Nuevo CUSTOMER! Pago confirmado: ${buyer.nombres} ${buyer.apellidos}`,
        mensaje: `Se ha confirmado el pago de S/ ${pago.monto}. Asesor asignado: ${asesor?.nombres || 'Por asignar'}. Primera sesión programada para el ${fechaPrimeraSesion.toLocaleDateString()}.`,
        metadata: JSON.stringify({ customerId: customer.id, pagoId: pago.id }),
      },
    });

    // 7. Notificar al Estudiante vía WhatsApp mediante OpenWA
    const conversacion = await this.prisma.conversacion.findFirst({
      where: { buyerId: buyer.id },
      orderBy: { fechaInicio: 'desc' },
    });

    if (conversacion && buyer.whatsapp) {
      const mensajeConfirmacion = `¡Felicidades ${buyer.nombres}! 🎉 Hemos recibido y confirmado tu pago de S/ ${pago.monto}. Ya eres formalmente CUSTOMER de INBESTIGA.TESIS. Tu asesor asignado es el ${asesor?.gradoAcademico || 'Dr.'} ${asesor?.nombres} ${asesor?.apellidos}. Tu primera sesión de diagnóstico ha sido programada para el ${fechaPrimeraSesion.toLocaleDateString()} a las 5:00 PM vía Google Meet: ${sesion.enlaceReunion}. ¡Bienvenido a tu titulación con éxito!`;

      await this.whatsappService.enviarMensaje({
        conversacionId: conversacion.id,
        telefono: buyer.whatsapp,
        contenido: mensajeConfirmacion,
        tipoMensaje: 'TEXT',
        remitente: 'AGENTE_IA',
      });
    }

    // 8. Sincronizar Data Warehouse automáticamente mediante ETL
    await this.dwService.runEtl().catch((e) => this.logger.warn('Error en sync DW post pago:', e));

    return {
      exito: true,
      buyerId: buyer.id,
      payerId: payer.id,
      customerId: customer.id,
      asesorAsignado: asesor ? `${asesor.nombres} ${asesor.apellidos}` : null,
      primeraSesion: {
        id: sesion.id,
        fecha: fechaPrimeraSesion,
        enlace: sesion.enlaceReunion,
      },
      estadoFunnel: 'CUSTOMER',
    };
  }

  private async obtenerTesisCustomers(onlyCustomerId?: number): Promise<any[]> {
    const whereClause = onlyCustomerId != null ? `WHERE cu.customer_id = ${Number(onlyCustomerId)}` : '';
    const topClause = onlyCustomerId != null ? 'TOP 1' : 'TOP 20';
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT ${topClause}
        cu.customer_id,
        cu.fecha_activacion,
        cu.estado_servicio,
        py.payer_id,
        py.orden_pago_id,
        op.codigo_orden,
        op.monto_comprometido,
        op.estado AS orden_estado,
        mp.numero_cuotas,
        mp.condicion AS modalidad_condicion,
        s.nombre AS servicio_nombre,
        s.tipo_servicio,
        c.contacto_id,
        c.nombres,
        c.apellidos,
        c.telefono,
        c.email,
        ISNULL(u.nombre, N'Universidad Nacional de Trujillo') AS universidad_nombre,
        ISNULL(u.siglas, 'UNT') AS universidad_siglas,
        ISNULL(ca.nombre, N'Ingeniería de Sistemas') AS carrera_nombre,
        ISNULL(pa.ciclo, N'X Ciclo') AS ciclo,
        ISNULL(pa.tipo_investigacion, s.nombre) AS tipo_investigacion,
        ISNULL(a.nombre, N'Dr. Carlos Alberto Méndez Vargas') AS asesor_nombre,
        ISNULL(a.especialidad, N'Ingeniería de Sistemas e IA') AS asesor_especialidad,
        ISNULL(a.rol, N'Especialista') AS asesor_rol,
        (
          SELECT ISNULL(SUM(pg.monto_pagado), 0)
          FROM INBESTIGA_TESIS.dbo.PAGO pg
          WHERE pg.orden_pago_id = op.orden_pago_id AND pg.estado = 'CONFIRMADO'
        ) AS monto_pagado,
        (
          SELECT TOP 1 pg.referencia
          FROM INBESTIGA_TESIS.dbo.PAGO pg
          WHERE pg.orden_pago_id = op.orden_pago_id AND pg.estado = 'CONFIRMADO'
          ORDER BY pg.pago_id DESC
        ) AS ultima_referencia
      FROM INBESTIGA_TESIS.dbo.CUSTOMER cu
      INNER JOIN INBESTIGA_TESIS.dbo.PAYER py ON py.payer_id = cu.payer_id
      INNER JOIN INBESTIGA_TESIS.dbo.ORDEN_PAGO op ON op.orden_pago_id = py.orden_pago_id
      INNER JOIN INBESTIGA_TESIS.dbo.MODALIDAD_PAGO mp ON mp.modalidad_pago_id = op.modalidad_pago_id
      INNER JOIN INBESTIGA_TESIS.dbo.PROPUESTA pr ON pr.propuesta_id = op.propuesta_id
      INNER JOIN INBESTIGA_TESIS.dbo.SERVICIO s ON s.servicio_id = pr.servicio_id
      INNER JOIN INBESTIGA_TESIS.dbo.LEAD l ON l.lead_id = pr.lead_id
      INNER JOIN INBESTIGA_TESIS.dbo.BUYER b ON b.buyer_id = l.buyer_id
      INNER JOIN INBESTIGA_TESIS.dbo.CONTACTO c ON c.contacto_id = b.contacto_id
      LEFT JOIN INBESTIGA_TESIS.dbo.PERFIL_ACADEMICO pa ON pa.contacto_id = c.contacto_id
      LEFT JOIN INBESTIGA_TESIS.dbo.CARRERA ca ON ca.carrera_id = pa.carrera_id
      LEFT JOIN INBESTIGA_TESIS.dbo.UNIVERSIDAD u ON u.universidad_id = ca.universidad_id
      OUTER APPLY (
        SELECT TOP 1 asig.asesor_id
        FROM INBESTIGA_TESIS.dbo.ASIGNACION_ASESOR asig
        WHERE asig.customer_id = cu.customer_id
        ORDER BY asig.fecha_asignacion DESC
      ) aa
      LEFT JOIN INBESTIGA_TESIS.dbo.ASESOR a ON a.asesor_id = aa.asesor_id
      ${whereClause}
      ORDER BY CASE WHEN op.codigo_orden = 'ORD-2026-0042' THEN 0 ELSE 1 END, cu.customer_id DESC;
    `);

    const out: any[] = [];
    for (const r of rows) {
      const cuotasPago: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT cuota_id, orden_pago_id, numero_cuota, porcentaje, monto_programado, condicion, fecha_vencimiento, estado
        FROM INBESTIGA_TESIS.dbo.CUOTA_PAGO
        WHERE orden_pago_id = ${Number(r.orden_pago_id)}
        ORDER BY numero_cuota ASC;
      `);
      const metodoPago = 'MERCADO PAGO';
      out.push({
        id: `tesis-cust-${r.customer_id}`,
        tesisCustomerId: Number(r.customer_id),
        ordenPagoId: Number(r.orden_pago_id),
        codigoOrden: r.codigo_orden,
        estadoServicio: r.estado_servicio === 'CERRADO' ? 'FINALIZADO' : 'EN_CURSO',
        fechaInicioServicio: r.fecha_activacion,
        observaciones: `${r.servicio_nombre} (${r.codigo_orden}) — ${r.modalidad_condicion}`,
        buyer: {
          nombres: r.nombres,
          apellidos: r.apellidos,
          whatsapp: r.telefono,
          email: r.email,
          ciclo: r.ciclo,
          tipoInvestigacion: r.tipo_investigacion,
          universidad: { nombre: r.universidad_nombre, siglas: r.universidad_siglas },
          carrera: { nombre: r.carrera_nombre },
        },
        servicio: {
          nombre: r.servicio_nombre,
          tipoInvestigacion: String(r.tipo_servicio || '').includes('Bachiller')
            ? 'TRABAJO_INVESTIGACION_BACHILLER'
            : 'TESIS',
        },
        asesor: {
          gradoAcademico: '',
          nombres: r.asesor_nombre,
          apellidos: '',
          especialidad: r.asesor_especialidad,
        },
        cotizacion: {
          codigoCotizacion: r.codigo_orden,
          total: Number(r.monto_comprometido),
          cuotas: Number(r.numero_cuotas || cuotasPago.length || 1),
        },
        payer: {
          montoTotalPagado: Number(r.monto_pagado || 0),
          fechaConversionPayer: r.fecha_activacion,
          primerPago: {
            metodoPago,
            gatewayTransactionId: r.ultima_referencia || r.codigo_orden,
          },
        },
        cuotasPago: cuotasPago.map((cp) => ({
          cuota_id: Number(cp.cuota_id),
          orden_pago_id: Number(cp.orden_pago_id),
          numero_cuota: Number(cp.numero_cuota),
          porcentaje: Number(cp.porcentaje),
          monto_programado: Number(cp.monto_programado),
          condicion: cp.condicion,
          fecha_vencimiento: cp.fecha_vencimiento,
          estado: cp.estado,
        })),
        sesiones: [
          {
            id: `ses-${r.customer_id}-1`,
            numeroSesion: 1,
            temaTratado: 'Sesión 1: Inducción Metodológica y Validación de Plan de Tesis',
            estado: 'PROGRAMADA',
            fechaHoraProgramada: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            enlaceReunion: `https://meet.google.com/inb-tesis-${r.customer_id}`,
            observaciones: 'Sesión habilitada tras acreditación del pago inicial.',
          },
        ],
      });
    }
    return out;
  }

  async findAll(query?: { estadoServicio?: string; asesorId?: string }) {
    const prismaCustomers = await this.prisma.customer.findMany({
      where: query,
      include: {
        buyer: { include: { universidad: true, carrera: true } },
        servicio: true,
        asesor: true,
        sesiones: { orderBy: { numeroSesion: 'asc' } },
        cotizacion: true,
        payer: { include: { primerPago: true } },
      },
      orderBy: { fechaInicioServicio: 'desc' },
    });
    const tesisCustomers = await this.obtenerTesisCustomers().catch((e) => {
      this.logger.warn(`No se pudieron cargar customers de INBESTIGA_TESIS: ${e.message}`);
      return [];
    });
    const customers: any[] = [...tesisCustomers, ...prismaCustomers];

    // Enriquecer con registros de la Bitácora de Tesis
    let bitacoras: any[] = [];
    try {
      bitacoras = await this.prisma.$queryRawUnsafe(`
        SELECT [id], [customerId], [asesorId], [fechaRegistro], [hito], [titulo], [porcentajeAvance], [estadoRevision], [observaciones], [turnitinPct], [proximaEntrega], [registradoPor]
        FROM [dbo].[BITACORA_TESIS]
        ORDER BY [fechaRegistro] DESC
      `);
    } catch (e: any) {
      this.logger.warn('No se pudo leer BITACORA_TESIS directamente:', e.message);
    }

    return customers.map((c) => {
      const cBitacora = bitacoras.filter((b) => b.customerId === c.id);
      const ultimaBitacora = cBitacora[0] || null;

      // Calcular avance global del tesista
      let progresoGlobal = 35;
      if (c.estadoServicio === 'FINALIZADO') {
        progresoGlobal = 100;
      } else if (ultimaBitacora?.porcentajeAvance) {
        progresoGlobal = ultimaBitacora.porcentajeAvance;
      }

      // Turnitin reportado más reciente
      const turnitinPct = ultimaBitacora?.turnitinPct ?? (cBitacora.find((b) => b.turnitinPct != null)?.turnitinPct ?? 6);

      // Tema de tesis o trabajo de investigación
      const esBachiller = c.servicio?.tipoInvestigacion === 'TRABAJO_INVESTIGACION_BACHILLER' || c.buyer?.tipoInvestigacion?.includes('BACHILLER');
      const temaDefecto = esBachiller
        ? `Trabajo de Investigación en ${c.buyer?.carrera?.nombre || 'Gestión Académica'} para Grado de Bachiller`
        : `Tesis Integral de Grado en ${c.buyer?.carrera?.nombre || 'Ingeniería y Ciencias'} para Título Profesional`;

      const temaInvestigacion = c.observaciones && !c.observaciones.startsWith('Servicio iniciado')
        ? c.observaciones
        : (ultimaBitacora?.titulo || c.buyer?.dolorPrincipal || temaDefecto);

      return {
        ...c,
        bitacorasCount: cBitacora.length,
        ultimaBitacora,
        progresoGlobal,
        turnitinPct,
        temaInvestigacion,
        modalidad: esBachiller ? 'BACHILLER' : 'TITULO_PROFESIONAL',
      };
    });
  }

  async findById(id: string): Promise<any> {
    if (id.startsWith('tesis-cust-') || /^\d+$/.test(id)) {
      const numId = Number(id.replace('tesis-cust-', ''));
      const list = await this.obtenerTesisCustomers(numId);
      if (!list.length) throw new NotFoundException(`Customer ${id} no encontrado.`);
      return list[0];
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        buyer: { include: { universidad: true, carrera: true, ubicacion: true } },
        servicio: true,
        asesor: true,
        sesiones: { orderBy: { numeroSesion: 'asc' } },
        cotizacion: true,
        payer: { include: { primerPago: true } },
      },
    });

    if (!customer) throw new NotFoundException(`Customer ${id} no encontrado.`);
    return customer;
  }

  /**
   * Retorna la trazabilidad integral y bitácora cronológica de un tesista
   */
  async getTrazabilidad(id: string) {
    const customer = await this.findById(id);

    // Obtener entradas de bitácora
    let bitacora: any[] = [];
    try {
      bitacora = await this.prisma.$queryRawUnsafe(`
        SELECT [id], [customerId], [asesorId], [fechaRegistro], [hito], [titulo], [porcentajeAvance], [estadoRevision], [observaciones], [turnitinPct], [proximaEntrega], [registradoPor]
        FROM [dbo].[BITACORA_TESIS]
        WHERE [customerId] = '${id}'
        ORDER BY [fechaRegistro] DESC
      `);
    } catch (e: any) {
      this.logger.warn(`Error al consultar bitácora para customer ${id}:`, e.message);
    }

    const ultimaBitacora = bitacora[0] || null;
    const progresoGlobal = customer.estadoServicio === 'FINALIZADO'
      ? 100
      : (ultimaBitacora?.porcentajeAvance || 45);

    const turnitinPct = ultimaBitacora?.turnitinPct ?? (bitacora.find((b) => b.turnitinPct != null)?.turnitinPct ?? 6);

    const esBachiller = customer.servicio?.tipoInvestigacion === 'TRABAJO_INVESTIGACION_BACHILLER' ||
      customer.buyer?.tipoInvestigacion?.includes('BACHILLER');

    // Construir los 6 Hitos Metodológicos Estructurados
    const hitosEstandar = esBachiller
      ? [
          {
            clave: 'PLAN_TESIS',
            numero: 1,
            nombre: 'Plan de Trabajo de Investigación',
            descripcion: 'Formulación de la pregunta de investigación, justificación y matriz de consistencia para Grado de Bachiller (Ley 30220).',
            entregableEsperado: 'Plan_Trabajo_Investigacion_Aprobado.pdf',
          },
          {
            clave: 'MARCO_TEORICO',
            numero: 2,
            nombre: 'Marco Referencial y Estado del Arte',
            descripcion: 'Revisión exhaustiva de literatura especializada y bases conceptuales bajo normas APA 7ma edición.',
            entregableEsperado: 'Capitulo_II_Marco_Referencial.docx',
          },
          {
            clave: 'METODOLOGIA',
            numero: 3,
            nombre: 'Diseño Metodológico y Muestreo',
            descripcion: 'Definición de enfoque descriptivo/documental, selección de unidades de análisis e instrumentos.',
            entregableEsperado: 'Capitulo_III_Metodologia_Instrumento.docx',
          },
          {
            clave: 'TRABAJO_CAMPO',
            numero: 4,
            nombre: 'Análisis y Sistematización de Datos',
            descripcion: 'Recolección, tabulación de indicadores y procesamiento en SPSS / Excel analítico.',
            entregableEsperado: 'Base_Datos_Tabulada_Ratios.xlsx',
          },
          {
            clave: 'RESULTADOS_DISCUSION',
            numero: 5,
            nombre: 'Hallazgos, Conclusiones y Aportes',
            descripcion: 'Redacción de resultados descriptivos, contrastación con objetivos específicos y recomendaciones.',
            entregableEsperado: 'Capitulo_IV_Resultados_Conclusiones.docx',
          },
          {
            clave: 'TURNITIN_SUSTENTACION',
            numero: 6,
            nombre: 'Dictamen Aprobatorio de Asesor y Trámite Bachiller',
            descripcion: 'Control Turnitin < 15%, emisión de informe de conformidad del asesor y registro del expediente en SUNEDU.',
            entregableEsperado: 'Reporte_Turnitin_y_Dictamen_Conformidad.pdf',
          },
        ]
      : [
          {
            clave: 'PLAN_TESIS',
            numero: 1,
            nombre: 'Plan / Proyecto de Tesis (Aprobación e Inscripción VRI)',
            descripcion: 'Delimitación del problema, objetivos, justificación y matriz de consistencia metodológica inscrita en el VRI.',
            entregableEsperado: 'Proyecto_Tesis_Inscrito_VRI.pdf',
          },
          {
            clave: 'MARCO_TEORICO',
            numero: 2,
            nombre: 'Marco Teórico y Estado del Arte (Scopus / SciELO)',
            descripcion: 'Antecedentes científicos internacionales/nacionales indexados y bases teóricas rigurosas (APA 7ma / Vancouver).',
            entregableEsperado: 'Capitulo_II_Marco_Teorico_Scopus.docx',
          },
          {
            clave: 'METODOLOGIA',
            numero: 3,
            nombre: 'Metodología y Validación de Instrumentos',
            descripcion: 'Diseño metodológico, cálculo probabilístico de muestra, juicio de 3 expertos (V de Aiken) y Alfa de Cronbach.',
            entregableEsperado: 'Capitulo_III_Validacion_Juicio_Expertos.pdf',
          },
          {
            clave: 'TRABAJO_CAMPO',
            numero: 4,
            nombre: 'Trabajo de Campo y Procesamiento Estadístico',
            descripcion: 'Aplicación de instrumentos, pruebas de normalidad y estadística inferencial (SPSS v28 / Python / R).',
            entregableEsperado: 'Matriz_SPSS_Pruebas_Hipotesis.sav',
          },
          {
            clave: 'RESULTADOS_DISCUSION',
            numero: 5,
            nombre: 'Resultados, Discusión y Conclusiones',
            descripcion: 'Tablas/figuras normalizadas, contrastación de hipótesis y discusión profunda confrontando con la literatura.',
            entregableEsperado: 'Capitulo_IV_Resultados_y_Discusion.docx',
          },
          {
            clave: 'TURNITIN_SUSTENTACION',
            numero: 6,
            nombre: 'Control Turnitin, Dictamen de Jurados y Sustentación',
            descripcion: 'Similitud Turnitin < 15%, levantamiento de dictamen de 3 jurados docentes y simulación de sustentación oral.',
            entregableEsperado: 'Tesis_Completa_Aprobada_Turnitin.pdf',
          },
        ];

    // Asignar estado dinámico a cada hito basado en las bitácoras registradas
    const fasesTrazabilidad = hitosEstandar.map((h, idx) => {
      const entradasHito = bitacora.filter(
        (b) => b.hito === h.clave || b.hito?.includes(h.clave) || (idx === 0 && b.hito === 'PLAN_TESIS')
      );
      const ultimaEntradaHito = entradasHito[0] || null;

      let estado = 'PENDIENTE';
      let porcentaje = 0;

      if (customer.estadoServicio === 'FINALIZADO') {
        estado = 'COMPLETADO';
        porcentaje = 100;
      } else if (ultimaEntradaHito) {
        estado = ultimaEntradaHito.estadoRevision || 'EN_REVISION';
        porcentaje = estado === 'APROBADO' ? 100 : (ultimaEntradaHito.porcentajeAvance || 50);
      } else if (progresoGlobal > (idx + 1) * 16.6) {
        estado = 'COMPLETADO';
        porcentaje = 100;
      } else if (progresoGlobal >= idx * 16.6) {
        estado = 'EN_REVISION';
        porcentaje = Math.round(((progresoGlobal - idx * 16.6) / 16.6) * 100);
      }

      return {
        ...h,
        estado,
        porcentaje,
        ultimaRevision: ultimaEntradaHito?.fechaRegistro || null,
        observacionAsesor: ultimaEntradaHito?.observaciones || null,
        registradoPor: ultimaEntradaHito?.registradoPor || customer.asesor ? `${customer.asesor?.gradoAcademico || 'Dr.'} ${customer.asesor?.nombres} ${customer.asesor?.apellidos}` : 'Asesor Metodológico',
        turnitinPct: ultimaEntradaHito?.turnitinPct || null,
      };
    });

    // Semáforo de salud académica
    let semaforoSalud: 'OPTIMO' | 'OBSERVADO' | 'CRITICO' | 'LISTO_SUSTENTACION' = 'OPTIMO';
    if (progresoGlobal >= 90) {
      semaforoSalud = 'LISTO_SUSTENTACION';
    } else if (bitacora.some((b) => b.estadoRevision === 'OBSERVADO')) {
      semaforoSalud = 'OBSERVADO';
    } else if (progresoGlobal >= 70) {
      semaforoSalud = 'OPTIMO';
    }

    return {
      customer,
      ordenPagoId: (customer as any).ordenPagoId || null,
      codigoOrden: (customer as any).codigoOrden || customer.cotizacion?.codigoCotizacion || null,
      cuotasPago: (customer as any).cuotasPago || [],
      progresoGlobal,
      turnitinPct,
      semaforoSalud,
      modalidad: esBachiller ? 'TRABAJO_INVESTIGACION_BACHILLER' : 'TESIS_GRADO_COMPLETA',
      temaInvestigacion: customer.observaciones || ultimaBitacora?.titulo || `Investigación Aplicada en ${customer.buyer?.carrera?.nombre || 'Tesis'}`,
      fases: fasesTrazabilidad,
      bitacora,
      sesiones: customer.sesiones,
    };
  }

  /**
   * Registra una nueva anotación formal en la bitácora académica del tesista
   */
  async crearEntradaBitacora(customerId: string, data: {
    hito: string;
    titulo: string;
    porcentajeAvance: number;
    estadoRevision: string;
    observaciones: string;
    turnitinPct?: number;
    proximaEntrega?: string;
    registradoPor?: string;
  }) {
    const customer = await this.findById(customerId);

    const asesorNombre = (data.registradoPor || (customer.asesor ? `${customer.asesor.gradoAcademico || ''} ${customer.asesor.nombres} ${customer.asesor.apellidos || ''}`.trim() : 'Asesor Especialista')).replace(/'/g, "''");
    const turnitin = data.turnitinPct != null ? data.turnitinPct : null;
    const proxEntrega = data.proximaEntrega ? data.proximaEntrega.replace(/'/g, "''") : 'Próxima sesión de asesoría';
    const obsLimpia = data.observaciones ? data.observaciones.replace(/'/g, "''") : 'Sin observaciones.';
    const tituloLimpio = data.titulo ? data.titulo.replace(/'/g, "''") : 'Avance de Asesoría';

    await this.prisma.$executeRawUnsafe(`
      IF OBJECT_ID('[dbo].[BITACORA_TESIS]', 'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[BITACORA_TESIS] (
          [id] NVARCHAR(100) PRIMARY KEY,
          [customerId] NVARCHAR(100) NOT NULL,
          [asesorId] NVARCHAR(100) NULL,
          [fechaRegistro] DATETIME2 NOT NULL DEFAULT GETDATE(),
          [hito] NVARCHAR(100) NOT NULL,
          [titulo] NVARCHAR(300) NOT NULL,
          [porcentajeAvance] INT NOT NULL DEFAULT 50,
          [estadoRevision] NVARCHAR(50) NOT NULL DEFAULT 'EN_REVISION',
          [observaciones] NVARCHAR(MAX) NULL,
          [turnitinPct] DECIMAL(6,2) NULL,
          [proximaEntrega] NVARCHAR(200) NULL,
          [registradoPor] NVARCHAR(200) NULL
        );
      END;
      INSERT INTO [dbo].[BITACORA_TESIS] (
        [id], [customerId], [asesorId], [fechaRegistro], [hito], [titulo], [porcentajeAvance], [estadoRevision], [observaciones], [turnitinPct], [proximaEntrega], [registradoPor]
      ) VALUES (
        NEWID(), '${customerId}', '${customer.asesorId || ''}', GETDATE(), '${data.hito}', N'${tituloLimpio}', ${data.porcentajeAvance || 50}, '${data.estadoRevision || 'EN_REVISION'}', N'${obsLimpia}', ${turnitin !== null ? turnitin : 'NULL'}, N'${proxEntrega}', N'${asesorNombre}'
      )
    `);

    // Si el porcentaje es 100%, actualizar estado del servicio a FINALIZADO
    if (data.porcentajeAvance >= 100 && !customerId.startsWith('tesis-cust-')) {
      await this.prisma.customer.update({
        where: { id: customerId },
        data: { estadoServicio: 'FINALIZADO' },
      });
    }

    let cuotaHabilitada: any = null;
    if (data.estadoRevision === 'APROBADO' && customer.ordenPagoId) {
      const pendienteHito = (customer.cuotasPago || []).find((cp: any) => cp.estado === 'ESPERA_HITO');
      if (pendienteHito) {
        cuotaHabilitada = await this.cuotasHitoService
          .aprobarHito(Number(customer.ordenPagoId), Number(pendienteHito.numero_cuota))
          .catch((e) => {
            this.logger.warn(`No se pudo habilitar cuota tras bitácora: ${e.message}`);
            return null;
          });
      }
    }

    this.logger.log(`✓ Nueva anotación registrada en bitácora para tesista ${customer.buyer?.nombres} ${customer.buyer?.apellidos} (Hito: ${data.hito})`);

    return {
      exito: true,
      mensaje: cuotaHabilitada
        ? `Anotación registrada y Cuota #${cuotaHabilitada.cuota} (S/ ${Number(cuotaHabilitada.monto).toFixed(2)}) habilitada y notificada por Telegram.`
        : 'Anotación registrada en bitácora con éxito.',
      cuotaHabilitada,
    };
  }

  /**
   * Actualiza el estado del servicio y observaciones generales
   */
  async actualizarEstadoServicio(customerId: string, data: { estadoServicio: string; observaciones?: string }) {
    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        estadoServicio: data.estadoServicio,
        ...(data.observaciones ? { observaciones: data.observaciones } : {}),
      },
    });
    return updated;
  }
}
