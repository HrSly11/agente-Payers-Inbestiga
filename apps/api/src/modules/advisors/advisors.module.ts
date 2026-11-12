import { Module } from '@nestjs/common';
import { AdvisorsController } from './advisors.controller';

@Module({
  controllers: [AdvisorsController],
})
export class AdvisorsModule {}
