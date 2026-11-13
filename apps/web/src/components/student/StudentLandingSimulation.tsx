'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Send,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Award,
  CreditCard,
  ExternalLink,
  ArrowRight,
  Lock,
  Unlock,
  FileCheck2,
  BarChart3,
  Bot,
  MessageSquare,
  LogIn,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { useRole } from '@/context/RoleContext';

interface MilestoneStep {
  id: number;
  title: string;
  subtitle: string;
  deliverable: string;
  cuotaLabel: string;
  statusLabel: string;
  unlocked: boolean;
  metrics: string[];
}

const THESIS_MILESTONES: MilestoneStep[] = [
  {
    id: 1,
    title: '1. Plan de Tesis',
    subtitle: 'Elección del Tema, Matriz de Consistencia e Inscripción Oficial',
    deliverable:
      'Planteamiento del problema bajo estándar universitario VRI / SUNEDU, formulación de hipótesis, objetivos e inscripción formal del proyecto de investigación.',
    cuotaLabel: 'Hito Inicial (30%) — Arranque y Asignación de Asesor',
    statusLabel: 'ETAPA 01 · INICIO ACADÉMICO',
    unlocked: true,
    metrics: ['Matriz de Consistencia 100%', 'Formato Oficial de Escuela', 'Asesor Especialista Asignado'],
  },
  {
    id: 2,
    title: '2. Marco Teórico Scopus',
    subtitle: 'Búsqueda Bibliométrica Q1/Q2 en Scopus, Web of Science y SciELO',
    deliverable:
      'Redacción de antecedentes internacionales y nacionales de los últimos 5 años, bases teóricas especializadas y operacionalización de variables.',
    cuotaLabel: 'Hito Intermedio (40%) — Liberado tras conformidad de avance',
    statusLabel: 'ETAPA 02 · RIGOR CIENTÍFICO',
    unlocked: true,
    metrics: ['+45 Artículos Scopus/WoS', 'Citas APA 7ma / Vancouver', 'Auditoría Semántica IA'],
  },
  {
    id: 3,
    title: '3. Validación de Instrumentos',
    subtitle: 'Juicio de Expertos, Confiabilidad Alfa de Cronbach / KR-20 y Trabajo de Campo',
    deliverable:
      'Fichas de validación firmadas por doctores especialistas, prueba piloto y levantamiento de muestra representativa.',
    cuotaLabel: 'Protegido dentro del Hito Intermedio',
    statusLabel: 'ETAPA 03 · VALIDACIÓN EMPÍRICA',
    unlocked: true,
    metrics: ['Alfa de Cronbach > 0.88', '3 Jueces Doctores', 'Muestreo Estratificado'],
  },
  {
    id: 4,
    title: '4. Análisis Estadístico',
    subtitle: 'Procesamiento Inferencial en SPSS / RStudio y Auditoría Turnitin < 10%',
    deliverable:
      'Pruebas de normalidad (Kolmogorov-Smirnov / Shapiro-Wilk), contrastación de hipótesis, discusión de resultados y certificado oficial Turnitin.',
    cuotaLabel: 'Hito Final (30%) — Bloqueado hasta entrega de Borrador Completo',
    statusLabel: 'ETAPA 04 · CANDADO DE GARANTÍA',
    unlocked: false,
    metrics: ['SPSS v29 / Python / R', 'Similitud Turnitin < 10%', 'Informe Final Completo'],
  },
  {
    id: 5,
    title: '5. Sustentación por Unanimidad',
    subtitle: 'Defensa Oral ante Jurado, Diapositivas Ejecutivas y Empastado Oficial',
    deliverable:
      'Simulacro intensivo de defensa oral con preguntas reales de jurado, presentación ejecutiva de alto impacto y acompañamiento hasta el acta de aprobación.',
    cuotaLabel: 'Cierre Académico tras Aprobación de Jurado',
    statusLabel: 'ETAPA 05 · META DE GRADUACIÓN',
    unlocked: false,
    metrics: ['Coaching de Defensa Oral', 'Balotario de 30 Preguntas', 'Aprobación Garantizada'],
  },
];

