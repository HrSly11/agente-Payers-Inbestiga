import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.servicio.findMany({
      where: { activo: true },
      include: { reglasComerciales: true },
    });
  }

  async findCommercialRules() {
    return this.prisma.reglaComercial.findMany({
      include: { servicio: true },
    });
  }

  async updateCommercialRule(id: string, data: any) {
    return this.prisma.reglaComercial.update({
      where: { id },
      data,
    });
  }
}
