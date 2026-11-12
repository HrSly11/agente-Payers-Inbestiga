import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✓ Conexión establecida exitosamente con Microsoft SQL Server (inbestiga_db).');

      // Migrar contenido a NVARCHAR(MAX) para soporte íntegro de caracteres Unicode/tildes
      await this.$executeRawUnsafe(`
        IF EXISTS (
          SELECT 1 FROM INBESTIGA_TESIS.INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = 'MENSAJE' AND COLUMN_NAME = 'contenido' AND DATA_TYPE = 'varchar'
        )
        BEGIN
          ALTER TABLE INBESTIGA_TESIS.dbo.MENSAJE ALTER COLUMN contenido NVARCHAR(MAX) NOT NULL;
        END;
        UPDATE INBESTIGA_TESIS.dbo.MENSAJE
        SET contenido = REPLACE(REPLACE(REPLACE(contenido, '? **Modalidad', '• **Modalidad'), '?? **Nuevo enlace', '• **Nuevo enlace'), '? **Lo que acabo', '• **Lo que acabo')
        WHERE contenido LIKE '%? **%';
      `);
    } catch (error) {
      this.logger.error('Error conectando con Microsoft SQL Server:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Desconexión de Prisma con SQL Server completada.');
  }
}
