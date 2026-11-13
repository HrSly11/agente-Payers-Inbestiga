'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  BarChart3,
  Menu,
  X,
  BookOpen,
  CreditCard,
  Layers,
  ShieldCheck,
  Sparkles,
  Receipt,
  Settings,
  GraduationCap,
  Send,
  Award,
  ChevronDown,
  LogIn,
  LogOut,
  Eye,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import AuthLoginModal from '@/components/AuthLoginModal';
import { useRole } from '@/context/RoleContext';

type NavChildLink = {
  href: string;
  label: string;
  desc: string;
  icon: any;
  badge?: string;
};

type StudentNavLink = {
  href: string;
  label: string;
  icon: any;
  badge?: string;
  accent?: 'emerald' | 'sky' | 'amber';
};

export default function Navbar() {
  const pathname = usePathname();
  const {
    isAuthenticated,
    role,
    studentProfile,
    openLoginModal,
    logout,
  } = useRole();

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [openDropdown, setOpenDropdown] = useState<'COBRANZA' | 'BI' | null>(
    null,
  );
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenDropdown(null);
  }, [pathname, role, isAuthenticated]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cobranzaChildren: NavChildLink[] = [
    {
      href: '/admin/payers/live-chat',
      label: 'Live Chat IA',
      desc: 'Stream bidireccional Telegram & Web',
      icon: MessageSquare,
      badge: 'VIVO',
    },
    {
      href: '/admin/payers',
      label: 'Órdenes & Pasarela',
      desc: 'Padrón de 104 órdenes y vouchers Caja',
      icon: Layers,
    },
    {
      href: '/admin/comprobantes',
      label: 'Comprobantes',
      desc: 'Boletas SUNAT y pagos acreditados',
      icon: Receipt,
    },
  ];

  const biChildren: NavChildLink[] = [
    {
      href: '/admin/payers/reporte',
      label: 'Reporte BI R-PAYERS',
      desc: 'KPIs P01–P06 y Vistas 3.1, 3.2 y 3.3',
      icon: BarChart3,
    },
    {
      href: '/admin/payers/evaluacion',
      label: 'Evaluación (40)',
      desc: 'Matriz de 40 casos y 0% alucinación',
      icon: ShieldCheck,
    },
    {
      href: '/admin/agent-config',
      label: 'Reglas & Agente IA',
      desc: 'Guardarraíles RN-01..RN-10 y 11 tools',
      icon: Settings,
    },
  ];

  const studentNavLinks: StudentNavLink[] = [
    { href: '/#hero', label: 'Inicio', icon: Sparkles },
    {
      href: '/#galeria-tesis',
      label: 'Metodología Scopus',
      icon: BookOpen,
      accent: 'sky',
    },
    {
      href: '/#ruta-graduacion',
      label: 'Ruta de 5 Hitos',
      icon: Award,
      accent: 'amber',
    },
    {
      href: '/#portal-telegram',
      label: 'Bot Telegram',
      icon: Send,
      badge: 'IA 24/7',
      accent: 'emerald',
    },
  ];

  const isCobranzaActive =
    pathname === '/admin/payers/live-chat' ||
    pathname === '/admin/payers' ||
    pathname?.startsWith('/admin/comprobantes');

  const isBiActive =
    pathname?.startsWith('/admin/payers/reporte') ||
    pathname?.startsWith('/admin/payers/evaluacion') ||
    pathname?.startsWith('/admin/agent-config');

  const isAdminMode = isAuthenticated && role === 'ADMIN';
  const isStudentAuthenticated = isAuthenticated && role === 'ESTUDIANTE' && Boolean(studentProfile);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl transition-colors duration-200">
        <div className="w-full max-w-[1560px] mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Brand Identity */}
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-sky-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform shrink-0 border border-white/15">
                {isAdminMode ? (
                  <CreditCard className="w-5 h-5 text-white" />
                ) : (
                  <GraduationCap className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                    INBESTIGA
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {isAdminMode ? '·PAYERS' : '·TESIS'}
                    </span>
                  </span>
                  <span
                    className={`hidden md:inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap ${
                      isAdminMode
                        ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                        : isStudentAuthenticated
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30'
                    }`}
                  >
                    {isAdminMode
                      ? 'ADMIN · AGENTE v2.0'
                      : isStudentAuthenticated
                        ? `TESISTA · ${studentProfile?.codigoOrden}`
                        : 'PORTAL INSTITUCIONAL'}
                  </span>
                </div>
                <p className="hidden 2xl:block text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                  {isAdminMode
                    ? 'Orquestador de Cobranza · Mercado Pago · Hitos Académicos'
                    : isStudentAuthenticated
                      ? `Expediente activo de ${studentProfile?.nombre} (${studentProfile?.telegramUsername})`
                      : 'Investigación Científica · Conformidad por Hitos · Bot IA 24/7'}
                </p>
              </div>
            </Link>

            {/* Desktop Navigation: 4 Compact Groups for ADMIN vs 4 Sections for PUBLIC/STUDENT */}
            <nav
              ref={navRef}
              className="hidden lg:flex items-center gap-1.5"
              aria-label="Navegación principal"
            >
              {isAdminMode ? (
                <>
                  {/* 1. Centro de Mando */}
                  <Link
                    href="/"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      pathname === '/'
                        ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Centro de Mando</span>
                  </Link>

                  {/* 2. Cobranza & Pasarela ▾ (Dropdown) */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDropdown((prev) =>
                          prev === 'COBRANZA' ? null : 'COBRANZA',
                        )
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        isCobranzaActive
                          ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-sm'
                          : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Cobranza &amp; Pasarela</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${
                          openDropdown === 'COBRANZA' ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {openDropdown === 'COBRANZA' && (
                      <div className="absolute left-0 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl p-2 space-y-1 z-50">
                        {cobranzaChildren.map((child) => {
                          const Icon = child.icon;
                          const active = pathname === child.href;
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setOpenDropdown(null)}
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-colors ${
                                active
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="text-xs font-extrabold">
                                    {child.label}
                                  </span>
                                  {child.badge && (
                                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-600 text-white">
                                      {child.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {child.desc}
                                </p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 3. Hitos & Asesor */}
                  <Link
                    href="/admin/customers"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      pathname?.startsWith('/admin/customers')
                        ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-sm'
                        : 'text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/20'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Hitos &amp; Asesor</span>
                  </Link>

                  {/* 4. BI & Agente IA ▾ (Dropdown) */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDropdown((prev) => (prev === 'BI' ? null : 'BI'))
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        isBiActive
                          ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-sm'
                          : 'text-sky-700 dark:text-sky-300 bg-sky-50/80 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 hover:bg-sky-100 dark:hover:bg-sky-500/20'
                      }`}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>BI &amp; Agente IA</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${
                          openDropdown === 'BI' ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {openDropdown === 'BI' && (
                      <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl p-2 space-y-1 z-50">
                        {biChildren.map((child) => {
                          const Icon = child.icon;
                          const active = pathname === child.href;
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setOpenDropdown(null)}
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-colors ${
                                active
                                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-extrabold block">
                                  {child.label}
                                </span>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {child.desc}
                                </p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                studentNavLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        item.accent === 'emerald'
                          ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                          : item.accent === 'sky'
                            ? 'text-sky-700 dark:text-sky-300 bg-sky-50/80 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 hover:bg-sky-100 dark:hover:bg-sky-500/20'
                            : item.accent === 'amber'
                              ? 'text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/20'
                              : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-600 text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })
              )}
            </nav>

            {/* Right Action Bar: Compact Auth & Role Controls + ThemeToggle */}
            <div className="flex items-center gap-2 shrink-0">
              {!isAuthenticated ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openLoginModal('ESTUDIANTE')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold shadow-sm shadow-emerald-600/20 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Iniciar Sesión</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openLoginModal('ADMIN')}
                    className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                    title="Acceso rápido para Administrador (ROL BD: ADMIN)"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Admin</span>
                  </button>
                </div>
              ) : isStudentAuthenticated ? (
                <div className="flex items-center gap-1.5">
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono font-extrabold whitespace-nowrap">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>ESTUDIANTE · {studentProfile?.codigoOrden}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => openLoginModal('ADMIN')}
                    className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <ShieldCheck className="w-3 h-3 text-indigo-500" />
                    <span>Cambiar Rol</span>
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                    title="Cerrar sesión y volver a la vista pública"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Salir</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/35 text-indigo-700 dark:text-indigo-300 text-[11px] font-mono font-extrabold whitespace-nowrap">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ADMIN</span>
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35 text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap"
                    title="Volver a la Landing Institucional del Cliente"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ver Landing Cliente</span>
                    <span className="sm:hidden">Cliente</span>
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                    title="Cerrar sesión de Administrador"
                  >
                    <LogOut className="w-3 h-3" />
                    <span className="hidden xl:inline">Salir</span>
                  </button>
                </div>
              )}

              <ThemeToggle />

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                type="button"
                className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
                aria-label="Menú de navegación"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile / Tablet Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl px-4 pt-3 pb-5 space-y-3 shadow-2xl">
            {isAdminMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <Link
                  href="/"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  <span>Centro de Mando</span>
                </Link>
                <Link
                  href="/admin/customers"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <BookOpen className="w-4 h-4 text-amber-500" />
                  <span>Hitos &amp; Asesor</span>
                </Link>
                {[...cobranzaChildren, ...biChildren].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Icon className="w-4 h-4 text-sky-500 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {studentNavLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                    >
                      <Icon className="w-4 h-4 shrink-0 text-emerald-500" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Modal de Autenticación (Estudiante / Admin) */}
      <AuthLoginModal />
    </>
  );
}
