'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { CheckCircle2, Lock, Unlock, Sparkles } from 'lucide-react';
import { buildThesisStages } from './ThesisInteractiveWidgets';

export interface InteractiveThesisStageProps {
  cuotas: any[];
  activeStageId: number;
  onSelectStage: (stageId: number, cuotaNum: number) => void;
  /** Se incrementa cada vez que se aprueba un hito / confirma un pago. */
  celebrateTrigger?: number;
  studentName?: string;
}

const CARD_LABELS: Record<number, string> = {
  1: 'Tema y Plan',
  2: 'Marco Teórico',
  3: 'Metodología',
  4: 'Turnitin',
  5: 'Sustentación',
};

// Posiciones de las tarjetas flotantes alrededor del manuscrito (solo >= lg)
const CARD_POSITIONS: Record<number, string> = {
  1: 'left-3 top-6',
  2: 'left-3 top-1/2 -translate-y-1/2',
  3: 'left-3 bottom-6',
  4: 'right-3 top-6',
  5: 'right-3 bottom-6',
};

const STATUS_STYLES = {
  COMPLETADO: {
    halo: 'rgba(16,185,129,0.55)',
    chip: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    pct: 100,
    label: 'Validado',
  },
  EN_CURSO: {
    halo: 'rgba(56,189,248,0.55)',
    chip: 'border-sky-500/50 bg-sky-500/15 text-sky-700 dark:text-sky-300',
    pct: 68,
    label: 'En auditoría',
  },
  BLOQUEADO_HITO: {
    halo: 'rgba(245,158,11,0.4)',
    chip: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    pct: 20,
    label: 'Espera de hito',
  },
} as const;

