'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Send,
  MessageSquare,
  CreditCard,
  CheckCircle2,
  Clock,
  Lock,
  Unlock,
  BellRing,
  ExternalLink,
  RefreshCw,
  UserCheck,
  ArrowRight,
  Wrench,
  Search,
  Bot,
  User,
  Activity,
  FileCheck2,
  Zap,
  Link2,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  AcademicReactiveAssistant,
  ThesisJourneyTrack,
} from '@/components/payers/ThesisInteractiveWidgets';

const QUICK_PROMPTS = [
  '¿Cuál es mi siguiente cuota y cuándo debería pagar?',
  'Pásame el enlace oficial de Mercado Pago para abonar',
  '¿Quién es mi asesor asignado y cómo coordino mis entregas?',
  'Muéstrame mi cronograma detallado de cuotas',
];

const FEATURED_CLIENTS = [
  { id: 42, label: 'Harry Sánchez', tag: '3 Cuotas · MP' },
  { id: 1, label: 'Alessy Tania', tag: '3 Cuotas · Seguimiento' },
  { id: 4, label: 'Orden #0004', tag: 'Contado 100%' },
  { id: 15, label: 'Orden #0015', tag: 'Alerta Cobranza' },
];

type PipelineFocusTarget = 'CRONOGRAMA' | 'CHAT' | 'PASARELA' | 'RUTA_TESIS' | null;

