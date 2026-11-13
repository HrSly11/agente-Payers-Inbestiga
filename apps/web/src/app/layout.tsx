import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import { ThemeProvider } from '@/context/ThemeContext';
import { RoleProvider } from '@/context/RoleContext';

export const metadata: Metadata = {
  title: 'INBESTIGA · PAYERS | Agente IA de Cobranza, Mercado Pago y Activación Académica',
  description:
    'Ecosistema dedicado del Agente IA de Cobranza PAYERS (v2.0): pasarela oficial Mercado Pago Checkout Pro, bot bidireccional en Telegram (@inbestiga_tesis_bot), validación de hitos académicos y Data Mart Kimball R-PAYERS.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="dark">
      <body className="min-h-screen flex flex-col antialiased selection:bg-emerald-500 selection:text-slate-950 transition-colors duration-200 overflow-x-hidden">
        <ThemeProvider>
          <RoleProvider>
            <Navbar />
            <main className="flex-1 max-w-[1520px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
              {children}
            </main>
            <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-950/60 backdrop-blur-md py-6 text-xs text-slate-600 dark:text-slate-400">
              <div className="max-w-[1520px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="font-medium">
                  © 2026 <strong className="text-slate-900 dark:text-white">INBESTIGA · PAYERS v2.0</strong> — Agente Autónomo de Cobranza, Pasarela Mercado Pago & Data Mart Kimball.
                </p>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Mercado Pago Checkout Pro
                  </span>
                  <span>•</span>
                  <span>Telegram @inbestiga_tesis_bot</span>
                  <span>•</span>
                  <span>SQL Server INBESTIGA_TESIS & INBESTIGA_MART</span>
                </div>
              </div>
            </footer>
          </RoleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
