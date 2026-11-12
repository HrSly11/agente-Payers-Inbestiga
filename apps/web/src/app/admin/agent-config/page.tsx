'use client';

import { useState, useEffect } from 'react';
import {
  Bot,
  Save,
  Sliders,
  Sparkles,
  ShieldAlert,
  Percent,
  Calendar,
  CheckCircle2,
  Clock,
  Settings,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function AgentConfigPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [rules, setRules] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([api.getAgentConfig(), api.getCommercialRules()])
      .then(([cfg, rls]) => {
        setConfig(cfg || {
          proveedorIA: 'GEMINI',
          modelo: 'gemini-1.5-flash',
          promptSistema: '',
          tono: 'Profesional, empático y resolutivo',
          estilo: 'Consultor académico de investigación',
          permitirNegociacion: true,
          maxDescuentoNegociablePct: 15.0,
          maxCuotasNegociables: 3,
          horarioInicio: '08:00',
          horarioFin: '22:00',
        });
        setRules(rls || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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

  const handleSave = async (e: React.FormEvent) => {
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

  if (loading || !config) {
    return (
      <div className="py-24 text-center text-slate-500 dark:text-slate-400">
        <span className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 dark:border-sky-400 border-t-transparent" />
        <p className="mt-2 text-xs font-semibold">Cargando configuración del Agente IA desde SQL Server...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-heading text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-sky-400 shadow-sm">
                <Bot className="w-5 h-5" />
              </span>
              <span>Configuración del Agente IA Negociador</span>
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 break-words">
            Personalidad, prompt de sistema, límites comerciales y proveedor LLM persistidos en SQL Server.
          </p>
        </div>

        {saveSuccess && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/30 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            <span>Cambios guardados en SQL Server</span>
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Row 1: Proveedor & Modelo */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <h2 className="font-heading text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <Settings className="w-4 h-4" />
            <span>1. Proveedor de Inteligencia Artificial (AIProvider)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Proveedor de IA</label>
              <select
                name="proveedorIA"
                value={config.proveedorIA}
                onChange={handleChange}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="GEMINI">Google Gemini (Gemini 3.6 Flash)</option>
                <option value="GROQ">Groq Cloud (LPU Ultra-rápido: GPT-OSS 120B / Qwen)</option>
                <option value="OPENROUTER">OpenRouter (Modelos Libres Multi-Proveedor)</option>
                <option value="GROK">xAI Grok (Grok 2 / Grok Beta)</option>
              </select>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Abstracción desacoplada de backend (multi-proveedor)</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Identificador del Modelo</label>
              <input
                type="text"
                name="modelo"
                value={config.modelo}
                onChange={handleChange}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Prompt del Sistema */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <h2 className="font-heading text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <Sparkles className="w-4 h-4" />
            <span>2. Prompt del Sistema (Instrucciones Maestras del Negociador)</span>
          </h2>

          <div className="space-y-1.5">
            <textarea
              name="promptSistema"
              rows={8}
              value={config.promptSistema}
              onChange={handleChange}
              placeholder="Instrucciones del sistema para el agente negociador..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-800 dark:text-slate-200 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              * El Agente IA nunca recibe permisos de escritura SQL directos. Toda propuesta se valida mediante herramientas backend.
            </p>
          </div>
        </div>

        {/* Row 3: Reglas de Negociación y Descuentos */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <h2 className="font-heading text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <Sliders className="w-4 h-4" />
            <span>3. Límites Comerciales del Backend</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Descuento Máximo Negociable (%)</label>
              <div className="relative">
                <input
                  type="number"
                  name="maxDescuentoNegociablePct"
                  value={config.maxDescuentoNegociablePct}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <Percent className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Si la IA propone más, el backend rechaza la oferta.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cuotas Máximas Permitidas</label>
              <input
                type="number"
                name="maxCuotasNegociables"
                value={config.maxCuotasNegociables}
                onChange={handleChange}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Máximo fraccionamiento institucional.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Permitir Negociación Activa</label>
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="permitirNegociacion"
                    checked={config.permitirNegociacion}
                    onChange={handleChange}
                    className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                  />
                  <span className="text-xs text-slate-800 dark:text-slate-300 font-bold">Habilitar contraofertas IA</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-600 hover:to-sky-500 text-white shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
          >
            {saving ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Guardar Configuración en SQL Server</span>
          </button>
        </div>
      </form>
    </div>
  );
}
