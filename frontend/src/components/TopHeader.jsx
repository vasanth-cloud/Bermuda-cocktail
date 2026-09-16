import React, { useState, useRef, useEffect } from 'react';
import { useOrder } from '../context/OrderContext';
import LoginModal from './LoginModal';
import { 
  Palette, 
  UserCheck, 
  Crown, 
  Users, 
  Wine, 
  UtensilsCrossed, 
  LogIn, 
  LogOut, 
  ChevronDown, 
  Moon, 
  Sun, 
  Sparkles,
  Shield,
  User
} from 'lucide-react';

export default function TopHeader() {
  const { 
    theme, 
    setTheme, 
    currentUser, 
    logoutUser 
  } = useOrder();

  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const themeRef = useRef(null);
  const profileRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (themeRef.current && !themeRef.current.contains(event.target)) {
        setIsThemeOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return { label: 'Master Admin', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: Crown };
      case 'WAITER':
        return { label: 'Waiter Staff', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30', icon: Users };
      case 'BAR_RECEPTION':
        return { label: 'Bar Reception', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', icon: Wine };
      case 'KITCHEN_CHEF':
        return { label: 'Kitchen Chef', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: UtensilsCrossed };
      default:
        return { label: 'Staff User', color: 'text-slate-400 bg-slate-800 border-slate-700', icon: UserCheck };
    }
  };

  const getThemeInfo = (t) => {
    switch (t) {
      case 'neon':
        return { name: 'Velvet Neon', icon: Sparkles, color: 'text-purple-400' };
      case 'light':
        return { name: 'Bright Day', icon: Sun, color: 'text-amber-300' };
      case 'dark':
      default:
        return { name: 'Dark Amber', icon: Moon, color: 'text-amber-400' };
    }
  };

  const currentThemeInfo = getThemeInfo(theme);
  const ThemeIcon = currentThemeInfo.icon;

  return (
    <>
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5 shadow-lg flex items-center justify-between md:justify-end gap-3">
        {/* Left Side spacer on desktop / Brand indicator */}
        <div className="md:hidden flex items-center gap-2">
          <span className="text-xs font-black text-amber-400 tracking-wider">BERMUDA PUB</span>
        </div>

        {/* TOP RIGHT CONTROLS GROUP */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          {/* 1. THEME SELECTION BUTTON & DROPDOWN */}
          <div className="relative" ref={themeRef}>
            <button
              onClick={() => {
                setIsThemeOpen(!isThemeOpen);
                setIsProfileOpen(false);
              }}
              className="flex items-center gap-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-md group"
              title="Change Visual Theme"
            >
              <div className={`p-1 rounded-lg bg-slate-950 border border-slate-800 ${currentThemeInfo.color}`}>
                <ThemeIcon className="w-3.5 h-3.5" />
              </div>
              <span className="hidden sm:inline">{currentThemeInfo.name}</span>
              <Palette className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition-colors" />
            </button>

            {/* Theme Dropdown Menu */}
            {isThemeOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 py-1 border-b border-slate-800 mb-1">
                  Select Visual Style
                </div>

                <button
                  onClick={() => {
                    setTheme('dark');
                    setIsThemeOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
                    theme === 'dark' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Moon className="w-4 h-4 text-amber-400" />
                  <span>🌙 Dark Amber</span>
                </button>

                <button
                  onClick={() => {
                    setTheme('neon');
                    setIsThemeOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition mt-1 ${
                    theme === 'neon' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>🍷 Velvet Neon</span>
                </button>

                <button
                  onClick={() => {
                    setTheme('light');
                    setIsThemeOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition mt-1 ${
                    theme === 'light' ? 'bg-slate-700 text-slate-100 border border-slate-600' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-300" />
                  <span>☀️ Bright Day</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. USER PROFILE BUTTON & DROPDOWN */}
          <div className="relative" ref={profileRef}>
            {currentUser ? (
              <button
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  setIsThemeOpen(false);
                }}
                className="flex items-center gap-2.5 bg-slate-900/90 hover:bg-slate-800 border border-amber-500/30 px-3 py-1.5 rounded-xl transition shadow-md group"
              >
                {/* User Avatar Circle */}
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 text-xs font-black">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>

                <div className="text-left hidden sm:block">
                  <div className="text-xs font-black text-slate-100 truncate max-w-[120px]">
                    {currentUser.name}
                  </div>
                  <div className="text-[9px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                    {currentUser.role}
                  </div>
                </div>

                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform" />
              </button>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black px-3.5 py-1.5 rounded-xl text-xs shadow-md shadow-amber-500/20 transition"
              >
                <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Staff Login</span>
              </button>
            )}

            {/* Profile Dropdown Menu */}
            {isProfileOpen && currentUser && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 text-base font-black">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black text-slate-100 truncate">{currentUser.name}</div>
                    <div className="text-xs text-slate-400 font-mono truncate">{currentUser.email}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold">Role:</span>
                  {(() => {
                    const badge = getRoleBadge(currentUser.role);
                    const RoleIcon = badge.icon;
                    return (
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${badge.color}`}>
                        <RoleIcon className="w-3 h-3" /> {badge.label}
                      </span>
                    );
                  })()}
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={() => {
                      logoutUser();
                      setIsProfileOpen(false);
                    }}
                    className="w-full bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" /> Sign Out Session
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
}
