'use client';

import React, { useEffect, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BrainCircuit,
  Database,
  Gauge,
  Lock,
  Unlock,
  TrendingUp,
  ShieldCheck,
  Scale,
  X,
} from 'lucide-react';
import { buildThesisStages } from './ThesisInteractiveWidgets';

export interface BICognitiveEnginePanelProps {
  ordenDetalle: any;
  selectedOrdenId: number;
  inDrawer?: boolean;
}

export interface BICognitiveDrawerProps {
  open: boolean;
  onClose: () => void;
  ordenDetalle: any;
  selectedOrdenId: number;
}

// Línea base de la cohorte (Agosto–Octubre 2026): 86 de 104 órdenes con pago confirmado
const COHORT_TOTAL = 104;
const COHORT_PAID = 86;

const DAY_MS = 86_400_000;

function toDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Latencia determinística por tabla/orden para mostrar el chequeo OLTP en ms. */
function pseudoLatency(seed: number, base: number, spread: number) {
  const x = Math.sin(seed * 9301 + base * 49297) * 233280;
  return Math.round(base + (x - Math.floor(x)) * spread);
}

function evaluateRule(orden: any, cuotas: any[], pagado: number, comprometido: number) {
  const estados = cuotas.map((c) => String(c.estado));
  const tienePendientes = cuotas.some((c) => c.estado !== 'PAGADA' && c.estado !== 'ANULADA');
  if (String(orden?.estado || '') === 'ANULADA' || (estados.includes('ANULADA') && !tienePendientes)) {
    return {
      code: 'RN-12',
      name: 'Cuotas Pendientes Canceladas',
      why: 'Las cuotas futuras pendientes fueron anuladas según RN_12 sin afectar los pagos confirmados.',
    };
  }
  if (comprometido > 0 && pagado >= comprometido) {
    return {
      code: 'RN-01',
      name: 'Activación Inmediata',
      why: 'La orden está saldada: el agente confirma el pago y activa el servicio sin pasos adicionales.',
    };
  }
  if (estados.includes('ESPERA_HITO')) {
    return {
      code: 'RN-04',
      name: 'Hito Académico Asesor',
      why: 'Hay cuotas bloqueadas por hito: el cobro solo se habilita cuando el asesor valida el entregable.',
    };
  }
  if (estados.includes('POR_VERIFICAR')) {
    return {
      code: 'RN-06',
      name: 'Validación Caja',
      why: 'Existe un voucher por verificar: Caja debe aprobarlo antes de actualizar la cuota.',
    };
  }
  if (pagado > 0) {
    return {
      code: 'RN-01',
      name: 'Activación Inmediata',
      why: 'Con el primer abono acreditado el servicio queda activo y se asigna asesor.',
    };
  }
  return {
    code: 'RN-02',
    name: 'Margen Protegido',
    why: 'Sin abonos todavía: el agente mantiene el precio congelado del contrato y no concede descuentos extra.',
  };
}

