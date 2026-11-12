import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsEmail, IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateBuyerFormDto {
  @ApiProperty({ example: 'Ana Lucía' })
  @IsString()
  @IsNotEmpty()
  nombres: string;

  @ApiProperty({ example: 'Pérez Mendoza' })
  @IsString()
  @IsNotEmpty()
  apellidos: string;

  @ApiProperty({ example: '51949123456' })
  @IsString()
  @IsNotEmpty()
  whatsapp: string;

  @ApiProperty({ example: 'ana.perez@unt.edu.pe' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Universidad Nacional de Trujillo' })
  @IsString()
  @IsNotEmpty()
  universidad: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  universidadId?: string;

  @ApiProperty({ example: 'Ingeniería de Sistemas' })
  @IsString()
  @IsNotEmpty()
  carrera: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  carreraId?: string;

  @ApiProperty({ example: '10mo ciclo' })
  @IsString()
  @IsNotEmpty()
  ciclo: string;

  @ApiProperty({ example: 'TESIS' })
  @IsString()
  @IsNotEmpty()
  tipoInvestigacion: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  consentimientoWhatsapp: boolean;

  // Campos opcionales
  @ApiPropertyOptional({ example: 'Trujillo' })
  @IsOptional()
  @IsString()
  ubicacion?: string;

  @ApiPropertyOptional({ example: 'TRABAJA_TIEMPO_COMPLETO' })
  @IsOptional()
  @IsString()
  situacionLaboral?: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsNumber()
  plazoDefinidoDias?: number;

  @ApiPropertyOptional({ example: 2000 })
  @IsOptional()
  @IsNumber()
  presupuestoAprox?: number;

  @ApiPropertyOptional({ example: 'Falta de tiempo y asesor no responde' })
  @IsOptional()
  @IsString()
  dolorPrincipal?: string;

  @ApiPropertyOptional({ example: 'PYTHON' })
  @IsOptional()
  @IsString()
  softwareRequerido?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  descargoLeadMagnet?: boolean;

  @ApiPropertyOptional({ example: 'META_ADS' })
  @IsOptional()
  @IsString()
  canalCodigo?: string;
}
