'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Lock,
  Unlock,
  Sparkles,
  UserCheck,
  CreditCard,
  ArrowRight,
  BookOpen,
  FileCheck2,
  ShieldCheck,
} from 'lucide-react';

/* ============================================================================
   FEATURE 2: ASISTENTE ACADÉMICO REACTIVO (TESIS / BIRRETE / PLUMA VIVA)
   ============================================================================ */

export interface AcademicReactiveAssistantProps {
  isThinking: boolean;
  celebrateTrigger?: number;
  hasConfirmedPayment?: boolean;
  studentName?: string;
  compact?: boolean;
}

export function AcademicReactiveAssistant({
  isThinking,
  celebrateTrigger = 0,
  hasConfirmedPayment = false,
  studentName = 'Tesista',
  compact = false,
}: AcademicReactiveAssistantProps) {
  const prefersReducedMotion = useReducedMotion();
  const [celebrating, setCelebrating] = useState(false);

  // Cursor 3D Parallax & Tilt
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 180, damping: 18 });
  const springY = useSpring(mouseY, { stiffness: 180, damping: 18 });

  const rotateX = useTransform(springY, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-12, 12]);
  const translateX = useTransform(springX, [-0.5, 0.5], [-5, 5]);
  const translateY = useTransform(springY, [-0.5, 0.5], [-4, 4]);

  useEffect(() => {
    if (celebrateTrigger > 0) {
      setCelebrating(true);
      const timer = setTimeout(() => setCelebrating(false), 3200);
      return () => clearTimeout(timer);
    }
  }, [celebrateTrigger]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(nx);
    mouseY.set(ny);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleManualCelebrate = () => {
    setCelebrating(true);
    setTimeout(() => setCelebrating(false), 2600);
  };

  const sparkles = [
    { id: 1, dx: -34, dy: -28, color: '#fbbf24', delay: 0 },
    { id: 2, dx: 36, dy: -26, color: '#10b981', delay: 0.06 },
    { id: 3, dx: -40, dy: 6, color: '#38bdf8', delay: 0.1 },
    { id: 4, dx: 42, dy: 8, color: '#f59e0b', delay: 0.14 },
    { id: 5, dx: -18, dy: -42, color: '#34d399', delay: 0.08 },
    { id: 6, dx: 20, dy: -40, color: '#fde047', delay: 0.12 },
  ];

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleManualCelebrate}
      title="Asistente Académico Reactivo · Haz clic o mueve el cursor para interactuar"
      style={
        prefersReducedMotion
          ? undefined
          : {
              rotateX,
              rotateY,
              x: translateX,
              y: translateY,
              transformPerspective: 600,
            }
      }
      className={`relative select-none cursor-pointer group flex items-center gap-3 rounded-2xl border transition-colors ${
        compact ? 'px-2.5 py-1.5' : 'px-3.5 py-2'
      } ${
        isThinking
          ? 'border-sky-500/50 bg-sky-500/10 dark:bg-sky-950/40 shadow-md shadow-sky-500/10'
          : celebrating
            ? 'border-amber-400/60 bg-amber-500/10 dark:bg-amber-950/35 shadow-md shadow-amber-500/15'
            : 'border-emerald-500/35 bg-emerald-500/5 dark:bg-slate-900/80 hover:border-emerald-500/60'
      }`}
    >
      {/* Escena SVG Interactiva: Manuscrito de Tesis + Birrete + Pluma / Lupa */}
      <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
        {/* Aura Académica Giratoria */}
        <div
          className={`absolute inset-0 rounded-full border border-dashed transition-colors ${
            isThinking
              ? 'border-sky-400/70 animate-spin-slow'
              : celebrating
                ? 'border-amber-400/80 animate-spin-slow'
                : 'border-emerald-500/30 group-hover:border-emerald-400/60'
          }`}
        />

        {/* Partículas de Celebración (Birrete Toss & Destellos Dorados) */}
        <AnimatePresence>
          {celebrating &&
            !prefersReducedMotion &&
            sparkles.map((sp) => (
              <motion.span
                key={sp.id}
                initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  scale: [0.3, 1.25, 1, 0.2],
                  x: sp.dx,
                  y: sp.dy,
                }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 1.15, delay: sp.delay, ease: 'easeOut' }}
                style={{ backgroundColor: sp.color }}
                className="pointer-events-none absolute w-2 h-2 rounded-full shadow-sm z-20"
              />
            ))}
        </AnimatePresence>

        <svg
          viewBox="0 0 64 64"
          className="w-11 h-11 overflow-visible drop-shadow-xs"
          aria-label="Ilustración interactiva de Tesis y Birrete Académico"
        >
          <defs>
            <linearGradient id="thesisBookGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>

          {/* Sombra base del libro */}
          <ellipse cx="32" cy="54" rx="18" ry="3.5" className="fill-slate-900/15 dark:fill-black/40" />

          {/* Cubierta del Manuscrito de Tesis */}
          <path
            d="M12 30 C12 27, 29 28, 32 31 C35 28, 52 27, 52 30 L52 48 C52 46, 35 46, 32 49 C29 46, 12 46, 12 48 Z"
            fill="url(#thesisBookGrad)"
          />

          {/* Páginas izquierdas y derechas */}
          <path
            d="M14 28 C18 26, 28 27, 32 30 L32 47 C28 44, 18 44, 14 46 Z"
            className="fill-white dark:fill-slate-100"
          />
          <path
            d="M50 28 C46 26, 36 27, 32 30 L32 47 C36 44, 46 44, 50 46 Z"
            className="fill-slate-50 dark:fill-slate-200"
          />

          {/* Cinta separadora dorada */}
          <path d="M31 30 L33 30 L33 52 L32 50 L31 52 Z" fill="url(#goldGrad)" />

          {/* Líneas de texto en el manuscrito (animadas cuando isThinking = true) */}
          <motion.line
            x1="17"
            y1="33"
            x2="28"
            y2="33"
            stroke="#0f172a"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeOpacity="0.45"
            animate={
              isThinking && !prefersReducedMotion
                ? { x2: [20, 28, 22, 28], opacity: [0.4, 0.9, 0.4] }
                : { x2: 28, opacity: 0.45 }
            }
            transition={{ duration: 1.2, repeat: isThinking ? Infinity : 0 }}
          />
          <motion.line
            x1="17"
            y1="37"
            x2="27"
            y2="37"
            stroke="#0f172a"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeOpacity="0.35"
          />
          <motion.line
            x1="36"
            y1="33"
            x2="46"
            y2="33"
            stroke="#059669"
            strokeWidth="1.6"
            strokeLinecap="round"
            animate={
              isThinking && !prefersReducedMotion
                ? { x2: [38, 47, 40, 46], stroke: ['#059669', '#0284c7', '#059669'] }
                : { x2: 46 }
            }
            transition={{ duration: 1.0, repeat: isThinking ? Infinity : 0 }}
          />
          <motion.line
            x1="36"
            y1="37"
            x2="45"
            y2="37"
            stroke="#0284c7"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeOpacity="0.6"
          />

          {/* Página pasando en vivo cuando el Agente IA está investigando */}
          <AnimatePresence>
            {isThinking && !prefersReducedMotion && (
              <motion.path
                d="M32 30 C36 26, 45 26, 49 28 L49 44 C45 42, 36 42, 32 46 Z"
                className="fill-sky-100/90 dark:fill-sky-200/80 stroke-sky-400/50"
                strokeWidth="0.8"
                initial={{ scaleX: 1, opacity: 0.9 }}
                animate={{ scaleX: [-1, 1], opacity: [0.95, 0.4, 0.95] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.95, repeat: Infinity, ease: 'easeInOut' }}
                style={{ originX: '32px', originY: '38px' }}
              />
            )}
          </AnimatePresence>

          {/* Birrete Académico (Salta y gira cuando hay celebración de Pago o Hito) */}
          <motion.g
            animate={
              celebrating && !prefersReducedMotion
                ? {
                    y: [0, -14, -4, 0],
                    rotate: [0, -14, 360, 0],
                    scale: [1, 1.16, 1],
                  }
                : isThinking && !prefersReducedMotion
                  ? { y: [0, -2.5, 0], rotate: [0, 3, -3, 0] }
                  : { y: 0, rotate: 0, scale: 1 }
            }
            transition={{
              duration: celebrating ? 1.1 : 2.2,
              repeat: isThinking && !celebrating ? Infinity : 0,
              ease: 'easeInOut',
            }}
            style={{ originX: '32px', originY: '16px' }}
          >
            {/* Rombo superior del birrete */}
            <polygon
              points="32,7 50,15 32,23 14,15"
              className="fill-slate-900 dark:fill-slate-800 stroke-emerald-400/80"
              strokeWidth="1.3"
            />
            {/* Casquete del birrete */}
            <path
              d="M23 19 L23 25 C23 27.5, 41 27.5, 41 25 L41 19"
              className="fill-slate-800 dark:fill-slate-700"
            />
            {/* Botón central y borla dorada */}
            <circle cx="32" cy="15" r="2" fill="url(#goldGrad)" />
            <path
              d="M32 15 Q42 17 45 25"
              fill="none"
              stroke="url(#goldGrad)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="45" cy="26" r="2.2" fill="url(#goldGrad)" />
          </motion.g>

          {/* Pluma Estilográfica / Lupa Investigadora (activa al escribir o auditar) */}
          <motion.g
            animate={
              isThinking && !prefersReducedMotion
                ? {
                    x: [0, 7, -4, 5, 0],
                    y: [0, -3, 2, -2, 0],
                    rotate: [0, -12, 8, -8, 0],
                  }
                : { x: 0, y: 0, rotate: 0 }
            }
            transition={{
              duration: 1.35,
              repeat: isThinking ? Infinity : 0,
              ease: 'easeInOut',
            }}
          >
            {/* Cuerpo de la pluma estilográfica dorada/esmeralda */}
            <path
              d="M44 36 L54 22 L58 25 L47 39 Z"
              fill="url(#thesisBookGrad)"
              stroke="#ffffff"
              strokeWidth="0.7"
            />
            {/* Punta de oro de la pluma */}
            <polygon points="44,36 47,39 41,42" fill="url(#goldGrad)" />
          </motion.g>
        </svg>
      </div>

      {/* Etiqueta de estado vivo del Asistente Académico */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            {isThinking
              ? 'Investigando & Redactando'
              : celebrating
                ? '¡Hito / Pago Acreditado!'
                : 'Co-Piloto de Tesis IA'}
          </span>
          <Sparkles
            className={`w-3 h-3 shrink-0 ${
              celebrating
                ? 'text-amber-500 animate-bounce'
                : isThinking
                  ? 'text-sky-500 animate-spin'
                  : 'text-emerald-500'
            }`}
          />
        </div>
        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">
          {isThinking
            ? 'Consultando SQL Server + 11 Tools...'
            : celebrating
              ? `¡Avance desbloqueado para ${studentName}!`
              : hasConfirmedPayment
                ? 'Expediente activo · Hitos sincronizados'
                : 'Esperando validación de cuota / hito'}
        </p>
      </div>
    </motion.div>
  );
}

