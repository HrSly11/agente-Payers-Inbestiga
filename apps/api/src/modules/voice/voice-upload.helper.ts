import { BadRequestException } from '@nestjs/common';

export interface UploadedAudioFile {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
}

export const VOICE_UPLOAD_LIMITS = { limits: { fileSize: 15 * 1024 * 1024 } };

/** Valida los campos multipart recibidos para los endpoints de notas de voz de PAYERS. */
export function validarUploadVoz(
  ordenPagoIdRaw: unknown,
  file: UploadedAudioFile | undefined,
): { ordenPagoId: number; buffer: Buffer; filename: string; mimeType?: string } {
  const ordenPagoId = Number(ordenPagoIdRaw);
  if (!Number.isInteger(ordenPagoId) || ordenPagoId <= 0) {
    throw new BadRequestException('ordenPagoId inválido.');
  }
  if (!file?.buffer?.length) {
    throw new BadRequestException('No se recibió archivo de audio.');
  }
  return {
    ordenPagoId,
    buffer: file.buffer,
    filename: file.originalname || 'audio.webm',
    mimeType: file.mimetype,
  };
}
