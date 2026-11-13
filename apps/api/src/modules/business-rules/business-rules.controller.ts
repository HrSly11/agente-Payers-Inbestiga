import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BusinessRulesService, ReglaNegocioDto } from './business-rules.service';

@ApiTags('Reglas de Negocio (Motor Dinámico)')
@Controller('business-rules')
export class BusinessRulesController {
  constructor(private readonly businessRulesService: BusinessRulesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener catálogo completo de reglas de negocio desde SQL Server' })
  async getReglas() {
    return this.businessRulesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva regla de negocio dinámica en la BD' })
  async createRegla(@Body() dto: ReglaNegocioDto) {
    return this.businessRulesService.create(dto);
  }

  @Put(':codigo')
  @ApiOperation({ summary: 'Actualizar valor o estado lógico (activo/inactivo) de una regla de negocio' })
  async updateRegla(@Param('codigo') codigo: string, @Body() dto: Partial<ReglaNegocioDto>) {
    return this.businessRulesService.update(codigo, dto);
  }
}
