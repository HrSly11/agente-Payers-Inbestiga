import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DwService } from '../../database/dw.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dwService: DwService,
  ) {}

  async getMetrics() {
    // 1. Consultar los 4 Data Marts multidimensionales desde inbestiga_dw
    const dataMarts = await this.dwService.getAllDataMarts();

    // 2. Contadores del Funnel IMPULSE basados en Data Marts (con fallback a OLTP si el DW no ha sido sincronizado)
    const totalBuyers =
      dataMarts.dm_buyers?.kpis?.conversion?.total_buyers_captados ??
      (await this.prisma.buyer.count());

    const totalLeads =
      dataMarts.dm_buyers?.kpis?.conversion?.total_leads_generados ??
      (await this.prisma.lead.count());

    const totalPayers = await this.prisma.payer.count();
    const totalCustomers = await this.prisma.customer.count();

    // Universo sustentado en base al conteo de interacciones de tráfico (visitas, clics y descargas)
    const totalInteracciones = await this.prisma.interaccion.count();
    const totalUniverso = Math.max(50, totalInteracciones * 2, totalBuyers * 4);

    // 3. Tasas de Conversión Dimensionales y Metas de Negocio
    const conversionUniversoBuyer =
      totalUniverso > 0 ? Number(((totalBuyers / totalUniverso) * 100).toFixed(1)) : 0;

    const conversionBuyerLead =
      dataMarts.dm_buyers?.kpis?.conversion?.tasa_conversion_buyer_lead_pct != null
        ? Number(dataMarts.dm_buyers.kpis.conversion.tasa_conversion_buyer_lead_pct)
        : totalBuyers > 0
          ? Number(((totalLeads / totalBuyers) * 100).toFixed(1))
          : 0;

    const conversionLeadPayer =
      dataMarts.dm_leads?.kpis?.conversion?.tasa_conversion_lead_payer_pct != null
        ? Number(dataMarts.dm_leads.kpis.conversion.tasa_conversion_lead_payer_pct)
        : totalLeads > 0
          ? Number(((totalPayers / totalLeads) * 100).toFixed(1))
          : 0;

    const conversionPayerCustomer =
      totalPayers > 0 ? Number(((totalCustomers / totalPayers) * 100).toFixed(1)) : 0;

    // 4. Lead Score Promedio (desde dm_shared o BUYER)
    const avgScoreResult = await this.prisma.buyer.aggregate({
      _avg: { leadScore: true },
    });
    const avgLeadScore = Math.round(avgScoreResult._avg.leadScore || 0);

    // 5. Monto Total Recaudado y Métodos de Pago
    const pagosConfirmados = await this.prisma.pago.findMany({
      where: { estado: 'CONFIRMADO' },
    });
    const montoRecaudado = pagosConfirmados.reduce((sum, p) => sum + Number(p.monto), 0);

    const metodosPagoCount: Record<string, number> = { CARD: 0, YAPE: 0, TRANSFER: 0 };
    pagosConfirmados.forEach((p) => {
      metodosPagoCount[p.metodoPago] = (metodosPagoCount[p.metodoPago] || 0) + 1;
    });

    // 6. Segmentación por Universidad (dm_shared.DIM_UNIVERSIDAD)
    const universidades = await this.prisma.universidad.findMany({
      include: {
        _count: { select: { buyers: true } },
      },
      orderBy: { buyers: { _count: 'desc' } },
      take: 5,
    });

    const segmentacionUniversidades = universidades.map((u) => ({
      nombre: u.siglas || u.nombre,
      nombreCompleto: u.nombre,
      ciudad: u.ciudad,
      tipo: u.tipo,
      buyers: u._count.buyers,
    }));

    // 7. Segmentación por Carrera (dm_shared.DIM_CARRERA)
    const carreras = await this.prisma.carrera.findMany({
      include: {
        _count: { select: { buyers: true } },
      },
      orderBy: { buyers: { _count: 'desc' } },
      take: 5,
    });

    const segmentacionCarreras = carreras.map((c) => ({
      nombre: c.nombre,
      area: c.areaConocimiento,
      buyers: c._count.buyers,
    }));

    // 8. Objeciones registradas (dm_leads.DIM_OBJECION)
    const objeciones = await this.prisma.objecion.groupBy({
      by: ['tipo'],
      _count: { id: true },
    });

    // 9. Segmentación por Ubicación (dm_buyers.DIM_UBICACION)
    const ubicaciones = await this.prisma.ubicacion.findMany({
      include: { _count: { select: { buyers: true } } },
      orderBy: { buyers: { _count: 'desc' } },
      take: 6,
    });
    const segmentacionUbicaciones = ubicaciones
      .filter((u) => u._count.buyers > 0)
      .map((u) => ({
        departamento: u.departamento,
        provincia: u.provincia,
        distrito: u.distrito,
        nombre: `${u.distrito} (${u.provincia})`,
        buyers: u._count.buyers,
      }));

    // 10. Segmentación por Ciclo Académico
    const ciclos = await this.prisma.buyer.groupBy({
      by: ['ciclo'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    const segmentacionCiclos = ciclos
      .filter((c) => c.ciclo)
      .map((c) => ({
        ciclo: c.ciclo!,
        buyers: c._count.id,
      }));

    // 11. Segmentación por Tipo de Investigación
    const tiposInvestigacion = await this.prisma.buyer.groupBy({
      by: ['tipoInvestigacion'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    const segmentacionTiposInvestigacion = tiposInvestigacion
      .filter((t) => t.tipoInvestigacion)
      .map((t) => ({
        tipo: t.tipoInvestigacion!,
        buyers: t._count.id,
      }));

    // 12. Segmentación por Canal de Captación (dm_buyers.DIM_CANAL)
    const canales = await this.prisma.canal.findMany({
      include: { _count: { select: { buyers: true } } },
      orderBy: { buyers: { _count: 'desc' } },
    });
    const segmentacionCanales = canales.map((c) => ({
      nombre: c.nombre,
      codigo: c.codigo,
      tipo: c.tipo,
      buyers: c._count.buyers,
    }));

    // 13. Segmentación por Servicio Demandado (dm_shared.DIM_SERVICIO)
    const servicios = await this.prisma.servicio.findMany({
      include: {
        _count: { select: { cotizaciones: true, customers: true } },
      },
    });
    const segmentacionServicios = servicios.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      codigo: s.codigo,
      precioBase: s.precioBase,
      cotizaciones: s._count.cotizaciones,
      customers: s._count.customers,
    }));

    // 14. Segmentación por Estado del Funnel
    const estadosFunnel = await this.prisma.buyer.groupBy({
      by: ['estadoFunnel'],
      _count: { id: true },
    });
    const segmentacionEstadosFunnel = estadosFunnel.map((e) => ({
      estado: e.estadoFunnel,
      cantidad: e._count.id,
    }));

    // 15. Notificaciones Recientes
    const notificaciones = await this.prisma.notificacion.findMany({
      orderBy: { fechaCreacion: 'desc' },
      take: 6,
    });

    // 16. Asesores con carga actual (dm_customers.DIM_ASESOR)
    const asesores = await this.prisma.asesor.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        especialidad: true,
        clientesActivos: true,
        maxClientesSimultaneos: true,
      },
    });

    return {
      funnel: {
        universo: totalUniverso,
        buyers: totalBuyers,
        leads: totalLeads,
        payers: totalPayers,
        customers: totalCustomers,
      },
      conversiones: {
        universoABuyer: conversionUniversoBuyer,
        buyerALead: conversionBuyerLead,
        leadAPayer: conversionLeadPayer,
        payerACustomer: conversionPayerCustomer,
      },
      kpis: {
        avgLeadScore,
        montoRecaudado,
        totalPagos: pagosConfirmados.length,
        metodosPago: metodosPagoCount,
        asesoresActivos: asesores.length,
      },
      segmentacion: {
        universidades: segmentacionUniversidades,
        carreras: segmentacionCarreras,
        ubicaciones: segmentacionUbicaciones,
        ciclos: segmentacionCiclos,
        tiposInvestigacion: segmentacionTiposInvestigacion,
        canales: segmentacionCanales,
        servicios: segmentacionServicios,
        estadosFunnel: segmentacionEstadosFunnel,
        objeciones: objeciones.map((o) => ({ tipo: o.tipo, cantidad: o._count.id })),
      },
      asesores,
      notificaciones,
      // Los 4 Data Marts desacoplados (Metodología Ralph Kimball)
      dataMarts,
    };
  }
}
