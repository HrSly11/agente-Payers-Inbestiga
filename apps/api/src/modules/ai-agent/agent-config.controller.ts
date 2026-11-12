import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Configuración del Agente IA')
@Controller('agent/config')
export class AgentConfigController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener configuración vigente del Agente IA de negociación' })
  async getConfig() {
    const config = await this.prisma.configuracionAgente.findFirst({
      where: { activo: true },
      orderBy: { id: 'desc' },
    });
    return config;
  }

  @Put()
  @ApiOperation({ summary: 'Actualizar configuración, modelo, personalidad y prompt del Agente IA' })
  async updateConfig(
    @Body()
    data: {
      proveedorIA?: string;
      modelo?: string;
      promptSistema?: string;
      tono?: string;
      estilo?: string;
      permitirNegociacion?: boolean;
      maxDescuentoNegociablePct?: number;
      maxCuotasNegociables?: number;
      reglasObjecionesJson?: string;
      horarioInicio?: string;
      horarioFin?: string;
    },
  ) {
    const actual = await this.prisma.configuracionAgente.findFirst({
      where: { activo: true },
      orderBy: { id: 'desc' },
    });

    if (actual) {
      return this.prisma.configuracionAgente.update({
        where: { id: actual.id },
        data,
      });
    }

    return this.prisma.configuracionAgente.create({
      data: {
        proveedorIA: data.proveedorIA || 'GEMINI',
        modelo: data.modelo || 'gemini-1.5-flash',
        promptSistema: data.promptSistema || 'Eres el Asesor Especialista Comercial de INBESTIGA.TESIS.',
        tono: data.tono || 'Profesional y resolutivo',
        estilo: data.estilo || 'Consultor académico',
        permitirNegociacion: data.permitirNegociacion ?? true,
        maxDescuentoNegociablePct: data.maxDescuentoNegociablePct || 15.0,
        maxCuotasNegociables: data.maxCuotasNegociables || 3,
        reglasObjecionesJson: data.reglasObjecionesJson,
        horarioInicio: data.horarioInicio || '08:00',
        horarioFin: data.horarioFin || '22:00',
        activo: true,
      },
    });
  }
}
