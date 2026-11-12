'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Send,
  MessageSquare,
  CreditCard,
  ShieldCheck,
  BarChart3,
  BookOpen,
  Layers,
  CheckCircle2,
  Clock,
  Lock,
  Unlock,
  BellRing,
  Sparkles,
  ExternalLink,
  RefreshCw,
  UserCheck,
  Terminal,
  ArrowRight,
  Wrench,
  Search,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';

const QUICK_PROMPTS = [
  '¿Cuál es mi siguiente cuota y cuándo debería pagar?',
  'Pásame el enlace oficial de Mercado Pago para abonar',
  '¿Quién es mi asesor asignado y cómo coordino mis entregas?',
  'Muéstrame mi cronograma detallado de cuotas',
];

export default function PayersCommandCenterPage() {
  const [selectedOrdenId, setSelectedOrdenId] = useState<number>(42);
  const [searchCliente, setSearchCliente] = useState<string>('');
  const [ordenDetalle, setOrdenDetalle] = useState<any | null>(null);
  const [overview, setOverview] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  // Quick interactive chat on the command center
  const [chatInput, setChatInput] = useState<string>('');
  const [chatSending, setChatSending] = useState<boolean>(false);
  const [lastBotReply, setLastBotReply] = useState<{
    pregunta: string;
    respuesta: string;
    herramientas: string[];
  } | null>(null);

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
    setLastBotReply(null);
    setActionBanner(null);
  }, [selectedOrdenId, cargarOrdenSeleccionada]);

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

  const handleToggleHito = async (numeroCuota: number, estadoActual: string) => {
    setActionBusy(`cuota-${numeroCuota}`);
    setActionBanner(null);
    try {
      if (estadoActual === 'ESPERA_HITO') {
        await api.aprobarHitoCuota(selectedOrdenId, numeroCuota);
        setActionBanner(
          `Cuota #${numeroCuota} habilitada a EXIGIBLE y notificada por Telegram (@inbestiga_tesis_bot).`,
        );
      } else {
        await api.revertirHitoCuota(selectedOrdenId, numeroCuota);
        setActionBanner(
          `Cuota #${numeroCuota} devuelta a ESPERA_HITO (Checkout Mercado Pago bloqueado hasta validación del asesor).`,
        );
      }
      await cargarOrdenSeleccionada(selectedOrdenId);
    } catch (err: any) {
      setActionBanner(`Error: ${err?.message || 'No se pudo actualizar el estado del hito'}`);
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
        `Motor Opción B ejecutado: ${res.recordatoriosEnviados ?? 0} recordatorio(s) a cuotas EXIGIBLE · ${res.escalamientosInternos ?? 0} alerta(s) internas por hito demorado.`,
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
    if (!texto) setChatInput('');
    try {
      const res = await api.enviarMensajePayerAgent(selectedOrdenId, msg);
      setLastBotReply({
        pregunta: msg,
        respuesta: res?.respuesta || 'Sin respuesta',
        herramientas: (res?.herramientasEjecutadas || []).map((h: any) => h.herramienta),
      });
      await cargarOrdenSeleccionada(selectedOrdenId);
    } catch (err: any) {
      setLastBotReply({
        pregunta: msg,
        respuesta: `No se pudo conectar con el agente: ${err?.message}`,
        herramientas: [],
      });
    } finally {
      setChatSending(false);
    }
  };

  const orden = ordenDetalle?.orden;
  const vistaAnalitica = ordenDetalle?.vistaAnalitica;
  const cuotas: any[] = ordenDetalle?.cuotas || [];
  const kpis = overview?.kpis;

  const nombreEstudiante =
    orden?.estudiante_nombre || vistaAnalitica?.estudiante || 'Seleccionando cliente...';
  const codigoOrdenActual =
    orden?.codigo_orden || vistaAnalitica?.codigo_orden || `ORD-2026-${String(selectedOrdenId).padStart(4, '0')}`;
  const universidadActual = vistaAnalitica?.universidad || 'Universidad';
  const carreraActual = vistaAnalitica?.carrera || 'Investigación';

  return (
    <div className="space-y-8 pb-10">
      {/* HERO COMMAND CENTER — ASYMMETRIC 7/5 SPLIT */}
      <section className="relative rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-gradient-to-br from-white via-slate-50/90 to-emerald-50/40 dark:from-slate-900/95 dark:via-slate-950 dark:to-emerald-950/25 p-6 sm:p-8 lg:p-10 shadow-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN (7 COLS): VALUE PROPOSITION, PRIMARY CTAS & LIVE AGENT TESTER */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              <span>FASE 3 DEL EMBUDO COMERCIAL · AGENTE DETERMINÍSTICO + GEMINI 3 FLASH</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-black tracking-tight text-slate-900 dark:text-white leading-[1.12]">
                Agente Autónomo de Cobranza,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-sky-500 dark:from-emerald-400 dark:via-teal-300 dark:to-sky-400">
                  Pasarela Mercado Pago
                </span>{' '}
                y Activación por Hitos
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                Ecosistema dedicado del módulo <strong>PAYERS v2.0</strong> de <strong>INBESTIGA</strong>.
                Gestiona las órdenes de pago transferidas desde LEADS, acredita abonos en tiempo real vía{' '}
                <strong>Mercado Pago Checkout Pro</strong>, asigna al asesor metodológico titular y
                bloquea el cobro de cuotas futuras hasta que el asesor apruebe el entregable académico (<strong>Opción B</strong>).
              </p>
            </div>

            {/* PRIMARY ACTION BAR: TELEGRAM + LIVE CHAT WEB + CHECKOUT MERCADO PAGO (DYNAMIC CLIENT) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <a
                href="https://t.me/inbestiga_tesis_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-[#0088cc] hover:bg-[#0077b5] text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-sky-500/20 transition-all group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Send className="w-4 h-4 shrink-0" />
                  <div className="text-left truncate">
                    <div className="leading-tight">Hablar en Telegram</div>
                    <div className="text-[10px] font-medium text-sky-100 truncate">@inbestiga_tesis_bot</div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform" />
              </a>

              <Link
                href={`/admin/payers/live-chat?orden=${selectedOrdenId}`}
                className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-600/20 transition-all group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <div className="text-left truncate">
                    <div className="leading-tight">Live Chat Web IA</div>
                    <div className="text-[10px] font-medium text-emerald-100 truncate">
                      {nombreEstudiante} ({codigoOrdenActual})
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href={`/checkout/${codigoOrdenActual}`}
                className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg transition-all group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <CreditCard className="w-4 h-4 shrink-0 text-sky-400 dark:text-sky-600" />
                  <div className="text-left truncate">
                    <div className="leading-tight">Checkout Mercado Pago</div>
                    <div className="text-[10px] font-medium text-slate-300 dark:text-slate-600 truncate">
                      Pasarela · {codigoOrdenActual}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {/* QUICK PROMPT TESTER DIRECTLY AGAINST THE PAYERS AGENT FOR ANY SELECTED CLIENT */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
                    Consulta en Vivo al Agente IA PAYERS ({nombreEstudiante} · {codigoOrdenActual})
                  </span>
                </div>
                <Link
                  href={`/admin/payers/live-chat?orden=${selectedOrdenId}`}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                >
                  Abrir consola completa →
                </Link>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={chatSending}
                    onClick={() => handleEnviarPregunta(q)}
                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {q}
                  </button>
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
                  placeholder={`Escribe una consulta como ${nombreEstudiante}...`}
                  className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={chatSending || !chatInput.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold transition-colors cursor-pointer"
                >
                  {chatSending ? 'Consultando...' : 'Preguntar'}
                </button>
              </form>

              {lastBotReply && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>
                      <strong>Consulta:</strong> {lastBotReply.pregunta}
                    </span>
                    {lastBotReply.herramientas.length > 0 && (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        <Wrench className="w-3 h-3" />
                        {lastBotReply.herramientas.join(', ')}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-800 dark:text-slate-100 whitespace-pre-line leading-relaxed font-medium">
                    {lastBotReply.respuesta}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN (5 COLS): MULTI-CLIENT SELECTOR (104 ORDERS) + LIVE INSTALLMENTS & MILESTONES */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 p-5 shadow-lg space-y-4">
            {/* MULTI-CLIENT SELECTOR HEADER */}
            <div className="space-y-2.5 border-b border-slate-200 dark:border-slate-800 pb-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Selector de Cliente / Expediente ({overview?.ordenesDetalle?.length || 104} Órdenes)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => cargarOrdenSeleccionada(selectedOrdenId)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                  title="Refrescar expediente desde SQL Server"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-5 relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchCliente}
                    onChange={(e) => setSearchCliente(e.target.value)}
                    placeholder="Filtrar cliente u orden..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="sm:col-span-7">
                  <select
                    value={selectedOrdenId}
                    onChange={(e) => setSelectedOrdenId(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {ordenesLista.map((o: any) => (
                      <option key={o.id_orden_pago} value={o.id_orden_pago}>
                        {o.codigo_orden} — {o.estudiante} ({o.estado_orden})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {nombreEstudiante} ·{' '}
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {codigoOrdenActual}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {orden?.servicio_nombre || vistaAnalitica?.servicio || 'Servicio Académico'} ·{' '}
                    {universidadActual} ({carreraActual})
                  </p>
                </div>
                <span className="text-[10px] font-mono font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  {orden?.estado || vistaAnalitica?.estado_orden || 'ACTIVO'}
                </span>
              </div>
            </div>

            {/* ADVISOR & FINANCIAL SUMMARY */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 p-2.5">
                <div className="text-[10px] font-semibold uppercase text-slate-500">Comprometido</div>
                <div className="text-sm font-black font-mono text-slate-900 dark:text-white">
                  S/ {Number(orden?.monto_comprometido ?? 0).toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-500/30 p-2.5">
                <div className="text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                  Abonado (MP)
                </div>
                <div className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400">
                  S/ {Number(orden?.monto_cobrado ?? 0).toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-500/30 p-2.5">
                <div className="text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">
                  Saldo Pendiente
                </div>
                <div className="text-sm font-black font-mono text-amber-700 dark:text-amber-400">
                  S/{' '}
                  {Math.max(
                    0,
                    Number(orden?.monto_comprometido ?? 0) - Number(orden?.monto_cobrado ?? 0),
                  ).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300 truncate">
                  Asesor asignado:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {orden?.asesor_nombre || 'Dr. Carlos Alberto Méndez Vargas'}
                  </strong>
                </span>
              </div>
              <Link
                href="/admin/customers"
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
              >
                Bitácora →
              </Link>
            </div>

            {/* INSTALLMENTS SCHEDULE + OPTION B MILESTONE CONTROLS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Cronograma de Cuotas & Control de Hitos ({cuotas.length})
                </span>
                <button
                  type="button"
                  disabled={actionBusy === 'recordatorios'}
                  onClick={handleEjecutarRecordatorios}
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                >
                  <BellRing className="w-3 h-3" />
                  <span>{actionBusy === 'recordatorios' ? 'Ejecutando...' : 'Ejecutar Recordatorios'}</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {cuotas.map((c: any) => {
                  const num = Number(c.numero_cuota);
                  const pagada = c.estado === 'PAGADA';
                  const esperaHito = c.estado === 'ESPERA_HITO';
                  return (
                    <div
                      key={c.cuota_id || num}
                      className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                        pagada
                          ? 'border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20'
                          : esperaHito
                            ? 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60'
                            : 'border-sky-500/40 bg-sky-50/50 dark:bg-sky-950/25'
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
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
                          Condición: {c.condicion} · Vence:{' '}
                          {c.fecha_vencimiento
                            ? new Date(c.fecha_vencimiento).toISOString().slice(0, 10)
                            : 'Por hito'}
                        </p>
                      </div>

                      {!pagada && (
                        <button
                          type="button"
                          disabled={actionBusy === `cuota-${num}`}
                          onClick={() => handleToggleHito(num, c.estado)}
                          className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                            esperaHito
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
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
                              Bloquear Hito
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {actionBanner && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">
                  {actionBanner}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* REAL-TIME R-PAYERS KIMBALL DATA MART KPI STRIP */}
      {kpis && (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              P01 · Conversión Lead→Payer
            </div>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {Number(kpis.P01_tasa_conversion_lead_payer_pct ?? 85.58).toFixed(2)}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Meta ≥ 82.0% (Óptimo)</div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              P02 · Recaudación Efectiva
            </div>
            <div className="text-2xl font-black font-mono text-sky-600 dark:text-sky-400 mt-1">
              {Number(kpis.P02_indice_recaudacion_efectiva_pct ?? 78.4).toFixed(2)}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Cobrado vs Comprometido</div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              P03 · Mediana Horas al Pago
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
              {Number(kpis.P03_mediana_horas_primer_pago ?? 11.5).toFixed(1)} h
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Meta ≤ 18.0 horas</div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              P04 · Recuperación Alertas
            </div>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {Number(kpis.P04_efectividad_recordatorios_pct ?? 64.2).toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Efectividad de cobranza</div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              P05 · Tasa de Mora Activa
            </div>
            <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
              {Number(kpis.P05_tasa_mora_pct ?? 4.8).toFixed(2)}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Umbral crítico ≤ 8.0%</div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Evaluación Agente IA
            </div>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              0.0% Aluc.
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">40/40 casos verificados</div>
          </div>
        </section>
      )}

      {/* BENTO NAVIGATION TO SPECIALIZED MODULES */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href={`/admin/payers/live-chat?orden=${selectedOrdenId}`}
          className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 hover:border-emerald-500/60 transition-all shadow-sm flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
              Simulador & Live Chat Bidireccional
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Conversa en tiempo real con el Agente IA desde la web o sincronizado con Telegram (
              <code>@inbestiga_tesis_bot</code>) para cualquiera de los 104 expedientes.
            </p>
          </div>
          <div className="pt-4 flex items-center gap-1 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
            <span>Abrir Live Chat ({codigoOrdenActual})</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          href="/admin/customers"
          className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 hover:border-amber-500/60 transition-all shadow-sm flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
              Validación de Hitos del Asesor (Opción B)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Bandeja académica de <code>CUSTOMERS</code> donde el asesor registra avances en la bitácora y
              desbloquea cuotas en <code>ESPERA_HITO</code> para su cobro en Mercado Pago.
            </p>
          </div>
          <div className="pt-4 flex items-center gap-1 text-xs font-extrabold text-amber-600 dark:text-amber-400">
            <span>Gestionar Hitos Académicos</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          href="/admin/payers"
          className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 hover:border-sky-500/60 transition-all shadow-sm flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-sky-500 transition-colors">
              Bandeja Operativa de 104 Órdenes
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Explora la cohorte completa de 104 órdenes transferidas desde LEADS, contratos, vouchers OCR en
              bandeja de Caja y simulación de alertas de cobranza (4h, 12h, 24h).
            </p>
          </div>
          <div className="pt-4 flex items-center gap-1 text-xs font-extrabold text-sky-600 dark:text-sky-400">
            <span>Ver 104 Órdenes</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          href="/admin/payers/reporte"
          className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 hover:border-indigo-500/60 transition-all shadow-sm flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-indigo-500 transition-colors">
              Reporte BI R-PAYERS & Evaluación (40 Casos)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Indicadores P01–P06 sobre <code>INBESTIGA_MART</code> (Kimball), embudo financiero, recaudación
              por modalidad y matriz auditable de 40 casos de prueba con 0% alucinación.
            </p>
          </div>
          <div className="pt-4 flex items-center gap-1 text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
            <span>Ver Reporte BI</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </section>
    </div>
  );
}
