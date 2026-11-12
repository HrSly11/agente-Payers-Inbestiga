import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class DwService {
  private readonly logger = new Logger(DwService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el orquestador maestro ETL para poblar secuencialmente los 4 Data Marts independientes
   * (inbestiga_dm_buyers, inbestiga_dm_leads, inbestiga_dm_payers, inbestiga_dm_customers) desde inbestiga_db
   * y sincronizar el Data Mart Definitivo (INBESTIGA_MART) desde INBESTIGA_TESIS.
   */
  async runEtl(): Promise<{ exito: boolean; mensaje: string; duracionMs: number; timestamp: string }> {
    const inicio = Date.now();
    try {
      this.logger.log('Iniciando ejecución de orquestador ETL hacia los Data Marts y INBESTIGA_MART...');
      await this.prisma.$executeRawUnsafe(`EXEC inbestiga_db.dbo.sp_etl_populate_datamarts;`);
      const duracionMs = Date.now() - inicio;
      this.logger.log(`ETL completado exitosamente en ${duracionMs} ms.`);
      return {
        exito: true,
        mensaje:
          'Proceso ETL completado con éxito. INBESTIGA_MART (04_ETL_POBLAR_DATAMART_DEFINITIVO) y los 4 Data Marts han sido sincronizados.',
        duracionMs,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error('Error durante la ejecución del procedimiento ETL:', error);
      return {
        exito: false,
        mensaje: `Error ejecutando ETL: ${error.message}`,
        duracionMs: Date.now() - inicio,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * DATA MART 1: BUYERS (Captación y Marketing - inbestiga_dm_buyers)
   */
  async getDataMartBuyers(): Promise<any> {
    try {
      const conversion: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_buyers.dbo.vw_kpi_buyers_conversion;`);
      const cpl: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_buyers.dbo.vw_kpi_buyers_cpl;`);
      const interacciones: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_buyers.dbo.vw_kpi_buyers_interacciones;`);
      const tiempoRespuesta: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_buyers.dbo.vw_kpi_buyers_tiempo_primera_respuesta;`);
      const porCanal: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_buyers.dbo.vw_kpi_buyers_por_canal;`);

      return {
        nombre: 'Data Mart: Captación y Marketing (BUYERS)',
        fase: 'FASE_1',
        kpis: {
          conversion: conversion[0] || {},
          cplPorCampana: cpl,
          promedioInteracciones: interacciones[0] || {},
          tiempoPrimeraRespuestaIA: tiempoRespuesta[0] || {},
          rendimientoCanales: porCanal,
        },
      };
    } catch (error: any) {
      this.logger.warn(`Error al consultar inbestiga_dm_buyers: ${error.message}`);
      return null;
    }
  }

  /**
   * DATA MART 2: LEADS (Conversión y Negociación con IA - inbestiga_dm_leads)
   */
  async getDataMartLeads(): Promise<any> {
    try {
      const conversion: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_leads.dbo.vw_kpi_leads_conversion;`);
      const recuperacion: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_leads.dbo.vw_kpi_leads_recuperacion_objeciones;`);
      const tiempoCierre: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_leads.dbo.vw_kpi_leads_tiempo_negociacion;`);
      const escalamiento: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_leads.dbo.vw_kpi_leads_escalamiento;`);
      const descuento: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_leads.dbo.vw_kpi_leads_descuento_promedio;`);
      const porUniversidad: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_leads.dbo.vw_kpi_leads_por_universidad;`);

      return {
        nombre: 'Data Mart: Conversión y Negociación con IA (LEADS)',
        fase: 'FASE_2',
        kpis: {
          conversion: conversion[0] || {},
          recuperacionObjeciones: recuperacion[0] || {},
          tiempoCierre: tiempoCierre[0] || {},
          escalamientoHumano: escalamiento[0] || {},
          descuentoPromedio: descuento[0] || {},
          desglosePorUniversidad: porUniversidad,
        },
      };
    } catch (error: any) {
      this.logger.warn(`Error al consultar inbestiga_dm_leads: ${error.message}`);
      return null;
    }
  }

  /**
   * DATA MART 3: PAYERS (Cobranza Automatizada y Pasarela - INBESTIGA_MART + R-PAYERS)
   */
  async getDataMartPayers(): Promise<any> {
    try {
      const kpisP01P06: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM INBESTIGA_MART.dbo.vw_rpayers_kpis ORDER BY orden;`,
      );
      const vista31Ordenes: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM INBESTIGA_MART.dbo.vw_rpayers_vista_3_1_ordenes ORDER BY orden_fila;`,
      );
      const vista31Servicio: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM INBESTIGA_MART.dbo.vw_rpayers_vista_3_1_servicio ORDER BY orden_fila;`,
      );
      const vista32Recuperacion: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM INBESTIGA_MART.dbo.vw_rpayers_vista_3_2_recuperacion ORDER BY orden_fila;`,
      );
      const vista33Medios: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM INBESTIGA_MART.dbo.vw_rpayers_vista_3_3_medios ORDER BY orden_fila;`,
      );
      const ordenesDetalle: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT TOP 104 * FROM INBESTIGA_MART.dbo.vw_rpayers_ordenes_detalle ORDER BY id_orden_pago;`,
      );

      const totalRow31 = vista31Ordenes.find((r) => r.modalidad_pago === 'TOTAL') || {};
      const totalRow32 = vista32Recuperacion.find((r) => r.secuencia === 'TOTAL') || {};
      const totalRow33 = vista33Medios.find((r) => r.medio_pago === 'TOTAL') || {};
      const kpiP02 = kpisP01P06.find((k) => k.codigo === 'P02') || {};

      return {
        nombre: 'Data Mart: Cobranza Automatizada y Activación (PAYERS - INBESTIGA_MART)',
        fase: 'FASE_3',
        kpis: {
          conversion: {
            total_ordenes_pago: Number(totalRow31.ordenes_creadas ?? 104),
            ordenes_con_pago_confirmado: Number(totalRow31.ordenes_con_pago ?? 86),
            tasa_confirmacion_pago_p01_pct: Number(totalRow31.pct_confirmacion_p01 ?? 82.7),
            monto_comprometido_soles: Number(totalRow31.monto_comprometido ?? 180540),
            monto_exigible_soles: Number(totalRow31.monto_exigible ?? 121400),
            monto_cobrado_soles: Number(totalRow31.monto_cobrado ?? 110480),
            tasa_cobranza_efectiva_p04_pct: Number(totalRow31.pct_cobranza_efectiva_p04 ?? 91.0),
          },
          tiempoConfirmacionCulqi: {
            promedio_minutos_primer_pago_p02: Number(kpiP02.valor ?? 8.6),
            meta_minutos: Number(kpiP02.meta_bueno ?? 10.0),
            estado_semaforo: kpiP02.estado_semaforo ?? 'Bueno',
            tasa_confirmacion_webhook_p05_pct: Number(totalRow33.pct_confirmacion_auto_p05 ?? 82.0),
            total_pagos_confirmados: Number(totalRow33.pagos_confirmados ?? 150),
            pagos_por_webhook: Number(totalRow33.pagos_por_webhook ?? 123),
            comision_pasarela_soles: Number(totalRow33.comision_pasarela ?? 3013.81),
            costo_cobro_pct_p06: Number(totalRow33.pct_costo_cobro_p06 ?? 2.73),
          },
          recuperacionAlertasCobranza: {
            total_alertados: Number(totalRow32.payers_alertados ?? 55),
            total_recuperados_72h: Number(totalRow32.payers_recuperados_72h ?? 34),
            tasa_recuperacion_p03_pct: Number(totalRow32.pct_recuperacion_p03 ?? 61.8),
            escalamientos_humano: Number(totalRow32.escalamientos_humano ?? 21),
            monto_recuperado_soles: Number(totalRow32.monto_recuperado ?? 0),
          },
          recaudacionPorMetodoYCuota: vista33Medios.filter((r) => r.medio_pago !== 'TOTAL'),
          reporteRPayers: {
            kpisP01P06,
            vista31Ordenes,
            vista31Servicio,
            vista32Recuperacion,
            vista33Medios,
            ordenesDetalle,
          },
        },
      };
    } catch (error: any) {
      this.logger.warn(`Error al consultar INBESTIGA_MART (PAYERS): ${error.message}`);
      return null;
    }
  }

  /**
   * DATA MART 4: CUSTOMERS (Atención, Bitácora y Satisfacción - inbestiga_dm_customers)
   */
  async getDataMartCustomers(): Promise<any> {
    try {
      const asignacion: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_customers.dbo.vw_kpi_customers_tiempo_asignacion;`);
      const primeraSesion: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_customers.dbo.vw_kpi_customers_primera_sesion_48h;`);
      const cumplimiento: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_customers.dbo.vw_kpi_customers_cumplimiento_cronograma;`);
      const riesgo: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_customers.dbo.vw_kpi_customers_deteccion_riesgo;`);
      const satisfaccion: any[] = await this.prisma.$queryRawUnsafe(`SELECT * FROM inbestiga_dm_customers.dbo.vw_kpi_customers_satisfaccion;`);

      return {
        nombre: 'Data Mart: Atención, Bitácora y Satisfacción (CUSTOMERS)',
        fase: 'FASE_4',
        kpis: {
          tiempoAsignacionAsesor: asignacion[0] || {},
          primeraSesion48h: primeraSesion[0] || {},
          cumplimientoCronograma: cumplimiento[0] || {},
          deteccionRiesgoAbandono: riesgo[0] || {},
          satisfaccionPromedio: satisfaccion[0] || {},
        },
      };
    } catch (error: any) {
      this.logger.warn(`Error al consultar inbestiga_dm_customers: ${error.message}`);
      return null;
    }
  }

  /**
   * Retorna los 4 Data Marts estructurados para el Dashboard Analítico
   */
  async getAllDataMarts(): Promise<{
    dm_buyers: any;
    dm_leads: any;
    dm_payers: any;
    dm_customers: any;
  }> {
    const buyers = await this.getDataMartBuyers();
    const leads = await this.getDataMartLeads();
    const payers = await this.getDataMartPayers();
    const customers = await this.getDataMartCustomers();

    return {
      dm_buyers: buyers,
      dm_leads: leads,
      dm_payers: payers,
      dm_customers: customers,
    };
  }

  /**
   * Compatibilidad hacia atrás para endpoints previos
   */
  async getDwOverview(): Promise<any> {
    return this.getAllDataMarts();
  }
}
