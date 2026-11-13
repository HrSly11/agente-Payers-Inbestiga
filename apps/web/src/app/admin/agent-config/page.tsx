'use client';

import { useState, useEffect } from 'react';
import {
  Bot,
  Save,
  Sliders,
  Sparkles,
  Percent,
  CheckCircle2,
  Settings,
  Scale,
  Plus,
  Edit2,
  RefreshCw,
  Shield,
  GraduationCap,
  CreditCard,
  BellRing,
  HelpCircle,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';

interface BusinessRule {
  id: number;
  codigo: string;
  nombre: string;
  modulo: string;
  tipo_dato: 'NUMBER' | 'PERCENT' | 'BOOLEAN' | 'STRING' | 'JSON';
  valor: string;
  descripcion?: string;
  activo: boolean;
  fecha_actualizacion?: string;
}

export default function AgentConfigPage() {
  const [activeTab, setActiveTab] = useState<'agent' | 'rules'>('rules');
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>('TODOS');
  const [updatingCode, setUpdatingCode] = useState<string | null>(null);

  // Modal para nueva regla
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRule, setNewRule] = useState<Partial<BusinessRule>>({
    codigo: '',
    nombre: '',
    modulo: 'ACADEMICO',
    tipo_dato: 'NUMBER',
    valor: '',
    descripcion: '',
    activo: true,
  });

  // Modal para editar regla existente y borradores inline
  const [editingRule, setEditingRule] = useState<BusinessRule | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const bRules = await api.getBusinessRules().catch((e) => {
        console.warn('Error al cargar business-rules:', e);
        return [];
      });
      const loadedRules: BusinessRule[] = bRules || [];
      setRules(loadedRules);
      const initialDrafts: Record<string, string> = {};
      loadedRules.forEach((r) => {
        initialDrafts[r.codigo] = r.valor;
      });
      setDraftValues(initialDrafts);

      const cfg = await api.getAgentConfig().catch((e) => {
        console.warn('Error al cargar agent config:', e);
        return null;
      });
      setConfig(
        cfg || {
          proveedorIA: 'GEMINI',
          modelo: 'gemini-1.5-flash',
          promptSistema:
            'Eres el Agente Especialista de Cobranza y Activación Académica (PAYERS v2.0) de INBESTIGA.TESIS. Tu misión es gestionar el cobro de órdenes provenientes de HANDOFF_LEADS, facilitar enlaces oficiales de Mercado Pago Checkout Pro, estructurar cuotas sobre el saldo comprometido y activar el servicio académico tras el primer pago verificado.\nREGLAS ESTRICTAS DE PAYERS:\n1. RN-01 (Cero Alucinación): Jamás des por confirmado un pago por dichos del chat; verifica determinísticamente en PAGO y EVENTO_WEBHOOK.\n2. RN-02 (Precio Congelado): Prohibido negociar precios o descuentos en PAYERS. Si el estudiante solicita rebaja sobre el monto comprometido, escala y devuelve el caso a LEADS.\n3. RN-03 (Cuotas): Permite fraccionar en 3 cuotas (30/40/30) o reestructurar saldos pendientes hasta en 6 cuotas sin alterar el precio final.\n4. RN-04 (Activación): Al acreditarse la Cuota 1, activa automáticamente PAYER + CUSTOMER y asigna asesor especialista por balanceo de carga.\n5. RN-05 (Medios de Pago): Emite enlaces oficiales de Mercado Pago Checkout Pro; para montos mayores a S/ 500 indica pasarela con tarjeta.',
          tono: 'Profesional, empático, financiero-académico y determinístico',
          estilo: 'Especialista de Cobranza y Activación PAYERS v2.0',
          permitirNegociacion: false,
          maxDescuentoNegociablePct: 0.0,
          maxCuotasNegociables: 6,
          horarioInicio: '08:00',
          horarioFin: '20:00',
        },
      );
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleChangeConfig = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setConfig((prev: any) => ({ ...prev, [name]: checked }));
    } else if (name === 'proveedorIA') {
      let defaultModel = config?.modelo || 'gemini-3.6-flash';
      if (value === 'GEMINI') defaultModel = 'gemini-3.6-flash';
      else if (value === 'GROQ') defaultModel = 'openai/gpt-oss-120b';
      else if (value === 'OPENROUTER') defaultModel = 'google/gemma-4-31b-it:free';
      else if (value === 'GROK') defaultModel = 'grok-2-mini';
      setConfig((prev: any) => ({ ...prev, proveedorIA: value, modelo: defaultModel }));
    } else {
      setConfig((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      await api.updateAgentConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      alert(`Error al guardar configuración: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRuleActive = async (rule: BusinessRule) => {
    const nuevoEstado = !rule.activo;
    setRules((prev) =>
      prev.map((r) => (r.codigo === rule.codigo ? { ...r, activo: nuevoEstado } : r)),
    );
    try {
      await api.updateBusinessRule(rule.codigo, { activo: nuevoEstado });
    } catch (err: any) {
      alert(`Error actualizando regla: ${err.message}`);
      cargarDatos();
    }
  };

  const handleUpdateRuleValue = async (codigo: string, valor: string) => {
    setUpdatingCode(codigo);
    try {
      await api.updateBusinessRule(codigo, { valor });
      setRules((prev) =>
        prev.map((r) => (r.codigo === codigo ? { ...r, valor } : r)),
      );
      setDraftValues((prev) => ({ ...prev, [codigo]: valor }));
    } catch (err: any) {
      alert(`Error actualizando valor: ${err.message}`);
    } finally {
      setTimeout(() => setUpdatingCode(null), 1500);
    }
  };

  const handleSaveEditedRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    if (!editingRule.nombre?.trim() || editingRule.valor === undefined || editingRule.valor === '') {
      alert('Por favor completa el nombre y el valor de la regla.');
      return;
    }
    setSavingEdit(true);
    setUpdatingCode(editingRule.codigo);
    try {
      const updated = await api.updateBusinessRule(editingRule.codigo, {
        nombre: editingRule.nombre,
        modulo: editingRule.modulo,
        tipo_dato: editingRule.tipo_dato,
        valor: String(editingRule.valor),
        descripcion: editingRule.descripcion || '',
        activo: editingRule.activo,
      });
      const merged: BusinessRule = {
        ...editingRule,
        ...(updated || {}),
      };
      setRules((prev) =>
        prev.map((r) => (r.codigo === editingRule.codigo ? merged : r)),
      );
      setDraftValues((prev) => ({ ...prev, [editingRule.codigo]: String(merged.valor) }));
      setEditingRule(null);
    } catch (err: any) {
      alert(`Error al guardar cambios de la regla: ${err.message}`);
    } finally {
      setSavingEdit(false);
      setTimeout(() => setUpdatingCode(null), 1800);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.codigo || !newRule.nombre || !newRule.valor) {
      alert('Por favor completa código, nombre y valor.');
      return;
    }
    setCreating(true);
    try {
      const creada = await api.createBusinessRule(newRule);
      setRules((prev) => [...prev, creada]);
      if (creada?.codigo) {
        setDraftValues((prev) => ({ ...prev, [creada.codigo]: String(creada.valor ?? '') }));
      }
      setShowModal(false);
      setNewRule({
        codigo: '',
        nombre: '',
        modulo: 'ACADEMICO',
        tipo_dato: 'NUMBER',
        valor: '',
        descripcion: '',
        activo: true,
      });
    } catch (err: any) {
      alert(`Error creando regla: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const modulosDisponibles = ['TODOS', 'ACADEMICO', 'FINANCIERO', 'PASARELA', 'COBRANZA', 'SEGURIDAD'];

  const filteredRules = rules.filter((r) =>
    selectedModule === 'TODOS' ? true : r.modulo === selectedModule,
  );

  const getModuleBadge = (modulo: string) => {
    switch (modulo) {
      case 'ACADEMICO':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <GraduationCap className="w-3.5 h-3.5" /> Académico
          </span>
        );
      case 'FINANCIERO':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-sky-400 border border-blue-500/30">
            <Scale className="w-3.5 h-3.5" /> Financiero
          </span>
        );
      case 'PASARELA':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <CreditCard className="w-3.5 h-3.5" /> Pasarela
          </span>
        );
      case 'COBRANZA':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <BellRing className="w-3.5 h-3.5" /> Cobranza
          </span>
        );
      case 'SEGURIDAD':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <Shield className="w-3.5 h-3.5" /> Seguridad
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/30">
            {modulo}
          </span>
        );
    }
  };

  if (loading || !config) {
    return (
      <div className="py-24 text-center text-slate-500 dark:text-slate-400">
        <span className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 dark:border-sky-400 border-t-transparent" />
        <p className="mt-2 text-xs font-semibold">Cargando reglas y configuración desde Microsoft SQL Server...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-heading text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-sky-400 shadow-sm">
                <Scale className="w-5 h-5" />
              </span>
              <span>Motor de Reglas de Negocio & Agente IA</span>
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 break-words">
            Gestión dinámica de umbrales académicos, financieras y guardarraíles persistidos en Microsoft SQL Server (<code className="font-mono text-sky-400">INBESTIGA_TESIS.dbo.REGLA_NEGOCIO</code>).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'rules' && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-xl shadow-lg shadow-sky-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Regla de Negocio</span>
            </button>
          )}

          <button
            onClick={cargarDatos}
            title="Recargar desde SQL Server"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'rules'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>1. Catálogo Dinámico de Reglas de Negocio (SQL Server)</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white font-mono">
            {rules.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('agent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'agent'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>2. Configuración Agente IA & Prompts LLM</span>
        </button>
      </div>

      {/* TAB 1: REGLAS DE NEGOCIO */}
      {activeTab === 'rules' && (
        <div className="space-y-5 animate-fade-in">
          {/* Subheader con Filtros */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Módulo:
              </span>
              {modulosDisponibles.map((mod) => (
                <button
                  key={mod}
                  onClick={() => setSelectedModule(mod)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                    selectedModule === mod
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {mod}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              Mostrando {filteredRules.length} de {rules.length} reglas activas
            </div>
          </div>

          {/* Listado de Reglas */}
          <div className="grid grid-cols-1 gap-3.5">
            {filteredRules.map((rule) => (
              <div
                key={rule.codigo}
                className={`p-4 rounded-2xl border transition-all ${
                  rule.activo
                    ? 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
                    : 'bg-slate-950/40 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-sky-400">
                        {rule.codigo}
                      </span>
                      {getModuleBadge(rule.modulo)}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {rule.tipo_dato}
                      </span>
                      {updatingCode === rule.codigo && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold animate-pulse">
                          <CheckCircle2 className="w-3 h-3" /> Guardado en BD
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-200">{rule.nombre}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                      {rule.descripcion || 'Sin descripción detallada.'}
                    </p>
                  </div>

                  {/* Right: Controls */}
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80">
                    {/* Value Editor */}
                    {rule.tipo_dato === 'BOOLEAN' ? (
                      <button
                        onClick={() =>
                          handleUpdateRuleValue(
                            rule.codigo,
                            rule.valor === 'true' || rule.valor === '1' ? 'false' : 'true',
                          )
                        }
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                          rule.valor === 'true' || rule.valor === '1'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        }`}
                      >
                        {rule.valor === 'true' || rule.valor === '1' ? '✓ Habilitado' : '✕ Deshabilitado'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          type={rule.tipo_dato === 'NUMBER' || rule.tipo_dato === 'PERCENT' ? 'number' : 'text'}
                          value={draftValues[rule.codigo] ?? rule.valor}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftValues((prev) => ({ ...prev, [rule.codigo]: val }));
                          }}
                          onBlur={(e) => {
                            if (e.target.value !== rule.valor) {
                              handleUpdateRuleValue(rule.codigo, e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = draftValues[rule.codigo] ?? rule.valor;
                              handleUpdateRuleValue(rule.codigo, val);
                            }
                          }}
                          className="w-28 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        {rule.tipo_dato === 'PERCENT' && (
                          <span className="text-xs font-mono text-slate-400">%</span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const val = draftValues[rule.codigo] ?? rule.valor;
                            handleUpdateRuleValue(rule.codigo, val);
                          }}
                          title="Guardar valor de la regla"
                          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 transition-all cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Guardar</span>
                        </button>
                      </div>
                    )}

                    {/* Active Toggle Switch (Soft Delete / Baja Lógica) */}
                    <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded-xl hover:bg-slate-800/50 transition-colors" title="Activar/Desactivar regla (Baja lógica auditable)">
                      <input
                        type="checkbox"
                        checked={rule.activo}
                        onChange={() => handleToggleRuleActive(rule)}
                        className="rounded border-slate-700 bg-slate-950 text-sky-600 focus:ring-sky-500 h-4 w-4 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-400">
                        {rule.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </label>

                    {/* Full Edit Rule Modal Trigger */}
                    <button
                      type="button"
                      onClick={() => setEditingRule({ ...rule })}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Editar Regla</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CONFIGURACIÓN AGENTE IA PAYERS v2.0 */}
      {activeTab === 'agent' && (
        <form onSubmit={handleSaveConfig} className="space-y-6 animate-fade-in">
          {saveSuccess && (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
              <span>Cambios guardados exitosamente en Microsoft SQL Server (CONFIGURACION_AGENTE).</span>
            </div>
          )}

          {/* Row 1: Proveedor & Modelo */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm bg-slate-900/60">
            <h2 className="font-heading text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <Settings className="w-4 h-4" />
              <span>1. Proveedor de Inteligencia Artificial (AIProvider - PAYERS v2.0)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Proveedor de IA
                </label>
                <select
                  name="proveedorIA"
                  value={config.proveedorIA}
                  onChange={handleChangeConfig}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="GEMINI">Google Gemini (Gemini 3.6 Flash)</option>
                  <option value="GROQ">Groq Cloud (LPU Ultra-rápido: GPT-OSS 120B / Qwen)</option>
                  <option value="OPENROUTER">OpenRouter (Modelos Libres Multi-Proveedor)</option>
                  <option value="GROK">xAI Grok (Grok 2 / Grok Beta)</option>
                </select>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Abstracción desacoplada de backend (multi-proveedor)
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Identificador del Modelo
                </label>
                <input
                  type="text"
                  name="modelo"
                  value={config.modelo}
                  onChange={handleChangeConfig}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Prompt del Sistema PAYERS */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm bg-slate-900/60">
            <h2 className="font-heading text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <Sparkles className="w-4 h-4" />
              <span>2. Prompt del Sistema (Instrucciones Maestras de Cobranza & Activación PAYERS v2.0)</span>
            </h2>

            <div className="space-y-1.5">
              <textarea
                name="promptSistema"
                rows={8}
                value={config.promptSistema}
                onChange={handleChangeConfig}
                placeholder="Instrucciones del sistema para el agente de cobranza PAYERS..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-800 dark:text-slate-200 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                * El Agente PAYERS opera con guardarraíles determinísticos (RN-01 a RN-10): no negocia precios (RN-02), verifica pagos en PAGO/EVENTO_WEBHOOK y emite preferencias oficiales de Mercado Pago Checkout Pro.
              </p>
            </div>
          </div>

          {/* Row 3: Guardarraíles Operativos PAYERS */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm bg-slate-900/60">
            <h2 className="font-heading text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <Sliders className="w-4 h-4" />
              <span>3. Guardarraíles Operativos de Cobranza & Fraccionamiento (PAYERS)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Política de Precio (RN-02)
                </label>
                <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                  0% Descuento (Congelado desde LEADS)
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Si el estudiante pide rebaja, PAYERS devuelve la orden a LEADS.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tope Cuotas Reestructuración (RN-03)
                </label>
                <input
                  type="number"
                  name="maxCuotasNegociables"
                  value={config.maxCuotasNegociables}
                  onChange={handleChangeConfig}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Fraccionamiento máximo del saldo comprometido (3 o 6 cuotas).
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Ventana Horaria de Cobranza (Lima)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    name="horarioInicio"
                    value={config.horarioInicio || '08:00'}
                    onChange={handleChangeConfig}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono text-center"
                  />
                  <input
                    type="text"
                    name="horarioFin"
                    value={config.horarioFin || '20:00'}
                    onChange={handleChangeConfig}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono text-center"
                  />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Horario permitido para disparo de recordatorios automáticos.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-lg shadow-sky-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando en SQL Server...' : 'Guardar Configuración IA'}</span>
            </button>
          </div>
        </form>
      )}

      {/* MODAL CREAR NUEVA REGLA */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-heading text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-400" />
                <span>Crear Nueva Regla de Negocio en SQL Server</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Código Único (RN_*)</label>
                  <input
                    type="text"
                    required
                    placeholder="RN_EJEMPLO"
                    value={newRule.codigo}
                    onChange={(e) =>
                      setNewRule((p) => ({ ...p, codigo: e.target.value.toUpperCase() }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Módulo</label>
                  <select
                    value={newRule.modulo}
                    onChange={(e) => setNewRule((p) => ({ ...p, modulo: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="ACADEMICO">ACADEMICO</option>
                    <option value="FINANCIERO">FINANCIERO</option>
                    <option value="PASARELA">PASARELA</option>
                    <option value="COBRANZA">COBRANZA</option>
                    <option value="SEGURIDAD">SEGURIDAD</option>
                    <option value="GENERAL">GENERAL</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Nombre de la Regla</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Límite de prórroga para informe de tesis"
                  value={newRule.nombre}
                  onChange={(e) => setNewRule((p) => ({ ...p, nombre: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Tipo de Dato</label>
                  <select
                    value={newRule.tipo_dato}
                    onChange={(e) =>
                      setNewRule((p) => ({ ...p, tipo_dato: e.target.value as any }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="NUMBER">NUMBER (Número entero/decimal)</option>
                    <option value="PERCENT">PERCENT (Porcentaje %)</option>
                    <option value="BOOLEAN">BOOLEAN (Verdadero / Falso)</option>
                    <option value="STRING">STRING (Texto)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Valor Inicial</label>
                  <input
                    type="text"
                    required
                    placeholder={newRule.tipo_dato === 'BOOLEAN' ? 'true / false' : '15.0'}
                    value={newRule.valor}
                    onChange={(e) => setNewRule((p) => ({ ...p, valor: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Descripción / Política Institucional</label>
                <textarea
                  rows={3}
                  placeholder="Explica qué valida esta regla y por qué..."
                  value={newRule.descripcion}
                  onChange={(e) => setNewRule((p) => ({ ...p, descripcion: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-lg shadow-sky-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {creating ? 'Creando en BD...' : 'Crear Regla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR REGLA DE NEGOCIO EXISTENTE */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-heading text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-400" />
                <span>Editar Regla de Negocio ({editingRule.codigo})</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedRule} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Código Único (Solo lectura)</label>
                  <input
                    type="text"
                    readOnly
                    value={editingRule.codigo}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-sky-400 font-mono uppercase cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Módulo</label>
                  <select
                    value={editingRule.modulo}
                    onChange={(e) =>
                      setEditingRule((prev) => (prev ? { ...prev, modulo: e.target.value } : null))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="ACADEMICO">ACADEMICO</option>
                    <option value="FINANCIERO">FINANCIERO</option>
                    <option value="PASARELA">PASARELA</option>
                    <option value="COBRANZA">COBRANZA</option>
                    <option value="SEGURIDAD">SEGURIDAD</option>
                    <option value="GENERAL">GENERAL</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Nombre de la Regla</label>
                <input
                  type="text"
                  required
                  value={editingRule.nombre}
                  onChange={(e) =>
                    setEditingRule((prev) => (prev ? { ...prev, nombre: e.target.value } : null))
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Tipo de Dato</label>
                  <select
                    value={editingRule.tipo_dato}
                    onChange={(e) =>
                      setEditingRule((prev) =>
                        prev ? { ...prev, tipo_dato: e.target.value as BusinessRule['tipo_dato'] } : null,
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="NUMBER">NUMBER (Número entero/decimal)</option>
                    <option value="PERCENT">PERCENT (Porcentaje %)</option>
                    <option value="BOOLEAN">BOOLEAN (Verdadero / Falso)</option>
                    <option value="STRING">STRING (Texto)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Valor Configurado</label>
                  {editingRule.tipo_dato === 'BOOLEAN' ? (
                    <select
                      value={
                        editingRule.valor === 'true' || editingRule.valor === '1'
                          ? 'true'
                          : 'false'
                      }
                      onChange={(e) =>
                        setEditingRule((prev) =>
                          prev ? { ...prev, valor: e.target.value } : null,
                        )
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="true">true (✓ Habilitado)</option>
                      <option value="false">false (✕ Deshabilitado)</option>
                    </select>
                  ) : (
                    <input
                      type={
                        editingRule.tipo_dato === 'NUMBER' || editingRule.tipo_dato === 'PERCENT'
                          ? 'number'
                          : 'text'
                      }
                      step="any"
                      required
                      value={editingRule.valor}
                      onChange={(e) =>
                        setEditingRule((prev) =>
                          prev ? { ...prev, valor: e.target.value } : null,
                        )
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">
                  Descripción / Política Institucional
                </label>
                <textarea
                  rows={3}
                  placeholder="Explica qué valida esta regla y por qué..."
                  value={editingRule.descripcion || ''}
                  onChange={(e) =>
                    setEditingRule((prev) =>
                      prev ? { ...prev, descripcion: e.target.value } : null,
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingRule.activo}
                    onChange={(e) =>
                      setEditingRule((prev) =>
                        prev ? { ...prev, activo: e.target.checked } : null,
                      )
                    }
                    className="rounded border-slate-700 bg-slate-950 text-sky-600 focus:ring-sky-500 h-4 w-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-300">
                    Regla activa en el motor de decisiones (SQL Server)
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-lg shadow-sky-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingEdit ? 'Guardando en BD...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
