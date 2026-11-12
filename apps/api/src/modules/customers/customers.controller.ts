import { Controller, Get, Post, Patch, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CustomersService } from './customers.service';

@ApiTags('Customers / Atención')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los estudiantes convertidos a CUSTOMERS con asesor y sesiones' })
  async findAll(@Query('estadoServicio') estadoServicio?: string, @Query('asesorId') asesorId?: string) {
    return this.customersService.findAll({ estadoServicio, asesorId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle completo de atención de un CUSTOMER' })
  async findById(@Param('id') id: string) {
    return this.customersService.findById(id);
  }

  @Get(':id/trazabilidad')
  @ApiOperation({ summary: 'Obtener trazabilidad académica completa de tesis, hitos y bitácora' })
  async getTrazabilidad(@Param('id') id: string) {
    return this.customersService.getTrazabilidad(id);
  }

  @Post(':id/bitacora')
  @ApiOperation({ summary: 'Registrar nueva anotación o avance en la bitácora del tesista' })
  async crearEntradaBitacora(@Param('id') id: string, @Body() body: any) {
    return this.customersService.crearEntradaBitacora(id, body);
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Actualizar estado del servicio académico del CUSTOMER' })
  async actualizarEstadoServicio(@Param('id') id: string, @Body() body: { estadoServicio: string; observaciones?: string }) {
    return this.customersService.actualizarEstadoServicio(id, body);
  }
}
