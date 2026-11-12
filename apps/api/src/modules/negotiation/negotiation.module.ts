import { Module, forwardRef } from '@nestjs/common';
import { NegotiationService } from './negotiation.service';
import { NegotiationController } from './negotiation.controller';
import { AiAgentModule } from '../ai-agent/ai-agent.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [AiAgentModule, forwardRef(() => WhatsAppModule)],
  controllers: [NegotiationController],
  providers: [NegotiationService],
  exports: [NegotiationService],
})
export class NegotiationModule {}
