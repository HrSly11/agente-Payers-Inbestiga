import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Asesores Académicos')
@Controller('advisors')
export class AdvisorsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Listar asesores académicos disponibles y su carga activa' })
  async findAll() {
    return this.prisma.asesor.findMany({
      where: { activo: true },
      include: {
        customers: {
          include: {
            buyer: { select: { nombres: true, apellidos: true } },
            servicio: { select: { nombre: true } },
          },
        },
      },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un asesor y sus tesistas' })
  async findById(@Param('id') id: string) {
    return this.prisma.asesor.findUnique({
      where: { id },
      include: {
        customers: {
          include: {
            buyer: true,
            servicio: true,
            sesiones: true,
          },
        },
      },
    });
  }
}
