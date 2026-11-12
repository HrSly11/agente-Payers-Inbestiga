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
  Send,
  Sparkles,
  ExternalLink,
  Receipt,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import ThemeToggle from '@/components/ThemeToggle';

type NavLink = {
  href: string;
  label: string;
  icon: any;
  badge?: string;
  accent?: 'emerald' | 'sky' | 'amber';
};

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navLinks: NavLink[] = [
    { href: '/', label: 'Centro de Mando', icon: Sparkles },
    {
      href: '/admin/payers/live-chat',
      label: 'Live Chat IA',
      icon: MessageSquare,
      badge: 'VIVO',
      accent: 'emerald',
    },
    {
      href: '/checkout/ORD-2026-0042',
      label: 'Checkout MP',
      icon: CreditCard,
      accent: 'sky',
    },
    { href: '/admin/payers', label: 'Órdenes (104)', icon: Layers },
    {
      href: '/admin/customers',
      label: 'Hitos & Asesor',
      icon: BookOpen,
      accent: 'amber',
    },
    { href: '/admin/payers/reporte', label: 'Reporte BI', icon: BarChart3 },
    { href: '/admin/payers/evaluacion', label: 'Evaluación (40)', icon: ShieldCheck },
    { href: '/admin/comprobantes', label: 'Comprobantes', icon: Receipt },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/admin/payers') return pathname === '/admin/payers';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl transition-colors duration-200">
      <div className="w-full max-w-[1560px] mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand Identity */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-sky-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform shrink-0 border border-white/15">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-base tracking-tight text-slate-900 dark:text-white">
                  INBESTIGA<span className="text-emerald-600 dark:text-emerald-400">·PAYERS</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  AGENTE v2.0
                </span>
              </div>
              <p className="hidden 2xl:block text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                Cobranza Inteligente · Mercado Pago · Hitos Académicos
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex items-center gap-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-sm'
                      : item.accent === 'emerald'
                        ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                        : item.accent === 'sky'
                          ? 'text-sky-700 dark:text-sky-300 bg-sky-50/80 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 hover:bg-sky-100 dark:hover:bg-sky-500/20'
                          : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      active
                        ? 'text-white dark:text-slate-950'
                        : item.accent === 'emerald'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : item.accent === 'sky'
                            ? 'text-sky-600 dark:text-sky-400'
                            : 'text-slate-500 dark:text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                        active
                          ? 'bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Bar: Telegram Bot Button + Theme Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://t.me/inbestiga_tesis_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-[#0088cc] hover:bg-[#0077b5] text-white shadow-sm shadow-sky-500/20 transition-all"
              title="Abrir @inbestiga_tesis_bot en Telegram"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">@inbestiga_tesis_bot</span>
              <span className="sm:hidden">Telegram</span>
              <ExternalLink className="w-3 h-3 opacity-80 hidden md:inline" />
            </a>

            <ThemeToggle />

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
              className="xl:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
              aria-label="Menú de navegación"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile / Tablet Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl px-4 pt-3 pb-5 space-y-2 shadow-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
