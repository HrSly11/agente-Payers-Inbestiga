import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { EmplazamientoAlertsService } from './emplazamiento-alerts.service';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [DatabaseModule, WhatsAppModule],
  controllers: [AlertsController],
  providers: [EmplazamientoAlertsService],
  exports: [EmplazamientoAlertsService],
})
export class AlertsModule {}
