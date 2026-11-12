import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ServicesService } from './services.service';

@ApiTags('Servicios y Reglas Comerciales')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener catálogo de servicios de tesis vigentes' })
  async findAll() {
    return this.servicesService.findAll();
  }

  @Get('rules')
  @ApiOperation({ summary: 'Obtener reglas comerciales vigentes (descuentos máximos, cuotas)' })
  async findCommercialRules() {
    return this.servicesService.findCommercialRules();
  }

  @Put('rules/:id')
  @ApiOperation({ summary: 'Actualizar límites de regla comercial' })
  async updateCommercialRule(@Param('id') id: string, @Body() data: any) {
    return this.servicesService.updateCommercialRule(id, data);
  }
}
