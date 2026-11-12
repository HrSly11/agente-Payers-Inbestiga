import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NegotiationService } from './negotiation.service';

@ApiTags('Negociación IA')
@Controller('negotiation')
export class NegotiationController {
  constructor(private readonly negotiationService: NegotiationService) {}

  @Post('iniciar/:buyerId')
  @ApiOperation({ summary: 'Acción central [INICIAR NEGOCIACIÓN]: Activa el agente IA y despacha el primer mensaje a WhatsApp' })
  async iniciarNegociacion(@Param('buyerId') buyerId: string) {
    return this.negotiationService.iniciarNegociacion(buyerId);
  }

  @Get('conversacion/:id')
  @ApiOperation({ summary: 'Obtener historial de mensajes y estado de una conversación' })
  async getConversacion(@Param('id') id: string) {
    return this.negotiationService.getConversacion(id);
  }

  @Post('enviar-mensaje')
  @ApiOperation({ summary: 'Permite enviar un mensaje de prueba a la negociación activa' })
  async enviarMensaje(@Body() body: { telefono: string; contenido: string }) {
    return this.negotiationService.procesarMensajeEstudiante(body.telefono, body.contenido);
  }

  @Post('conversacion/:id/limpiar')
  @ApiOperation({ summary: 'Limpia el chat y reinicia la conversación a fase DISCOVERY y al alumno a LEAD' })
  async limpiarConversacion(@Param('id') id: string) {
    return this.negotiationService.limpiarConversacion(id);
  }

  @Post('buyer/:buyerId/limpiar')
  @ApiOperation({ summary: 'Limpia el chat y reinicia la conversación activa de un buyer a DISCOVERY' })
  async limpiarConversacionPorBuyer(@Param('buyerId') buyerId: string) {
    return this.negotiationService.limpiarConversacionPorBuyer(buyerId);
  }
}
