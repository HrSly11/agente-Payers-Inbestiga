import { Injectable, Logger } from '@nestjs/common';
import { LEAD_SCORE_THRESHOLD, SCORING_CRITERIA_WEIGHTS } from '@inbestiga/shared';

export interface ScoringInput {
  universidadId?: string | null;
  carreraId?: string | null;
  ciclo?: string | null;
  tipoInvestigacion?: string | null;
  plazoDefinidoDias?: number | null;
  situacionLaboral?: string | null;
  presupuestoAprox?: number | null;
  dolorPrincipal?: string | null;
  softwareRequerido?: string | null;
  consentimientoWhatsapp?: boolean;
  descargoLeadMagnet?: boolean;
  totalInteracciones7Dias?: number;
}

export interface ScoringResult {
  score: number;
  esLead: boolean;
  desglose: {
    perfilAcademico: number;
    tipoInvestigacion: number;
    plazoDefinido: number;
    situacionPresupuesto: number;
    dolorSoftware: number;
    consentimientoWhatsapp: number;
    leadMagnetInteraccion: number;
  };
  criterioCalificacion: string;
  explicacion: string[];
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  calcularScore(input: ScoringInput): ScoringResult {
    let score = 0;
    const explicacion: string[] = [];
    const desglose = {
      perfilAcademico: 0,
      tipoInvestigacion: 0,
      plazoDefinido: 0,
      situacionPresupuesto: 0,
      dolorSoftware: 0,
      consentimientoWhatsapp: 0,
      leadMagnetInteraccion: 0,
    };

    // 1. Perfil Académico Completo (+20)
    if (input.universidadId && input.carreraId && input.ciclo) {
      desglose.perfilAcademico = SCORING_CRITERIA_WEIGHTS.PERFIL_ACADEMICO_COMPLETO;
      score += desglose.perfilAcademico;
      explicacion.push('+20 Perfil académico completo (Universidad, Carrera y Ciclo)');
    } else if (input.universidadId || input.carreraId) {
      desglose.perfilAcademico = 10;
      score += desglose.perfilAcademico;
      explicacion.push('+10 Perfil académico parcial');
    }

    // 2. Tipo de Investigación Definido (+15)
    if (input.tipoInvestigacion && input.tipoInvestigacion.trim().length > 0) {
      desglose.tipoInvestigacion = SCORING_CRITERIA_WEIGHTS.TIPO_INVESTIGACION_DEFINIDO;
      score += desglose.tipoInvestigacion;
      explicacion.push(`+15 Tipo de investigación definido (${input.tipoInvestigacion})`);
    }

    // 3. Plazo / Urgencia Definida (+15)
    if (input.plazoDefinidoDias && input.plazoDefinidoDias > 0) {
      desglose.plazoDefinido = SCORING_CRITERIA_WEIGHTS.PLAZO_DEFINIDO;
      score += SCORING_CRITERIA_WEIGHTS.PLAZO_DEFINIDO;
      explicacion.push(`+15 Plazo establecido (${input.plazoDefinidoDias} días)`);
    }

    // 4. Situación Laboral y Presupuesto (+10)
    if (input.situacionLaboral || (input.presupuestoAprox && input.presupuestoAprox > 0)) {
      desglose.situacionPresupuesto = SCORING_CRITERIA_WEIGHTS.SITUACION_LABORAL_PRESUPUESTO;
      score += desglose.situacionPresupuesto;
      explicacion.push('+10 Situación laboral / presupuesto aproximado indicado');
    }

    // 5. Dolor Principal o Software Específico (+10)
    if (input.dolorPrincipal || input.softwareRequerido) {
      desglose.dolorSoftware = SCORING_CRITERIA_WEIGHTS.DOLOR_SOFTWARE_ESPECIFICO;
      score += desglose.dolorSoftware;
      explicacion.push('+10 Dolor principal o software identificado');
    }

    // 6. Consentimiento WhatsApp (+15)
    if (input.consentimientoWhatsapp) {
      desglose.consentimientoWhatsapp = SCORING_CRITERIA_WEIGHTS.CONSENTIMIENTO_WHATSAPP;
      score += desglose.consentimientoWhatsapp;
      explicacion.push('+15 Consentimiento expreso para contacto por WhatsApp');
    }

    // 7. Lead Magnet o Interacciones Recientes (+15)
    if (input.descargoLeadMagnet) {
      desglose.leadMagnetInteraccion = SCORING_CRITERIA_WEIGHTS.INTERACCION_LEAD_MAGNET;
      score += desglose.leadMagnetInteraccion;
      explicacion.push('+15 Lead magnet (Guía metodológica) descargado');
    }

    // Normalización: Asegurar que el score no exceda 100 ni sea negativo
    score = Math.min(100, Math.max(0, score));

    // Regla de Calificación a LEAD:
    // Regla principal: Score >= 70
    // Regla alternativa: 1 lead magnet + 2 o más interacciones adicionales en 7 días
    const reglaAlternativaCumplida = Boolean(
      input.descargoLeadMagnet && (input.totalInteracciones7Dias || 0) >= 2,
    );

    const esLead = score >= LEAD_SCORE_THRESHOLD || reglaAlternativaCumplida;

    if (reglaAlternativaCumplida && score < LEAD_SCORE_THRESHOLD) {
      explicacion.push('✓ Calificado como LEAD por regla de interacción activa (1 lead magnet + 2 interacciones en 7 días)');
    } else if (esLead) {
      explicacion.push(`✓ Calificado como LEAD al superar el umbral configurado (${score} >= ${LEAD_SCORE_THRESHOLD})`);
    }

    return {
      score,
      esLead,
      desglose,
      criterioCalificacion: JSON.stringify(desglose),
      explicacion,
    };
  }
}
