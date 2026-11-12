import { Module } from '@nestjs/common';
import { CommercialRulesService } from './commercial-rules.service';

@Module({
  providers: [CommercialRulesService],
  exports: [CommercialRulesService],
})
export class CommercialRulesModule {}
