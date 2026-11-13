import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { BusinessRulesService } from './business-rules.service';
import { BusinessRulesController } from './business-rules.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [BusinessRulesController],
  providers: [BusinessRulesService],
  exports: [BusinessRulesService],
})
export class BusinessRulesModule {}
