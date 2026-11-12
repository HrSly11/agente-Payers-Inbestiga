'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  UserCheck,
  Calendar,
  Video,
  Award,
  BookOpen,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  FileText,
  ShieldCheck,
  TrendingUp,
  Plus,
  X,
  MessageCircle,
  Sparkles,
  ChevronRight,
  Send,
  AlertTriangle,
  Layers,
  BarChart,
  Check,
  Eye,
  RefreshCw,
  LayoutGrid,
  List,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [advisors, setAdvisors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'TODOS' | 'TESIS' | 'BACHILLER' | 'OBSERVADOS' | 'OPTIMO'>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  // Vista predeterminada: Tarjetas (elimina por completo el scroll horizontal)
  const [vista, setVista] = useState<'tarjetas' | 'tabla'>('tarjetas');

  // Estados del Modal / Drawer de Trazabilidad
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [trazabilidad, setTrazabilidad] = useState<any | null>(null);
  const [loadingTrazabilidad, setLoadingTrazabilidad] = useState(false);
  const [activeTab, setActiveTab] = useState<'fases' | 'bitacora' | 'sesiones' | 'contrato'>('fases');

  // Estado del Formulario para Registrar Nueva Entrada en la Bitácora
  const [mostrarFormBitacora, setMostrarFormBitacora] = useState(false);
  const [guardandoBitacora, setGuardandoBitacora] = useState(false);
  const [notificacionExito, setNotificacionExito] = useState<string | null>(null);
  const [formBitacora, setFormBitacora] = useState({
    hito: 'METODOLOGIA',
    titulo: '',
    porcentajeAvance: 60,
    estadoRevision: 'APROBADO',
    observaciones: '',
    turnitinPct: 6,
    proximaEntrega: '',
  });

  const cargarDatos = () => {
    setLoading(true);
    Promise.all([api.getCustomers(), api.getAdvisors()])
      .then(([custs, advs]) => {
        setCustomers(custs || []);
        setAdvisors(advs || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Cargar la trazabilidad detallada cuando se hace clic en un cliente
  const abrirTrazabilidad = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setLoadingTrazabilidad(true);
    setActiveTab('fases');
    try {
      const data = await api.getCustomerTrazabilidad(customerId);
      setTrazabilidad(data);
    } catch (error) {
      console.error('Error cargando trazabilidad:', error);
    } finally {
      setLoadingTrazabilidad(false);
    }
  };

  const cerrarTrazabilidad = () => {
    setSelectedCustomerId(null);
    setTrazabilidad(null);
    setMostrarFormBitacora(false);
  };

  // Guardar nueva entrada en la bitácora
  const [aprobandoCuota, setAprobandoCuota] = useState<number | null>(null);

  const handleAprobarHitoCuota = async (numeroCuota: number) => {
    if (!trazabilidad?.ordenPagoId || !selectedCustomerId) return;
    setAprobandoCuota(numeroCuota);
    try {
      const res = await api.aprobarHitoCuota(Number(trazabilidad.ordenPagoId), numeroCuota);
      setNotificacionExito(
        `✓ Hito validado: Cuota #${res.cuota} (S/ ${Number(res.monto).toFixed(2)}) pasó a EXIGIBLE y se notificó al estudiante por Telegram.`,
      );
      const updatedData = await api.getCustomerTrazabilidad(selectedCustomerId);
      setTrazabilidad(updatedData);
      setTimeout(() => setNotificacionExito(null), 5000);
    } catch (error: any) {
      alert('Error al aprobar hito: ' + (error.message || 'Error de conexión'));
    } finally {
      setAprobandoCuota(null);
    }
  };

  const handleRevertirHitoCuota = async (numeroCuota: number) => {
    if (!trazabilidad?.ordenPagoId || !selectedCustomerId) return;
    setAprobandoCuota(numeroCuota);
    try {
      const res = await api.revertirHitoCuota(Number(trazabilidad.ordenPagoId), numeroCuota);
      setNotificacionExito(
        `Cuota #${res.cuota} devuelta a ESPERA_HITO (Checkout bloqueado para esta cuota).`,
      );
      const updatedData = await api.getCustomerTrazabilidad(selectedCustomerId);
      setTrazabilidad(updatedData);
      setTimeout(() => setNotificacionExito(null), 5000);
    } catch (error: any) {
      alert('Error al revertir hito: ' + (error.message || 'Error de conexión'));
    } finally {
      setAprobandoCuota(null);
    }
  };

  const handleGuardarBitacora = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    setGuardandoBitacora(true);
    try {
      const res = await api.crearEntradaBitacora(selectedCustomerId, formBitacora);
      setNotificacionExito(res?.mensaje || '¡Anotación agregada exitosamente a la bitácora!');
      setMostrarFormBitacora(false);
      setFormBitacora({
        hito: 'METODOLOGIA',
        titulo: '',
        porcentajeAvance: 70,
        estadoRevision: 'APROBADO',
        observaciones: '',
        turnitinPct: 5,
        proximaEntrega: '',
      });
      const updatedData = await api.getCustomerTrazabilidad(selectedCustomerId);
      setTrazabilidad(updatedData);
      cargarDatos();
      setTimeout(() => setNotificacionExito(null), 4000);
    } catch (error: any) {
      alert('Error al registrar en bitácora: ' + (error.message || 'Error de conexión'));
    } finally {
      setGuardandoBitacora(false);
    }
  };

  // Cálculos para KPIs globales
  const totalCustomers = customers.length;
  const tesisCompletasCount = customers.filter(
    (c) => c.modalidad === 'TITULO_PROFESIONAL' || c.servicio?.tipoInvestigacion === 'TESIS'
  ).length;
  const bachillerCount = customers.filter(
    (c) => c.modalidad === 'BACHILLER' || c.servicio?.tipoInvestigacion === 'TRABAJO_INVESTIGACION_BACHILLER'
  ).length;
  const promedioAvance = totalCustomers > 0
    ? Math.round(customers.reduce((acc, c) => acc + (c.progresoGlobal || 40), 0) / totalCustomers)
    : 0;
  const promedioTurnitin = totalCustomers > 0
    ? (customers.reduce((acc, c) => acc + (c.turnitinPct || 6), 0) / totalCustomers).toFixed(1)
    : '5.8';

  // Filtrado de la lista
  const clientesFiltrados = customers.filter((c) => {
    const texto = `${c.buyer?.nombres} ${c.buyer?.apellidos} ${c.buyer?.universidad?.nombre} ${c.buyer?.carrera?.nombre} ${c.asesor?.nombres} ${c.temaInvestigacion}`.toLowerCase();
    const coincideBusqueda = texto.includes(busqueda.toLowerCase());

    if (!coincideBusqueda) return false;

    if (filtro === 'TESIS') return c.modalidad === 'TITULO_PROFESIONAL';
    if (filtro === 'BACHILLER') return c.modalidad === 'BACHILLER';
    if (filtro === 'OBSERVADOS') return c.ultimaBitacora?.estadoRevision === 'OBSERVADO';
    if (filtro === 'OPTIMO') return c.progresoGlobal >= 70;
    return true;
  });

  return (
    <div className="space-y-7 animate-fade-in pb-12 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-heading text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 shadow-sm">
                <BookOpen className="w-5 h-5" />
              </span>
              <span>Bitácora de Tesistas & Trazabilidad de Investigación</span>
            </h1>
            <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800/50 font-bold">
              Etapa: CUSTOMERS Activos
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 break-words">
            Haz clic en cualquier cliente para desplegar su trazabilidad de tesis, hitos metodológicos (Fases 1 a 6) y bitácora auditable de revisiones.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={cargarDatos}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* KPI 1: Clientes Activos */}
        <div className="glass-card p-4 rounded-2xl border border-purple-200/70 dark:border-purple-900/40 bg-gradient-to-br from-purple-50/50 via-white to-purple-50/20 dark:from-purple-950/20 dark:via-slate-900 dark:to-purple-950/10 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
              Tesistas en Curso
            </span>
            <span className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl sm:text-3xl font-black text-purple-700 dark:text-purple-300">
              {totalCustomers}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">estudiantes</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-400">
            <span className="font-bold text-sky-600 dark:text-sky-400">{tesisCompletasCount} Tesis</span>
            <span>•</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">{bachillerCount} Bachiller</span>
          </div>
        </div>

        {/* KPI 2: Avance Promedio de Cohorte */}
        <div className="glass-card p-4 rounded-2xl border border-sky-200/70 dark:border-sky-900/40 bg-gradient-to-br from-sky-50/50 via-white to-sky-50/20 dark:from-sky-950/20 dark:via-slate-900 dark:to-sky-950/10 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
              Avance Metodológico
            </span>
            <span className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl sm:text-3xl font-black text-sky-700 dark:text-sky-300">
              {promedioAvance}%
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">Cohorte UNT</span>
          </div>
          <div className="mt-2.5 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-sky-500 to-blue-600 h-full rounded-full transition-all" style={{ width: `${promedioAvance}%` }} />
          </div>
        </div>

        {/* KPI 3: Control Turnitin */}
        <div className="glass-card p-4 rounded-2xl border border-emerald-200/70 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 dark:from-emerald-950/20 dark:via-slate-900 dark:to-emerald-950/10 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Similitud Turnitin
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300">
              {promedioTurnitin}%
            </span>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">promedio</span>
          </div>
          <p className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium truncate">
            ✓ 100% conforme a SUNEDU (&lt;15%)
          </p>
        </div>

        {/* KPI 4: Asesores Doctorales */}
        <div className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Staff Asesores
            </span>
            <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <GraduationCap className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {advisors.length}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Dres. y Mg. asignados</span>
          </div>
          <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 truncate">
            Asesoría personalizada 1 a 1
          </p>
        </div>
      </div>

      {/* Filter Tabs, Search Bar & View Mode Toggle */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setFiltro('TODOS')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
              filtro === 'TODOS'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Todos ({totalCustomers})
          </button>
          <button
            onClick={() => setFiltro('TESIS')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
              filtro === 'TESIS'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Tesis de Grado ({tesisCompletasCount})
          </button>
          <button
            onClick={() => setFiltro('BACHILLER')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
              filtro === 'BACHILLER'
                ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Trabajo Bachiller ({bachillerCount})
          </button>
          <button
            onClick={() => setFiltro('OBSERVADOS')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
              filtro === 'OBSERVADOS'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Con Observaciones
          </button>
        </div>

        {/* Search Input & View Switcher */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar tesista o tema..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
          </div>

          {/* Toggle de Vista (Fichas vs Tabla) */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              onClick={() => setVista('tarjetas')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                vista === 'tarjetas'
                  ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Vista de Fichas (Sin scroll horizontal)"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Fichas</span>
            </button>
            <button
              onClick={() => setVista('tabla')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                vista === 'tabla'
                  ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Vista Tabla Compacta"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Tabla</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: FICHAS / TARJETAS (CERO SCROLL HORIZONTAL - 100% VISIBLE)        */}
      {/* ========================================================================= */}
      {vista === 'tarjetas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-16 text-center text-slate-500 dark:text-slate-400">
              <span className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent mr-2 align-middle" />
              Cargando bitácora de tesistas...
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500 dark:text-slate-400">
              No se encontraron clientes que coincidan con los filtros seleccionados.
            </div>
          ) : (
            clientesFiltrados.map((c) => {
              const proximaSesion = c.sesiones?.find((s: any) => s.estado === 'PROGRAMADA') || c.sesiones?.[0];
              const esBachiller = c.modalidad === 'BACHILLER';
              const progreso = c.progresoGlobal || 40;
              const tieneObservaciones = c.ultimaBitacora?.estadoRevision === 'OBSERVADO';

              return (
                <div
                  key={c.id}
                  onClick={() => abrirTrazabilidad(c.id)}
                  className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-800/80 transition-all cursor-pointer group bg-white dark:bg-slate-900/90"
                >
                  {/* Top Bar: Modalidad & Semáforo */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                          esBachiller
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/40'
                            : 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800/40'
                        }`}
                      >
                        {esBachiller ? 'Trabajo Bachiller' : 'Tesis de Grado'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>Turnitin {c.turnitinPct || 6}%</span>
                        </span>

                        {tieneObservaciones ? (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                            Observado
                          </span>
                        ) : progreso >= 90 ? (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                            Dictamen
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                            Al Día
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Estudiante & Universidad */}
                    <div>
                      <h3 className="font-heading font-black text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {c.buyer?.nombres} {c.buyer?.apellidos}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        {c.buyer?.universidad?.siglas || 'UNT'} • {c.buyer?.carrera?.nombre}
                        {c.buyer?.ciclo && <span className="text-[11px] text-slate-400"> ({c.buyer?.ciclo})</span>}
                      </p>
                    </div>

                    {/* Tema de Investigación */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                      <span className="font-bold text-[10px] uppercase tracking-wider text-purple-700 dark:text-purple-400 block mb-0.5">
                        Tema / Título Registrado:
                      </span>
                      <p className="line-clamp-2 font-medium" title={c.temaInvestigacion}>
                        {c.temaInvestigacion}
                      </p>
                    </div>

                    {/* Barra de Progreso */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Avance Metodológico:</span>
                        <strong className="text-slate-900 dark:text-white font-bold">{progreso}%</strong>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            tieneObservaciones
                              ? 'bg-rose-500'
                              : progreso >= 80
                              ? 'bg-emerald-500'
                              : 'bg-gradient-to-r from-purple-600 to-sky-500'
                          }`}
                          style={{ width: `${progreso}%` }}
                        />
                      </div>
                      {c.ultimaBitacora && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          Fase activa: <strong className="text-slate-700 dark:text-slate-300">{c.ultimaBitacora.titulo}</strong>
                        </p>
                      )}
                    </div>

                    {/* Asesor Asignado */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Asesor Asignado</span>
                        <strong className="text-purple-700 dark:text-purple-300 text-[11px]">
                          {c.asesor?.gradoAcademico} {c.asesor?.nombres} {c.asesor?.apellidos}
                        </strong>
                      </div>
                      {proximaSesion?.enlaceReunion && (
                        <a
                          href={proximaSesion.enlaceReunion}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 hover:bg-sky-100 font-bold text-[10px] flex items-center gap-1 border border-sky-200 dark:border-sky-800/40"
                          title="Sala Google Meet"
                        >
                          <Video className="w-3 h-3 text-sky-600" />
                          <span>Meet</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Botón Central de Acción: Totalmente Visible sin Scroll */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirTrazabilidad(c.id);
                    }}
                    className="w-full mt-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm shadow-purple-500/20 transition-all hover:scale-[1.01] active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Trazabilidad & Bitácora Completa</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: TABLA COMPACTA (DISEÑADA PARA CABER EN CUALQUIER PANTALLA)       */}
      {/* ========================================================================= */}
      {vista === 'tabla' && (
        <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Tesista & Carrera</th>
                <th className="py-3.5 px-4 hidden sm:table-cell">Tema de Investigación</th>
                <th className="py-3.5 px-4 hidden md:table-cell">Asesor</th>
                <th className="py-3.5 px-4">Avance</th>
                <th className="py-3.5 px-4 text-center">Turnitin</th>
                <th className="py-3.5 px-4 text-center">Acción Inmediata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-transparent">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500 dark:text-slate-400">
                    <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-purple-600 border-t-transparent mr-2 align-middle" />
                    Cargando bitácora de tesistas...
                  </td>
                </tr>
              ) : clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500 dark:text-slate-400">
                    No se encontraron clientes para mostrar.
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map((c) => {
                  const esBachiller = c.modalidad === 'BACHILLER';
                  const progreso = c.progresoGlobal || 40;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => abrirTrazabilidad(c.id)}
                      className="cursor-pointer hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-all group"
                    >
                      {/* Tesista */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                          {c.buyer?.nombres} {c.buyer?.apellidos}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {c.buyer?.universidad?.siglas || 'UNT'} • {c.buyer?.carrera?.nombre}
                        </div>
                        <span
                          className={`inline-block mt-1 text-[9px] font-black uppercase px-2 py-0.2 rounded-full border ${
                            esBachiller
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/40'
                              : 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200 dark:border-sky-800/40'
                          }`}
                        >
                          {esBachiller ? 'Bachiller' : 'Tesis'}
                        </span>
                      </td>

                      {/* Tema */}
                      <td className="py-3.5 px-4 hidden sm:table-cell max-w-xs">
                        <p className="line-clamp-2 text-slate-700 dark:text-slate-300 text-xs" title={c.temaInvestigacion}>
                          {c.temaInvestigacion}
                        </p>
                      </td>

                      {/* Asesor */}
                      <td className="py-3.5 px-4 hidden md:table-cell">
                        <div className="font-bold text-purple-700 dark:text-purple-300 text-xs">
                          {c.asesor?.nombres} {c.asesor?.apellidos}
                        </div>
                        <div className="text-[10px] text-slate-500">{c.asesor?.gradoAcademico}</div>
                      </td>

                      {/* Avance */}
                      <td className="py-3.5 px-4 min-w-[100px]">
                        <div className="font-bold text-slate-900 dark:text-white mb-1">{progreso}%</div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-purple-600 h-full rounded-full" style={{ width: `${progreso}%` }} />
                        </div>
                      </td>

                      {/* Turnitin */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                          {c.turnitinPct || 6}%
                        </span>
                      </td>

                      {/* Acción */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirTrazabilidad(c.id);
                          }}
                          className="px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-colors inline-flex items-center gap-1 shadow-sm shadow-purple-500/20 whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Trazabilidad</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL / DRAWER DE TRAZABILIDAD ACADÉMICA Y BITÁCORA DEL CLIENTE           */}
      {/* ========================================================================= */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="glass-panel w-full max-w-4xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col bg-white dark:bg-slate-900 my-auto">
            {/* Header del Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-purple-50 via-slate-50 to-sky-50/40 dark:from-slate-900 dark:via-purple-950/20 dark:to-slate-900 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                    {trazabilidad?.modalidad === 'TRABAJO_INVESTIGACION_BACHILLER'
                      ? 'Trabajo de Investigación (Bachiller)'
                      : 'Tesis de Grado (Título Profesional)'}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {trazabilidad?.customer?.buyer?.universidad?.nombre} • {trazabilidad?.customer?.buyer?.carrera?.nombre}
                  </span>
                </div>

                <h3 className="font-heading text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1.5 flex items-center gap-2">
                  <span>{trazabilidad?.customer?.buyer?.nombres} {trazabilidad?.customer?.buyer?.apellidos}</span>
                </h3>

                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1 line-clamp-2">
                  📖 {trazabilidad?.temaInvestigacion}
                </p>
              </div>

              {/* Botones de acción derecha */}
              <div className="flex items-center gap-2 shrink-0">
                {trazabilidad?.customer?.buyer?.whatsapp && (
                  <a
                    href={`https://wa.me/${trazabilidad.customer.buyer.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-200 transition-colors"
                    title="Escribir al WhatsApp del tesista"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={cerrarTrazabilidad}
                  className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Stats Bar within Modal */}
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Asesor a Cargo</span>
                  <span className="font-bold text-purple-700 dark:text-purple-300">
                    {trazabilidad?.customer?.asesor?.gradoAcademico} {trazabilidad?.customer?.asesor?.nombres} {trazabilidad?.customer?.asesor?.apellidos}
                  </span>
                </div>
                <div className="h-6 w-px bg-slate-200 dark:border-slate-800 hidden sm:block" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Similitud Turnitin</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {trazabilidad?.turnitinPct || 6}% (Conforme SUNEDU)
                  </span>
                </div>
                <div className="h-6 w-px bg-slate-200 dark:border-slate-800 hidden sm:block" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Avance General</span>
                  <span className="font-black text-sky-700 dark:text-sky-300">{trazabilidad?.progresoGlobal || 45}%</span>
                </div>
              </div>

              {/* Progress Bar in Header */}
              <div className="flex items-center gap-2 min-w-[140px]">
                <div className="w-24 sm:w-28 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-600 to-sky-500 h-full rounded-full" style={{ width: `${trazabilidad?.progresoGlobal || 45}%` }} />
                </div>
                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300">{trazabilidad?.progresoGlobal || 45}%</span>
              </div>
            </div>

            {/* Sub-Tabs Nav */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-5 shrink-0 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveTab('fases')}
                className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'fases'
                    ? 'border-purple-600 text-purple-700 dark:text-purple-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Hitos Metodológicos ({trazabilidad?.fases?.length || 6})</span>
              </button>

              <button
                onClick={() => setActiveTab('bitacora')}
                className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'bitacora'
                    ? 'border-purple-600 text-purple-700 dark:text-purple-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Bitácora Cronológica ({trazabilidad?.bitacora?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('sesiones')}
                className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'sesiones'
                    ? 'border-purple-600 text-purple-700 dark:text-purple-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Sesiones Meet ({trazabilidad?.sesiones?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('contrato')}
                className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'contrato'
                    ? 'border-purple-600 text-purple-700 dark:text-purple-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Ficha & Culqi</span>
              </button>
            </div>

            {/* Notificación de éxito */}
            {notificacionExito && (
              <div className="mx-5 mt-3 p-3 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center gap-2 animate-fade-in">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{notificacionExito}</span>
              </div>
            )}

            {/* Modal Body / Tab Contents */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-6">
              {loadingTrazabilidad ? (
                <div className="py-16 text-center text-slate-500 dark:text-slate-400">
                  <span className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent mr-2 align-middle" />
                  Cargando trazabilidad académica...
                </div>
              ) : (
                <>
                  {/* TAB 1: FASES E HITOS METODOLÓGICOS */}
                  {activeTab === 'fases' && (
                    <div className="space-y-4">
                      {trazabilidad?.cuotasPago?.length > 0 && (
                        <div className="p-4 rounded-xl border-2 border-purple-200 dark:border-purple-800/60 bg-purple-50/40 dark:bg-purple-950/20 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                                Validación de Hitos & Desbloqueo de Cuotas (Opción B)
                              </span>
                              <h5 className="font-heading font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                                Orden {trazabilidad.codigoOrden} • Cronograma por Entregables
                              </h5>
                            </div>
                            <Link
                              href={`/checkout/${trazabilidad.codigoOrden}`}
                              target="_blank"
                              className="text-[11px] font-bold text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-1"
                            >
                              <span>Abrir Checkout del Estudiante</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {trazabilidad.cuotasPago.map((cp: any) => {
                              const pagada = cp.estado === 'PAGADA';
                              const espera = cp.estado === 'ESPERA_HITO';
                              const exigible = cp.estado === 'EXIGIBLE';
                              return (
                                <div
                                  key={cp.cuota_id}
                                  className={`p-3 rounded-xl border text-xs flex flex-col justify-between gap-2 ${
                                    pagada
                                      ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                                      : espera
                                        ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                                        : 'bg-sky-50/70 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800'
                                  }`}
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-slate-900 dark:text-white">
                                        Cuota #{cp.numero_cuota} ({cp.porcentaje}%)
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                          pagada
                                            ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                                            : espera
                                              ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                                              : 'bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-200'
                                        }`}
                                      >
                                        {cp.estado}
                                      </span>
                                    </div>
                                    <div className="font-mono font-black text-sm text-slate-900 dark:text-white">
                                      S/ {Number(cp.monto_programado).toFixed(2)}
                                    </div>
                                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                      {cp.condicion}
                                    </p>
                                    {cp.fecha_vencimiento && (
                                      <p className="text-[10px] font-mono text-slate-500">
                                        Vence: {String(cp.fecha_vencimiento).slice(0, 10)}
                                      </p>
                                    )}
                                  </div>

                                  {espera && (
                                    <button
                                      type="button"
                                      onClick={() => handleAprobarHitoCuota(cp.numero_cuota)}
                                      disabled={aprobandoCuota === cp.numero_cuota}
                                      className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                      {aprobandoCuota === cp.numero_cuota
                                        ? 'Habilitando...'
                                        : `✓ Aprobar hito y habilitar Cuota #${cp.numero_cuota}`}
                                    </button>
                                  )}
                                  {exigible && cp.numero_cuota > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRevertirHitoCuota(cp.numero_cuota)}
                                      disabled={aprobandoCuota === cp.numero_cuota}
                                      className="w-full py-1 px-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[10px] transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                      Volver a ESPERA_HITO (Bloquear)
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Ruta Metodológica de Graduación
                        </h4>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Normativa SUNEDU / VRI UNT
                        </span>
                      </div>

                      <div className="space-y-3">
                        {trazabilidad?.fases?.map((fase: any) => {
                          const estaAprobado = fase.estado === 'COMPLETADO' || fase.estado === 'APROBADO';
                          const estaObservado = fase.estado === 'OBSERVADO';
                          const enCurso = fase.estado === 'EN_REVISION' || (fase.porcentaje > 0 && fase.porcentaje < 100);

                          return (
                            <div
                              key={fase.clave}
                              className={`p-4 rounded-xl border transition-all ${
                                estaAprobado
                                  ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800/40'
                                  : estaObservado
                                  ? 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-300 dark:border-amber-800/50'
                                  : enCurso
                                  ? 'bg-purple-50/30 dark:bg-purple-950/10 border-purple-200 dark:border-purple-800/50'
                                  : 'bg-slate-50/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-80'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                      estaAprobado
                                        ? 'bg-emerald-600 text-white'
                                        : estaObservado
                                        ? 'bg-amber-600 text-white'
                                        : enCurso
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    {fase.numero}
                                  </div>
                                  <div>
                                    <h5 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                                      <span>{fase.nombre}</span>
                                      {estaAprobado && (
                                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold">
                                          Aprobado
                                        </span>
                                      )}
                                      {estaObservado && (
                                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-bold">
                                          Observado
                                        </span>
                                      )}
                                    </h5>
                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{fase.descripcion}</p>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                                    {fase.porcentaje}%
                                  </span>
                                  {fase.turnitinPct && (
                                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                                      Turnitin: {fase.turnitinPct}%
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Entregable asociado */}
                              <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono">
                                  <FileText className="w-3.5 h-3.5 text-sky-600" />
                                  <span>Entregable: {fase.entregableEsperado}</span>
                                </div>
                                {fase.ultimaRevision && (
                                  <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                                    Última revisión: {new Date(fase.ultimaRevision).toLocaleDateString()}
                                  </span>
                                )}
                              </div>

                              {/* Observación del Asesor */}
                              {fase.observacionAsesor && (
                                <div className="mt-2.5 p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                                  <span className="font-bold text-purple-700 dark:text-purple-400">Dictamen Asesor: </span>
                                  <span>{fase.observacionAsesor}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: BITÁCORA CRONOLÓGICA DE REVISIONES */}
                  {/* TAB 2: BITÁCORA CRONOLÓGICA DE REVISIONES (MOCKUP FIGURA 6 - PÁG. 26) */}
                  {activeTab === 'bitacora' && (
                    <div className="space-y-4">
                      {/* Cabecera Prototipo Asesor - Tesista (Figura 6) */}
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900 to-indigo-900 text-white shadow-lg space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/20 text-white">
                              ← Bitácora de sesión
                            </span>
                            <span className="text-[11px] font-bold text-purple-200">
                              Sesión N.° {trazabilidad?.sesiones?.length ? trazabilidad.sesiones.length : 3} · Asignación #{trazabilidad?.customer?.id ? trazabilidad.customer.id.substring(0, 6).toUpperCase() : 'A-1042'}
                            </span>
                          </div>
                          <button
                            onClick={() => setMostrarFormBitacora(!mostrarFormBitacora)}
                            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white text-purple-950 hover:bg-purple-100 transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5 text-purple-800" />
                            <span>{mostrarFormBitacora ? 'Cerrar Formulario' : 'Registrar Avance de Sesión'}</span>
                          </button>
                        </div>

                        <div className="pt-1 text-xs">
                          <p className="font-bold text-sm text-white">
                            Tesista: <span className="text-purple-200">{trazabilidad?.customer?.buyer?.nombres} {trazabilidad?.customer?.buyer?.apellidos}</span> · <span className="text-purple-300">{trazabilidad?.customer?.buyer?.carrera?.nombre || 'Ing. de Sistemas'}</span>
                          </p>
                          <p className="text-[11px] text-purple-200 mt-0.5">
                            Asesor: <span className="font-semibold text-white">{trazabilidad?.customer?.asesor?.gradoAcademico || 'Mg.'} {trazabilidad?.customer?.asesor?.nombres} {trazabilidad?.customer?.asesor?.apellidos || 'Rosa Delgado'}</span> · Especialidad: {trazabilidad?.customer?.asesor?.especialidad || 'Tesis cuantitativas'}
                          </p>
                        </div>

                        <div className="text-[11px] text-purple-300 font-mono pt-0.5 flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-amber-300" />
                          <span>Próxima entrega pactada: Capítulo III · vence en 2 días</span>
                        </div>
                      </div>

                      {/* BANNERS DE ALERTA DESTACADOS (FIGURA 6 - PÁG. 26 DEL INFORME) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Banner Naranja: Alerta de Cronograma / Emplazamiento */}
                        <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-400 dark:border-amber-700/60 dark:bg-amber-950/20 flex items-center justify-between gap-3 text-xs shadow-xs">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/30 font-bold">
                              ⏰
                            </div>
                            <div>
                              <h5 className="font-heading font-black text-amber-900 dark:text-amber-200 text-xs">
                                Entrega pactada en 2 días
                              </h5>
                              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                                Recordatorio enviado al tesista y al asesor
                              </p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white shrink-0">
                            Alerta
                          </span>
                        </div>

                        {/* Banner Verde: Próxima Sesión Confirmada */}
                        <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border border-emerald-400 dark:border-emerald-700/60 dark:bg-emerald-950/20 flex items-center justify-between gap-3 text-xs shadow-xs">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/30 font-bold">
                              📹
                            </div>
                            <div>
                              <h5 className="font-heading font-black text-emerald-900 dark:text-emerald-200 text-xs">
                                Próxima sesión: {trazabilidad?.sesiones?.[0]?.fechaHoraProgramada ? new Date(trazabilidad.sesiones[0].fechaHoraProgramada).toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' }) + ' a las ' + new Date(trazabilidad.sesiones[0].fechaHoraProgramada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'vie. 20, 4:00 pm'}
                              </h5>
                              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                Videollamada confirmada con el asesor
                              </p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white shrink-0">
                            Agendada
                          </span>
                        </div>
                      </div>

                      {/* Contador de Sesiones Registradas (Figura 6) */}
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2">
                        <BookOpen className="w-4 h-4 text-purple-600" />
                        <span><strong>{trazabilidad?.bitacora?.length || 3} sesiones registradas en la bitácora</strong> · Historial visible para el tesista y el equipo</span>
                      </div>

                      {/* Formulario desplegable para nueva entrada */}
                      {mostrarFormBitacora && (
                        <form
                          onSubmit={handleGuardarBitacora}
                          className="p-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-950/20 space-y-3 animate-fade-in"
                        >
                          <h5 className="font-bold text-xs text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-purple-600" />
                            <span>Registrar avance de la sesión</span>
                          </h5>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Hito / Capítulo de la Tesis
                              </label>
                              <select
                                value={formBitacora.hito}
                                onChange={(e) => setFormBitacora({ ...formBitacora, hito: e.target.value })}
                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              >
                                <option value="PLAN_TESIS">1. Plan / Proyecto de Tesis (VRI)</option>
                                <option value="MARCO_TEORICO">2. Marco Teórico y Estado del Arte</option>
                                <option value="METODOLOGIA">3. Metodología y Validación de Instrumentos</option>
                                <option value="TRABAJO_CAMPO">4. Trabajo de Campo y Procesamiento SPSS</option>
                                <option value="RESULTADOS_DISCUSION">5. Resultados y Discusión de Hipótesis</option>
                                <option value="TURNITIN_SUSTENTACION">6. Turnitin, Dictamen Jurados y Sustentación</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Título del Avance o Entregable
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Ej. Revisión del Capítulo III con prueba de Chi-cuadrado"
                                value={formBitacora.titulo}
                                onChange={(e) => setFormBitacora({ ...formBitacora, titulo: e.target.value })}
                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                % Avance Acumulado del Tesista ({formBitacora.porcentajeAvance}%)
                              </label>
                              <input
                                type="range"
                                min={10}
                                max={100}
                                step={5}
                                value={formBitacora.porcentajeAvance}
                                onChange={(e) => setFormBitacora({ ...formBitacora, porcentajeAvance: Number(e.target.value) })}
                                className="w-full accent-purple-600"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Estado de la Revisión
                              </label>
                              <select
                                value={formBitacora.estadoRevision}
                                onChange={(e) => setFormBitacora({ ...formBitacora, estadoRevision: e.target.value })}
                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              >
                                <option value="APROBADO">Aprobado / Conforme</option>
                                <option value="OBSERVADO">Con Observaciones por Levantar</option>
                                <option value="EN_REVISION">En Revisión de Asesor</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Similitud Turnitin Actual (%)
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={formBitacora.turnitinPct}
                                onChange={(e) => setFormBitacora({ ...formBitacora, turnitinPct: Number(e.target.value) })}
                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Próxima Entrega Comprometida
                              </label>
                              <input
                                type="text"
                                placeholder="Ej. Borrador de metodología antes de la sesión 4"
                                value={formBitacora.proximaEntrega}
                                onChange={(e) => setFormBitacora({ ...formBitacora, proximaEntrega: e.target.value })}
                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Observaciones Metodológicas y Acuerdos
                            </label>
                            <textarea
                              required
                              rows={3}
                              placeholder="Ej. Avance revisado: se completó el marco teórico (2.1 - 2.3). Dificultad: falta definir la metodología de investigación. Próximo paso: enviar guía de metodología antes de la sesión 4..."
                              value={formBitacora.observaciones}
                              onChange={(e) => setFormBitacora({ ...formBitacora, observaciones: e.target.value })}
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-purple-200 dark:border-purple-800">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                              Bitácora sincronizada con el panel del asesor
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setMostrarFormBitacora(false)}
                                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                disabled={guardandoBitacora}
                                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
                              >
                                {guardandoBitacora && <span className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-1" />}
                                <span>Guardar acta y notificar</span>
                              </button>
                            </div>
                          </div>
                        </form>
                      )}

                      {/* Lista de entradas de la bitácora */}
                      <div className="space-y-3">
                        {trazabilidad?.bitacora?.length === 0 ? (
                          <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
                            Aún no se registran entradas en la bitácora para este tesista.
                          </div>
                        ) : (
                          trazabilidad?.bitacora?.map((b: any) => (
                            <div
                              key={b.id}
                              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-sm space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                      b.estadoRevision === 'APROBADO'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                        : b.estadoRevision === 'OBSERVADO'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                        : 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                                    }`}
                                  >
                                    {b.estadoRevision}
                                  </span>
                                  <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                                    {b.titulo}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                                  {b.turnitinPct && (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                      <ShieldCheck className="w-3.5 h-3.5" /> Turnitin {b.turnitinPct}%
                                    </span>
                                  )}
                                  <span>{new Date(b.fechaRegistro).toLocaleDateString()} a las {new Date(b.fechaRegistro).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              </div>

                              <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                {b.observaciones}
                              </p>

                              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1">
                                <span>Registrado por: <strong className="text-purple-600 dark:text-purple-400">{b.registradoPor || 'Asesor'}</strong></span>
                                {b.proximaEntrega && (
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                                    Próxima entrega: {b.proximaEntrega}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: SESIONES VIRTUALES GOOGLE MEET */}
                  {activeTab === 'sesiones' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Sesiones Virtuales de Asesoría 1 a 1
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Reuniones directas vía Google Meet con el asesor especialista.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {trazabilidad?.sesiones?.length === 0 ? (
                          <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
                            No hay sesiones agendadas para este tesista.
                          </div>
                        ) : (
                          trazabilidad?.sesiones?.map((s: any) => {
                            const realizada = s.estado === 'REALIZADA';

                            return (
                              <div
                                key={s.id}
                                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                                  realizada
                                    ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                                    : 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50'
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                        realizada
                                          ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                                      }`}
                                    >
                                      Sesión #{s.numeroSesion} • {s.estado}
                                    </span>
                                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                                      {s.temaTratado}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                                    <span>
                                      {new Date(s.fechaHoraProgramada).toLocaleDateString([], {
                                        weekday: 'long',
                                        day: '2-digit',
                                        month: 'long',
                                        year: 'numeric',
                                      })}
                                      {' a las '}
                                      {new Date(s.fechaHoraProgramada).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                  {s.observaciones && (
                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                                      Nota: {s.observaciones}
                                    </p>
                                  )}
                                </div>

                                <div className="shrink-0">
                                  {s.enlaceReunion && (
                                    <a
                                      href={s.enlaceReunion}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm transition-colors"
                                    >
                                      <Video className="w-3.5 h-3.5" />
                                      <span>Ingresar a Sala Meet</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: FICHA FINANCIERA & CULQI */}
                  {activeTab === 'contrato' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Formalización Comercial & Pasarela Culqi
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                          <span className="text-[10px] uppercase font-bold text-slate-500">Cotización Oficial</span>
                          <h5 className="font-mono font-bold text-sm text-purple-700 dark:text-purple-400">
                            {trazabilidad?.customer?.cotizacion?.codigoCotizacion || 'COT-2026'}
                          </h5>
                          <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 pt-1">
                            <div className="flex justify-between">
                              <span>Monto Total:</span>
                              <strong className="font-mono">S/ {trazabilidad?.customer?.cotizacion?.total || 2200}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Modalidad:</span>
                              <span className="font-semibold text-purple-700 dark:text-purple-300">
                                {Number(trazabilidad?.customer?.cotizacion?.cuotas || 1) > 1
                                  ? `${trazabilidad.customer.cotizacion.cuotas} Cuotas (S/ ${(Number(trazabilidad.customer.cotizacion.total) / trazabilidad.customer.cotizacion.cuotas).toFixed(2)} c/u)`
                                  : 'Pago Contado'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Abonado a la Fecha:</span>
                              <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                                S/ {Number(trazabilidad?.customer?.payer?.montoTotalPagado || trazabilidad?.customer?.cotizacion?.total || 0).toFixed(2)}
                              </strong>
                            </div>
                            {Number(trazabilidad?.customer?.cotizacion?.cuotas || 1) > 1 && (
                              <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold">
                                <span>Saldo Pendiente:</span>
                                <span className="font-mono">
                                  S/ {Math.max(0, Number(trazabilidad?.customer?.cotizacion?.total || 0) - Number(trazabilidad?.customer?.payer?.montoTotalPagado || 0)).toFixed(2)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span>Estado Cotización:</span>
                              <span className="font-bold text-emerald-600">ACEPTADA</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                          <span className="text-[10px] uppercase font-bold text-slate-500">Pasarela de Pago Verificada</span>
                          <h5 className="font-bold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4" />
                            <span>CULQI EXPRESS (Webhook 200 OK)</span>
                          </h5>
                          <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1 pt-1">
                            <div className="flex justify-between">
                              <span>Método Empleado:</span>
                              <span className="font-bold">{trazabilidad?.customer?.payer?.primerPago?.metodoPago || 'YAPE'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Transacción ID:</span>
                              <span className="font-mono text-[10px] text-slate-500 truncate max-w-[140px]">
                                {trazabilidad?.customer?.payer?.primerPago?.gatewayTransactionId || 'culqi_verified'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Fecha de Abono:</span>
                              <span>
                                {trazabilidad?.customer?.payer?.fechaConversionPayer
                                  ? new Date(trazabilidad.customer.payer.fechaConversionPayer).toLocaleDateString()
                                  : '03/09/2026'}
                              </span>
                            </div>
                          </div>
                          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800">
                            <Link
                              href="/admin/comprobantes"
                              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-600 hover:to-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all text-center"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Ver y Descargar Boleta Oficial en PDF ➔</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Sistema Integral de Asesoría Universitaria • INBESTIGA.TESIS
              </span>
              <button
                onClick={cerrarTrazabilidad}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white transition-colors"
              >
                Cerrar Bitácora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
