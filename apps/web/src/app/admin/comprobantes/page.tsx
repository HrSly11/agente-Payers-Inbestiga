'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  Filter,
  Download,
  Printer,
  Eye,
  CheckCircle2,
  Clock,
  DollarSign,
  CreditCard,
  Building2,
  ShieldCheck,
  X,
  ExternalLink,
  GraduationCap,
  Calendar,
  Sparkles,
  ChevronRight,
  Receipt,
  QrCode,
  Share2,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function ComprobantesPage() {
  const [pagos, setPagos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [filtroMetodo, setFiltroMetodo] = useState('TODOS');

  // Modal de Previsualización
  const [modalOpen, setModalOpen] = useState(false);
  const [comprobanteData, setComprobanteData] = useState<any | null>(null);
  const [loadingComprobante, setLoadingComprobante] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const handleSincronizarCulqi = async () => {
    setSyncing(true);
    try {
      const res = await api.sincronizarPagosCulqi();
      await fetchPagos();
      alert(res?.mensaje || 'Eventos de Culqi Webhook procesados y conciliados exitosamente.');
    } catch (err: any) {
      alert(`Error al sincronizar con Culqi: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const fetchPagos = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (filtroEstado !== 'TODOS') params.estado = filtroEstado;
      if (filtroMetodo !== 'TODOS') params.metodoPago = filtroMetodo;

      const data = await api.getComprobantes(params);
      setPagos(data || []);
    } catch (err) {
      console.error('Error cargando comprobantes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPagos();
  }, [filtroEstado, filtroMetodo]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPagos();
  };

  const abrirPrevisualizacion = async (pagoId: string) => {
    setModalOpen(true);
    setLoadingComprobante(true);
    try {
      const data = await api.getComprobanteById(pagoId);
      setComprobanteData(data);
    } catch (err: any) {
      alert(`Error al cargar el comprobante: ${err.message}`);
      setModalOpen(false);
    } finally {
      setLoadingComprobante(false);
    }
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setComprobanteData(null);
  };

  // Función de Impresión / Descarga en PDF
  const handlePrintPdf = () => {
    window.print();
  };

  // Cálculos de Resumen
  const totalRecaudado = pagos
    .filter((p) => p.estado === 'CONFIRMADO')
    .reduce((acc, p) => acc + (p.monto || 0), 0);
  const confirmadosCount = pagos.filter((p) => p.estado === 'CONFIRMADO').length;
  const pendientesCount = pagos.filter((p) => p.estado === 'PENDIENTE').length;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Estilos específicos para impresión @media print (A4 limpio y elegante) */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #seccion-comprobante-impresion,
          #seccion-comprobante-impresion * {
            visibility: visible;
          }
          #seccion-comprobante-impresion {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-sky-300 text-xs font-bold border border-blue-200 dark:border-blue-500/20 mb-2">
            <Receipt className="w-3.5 h-3.5" />
            <span>Facturación Electrónica & Pasarela Culqi</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            Panel de Comprobantes de Pago
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Auditoría de boletas de venta electrónicas de tesistas, trazabilidad de transacciones Culqi Express y descarga oficial en PDF.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold shadow-xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span>Webhook Culqi Automático (200 OK)</span>
          </div>

          <button
            onClick={handleSincronizarCulqi}
            disabled={syncing}
            className="p-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-60"
            title="Verificar estado de eventos y sincronización en tiempo real"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/admin/customers"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 dark:hover:bg-purple-900/80 text-purple-800 dark:text-purple-300 transition-colors flex items-center gap-1.5"
          >
            <span>Ir a Bitácora Tesistas</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/60 shadow-xs">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Recaudado (PEN)</p>
            <h3 className="font-heading text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              S/ {totalRecaudado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Acreditado en cuenta</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/60 shadow-xs">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Comprobantes Emitidos</p>
            <h3 className="font-heading text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              {confirmadosCount}
            </h3>
            <p className="text-[10px] text-emerald-600 font-bold mt-0.5">✓ Pagos confirmados</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/60 shadow-xs">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pagos Pendientes</p>
            <h3 className="font-heading text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
              {pendientesCount}
            </h3>
            <p className="text-[10px] text-amber-600 font-medium mt-0.5">Esperando confirmación Culqi</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/60 shadow-xs">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pasarela Oficial</p>
            <h3 className="font-heading text-lg font-black text-purple-700 dark:text-purple-300 mt-0.5 flex items-center gap-1.5">
              <span>CULQI EXPRESS</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Yape + Tarjetas (Credicorp)</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por tesista, WhatsApp o ID Culqi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Estado:</span>
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="CONFIRMADO">Confirmados (Acreditados)</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="EXPIRADO">Reemplazados / Expirados</option>
          </select>

          <select
            value={filtroMetodo}
            onChange={(e) => setFiltroMetodo(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="TODOS">Todos los Métodos</option>
            <option value="YAPE">Yape (Culqi)</option>
            <option value="CARD">Tarjetas de Débito/Crédito</option>
            <option value="TRANSFER">Transferencia Directa</option>
          </select>
        </div>
      </div>

      {/* Comprobantes Table */}
      <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md bg-white dark:bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">N.° Boleta</th>
                <th className="py-3.5 px-4">Tesista / Estudiante</th>
                <th className="py-3.5 px-4">Universidad & Carrera</th>
                <th className="py-3.5 px-4">Monto & Plan de Cuotas</th>
                <th className="py-3.5 px-4">Canal / Pasarela</th>
                <th className="py-3.5 px-4">Fecha & Estado</th>
                <th className="py-3.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-transparent">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mr-2 align-middle" />
                    Cargando comprobantes electrónicos...
                  </td>
                </tr>
              ) : pagos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    No se encontraron pagos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                pagos.map((p) => {
                  const esConfirmado = p.estado === 'CONFIRMADO';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      {/* N.° Boleta */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-purple-700 dark:text-purple-300 text-xs bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                          {p.serieNumero}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Cot: {p.cotizacion?.codigoCotizacion || 'COT-2026'}
                        </div>
                      </td>

                      {/* Tesista */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {p.estudiante?.nombres}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                          📱 {p.estudiante?.whatsapp}
                        </div>
                      </td>

                      {/* Universidad & Carrera */}
                      <td className="py-3.5 px-4 max-w-[180px]">
                        <div className="text-slate-800 dark:text-slate-200 font-medium truncate">
                          {p.estudiante?.universidad}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {p.estudiante?.carrera}
                        </div>
                      </td>

                      {/* Monto & Plan de Cuotas */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-heading font-black text-sm text-slate-900 dark:text-white">
                          S/ {Number(p.monto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </div>
                        {p.planCuotas?.esCuotas ? (
                          <div className="mt-0.5 space-y-0.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                p.planCuotas.estaCanceladoTotal
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300'
                                  : p.planCuotas.cuotasPagadas > 0
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300'
                              }`}
                            >
                              {p.planCuotas.estaCanceladoTotal
                                ? `✓ ${p.planCuotas.cuotasAcordadas}/${p.planCuotas.cuotasAcordadas} Cuotas (Cancelado)`
                                : p.planCuotas.cuotasPagadas > 0
                                ? `Cuota ${p.planCuotas.cuotasPagadas}/${p.planCuotas.cuotasAcordadas} Pagada`
                                : `⏳ Pendiente Cuota 1/${p.planCuotas.cuotasAcordadas}`}
                            </span>
                            {p.planCuotas.saldoPendiente > 0 && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                Saldo: S/ {Number(p.planCuotas.saldoPendiente).toFixed(2)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 mt-0.5">
                            Contado (100%)
                          </span>
                        )}
                      </td>

                      {/* Canal / Pasarela */}
                      <td className="py-3.5 px-4 max-w-[170px]">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.metodoPago === 'YAPE'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                                : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
                            }`}
                          >
                            {p.metodoPago}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 truncate">
                            {p.gatewayProveedor}
                          </span>
                        </div>
                        {p.gatewayTransactionId && (
                          <div className="font-mono text-[9px] text-slate-400 truncate max-w-[140px] mt-0.5" title={p.gatewayTransactionId}>
                            {p.gatewayTransactionId}
                          </div>
                        )}
                      </td>

                      {/* Fecha & Estado */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-slate-700 dark:text-slate-300 text-xs">
                          {new Date(p.fechaConfirmacion || p.fechaCreacion).toLocaleDateString()}
                        </div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mt-0.5 ${
                            esConfirmado
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30'
                              : p.estado === 'EXPIRADO'
                              ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30'
                          }`}
                        >
                          {p.estado === 'EXPIRADO' ? 'REEMPLAZADO' : p.estado}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {p.estado === 'PENDIENTE' && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800" title="La confirmación es 100% automática por Webhook de Culqi en cuanto el tesista yapee o pague">
                              <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                              <span>Esperando Pago Culqi (Automático)</span>
                            </div>
                          )}
                          {p.estado === 'EXPIRADO' && (
                            <span className="text-[10px] text-slate-400 font-mono italic">
                              Reemplazado por pago posterior
                            </span>
                          )}
                          {esConfirmado && (
                            <button
                              onClick={() => abrirPrevisualizacion(p.id)}
                              className="px-3 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-600 hover:to-sky-500 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Previsualizar Boleta</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE PREVISUALIZACIÓN Y DESCARGA DEL COMPROBANTE ELECTRÓNICO (PDF)    */}
      {/* ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-3xl max-h-[94vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between gap-3 shrink-0 no-print">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    Previsualización de Comprobante Electrónico
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Formato oficial de Boleta de Venta Electrónica SUNAT / SUNEDU
                  </p>
                </div>
              </div>

              {/* Botones Header */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintPdf}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="Imprimir o guardar directamente como PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / Descargar PDF</span>
                </button>
                <button
                  onClick={cerrarModal}
                  className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: COMPROBANTE OFICIAL (Imprimible) */}
            <div className="p-5 sm:p-8 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-950">
              {loadingComprobante || !comprobanteData ? (
                <div className="py-20 text-center text-slate-500">
                  <span className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent mr-2 align-middle" />
                  <p className="mt-2 text-xs">Cargando comprobante oficial...</p>
                </div>
              ) : (
                <div
                  id="seccion-comprobante-impresion"
                  ref={printAreaRef}
                  className="bg-white text-slate-900 p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-300 max-w-2xl mx-auto space-y-6 text-xs font-sans"
                >
                  {/* Fila 1: Datos Emisor & Recuadro Boleta Electrónica */}
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b border-slate-200 pb-5">
                    {/* Emisor */}
                    <div className="space-y-1 sm:max-w-[340px]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold text-xs">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <span className="font-heading font-black text-base text-blue-900 tracking-tight">
                          INBESTIGA<span className="text-blue-600">.TESIS</span>
                        </span>
                      </div>
                      <p className="font-bold text-[11px] text-slate-800 leading-tight">
                        {comprobanteData.emisor.razonSocial}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        {comprobanteData.emisor.direccion}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Telf: {comprobanteData.emisor.telefono} • Email: {comprobanteData.emisor.email}
                      </p>
                    </div>

                    {/* Recuadro Oficial RUC SUNAT */}
                    <div className="w-full sm:w-60 border-2 border-slate-900 rounded-xl p-3 text-center bg-slate-50/50 shrink-0">
                      <p className="font-mono font-bold text-xs text-slate-800">
                        R.U.C. {comprobanteData.emisor.ruc}
                      </p>
                      <div className="my-1 py-1 px-2 bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded">
                        {comprobanteData.comprobante.tipo}
                      </div>
                      <p className="font-mono font-black text-sm text-blue-800">
                        N.° {comprobanteData.comprobante.serieNumero}
                      </p>
                    </div>
                  </div>

                  {/* Fila 2: Datos del Cliente (Tesista) */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 font-bold block text-[10px] uppercase">Señor(a) / Tesista:</span>
                      <strong className="text-slate-900 text-xs">{comprobanteData.cliente.nombreCompleto}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block text-[10px] uppercase">Fecha de Emisión:</span>
                      <span className="font-semibold text-slate-800">
                        {new Date(comprobanteData.comprobante.fechaEmision).toLocaleDateString()} a las {new Date(comprobanteData.comprobante.fechaEmision).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block text-[10px] uppercase">Universidad & Carrera:</span>
                      <span className="text-slate-800 font-medium">
                        {comprobanteData.cliente.universidad} • {comprobanteData.cliente.carrera}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block text-[10px] uppercase">Modalidad / Investigación:</span>
                      <span className="text-slate-800 font-medium">{comprobanteData.cliente.tipoInvestigacion}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block text-[10px] uppercase">Contacto Registrado:</span>
                      <span className="font-mono text-slate-700">{comprobanteData.cliente.whatsapp}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block text-[10px] uppercase">Condición de Pago:</span>
                      <span className="font-bold text-emerald-700">{comprobanteData.comprobante.formaPago}</span>
                    </div>
                  </div>

                  {/* Fila 3: Tabla Detalle de Items */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px] border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 text-center">Cant.</th>
                          <th className="py-2 px-3">Descripción del Servicio</th>
                          <th className="py-2 px-3 text-right">P. Unitario</th>
                          <th className="py-2 px-3 text-right">Importe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {comprobanteData.detalleItems.map((it: any) => (
                          <tr key={it.item}>
                            <td className="py-3 px-3 text-center font-bold text-slate-700">{it.cantidad}</td>
                            <td className="py-3 px-3">
                              <p className="font-bold text-slate-900">{it.descripcion}</p>
                              <p className="text-[10px] text-slate-500">Unidad: {it.unidadMedida}</p>
                            </td>
                            <td className="py-3 px-3 text-right font-mono">
                              S/ {Number(it.precioUnitario).toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              S/ {Number(it.importeTotal).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Fila 4: Totales Financieros & Letras */}
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4 pt-1">
                    <div className="space-y-1 max-w-sm">
                      <p className="font-bold text-[10px] text-slate-500 uppercase">Importe Total en Letras:</p>
                      <p className="font-mono text-xs font-bold text-slate-800 bg-slate-50 p-2 rounded border border-slate-200">
                        {comprobanteData.totales.totalPagarLetras}
                      </p>
                    </div>

                    <div className="w-full sm:w-60 space-y-1 text-xs font-mono">
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>Op. Exonerada:</span>
                        <span>S/ {comprobanteData.totales.opExonerada.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>I.G.V. (0% Exon.):</span>
                        <span>S/ 0.00</span>
                      </div>
                      <div className="flex justify-between border-t-2 border-slate-900 pt-1 text-sm font-black text-slate-900">
                        <span>TOTAL ABONADO HOY:</span>
                        <span className="text-blue-900">S/ {comprobanteData.totales.totalPagar.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Fila 4.5: Plan de Cuotas & Cronograma Oficial SUNAT / SUNEDU */}
                  {comprobanteData.planCuotas?.esCuotas ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                          <Calendar className="w-4 h-4 text-purple-700" />
                          <span>Plan de Financiamiento en {comprobanteData.planCuotas.cuotasAcordadas} Cuotas</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          comprobanteData.planCuotas.estaCanceladoTotal
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {comprobanteData.planCuotas.estadoTexto}
                        </span>
                      </div>

                      {/* Resumen 4 Métricas de Cuotas */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px]">
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block uppercase font-semibold">Total Contrato</span>
                          <strong className="font-mono text-xs text-slate-900">
                            S/ {Number(comprobanteData.planCuotas.totalContrato || comprobanteData.totales.totalPagar).toFixed(2)}
                          </strong>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block uppercase font-semibold">Monto x Cuota</span>
                          <strong className="font-mono text-xs text-purple-700">
                            S/ {Number(comprobanteData.planCuotas.montoPorCuota || comprobanteData.totales.totalPagar).toFixed(2)}
                          </strong>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block uppercase font-semibold">Total Abonado</span>
                          <strong className="font-mono text-xs text-emerald-600">
                            S/ {Number(comprobanteData.planCuotas.totalAbonado || comprobanteData.totales.totalPagar).toFixed(2)}
                          </strong>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block uppercase font-semibold">Saldo Pendiente</span>
                          <strong className={`font-mono text-xs ${comprobanteData.planCuotas.saldoPendiente > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            S/ {Number(comprobanteData.planCuotas.saldoPendiente || 0).toFixed(2)}
                          </strong>
                        </div>
                      </div>

                      {/* Tabla de Cronograma de Cuotas */}
                      {comprobanteData.planCuotas.cronograma?.length > 0 && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                          <table className="w-full text-left text-[10px]">
                            <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[9px] border-b border-slate-200">
                              <tr>
                                <th className="py-1.5 px-3">N.° Cuota</th>
                                <th className="py-1.5 px-3">Concepto</th>
                                <th className="py-1.5 px-3 text-right">Importe</th>
                                <th className="py-1.5 px-3 text-center">Vencimiento</th>
                                <th className="py-1.5 px-3 text-center">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {comprobanteData.planCuotas.cronograma.map((c: any) => (
                                <tr key={c.numero} className={c.estado === 'PAGADA' ? 'bg-emerald-50/40' : ''}>
                                  <td className="py-2 px-3 font-bold text-slate-800">Cuota {c.numero}</td>
                                  <td className="py-2 px-3 font-sans text-slate-700">{c.concepto}</td>
                                  <td className="py-2 px-3 text-right font-bold text-slate-900">S/ {Number(c.monto).toFixed(2)}</td>
                                  <td className="py-2 px-3 text-center font-sans text-slate-500">{c.vencimiento}</td>
                                  <td className="py-2 px-3 text-center font-sans">
                                    {c.estado === 'PAGADA' ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                        ✓ PAGADA
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                        ⏳ PENDIENTE
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 font-medium">Condición Contractual:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full text-[10px]">
                        ✓ PAGO AL CONTADO (100% CANCELADO - SIN SALDO PENDIENTE)
                      </span>
                    </div>
                  )}

                  {/* Fila 5: Conciliación Pasarela Culqi & Código QR */}
                  <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-purple-900">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Validación en Pasarela de Pagos Culqi Express</span>
                      </div>
                      <p className="text-[10px] text-slate-600">
                        Transacción Culqi ID: <span className="font-mono font-bold text-purple-800">{comprobanteData.pasarela.transaccionId}</span>
                      </p>
                      <p className="text-[10px] text-slate-600">
                        Medio de pago: <strong className="uppercase">{comprobanteData.pasarela.metodo}</strong> • Estado: <strong className="text-emerald-700">PAGO ACREDITADO (200 OK)</strong>
                      </p>
                    </div>

                    {/* QR Code Demo SVG */}
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-purple-200 shrink-0">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded flex items-center justify-center font-mono text-[9px] text-center leading-tight">
                        QR CULQI
                      </div>
                      <div className="text-[9px] text-slate-500 leading-tight">
                        <p className="font-bold text-slate-700">Verificación Digital</p>
                        <p>Hash: {comprobanteData.seguridadSunat.codigoHash.substring(0, 10)}...</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer Leyenda */}
                  <div className="text-center pt-2 border-t border-slate-200 text-[9px] text-slate-400">
                    {comprobanteData.seguridadSunat.leyenda}
                    <br />
                    INBESTIGA.TESIS • Sistema de Inteligencia de Negocios para Titulación Universitaria
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0 no-print">
              <span className="text-xs text-slate-500">
                Puedes imprimir directamente o utilizar la opción "Guardar como PDF" de tu navegador.
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={cerrarModal}
                  className="px-4 py-2 text-xs font-bold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  onClick={handlePrintPdf}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-600 hover:to-sky-500 text-white shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar / Imprimir en PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
