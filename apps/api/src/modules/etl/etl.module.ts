import { Module } from '@nestjs/common';
import { EtlController } from './etl.controller';

@Module({
  controllers: [EtlController],
})
export class EtlModule {}
