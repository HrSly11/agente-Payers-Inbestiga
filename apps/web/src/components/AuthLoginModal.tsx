'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  GraduationCap,
  ShieldCheck,
  X,
  ArrowRight,
  Send,
  KeyRound,
  UserCheck,
  Database,
  Sparkles,
} from 'lucide-react';
import { useRole, UserRole } from '@/context/RoleContext';

export default function AuthLoginModal() {
  const prefersReducedMotion = useReducedMotion();
  const {
    loginModalOpen,
    loginModalDefaultTab,
    closeLoginModal,
    loginAsStudent,
    loginAsAdmin,
  } = useRole();

  const [activeTab, setActiveTab] = useState<UserRole>('ESTUDIANTE');
  const [studentQuery, setStudentQuery] = useState<string>('ORD-2026-0042');
  const [adminEmail, setAdminEmail] = useState<string>('admin@inbestiga.pe');
  const [adminPassword, setAdminPassword] = useState<string>('••••••••••••');

  useEffect(() => {
    if (loginModalOpen) {
      setActiveTab(loginModalDefaultTab);
    }
  }, [loginModalOpen, loginModalDefaultTab]);

  useEffect(() => {
    if (!loginModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLoginModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loginModalOpen, closeLoginModal]);

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginAsStudent(studentQuery);
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginAsAdmin();
  };

  return (
    <AnimatePresence>
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            key="auth-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            onClick={closeLoginModal}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal Dialog */}
          <motion.div
            key="auth-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Iniciar Sesión en INBESTIGA"
            initial={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 0, scale: 0.94, y: 14 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96, y: 10 }
            }
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/50">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-extrabold uppercase">
                  <Database className="w-3 h-3" />
                  <span>AUTENTICACIÓN · INBESTIGA_TESIS</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black tracking-tight">
                  Acceso al Ecosistema INBESTIGA
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selecciona tu perfil para personalizar tu expediente o administrar la operación.
                </p>
              </div>
              <button
                type="button"
                onClick={closeLoginModal}
                aria-label="Cerrar ventana de acceso"
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Role Tabs */}
            <div className="px-6 pt-4">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('ESTUDIANTE')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    activeTab === 'ESTUDIANTE'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Soy Estudiante (Tesista)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ADMIN')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    activeTab === 'ADMIN'
                      ? 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Administrador (ADMIN)</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              {activeTab === 'ESTUDIANTE' ? (
                <form onSubmit={handleStudentSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="student-query-input"
                      className="block text-xs font-extrabold text-slate-700 dark:text-slate-300"
                    >
                      Código de Orden, Correo o @usuario de Telegram
                    </label>
                    <input
                      id="student-query-input"
                      type="text"
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      placeholder="Ej. ORD-2026-0042 o @hartonai"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Quick Demo Profiles */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-500" />
                      Acceso rápido de demostración (1 clic):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => loginAsStudent('ORD-2026-0042')}
                        className="text-left p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                      >
                        <div className="text-xs font-black text-slate-900 dark:text-white flex items-center justify-between">
                          <span>Harry Sánchez</span>
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                            @hartonai
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          ORD-2026-0042 · UNT (3 Cuotas)
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => loginAsStudent('ORD-2026-0001')}
                        className="text-left p-2.5 rounded-xl border border-sky-500/40 bg-sky-500/5 hover:bg-sky-500/15 transition-colors cursor-pointer"
                      >
                        <div className="text-xs font-black text-slate-900 dark:text-white flex items-center justify-between">
                          <span>Alessy Tania</span>
                          <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400">
                            @alessy_tania
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          ORD-2026-0001 · UNMSM (3 Cuotas)
                        </div>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Consultar Mi Expediente en Web</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
                    <Send className="w-4 h-4 text-[#0088cc] shrink-0 mt-0.5" />
                    <div>
                      <strong>¿Prefieres no iniciar sesión en la web?</strong> Si escribes
                      directamente a{' '}
                      <a
                        href="https://t.me/inbestiga_tesis_bot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-[#0088cc] dark:text-sky-400 underline"
                      >
                        @inbestiga_tesis_bot
                      </a>
                      , Telegram identifica automáticamente tu cuenta vinculada.
                    </div>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleAdminSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-email-input"
                      className="block text-xs font-extrabold text-slate-700 dark:text-slate-300"
                    >
                      Correo Corporativo (Backoffice PAYERS)
                    </label>
                    <input
                      id="admin-email-input"
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-pass-input"
                      className="block text-xs font-extrabold text-slate-700 dark:text-slate-300"
                    >
                      Clave de Auditoría / Token Admin
                    </label>
                    <input
                      id="admin-pass-input"
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-3 text-[11px] text-slate-600 dark:text-slate-300">
                    Desbloquea el <strong>Centro de Mando</strong>, <strong>Live Chat IA</strong>,{' '}
                    <strong>Padrón de 104 Órdenes</strong>, <strong>Reporte BI R-PAYERS</strong> y{' '}
                    <strong>Matriz de Evaluación (40 casos)</strong>.
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Ingresar al Panel Admin (ROL BD: ADMIN)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