/* ============================================================================
   FEATURE 1: RUTA INTERACTIVA DE TESIS ("CAMINO A LA SUSTENTACIÓN")
   ============================================================================ */

export interface ThesisMilestoneStage {
  id: number;
  shortTitle: string;
  fullTitle: string;
  deliverable: string;
  chapterTag: string;
  linkedCuotaNum: number;
  linkedCuota: any | null;
  status: 'COMPLETADO' | 'EN_CURSO' | 'BLOQUEADO_HITO';
}

export interface ThesisJourneyTrackProps {
  cuotas: any[];
  ordenDetalle: any;
  actionBusy?: string | null;
  onToggleHito?: (numeroCuota: number, estadoActual: string) => Promise<void> | void;
  activeCuotaHighlight?: number | null;
  onSelectCuotaHighlight?: (numeroCuota: number | null) => void;
  isSectionFocused?: boolean;
  onTriggerCelebration?: () => void;
  externalStageId?: number | null;
  onStageChange?: (stageId: number) => void;
}

const THESIS_CHAPTERS_BASE = [
  {
    id: 1,
    shortTitle: '1. Tema y Plan',
    fullTitle: 'Capítulo I · Elección del Tema y Plan de Tesis',
    deliverable:
      'Matriz de consistencia preliminar, planteamiento del problema, objetivos e inscripción del plan.',
    chapterTag: 'Hito Inicial · Arranque',
  },
  {
    id: 2,
    shortTitle: '2. Matriz / Marco Teórico',
    fullTitle: 'Capítulo II · Marco Teórico y Operacionalización',
    deliverable:
      'Antecedentes internacionales/nacionales, bases teóricas especializadas y matriz de variables.',
    chapterTag: 'Avance Cap. I–II',
  },
  {
    id: 3,
    shortTitle: '3. Metodología / Estadística',
    fullTitle: 'Capítulo III · Diseño Metodológico y Procesamiento SPSS/R',
    deliverable:
      'Validación de instrumentos por juicio de expertos, trabajo de campo y prueba de hipótesis.',
    chapterTag: 'Hito Intermedio · Cap. III–IV',
  },
  {
    id: 4,
    shortTitle: '4. Borrador y Turnitin',
    fullTitle: 'Capítulo IV · Informe Final y Auditoría Antiplagio Turnitin',
    deliverable:
      'Tesis completa redactada, porcentaje de similitud Turnitin < 15% y levantamiento de observaciones.',
    chapterTag: 'Pre-Sustentación · Turnitin',
  },
  {
    id: 5,
    shortTitle: '5. Sustentación',
    fullTitle: 'Capítulo V · Defensa Oral y Aprobación de Jurado',
    deliverable:
      'Diapositivas ejecutivas de alto impacto, simulacro con asesor especialista y cierre académico.',
    chapterTag: 'Cierre Exitoso · Grado',
  },
];

