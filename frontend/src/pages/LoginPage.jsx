import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import BermudaLogo from '../components/BermudaLogo';
import { Shield, Key, Mail, Lock, Sparkles, AlertCircle, QrCode, Crown, Users, Wine, Utensils, ArrowRight } from 'lucide-react';

export default function LoginPage({ onBypassGuest }) {
  const { loginUser } = useOrder();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    const result = await loginUser(email, password);
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Login failed. Check your email and password.');
    }
  };

  const handleQuickFill = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden pub-ambient-bg">
      {/* Ambient Spotlight Background Effects */}
      <div className="pub-spotlight spotlight-left pointer-events-none opacity-80" />
      <div className="pub-spotlight spotlight-right pointer-events-none opacity-80" />

      {/* Background High-Def Photography Texture */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-25 pointer-events-none"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1600&q=80')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/95 to-slate-950 pointer-events-none" />

      {/* Main Login Card Container */}
      <div className="relative z-10 w-full max-w-lg space-y-6">
        {/* Brand Logo & Welcome Banner */}
        <div className="text-center space-y-3">
          <BermudaLogo size="lg" className="mx-auto drop-shadow-2xl" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight">
              BERMUDA POS & STAFF PORTAL
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Please sign in with your staff or master admin account to open terminal home page.
            </p>
          </div>
        </div>

        {/* Login Form Box */}
        <div className="bg-slate-900/90 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-5 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" /> Account Authentication
            </h2>
            <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
              SECURE POS LOGIN
            </span>
          </div>

          {errorMsg && (
            <div className="bg-rose-950/80 border border-rose-500/50 text-rose-300 p-3.5 rounded-2xl text-xs flex items-center gap-2 shadow-lg">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Email / Login ID *</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="avasanth081@gmail.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Password *</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-amber-500/25 transition flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In & Open Terminal'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Account Selector Badges */}
          <div className="pt-4 border-t border-slate-800 space-y-2.5">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Quick Account Fill Selector:
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill('avasanth081@gmail.com', 'Vasanth@123')}
                className="bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 p-2.5 rounded-2xl text-left transition group"
              >
                <div className="font-extrabold flex items-center gap-1 group-hover:text-amber-200">
                  <Crown className="w-3.5 h-3.5 text-amber-400" /> Master Admin
                </div>
                <span className="block text-[10px] text-amber-400/70 font-mono">Full System Access</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('waiter@bermuda.pub', 'Waiter@123')}
                className="bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/40 text-blue-300 p-2.5 rounded-2xl text-left transition group"
              >
                <div className="font-extrabold flex items-center gap-1 group-hover:text-blue-200">
                  <Users className="w-3.5 h-3.5 text-blue-400" /> Waiter Staff
                </div>
                <span className="block text-[10px] text-blue-400/70 font-mono">Table QR Orders</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('bar@bermuda.pub', 'Bar@123')}
                className="bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/40 text-purple-300 p-2.5 rounded-2xl text-left transition group"
              >
                <div className="font-extrabold flex items-center gap-1 group-hover:text-purple-200">
                  <Wine className="w-3.5 h-3.5 text-purple-400" /> Bar Reception
                </div>
                <span className="block text-[10px] text-purple-400/70 font-mono">Drinks & Billing</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('kitchen@bermuda.pub', 'Kitchen@123')}
                className="bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 p-2.5 rounded-2xl text-left transition group"
              >
                <div className="font-extrabold flex items-center gap-1 group-hover:text-emerald-200">
                  <Utensils className="w-3.5 h-3.5 text-emerald-400" /> Kitchen Chef
                </div>
                <span className="block text-[10px] text-emerald-400/70 font-mono">Food KDS Display</span>
              </button>
            </div>
          </div>
        </div>

        {/* Guest Mode Link for Customers */}
        {onBypassGuest && (
          <div className="text-center">
            <button
              onClick={onBypassGuest}
              className="text-xs text-slate-400 hover:text-amber-400 font-semibold underline underline-offset-4 transition flex items-center justify-center gap-1.5 mx-auto"
            >
              <QrCode className="w-4 h-4 text-amber-400" /> Browse Customer Digital Menu (Guest View)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
