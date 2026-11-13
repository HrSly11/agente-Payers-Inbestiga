import { Module, forwardRef } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { PayersModule } from '../payers/payers.module';
import { VoiceModule } from '../voice/voice.module';

@Module({
  imports: [forwardRef(() => PayersModule), VoiceModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
