import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import BermudaLogo from '../components/BermudaLogo';
import { Mail, Lock, ArrowRight, AlertCircle, QrCode } from 'lucide-react';

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
      setErrorMsg(result.error || 'Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Real High-Def Cocktail Bar Photography Background with Transparent Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-40 scale-105 pointer-events-none"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1600&q=80')` }}
      />
      {/* Semi-Transparent Dark Glass Overlay */}
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md pointer-events-none" />

      {/* Main Transparent Centered Card */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center justify-center text-center space-y-5">
        {/* Simple Vertical Brand Logo */}
        <div className="text-center space-y-1.5">
          <BermudaLogo variant="login" size="xl" className="mx-auto" />
          <h1 className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight">
            BERMUDA PUB POS
          </h1>
          <p className="text-xs text-slate-300 font-medium">Sign in to access your terminal</p>
        </div>

        {/* Clean Glassmorphic Centered Form Card */}
        <div className="bg-slate-900/60 border border-amber-500/30 rounded-3xl p-6 shadow-2xl backdrop-blur-xl w-full space-y-4">
          {errorMsg && (
            <div className="bg-rose-950/80 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs flex flex-col items-center w-full">
            <div className="w-full text-center">
              <label className="font-bold text-slate-200 block mb-1.5 text-center">Email / Login ID</label>
              <div className="relative w-full">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="avasanth081@gmail.com"
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-100 text-center placeholder-slate-500 focus:outline-none focus:border-amber-500 transition shadow-inner"
                  required
                />
              </div>
            </div>

            <div className="w-full text-center">
              <label className="font-bold text-slate-200 block mb-1.5 text-center">Password</label>
              <div className="relative w-full">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-100 text-center placeholder-slate-500 focus:outline-none focus:border-amber-500 transition shadow-inner"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 py-3 rounded-xl font-black text-xs shadow-lg transition flex items-center justify-center gap-1.5 mt-1"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Guest View Link */}
        {onBypassGuest && (
          <div className="text-center pt-1">
            <button
              onClick={onBypassGuest}
              className="text-xs text-slate-300 hover:text-amber-400 font-semibold transition flex items-center justify-center gap-1.5 mx-auto bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-400" /> Browse Customer QR Menu (Guest View)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
