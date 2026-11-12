import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DwService } from './dw.service';

@Global()
@Module({
  providers: [PrismaService, DwService],
  exports: [PrismaService, DwService],
})
export class DatabaseModule {}