export default function PayersCommandCenterPage() {
  const prefersReducedMotion = useReducedMotion();
  const [selectedOrdenId, setSelectedOrdenId] = useState<number>(42);
  const [searchCliente, setSearchCliente] = useState<string>('');
  const [ordenDetalle, setOrdenDetalle] = useState<any | null>(null);
  const [overview, setOverview] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  // Interactive Pipeline Focus & Thesis Milestone Highlight State
  const [activePipelineStage, setActivePipelineStage] =
    useState<PipelineFocusTarget>(null);
  const [activeCuotaHighlight, setActiveCuotaHighlight] = useState<number | null>(
    null,
  );
  const [celebrateCounter, setCelebrateCounter] = useState<number>(0);

  // Live Chat Stream State
  const [chatInput, setChatInput] = useState<string>('');
  const [chatSending, setChatSending] = useState<boolean>(false);
  const [activePromptChip, setActivePromptChip] = useState<string | null>(null);
  const [recentTools, setRecentTools] = useState<string[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const cargarOverview = useCallback(async () => {
    const ov = await api.getPayersOverview().catch(() => null);
    if (ov) setOverview(ov);
  }, []);

  const cargarOrdenSeleccionada = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const det = await api.getPayerOrden(id).catch(() => null);
      if (det) setOrdenDetalle(det);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarOverview();
  }, [cargarOverview]);

  useEffect(() => {
    cargarOrdenSeleccionada(selectedOrdenId);
    setActionBanner(null);
    setRecentTools([]);
    setActiveCuotaHighlight(null);
  }, [selectedOrdenId, cargarOrdenSeleccionada]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [ordenDetalle?.mensajes, chatSending]);

  const ordenesLista: any[] = useMemo(() => {
    const raw: any[] = overview?.ordenesDetalle || [];
    if (!searchCliente.trim()) return raw;
    const q = searchCliente.toLowerCase();
    return raw.filter(
      (o) =>
        String(o.estudiante || '').toLowerCase().includes(q) ||
        String(o.codigo_orden || '').toLowerCase().includes(q) ||
        String(o.servicio || '').toLowerCase().includes(q) ||
        String(o.universidad || '').toLowerCase().includes(q),
    );
  }, [overview, searchCliente]);

  const handleFocusSection = (
    stage: PipelineFocusTarget,
    elementId: string,
  ) => {
    setActivePipelineStage((prev) => (prev === stage ? null : stage));
    if (typeof document !== 'undefined') {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'nearest',
        });
      }
    }
  };

  const handleToggleHito = async (numeroCuota: number, estadoActual: string) => {
    setActionBusy(`cuota-${numeroCuota}`);
    setActionBanner(null);
    try {
      if (estadoActual === 'ESPERA_HITO') {
        await api.aprobarHitoCuota(selectedOrdenId, numeroCuota);
        setCelebrateCounter((c) => c + 1);
        setActionBanner(
          `Hito académico validado: Cuota #${numeroCuota} habilitada a EXIGIBLE y notificada por Telegram.`,
        );
      } else {
        await api.revertirHitoCuota(selectedOrdenId, numeroCuota);
        setActionBanner(
          `Cuota #${numeroCuota} en ESPERA_HITO: Checkout Mercado Pago bloqueado hasta validación del asesor.`,
        );
      }
      await cargarOrdenSeleccionada(selectedOrdenId);
    } catch (err: any) {
      setActionBanner(
        `Error: ${err?.message || 'No se pudo actualizar el estado del hito'}`,
      );
    } finally {
      setActionBusy(null);
    }
  };

  const handleEjecutarRecordatorios = async () => {
    setActionBusy('recordatorios');
    setActionBanner(null);
    try {
      const res = await api.ejecutarRecordatoriosCuotas();
      setActionBanner(
        `Motor Opción B: ${res.recordatoriosEnviados ?? 0} recordatorio(s) a cuotas EXIGIBLE · ${res.escalamientosInternos ?? 0} alerta(s) internas por hito pendiente.`,
      );
      await cargarOrdenSeleccionada(selectedOrdenId);
    } catch (err: any) {
      setActionBanner(`Error al ejecutar recordatorios: ${err?.message}`);
    } finally {
      setActionBusy(null);
    }
  };

  const handleEnviarPregunta = async (texto?: string) => {
    const msg = (texto ?? chatInput).trim();
    if (!msg || chatSending) return;
    setChatSending(true);
    if (texto) {
      setActivePromptChip(texto);
    } else {
      setChatInput('');
    }
    try {
      const res = await api.enviarMensajePayerAgent(selectedOrdenId, msg);
      const tools = (res?.herramientasEjecutadas || []).map(
        (h: any) => h.herramienta,
      );
      setRecentTools(tools);
      await cargarOrdenSeleccionada(selectedOrdenId);
    } catch (err: any) {
      setActionBanner(`Error consultando al agente: ${err?.message}`);
    } finally {
      setChatSending(false);
      setActivePromptChip(null);
    }
  };

  const orden = ordenDetalle?.orden;
  const vistaAnalitica = ordenDetalle?.vistaAnalitica;
  const cuotas: any[] = ordenDetalle?.cuotas || [];
  const mensajes: any[] = (ordenDetalle?.mensajes || []).slice(-8);
  const pagosConfirmados: any[] = (ordenDetalle?.pagos || []).filter(
    (p: any) => p.estado === 'CONFIRMADO',
  );

  const nombreEstudiante =
    orden?.estudiante_nombre ||
    vistaAnalitica?.estudiante ||
    'Cargando expediente...';
  const codigoOrdenActual =
    orden?.codigo_orden ||
    vistaAnalitica?.codigo_orden ||
    `ORD-2026-${String(selectedOrdenId).padStart(4, '0')}`;
  const universidadActual = vistaAnalitica?.universidad || 'UNT';
  const carreraActual = vistaAnalitica?.carrera || 'Investigación';

  // Cálculos dinámicos para la barra y anillo de progreso animado
  const montoComprometido = Number(orden?.monto_comprometido ?? 1620);
  const montoCobrado = Number(orden?.monto_cobrado ?? 0);
  const saldoPendiente = Math.max(0, montoComprometido - montoCobrado);
  const pctCobrado =
    montoComprometido > 0
      ? Math.min(100, Math.round((montoCobrado / montoComprometido) * 100))
      : 0;

  const montoExigibleHoy = cuotas
    .filter((c) =>
      ['EXIGIBLE', 'ENLACE_ENVIADO', 'VENCIDA', 'POR_VERIFICAR'].includes(
        c.estado,
      ),
    )
    .reduce((acc, c) => acc + Number(c.monto_programado || 0), 0);
  const montoEsperaHito = cuotas
    .filter((c) => c.estado === 'ESPERA_HITO')
    .reduce((acc, c) => acc + Number(c.monto_programado || 0), 0);

  const pctExigible =
    montoComprometido > 0
      ? Math.min(
          100 - pctCobrado,
          Math.round((montoExigibleHoy / montoComprometido) * 100),
        )
      : 0;
  const pctEsperaHito = Math.max(0, 100 - pctCobrado - pctExigible);

  // Anillo SVG (radio 36 -> circunferencia = 226.2)
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (pctCobrado / 100) * circumference;

  const tienePagoConfirmado = pagosConfirmados.length > 0 || montoCobrado > 0;
  const tieneCuotaActivaOPagada =
    tienePagoConfirmado ||
    cuotas.some((c) =>
      ['EXIGIBLE', 'ENLACE_ENVIADO', 'POR_VERIFICAR', 'PAGADA'].includes(
        c.estado,
      ),
    );
  const siguienteCuota = cuotas.find(
    (c) => c.estado !== 'PAGADA' && c.estado !== 'ANULADA',
  );

  // Conectores vivos entre las 4 etapas del pipeline según el estado real de la orden
  const connector1Active = Boolean(orden || cuotas.length > 0);
  const connector2Active = tieneCuotaActivaOPagada;
  const connector3Active = tienePagoConfirmado;

  return (
    <div className="relative space-y-6 pb-8">
      {/* =====================================================================
          FONDO ATMOSFÉRICO ANIMADO (AURORA + MALLA DE PRECISIÓN)
          ===================================================================== */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[520px] h-[520px] rounded-full bg-emerald-500/10 dark:bg-emerald-500/12 blur-[130px] animate-aurora" />
        <div
          className="absolute top-1/3 -right-24 w-[460px] h-[460px] rounded-full bg-sky-500/10 dark:bg-sky-500/12 blur-[130px] animate-aurora"
          style={{ animationDelay: '-5s' }}
        />
        <div className="absolute inset-0 architectural-grid opacity-60" />
      </div>

      {/* =====================================================================
          BARRA SUPERIOR DE TELEMETRÍA & PIPELINE VIVO DE 4 NODOS (CON CONECTORES SVG Y PARTÍCULAS)
          ===================================================================== */}
      <section className="glass-panel rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/90 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200/70 dark:border-slate-800/80">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-extrabold tracking-wider uppercase">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>
                MOTOR AUTÓNOMO PAYERS v2.0 · GEMINI 3 FLASH + 11 TOOLS DETERMINÍSTICAS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Orquestador de Cobranza,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400">
                Mercado Pago Checkout Pro
              </span>{' '}
              y Hitos Académicos
            </h1>
          </div>

          {/* Botones de Acción Directa con Efecto Shimmer */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href="https://t.me/inbestiga_tesis_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="shimmer-btn inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-extrabold shadow-lg shadow-sky-500/25 transition-all hover:-translate-y-0.5"
            >
              <Send className="w-4 h-4" />
              <div>
                <div className="leading-none">Telegram Bot</div>
                <div className="text-[10px] font-normal text-sky-100 mt-0.5">
                  @inbestiga_tesis_bot
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>

            <Link
              href={`/checkout/${codigoOrdenActual}`}
              className="shimmer-btn inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/25 transition-all hover:-translate-y-0.5"
            >
              <CreditCard className="w-4 h-4" />
              <div>
                <div className="leading-none">Abrir Pasarela Oficial</div>
                <div className="text-[10px] font-mono text-emerald-100 mt-0.5">
                  Mercado Pago · {codigoOrdenActual}
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* PIPELINE INTERACTIVO DE 4 ETAPAS CON CONECTORES SVG Y PARTÍCULAS LUMINOSAS */}
        <div className="pt-5 relative">
          {/* Conectores SVG en escritorio (visibles en lg) entre los 4 nodos */}
          <svg
            viewBox="0 0 1200 60"
            preserveAspectRatio="none"
            className="hidden lg:block absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-14 pointer-events-none z-0 overflow-visible"
          >
            {/* Conector 1 -> 2 (Handoff Leads a Agente Cobranza) */}
            <line
              x1="275"
              y1="30"
              x2="315"
              y2="30"
              stroke={connector1Active ? '#10b981' : '#64748b'}
              strokeWidth="2.5"
              strokeDasharray="4 5"
              className={connector1Active ? 'animate-dash-flow' : 'opacity-30'}
            />
            {connector1Active && !prefersReducedMotion && (
              <motion.circle
                cx="275"
                cy="30"
                r="4"
                fill="#10b981"
                animate={{ cx: [275, 315], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
              />
            )}

            {/* Conector 2 -> 3 (Agente Cobranza a Mercado Pago) */}
            <line
              x1="575"
              y1="30"
              x2="615"
              y2="30"
              stroke={connector2Active ? '#0ea5e9' : '#64748b'}
              strokeWidth="2.5"
              strokeDasharray="4 5"
              className={connector2Active ? 'animate-dash-flow' : 'opacity-30'}
            />
            {connector2Active && !prefersReducedMotion && (
              <motion.circle
                cx="575"
                cy="30"
                r="4"
                fill="#0ea5e9"
                animate={{ cx: [575, 615], opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: 0.35,
                }}
              />
            )}

            {/* Conector 3 -> 4 (Mercado Pago a Hitos & Asesor) */}
            <line
              x1="875"
              y1="30"
              x2="915"
              y2="30"
              stroke={connector3Active ? '#a855f7' : '#64748b'}
              strokeWidth="2.5"
              strokeDasharray="4 5"
              className={connector3Active ? 'animate-dash-flow' : 'opacity-30'}
            />
            {connector3Active && !prefersReducedMotion && (
              <motion.circle
                cx="875"
                cy="30"
                r="4"
                fill="#a855f7"
                animate={{ cx: [875, 915], opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: 0.7,
                }}
              />
            )}
          </svg>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
            {/* Etapa 1: Traspaso LEADS */}
            <motion.button
              type="button"
              whileHover={prefersReducedMotion ? undefined : { y: -2 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              onClick={() =>
                handleFocusSection('CRONOGRAMA', 'seccion-cronograma')
              }
              className={`text-left relative rounded-2xl border p-3.5 flex items-center gap-3 transition-all cursor-pointer ${
                activePipelineStage === 'CRONOGRAMA'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-950/35'
                  : 'border-emerald-500/35 bg-emerald-500/5 dark:bg-emerald-950/20 hover:border-emerald-500/70'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-emerald-600 dark:text-emerald-400">
                    01 · HANDOFF LEADS
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    VALIDADO
                  </span>
                </div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                  Contrato {orden?.codigo_contrato || 'CTR-2026'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Precio congelado: S/ {montoComprometido.toFixed(2)}
                </div>
              </div>
            </motion.button>

            {/* Etapa 2: Cronograma & Agente IA */}
            <motion.button
              type="button"
              whileHover={prefersReducedMotion ? undefined : { y: -2 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              onClick={() => handleFocusSection('CHAT', 'seccion-chat')}
              className={`text-left relative rounded-2xl border p-3.5 flex items-center gap-3 transition-all cursor-pointer ${
                activePipelineStage === 'CHAT'
                  ? 'border-sky-500 ring-2 ring-sky-500/40 bg-sky-500/10 dark:bg-sky-950/35'
                  : 'border-sky-500/35 bg-sky-500/5 dark:bg-sky-950/20 hover:border-sky-500/70'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-sky-600 dark:text-sky-400">
                    02 · AGENTE COBRANZA
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300">
                    {cuotas.length} CUOTAS
                  </span>
                </div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                  {orden?.modalidad_nombre || `${cuotas.length} Cuota(s)`}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {siguienteCuota
                    ? `Próx: Cuota #${siguienteCuota.numero_cuota} (${siguienteCuota.estado})`
                    : '100% Liquidado'}
                </div>
              </div>
            </motion.button>

            {/* Etapa 3: Pasarela Mercado Pago */}
            <motion.button
              type="button"
              whileHover={prefersReducedMotion ? undefined : { y: -2 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              onClick={() => handleFocusSection('PASARELA', 'seccion-pasarela')}
              className={`text-left relative rounded-2xl border p-3.5 flex items-center gap-3 transition-all cursor-pointer ${
                activePipelineStage === 'PASARELA'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-950/35'
                  : tienePagoConfirmado
                    ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20 hover:border-emerald-500/70'
                    : 'border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20 hover:border-amber-500/70'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  tienePagoConfirmado
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                }`}
              >
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400">
                    03 · MERCADO PAGO
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      tienePagoConfirmado
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {tienePagoConfirmado ? 'ACREDITADO' : 'PENDIENTE'}
                  </span>
                </div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                  Abonado: S/ {montoCobrado.toFixed(2)} ({pctCobrado}%)
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {pagosConfirmados[0]?.referencia
                    ? `Ref: ${pagosConfirmados[0].referencia}`
                    : 'Esperando confirmación Webhook'}
                </div>
              </div>
            </motion.button>

            {/* Etapa 4: Activación & Hitos del Asesor */}
            <motion.button
              type="button"
              whileHover={prefersReducedMotion ? undefined : { y: -2 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              onClick={() =>
                handleFocusSection('RUTA_TESIS', 'seccion-ruta-tesis')
              }
              className={`text-left relative rounded-2xl border p-3.5 flex items-center gap-3 transition-all cursor-pointer ${
                activePipelineStage === 'RUTA_TESIS'
                  ? 'border-purple-500 ring-2 ring-purple-500/40 bg-purple-500/10 dark:bg-purple-950/35'
                  : tienePagoConfirmado
                    ? 'border-purple-500/40 bg-purple-500/5 dark:bg-purple-950/20 hover:border-purple-500/70'
                    : 'border-slate-300 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/40 opacity-85 hover:opacity-100'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-purple-600 dark:text-purple-400">
                    04 · HITOS & ASESOR
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300">
                    OPCIÓN B
                  </span>
                </div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                  {orden?.asesor_nombre || 'Dr. Carlos Alberto Méndez Vargas'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {siguienteCuota?.estado === 'ESPERA_HITO'
                    ? `Cuota #${siguienteCuota.numero_cuota} bloqueada por hito`
                    : 'Cuota habilitada para cobro'}
                </div>
              </div>
            </motion.button>
          </div>
        </div>
      </section>

      {/* =====================================================================
          FEATURE 1: RUTA INTERACTIVA DE TESIS ("CAMINO A LA SUSTENTACIÓN")
          ===================================================================== */}
      <section id="seccion-ruta-tesis">
        <ThesisJourneyTrack
          cuotas={cuotas}
          ordenDetalle={ordenDetalle}
          actionBusy={actionBusy}
          onToggleHito={handleToggleHito}
          activeCuotaHighlight={activeCuotaHighlight}
          onSelectCuotaHighlight={setActiveCuotaHighlight}
          isSectionFocused={activePipelineStage === 'RUTA_TESIS'}
          onTriggerCelebration={() => setCelebrateCounter((c) => c + 1)}
        />
      </section>

      {/* =====================================================================
          WORKSPACE INTERACTIVO EN VIVO (7 COLS CONSOLA CHAT IA / 5 COLS SWITCHBOARD FINANCIERO)
          ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* COLUMNA IZQUIERDA (7 COLS): STREAM CONVERSACIONAL EN VIVO CON EL AGENTE IA + ASISTENTE ACADÉMICO REACTIVO */}
        <div
          id="seccion-chat"
          className={`lg:col-span-7 glass-panel rounded-3xl border flex flex-col justify-between overflow-hidden transition-all duration-300 ${
            activePipelineStage === 'CHAT'
              ? 'border-sky-500 ring-2 ring-sky-500/35 shadow-lg shadow-sky-500/10'
              : 'border-slate-200/80 dark:border-slate-800/90'
          }`}
        >
          {/* Header de la Consola del Agente + Asistente Académico Reactivo (Feature 2) */}
          <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 animate-pulse-glow">
                  <Bot className="w-5 h-5" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Stream Bidireccional del Agente IA PAYERS
                  </h2>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    Sincronizado con Telegram
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cliente activo:{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {nombreEstudiante}
                  </strong>{' '}
                  ({codigoOrdenActual})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Feature 2: Asistente Académico Reactivo (Tesis / Birrete / Pluma viva) */}
              <AcademicReactiveAssistant
                isThinking={chatSending}
                celebrateTrigger={celebrateCounter}
                hasConfirmedPayment={tienePagoConfirmado}
                studentName={nombreEstudiante.split(' ')[0]}
                compact
              />

              <Link
                href={`/admin/payers/live-chat?orden=${selectedOrdenId}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                <span>Pantalla Completa</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Historial de Mensajes en Vivo (con burbujas animadas) */}
          <div
            ref={chatScrollRef}
            className="flex-1 p-5 space-y-3.5 overflow-y-auto max-h-[370px] min-h-[300px] bg-gradient-to-b from-transparent to-slate-50/40 dark:to-slate-950/40"
          >
            {mensajes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400 space-y-2">
                <Bot className="w-8 h-8 text-emerald-500/60 animate-float-slow" />
                <p className="text-xs font-semibold">
                  No hay mensajes previos en esta orden. Selecciona un prompt rápido abajo para iniciar la conversación.
                </p>
              </div>
            ) : (
              mensajes.map((m: any, idx: number) => {
                const esCliente =
                  m.emisor === 'ESTUDIANTE' || m.emisor === 'CLIENTE';
                return (
                  <div
                    key={m.mensaje_id || idx}
                    className={`flex items-start gap-2.5 animate-message-pop ${
                      esCliente ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {!esCliente && (
                      <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-xs ${
                        esCliente
                          ? 'bg-emerald-600 text-white rounded-br-sm'
                          : 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-75 font-mono">
                        <span>
                          {esCliente ? nombreEstudiante : 'Agente IA PAYERS'}
                        </span>
                        <span>
                          {m.fecha_hora
                            ? new Date(m.fecha_hora).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Ahora'}
                        </span>
                      </div>
                      <p className="whitespace-pre-line">{m.contenido}</p>
                    </div>

                    {esCliente && (
                      <div className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Chip de prompt rápido que viaja con transición física de resorte al stream */}
            <AnimatePresence>
              {activePromptChip && (
                <motion.div
                  layoutId={`prompt-${activePromptChip}`}
                  initial={{ opacity: 0, y: 18, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="flex justify-end"
                >
                  <div className="rounded-2xl rounded-br-sm bg-emerald-600/90 text-white px-4 py-2 text-xs font-semibold shadow-md">
                    {activePromptChip}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {chatSending && (
              <div className="flex items-center gap-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Activity className="w-4 h-4 animate-spin" />
                </div>
                <span>
                  Ejecutando herramientas determinísticas y consultando contexto SQL Server...
                </span>
              </div>
            )}
          </div>

          {/* Barra Inferior: Bloques Encastrables de Tools + Prompts Rápidos con Spring + Input */}
          <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 space-y-3">
            {/* Bloques Encastrables de Herramientas (Interlocking Tool Blocks) */}
            <AnimatePresence>
              {recentTools.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="flex items-center gap-1.5 flex-wrap text-[11px]"
                >
                  <span className="text-slate-400 font-semibold mr-1">
                    Cadena de Tools ejecutadas:
                  </span>
                  {recentTools.map((t, idx) => (
                    <motion.div
                      key={`${t}-${idx}`}
                      initial={
                        prefersReducedMotion
                          ? { opacity: 1 }
                          : { opacity: 0, x: -12, scale: 0.88 }
                      }
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 280,
                        damping: 18,
                        delay: idx * 0.08,
                      }}
                      className="inline-flex items-center gap-1"
                    >
                      {idx > 0 && (
                        <Link2 className="w-3 h-3 text-emerald-500 -mx-0.5" />
                      )}
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35 shadow-2xs">
                        <Wrench className="w-3 h-3" />
                        {t}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chips de Prompts Rápidos con Físicas de Resorte */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((q) => (
                <motion.button
                  key={q}
                  layoutId={activePromptChip === q ? undefined : `prompt-${q}`}
                  type="button"
                  whileHover={
                    prefersReducedMotion ? undefined : { scale: 1.03, y: -1 }
                  }
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                  disabled={chatSending}
                  onClick={() => handleEnviarPregunta(q)}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-emerald-500/15 hover:text-emerald-700 dark:bg-slate-800/90 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-300 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {q}
                </motion.button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEnviarPregunta();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={`Escribe un mensaje como ${nombreEstudiante} (${codigoOrdenActual})...`}
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              <button
                type="submit"
                disabled={chatSending || !chatInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-600/20"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{chatSending ? 'Procesando...' : 'Enviar'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* COLUMNA DERECHA (5 COLS): SWITCHBOARD MULTI-CLIENTE + ANILLO DE PROGRESO ANIMADO + HITOS */}
        <div className="lg:col-span-5 glass-panel rounded-3xl border border-slate-200/80 dark:border-slate-800/90 p-5 flex flex-col justify-between space-y-5">
          {/* Selector Rápido de Escenarios + Buscador de 104 Órdenes */}
          <div className="space-y-3 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Conmutador de Expedientes ({overview?.ordenesDetalle?.length || 104} Clientes)
              </span>
              <button
                type="button"
                onClick={() => cargarOrdenSeleccionada(selectedOrdenId)}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
                title="Sincronizar expediente en tiempo real"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    loading ? 'animate-spin text-emerald-500' : ''
                  }`}
                />
              </button>
            </div>

            {/* Píldoras de cambio rápido para presentación */}
            <div className="grid grid-cols-2 gap-1.5">
              {FEATURED_CLIENTS.map((fc) => {
                const active = selectedOrdenId === fc.id;
                return (
                  <button
                    key={fc.id}
                    type="button"
                    onClick={() => setSelectedOrdenId(fc.id)}
                    className={`px-3 py-1.5 rounded-xl text-left transition-all cursor-pointer border ${
                      active
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-800 dark:text-emerald-200 shadow-xs'
                        : 'bg-slate-50/80 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {fc.label}
                    </div>
                    <div className="text-[10px] font-mono opacity-80 truncate">
                      {fc.tag}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Buscador + Selector de las 104 órdenes */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-5 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchCliente}
                  onChange={(e) => setSearchCliente(e.target.value)}
                  placeholder="Filtrar 104 órdenes..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="sm:col-span-7">
                <select
                  value={selectedOrdenId}
                  onChange={(e) => setSelectedOrdenId(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {ordenesLista.map((o: any) => (
                    <option key={o.id_orden_pago} value={o.id_orden_pago}>
                      {o.codigo_orden} — {o.estudiante} ({o.estado_orden})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ANILLO ANIMADO DE RECAUDACIÓN + DESGLOSE FINANCIERO (#seccion-pasarela) */}
          <div
            id="seccion-pasarela"
            className={`rounded-2xl border p-4 space-y-3.5 transition-all duration-300 ${
              activePipelineStage === 'PASARELA'
                ? 'border-emerald-500 ring-2 ring-emerald-500/35 bg-emerald-500/5 dark:bg-emerald-950/30'
                : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60'
            }`}
          >
            <div className="flex items-center gap-4">
              {/* Anillo SVG Animado */}
              <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 84 84">
                  <circle
                    cx="42"
                    cy="42"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="7"
                    fill="transparent"
                    className="text-slate-200 dark:text-slate-800"
                  />
                  <circle
                    cx="42"
                    cy="42"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="7"
                    strokeLinecap="round"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="text-emerald-500 transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                    {pctCobrado}%
                  </span>
                  <span className="text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                    Cobrado
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                    {nombreEstudiante}
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    {orden?.estado || vistaAnalitica?.estado_orden || 'ACTIVO'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {orden?.servicio_nombre ||
                    vistaAnalitica?.servicio ||
                    'Proyecto de Tesis'}{' '}
                  · {universidadActual} ({carreraActual})
                </p>

                <div className="grid grid-cols-3 gap-2 pt-1 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">
                      Total
                    </span>
                    <strong className="text-slate-900 dark:text-white">
                      S/ {montoComprometido.toFixed(0)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-500 block font-sans">
                      Abonado
                    </span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      S/ {montoCobrado.toFixed(0)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-500 block font-sans">
                      Pendiente
                    </span>
                    <strong className="text-amber-600 dark:text-amber-400">
                      S/ {saldoPendiente.toFixed(0)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Barra de Progreso Financiero Segmentada con Transición Suave */}
            <div className="space-y-1.5">
              <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                <div
                  style={{ width: `${pctCobrado}%` }}
                  className="bg-emerald-500 transition-all duration-700 ease-out"
                  title={`Cobrado: ${pctCobrado}%`}
                />
                <div
                  style={{ width: `${pctExigible}%` }}
                  className="bg-sky-500 transition-all duration-700 ease-out"
                  title={`Exigible Hoy: ${pctExigible}%`}
                />
                <div
                  style={{ width: `${pctEsperaHito}%` }}
                  className="bg-amber-500/70 transition-all duration-700 ease-out"
                  title={`Bloqueado en Espera de Hito: ${pctEsperaHito}%`}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Pagado ({pctCobrado}%)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-sky-500" /> Exigible ({pctExigible}%)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Espera Hito ({pctEsperaHito}%)
                </span>
              </div>
            </div>
          </div>

          {/* LÍNEA DE TIEMPO INTERACTIVA DE CUOTAS & CONTROL DE HITOS (OPCIÓN B) (#seccion-cronograma) */}
          <div
            id="seccion-cronograma"
            className={`space-y-2.5 flex-1 rounded-2xl transition-all duration-300 ${
              activePipelineStage === 'CRONOGRAMA'
                ? 'p-2.5 ring-2 ring-emerald-500/35 bg-emerald-500/5'
                : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Línea de Tiempo de Cuotas ({cuotas.length})
              </span>
              <button
                type="button"
                disabled={actionBusy === 'recordatorios'}
                onClick={handleEjecutarRecordatorios}
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-all cursor-pointer"
              >
                <BellRing className="w-3 h-3" />
                <span>
                  {actionBusy === 'recordatorios'
                    ? 'Barrido...'
                    : 'Barrido Recordatorios'}
                </span>
              </button>
            </div>

            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {cuotas.map((c: any) => {
                const num = Number(c.numero_cuota);
                const pagada = c.estado === 'PAGADA';
                const esperaHito = c.estado === 'ESPERA_HITO';
                const isHighlighted = activeCuotaHighlight === num;
                return (
                  <div
                    key={c.cuota_id || num}
                    onMouseEnter={() => setActiveCuotaHighlight(num)}
                    className={`rounded-2xl border p-3 flex items-center justify-between gap-3 transition-all ${
                      isHighlighted
                        ? 'ring-2 ring-emerald-500/50 border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/35'
                        : pagada
                          ? 'border-emerald-500/35 bg-emerald-500/5 dark:bg-emerald-950/20'
                          : esperaHito
                            ? 'border-slate-200/90 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70'
                            : 'border-sky-500/45 bg-sky-500/5 dark:bg-sky-950/25 shadow-xs'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          Cuota #{num} ({Number(c.porcentaje || 0)}%)
                        </span>
                        <span className="font-mono text-xs font-extrabold text-slate-800 dark:text-slate-200">
                          S/ {Number(c.monto_programado).toFixed(2)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            pagada
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : esperaHito
                                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                : 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                          }`}
                        >
                          {pagada ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> PAGADA
                            </>
                          ) : esperaHito ? (
                            <>
                              <Lock className="w-3 h-3" /> ESPERA_HITO
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" /> {c.estado}
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {c.condicion} · Vence:{' '}
                        {c.fecha_vencimiento
                          ? new Date(c.fecha_vencimiento)
                              .toISOString()
                              .slice(0, 10)
                          : 'Por hito académico'}
                      </p>
                    </div>

                    {!pagada && (
                      <button
                        type="button"
                        disabled={actionBusy === `cuota-${num}`}
                        onClick={() => handleToggleHito(num, c.estado)}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                          esperaHito
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/25'
                            : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {esperaHito ? (
                          <>
                            <Unlock className="w-3 h-3" />
                            Aprobar Hito
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3" />
                            Bloquear
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {actionBanner && (
              <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 animate-message-pop">
                {actionBanner}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
