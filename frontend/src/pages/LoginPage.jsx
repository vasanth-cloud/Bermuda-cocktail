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
      {/* Background Soft Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm space-y-6">
        {/* Simple Vertical Brand Logo */}
        <div className="text-center space-y-2">
          <BermudaLogo variant="login" size="xl" className="mx-auto" />
          <h1 className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight">
            BERMUDA PUB POS
          </h1>
          <p className="text-xs text-slate-400">Sign in to access your terminal</p>
        </div>

        {/* Clean Simple Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
          {errorMsg && (
            <div className="bg-rose-950/80 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-300 block mb-1">Email / Login ID</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="avasanth081@gmail.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 py-3 rounded-xl font-black text-xs shadow-lg transition flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Guest View Option */}
        {onBypassGuest && (
          <div className="text-center pt-1">
            <button
              onClick={onBypassGuest}
              className="text-xs text-slate-400 hover:text-amber-400 font-semibold transition flex items-center justify-center gap-1.5 mx-auto"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-400" /> Browse Customer QR Menu (Guest View)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
