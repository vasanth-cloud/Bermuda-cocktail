import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import BermudaLogo from './BermudaLogo';
import LoginModal from './LoginModal';
import { 
  Wine, 
  UtensilsCrossed, 
  Users, 
  LayoutDashboard, 
  QrCode, 
  Wifi, 
  WifiOff, 
  Palette, 
  Shield,
  Menu,
  X,
  ChevronRight,
  Sparkles,
  LogIn,
  LogOut,
  UserCheck,
  Crown,
  CreditCard
} from 'lucide-react';

export default function Navbar() {
  const {
    activeTab,
    setActiveTab,
    selectedTable,
    setSelectedTable,
    tables,
    wsConnected,
    theme,
    setTheme,
    isCustomerQrMode,
    currentUser,
    logoutUser
  } = useOrder();

  const [showStaffNav, setShowStaffNav] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  const navItems = [
    { 
      id: 'customer', 
      label: 'Customer Menu', 
      desc: 'Digital QR Ordering', 
      icon: QrCode, 
      color: 'text-amber-400', 
      bg: 'bg-amber-500/10 border-amber-500/20' 
    },
    { 
      id: 'bar', 
      label: 'Bar & Kitchen KDS', 
      desc: 'Drinks, Food & Reception Billing', 
      icon: Wine, 
      color: 'text-purple-400', 
      bg: 'bg-purple-500/10 border-purple-500/20' 
    },
    { 
      id: 'staff', 
      label: 'Waiter Staff', 
      desc: 'Floor Tables & Pickup Alerts', 
      icon: Users, 
      color: 'text-blue-400', 
      bg: 'bg-blue-500/10 border-blue-500/20' 
    },
    { 
      id: 'members', 
      label: 'VIP Member Cards', 
      desc: 'Bermuda VIP Cards & Visits', 
      icon: CreditCard, 
      color: 'text-amber-400', 
      bg: 'bg-amber-500/10 border-amber-500/20' 
    },
    { 
      id: 'admin', 
      label: 'Cloud Admin', 
      desc: 'Master Menu & Staff Accounts', 
      icon: LayoutDashboard, 
      color: 'text-rose-400', 
      bg: 'bg-rose-500/10 border-rose-500/20' 
    },
  ];

  // Filter terminal navigation items based on currentUser role
  const getVisibleNavItems = () => {
    if (!currentUser) {
      if (isCustomerQrMode && !showStaffNav) {
        return navItems.filter(item => item.id === 'customer');
      }
      return navItems.filter(item => item.id !== 'admin');
    }

    if (currentUser.role === 'ADMIN') {
      return navItems; // ONLY Master Admin gets Cloud Admin terminal
    }
    if (currentUser.role === 'WAITER') {
      return navItems.filter(item => item.id === 'customer' || item.id === 'staff' || item.id === 'members');
    }
    if (currentUser.role === 'BAR_KITCHEN' || currentUser.role === 'BAR_RECEPTION' || currentUser.role === 'KITCHEN_CHEF') {
      return navItems.filter(item => item.id === 'customer' || item.id === 'bar' || item.id === 'members');
    }

    // Default: Hide Cloud Admin from all staff users
    return navItems.filter(item => item.id !== 'admin');
  };

  const visibleNavItems = getVisibleNavItems();

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

  return (
    <>
      {/* ---------------------------------------------------- */}
      {/* MOBILE TOP HEADER BAR (Screens < md)                  */}
      {/* ---------------------------------------------------- */}
      <div className="md:hidden sticky top-0 z-40 bg-slate-950 border-b border-slate-800 px-3 py-2 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <BermudaLogo size="sm" />
        </div>

        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-amber-500/30 px-2.5 py-1 rounded-full text-xs font-bold text-amber-300">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="max-w-[90px] truncate">{currentUser.name}</span>
            </div>
          ) : (
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/40 text-xs font-extrabold px-2.5 py-1 rounded-full transition flex items-center gap-1"
            >
              <LogIn className="w-3.5 h-3.5" /> Staff Login
            </button>
          )}
        </div>
      </div>

      {/* MOBILE BACKDROP OVERLAY */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* EXECUTIVE LEFT VERTICAL SIDEBAR (Desktop & Mobile Drawer) */}
      {/* ---------------------------------------------------- */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 bg-slate-950 border-r border-slate-800/80 text-slate-100
          flex flex-col justify-between p-4 sm:p-5 shadow-2xl transition-transform duration-300 ease-in-out
          w-64 lg:w-72 overflow-y-auto custom-scrollbar
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Top Header & Brand */}
        <div className="space-y-5">
          {/* Brand Header */}
          <div className="flex flex-col items-center justify-center pb-4 border-b border-slate-800/80 relative">
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden absolute top-0 right-0 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <BermudaLogo size="md" className="my-0.5" />

            <div className="mt-2.5 flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold tracking-widest text-amber-400 uppercase px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> POS SYSTEM
              </span>
            </div>
          </div>

          {/* Navigation Section */}
          <div>
            <div className="flex items-center justify-between px-1 mb-2.5">
              <p className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
                Navigation Terminals
              </p>
              {isCustomerQrMode && !currentUser && (
                <button
                  onClick={() => setShowStaffNav(!showStaffNav)}
                  className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 text-[10px] flex items-center gap-1 font-semibold"
                  title="Toggle Staff Mode"
                >
                  <Shield className="w-3 h-3 text-amber-400" />
                  {showStaffNav ? 'Staff Mode' : 'Customer'}
                </button>
              )}
            </div>

            {/* Menu Button Cards */}
            <nav className="space-y-2">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`
                      w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all duration-200 group relative overflow-hidden
                      ${
                        isActive
                          ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 font-black translate-x-1 scale-[1.02]'
                          : 'bg-slate-900/70 text-slate-200 hover:bg-slate-800/90 hover:border-slate-700/80 border border-slate-800/70'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center border shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'bg-slate-950/20 border-slate-950/30 text-slate-950' : `${item.bg} ${item.color}`}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className={`text-xs font-extrabold ${isActive ? 'text-slate-950' : 'text-slate-100'}`}>
                          {item.label}
                        </div>
                        <div className={`text-[10px] ${isActive ? 'text-slate-950/80 font-medium' : 'text-slate-400'}`}>
                          {item.desc}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? 'text-slate-950 translate-x-0.5' : 'text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5'}`} />
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Utility Controls */}
        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          {/* Table Preview Selector Card */}
          {activeTab === 'customer' && (
            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 space-y-1 shadow-md">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block px-0.5">
                Scanned Table Preview
              </label>
              <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
                <QrCode className="w-4 h-4 text-amber-400 shrink-0" />
                <select
                  value={selectedTable?.id || ''}
                  onChange={(e) => {
                    const t = tables.find((tbl) => tbl.id === Number(e.target.value));
                    if (t) setSelectedTable(t);
                  }}
                  className="bg-transparent text-xs font-semibold text-amber-300 focus:outline-none cursor-pointer w-full"
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200">
                      Table {t.table_number} ({t.zone?.display_name || 'Main'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Wi-Fi & System Status Card */}
          <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold text-slate-400">Wi-Fi Status</span>
            {wsConnected ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Connected
              </span>
            ) : (
              <span className="text-rose-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" /> Reconnecting
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* Staff & Admin Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
}

