import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PayersController } from './payers.controller';
import { PayersService } from './payers.service';
import { CuotasHitoService } from './cuotas-hito.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PayersController],
  providers: [PayersService, CuotasHitoService],
  exports: [PayersService, CuotasHitoService],
})
export class PayersModule {}
