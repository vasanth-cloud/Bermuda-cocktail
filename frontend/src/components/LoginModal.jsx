import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import BermudaLogo from './BermudaLogo';
import { Shield, Key, Mail, Lock, X, Check, Sparkles, AlertCircle } from 'lucide-react';

export default function LoginModal({ isOpen, onClose }) {
  const { loginUser } = useOrder();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

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

    if (result.success) {
      setEmail('');
      setPassword('');
      onClose();
    } else {
      setErrorMsg(result.error || 'Login failed');
    }
  };

  const handleQuickFill = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Logo */}
        <div className="text-center space-y-2">
          <BermudaLogo size="md" className="mx-auto" />
          <h3 className="text-xl font-black text-slate-100 flex items-center justify-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" /> Staff & Admin Portal Login
          </h3>
          <p className="text-xs text-slate-400">Log in to access role-based terminals and management</p>
        </div>

        {errorMsg && (
          <div className="bg-rose-950/60 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Email / Username:</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="avasanth081@gmail.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Password:</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 py-3 rounded-xl font-black text-xs shadow-lg shadow-amber-500/20 transition"
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In to Panel'}
          </button>
        </form>

        {/* Demo Quick Fill Badges */}
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Quick Account Selector:
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button
              onClick={() => handleQuickFill('avasanth081@gmail.com', 'Vasanth@123')}
              className="bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 p-2 rounded-xl text-left font-bold transition"
            >
              👑 Master Admin
              <span className="block text-[9px] font-normal text-amber-400/70 font-mono">Full System Access</span>
            </button>

            <button
              onClick={() => handleQuickFill('waiter@bermuda.pub', 'Waiter@123')}
              className="bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/30 text-blue-300 p-2 rounded-xl text-left font-bold transition"
            >
              🚶 Waiter Staff
              <span className="block text-[9px] font-normal text-blue-400/70 font-mono">Table QR Orders</span>
            </button>

            <button
              onClick={() => handleQuickFill('bar@bermuda.pub', 'Bar@123')}
              className="bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 p-2 rounded-xl text-left font-bold transition"
            >
              🍸 Bar Reception
              <span className="block text-[9px] font-normal text-purple-400/70 font-mono">Drinks & Billing</span>
            </button>

            <button
              onClick={() => handleQuickFill('kitchen@bermuda.pub', 'Kitchen@123')}
              className="bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 p-2 rounded-xl text-left font-bold transition"
            >
              🍳 Kitchen Chef
              <span className="block text-[9px] font-normal text-emerald-400/70 font-mono">Food KDS Display</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
