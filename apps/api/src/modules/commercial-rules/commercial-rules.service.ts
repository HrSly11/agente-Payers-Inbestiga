import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CalculateOfferInput, CalculateOfferResult } from '@inbestiga/shared';

@Injectable()
export class CommercialRulesService {
  private readonly logger = new Logger(CommercialRulesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valida rigurosamente cualquier oferta o descuento propuesto por el Agente IA
   * contra las reglas comerciales almacenadas en SQL Server.
   * PRINCIPIO: La IA propone -> El Backend valida -> Oferta comercialmente válida.
   */
  async validarYCalcularOferta(input: CalculateOfferInput): Promise<CalculateOfferResult> {
    const servicio = await this.prisma.servicio.findUnique({
      where: { id: input.servicioId },
      include: { reglasComerciales: { where: { activo: true } } },
    });

    if (!servicio) {
      throw new BadRequestException(`El servicio con ID ${input.servicioId} no existe en el catálogo.`);
    }

    const precioBase = Number(servicio.precioBase);
    const precioMinimoCatalogo = Number(servicio.precioMinimo);
    const maxCuotasServicio = servicio.maxCuotas;

    // Regla comercial específica o regla por defecto del sistema
    const regla = servicio.reglasComerciales[0];
    const descuentoMaximoPermitido = regla ? Number(regla.descuentoMaximoPct) : 15.0;
    const cuotaMinimaPermitida = regla ? Number(regla.cuotaMinima) : 200.0;

    const descuentoPropuesto = Math.max(0, Number(input.descuentoPropuestoPct || 0));
    const cuotasPropuestas = Math.max(1, Number(input.numeroCuotas || 1));

    // 1. Validación de descuento máximo
    if (descuentoPropuesto > descuentoMaximoPermitido) {
      this.logger.warn(`Oferta RECHAZADA: Descuento propuesto (${descuentoPropuesto}%) supera el máximo permitido (${descuentoMaximoPermitido}%).`);
      return {
        valido: false,
        servicioNombre: servicio.nombre,
        precioBase,
        descuentoAplicadoPct: 0,
        precioFinal: precioBase,
        numeroCuotas: 1,
        montoPorCuota: precioBase,
        descuentoMaximoPermitidoPct: descuentoMaximoPermitido,
        plazoSemanas: servicio.plazoSemanasMin,
        mensajeRechazo: `RECHAZADO POR MOTOR DE REGLAS: El descuento solicitado de ${descuentoPropuesto}% excede el límite máximo institucional de ${descuentoMaximoPermitido}%. El precio mínimo autorizado es S/ ${(precioBase * (1 - descuentoMaximoPermitido / 100)).toFixed(2)}.`,
      };
    }

    // 2. Validación de cuotas máximas
    if (cuotasPropuestas > maxCuotasServicio) {
      this.logger.warn(`Oferta RECHAZADA: Número de cuotas (${cuotasPropuestas}) supera el máximo permitido (${maxCuotasServicio}).`);
      return {
        valido: false,
        servicioNombre: servicio.nombre,
        precioBase,
        descuentoAplicadoPct: 0,
        precioFinal: precioBase,
        numeroCuotas: maxCuotasServicio,
        montoPorCuota: Math.round(precioBase / maxCuotasServicio),
        descuentoMaximoPermitidoPct: descuentoMaximoPermitido,
        plazoSemanas: servicio.plazoSemanasMin,
        mensajeRechazo: `RECHAZADO POR MOTOR DE REGLAS: El número de cuotas (${cuotasPropuestas}) excede el límite máximo permitido para este servicio (${maxCuotasServicio} cuotas).`,
      };
    }

    // 3. Cálculo de precio final con descuento
    const montoDescuento = (precioBase * descuentoPropuesto) / 100;
    const precioFinal = Math.round((precioBase - montoDescuento) * 100) / 100;

    // Verificar que no sea menor al precio mínimo
    if (precioFinal < precioMinimoCatalogo) {
      this.logger.warn(`Oferta RECHAZADA: Precio final (S/ ${precioFinal}) es menor al precio mínimo institucional (S/ ${precioMinimoCatalogo}).`);
      return {
        valido: false,
        servicioNombre: servicio.nombre,
        precioBase,
        descuentoAplicadoPct: 0,
        precioFinal: precioMinimoCatalogo,
        numeroCuotas: cuotasPropuestas,
        montoPorCuota: Math.round(precioMinimoCatalogo / cuotasPropuestas),
        descuentoMaximoPermitidoPct: descuentoMaximoPermitido,
        plazoSemanas: servicio.plazoSemanasMin,
        mensajeRechazo: `RECHAZADO POR MOTOR DE REGLAS: El precio propuesto de S/ ${precioFinal} es inferior al precio piso de S/ ${precioMinimoCatalogo}.`,
      };
    }

    // 4. Validación de cuota mínima
    const montoPorCuota = Math.round((precioFinal / cuotasPropuestas) * 100) / 100;
    if (montoPorCuota < cuotaMinimaPermitida && cuotasPropuestas > 1) {
      return {
        valido: false,
        servicioNombre: servicio.nombre,
        precioBase,
        descuentoAplicadoPct: descuentoPropuesto,
        precioFinal,
        numeroCuotas: 1,
        montoPorCuota: precioFinal,
        descuentoMaximoPermitidoPct: descuentoMaximoPermitido,
        plazoSemanas: servicio.plazoSemanasMin,
        mensajeRechazo: `RECHAZADO POR MOTOR DE REGLAS: La cuota mensual resultante (S/ ${montoPorCuota}) es inferior al mínimo permitido por cuota (S/ ${cuotaMinimaPermitida}). Reduce el número de cuotas.`,
      };
    }

    this.logger.log(`Oferta VALIDADA con éxito: ${servicio.nombre} - Precio Base: S/ ${precioBase} -> Precio Final: S/ ${precioFinal} (${cuotasPropuestas} cuotas de S/ ${montoPorCuota})`);

    return {
      valido: true,
      servicioNombre: servicio.nombre,
      precioBase,
      descuentoAplicadoPct: descuentoPropuesto,
      precioFinal,
      numeroCuotas: cuotasPropuestas,
      montoPorCuota,
      descuentoMaximoPermitidoPct: descuentoMaximoPermitido,
      plazoSemanas: servicio.plazoSemanasMin,
    };
  }
}
