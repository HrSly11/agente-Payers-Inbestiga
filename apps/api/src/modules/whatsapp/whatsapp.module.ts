import { Module, forwardRef } from '@nestjs/common';
import { EvolutionProvider } from './evolution.provider';
import { EvolutionDbService } from './evolution-db.service';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { NegotiationModule } from '../negotiation/negotiation.module';
import { PayersModule } from '../payers/payers.module';
import { VoiceModule } from '../voice/voice.module';

@Module({
  imports: [forwardRef(() => NegotiationModule), forwardRef(() => PayersModule), VoiceModule],
  controllers: [WhatsAppController],
  providers: [EvolutionProvider, EvolutionDbService, WhatsAppService],
  exports: [WhatsAppService, EvolutionProvider, EvolutionDbService],
})
export class WhatsAppModule {}