const CELEBRATION_PARTICLES = [
  { id: 1, left: '14%', delay: 0, duration: 3.4 },
  { id: 2, left: '28%', delay: 0.6, duration: 3.8 },
  { id: 3, left: '46%', delay: 1.1, duration: 3.2 },
  { id: 4, left: '64%', delay: 0.3, duration: 3.6 },
  { id: 5, left: '79%', delay: 0.9, duration: 3.5 },
  { id: 6, left: '88%', delay: 1.4, duration: 3.9 },
];

const TELEGRAM_BOT_URL = 'https://t.me/inbestiga_tesis_bot';

export default function StudentLandingSimulation() {
  const prefersReducedMotion = useReducedMotion();
  const {
    isAuthenticated,
    role,
    studentProfile,
    openLoginModal,
    logout,
  } = useRole();

  const [selectedMilestoneId, setSelectedMilestoneId] = useState<number>(2);

  const isLoggedStudent =
    isAuthenticated && role === 'ESTUDIANTE' && Boolean(studentProfile);

  const activeMilestone =
    THESIS_MILESTONES.find((m) => m.id === selectedMilestoneId) ||
    THESIS_MILESTONES[0];

  return (
    <div className="relative space-y-12 sm:space-y-16 pb-20">
      {/* =====================================================================
          FONDO ATMOSFÉRICO DEL PORTAL DEL TESISTA
          ===================================================================== */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-36 left-1/4 w-[560px] h-[560px] rounded-full bg-emerald-500/12 dark:bg-emerald-500/15 blur-[140px] animate-aurora" />
        <div
          className="absolute top-1/3 -right-28 w-[500px] h-[500px] rounded-full bg-sky-500/12 dark:bg-sky-500/15 blur-[140px] animate-aurora"
          style={{ animationDelay: '-4s' }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-[480px] h-[480px] rounded-full bg-amber-500/10 dark:bg-amber-500/10 blur-[140px] animate-aurora"
          style={{ animationDelay: '-7s' }}
        />
        <div className="absolute inset-0 architectural-grid opacity-55" />
      </div>

      {/* =====================================================================
          BANNER DE SESIÓN ACTIVA DEL TESISTA (SOLO CUANDO INICIÓ SESIÓN EN WEB)
          ===================================================================== */}
      <AnimatePresence>
        {isLoggedStudent && studentProfile && (
          <motion.section
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-3xl border-2 border-emerald-500/45 bg-gradient-to-r from-emerald-950/90 via-slate-950/95 to-sky-950/90 text-white p-4 sm:p-5 shadow-xl"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                      SESIÓN DE ESTUDIANTE ACTIVA
                    </span>
                    <span className="text-xs font-mono text-sky-300">
                      {studentProfile.codigoOrden} · {studentProfile.contratoCodigo}
                    </span>
                  </div>
                  <h2 className="text-sm sm:text-base font-black">
                    Bienvenido, {studentProfile.nombre} — {studentProfile.universidad}
                  </h2>
                  <p className="text-xs text-slate-300">
                    Asesor asignado: <strong>{studentProfile.asesorNombre}</strong> · Telegram
                    vinculado: <span className="font-mono text-sky-300">{studentProfile.telegramUsername}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <Link
                  href={`/checkout/${studentProfile.codigoOrden}`}
                  className="shimmer-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/25 transition-all"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Ir a Mi Pasarela Mercado Pago ({studentProfile.codigoOrden})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* =====================================================================
          SECCIÓN 1 (#hero): HERO ACADÉMICO + ANIMATION 1 (LEVITACIÓN 3D & TELEMETRÍA ORBITAL)
          ===================================================================== */}
      <section
        id="hero"
        className="glass-panel rounded-3xl p-6 sm:p-10 lg:p-12 border border-slate-200/80 dark:border-slate-800/90 relative overflow-hidden"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Columna Izquierda: Propuesta Institucional General (o Personalizada si inició sesión) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold tracking-wide uppercase">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>PORTAL OFICIAL DEL TESISTA · INBESTIGA · TESIS</span>
              </span>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                {isLoggedStudent && studentProfile
                  ? studentProfile.universidad
                  : 'Normativa Universitaria SUNEDU / VRI'}
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.12]">
                {isLoggedStudent && studentProfile ? (
                  <>
                    Hola, {studentProfile.nombre}: tu{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400">
                      Tesis de Grado y Sustentación
                    </span>{' '}
                    con Garantía por Hitos
                  </>
                ) : (
                  <>
                    Tu{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400">
                      Tesis de Grado y Sustentación
                    </span>{' '}
                    con Garantía por Hitos Académicos
                  </>
                )}
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                {isLoggedStudent && studentProfile ? (
                  <>
                    Tu expediente <strong className="font-mono">{studentProfile.codigoOrden}</strong>{' '}
                    está protegido bajo la modalidad de{' '}
                    <strong>Conformidad Académica (Opción B)</strong>: cada cuota solo se habilita
                    cuando tu asesor (<strong>{studentProfile.asesorNombre}</strong>) valida el
                    entregable de tu capítulo, y gestionas todo en segundos desde nuestro Bot IA en
                    Telegram.
                  </>
                ) : (
                  <>
                    En <strong>INBESTIGA · TESIS</strong> desarrollamos tu investigación científica
                    bajo el modelo de <strong>Conformidad Académica (Opción B)</strong>: tus cuotas
                    en Mercado Pago solo se desbloquean conforme tu asesor especialista aprueba cada
                    capítulo. Además, nuestro Bot IA en Telegram (
                    <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                      @inbestiga_tesis_bot
                    </span>
                    ) reconoce automáticamente tu cuenta al escribirle.
                  </>
                )}
              </p>
            </div>

            {/* 3 Tarjetas de Valor Institucional (o Datos del Expediente si inició sesión) */}
            {isLoggedStudent && studentProfile ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-3.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block">
                    EXPEDIENTE ACTIVO
                  </span>
                  <strong className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {studentProfile.codigoOrden}
                  </strong>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Contrato {studentProfile.contratoCodigo}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-3.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block">
                    CUENTA TELEGRAM VINCULADA
                  </span>
                  <strong className="text-sm font-black font-mono text-sky-600 dark:text-sky-400">
                    {studentProfile.telegramUsername}
                  </strong>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 font-mono">
                    Chat ID: {studentProfile.telegramChatId}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-3.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block">
                    ASESOR ESPECIALISTA
                  </span>
                  <strong className="text-sm font-black text-slate-900 dark:text-white truncate block">
                    {studentProfile.asesorNombre}
                  </strong>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                    ✓ Hito 1 Aprobado
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-3.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block">
                    GARANTÍA METODOLÓGICA
                  </span>
                  <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    Turnitin &lt; 10% · Scopus
                  </strong>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Cumplimiento normativo VRI
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-3.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block">
                    RECAUDACIÓN POR HITOS
                  </span>
                  <strong className="text-sm font-black text-sky-600 dark:text-sky-400">
                    Mercado Pago Oficial
                  </strong>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Paga conforme apruebas capítulos
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-3.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block">
                    ATENCIÓN IA 24/7
                  </span>
                  <strong className="text-sm font-black font-mono text-slate-900 dark:text-white truncate block">
                    @inbestiga_tesis_bot
                  </strong>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                    Reconocimiento automático en Telegram
                  </span>
                </div>
              </div>
            )}

            {/* CTAs Principales */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href={TELEGRAM_BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shimmer-btn inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs sm:text-sm font-extrabold shadow-xl shadow-sky-500/25 transition-all hover:-translate-y-0.5"
              >
                <Send className="w-4 h-4" />
                <div>
                  <div className="leading-none">Chatear con el Bot IA en Telegram</div>
                  <div className="text-[10px] font-mono text-sky-100 mt-0.5">
                    @inbestiga_tesis_bot · Atención 24/7
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 opacity-85" />
              </a>

              {isLoggedStudent && studentProfile ? (
                <Link
                  href={`/checkout/${studentProfile.codigoOrden}`}
                  className="shimmer-btn inline-flex items-center gap-2.5 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-600/25 transition-all hover:-translate-y-0.5"
                >
                  <CreditCard className="w-4 h-4" />
                  <div>
                    <div className="leading-none">Mi Pasarela Mercado Pago</div>
                    <div className="text-[10px] font-mono text-emerald-100 mt-0.5">
                      Ver Cuotas · {studentProfile.codigoOrden}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => openLoginModal('ESTUDIANTE')}
                  className="shimmer-btn inline-flex items-center gap-2.5 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-600/25 transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <div className="text-left">
                    <div className="leading-none">
                      Iniciar Sesión / Consultar mi Expediente
                    </div>
                    <div className="text-[10px] font-mono text-emerald-100 mt-0.5">
                      Acceso para Tesistas y Administración
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Columna Derecha: ANIMATION 1 — 3D Levitation & Orbiting Telemetry (hero-tesis-3d.jpg) */}
          <div className="lg:col-span-5 relative flex items-center justify-center py-4">
            {/* Resplandor Esmeralda/Cian detrás de la imagen */}
            <div className="absolute inset-4 rounded-3xl bg-gradient-to-tr from-emerald-500/30 via-teal-400/20 to-sky-500/30 blur-2xl pointer-events-none" />

            <motion.div
              animate={
                prefersReducedMotion
                  ? undefined
                  : {
                      y: [0, -14, 0],
                      rotateZ: [-1, 1, -1],
                      scale: [1, 1.02, 1],
                    }
              }
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="relative w-full max-w-md rounded-3xl p-2 bg-gradient-to-br from-emerald-500/40 via-sky-500/30 to-indigo-500/40 shadow-2xl"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-slate-950">
                <img
                  src="/images/landing/hero-tesis-3d.jpg"
                  alt="Ecosistema 3D de Investigación y Tesis Universitaria INBESTIGA"
                  className="w-full h-[340px] sm:h-[380px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-white/90 bg-slate-950/75 backdrop-blur-md px-3 py-2 rounded-xl border border-white/15">
                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    Arquitectura de Tesis 3D
                  </span>
                  <span>
                    {isLoggedStudent && studentProfile
                      ? studentProfile.codigoOrden
                      : 'Estándar VRI / SUNEDU'}
                  </span>
                </div>
              </div>

              {/* 3 Insignias Cristalinas Orbitando las Esquinas */}
              <motion.div
                animate={prefersReducedMotion ? undefined : { y: [0, -6, 0], x: [0, 3, 0] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-3 -left-3 sm:-left-5 px-3 py-1.5 rounded-2xl bg-slate-950/90 text-white border border-emerald-400/50 shadow-lg backdrop-blur-md flex items-center gap-2 text-[11px] font-extrabold"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Normativa VRI / SUNEDU</span>
              </motion.div>

              <motion.div
                animate={prefersReducedMotion ? undefined : { y: [0, 7, 0], x: [0, -3, 0] }}
                transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                className="absolute -top-3 -right-2 sm:-right-4 px-3 py-1.5 rounded-2xl bg-slate-950/90 text-white border border-sky-400/50 shadow-lg backdrop-blur-md flex items-center gap-2 text-[11px] font-extrabold"
              >
                <FileCheck2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Turnitin &lt; 10% Garantizado</span>
              </motion.div>

              <motion.div
                animate={prefersReducedMotion ? undefined : { y: [0, -5, 0] }}
                transition={{ duration: 3.9, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}
                className="absolute -bottom-4 right-4 px-3.5 py-1.5 rounded-2xl bg-emerald-600 text-white border border-emerald-300/60 shadow-xl flex items-center gap-2 text-[11px] font-mono font-black"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {isLoggedStudent && studentProfile
                    ? `Expediente: ${studentProfile.codigoOrden}`
                    : 'Hitos Verificados por Asesor'}
                </span>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECCIÓN 2 (#galeria-tesis): ANIMATION 2 — ESCÁNER ÓPTICO LÁSER SCOPUS & TILT INTERACTIVO
          ===================================================================== */}
      <section
        id="galeria-tesis"
        className="glass-panel rounded-3xl p-6 sm:p-10 border border-slate-200/80 dark:border-slate-800/90 space-y-8"
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200/70 dark:border-slate-800 pb-5">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-[11px] font-mono font-extrabold uppercase">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>RIGOR CIENTÍFICO & AUDITORÍA AUTOMATIZADA</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Investigación Indexada Scopus / SciELO &amp; Bioestadística Avanzada
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md">
            Pasa el cursor sobre el monitor holográfico para activar la inclinación interactiva mientras el escáner óptico verifica tus referencias y pruebas estadísticas.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* ANIMATION 2: Escáner Óptico Láser Continuo + Hover Perspective Tilt (investigacion-scopus.jpg) */}
          <div className="lg:col-span-6">
            <motion.div
              whileHover={
                prefersReducedMotion
                  ? undefined
                  : { scale: 1.025, rotateY: 4, rotateX: -2 }
              }
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              style={{ transformPerspective: 900 }}
              className="relative rounded-3xl overflow-hidden border-2 border-sky-500/40 bg-slate-950 shadow-2xl group"
            >
              <img
                src="/images/landing/investigacion-scopus.jpg"
                alt="Análisis Bibliométrico Scopus y Procesamiento Estadístico SPSS"
                className="w-full h-[340px] sm:h-[380px] object-cover opacity-95 group-hover:scale-105 transition-transform duration-700"
              />

              {/* Barra Láser Cian/Esmeralda barriendo verticalmente la imagen */}
              {!prefersReducedMotion && (
                <motion.div
                  animate={{ top: ['0%', '96%', '0%'] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
                  className="pointer-events-none absolute left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_24px_6px_rgba(34,211,238,0.75)] z-20"
                />
              )}

              {/* Nodos Pulsantes de Telemetría Bibliométrica sobre la Imagen */}
              <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-20">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/85 text-cyan-300 border border-cyan-400/40 text-[11px] font-mono font-bold backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  SCOPUS / WOS Q1-Q2 SCANNER
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/85 text-emerald-300 border border-emerald-400/40 text-[11px] font-mono font-bold backdrop-blur-md">
                  SPSS v29 · RSTUDIO
                </span>
              </div>

              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent text-white">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-sky-300 font-bold">
                    ✓ Auditoría de Originalidad y Consistencia Metodológica
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    99.4% Precisión
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Pilares Metodológicos que respaldan al Tesista */}
          <div className="lg:col-span-6 space-y-4">
            {[
              {
                badge: 'PILAR 01 · BIBLIOMETRÍA',
                title: 'Referencias Reales de Alto Impacto (Scopus, WoS y SciELO)',
                desc: 'Cero citas inventadas: cada antecedente y base teórica proviene de revistas indexadas con DOI verificable y formato APA 7ma / Vancouver / IEEE según tu escuela.',
                color: 'border-sky-500/35 bg-sky-500/5',
              },
              {
                badge: 'PILAR 02 · BIOESTADÍSTICA & ECONOMETRÍA',
                title: 'Procesamiento de Datos Auditable con Scripts Entregables',
                desc: 'Entregamos la base de datos limpia, sintaxis de SPSS/RStudio, pruebas de normalidad y contrastación de hipótesis listas para responder cualquier pregunta del jurado.',
                color: 'border-emerald-500/35 bg-emerald-500/5',
              },
              {
                badge: 'PILAR 03 · COBRO CONDICIONADO A CONFORMIDAD (RN-04)',
                title: 'Tu Inversión Avanza al Ritmo de tus Capítulos Aprobados',
                desc: 'Nuestro sistema bloquea automáticamente el cobro de la siguiente cuota en Mercado Pago hasta que tu asesor registra la conformidad de tu avance académico.',
                color: 'border-purple-500/35 bg-purple-500/5',
              },
            ].map((pilar) => (
              <div
                key={pilar.badge}
                className={`rounded-2xl border p-4 sm:p-5 space-y-1.5 transition-all hover:shadow-md ${pilar.color}`}
              >
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {pilar.badge}
                </span>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {pilar.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {pilar.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECCIÓN 3 (#ruta-graduacion): ANIMATION 3 — AURA DORADA, PARTÍCULAS Y RUTA DE 5 HITOS
          ===================================================================== */}
      <section
        id="ruta-graduacion"
        className="glass-panel rounded-3xl p-6 sm:p-10 border border-slate-200/80 dark:border-slate-800/90 space-y-8"
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200/70 dark:border-slate-800 pb-5">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-700 dark:text-amber-300 text-[11px] font-mono font-extrabold uppercase">
              <Award className="w-3.5 h-3.5" />
              <span>CAMINO A LA SUSTENTACIÓN POR UNANIMIDAD</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Ruta Interactiva de 5 Hitos Académicos y Desbloqueo de Cuotas
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md">
            Selecciona cualquiera de las 5 etapas para explorar qué entregable recibes y cómo se coordina tu cronograma de pagos.
          </p>
        </div>

        {/* Selector Horizontal de los 5 Hitos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {THESIS_MILESTONES.map((step) => {
            const active = step.id === selectedMilestoneId;
            return (
              <motion.button
                key={step.id}
                type="button"
                whileHover={prefersReducedMotion ? undefined : { y: -3 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                onClick={() => setSelectedMilestoneId(step.id)}
                className={`text-left rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  active
                    ? 'bg-gradient-to-br from-amber-500/15 via-emerald-500/10 to-sky-500/15 border-amber-500 ring-2 ring-amber-500/35 shadow-lg'
                    : 'bg-white/75 dark:bg-slate-900/70 border-slate-200/90 dark:border-slate-800 hover:border-amber-400/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 dark:bg-slate-800">
                    HITO 0{step.id}
                  </span>
                  {step.unlocked ? (
                    <Unlock className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Lock className="w-4 h-4 text-amber-500" />
                  )}
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    {step.title}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                    {step.subtitle}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Detalle Interactivo del Hito Seleccionado */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeMilestone.id}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 p-6 sm:p-7 space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-black px-3 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                    <GraduationCap className="w-4 h-4" />
                    {activeMilestone.statusLabel}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {activeMilestone.cuotaLabel}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {activeMilestone.title}: {activeMilestone.subtitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {activeMilestone.deliverable}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeMilestone.metrics.map((metric) => (
                    <span
                      key={metric}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      {metric}
                    </span>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    ¿Deseas consultar el avance de este hito o solicitar tu enlace de pago?
                  </div>
                  <a
                    href={TELEGRAM_BOT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-extrabold transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Consultar Hito en Telegram</span>
                  </a>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ANIMATION 3: Golden Aura Pulse & Rising Celebration Particles (sustentacion-exito.jpg) */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            {/* Halo Dorado Respirando */}
            <motion.div
              animate={
                prefersReducedMotion
                  ? undefined
                  : { scale: [1, 1.08, 1], opacity: [0.45, 0.8, 0.45] }
              }
              transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-2 rounded-3xl bg-gradient-to-tr from-amber-500/35 via-yellow-400/25 to-emerald-500/30 blur-2xl pointer-events-none"
            />

            <div className="relative w-full rounded-3xl overflow-hidden border-2 border-amber-400/60 bg-slate-950 shadow-2xl">
              <img
                src="/images/landing/sustentacion-exito.jpg"
                alt="Sustentación Exitosa de Tesis por Unanimidad"
                className="w-full h-[340px] sm:h-[360px] object-cover"
              />

              {/* Partículas Doradas Ascendentes de Celebración */}
              {!prefersReducedMotion &&
                CELEBRATION_PARTICLES.map((p) => (
                  <motion.span
                    key={p.id}
                    style={{ left: p.left }}
                    initial={{ bottom: '8%', opacity: 0, scale: 0.4 }}
                    animate={{
                      bottom: ['8%', '88%'],
                      opacity: [0, 1, 1, 0],
                      scale: [0.5, 1.3, 0.8],
                    }}
                    transition={{
                      duration: p.duration,
                      delay: p.delay,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                    className="pointer-events-none absolute w-2.5 h-2.5 rounded-full bg-amber-300 shadow-[0_0_12px_3px_rgba(251,191,36,0.85)] z-20"
                  />
                ))}

              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent text-white">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-extrabold uppercase text-amber-300 block">
                      META CUMPLIDA · JURADO EVALUADOR
                    </span>
                    <strong className="text-sm font-black">
                      Sustentación Aprobada con Mención Sobresaliente
                    </strong>
                  </div>
                  <Award className="w-7 h-7 text-amber-400 shrink-0" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECCIÓN 4 (#portal-telegram): ANIMATION 4 — IMAGEN ANIMADA CLICKEABLE DEL BOT DE TELEGRAM
          ===================================================================== */}
      <section
        id="portal-telegram"
        className="glass-panel rounded-3xl p-6 sm:p-10 lg:p-12 border-2 border-sky-500/40 bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950 text-white relative overflow-hidden shadow-2xl"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center relative z-10">
          {/* Columna Izquierda: Imagen Animada Clickeable con Ondas Sonar/Radar (telegram-bot-chat.jpg) */}
          <div className="lg:col-span-6 flex items-center justify-center">
            <a
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Haz clic en la imagen animada para abrir el Bot de Telegram @inbestiga_tesis_bot"
              className="group relative block w-full max-w-lg cursor-pointer focus:outline-none"
            >
              {/* Anillos Concéntricos Radar / Sonar alrededor de la imagen */}
              {!prefersReducedMotion && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.09, 1], opacity: [0.55, 0, 0.55] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut' }}
                    className="pointer-events-none absolute -inset-3 rounded-3xl border-2 border-sky-400/60"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.16, 1], opacity: [0.35, 0, 0.35] }}
                    transition={{
                      duration: 2.8,
                      delay: 0.9,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                    className="pointer-events-none absolute -inset-6 rounded-3xl border border-emerald-400/40"
                  />
                </>
              )}

              <motion.div
                whileHover={prefersReducedMotion ? undefined : { scale: 1.03, y: -4 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                className="relative rounded-3xl overflow-hidden border-2 border-sky-400/70 shadow-[0_0_45px_-5px_rgba(14,165,233,0.45)] bg-slate-950"
              >
                <img
                  src="/images/landing/telegram-bot-chat.jpg"
                  alt="Haz clic aquí para abrir @inbestiga_tesis_bot en Telegram"
                  className="w-full h-[350px] sm:h-[390px] object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Badge Superior Vivo sobre la Imagen */}
                <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0088cc]/95 text-white text-[11px] font-extrabold shadow-lg backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                    IMAGEN INTERACTIVA · CLIC PARA ABRIR TELEGRAM
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-950/85 text-sky-300 font-mono text-[10px] font-bold border border-sky-400/30">
                    @inbestiga_tesis_bot
                  </span>
                </div>

                {/* Burbuja Simulada del Bot IA en Vivo sobre la parte inferior de la imagen */}
                <div className="absolute bottom-3.5 left-3.5 right-3.5 p-4 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-sky-400/40 shadow-xl space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-sky-300">
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      <Bot className="w-3.5 h-3.5 text-emerald-400" />
                      Agente IA PAYERS (@inbestiga_tesis_bot)
                    </span>
                    <span className="text-emerald-400 font-bold">● En línea ahora</span>
                  </div>
                  {isLoggedStudent && studentProfile ? (
                    <p className="text-xs text-slate-100 leading-relaxed">
                      “¡Hola <strong>{studentProfile.nombre}</strong> (
                      <span className="text-sky-300 font-mono">
                        {studentProfile.telegramUsername}
                      </span>
                      )! Tu cuenta (Chat ID:{' '}
                      <span className="font-mono text-emerald-300">
                        {studentProfile.telegramChatId}
                      </span>
                      ) ya está vinculada a tu orden{' '}
                      <strong className="font-mono text-amber-300">
                        {studentProfile.codigoOrden}
                      </strong>
                      . <strong>Haz clic en esta imagen animada</strong> para abrir Telegram y
                      gestionar tus cuotas o consultar tus avances.”
                    </p>
                  ) : (
                    <p className="text-xs text-slate-100 leading-relaxed">
                      “¡Hola! Soy el Agente IA de <strong>INBESTIGA · TESIS</strong> (
                      <span className="text-sky-300 font-mono">@inbestiga_tesis_bot</span>). Al
                      hacer clic en esta imagen animada se abrirá Telegram, donde te reconoceré
                      automáticamente por tu cuenta vinculada para mostrarte tus cuotas, tus hitos
                      aprobados y tus links oficiales de Mercado Pago.”
                    </p>
                  )}
                </div>
              </motion.div>
            </a>
          </div>

          {/* Columna Derecha: Explicación del Canal Oficial en Telegram */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 text-xs font-extrabold uppercase tracking-wider">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>CANAL OFICIAL BIDIRECCIONAL DEL ESTUDIANTE</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Tu Asistente de Cobranza y Avances Académicos vive en{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-400">
                Telegram
              </span>
            </h2>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Como estudiante, no necesitas lidiar con paneles administrativos complejos. Haz clic
              directamente en la <strong>ilustración interactiva</strong> o en el botón inferior
              para conversar en tiempo real con nuestro Agente IA desde Telegram, donde tu usuario
              vinculado es identificado de inmediato:
            </p>

            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-200">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Solicita tu enlace oficial de <strong>Mercado Pago Checkout Pro</strong> para la
                  cuota exigible de tu expediente académico.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Recibe notificaciones instantáneas cuando tu asesor aprueba un hito académico y
                  desbloquea el siguiente capítulo.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Consulta tu cronograma de pagos, boletas electrónicas y estado de contrato las 24
                  horas.
                </span>
              </li>
            </ul>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <a
                href={TELEGRAM_BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shimmer-btn inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-[#0088cc] to-sky-500 hover:from-[#0077b5] hover:to-sky-400 text-white text-sm font-black shadow-xl shadow-sky-500/30 transition-all hover:-translate-y-0.5"
              >
                <Send className="w-5 h-5" />
                <span>Abrir @inbestiga_tesis_bot en Telegram</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              {!isLoggedStudent && (
                <button
                  type="button"
                  onClick={() => openLoginModal('ESTUDIANTE')}
                  className="inline-flex items-center gap-2 px-5 py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs sm:text-sm font-extrabold transition-all cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-emerald-400" />
                  <span>Vincular / Ver mi Orden en Web</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          WIDGET FLOTANTE PERSISTENTE EN ESQUINA INFERIOR DERECHA (TELEGRAM LAUNCHER)
          ===================================================================== */}
      <div className="fixed bottom-5 right-5 z-40">
        <motion.a
          href={TELEGRAM_BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={prefersReducedMotion ? undefined : { scale: 1.06, y: -3 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
          className="group flex items-center gap-3 p-2 pr-4 rounded-full bg-slate-950/95 hover:bg-slate-900 text-white border-2 border-sky-400/70 shadow-[0_10px_35px_rgba(14,165,233,0.45)] backdrop-blur-xl"
          title="Abrir Chat con el Agente IA en Telegram (@inbestiga_tesis_bot)"
        >
          <div className="relative w-11 h-11 rounded-full overflow-hidden border border-sky-300 shrink-0">
            <img
              src="/images/landing/telegram-bot-chat.jpg"
              alt="Bot Telegram"
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950 animate-pulse" />
          </div>
          <div className="text-left">
            <div className="text-[10px] font-mono font-bold text-sky-300 flex items-center gap-1">
              <span>TELEGRAM IA</span>
              <span>
                ·{' '}
                {isLoggedStudent && studentProfile
                  ? studentProfile.telegramUsername
                  : '24/7'}
              </span>
            </div>
            <div className="text-xs font-black leading-tight flex items-center gap-1">
              <span>Chatear con el Agente</span>
              <ExternalLink className="w-3 h-3 text-sky-400" />
            </div>
          </div>
        </motion.a>
      </div>
    </div>
  );
}