export function buildThesisStages(cuotas: any[]): ThesisMilestoneStage[] {
  const sortedCuotas = [...cuotas].sort(
    (a, b) => Number(a.numero_cuota) - Number(b.numero_cuota),
  );
  const totalC = sortedCuotas.length;

  return THESIS_CHAPTERS_BASE.map((chap, idx) => {
    let targetCuota: any = null;
    if (totalC === 1) {
      targetCuota = sortedCuotas[0];
    } else if (totalC === 2) {
      targetCuota = idx < 2 ? sortedCuotas[0] : sortedCuotas[1];
    } else if (totalC === 3) {
      if (idx === 0) targetCuota = sortedCuotas[0];
      else if (idx === 1) {
        // Etapa 2 comparte progreso entre Cuota 1 pagada y Cuota 2
        targetCuota =
          sortedCuotas[0]?.estado === 'PAGADA'
            ? sortedCuotas[1] || sortedCuotas[0]
            : sortedCuotas[0];
      } else if (idx === 2) targetCuota = sortedCuotas[1];
      else targetCuota = sortedCuotas[2];
    } else if (totalC > 3) {
      const mappedIndex = Math.min(
        totalC - 1,
        Math.floor((idx / 5) * totalC),
      );
      targetCuota = sortedCuotas[mappedIndex];
    }

    const cuotaNum = Number(targetCuota?.numero_cuota || Math.min(3, Math.ceil((idx + 1) / 2)));
    const rawEstado = String(targetCuota?.estado || 'ESPERA_HITO');

    let status: 'COMPLETADO' | 'EN_CURSO' | 'BLOQUEADO_HITO' = 'BLOQUEADO_HITO';
    if (rawEstado === 'PAGADA') {
      status = 'COMPLETADO';
    } else if (idx === 1 && sortedCuotas[0]?.estado === 'PAGADA' && totalC >= 3) {
      // Si la Cuota #1 ya fue pagada, el Capítulo 1 y el arranque del Marco Teórico están habilitados/avanzados
      status = rawEstado === 'ESPERA_HITO' ? 'EN_CURSO' : 'EN_CURSO';
    } else if (
      ['EXIGIBLE', 'ENLACE_ENVIADO', 'POR_VERIFICAR', 'VENCIDA'].includes(rawEstado)
    ) {
      status = 'EN_CURSO';
    } else {
      status = 'BLOQUEADO_HITO';
    }

    return {
      ...chap,
      linkedCuotaNum: cuotaNum,
      linkedCuota: targetCuota,
      status,
    };
  });
}

