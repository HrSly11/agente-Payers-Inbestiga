import { Injectable, Logger, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ReglaNegocioDto {
  codigo: string;
  nombre: string;
  modulo: string;
  tipo_dato: 'NUMBER' | 'PERCENT' | 'BOOLEAN' | 'STRING' | 'JSON';
  valor: string;
  descripcion?: string;
  activo?: boolean;
}

@Injectable()
export class BusinessRulesService implements OnModuleInit {
  private readonly logger = new Logger(BusinessRulesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.asegurarTablaYSeeds();
  }

  private async asegurarTablaYSeeds() {
    try {
      await this.prisma.$executeRawUnsafe(`
        IF OBJECT_ID('INBESTIGA_TESIS.dbo.REGLA_NEGOCIO', 'U') IS NULL
        BEGIN
          CREATE TABLE INBESTIGA_TESIS.dbo.REGLA_NEGOCIO (
            id INT IDENTITY(1,1) PRIMARY KEY,
            codigo NVARCHAR(60) NOT NULL UNIQUE,
            nombre NVARCHAR(150) NOT NULL,
            modulo NVARCHAR(50) NOT NULL,
            tipo_dato NVARCHAR(20) NOT NULL,
            valor NVARCHAR(255) NOT NULL,
            descripcion NVARCHAR(500) NULL,
            activo BIT NOT NULL DEFAULT 1,
            fecha_creacion DATETIME2 NOT NULL DEFAULT GETDATE(),
            fecha_actualizacion DATETIME2 NOT NULL DEFAULT GETDATE()
          );
        END;
      `);

      const count: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as total FROM INBESTIGA_TESIS.dbo.REGLA_NEGOCIO;
      `);

      if (Number(count[0]?.total || 0) === 0) {
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO INBESTIGA_TESIS.dbo.REGLA_NEGOCIO 
            (codigo, nombre, modulo, tipo_dato, valor, descripcion, activo)
          VALUES
            ('RN_01_PROMPT_INJECTION', N'Guardrail Anti-Prompt Injection', 'SEGURIDAD', 'BOOLEAN', 'true', N'Bloquea instrucciones maliciosas en chat que intenten modificar precios, cuotas o estados de pago arbitrariamente.', 1),
            ('RN_02_MAX_DESCUENTO_PCT', N'Descuento Comercial Máximo (%)', 'FINANCIERO', 'PERCENT', '15.0', N'Porcentaje límite que la IA o asesor comercial pueden conceder en el cierre de venta.', 1),
            ('RN_03_MAX_CUOTAS_INICIAL', N'Máximo Cuotas en Acuerdo Inicial', 'FINANCIERO', 'NUMBER', '3', N'Tope institucional de cuotas fraccionadas acordadas en LEADS (30% / 40% / 30%).', 1),
            ('RN_03_MAX_CUOTAS_REESTRUCTURACION', N'Máximo Cuotas en Reestructuración', 'FINANCIERO', 'NUMBER', '6', N'Tope de cuotas permitido cuando un estudiante solicita facilidades de pago adicionales.', 1),
            ('RN_04_SLA_ASIGNACION_ASESOR_HRS', N'SLA de Asignación de Asesor (Horas)', 'ACADEMICO', 'NUMBER', '24', N'Plazo máximo institucional para asignar asesor metodológico balanceando carga tras primer pago.', 1),
            ('RN_05_TOPE_YAPE_PLIN_PEN', N'Tope Máximo Yape / Plin (S/)', 'PASARELA', 'NUMBER', '500.00', N'Monto máximo en Soles por transacción en billeteras móviles antes de forzar tarjeta o pasarela bancaria.', 1),
            ('RN_06_VERIFICACION_VOUCHER_CAJA', N'Validación Obligatoria de Voucher por Caja', 'FINANCIERO', 'BOOLEAN', 'true', N'Exige revisión manual del voucher en tesorería antes de acreditar cuota pagada.', 1),
            ('RN_07_UMBRAL_TURNITIN_MAX_PCT', N'Umbral Máximo de Similitud Turnitin (%)', 'ACADEMICO', 'PERCENT', '15.0', N'Porcentaje máximo de similitud admitido por SUNEDU y UNT para aprobar informe final de tesis.', 1),
            ('RN_08_ALERTA_RECORDATORIO_HRS', N'Frecuencia de Recordatorio de Cuota (Horas)', 'COBRANZA', 'NUMBER', '4', N'Tiempo en horas tras emisión del enlace antes de disparar el primer aviso automático de pago.', 1),
            ('RN_09_EXPIRACION_LINK_PAGO_HRS', N'Vigencia de Enlaces de Pago (Horas)', 'PASARELA', 'NUMBER', '72', N'Tiempo de caducidad de las preferencias y links generados en Mercado Pago y Culqi.', 1),
            ('RN_10_BLOQUEO_SUSTENTACION', N'Candado Financiero para Sustentación', 'ACADEMICO', 'BOOLEAN', 'true', N'Bloquea el dictamen de expedito para sustentación de tesis si el alumno mantiene saldo pendiente.', 1);
        `);
        this.logger.log('✓ Tabla REGLA_NEGOCIO inicializada y poblada con 11 reglas maestras en SQL Server.');
      }

      // Alinear el prompt de CONFIGURACION_AGENTE exclusivamente al dominio PAYERS v2.0
      await this.prisma.$executeRawUnsafe(`
        UPDATE [dbo].[CONFIGURACION_AGENTE]
        SET 
          promptSistema = N'Eres el Agente Especialista de Cobranza y Activación Académica (PAYERS v2.0) de INBESTIGA.TESIS. Tu misión es gestionar el cobro de órdenes provenientes de HANDOFF_LEADS, facilitar enlaces oficiales de Mercado Pago Checkout Pro, estructurar cuotas sobre el saldo comprometido y activar el servicio académico tras el primer pago verificado.\nREGLAS ESTRICTAS DE PAYERS:\n1. RN-01 (Cero Alucinación): Jamás des por confirmado un pago por dichos del chat; verifica determinísticamente en PAGO y EVENTO_WEBHOOK.\n2. RN-02 (Precio Congelado): Prohibido negociar precios o descuentos en PAYERS. Si el estudiante solicita rebaja sobre el monto comprometido, escala y devuelve el caso a LEADS.\n3. RN-03 (Cuotas): Permite fraccionar en 3 cuotas (30/40/30) o reestructurar saldos pendientes hasta en 6 cuotas sin alterar el precio final.\n4. RN-04 (Activación): Al acreditarse la Cuota 1, activa automáticamente PAYER + CUSTOMER y asigna asesor especialista por balanceo de carga.\n5. RN-05 (Medios de Pago): Emite enlaces oficiales de Mercado Pago Checkout Pro; para montos mayores a S/ 500 indica pasarela con tarjeta.',
          tono = N'Profesional, empático, financiero-académico y determinístico',
          estilo = N'Especialista de Cobranza y Activación PAYERS v2.0',
          permitirNegociacion = 0,
          maxDescuentoNegociablePct = 0.00,
          maxCuotasNegociables = 6
        WHERE activo = 1;
      `);
    } catch (err: any) {
      this.logger.error(`Error asegurando tabla REGLA_NEGOCIO: ${err.message}`);
    }
  }

  async findAll() {
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT 
          id, codigo, nombre, modulo, tipo_dato, valor, descripcion, activo, 
          fecha_creacion, fecha_actualizacion
        FROM INBESTIGA_TESIS.dbo.REGLA_NEGOCIO
        ORDER BY modulo ASC, codigo ASC;
      `);
      return rows.map((r) => ({
        ...r,
        activo: Boolean(r.activo),
      }));
    } catch (err: any) {
      this.logger.error(`Error en findAll business-rules: ${err.message}`);
      // Fallback a array vacio si hay reconnect
      return [];
    }
  }

  async findByCodigo(codigo: string) {
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT TOP 1 * FROM INBESTIGA_TESIS.dbo.REGLA_NEGOCIO WHERE codigo = '${codigo.replace(/'/g, "''")}';
    `);
    if (!rows.length) return null;
    return {
      ...rows[0],
      activo: Boolean(rows[0].activo),
    };
  }

  async getValor(codigo: string, defaultVal: any = null): Promise<any> {
    const regla = await this.findByCodigo(codigo);
    if (!regla || !regla.activo) return defaultVal;
    if (regla.tipo_dato === 'NUMBER' || regla.tipo_dato === 'PERCENT') {
      return Number(regla.valor);
    }
    if (regla.tipo_dato === 'BOOLEAN') {
      return regla.valor === 'true' || regla.valor === '1';
    }
    return regla.valor;
  }

  async create(dto: ReglaNegocioDto) {
    if (!dto.codigo || !dto.nombre || !dto.valor) {
      throw new BadRequestException('Código, nombre y valor son obligatorios.');
    }
    const cleanCodigo = dto.codigo.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const existing = await this.findByCodigo(cleanCodigo);
    if (existing) {
      throw new BadRequestException(`La regla con código ${cleanCodigo} ya existe.`);
    }

    const cleanNombre = dto.nombre.replace(/'/g, "''");
    const cleanModulo = (dto.modulo || 'GENERAL').toUpperCase().replace(/'/g, "''");
    const cleanTipo = (dto.tipo_dato || 'STRING').toUpperCase();
    const cleanValor = String(dto.valor).replace(/'/g, "''");
    const cleanDesc = (dto.descripcion || '').replace(/'/g, "''");
    const activoVal = dto.activo !== false ? 1 : 0;

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO INBESTIGA_TESIS.dbo.REGLA_NEGOCIO
        (codigo, nombre, modulo, tipo_dato, valor, descripcion, activo, fecha_creacion, fecha_actualizacion)
      VALUES
        ('${cleanCodigo}', N'${cleanNombre}', '${cleanModulo}', '${cleanTipo}', N'${cleanValor}', N'${cleanDesc}', ${activoVal}, GETDATE(), GETDATE());
    `);

    return this.findByCodigo(cleanCodigo);
  }

  async update(codigo: string, dto: Partial<ReglaNegocioDto>) {
    const cleanCodigo = codigo.replace(/'/g, "''");
    const existing = await this.findByCodigo(cleanCodigo);
    if (!existing) {
      throw new NotFoundException(`Regla de negocio ${codigo} no encontrada.`);
    }

    const cleanNombre = (dto.nombre ?? existing.nombre).replace(/'/g, "''");
    const cleanModulo = (dto.modulo ?? existing.modulo).toUpperCase().replace(/'/g, "''");
    const cleanTipo = (dto.tipo_dato ?? existing.tipo_dato).toUpperCase();
    const cleanValor = String(dto.valor ?? existing.valor).replace(/'/g, "''");
    const cleanDesc = (dto.descripcion ?? existing.descripcion ?? '').replace(/'/g, "''");
    const activoVal = (dto.activo !== undefined ? dto.activo : existing.activo) ? 1 : 0;

    await this.prisma.$executeRawUnsafe(`
      UPDATE INBESTIGA_TESIS.dbo.REGLA_NEGOCIO
      SET 
        nombre = N'${cleanNombre}',
        modulo = '${cleanModulo}',
        tipo_dato = '${cleanTipo}',
        valor = N'${cleanValor}',
        descripcion = N'${cleanDesc}',
        activo = ${activoVal},
        fecha_actualizacion = GETDATE()
      WHERE codigo = '${cleanCodigo}';
    `);

    return this.findByCodigo(cleanCodigo);
  }

  async delete(codigo: string) {
    const cleanCodigo = codigo.replace(/'/g, "''");
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM INBESTIGA_TESIS.dbo.REGLA_NEGOCIO WHERE codigo = '${cleanCodigo}';
    `);
    return { success: true, mensaje: `Regla ${codigo} eliminada correctamente de SQL Server.` };
  }
}
