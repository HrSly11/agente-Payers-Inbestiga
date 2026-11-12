import { Controller, Post, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DwService } from '../../database/dw.service';

@ApiTags('Data Marts & ETL')
@Controller('etl')
export class EtlController {
  constructor(private readonly dwService: DwService) {}

  @Post('run')
  @ApiOperation({ summary: 'Ejecuta el orquestador ETL para sincronizar los 4 Data Marts desde inbestiga_db' })
  async runEtl() {
    return this.dwService.runEtl();
  }

  @Get('overview')
  @ApiOperation({ summary: 'Obtiene el resumen de KPIs y hechos de los 4 Data Marts independientes' })
  async getOverview() {
    return this.dwService.getDwOverview();
  }
}
