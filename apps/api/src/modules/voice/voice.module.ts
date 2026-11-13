import { Module } from '@nestjs/common';
import { OpenAiVoiceService } from './openai-voice.service';

@Module({
  providers: [OpenAiVoiceService],
  exports: [OpenAiVoiceService],
})
export class VoiceModule {}