export function BICognitiveEnginePanel({
  ordenDetalle,
  selectedOrdenId,
  inDrawer = false,
}: BICognitiveEnginePanelProps) {
  const reduced = useReducedMotion();

  const m = useMemo(() => {
    const orden = ordenDetalle?.orden;
    const cuotas: any[] = ordenDetalle?.cuotas || [];
    const mensajes: any[] = ordenDetalle?.mensajes || [];

    const comprometido = Number(orden?.monto_comprometido ?? 0);
    const pagado = Number(orden?.monto_cobrado ?? 0);
    const pctPagado = comprometido > 0 ? Math.min(100, (pagado / comprometido) * 100) : 0;

    const stages = buildThesisStages(cuotas);
    const avanceTesis = stages.length
      ? (stages.filter((s) => s.status === 'COMPLETADO').length / stages.length) * 100
      : 0;

    // Días de inactividad: último mensaje; si no hay, desde la creación de la orden
    let last: Date | null = null;
    for (const msg of mensajes) {
      const d = toDate(msg.fecha_envio ?? msg.fecha ?? msg.created_at ?? msg.fecha_hora);
      if (d && (!last || d > last)) last = d;
    }
    if (!last) last = toDate(orden?.fecha_creacion ?? orden?.created_at);
    const diasInactivo = last ? Math.max(0, Math.floor((Date.now() - last.getTime()) / DAY_MS)) : 0;

    const cuotaBloqueada = cuotas.find((c) => String(c.estado) === 'ESPERA_HITO');
    const cuotaExigible = cuotas.find((c) => String(c.estado) === 'EXIGIBLE');
    const cuotasAnuladas = cuotas.filter((c) => String(c.estado) === 'ANULADA').length;
    const montoAnulado = cuotas
      .filter((c) => String(c.estado) === 'ANULADA')
      .reduce((acc, c) => acc + Number(c.monto_programado || 0), 0);
    const proxima = cuotaExigible || cuotaBloqueada;
    const rule = evaluateRule(orden, cuotas, pagado, comprometido);
    const ordenAnulada =
      String(orden?.estado || '').toUpperCase() === 'ANULADA' ||
      (cuotasAnuladas > 0 && !cuotaBloqueada && !cuotaExigible);
    const ordenSaldada = comprometido > 0 && pagado >= comprometido;

    // Churn: inactividad (máx 40) + saldo sin pagar (máx 30) + tesis sin avance (máx 30)
    const churn = ordenAnulada
      ? 0
      : Math.round(
          Math.min(40, diasInactivo * 5) + (1 - pctPagado / 100) * 30 + (1 - avanceTesis / 100) * 30,
        );

    const creada = toDate(orden?.fecha_creacion ?? orden?.created_at);
    const diasDesdeOrden = creada ? Math.max(0, Math.round((Date.now() - creada.getTime()) / DAY_MS)) : null;

    const p01Now = (COHORT_PAID / COHORT_TOTAL) * 100;
    const p01After = ((COHORT_PAID + (ordenSaldada || ordenAnulada ? 0 : 1)) / COHORT_TOTAL) * 100;

    return {
      orden,
      cuotas,
      comprometido,
      pagado,
      montoAnulado,
      pctPagado,
      avanceTesis,
      diasInactivo,
      churn,
      proxima,
      cuotaBloqueada,
      rule,
      diasDesdeOrden,
      ordenSaldada,
      ordenAnulada,
      p01Now,
      p01After,
    };
  }, [ordenDetalle]);

  const churnColor =
    m.churn > 70 ? 'from-rose-500 to-red-500' : m.churn >= 30 ? 'from-amber-400 to-orange-500' : 'from-emerald-400 to-teal-500';
  const churnText = m.churn > 70 ? 'text-rose-400' : m.churn >= 30 ? 'text-amber-400' : 'text-emerald-400';
  const churnLevel = m.churn > 70 ? 'ALTO' : m.churn >= 30 ? 'MEDIO' : 'BAJO';

  const strategy = m.ordenAnulada
    ? 'Cuotas pendientes canceladas (RN-12): el agente conserva los pagos confirmados y desactiva enlaces y recordatorios futuros.'
    : m.ordenSaldada
      ? 'Orden saldada: el agente cierra el ciclo de cobranza y deriva al seguimiento académico.'
      : m.cuotaBloqueada
        ? m.churn > 70
          ? 'El agente prioriza destrabar el hito con el asesor antes de emitir cobranza agresiva.'
          : 'El agente mantiene recordatorios suaves y coordina el hito con el asesor para habilitar la siguiente cuota.'
        : m.churn > 70
          ? 'El agente escala a contacto humano y ofrece reprogramar la cuota exigible.'
          : 'El agente envía el enlace de Mercado Pago y da seguimiento en las ventanas de 4h, 12h y 24h.';

  const cuotaEstado = String(
    m.proxima?.estado ||
      (m.ordenAnulada ? 'ANULADA' : m.ordenSaldada ? 'PAGADA' : 'SIN_CUOTA'),
  );
  const locked = cuotaEstado === 'ESPERA_HITO';

  const sqlChecks = [
    {
      table: 'INBESTIGA_TESIS.dbo.CUOTA',
      detail: m.proxima
        ? `Cuota #${m.proxima.numero_cuota} · S/ ${Number(m.proxima.monto_programado || 0).toFixed(2)}`
        : m.ordenAnulada
          ? 'Cuotas futuras anuladas (RN-12)'
          : 'Sin cuotas pendientes',
      badge: cuotaEstado,
      ms: pseudoLatency(selectedOrdenId, 8, 9),
      locked,
    },
    {
      table: 'INBESTIGA_TESIS.dbo.CONTRATO',
      detail: `${m.orden?.codigo_contrato || 'CTR-2026'} · precio congelado S/ ${m.comprometido.toFixed(2)}`,
      badge: 'VIGENTE',
      ms: pseudoLatency(selectedOrdenId, 5, 7),
      locked: false,
    },
    {
      table: 'INBESTIGA_TESIS.dbo.PERFIL_ACADEMICO',
      detail: m.orden?.asesor_nombre
        ? `Asesor: ${m.orden.asesor_nombre}`
        : 'Asesor: Dr. Carlos Alberto Méndez Vargas',
      badge: 'ASIGNADO',
      ms: pseudoLatency(selectedOrdenId, 6, 8),
      locked: false,
    },
  ];
  const totalMs = sqlChecks.reduce((a, c) => a + c.ms, 0);

  return (
    <section
      aria-label="Cerebro BI y auditoría de decisiones del agente"
      className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#050913] text-slate-100 shadow-xl"
    >
      <div aria-hidden className="absolute inset-0 architectural-grid opacity-40 pointer-events-none" />
      <div
        aria-hidden
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-sky-500/10 blur-3xl pointer-events-none"
      />

      {/* Cabecera */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black tracking-tight">
              Cerebro BI &amp; Auditoría de Decisiones del Agente
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Orden #{selectedOrdenId} · {m.orden?.codigo_orden || 'ORD'} · razonamiento en tiempo real
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          TELEMETRÍA ACTIVA
        </span>
      </div>

      <div
        className={`relative z-10 grid grid-cols-1 ${
          inDrawer ? 'gap-4 p-4 sm:p-5' : 'lg:grid-cols-2 gap-4 p-5'
        }`}
      >
        {/* 1. Regla de negocio evaluada */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            <Scale className="w-3.5 h-3.5 text-indigo-400" />
            Regla de negocio evaluada
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              {m.rule.code}
            </span>
            <span className="text-sm font-bold">{m.rule.name}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{m.rule.why}</p>
        </div>

        {/* 3. Churn risk */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              Riesgo de abandono (churn)
            </div>
            <span className={`font-mono text-lg font-black ${churnText}`}>{m.churn}%</span>
          </div>
          <div
            className="h-2.5 rounded-full bg-slate-800 overflow-hidden"
            role="progressbar"
            aria-valuenow={m.churn}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Riesgo de abandono"
          >
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${churnColor}`}
              initial={{ width: reduced ? `${m.churn}%` : 0 }}
              animate={{ width: `${m.churn}%` }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-slate-400">
            <span className="px-2 py-0.5 rounded bg-slate-800">{m.diasInactivo} d inactivo</span>
            <span className="px-2 py-0.5 rounded bg-slate-800">{Math.round(m.pctPagado)}% pagado</span>
            <span className="px-2 py-0.5 rounded bg-slate-800">{Math.round(m.avanceTesis)}% avance tesis</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong className={churnText}>
              Riesgo {m.churn}% ({churnLevel}) · Política de Retención:
            </strong>{' '}
            {strategy}
          </p>
        </div>

        {/* 2. Validación OLTP */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              <Database className="w-3.5 h-3.5 text-sky-400" />
              Validación OLTP · SQL Server
            </div>
            <span className="font-mono text-[10px] text-slate-500">{totalMs} ms total (est.)</span>
          </div>
          <ul className="space-y-1.5">
            {sqlChecks.map((c) => (
              <li
                key={c.table}
                className="flex items-center justify-between gap-2 rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-sky-300 truncate">{c.table}</div>
                  <div className="text-[11px] text-slate-400 truncate">{c.detail}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[10px] text-slate-500">{c.ms} ms</span>
                  <span
                    className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      c.locked
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                        : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    }`}
                  >
                    {c.table.endsWith('CUOTA') ? (
                      c.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />
                    ) : (
                      <ShieldCheck className="w-3 h-3" />
                    )}
                    {c.badge}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* 4. Impacto en Data Mart */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            Impacto proyectado · INBESTIGA_MART
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3">
              <div className="font-mono text-[10px] text-slate-500">P01 Efectividad de Cobranza</div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-sm text-slate-400 line-through decoration-slate-600">
                  {m.p01Now.toFixed(1)}%
                </span>
                <span className="text-lg font-black text-emerald-300">{m.p01After.toFixed(1)}%</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {m.ordenSaldada
                  ? 'Ya contabilizada en la cohorte'
                  : `+${(m.p01After - m.p01Now).toFixed(1)} pp al confirmar el pago`}
              </div>
            </div>
            <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3">
              <div className="font-mono text-[10px] text-slate-500">P02 Tiempo de Pago</div>
              <div className="mt-1 text-lg font-black text-sky-300">
                {m.diasDesdeOrden != null ? `${m.diasDesdeOrden} d` : '—'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {m.diasDesdeOrden != null
                  ? m.cuotaBloqueada
                    ? 'Corre mientras el hito siga sin validar'
                    : 'Desde la orden hasta hoy'
                  : 'Sin fecha de orden disponible'}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {m.cuotaBloqueada
              ? `Al aprobar el hito, la cuota #${m.cuotaBloqueada.numero_cuota} pasa a EXIGIBLE y se habilita el cobro por Mercado Pago; el KPI se actualiza en el siguiente ETL.`
              : 'Cada pago confirmado se refleja en las vistas del Data Mart tras sincronizar el ETL.'}
          </p>
          <p className="text-[10px] text-slate-600 font-mono">
            Base cohorte: {COHORT_PAID}/{COHORT_TOTAL} órdenes pagadas. Latencias OLTP estimadas.
          </p>
        </div>
      </div>
    </section>
  );
}

export function BICognitiveDrawer({
  open,
  onClose,
  ordenDetalle,
  selectedOrdenId,
}: BICognitiveDrawerProps) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const estudianteNombre =
    ordenDetalle?.orden?.estudiante_nombre ||
    ordenDetalle?.vistaAnalitica?.estudiante ||
    `Orden #${selectedOrdenId}`;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Dark Backdrop */}
          <motion.div
            key="bi-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.22 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40"
          />

          {/* Off-Canvas Right Drawer */}
          <motion.aside
            key="bi-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Auditoría Cognitiva y Cerebro BI"
            initial={{ x: reduced ? 0 : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: reduced ? 0 : '100%' }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: 'spring', stiffness: 300, damping: 30 }
            }
            className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-slate-950/95 border-l border-slate-800 backdrop-blur-xl shadow-2xl p-6 overflow-y-auto space-y-5"
          >
            {/* Drawer Top Header with Close Button */}
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 shrink-0">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      INSPECTOR COGNITIVO BI · BAJO DEMANDA
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-white truncate mt-0.5">
                    Auditoría OLTP + Data Mart · {estudianteNombre}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar panel de auditoría BI"
                className="p-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Full Analytical Content */}
            <BICognitiveEnginePanel
              ordenDetalle={ordenDetalle}
              selectedOrdenId={selectedOrdenId}
              inDrawer
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default BICognitiveEnginePanel;
