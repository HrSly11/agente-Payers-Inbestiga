'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare,
  Bot,
  User,
  Send,
  Sparkles,
  CreditCard,
  ArrowRight,
  RefreshCw,
  ChevronLeft,
  Search,
  Clock,
  Layers,
  AlertTriangle,
  Zap,
  CheckCircle2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { SCENARIOS_PRUEBA } from '@/components/payers/PayersModule';

const FILTROS = [
  { id: 'PENDIENTES', label: 'Pendientes' },
  { id: 'PAGADA', label: 'Pagadas' },
  { id: 'TODAS', label: 'Todas' },
];

function estadoBadge(estado: string) {
  if (estado === 'PAGADA')
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
  if (estado === 'PARCIAL') return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-sky-300';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
}

function PayersLiveChatContent() {
  const searchParams = useSearchParams();
  const ordenParam = searchParams.get('orden');

  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('PENDIENTES');
  const [activeId, setActiveId] = useState<number | null>(ordenParam ? Number(ordenParam) : null);
  const [detalle, setDetalle] = useState<any>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [lastGuardrails, setLastGuardrails] = useState<string[]>([]);
  const [lastTools, setLastTools] = useState<any[]>([]);
  const [showMobileList, setShowMobileList] = useState(!ordenParam);
  const endRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  const cargarOrdenes = async () => {
    try {
      const res = await api.getPayersOverview();
      const list: any[] = res?.ordenesDetalle || [];
      setOrdenes(list);
      if (activeId == null && list.length > 0) {
        const first = list.find((o) => o.estado_orden !== 'PAGADA') || list[0];
        setActiveId(first.id_orden_pago);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const cargarDetalle = async (id: number) => {
    try {
      setDetalle(await api.getPayerOrden(id));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    cargarOrdenes();
  }, []);

  useEffect(() => {
    if (activeId != null) {
      setLastGuardrails([]);
      setLastTools([]);
      cargarDetalle(activeId);
    }
  }, [activeId]);

  // Refresco automático para ver las respuestas reales que llegan por Telegram/WhatsApp
  useEffect(() => {
    if (activeId == null) return;
    const t = setInterval(() => {
      if (!sendingRef.current) cargarDetalle(activeId);
    }, 6000);
    return () => clearInterval(t);
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detalle]);

  const handleSelect = (id: number) => {
    setActiveId(id);
    setShowMobileList(false);
  };

  const handleEnviar = async (texto?: string) => {
    const msg = (texto ?? input).trim();
    if (!msg || sending || activeId == null) return;
    setSending(true);
    sendingRef.current = true;
    if (!texto) setInput('');
    try {
      const res = await api.enviarMensajePayerAgent(activeId, msg);
      setDetalle(res.estadoOrden);
      setLastGuardrails(res.guardrailsActivados || []);
      setLastTools(res.herramientasEjecutadas || []);
      cargarOrdenes();
    } catch (err: any) {
      alert(`Error en Agente IA PAYERS: ${err.message}`);
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  };

  const handleAlerta = async (etapa: '4h' | '12h' | '24h') => {
    if (activeId == null) return;
    setBusyAction(true);
    try {
      const res = await api.simularAlertaEtapaPayers(activeId, etapa);
      setBanner(`Alerta de ${etapa.toUpperCase()} disparada a ${res.estudiante} (${res.secuencia}).`);
      await cargarDetalle(activeId);
    } catch (err: any) {
      alert(`Error al disparar alerta: ${err.message}`);
    } finally {
      setBusyAction(false);
    }
  };

  const handleAprobarHito = async (numeroCuota: number) => {
    if (activeId == null) return;
    setBusyAction(true);
    try {
      const res = await api.aprobarHitoCuota(activeId, numeroCuota);
      setBanner(
        `Hito aprobado: Cuota #${res.cuota} (S/ ${Number(res.monto).toFixed(2)}) habilitada como EXIGIBLE y notificada por Telegram.`,
      );
      await cargarDetalle(activeId);
      await cargarOrdenes();
    } catch (err: any) {
      alert(`Error aprobando hito: ${err.message}`);
    } finally {
      setBusyAction(false);
    }
  };

  const handleWebhook = async () => {
    if (activeId == null) return;
    setBusyAction(true);
    try {
      await api.simularWebhookPayers(activeId, 'Yape');
      setBanner('Webhook de pasarela simulado: la cuota fue acreditada.');
      await cargarDetalle(activeId);
      await cargarOrdenes();
    } catch (err: any) {
      alert(`Error simulando webhook: ${err.message}`);
    } finally {
      setBusyAction(false);
    }
  };

  const filtradas = ordenes
    .filter((o) => {
      if (filtro === 'PENDIENTES' && o.estado_orden === 'PAGADA') return false;
      if (filtro === 'PAGADA' && o.estado_orden !== 'PAGADA') return false;
      const q = search.toLowerCase();
      return (
        !q ||
        o.codigo_orden?.toLowerCase().includes(q) ||
        o.estudiante?.toLowerCase().includes(q) ||
        o.universidad?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => Number(a.estado_orden === 'PAGADA') - Number(b.estado_orden === 'PAGADA'));

  const orden = detalle?.orden;
  const mensajes: any[] = detalle?.mensajes || [];
  const cuotas: any[] = detalle?.cuotas || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-heading text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-sky-400 shadow-sm">
                <MessageSquare className="w-5 h-5" />
              </span>
              <span>Live Chat de Cobranza (PAYERS)</span>
            </h1>
            <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-500/30 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Telegram / WhatsApp Bidireccional</span>
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 break-words">
            Retomá la conversación de cobranza con cualquier tesista que ya acordó su pago en LEADS.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start flex-wrap">
          <Link
            href="/admin/payers"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <span>Órdenes de Pago</span>
          </Link>
          <button
            onClick={() => activeId != null && cargarDetalle(activeId)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar Chat</span>
          </button>
        </div>
      </div>

      {/* Main Chat Interface Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 min-h-[680px] lg:h-[720px]">
        {/* Sidebar: Órdenes */}
        <div
          className={`glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col space-y-3 overflow-hidden shadow-sm ${
            !showMobileList ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Conversaciones de Cobranza
            </h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
              {filtradas.length}
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tesista u orden..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                  filtro === f.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filtradas.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                Sin conversaciones para este filtro.
              </p>
            ) : (
              filtradas.map((o) => {
                const isSelected = o.id_orden_pago === activeId;
                return (
                  <button
                    key={o.id_orden_pago}
                    onClick={() => handleSelect(o.id_orden_pago)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer min-w-0 ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500/60 shadow-xs'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {o.estudiante}
                      </span>
                      <span className="text-[10px] font-extrabold text-sky-600 dark:text-sky-400 shrink-0 font-mono">
                        S/ {Number(o.monto_comprometido).toFixed(0)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {o.codigo_orden} • {o.modalidad_pago}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] gap-1">
                      <span
                        className={`px-1.5 py-0.5 rounded font-semibold uppercase truncate ${estadoBadge(o.estado_orden)}`}
                      >
                        {o.estado_orden}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 shrink-0 truncate">
                        {o.universidad}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat */}
        <div
          className={`lg:col-span-3 glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden shadow-lg ${
            showMobileList ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {orden ? (
            <>
              {/* Chat Top Banner */}
              <div className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setShowMobileList(true)}
                    className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0"
                    title="Volver a la lista"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-700 to-sky-500 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-xs">
                    {orden.estudiante_nombre?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 truncate">
                      <span className="truncate">{orden.estudiante_nombre}</span>
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono shrink-0">
                        {orden.estudiante_telefono}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {orden.carrera} • {orden.universidad} • {orden.codigo_orden}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden sm:inline">
                    Etapa:
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-black tracking-wider uppercase bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30">
                    {orden.estado}
                  </span>
                </div>
              </div>

              {/* Expediente + acciones de demo */}
              <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                  <span className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">
                    Cuotas:
                  </span>
                  {cuotas.map((c: any) => (
                    <span
                      key={c.cuota_id}
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-semibold ${estadoBadge(
                        c.estado === 'PAGADA' ? 'PAGADA' : c.estado === 'EXIGIBLE' ? 'PARCIAL' : 'PENDIENTE',
                      )}`}
                    >
                      <span>
                        #{c.numero_cuota} • S/ {Number(c.monto_programado).toFixed(2)} • {c.estado}
                      </span>
                      {c.estado === 'ESPERA_HITO' && (
                        <button
                          type="button"
                          onClick={() => handleAprobarHito(c.numero_cuota)}
                          disabled={busyAction}
                          className="ml-1 px-1.5 py-0.2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] cursor-pointer disabled:opacity-50"
                          title="El asesor aprueba el hito académico: pasa la cuota a EXIGIBLE y avisa por Telegram"
                        >
                          ✓ Aprobar hito
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span>Etapas de cobranza:</span>
                  </span>
                  <button
                    onClick={() => handleAlerta('4h')}
                    disabled={busyAction}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                    title="Simula 4 horas sin pago: reenvía el enlace de pago"
                  >
                    <Clock className="w-3 h-3" />
                    <span>4h • Reenviar enlace</span>
                  </button>
                  <button
                    onClick={() => handleAlerta('12h')}
                    disabled={busyAction}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                    title="Simula 12 horas sin pago: ofrece dividir en cuotas"
                  >
                    <Layers className="w-3 h-3" />
                    <span>12h • Ofrecer cuotas</span>
                  </button>
                  <button
                    onClick={() => handleAlerta('24h')}
                    disabled={busyAction}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                    title="Simula 24 horas sin respuesta: escalamiento a asesor humano"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>24h • Escalar a asesor</span>
                  </button>
                  <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-700" />
                  <button
                    onClick={handleWebhook}
                    disabled={busyAction}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                    title="Simula la confirmación de la pasarela (webhook firmado)"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Simular pago (webhook)</span>
                  </button>
                </div>
              </div>

              {banner && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/50 p-2.5 px-4 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{banner}</span>
                  </div>
                  <button
                    onClick={() => setBanner(null)}
                    className="text-emerald-700 hover:text-emerald-900 dark:hover:text-emerald-100 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Message Timeline */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
                {mensajes.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 text-center py-12">
                    Aún no hay mensajes en esta orden. Escribí como tesista o dispará una etapa de cobranza.
                  </div>
                ) : (
                  mensajes.map((m: any) => {
                    const esBot = m.emisor === 'BOT';
                    const isClient = !esBot;
                    const isPaymentLink = /\/checkout\//.test(m.contenido || '');

                    return (
                      <div
                        key={m.mensaje_id}
                        className={`flex gap-2.5 sm:gap-3 max-w-[90%] sm:max-w-[78%] ${
                          isClient ? 'mr-auto' : 'ml-auto flex-row-reverse'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-xs ${
                            isClient
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {isClient ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </div>

                        <div
                          className={`p-3.5 rounded-2xl text-xs space-y-1.5 shadow-sm min-w-0 ${
                            isClient
                              ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-xs'
                              : 'bg-gradient-to-br from-blue-700 to-indigo-700 text-white rounded-tr-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] opacity-75 font-semibold gap-2">
                            <span className="truncate">
                              {isClient ? 'Estudiante' : 'Agente IA de Cobranza'}
                            </span>
                            <span className="shrink-0">
                              {m.fecha_mensaje
                                ? new Date(m.fecha_mensaje).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                          </div>

                          <p className="leading-relaxed whitespace-pre-wrap break-words">{m.contenido}</p>

                          {isPaymentLink && (
                            <div className="mt-2 p-2.5 rounded-xl bg-slate-900/80 dark:bg-black/40 border border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span className="font-bold text-[11px] text-white truncate">
                                  Orden de Pago Oficial
                                </span>
                              </div>
                              <Link
                                href={m.contenido.match(/https?:\/\/[^\s]+/)?.[0] || '/checkout'}
                                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-[10px] shadow transition-colors flex items-center gap-1 shrink-0"
                              >
                                <span>Abrir Pasarela</span> <ArrowRight className="w-3 h-3" />
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={endRef} />
              </div>

              {/* Guardarraíles / herramientas del último turno */}
              {(lastGuardrails.length > 0 || lastTools.length > 0) && (
                <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center gap-1.5 flex-wrap text-[10px]">
                  {lastGuardrails.map((g, i) => (
                    <span
                      key={`g${i}`}
                      className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold"
                    >
                      ✓ {g}
                    </span>
                  ))}
                  {lastTools.map((t: any, i: number) => (
                    <span
                      key={`t${i}`}
                      className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-mono font-semibold"
                    >
                      {t.herramienta || t.nombre || t.tool || 'tool'}
                    </span>
                  ))}
                </div>
              )}

              {/* Simulador del estudiante */}
              <div className="p-3 sm:p-4 bg-white dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                    <Sparkles className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                    <span>Respuestas Demo:</span>
                  </span>
                  {SCENARIOS_PRUEBA.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setInput(sc.mensaje)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] border border-slate-200 dark:border-slate-700 font-medium transition-colors cursor-pointer"
                      title={sc.mensaje}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleEnviar();
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    placeholder="Escribe como estudiante (simula respuesta en Telegram/WhatsApp)..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-600 hover:to-sky-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer shrink-0"
                  >
                    {sending ? (
                      <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Enviar</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 p-8 text-center">
              Selecciona una conversación a la izquierda para ver el Live Chat de cobranza.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PayersLiveChatPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-slate-500 dark:text-slate-400">
          <span className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 dark:border-sky-400 border-t-transparent" />
          <p className="mt-2 text-xs font-semibold">Cargando chat de cobranza...</p>
        </div>
      }
    >
      <PayersLiveChatContent />
    </Suspense>
  );
}