export function InteractiveThesisStage({
  cuotas,
  activeStageId,
  onSelectStage,
  celebrateTrigger = 0,
  studentName = 'Tesista',
}: InteractiveThesisStageProps) {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const stages = useMemo(() => buildThesisStages(cuotas || []), [cuotas]);
  const active = stages.find((s) => s.id === activeStageId) || stages[0];
  const style = STATUS_STYLES[active.status];

  // Inclinación 3D siguiendo el puntero
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), {
    stiffness: 140,
    damping: 18,
  });
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), {
    stiffness: 140,
    damping: 18,
  });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced || !containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const handleLeave = () => {
    mx.set(0);
    my.set(0);
  };

  // Partículas de flujo hacia la derecha: al cambiar de capítulo y al aprobar
  const [burstKey, setBurstKey] = useState(0);
  useEffect(() => {
    setBurstKey((k) => k + 1);
  }, [activeStageId]);

  // Destello de validación sobre birrete y escudo al aprobar un hito
  const [flashKey, setFlashKey] = useState(0);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setFlashKey((k) => k + 1);
    setBurstKey((k) => k + 1);
  }, [celebrateTrigger]);

  const particles = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        id: i,
        y: (i - 3) * 14,
        delay: i * 0.12,
        size: 4 + (i % 3) * 2,
      })),
    [],
  );

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/90 bg-gradient-to-b from-slate-100 to-slate-200 dark:from-[#0a1020] dark:to-[#03060d] min-h-[460px] lg:min-h-[520px] flex flex-col"
    >
      {/* Cuadrícula tenue de fondo */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.5] architectural-grid pointer-events-none"
      />

      {/* Halo esmeralda/azul del capítulo activo */}
      <motion.div
        aria-hidden
        key={`halo-${active.id}`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] max-w-[90%] rounded-full blur-3xl pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${style.halo} 0%, rgba(14,165,233,0.12) 55%, transparent 72%)`,
        }}
      />

      {/* Encabezado */}
      <div className="relative z-10 px-5 pt-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-[10px] font-mono font-extrabold uppercase tracking-wider">
          <Sparkles className="w-3 h-3" />
          <span>Escena de Tesis · {studentName}</span>
        </div>
        <span
          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${style.chip}`}
        >
          {CARD_LABELS[active.id]} · {style.label}
        </span>
      </div>

      {/* Manuscrito central 3D */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-6 [perspective:1100px]">
        <div className="relative w-full max-w-[300px] sm:max-w-[360px] lg:max-w-[340px]">
          <div className={reduced ? '' : 'animate-float-slow'}>
            <motion.div
              style={reduced ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }}
              className="relative"
            >
              {/* Base oscura bajo el manuscrito */}
              <div
                aria-hidden
                className="absolute -inset-3 rounded-[2rem] bg-slate-900/80 dark:bg-black/70 blur-md"
              />
              <div
                className="relative rounded-3xl overflow-hidden ring-1 ring-white/10 shadow-2xl shadow-black/50"
                style={{
                  // Difumina los bordes para que no haya cortes duros con la base
                  WebkitMaskImage:
                    'radial-gradient(ellipse 98% 98% at 50% 50%, #000 78%, transparent 100%)',
                  maskImage:
                    'radial-gradient(ellipse 98% 98% at 50% 50%, #000 78%, transparent 100%)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/thesis-hero.jpg"
                  alt="Manuscrito de tesis con birrete y escudo académico"
                  className="block w-full h-auto max-h-[380px] object-cover select-none"
                  draggable={false}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"
                />
              </div>

              {/* Destello de validación sobre birrete (arriba) y escudo (abajo) */}
              <AnimatePresence>
                {flashKey > 0 && (
                  <motion.div
                    key={`flash-${flashKey}`}
                    aria-hidden
                    className="absolute inset-0 pointer-events-none"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.6, ease: 'easeOut' }}
                  >
                    <motion.div
                      className="absolute left-1/2 top-[22%] -translate-x-1/2 w-24 h-24 rounded-full"
                      style={{
                        background:
                          'radial-gradient(circle, rgba(255,255,255,0.95), rgba(16,185,129,0.6) 45%, transparent 70%)',
                      }}
                      initial={{ scale: 0.3 }}
                      animate={{ scale: reduced ? 1 : 2.6 }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                    <motion.div
                      className="absolute left-1/2 top-[68%] -translate-x-1/2 w-24 h-24 rounded-full"
                      style={{
                        background:
                          'radial-gradient(circle, rgba(255,255,255,0.9), rgba(56,189,248,0.55) 45%, transparent 70%)',
                      }}
                      initial={{ scale: 0.3 }}
                      animate={{ scale: reduced ? 1 : 2.4 }}
                      transition={{ duration: 1.2, ease: 'easeOut', delay: 0.15 }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Porcentaje auditado del capítulo activo */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`pct-${active.id}-${active.status}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-2xl border border-white/10 bg-slate-900/90 text-white px-4 py-2 shadow-xl backdrop-blur"
            >
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-lg font-black leading-none text-emerald-300">
                    {style.pct}%
                  </div>
                  <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                    auditado
                  </div>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="text-[11px] leading-tight max-w-[170px] whitespace-normal">
                  <div className="font-bold">{active.shortTitle}</div>
                  <div className="text-slate-400">{active.chapterTag}</div>
                </div>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${style.pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Partículas de flujo hacia la derecha */}
          {!reduced && (
            <div
              key={`burst-${burstKey}`}
              aria-hidden
              className="absolute left-full top-1/2 w-0 h-0 pointer-events-none"
            >
              {particles.map((p) => (
                <motion.span
                  key={p.id}
                  className="absolute rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]"
                  style={{ width: p.size, height: p.size, top: p.y }}
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 150, opacity: [0, 1, 0] }}
                  transition={{ duration: 1.6, delay: p.delay, ease: 'easeOut' }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Tarjetas flotantes alrededor (solo pantallas grandes) */}
        <div className="hidden lg:block absolute inset-0 pointer-events-none">
          {stages.map((s) => (
            <StageCard
              key={s.id}
              stage={s}
              isActive={s.id === active.id}
              onClick={() => onSelectStage(s.id, s.linkedCuotaNum)}
              className={`absolute ${CARD_POSITIONS[s.id]} pointer-events-auto`}
              reduced={!!reduced}
            />
          ))}
        </div>
      </div>

      {/* Tarjetas en fila para pantallas pequeñas */}
      <div className="relative z-10 lg:hidden px-4 pb-5 pt-3 flex flex-wrap justify-center gap-2">
        {stages.map((s) => (
          <StageCard
            key={s.id}
            stage={s}
            isActive={s.id === active.id}
            onClick={() => onSelectStage(s.id, s.linkedCuotaNum)}
            reduced={!!reduced}
          />
        ))}
      </div>
    </div>
  );
}

function StageCard({
  stage,
  isActive,
  onClick,
  className = '',
  reduced,
}: {
  stage: ReturnType<typeof buildThesisStages>[number];
  isActive: boolean;
  onClick: () => void;
  className?: string;
  reduced: boolean;
}) {
  const st = STATUS_STYLES[stage.status];
  const Icon =
    stage.status === 'COMPLETADO'
      ? CheckCircle2
      : stage.status === 'EN_CURSO'
        ? Unlock
        : Lock;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduced ? undefined : { scale: 1.06, y: -2 }}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 320, damping: 20 }}
      aria-pressed={isActive}
      className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold backdrop-blur cursor-pointer transition-shadow ${st.chip} ${
        isActive ? 'ring-2 ring-offset-0 ring-emerald-400/70 shadow-lg shadow-emerald-500/20' : ''
      } ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{CARD_LABELS[stage.id]}</span>
    </motion.button>
  );
}

export default InteractiveThesisStage;
