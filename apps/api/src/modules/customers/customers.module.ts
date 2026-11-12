import { Module, forwardRef } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { PayersModule } from '../payers/payers.module';

@Module({
  imports: [forwardRef(() => WhatsAppModule), PayersModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
