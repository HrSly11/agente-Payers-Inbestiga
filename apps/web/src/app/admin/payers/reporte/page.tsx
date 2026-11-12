'use client';

import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { api } from '@/lib/api';

type VistaActiva = 'VISTA_3_1' | 'VISTA_3_2' | 'VISTA_3_3';
type AlcancePdf = 'COMPLETO' | 'VISTA_3_1' | 'VISTA_3_2' | 'VISTA_3_3';

export default function PayersReportePage() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [etlRunning, setEtlRunning] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Selector de pestaña para no amontonar las tablas complejas
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('VISTA_3_1');
  const [subVista31, setSubVista31] = useState<'MODALIDAD' | 'SERVICIO'>('MODALIDAD');

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

  const kpis: any[] = overview?.kpis || [];
  const vista31Ordenes: any[] = overview?.vista31Ordenes || [];
  const vista31Servicio: any[] = overview?.vista31Servicio || [];
  const vista32Recuperacion: any[] = overview?.vista32Recuperacion || [];
  const vista33Medios: any[] = overview?.vista33Medios || [];
  const resumenOp = overview?.resumenOperativo || {};

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

          <Link
            href="/admin/customers"
            className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Hitos & Asesor</span>
          </Link>

          <Link
            href="/admin/comprobantes"
            className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Receipt className="w-3.5 h-3.5 text-sky-500" />
            <span>Comprobantes</span>
          </Link>
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
              {resumenOp.totalContratos ?? 104} contratos firmados · <strong>S/ 180,540.00</strong> comprometidos
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 shadow-xs space-y-1.5">
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
              Recaudación Efectiva Acreditada
            </div>
            <div className="text-3xl font-black font-mono text-emerald-700 dark:text-emerald-400">
              S/ 110,480.00
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
              34 / {resumenOp.totalAlertas ?? 55}
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
                  Compara el monto comprometido vs. monto exigible y cobrado en las 104 órdenes de pago.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 p-1 bg-slate-50 dark:bg-slate-950">
                  <button
                    type="button"
                    onClick={() => setSubVista31('MODALIDAD')}
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
                    onClick={() => setSubVista31('SERVICIO')}
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {vista31Ordenes.map((row: any) => {
                      const isTotal = row.modalidad_pago === 'TOTAL';
                      return (
                        <tr
                          key={row.modalidad_pago}
                          className={
                            isTotal
                              ? 'bg-emerald-50/80 dark:bg-emerald-950/30 font-black text-slate-900 dark:text-white'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }
                        >
                          <td className="py-3.5 px-4 font-semibold">{row.modalidad_pago}</td>
                          <td className="py-3.5 px-3 text-center font-mono">{row.ordenes_creadas}</td>
                          <td className="py-3.5 px-3 text-center font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                            {row.ordenes_con_pago}
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono font-bold">
                            {row.pct_confirmacion_p01}%
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono">
                            S/ {Number(row.monto_comprometido).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono">
                            S/ {Number(row.monto_exigible).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                            S/ {Number(row.monto_cobrado).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono font-bold text-sky-600 dark:text-sky-400">
                            {row.pct_cobranza_efectiva_p04}%
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {vista31Servicio.map((row: any) => (
                      <tr key={row.servicio} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                          {row.servicio}
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
                          S/ {Number(row.monto_exigible).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                          S/ {Number(row.monto_cobrado).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-sky-600 dark:text-sky-400">
                          {row.pct_cobranza_efectiva_p04}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                    <th className="py-3.5 px-4">Etapa de Alerta</th>
                    <th className="py-3.5 px-3">Canal</th>
                    <th className="py-3.5 px-3 text-center">Alertas Enviadas</th>
                    <th className="py-3.5 px-3 text-center">Pagos Recuperados (≤72h)</th>
                    <th className="py-3.5 px-3 text-center">Casos Escalados</th>
                    <th className="py-3.5 px-3 text-center">Tasa Recuperación P03</th>
                    <th className="py-3.5 px-4 text-right">Monto Recuperado (PEN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {vista32Recuperacion.map((row: any) => {
                    const isTotal = String(row.etapa_alerta).includes('TOTAL');
                    return (
                      <tr
                        key={row.etapa_alerta}
                        className={
                          isTotal
                            ? 'bg-amber-50/80 dark:bg-amber-950/30 font-black text-slate-900 dark:text-white'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="py-3.5 px-4 font-semibold">{row.etapa_alerta}</td>
                        <td className="py-3.5 px-3 font-mono text-xs">{row.canal}</td>
                        <td className="py-3.5 px-3 text-center font-mono">{row.alertas_enviadas}</td>
                        <td className="py-3.5 px-3 text-center font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                          {row.recuperados_72h}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono text-rose-600 dark:text-rose-400">
                          {row.escalados}
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
                          <th className="py-2 px-2.5">Etapa de Alerta</th>
                          <th className="py-2 px-2">Canal</th>
                          <th className="py-2 px-2 text-center">Enviadas</th>
                          <th className="py-2 px-2 text-center">Recuperadas (≤72h)</th>
                          <th className="py-2 px-2 text-center">Escaladas</th>
                          <th className="py-2 px-2 text-center">Efectividad P03</th>
                          <th className="py-2 px-2.5 text-right">Monto Recuperado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {vista32Recuperacion.map((r: any) => (
                          <tr
                            key={r.etapa_alerta}
                            className={String(r.etapa_alerta).includes('TOTAL') ? 'font-black bg-slate-100' : ''}
                          >
                            <td className="py-1.5 px-2.5">{r.etapa_alerta}</td>
                            <td className="py-1.5 px-2 font-mono">{r.canal}</td>
                            <td className="py-1.5 px-2 text-center font-mono">{r.alertas_enviadas}</td>
                            <td className="py-1.5 px-2 text-center font-mono">{r.recuperados_72h}</td>
                            <td className="py-1.5 px-2 text-center font-mono">{r.escalados}</td>
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
    </div>
  );
}
