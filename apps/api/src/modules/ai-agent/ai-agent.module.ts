import { Module } from '@nestjs/common';
import { GeminiProvider } from './providers/gemini.provider';
import { GrokProvider } from './providers/grok.provider';
import { AiToolsService } from './tools/ai-tools.service';
import { AiAgentService } from './ai-agent.service';
import { CommercialRulesModule } from '../commercial-rules/commercial-rules.module';

import { AgentConfigController } from './agent-config.controller';

@Module({
  imports: [CommercialRulesModule],
  controllers: [AgentConfigController],
  providers: [GeminiProvider, GrokProvider, AiToolsService, AiAgentService],
  exports: [AiAgentService, AiToolsService],
})
export class AiAgentModule {}
