import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PayersController } from './payers.controller';
import { PayersService } from './payers.service';
import { CuotasHitoService } from './cuotas-hito.service';
import { MercadoPagoProvider } from '../payments/providers/mercadopago.provider';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => WhatsAppModule)],
  controllers: [PayersController],
  providers: [PayersService, CuotasHitoService, MercadoPagoProvider],
  exports: [PayersService, CuotasHitoService],
})
export class PayersModule {}
