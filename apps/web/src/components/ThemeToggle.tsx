'use client';

import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="relative p-2 rounded-xl border border-slate-700/60 dark:border-slate-700/60 light:border-slate-200 bg-slate-800/80 dark:bg-slate-800/80 text-amber-400 hover:text-amber-300 dark:text-amber-400 dark:hover:text-amber-300 transition-all shadow-sm hover:scale-105 active:scale-95 focus:outline-none"
      title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
      aria-label="Cambiar tema"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-300 animate-spin-slow transition-transform" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-600 transition-transform" />
      )}
    </button>
  );
}
