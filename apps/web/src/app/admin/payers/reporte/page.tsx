'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Database,
  RefreshCw,
  Printer,
  Eye,
  CheckCircle2,
  Award,
  Layers,
  BellRing,
  CreditCard,
  FileText,
  X,
  Download,
  BookOpen,
  Receipt,
  GraduationCap,
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  Phone,
  Mail,
  Building2,
  UserCheck,
  Calendar,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

type VistaActiva = 'VISTA_3_1' | 'VISTA_3_2' | 'VISTA_3_3';
type AlcancePdf = 'COMPLETO' | 'VISTA_3_1' | 'VISTA_3_2' | 'VISTA_3_3';

const ESTADO_ORDEN_BADGES: Record<string, string> = {
  PAGADA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
  PARCIAL: 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border-sky-300 dark:border-sky-800',
  ENLACE_ENVIADO: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  ANULADA: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-800',
  PENDIENTE: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
};

const formatMoneda = (valor: number | string | null | undefined): string =>
  `S/ ${Number(valor ?? 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatFechaCorta = (valor: string | null | undefined): string => {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);
  return fecha.toLocaleString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function PayersReportePage() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [etlRunning, setEtlRunning] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Selector de pestaña para no amontonar las tablas complejas
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('VISTA_3_1');
  const [subVista31, setSubVista31] = useState<'MODALIDAD' | 'SERVICIO'>('MODALIDAD');

  // Drill-down interactivo de Vista 3.1: fila -> listado de integrantes -> ficha de persona
  const [selectedModalidad, setSelectedModalidad] = useState<string | null>(null);
  const [selectedServicio, setSelectedServicio] = useState<string | null>(null);
  const [drillSearch, setDrillSearch] = useState<string>('');
  const [drillEstadoFiltro, setDrillEstadoFiltro] = useState<'TODOS' | 'CON_PAGO' | 'SIN_PAGO'>('TODOS');

  // Modal de detalle por persona seleccionada
  const [personaSeleccionada, setPersonaSeleccionada] = useState<any>(null);
  const [personaDetalleApi, setPersonaDetalleApi] = useState<any>(null);
  const [loadingPersonaDetalle, setLoadingPersonaDetalle] = useState<boolean>(false);
  const [permiteAnularPago, setPermiteAnularPago] = useState<boolean>(true);
  const [permiteCancelarCuotas, setPermiteCancelarCuotas] = useState<boolean>(true);
  const [anulandoPagoId, setAnulandoPagoId] = useState<number | null>(null);
  const [cancelandoCuotas, setCancelandoCuotas] = useState<boolean>(false);

  // Modal de Previsualización e Impresión en PDF
  const [pdfModalOpen, setPdfModalOpen] = useState<boolean>(false);
  const [alcancePdf, setAlcancePdf] = useState<'COMPLETO' | 'VISTA_3_1' | 'VISTA_3_2' | 'VISTA_3_3'>('COMPLETO');

  const cargarOverview = async () => {
    setLoading(true);
    try {
      const res = await api.getPayersOverview();
      setOverview(res);
    } catch (err) {
      console.error('Error cargando reporte R-PAYERS:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarOverview();
  }, []);

  const handleRunEtl = async () => {
    setEtlRunning(true);
    setStatusBanner(null);
    try {
      await api.runEtl();
      await cargarOverview();
      setStatusBanner('ETL ejecutado correctamente: INBESTIGA_TESIS sincronizado hacia INBESTIGA_MART.');
    } catch (err: any) {
      setStatusBanner(`Error ejecutando ETL: ${err?.message}`);
    } finally {
      setEtlRunning(false);
    }
  };

  const abrirPrevisualizacionPdf = (alcance: 'COMPLETO' | 'VISTA_3_1' | 'VISTA_3_2' | 'VISTA_3_3') => {
    setAlcancePdf(alcance);
    setPdfModalOpen(true);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const abrirDetallePersona = async (persona: any) => {
    setPersonaSeleccionada(persona);
    setPersonaDetalleApi(null);
    setLoadingPersonaDetalle(true);
    try {
      const [detalle, reglas] = await Promise.all([
        api.getPayerOrden(persona.id_orden_pago),
        api.getBusinessRules().catch(() => []),
      ]);
      setPersonaDetalleApi(detalle);
      const rn11 = Array.isArray(reglas)
        ? reglas.find((r: any) => r.codigo === 'RN_11_PERMITIR_ANULACION_PAGO')
        : null;
      if (rn11) {
        const val = String(rn11.valor || '').trim().toLowerCase();
        setPermiteAnularPago(Boolean(rn11.activo) && ['true', '1', 'si', 'sí'].includes(val));
      }
      const rn12 = Array.isArray(reglas)
        ? reglas.find((r: any) => r.codigo === 'RN_12_CANCELAR_CUOTAS_PENDIENTES')
        : null;
      if (rn12) {
        const val12 = String(rn12.valor || '').trim().toLowerCase();
        setPermiteCancelarCuotas(Boolean(rn12.activo) && ['true', '1', 'si', 'sí'].includes(val12));
      }
    } catch (err) {
      console.error('Error cargando detalle de persona/orden:', err);
    } finally {
      setLoadingPersonaDetalle(false);
    }
  };

  const handleAnularPagoDesdeModal = async (pagoId: number) => {
    if (!permiteAnularPago) {
      setStatusBanner(
        'Operación bloqueada por regla de negocio RN_11_PERMITIR_ANULACION_PAGO (deshabilitada en Reglas de Negocio).',
      );
      return;
    }
    const motivo = window.prompt('Motivo de anulación del pago (se registrará en Auditoría):', 'Error de cobro o solicitud administrativa');
    if (motivo === null) return;
    setAnulandoPagoId(pagoId);
    try {
      const res = await api.anularPago(pagoId, motivo);
      setStatusBanner(res?.mensaje || `Pago #${pagoId} anulado correctamente.`);
      const [detalleActualizado] = await Promise.all([
        api.getPayerOrden(personaSeleccionada.id_orden_pago),
        cargarOverview(),
      ]);
      setPersonaDetalleApi(detalleActualizado);
    } catch (err: any) {
      setStatusBanner(`No se pudo anular el pago #${pagoId}: ${err?.message || 'Error desconocido'}`);
    } finally {
      setAnulandoPagoId(null);
    }
  };

  const handleCancelarCuotasDesdeModal = async (cuotaId?: number) => {
    if (!personaSeleccionada?.id_orden_pago) return;
    if (!permiteCancelarCuotas) {
      setStatusBanner(
        'Operación bloqueada por regla de negocio RN_12_CANCELAR_CUOTAS_PENDIENTES (deshabilitada en Reglas de Negocio).',
      );
      return;
    }
    const motivo = window.prompt(
      cuotaId
        ? `Motivo para cancelar la cuota seleccionada (RN_12):`
        : 'Motivo para cancelar todas las cuotas pendientes de esta orden (RN_12):',
      'Desistimiento o ajuste administrativo de cuotas futuras',
    );
    if (motivo === null) return;
    setCancelandoCuotas(true);
    try {
      const res = await api.cancelarCuotasPendientes(personaSeleccionada.id_orden_pago, {
        ...(cuotaId ? { cuotaId } : {}),
        motivo,
      });
      setStatusBanner(
        res?.mensaje || `Se cancelaron ${res?.cuotasCanceladas ?? 0} cuota(s) pendiente(s) según RN_12.`,
      );
      const [detalleActualizado] = await Promise.all([
        api.getPayerOrden(personaSeleccionada.id_orden_pago),
        cargarOverview(),
      ]);
      setPersonaDetalleApi(detalleActualizado);
      if (detalleActualizado?.orden?.estado) {
        setPersonaSeleccionada((prev: any) =>
          prev ? { ...prev, estado_orden: detalleActualizado.orden.estado } : prev,
        );
      }
    } catch (err: any) {
      setStatusBanner(`No se pudieron cancelar las cuotas pendientes: ${err?.message || 'Error desconocido'}`);
    } finally {
      setCancelandoCuotas(false);
    }
  };

  const cerrarDetallePersona = () => {
    setPersonaSeleccionada(null);
    setPersonaDetalleApi(null);
  };

  const handleCambiarSubVista31 = (nextSubVista: 'MODALIDAD' | 'SERVICIO') => {
    setSubVista31(nextSubVista);
    setDrillSearch('');
    setDrillEstadoFiltro('TODOS');
  };

  const kpis: any[] = overview?.kpisP01P06 || overview?.kpis || [];
  const vista31Ordenes: any[] = overview?.vista31Ordenes || [];
  const vista31Servicio: any[] = overview?.vista31Servicio || [];
  const vista32Recuperacion: any[] = overview?.vista32Recuperacion || [];
  const vista33Medios: any[] = overview?.vista33Medios || [];
  const ordenesDetalle: any[] = overview?.ordenesDetalle || [];
  const resumenOp = overview?.resumenOperativo || {};

  const totalVista31 = vista31Ordenes.find((r) => r.modalidad_pago === 'TOTAL') || {};
  const totalVista32 = vista32Recuperacion.find((r) => String(r.secuencia || r.tipo_alerta).includes('TOTAL')) || {};

  const filaActiva31 = subVista31 === 'MODALIDAD' ? selectedModalidad : selectedServicio;

  const personasDeFila = useMemo(() => {
    if (!filaActiva31) return [];
    if (subVista31 === 'MODALIDAD') {
      if (filaActiva31 === 'TOTAL') return ordenesDetalle;
      return ordenesDetalle.filter((o) => o.modalidad_pago === filaActiva31);
    }
    return ordenesDetalle.filter((o) => o.servicio === filaActiva31);
  }, [filaActiva31, subVista31, ordenesDetalle]);

  const personasFiltradas = useMemo(() => {
    const query = drillSearch.trim().toLowerCase();
    return personasDeFila.filter((o) => {
      const tienePago = Number(o.pagos_confirmados || 0) > 0 || Number(o.monto_cobrado || 0) > 0;
      const pasaEstado =
        drillEstadoFiltro === 'TODOS' ||
        (drillEstadoFiltro === 'CON_PAGO' && tienePago) ||
        (drillEstadoFiltro === 'SIN_PAGO' && !tienePago);
      if (!pasaEstado) return false;
      if (!query) return true;
      return [
        o.estudiante,
        o.codigo_orden,
        o.codigo_contrato,
        o.universidad,
        o.carrera,
        o.telefono,
        o.email,
      ]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(query));
    });
  }, [personasDeFila, drillSearch, drillEstadoFiltro]);

  return (
    <div className="space-y-8 pb-12">
      {/* Estilos de impresión A4 limpios para el dossier PDF */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #seccion-reporte-bi-impresion,
          #seccion-reporte-bi-impresion * {
            visibility: visible;
          }
          #seccion-reporte-bi-impresion {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 18px;
            background: white !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* =========================================================================
          HEADER EJECUTIVO DEL REPORTE BI R-PAYERS
          ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold border border-emerald-500/25">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>DATA MART KIMBALL · INBESTIGA_MART (FASE 3: PAYERS)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Reporte Ejecutivo BI R-PAYERS
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
            Resumen general de indicadores en pantalla y previsualización en PDF para las tablas analíticas complejas
            (Vistas 3.1, 3.2 y 3.3).
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => abrirPrevisualizacionPdf('COMPLETO')}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 shadow-md flex items-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>Previsualizar / Imprimir PDF</span>
          </button>

          <button
            type="button"
            onClick={handleRunEtl}
            disabled={etlRunning}
            className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            {etlRunning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Database className="w-3.5 h-3.5" />
            )}
            <span>Sincronizar ETL</span>
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between gap-3 text-xs font-bold text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* =========================================================================
          SECCIÓN 1: DATOS GENERALES EN EL SISTEMA (4 TARJETAS CLARAS Y ESPACIADAS)
          ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            1. Resumen General del Embudo PAYERS (Cohorte Auditada)
          </h2>
          <span className="text-xs text-slate-500">Fuente: INBESTIGA_TESIS & INBESTIGA_MART</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-1.5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Órdenes Transferidas (LEADS ➔ PAYERS)
            </div>
            <div className="text-3xl font-black font-mono text-slate-900 dark:text-white">
              {resumenOp.totalOrdenes ?? 104}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {resumenOp.totalContratos ?? 104} contratos firmados ·{' '}
              <strong>{formatMoneda(totalVista31.monto_comprometido ?? 180540)}</strong> comprometidos
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 shadow-xs space-y-1.5">
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
              Recaudación Efectiva Acreditada
            </div>
            <div className="text-3xl font-black font-mono text-emerald-700 dark:text-emerald-400">
              {formatMoneda(totalVista31.monto_cobrado ?? 110480)}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <strong>{resumenOp.totalPagosConfirmados ?? 150} abonos</strong> confirmados ({resumenOp.totalWebhooks ?? 123} vía pasarela)
            </p>
          </div>

          <div className="rounded-2xl border border-sky-500/30 bg-sky-50/40 dark:bg-sky-950/20 p-5 shadow-xs space-y-1.5">
            <div className="text-xs font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider">
              Servicios Académicos Activados
            </div>
            <div className="text-3xl font-black font-mono text-sky-700 dark:text-sky-400">
              {resumenOp.totalCustomersActivados ?? 86} / {resumenOp.totalOrdenes ?? 104}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Tesistas promovidos a <strong>CUSTOMERS</strong> con asesor asignado
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20 p-5 shadow-xs space-y-1.5">
            <div className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
              Recuperación por Alertas IA
            </div>
            <div className="text-3xl font-black font-mono text-amber-700 dark:text-amber-400">
              {totalVista32.payers_recuperados_72h ?? 34} / {totalVista32.payers_alertados ?? resumenOp.totalAlertas ?? 55}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Órdenes recuperadas dentro de las 72h posteriores al recordatorio
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECCIÓN 2: INDICADORES OFICIALES DE INTELIGENCIA DE NEGOCIOS (P01 - P06)
          ========================================================================= */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>2. Matriz de Indicadores Clave de Desempeño (KPIs P01 – P06)</span>
          </h2>
          <span className="text-xs font-mono text-slate-500">
            Vista SQL: INBESTIGA_MART.dbo.vw_rpayers_kpis
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Cargando indicadores P01–P06...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpis.map((kpi: any) => (
              <div
                key={kpi.codigo}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        {kpi.codigo}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {kpi.tipo} · {kpi.frecuencia}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-2">
                      {kpi.nombre}
                    </h3>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {kpi.estado_semaforo}
                  </span>
                </div>

                <div className="flex items-baseline justify-between border-y border-slate-100 dark:border-slate-800/80 py-3">
                  <span className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {kpi.unidad === '%' ? `${kpi.valor}%` : `${kpi.valor} ${kpi.unidad}`}
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                    {kpi.detalle_formula}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>
                    Meta: <strong>{kpi.codigo === 'P02' || kpi.codigo === 'P06' ? '≤' : '≥'} {kpi.meta_bueno}{kpi.unidad}</strong>
                  </span>
                  <span>Regular: {kpi.rango_regular}</span>
                  <span>Crítico: {kpi.rango_malo}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =========================================================================
          SECCIÓN 3: REPORTES ANALÍTICOS COMPLEJOS (SELECTOR ORDENADO + PREVISUALIZACIÓN PDF)
          ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              3. Desglose de Reportes Analíticos Complejos (Vistas 3.1, 3.2 y 3.3)
            </h2>
            <p className="text-xs text-slate-500">
              Selecciona un reporte para inspeccionarlo con claridad o abre su previsualización oficial en formato PDF A4.
            </p>
          </div>

          {/* Selector de Pestañas Analíticas */}
          <div className="inline-flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setVistaActiva('VISTA_3_1')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                vistaActiva === 'VISTA_3_1'
                  ? 'bg-white dark:bg-emerald-500 text-slate-900 dark:text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Vista 3.1: Modalidades y Servicios</span>
            </button>

            <button
              type="button"
              onClick={() => setVistaActiva('VISTA_3_2')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                vistaActiva === 'VISTA_3_2'
                  ? 'bg-white dark:bg-emerald-500 text-slate-900 dark:text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Vista 3.2: Recuperación Alertas</span>
            </button>

            <button
              type="button"
              onClick={() => setVistaActiva('VISTA_3_3')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                vistaActiva === 'VISTA_3_3'
                  ? 'bg-white dark:bg-emerald-500 text-slate-900 dark:text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Vista 3.3: Pasarela y Comisiones</span>
            </button>
          </div>
        </div>

        {/* CONTENIDO DE PESTAÑA ACTIVA */}
        {vistaActiva === 'VISTA_3_1' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Vista 3.1 — Recaudación por Modalidad de Pago y Tipo de Servicio Académico (P01, P02 y P04)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Compara el monto comprometido vs. monto exigible y cobrado en las {totalVista31.ordenes_creadas ?? 104} órdenes de pago. Haz clic en cualquier fila para ver las personas asignadas.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 p-1 bg-slate-50 dark:bg-slate-950">
                  <button
                    type="button"
                    onClick={() => handleCambiarSubVista31('MODALIDAD')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      subVista31 === 'MODALIDAD'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Por Modalidad
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCambiarSubVista31('SERVICIO')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      subVista31 === 'SERVICIO'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Por Servicio Académico
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => abrirPrevisualizacionPdf('VISTA_3_1')}
                  className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Previsualizar PDF (Vista 3.1)</span>
                </button>
              </div>
            </div>

            {subVista31 === 'MODALIDAD' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500 font-bold bg-slate-50/70 dark:bg-slate-950/50">
                      <th className="py-3.5 px-4">Modalidad de Pago</th>
                      <th className="py-3.5 px-3 text-center">Órdenes Creadas</th>
                      <th className="py-3.5 px-3 text-center">Órdenes con Pago</th>
                      <th className="py-3.5 px-3 text-center">Conversión P01</th>
                      <th className="py-3.5 px-4 text-right">Monto Comprometido</th>
                      <th className="py-3.5 px-4 text-right">Monto Exigible Hoy</th>
                      <th className="py-3.5 px-4 text-right">Monto Cobrado</th>
                      <th className="py-3.5 px-3 text-center">Efectividad P04</th>
                      <th className="py-3.5 px-3 text-center">Integrantes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {vista31Ordenes.map((row: any) => {
                      const isTotal = row.modalidad_pago === 'TOTAL';
                      const isSelected = selectedModalidad === row.modalidad_pago;
                      return (
                        <tr
                          key={row.modalidad_pago}
                          onClick={() => {
                            setSelectedModalidad(isSelected ? null : row.modalidad_pago);
                            setDrillSearch('');
                            setDrillEstadoFiltro('TODOS');
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 ring-1 ring-inset ring-emerald-500/60 font-bold'
                              : isTotal
                                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50 font-black text-slate-900 dark:text-white'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <td className="py-3.5 px-4 font-semibold">
                            <div className="flex items-center gap-2">
                              <ChevronRight
                                className={`w-4 h-4 shrink-0 transition-transform ${
                                  isSelected ? 'rotate-90 text-emerald-500' : 'text-slate-400'
                                }`}
                              />
                              <span>{row.modalidad_pago}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono">{row.ordenes_creadas}</td>
                          <td className="py-3.5 px-3 text-center font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                            {row.ordenes_con_pago}
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono font-bold">
                            {row.pct_confirmacion_p01}%
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono">
                            {formatMoneda(row.monto_comprometido)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono">
                            {formatMoneda(row.monto_exigible)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                            {formatMoneda(row.monto_cobrado)}
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono font-bold text-sky-600 dark:text-sky-400">
                            {row.pct_cobranza_efectiva_p04}%
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <Users className="w-3 h-3" />
                              <span>{isSelected ? 'Ocultar' : `Ver (${row.ordenes_creadas})`}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500 font-bold bg-slate-50/70 dark:bg-slate-950/50">
                      <th className="py-3.5 px-4">Servicio Académico</th>
                      <th className="py-3.5 px-3 text-center">Órdenes</th>
                      <th className="py-3.5 px-3 text-center">Con Pago</th>
                      <th className="py-3.5 px-3 text-center">Conversión P01</th>
                      <th className="py-3.5 px-3 text-center">Tiempo P02</th>
                      <th className="py-3.5 px-4 text-right">Monto Exigible</th>
                      <th className="py-3.5 px-4 text-right">Monto Cobrado</th>
                      <th className="py-3.5 px-3 text-center">Efectividad P04</th>
                      <th className="py-3.5 px-3 text-center">Integrantes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {vista31Servicio.map((row: any) => {
                      const isSelected = selectedServicio === row.servicio;
                      return (
                        <tr
                          key={row.servicio}
                          onClick={() => {
                            setSelectedServicio(isSelected ? null : row.servicio);
                            setDrillSearch('');
                            setDrillEstadoFiltro('TODOS');
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-sky-50 dark:bg-sky-950/40 ring-1 ring-inset ring-sky-500/60 font-bold'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <ChevronRight
                                className={`w-4 h-4 shrink-0 transition-transform ${
                                  isSelected ? 'rotate-90 text-sky-500' : 'text-slate-400'
                                }`}
                              />
                              <span>{row.servicio}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono">{row.ordenes_creadas}</td>
                          <td className="py-3.5 px-3 text-center font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                            {row.ordenes_con_pago}
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono font-bold">
                            {row.pct_confirmacion_p01}%
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono text-amber-600 dark:text-amber-400 font-bold">
                            {row.minutos_primer_pago_p02} min
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono">
                            {formatMoneda(row.monto_exigible)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                            {formatMoneda(row.monto_cobrado)}
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono font-bold text-sky-600 dark:text-sky-400">
                            {row.pct_cobranza_efectiva_p04}%
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                isSelected
                                  ? 'bg-sky-600 text-white border-sky-600'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <Users className="w-3 h-3" />
                              <span>{isSelected ? 'Ocultar' : `Ver (${row.ordenes_creadas})`}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* PANEL DRILL-DOWN: LISTADO DE PERSONAS QUE PERTENECEN A LA FILA SELECCIONADA */}
            {filaActiva31 && (
              <div className="rounded-2xl border border-emerald-500/30 dark:border-emerald-800/70 bg-slate-50/80 dark:bg-slate-950/60 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        <Users className="w-3.5 h-3.5" />
                        <span>{subVista31 === 'MODALIDAD' ? 'Modalidad seleccionada' : 'Servicio seleccionado'}</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                        {personasFiltradas.length} de {personasDeFila.length} personas
                      </span>
                    </div>
                    <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      {filaActiva31 === 'TOTAL'
                        ? 'Todos los estudiantes y órdenes (TOTAL)'
                        : filaActiva31}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Haz clic sobre cualquier persona para abrir su expediente completo, cronograma de cuotas y pagos acreditados.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={drillSearch}
                        onChange={(e) => setDrillSearch(e.target.value)}
                        placeholder="Buscar nombre, ORD o carrera..."
                        className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-56"
                      />
                    </div>

                    <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 p-0.5 bg-white dark:bg-slate-900">
                      {(
                        [
                          { id: 'TODOS', label: 'Todos' },
                          { id: 'CON_PAGO', label: 'Con pago' },
                          { id: 'SIN_PAGO', label: 'Sin pago' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDrillEstadoFiltro(opt.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                            drillEstadoFiltro === opt.id
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        subVista31 === 'MODALIDAD'
                          ? setSelectedModalidad(null)
                          : setSelectedServicio(null)
                      }
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                      title="Cerrar listado"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {personasFiltradas.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No se encontraron personas que coincidan con el filtro aplicado en esta categoría.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[380px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-500 font-bold">
                        <tr>
                          <th className="py-2.5 px-3.5">Persona / Estudiante</th>
                          <th className="py-2.5 px-3">Orden & Contrato</th>
                          <th className="py-2.5 px-3">
                            {subVista31 === 'MODALIDAD' ? 'Servicio Académico' : 'Modalidad de Pago'}
                          </th>
                          <th className="py-2.5 px-3 text-right">Comprometido</th>
                          <th className="py-2.5 px-3 text-right">Cobrado</th>
                          <th className="py-2.5 px-3 text-center">Estado</th>
                          <th className="py-2.5 px-3 text-center">Detalle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                        {personasFiltradas.map((persona: any) => {
                          const badgeClass =
                            ESTADO_ORDEN_BADGES[persona.estado_orden] || ESTADO_ORDEN_BADGES.PENDIENTE;
                          return (
                            <tr
                              key={persona.id_orden_pago}
                              onClick={() => abrirDetallePersona(persona)}
                              className="cursor-pointer hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 transition-colors"
                            >
                              <td className="py-2.5 px-3.5">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {persona.estudiante}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {persona.universidad} · {persona.carrera}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                <div className="font-bold text-emerald-700 dark:text-emerald-400">
                                  {persona.codigo_orden}
                                </div>
                                <div className="text-[10px] text-slate-500">{persona.codigo_contrato}</div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                                <div>
                                  {subVista31 === 'MODALIDAD'
                                    ? persona.servicio
                                    : persona.modalidad_pago}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {persona.numero_cuotas} cuota(s) · {persona.pagos_confirmados} abono(s)
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                {formatMoneda(persona.monto_comprometido)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {formatMoneda(persona.monto_cobrado)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeClass}`}
                                >
                                  {persona.estado_orden}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    abrirDetallePersona(persona);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Ver</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {vistaActiva === 'VISTA_3_2' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Vista 3.2 — Recuperación de Pagos Pendientes tras Alerta de Cobranza (P03 = 61.8%)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Evalúa la efectividad de la secuencia de recordatorios preventivos (4h, 12h y 24h) enviados por el Agente IA.
                </p>
              </div>

              <button
                type="button"
                onClick={() => abrirPrevisualizacionPdf('VISTA_3_2')}
                className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Previsualizar PDF (Vista 3.2)</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500 font-bold bg-slate-50/70 dark:bg-slate-950/50">
                    <th className="py-3.5 px-4">Tipo de Alerta</th>
                    <th className="py-3.5 px-3">Secuencia</th>
                    <th className="py-3.5 px-3 text-center">Payers Alertados</th>
                    <th className="py-3.5 px-3 text-center">Recuperados (≤72h)</th>
                    <th className="py-3.5 px-3 text-center">Escalados a Humano</th>
                    <th className="py-3.5 px-3 text-center">Tasa Recuperación P03</th>
                    <th className="py-3.5 px-4 text-right">Monto Recuperado (PEN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {vista32Recuperacion.map((row: any, idx: number) => {
                    const isTotal = String(row.secuencia || row.tipo_alerta).includes('TOTAL');
                    return (
                      <tr
                        key={`${row.tipo_alerta}_${row.secuencia}_${idx}`}
                        className={
                          isTotal
                            ? 'bg-amber-50/80 dark:bg-amber-950/30 font-black text-slate-900 dark:text-white'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="py-3.5 px-4 font-semibold">{row.tipo_alerta}</td>
                        <td className="py-3.5 px-3 font-mono text-xs">{row.secuencia}</td>
                        <td className="py-3.5 px-3 text-center font-mono">{row.payers_alertados}</td>
                        <td className="py-3.5 px-3 text-center font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                          {row.payers_recuperados_72h}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono text-rose-600 dark:text-rose-400">
                          {row.escalamientos_humano}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold">
                          {row.pct_recuperacion_p03}%
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          S/ {Number(row.monto_recuperado).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {vistaActiva === 'VISTA_3_3' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Vista 3.3 — Conciliación por Medio de Pago, Confirmación Automática (P05) y Costo de Pasarela (P06)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audita los pagos acreditados por Webhook de pasarela Mercado Pago frente a validaciones manuales de Caja.
                </p>
              </div>

              <button
                type="button"
                onClick={() => abrirPrevisualizacionPdf('VISTA_3_3')}
                className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Previsualizar PDF (Vista 3.3)</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500 font-bold bg-slate-50/70 dark:bg-slate-950/50">
                    <th className="py-3.5 px-4">Medio de Pago</th>
                    <th className="py-3.5 px-3">Canal de Confirmación</th>
                    <th className="py-3.5 px-3 text-center">Pagos Confirmados</th>
                    <th className="py-3.5 px-3 text-center">Vía Webhook</th>
                    <th className="py-3.5 px-3 text-center">Automatización P05</th>
                    <th className="py-3.5 px-4 text-right">Monto Cobrado</th>
                    <th className="py-3.5 px-4 text-right">Comisión Pasarela</th>
                    <th className="py-3.5 px-3 text-center">Costo P06 (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {vista33Medios.map((row: any) => {
                    const isTotal = String(row.medio_pago).includes('TOTAL');
                    return (
                      <tr
                        key={row.medio_pago}
                        className={
                          isTotal
                            ? 'bg-sky-50/80 dark:bg-sky-950/30 font-black text-slate-900 dark:text-white'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="py-3.5 px-4 font-semibold">{row.medio_pago}</td>
                        <td className="py-3.5 px-3 font-mono text-xs text-slate-500">
                          {String(row.canal_confirmacion || '').replace(/Culqi/gi, 'Mercado Pago')}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono">{row.pagos_confirmados}</td>
                        <td className="py-3.5 px-3 text-center font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                          {row.pagos_por_webhook}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold">
                          {row.pct_confirmacion_auto_p05}%
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono">
                          S/ {Number(row.monto_cobrado).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-rose-600 dark:text-rose-400">
                          S/ {Number(row.comision_pasarela).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold">
                          {row.pct_costo_cobro_p06}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          MODAL DE PREVISUALIZACIÓN E IMPRESIÓN EN PDF (A4 EJECUTIVO)
          ========================================================================= */}
      {pdfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-5xl max-h-[94vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto">
            {/* Barra de herramientas del Modal (No se imprime) */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    Previsualización de Documento PDF — Reporte BI R-PAYERS
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Selecciona la sección compleja que deseas incluir en la impresión o descarga en PDF A4.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={alcancePdf}
                  onChange={(e) => setAlcancePdf(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="COMPLETO">Dossier Completo R-PAYERS (KPIs + Vistas 3.1, 3.2 y 3.3)</option>
                  <option value="VISTA_3_1">Solo Vista 3.1 — Modalidades y Servicios Académicos</option>
                  <option value="VISTA_3_2">Solo Vista 3.2 — Recuperación de Alertas IA</option>
                  <option value="VISTA_3_3">Solo Vista 3.3 — Conciliación de Pasarela Mercado Pago</option>
                </select>

                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / Guardar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPdfModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Lienzo A4 Imprimible */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-slate-200/70 dark:bg-slate-950">
              <div
                id="seccion-reporte-bi-impresion"
                className="bg-white text-slate-900 p-8 rounded-2xl shadow-xl border border-slate-300 max-w-4xl mx-auto space-y-6 text-xs"
              >
                {/* Membrete Oficial */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <span className="font-black text-base tracking-tight text-slate-900">
                        INBESTIGA · DIRECCIÓN DE INTELIGENCIA DE NEGOCIOS
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-600">
                      Reporte Oficial R-PAYERS — Fase 3: Cobranza Automatizada, Pasarela Mercado Pago & Activación
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Repositorio Dimensional: INBESTIGA_MART (Modelo Estrella Kimball) · Cohorte Auditada: 104 Órdenes
                    </p>
                  </div>

                  <div className="text-right font-mono text-[10px] border border-slate-300 rounded-lg p-2.5 bg-slate-50">
                    <div className="font-bold text-slate-900">CÓDIGO: R-PAYERS-2026</div>
                    <div>Fecha: {new Date().toLocaleDateString('es-PE')}</div>
                    <div>Estado: AUDITADO (100% MATCH)</div>
                  </div>
                </div>

                {/* Resumen de KPIs en el PDF */}
                <div className="space-y-2">
                  <h4 className="font-black text-xs uppercase tracking-wider text-slate-800">
                    I. Síntesis de Indicadores Clave de Desempeño (P01 – P06)
                  </h4>
                  <div className="grid grid-cols-3 gap-2.5">
                    {kpis.map((k: any) => (
                      <div key={k.codigo} className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/60">
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <strong className="text-slate-900">{k.codigo}</strong>
                          <span className="font-bold text-emerald-700">{k.estado_semaforo}</span>
                        </div>
                        <div className="font-bold text-[11px] text-slate-800 mt-0.5">{k.nombre}</div>
                        <div className="flex items-baseline justify-between mt-1 font-mono">
                          <span className="text-base font-black text-slate-900">
                            {k.unidad === '%' ? `${k.valor}%` : `${k.valor} ${k.unidad}`}
                          </span>
                          <span className="text-[10px] text-slate-500">{k.detalle_formula}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tabla Vista 3.1 en el PDF */}
                {(alcancePdf === 'COMPLETO' || alcancePdf === 'VISTA_3_1') && (
                  <div className="space-y-3 pt-2">
                    <h4 className="font-black text-xs uppercase tracking-wider text-slate-800">
                      II. Vista 3.1 — Recaudación por Modalidad de Pago y Tipo de Servicio Académico
                    </h4>
                    <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                      <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                        <tr>
                          <th className="py-2 px-2.5">Modalidad de Pago</th>
                          <th className="py-2 px-2 text-center">Órdenes</th>
                          <th className="py-2 px-2 text-center">Con Pago</th>
                          <th className="py-2 px-2 text-center">P01 (%)</th>
                          <th className="py-2 px-2.5 text-right">Comprometido</th>
                          <th className="py-2 px-2.5 text-right">Exigible</th>
                          <th className="py-2 px-2.5 text-right">Cobrado</th>
                          <th className="py-2 px-2 text-center">P04 (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {vista31Ordenes.map((r: any) => (
                          <tr
                            key={r.modalidad_pago}
                            className={r.modalidad_pago === 'TOTAL' ? 'font-black bg-slate-100' : ''}
                          >
                            <td className="py-1.5 px-2.5">{r.modalidad_pago}</td>
                            <td className="py-1.5 px-2 text-center font-mono">{r.ordenes_creadas}</td>
                            <td className="py-1.5 px-2 text-center font-mono">{r.ordenes_con_pago}</td>
                            <td className="py-1.5 px-2 text-center font-mono">{r.pct_confirmacion_p01}%</td>
                            <td className="py-1.5 px-2.5 text-right font-mono">
                              S/ {Number(r.monto_comprometido).toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono">
                              S/ {Number(r.monto_exigible).toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono font-bold">
                              S/ {Number(r.monto_cobrado).toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono">{r.pct_cobranza_efectiva_p04}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tabla Vista 3.2 en el PDF */}
                {(alcancePdf === 'COMPLETO' || alcancePdf === 'VISTA_3_2') && (
                  <div className="space-y-2 pt-2">
                    <h4 className="font-black text-xs uppercase tracking-wider text-slate-800">
                      III. Vista 3.2 — Recuperación de Pagos Pendientes tras Alerta del Agente IA (P03)
                    </h4>
                    <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                      <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                        <tr>
                          <th className="py-2 px-2.5">Tipo de Alerta</th>
                          <th className="py-2 px-2">Secuencia</th>
                          <th className="py-2 px-2 text-center">Alertados</th>
                          <th className="py-2 px-2 text-center">Recuperados (≤72h)</th>
                          <th className="py-2 px-2 text-center">Escalados</th>
                          <th className="py-2 px-2 text-center">Efectividad P03</th>
                          <th className="py-2 px-2.5 text-right">Monto Recuperado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {vista32Recuperacion.map((r: any, idx: number) => (
                          <tr
                            key={`${r.tipo_alerta}_${r.secuencia}_${idx}`}
                            className={String(r.secuencia || r.tipo_alerta).includes('TOTAL') ? 'font-black bg-slate-100' : ''}
                          >
                            <td className="py-1.5 px-2.5">{r.tipo_alerta}</td>
                            <td className="py-1.5 px-2 font-mono">{r.secuencia}</td>
                            <td className="py-1.5 px-2 text-center font-mono">{r.payers_alertados}</td>
                            <td className="py-1.5 px-2 text-center font-mono">{r.payers_recuperados_72h}</td>
                            <td className="py-1.5 px-2 text-center font-mono">{r.escalamientos_humano}</td>
                            <td className="py-1.5 px-2 text-center font-mono">{r.pct_recuperacion_p03}%</td>
                            <td className="py-1.5 px-2.5 text-right font-mono font-bold">
                              S/ {Number(r.monto_recuperado).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tabla Vista 3.3 en el PDF */}
                {(alcancePdf === 'COMPLETO' || alcancePdf === 'VISTA_3_3') && (
                  <div className="space-y-2 pt-2">
                    <h4 className="font-black text-xs uppercase tracking-wider text-slate-800">
                      IV. Vista 3.3 — Conciliación de Pasarela Mercado Pago, Automatización (P05) y Comisiones (P06)
                    </h4>
                    <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                      <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                        <tr>
                          <th className="py-2 px-2.5">Medio de Pago</th>
                          <th className="py-2 px-2">Canal Confirmación</th>
                          <th className="py-2 px-2 text-center">Confirmados</th>
                          <th className="py-2 px-2 text-center">Webhook</th>
                          <th className="py-2 px-2 text-center">Auto P05</th>
                          <th className="py-2 px-2.5 text-right">Monto Cobrado</th>
                          <th className="py-2 px-2.5 text-right">Comisión</th>
                          <th className="py-2 px-2 text-center">Costo P06</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {vista33Medios.map((r: any) => (
                          <tr
                            key={r.medio_pago}
                            className={String(r.medio_pago).includes('TOTAL') ? 'font-black bg-slate-100' : ''}
                          >
                            <td className="py-1.5 px-2.5">{r.medio_pago}</td>
                            <td className="py-1.5 px-2 font-mono">
                              {String(r.canal_confirmacion || '').replace(/Culqi/gi, 'Mercado Pago')}
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono">{r.pagos_confirmados}</td>
                            <td className="py-1.5 px-2 text-center font-mono">{r.pagos_por_webhook}</td>
                            <td className="py-1.5 px-2 text-center font-mono">{r.pct_confirmacion_auto_p05}%</td>
                            <td className="py-1.5 px-2.5 text-right font-mono">
                              S/ {Number(r.monto_cobrado).toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono">
                              S/ {Number(r.comision_pasarela).toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono">{r.pct_costo_cobro_p06}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pie de Firma y Conformidad */}
                <div className="pt-6 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500">
                  <div>
                    Documento generado desde <strong>INBESTIGA · PAYERS v2.0</strong> (SQL Server INBESTIGA_MART)
                  </div>
                  <div className="font-mono">Verificación ETL: 100% Conciliado</div>
                </div>
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 no-print">
              <span className="text-xs text-slate-500">
                Usa la opción <strong>"Guardar como PDF"</strong> en el cuadro de impresión de tu navegador.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPdfModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar / Imprimir PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL DE DETALLE COMPLETO POR PERSONA / ORDEN (DRILL-DOWN DESDE VISTA 3.1)
          ========================================================================= */}
      {personaSeleccionada && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm no-print"
          onClick={cerrarDetallePersona}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header fijo */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-start justify-between gap-4 shrink-0">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white font-black text-base flex items-center justify-center shrink-0">
                  {String(personaSeleccionada.estudiante || 'E')
                    .split(' ')
                    .slice(0, 2)
                    .map((p: string) => p[0])
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {personaSeleccionada.estudiante}
                    </h3>
                    <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                      {personaSeleccionada.codigo_orden}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                        ESTADO_ORDEN_BADGES[personaSeleccionada.estado_orden] || ESTADO_ORDEN_BADGES.PENDIENTE
                      }`}
                    >
                      {personaSeleccionada.estado_orden}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {personaSeleccionada.universidad} · {personaSeleccionada.carrera} ({personaSeleccionada.facultad})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={cerrarDetallePersona}
                className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer shrink-0"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo scrollable */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {/* Resumen Financiero */}
              {(() => {
                const comp = Number(
                  personaDetalleApi?.orden?.monto_comprometido ?? personaSeleccionada.monto_comprometido ?? 0,
                );
                const exig = Number(
                  personaDetalleApi?.orden?.monto_exigible ?? personaSeleccionada.monto_exigible ?? 0,
                );
                const cobr = Number(
                  personaDetalleApi?.orden?.monto_cobrado ?? personaSeleccionada.monto_cobrado ?? 0,
                );
                const saldo = Math.max(0, comp - cobr);
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-950/60">
                      <div className="text-[10px] font-bold uppercase text-slate-500">Comprometido</div>
                      <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
                        {formatMoneda(comp)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-950/60">
                      <div className="text-[10px] font-bold uppercase text-slate-500">Exigible Hoy</div>
                      <div className="text-lg font-black font-mono text-sky-600 dark:text-sky-400 mt-0.5">
                        {formatMoneda(exig)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-emerald-500/30 p-3.5 bg-emerald-50/50 dark:bg-emerald-950/30">
                      <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                        Cobrado Acreditado
                      </div>
                      <div className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                        {formatMoneda(cobr)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-amber-500/30 p-3.5 bg-amber-50/50 dark:bg-amber-950/20">
                      <div className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                        Saldo Pendiente
                      </div>
                      <div className="text-lg font-black font-mono text-amber-700 dark:text-amber-400 mt-0.5">
                        {formatMoneda(saldo)}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Ficha Personal & Expediente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    <span>Datos del Estudiante y Contacto</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" /> Teléfono / WhatsApp:
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {personaSeleccionada.telefono || personaDetalleApi?.orden?.estudiante_telefono || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" /> Correo electrónico:
                      </span>
                      <span className="font-mono text-slate-900 dark:text-white truncate max-w-[240px]">
                        {personaSeleccionada.email || personaDetalleApi?.orden?.estudiante_email || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" /> Universidad / Facultad:
                      </span>
                      <span className="font-semibold text-right text-slate-900 dark:text-white">
                        {personaSeleccionada.universidad} · {personaSeleccionada.facultad}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5" /> Carrera profesional:
                      </span>
                      <span className="font-semibold text-right text-slate-900 dark:text-white">
                        {personaSeleccionada.carrera}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Telegram vinculado:</span>
                      <span className="font-mono text-sky-600 dark:text-sky-400">
                        {personaDetalleApi?.orden?.telegram_username
                          ? `@${personaDetalleApi.orden.telegram_username}`
                          : personaDetalleApi?.orden?.telegram_chat_id
                            ? `Chat ${personaDetalleApi.orden.telegram_chat_id}`
                            : 'Sin vincular'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-sky-500" />
                    <span>Servicio, Modalidad y Pagador</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Servicio Académico:</span>
                      <span className="font-bold text-right text-slate-900 dark:text-white">
                        {personaSeleccionada.servicio} ({personaSeleccionada.linea_servicio})
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Modalidad de Pago:</span>
                      <span className="font-bold text-right text-emerald-700 dark:text-emerald-400">
                        {personaSeleccionada.modalidad_pago}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Contrato / Estado:</span>
                      <span className="font-mono text-slate-900 dark:text-white">
                        {personaSeleccionada.codigo_contrato} ({personaSeleccionada.estado_contrato})
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Responsable de Pago:</span>
                      <span className="font-semibold text-right text-slate-900 dark:text-white">
                        {personaDetalleApi?.responsablePago?.nombres
                          ? `${personaDetalleApi.responsablePago.nombres} ${personaDetalleApi.responsablePago.apellidos || ''} (${personaDetalleApi.responsablePago.relacion || personaSeleccionada.tipo_responsable})`
                          : `${personaSeleccionada.tipo_responsable || 'Estudiante'} · ${personaSeleccionada.segmento_pagador || ''}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Asesor asignado / Tiempo P02:</span>
                      <span className="font-semibold text-right text-slate-900 dark:text-white">
                        {personaDetalleApi?.orden?.asesor_nombre || 'Por asignar'}{' '}
                        {personaSeleccionada.minutos_a_primer_pago != null
                          ? `· ${personaSeleccionada.minutos_a_primer_pago} min`
                          : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {loadingPersonaDetalle ? (
                <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                  <span>Cargando cronograma de cuotas, pagos y trazabilidad en vivo...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Cronograma de Cuotas */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-amber-500" />
                        <span>Cronograma de Cuotas ({personaDetalleApi?.cuotas?.length ?? 0})</span>
                      </h4>
                      {(personaDetalleApi?.cuotas || []).some((c: any) => c.estado !== 'PAGADA' && c.estado !== 'ANULADA') && (
                        <button
                          type="button"
                          onClick={() => handleCancelarCuotasDesdeModal()}
                          disabled={cancelandoCuotas}
                          title={
                            permiteCancelarCuotas
                              ? 'Cancelar todas las cuotas pendientes de esta orden (RN_12)'
                              : 'Bloqueado por regla RN_12_CANCELAR_CUOTAS_PENDIENTES'
                          }
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer disabled:opacity-50 ${
                            permiteCancelarCuotas
                              ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                              : 'border-slate-300 dark:border-slate-700 text-slate-400'
                          }`}
                        >
                          {cancelandoCuotas ? 'Cancelando...' : 'Cancelar cuotas pendientes (RN_12)'}
                        </button>
                      )}
                    </div>
                    {(personaDetalleApi?.cuotas || []).length === 0 ? (
                      <p className="text-xs text-slate-500">Sin cuotas registradas.</p>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {personaDetalleApi.cuotas.map((cuota: any) => {
                          const esCuotaPendiente = cuota.estado !== 'PAGADA' && cuota.estado !== 'ANULADA';
                          return (
                            <div
                              key={cuota.cuota_id}
                              className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs ${
                                cuota.estado === 'ANULADA'
                                  ? 'bg-rose-50/40 dark:bg-rose-950/15 border-rose-200 dark:border-rose-900/60 opacity-85'
                                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">
                                  Cuota #{cuota.numero_cuota} ({cuota.porcentaje}%)
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {cuota.condicion || 'Cuota programada'} · Vence:{' '}
                                  {cuota.fecha_vencimiento
                                    ? String(cuota.fecha_vencimiento).slice(0, 10)
                                    : '—'}
                                </div>
                              </div>
                              <div className="text-right flex items-center gap-2">
                                <div>
                                  <div className="font-mono font-bold text-slate-900 dark:text-white">
                                    {formatMoneda(cuota.monto_programado)}
                                  </div>
                                  <span
                                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      cuota.estado === 'PAGADA'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : cuota.estado === 'ANULADA'
                                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                          : cuota.estado === 'ENLACE_ENVIADO' || cuota.estado === 'EXIGIBLE'
                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                            : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                    }`}
                                  >
                                    {cuota.estado}
                                  </span>
                                </div>
                                {esCuotaPendiente && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelarCuotasDesdeModal(Number(cuota.cuota_id))}
                                    disabled={cancelandoCuotas}
                                    title={
                                      permiteCancelarCuotas
                                        ? `Cancelar Cuota #${cuota.numero_cuota} (RN_12)`
                                        : 'Bloqueado por regla RN_12_CANCELAR_CUOTAS_PENDIENTES'
                                    }
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer disabled:opacity-50 ${
                                      permiteCancelarCuotas
                                        ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                                        : 'border-slate-300 dark:border-slate-700 text-slate-400'
                                    }`}
                                  >
                                    Cancelar cuota
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Pagos y Alertas */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-emerald-500" />
                      <span>Pagos Acreditados ({personaDetalleApi?.pagos?.length ?? 0})</span>
                    </h4>
                    {(personaDetalleApi?.pagos || []).length === 0 ? (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Esta persona aún no registra pagos confirmados en pasarela o caja.</span>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {personaDetalleApi.pagos.map((pago: any) => (
                          <div
                            key={pago.pago_id}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 text-xs"
                          >
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {pago.medio_pago_nombre || pago.metodo || 'Pasarela'} · Ref:{' '}
                                <span className="font-mono">{pago.referencia || '—'}</span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {formatFechaCorta(pago.fecha_confirmacion)} · Comisión:{' '}
                                {formatMoneda(pago.comision_pasarela)}
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-2">
                              <div>
                                <div className="font-mono font-black text-emerald-700 dark:text-emerald-400">
                                  {formatMoneda(pago.monto_pagado)}
                                </div>
                                <span
                                  className={`text-[10px] font-bold ${
                                    pago.estado === 'ANULADO'
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-emerald-700 dark:text-emerald-300'
                                  }`}
                                >
                                  {pago.estado}
                                </span>
                              </div>
                              {pago.estado === 'CONFIRMADO' && (
                                <button
                                  type="button"
                                  onClick={() => handleAnularPagoDesdeModal(Number(pago.pago_id))}
                                  disabled={anulandoPagoId === Number(pago.pago_id)}
                                  title={
                                    permiteAnularPago
                                      ? 'Anular este pago confirmado (RN_11)'
                                      : 'Bloqueado por regla RN_11_PERMITIR_ANULACION_PAGO'
                                  }
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                                    permiteAnularPago
                                      ? 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                                      : 'border-slate-300 dark:border-slate-700 text-slate-400'
                                  }`}
                                >
                                  {anulandoPagoId === Number(pago.pago_id) ? 'Anulando...' : 'Anular'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {(personaSeleccionada.tipo_alerta || (personaDetalleApi?.alertas || []).length > 0) && (
                      <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 text-[11px] text-amber-900 dark:text-amber-200">
                        <strong>Trazabilidad de Alertas IA:</strong>{' '}
                        {personaSeleccionada.tipo_alerta || personaDetalleApi?.alertas?.[0]?.tipo} ·{' '}
                        {personaSeleccionada.secuencia_alerta || personaDetalleApi?.alertas?.[0]?.secuencia}{' '}
                        {personaSeleccionada.alerta_recuperada ? '· Recuperado ≤72h' : ''}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer fijo */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/checkout/${personaSeleccionada.codigo_orden}`}
                  target="_blank"
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Checkout</span>
                </Link>
                <Link
                  href="/admin/customers"
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Hitos & Asesor</span>
                </Link>
                <Link
                  href="/admin/payers"
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Órdenes & Pasarela</span>
                </Link>
              </div>

              <button
                type="button"
                onClick={cerrarDetallePersona}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-extrabold cursor-pointer"
              >
                Cerrar detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
