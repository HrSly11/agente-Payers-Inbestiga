import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EmplazamientoAlertsService } from './emplazamiento-alerts.service';

@ApiTags('Alertas de Emplazamiento')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: EmplazamientoAlertsService) {}

  @Post('check-emplazamientos')
  @ApiOperation({
    summary: 'Evalúa y ejecuta las alertas de emplazamiento de Cobranza (PAYERS) y Atención (CUSTOMERS)',
    description: 'Aplica las reglas de las secciones 5.4 y 6.5 del informe: 4h reenvío link Culqi, 12h cuotas, 24h escalamiento humano, 48h vencimiento y 5d primera sesión.',
  })
  @ApiResponse({ status: 200, description: 'Alertas procesadas exitosamente.' })
  async checkEmplazamientos() {
    return this.alertsService.procesarTodasLasAlertas();
  }

  @Get('status')
  @ApiOperation({ summary: 'Consulta el estado del motor de alertas de emplazamiento' })
  async getStatus() {
    return {
      status: 'ONLINE',
      activo: true,
      intervaloMinutos: 15,
      fasesMonitoreadas: ['PAYERS (Cobranza)', 'CUSTOMERS (Atención)'],
    };
  }
}
