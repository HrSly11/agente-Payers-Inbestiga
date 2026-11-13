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
    let prismaAdvisors: any[] = [];
    try {
      prismaAdvisors = await this.prisma.asesor.findMany({
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
    } catch {
      prismaAdvisors = [];
    }

    if (prismaAdvisors.length > 0) {
      return prismaAdvisors;
    }

    try {
      const tesisAdvisors: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT asesor_id, codigo_asesor, nombre, especialidad, rol, activo
        FROM INBESTIGA_TESIS.dbo.ASESOR
        WHERE activo = 1
        ORDER BY asesor_id ASC
      `);
      return tesisAdvisors.map((a) => ({
        id: String(a.asesor_id),
        codigoAsesor: a.codigo_asesor,
        gradoAcademico: '',
        nombres: a.nombre,
        apellidos: '',
        especialidad: a.especialidad,
        rol: a.rol,
        activo: Boolean(a.activo),
        customers: [],
      }));
    } catch {
      return [];
    }
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
