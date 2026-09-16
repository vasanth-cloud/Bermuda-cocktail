import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import BermudaLogo from './BermudaLogo';
import LoginModal from './LoginModal';
import { QrCode, Palette, LogIn, Moon, Sun, Sparkles } from 'lucide-react';

export default function CustomerTopHeader() {
  const { selectedTable, theme, setTheme } = useOrder();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const toggleTheme = () => {
    if (theme === 'dark') setTheme('neon');
    else if (theme === 'neon') setTheme('light');
    else setTheme('dark');
  };

  const getThemeLabel = () => {
    if (theme === 'neon') return { label: 'Velvet Neon', icon: Sparkles };
    if (theme === 'light') return { label: 'Bright Day', icon: Sun };
    return { label: 'Dark Amber', icon: Moon };
  };

  const themeInfo = getThemeLabel();
  const ThemeIcon = themeInfo.icon;

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-950/90 light:bg-white/95 backdrop-blur-md border-b border-amber-500/30 px-4 py-3 shadow-lg flex items-center justify-between">
        {/* Brand Logo & Scanned Table */}
        <div className="flex items-center gap-3">
          <BermudaLogo size="sm" />
          <div className="h-6 w-px bg-slate-800 light:bg-slate-300 hidden sm:block" />
          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full text-xs font-bold text-amber-400 light:text-amber-700">
            <QrCode className="w-3.5 h-3.5 text-amber-400" />
            <span>Table {selectedTable?.table_number || 'DN-01'}</span>
          </div>
        </div>

        {/* Theme Button & Staff Login */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 bg-slate-900 light:bg-amber-50 border border-slate-800 light:border-amber-200 text-slate-200 light:text-slate-900 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm hover:scale-[1.02]"
            title="Switch Theme"
          >
            <ThemeIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{themeInfo.label}</span>
          </button>

          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-300 light:text-amber-800 border border-amber-500/40 text-xs font-extrabold px-3 py-1.5 rounded-xl transition"
            title="Staff Login"
          >
            <LogIn className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Staff</span> Login
          </button>
        </div>
      </header>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
}
