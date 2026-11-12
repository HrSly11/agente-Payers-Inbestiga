import { Module, forwardRef } from '@nestjs/common';
import { OpenWAProvider } from './openwa.provider';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { NegotiationModule } from '../negotiation/negotiation.module';

@Module({
  imports: [forwardRef(() => NegotiationModule)],
  controllers: [WhatsAppController],
  providers: [OpenWAProvider, WhatsAppService],
  exports: [WhatsAppService, OpenWAProvider],
})
export class WhatsAppModule {}