export function ThesisJourneyTrack({
  cuotas = [],
  ordenDetalle,
  actionBusy = null,
  onToggleHito,
  activeCuotaHighlight = null,
  onSelectCuotaHighlight,
  isSectionFocused = false,
  onTriggerCelebration,
  externalStageId = null,
  onStageChange,
}: ThesisJourneyTrackProps) {
  const prefersReducedMotion = useReducedMotion();
  const [selectedStageId, setSelectedStageId] = useState<number>(1);

  // Sincroniza el capítulo cuando la escena 3D (u otro componente) lo selecciona
  useEffect(() => {
    if (externalStageId != null) setSelectedStageId(externalStageId);
  }, [externalStageId]);

  useEffect(() => {
    onStageChange?.(selectedStageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStageId]);
  const [energyPulseKey, setEnergyPulseKey] = useState<number>(0);

  const orden = ordenDetalle?.orden;
  const vistaAnalitica = ordenDetalle?.vistaAnalitica;
  const asesorNombre =
    orden?.asesor_nombre || 'Dr. Carlos Alberto Méndez Vargas';
  const nombreEstudiante =
    orden?.estudiante_nombre || vistaAnalitica?.estudiante || 'Tesista';
  const codigoOrden =
    orden?.codigo_orden || vistaAnalitica?.codigo_orden || 'ORD-2026-0042';

  // Mapeo determinístico de los 5 capítulos de tesis con las cuotas reales de la orden
  const stages: ThesisMilestoneStage[] = useMemo(() => buildThesisStages(cuotas), [cuotas]);

  // Seleccionar automáticamente el capítulo en curso cuando cambia la orden
  useEffect(() => {
    const activeStage =
      stages.find((s) => s.status === 'EN_CURSO') ||
      stages.find((s) => s.status === 'BLOQUEADO_HITO') ||
      stages[stages.length - 1];
    if (activeStage) {
      setSelectedStageId(activeStage.id);
    }
  }, [orden?.orden_pago_id, stages.length]);

  // Si el usuario hace clic en una cuota desde la línea de tiempo externa, sincronizar el capítulo
  useEffect(() => {
    if (activeCuotaHighlight != null) {
      const match = stages.find((s) => s.linkedCuotaNum === activeCuotaHighlight);
      if (match) setSelectedStageId(match.id);
    }
  }, [activeCuotaHighlight, stages]);

  // Cálculo del progreso físico del avatar a lo largo de la pista de 5 capítulos
  const { completedCount, activeIndex, trackProgressPct, avatarPositionPct } = useMemo(() => {
    const completed = stages.filter((s) => s.status === 'COMPLETADO').length;
    const inProgressIdx = stages.findIndex((s) => s.status === 'EN_CURSO');
    let currentIdx = inProgressIdx !== -1 ? inProgressIdx : Math.max(0, completed - 1);
    if (completed === stages.length) currentIdx = stages.length - 1;

    // Porcentaje de línea iluminada entre los 5 nodos (0%, 25%, 50%, 75%, 100%)
    const nodePositions = [10, 30, 50, 70, 90];
    const avatarPos = nodePositions[currentIdx] ?? 10;
    const linePct = Math.min(100, Math.round(((currentIdx + (completed === stages.length ? 1 : 0.35)) / 5) * 100));

    return {
      completedCount: completed,
      activeIndex: currentIdx,
      trackProgressPct: linePct,
      avatarPositionPct: avatarPos,
    };
  }, [stages]);

  const selectedStage =
    stages.find((s) => s.id === selectedStageId) || stages[0];
  const selectedCuota = selectedStage?.linkedCuota;
  const isCuotaPagada = selectedCuota?.estado === 'PAGADA';
  const isCuotaEsperaHito = selectedCuota?.estado === 'ESPERA_HITO';

  const handleStageSelect = (stage: ThesisMilestoneStage) => {
    setSelectedStageId(stage.id);
    onSelectCuotaHighlight?.(stage.linkedCuotaNum);
  };

  const handleTriggerToggleHito = async () => {
    if (!selectedCuota || !onToggleHito) return;
    const unlocking = selectedCuota.estado === 'ESPERA_HITO';
    setEnergyPulseKey((prev) => prev + 1);
    if (unlocking) {
      onTriggerCelebration?.();
    }
    await onToggleHito(Number(selectedCuota.numero_cuota), selectedCuota.estado);
  };

  return (
    <div
      className={`glass-panel rounded-3xl p-5 sm:p-6 border transition-all duration-300 ${
        isSectionFocused
          ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-500/10'
          : 'border-slate-200/85 dark:border-slate-800/90'
      }`}
    >
      {/* Encabezado de la Ruta Interactiva de Tesis */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-200/70 dark:border-slate-800/80">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-[10px] font-mono font-extrabold uppercase tracking-wider">
            <BookOpen className="w-3 h-3" />
            <span>CAMINO A LA SUSTENTACIÓN · SINCRONIZADO CON HITOS Y CUOTAS (OPCIÓN B)</span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
            <span>Ruta Interactiva de Tesis de {nombreEstudiante}</span>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              {completedCount}/5 Hitos Completados · Pista {trackProgressPct}%
            </span>
          </h2>
        </div>

        {/* Leyenda rápida de Estados e Interacción */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Pagado / Validado
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            Exigible en Pasarela
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Candado por Hito (Asesor)
          </span>
        </div>
      </div>

      {/* PISTA VISUAL DE 5 HITOS CON AVATAR EN MOVIMIENTO Y TRAZO SVG */}
      <div className="relative pt-14 pb-6 px-2 sm:px-6 overflow-x-auto">
        <div className="min-w-[640px] relative">
          {/* AVATAR DEL TESISTA CON BIRRETE QUE VIAJA POR LA RUTA */}
          <div className="relative h-12 mb-1 pointer-events-none">
            <motion.div
              initial={false}
              animate={{ left: `${avatarPositionPct}%` }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 110, damping: 16 }
              }
              className="absolute -top-2 -translate-x-1/2 z-20 flex flex-col items-center"
            >
              {/* Etiqueta flotante sobre el avatar */}
              <div className="px-2 py-0.5 rounded-full bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 text-[10px] font-mono font-extrabold shadow-md whitespace-nowrap mb-1 flex items-center gap-1">
                <span>🎓 {nombreEstudiante.split(' ')[0]}</span>
                <span className="opacity-80">· Cap. {activeIndex + 1}/5</span>
              </div>

              {/* SVG del Avatar Tesista con Birrete y Tesis Brillante */}
              <motion.svg
                viewBox="0 0 48 48"
                className="w-10 h-10 drop-shadow-md"
                animate={
                  prefersReducedMotion ? undefined : { y: [0, -3.5, 0] }
                }
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {/* Halo esmeralda bajo el avatar */}
                <ellipse cx="24" cy="44" rx="12" ry="3" fill="#10b981" fillOpacity="0.35" />
                {/* Toga académica */}
                <path
                  d="M14 40 C14 31, 34 31, 34 40 Z"
                  className="fill-slate-800 dark:fill-slate-200"
                />
                {/* Estola dorada/esmeralda */}
                <path d="M20 33 L24 40 L28 33" fill="none" stroke="#10b981" strokeWidth="2.5" />
                {/* Rostro del tesista */}
                <circle cx="24" cy="24" r="6.5" fill="#fcd34d" />
                {/* Birrete */}
                <polygon
                  points="24,10 38,16 24,22 10,16"
                  className="fill-slate-900 dark:fill-emerald-600 stroke-amber-400"
                  strokeWidth="1.2"
                />
                {/* Borla */}
                <path d="M24 16 Q33 17 35 23" fill="none" stroke="#fbbf24" strokeWidth="1.6" />
                <circle cx="35" cy="24" r="1.8" fill="#fbbf24" />
                {/* Manuscrito brillante en mano */}
                <rect
                  x="27"
                  y="30"
                  width="9"
                  height="11"
                  rx="1.5"
                  fill="#059669"
                  stroke="#a7f3d0"
                  strokeWidth="1.2"
                />
              </motion.svg>
            </motion.div>
          </div>

          {/* CARRIL SVG ANIMADO CONECTANDO LOS 5 CAPÍTULOS */}
          <div className="relative flex items-center justify-between">
            <svg
              viewBox="0 0 1000 36"
              preserveAspectRatio="none"
              className="absolute left-[10%] right-[10%] w-[80%] h-9 top-1/2 -translate-y-1/2 pointer-events-none z-0 overflow-visible"
            >
              <defs>
                <linearGradient id="trackActiveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="60%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>

              {/* Riel base gris */}
              <line
                x1="0"
                y1="18"
                x2="1000"
                y2="18"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                className="text-slate-200 dark:text-slate-800"
              />

              {/* Riel punteado de flujo energético */}
              <line
                x1="0"
                y1="18"
                x2="1000"
                y2="18"
                stroke="url(#trackActiveGrad)"
                strokeWidth="2.5"
                strokeDasharray="8 10"
                className="animate-dash-flow opacity-60"
              />

              {/* Progreso real iluminado con Framer Motion */}
              <motion.line
                x1="0"
                y1="18"
                x2="1000"
                y2="18"
                stroke="url(#trackActiveGrad)"
                strokeWidth="6"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: Math.max(0.05, trackProgressPct / 100) }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </svg>

            {/* LOS 5 NODOS INTERACTIVOS DE CAPÍTULOS DE TESIS */}
            {stages.map((stage) => {
              const isSelected = stage.id === selectedStage.id;
              const isCompleted = stage.status === 'COMPLETADO';
              const isEnCurso = stage.status === 'EN_CURSO';
              const isHighlightedByCuota =
                activeCuotaHighlight != null &&
                stage.linkedCuotaNum === activeCuotaHighlight;

              return (
                <div
                  key={stage.id}
                  className="relative z-10 w-1/5 flex flex-col items-center text-center px-1"
                >
                  <motion.button
                    type="button"
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.07, y: -2 }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                    onClick={() => handleStageSelect(stage)}
                    onMouseEnter={() => handleStageSelect(stage)}
                    className={`group relative w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer shadow-sm ${
                      isCompleted
                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/25'
                        : isEnCurso
                          ? 'bg-sky-500 text-white border-sky-300 shadow-sky-500/30 animate-pulse-glow'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-amber-400/70 dark:border-amber-500/50'
                    } ${
                      isSelected || isHighlightedByCuota
                        ? 'ring-4 ring-emerald-500/30 dark:ring-emerald-400/35 scale-105'
                        : ''
                    }`}
                  >
                    {/* Icono / Candado SVG Animado */}
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-6 h-6 overflow-visible"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {/* Arco del candado que se abre cuando el hito está en curso / EXIGIBLE */}
                        <motion.path
                          d="M7 11V7a5 5 0 0 1 10 0v4"
                          initial={false}
                          animate={
                            isEnCurso
                              ? { y: -3, rotate: -18, originX: '17px', originY: '11px' }
                              : { y: 0, rotate: 0 }
                          }
                          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                        />
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                      </svg>
                    )}

                    {/* Badge de Cuota vinculada */}
                    <span
                      className={`absolute -top-2.5 -right-2.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-black border shadow-xs ${
                        isCompleted
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-400'
                          : isEnCurso
                            ? 'bg-sky-950 text-sky-200 border-sky-300'
                            : 'bg-amber-500 text-slate-950 border-amber-300'
                      }`}
                    >
                      C#{stage.linkedCuotaNum}
                    </span>
                  </motion.button>

                  {/* Título del Hito */}
                  <div className="mt-2.5 space-y-0.5">
                    <span
                      className={`block text-xs font-black leading-tight ${
                        isSelected
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {stage.shortTitle}
                    </span>
                    <span className="block text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      {stage.chapterTag}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* TARJETA DE DETALLE INTERACTIVO DEL CAPÍTULO + PUENTE DE ENERGÍA ASESOR ➔ MERCADO PAGO */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedStage.id}
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: 0.22 }}
          className="mt-2 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/70 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Información del Capítulo y Entregable del Asesor */}
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                  {selectedStage.chapterTag}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full ${
                    selectedStage.status === 'COMPLETADO'
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      : selectedStage.status === 'EN_CURSO'
                        ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                        : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {selectedStage.status === 'COMPLETADO' ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> HITO & CUOTA PAGADA
                    </>
                  ) : selectedStage.status === 'EN_CURSO' ? (
                    <>
                      <Unlock className="w-3 h-3" /> EXIGIBLE · PASARELA DESBLOQUEADA
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3" /> ESPERA_HITO · CANDADO ACTIVO
                    </>
                  )}
                </span>
              </div>

              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {selectedStage.fullTitle}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong className="text-slate-800 dark:text-slate-100">Entregable auditable:</strong>{' '}
                {selectedStage.deliverable}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                  <UserCheck className="w-3.5 h-3.5 text-purple-500" />
                  Asesor Responsable: <strong>{asesorNombre}</strong>
                </span>
                {selectedCuota && (
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                    Vinculado a Cuota #{selectedCuota.numero_cuota} · S/{' '}
                    {Number(selectedCuota.monto_programado || 0).toFixed(2)} (
                    {selectedCuota.estado})
                  </span>
                )}
              </div>
            </div>

            {/* Controles Directos del Hito (Aprobar / Revertir + Ir a Pasarela) */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {selectedCuota && !isCuotaPagada && onToggleHito && (
                <motion.button
                  type="button"
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                  disabled={actionBusy === `cuota-${selectedCuota.numero_cuota}`}
                  onClick={handleTriggerToggleHito}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer shadow-sm ${
                    isCuotaEsperaHito
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/25'
                      : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {isCuotaEsperaHito ? (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>
                        {actionBusy === `cuota-${selectedCuota.numero_cuota}`
                          ? 'Liberando Hito...'
                          : `Aprobar Hito (Liberar Cuota #${selectedCuota.numero_cuota})`}
                      </span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>
                        {actionBusy === `cuota-${selectedCuota.numero_cuota}`
                          ? 'Bloqueando...'
                          : `Volver a Bloquear Cuota #${selectedCuota.numero_cuota}`}
                      </span>
                    </>
                  )}
                </motion.button>
              )}

              {selectedStage.status === 'EN_CURSO' && (
                <Link
                  href={`/checkout/${codigoOrden}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold shadow-sm shadow-sky-600/25 transition-all"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Cobrar en Mercado Pago</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>

          {/* PUENTE DE FLUJO ENERGÉTICO: ASESOR / HITO ➔ MERCADO PAGO CHECKOUT PRO */}
          <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300">
              <span className="w-7 h-7 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <FileCheck2 className="w-4 h-4" />
              </span>
              <span>1. Validación Académica ({asesorNombre})</span>
            </div>

            {/* Conducto SVG con partícula viajera cuando el hito está desbloqueado o recién conmutado */}
            <div className="flex-1 w-full sm:w-auto max-w-md relative h-7 flex items-center">
              <svg viewBox="0 0 300 24" className="w-full h-6 overflow-visible">
                <line
                  x1="8"
                  y1="12"
                  x2="292"
                  y2="12"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray="5 6"
                  className={
                    selectedStage.status !== 'BLOQUEADO_HITO'
                      ? 'text-emerald-500/60 animate-dash-flow'
                      : 'text-slate-300 dark:text-slate-700'
                  }
                />
                {/* Partícula de energía viajando del nodo Asesor al nodo Mercado Pago */}
                {selectedStage.status !== 'BLOQUEADO_HITO' && !prefersReducedMotion && (
                  <motion.circle
                    key={`particle-${energyPulseKey}-${selectedStage.id}`}
                    cx="12"
                    cy="12"
                    r="5"
                    fill="#10b981"
                    initial={{ cx: 12, opacity: 0.9 }}
                    animate={{ cx: [12, 288], opacity: [1, 1, 0.3] }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                )}
              </svg>
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  {selectedStage.status === 'BLOQUEADO_HITO'
                    ? '🔒 Checkout retenido hasta conformidad'
                    : '⚡ Hito validado ➔ Link Mercado Pago habilitado'}
                </span>
              </span>
            </div>

            <div
              className={`flex items-center gap-2 text-xs font-bold ${
                selectedStage.status !== 'BLOQUEADO_HITO'
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <span
                className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                  selectedStage.status !== 'BLOQUEADO_HITO'
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-200 dark:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
              </span>
              <span>2. Pasarela Oficial Mercado Pago</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
