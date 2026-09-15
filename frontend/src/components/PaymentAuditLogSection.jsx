import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import { Receipt, ChevronDown, ChevronUp, DollarSign, CreditCard, Smartphone, ShieldCheck } from 'lucide-react';

export default function PaymentAuditLogSection({ defaultOpen = false }) {
  const { paymentLogs, paymentSummary } = useOrder();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden transition-all">
      {/* Clickable Header Summary Bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-left hover:bg-slate-850/50 transition cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-100 flex items-center gap-2">
              Cashier Payment Audit Log & Register
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {paymentLogs.length} Records
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Click to {isOpen ? 'collapse' : 'expand'} detailed payment history, staff register, and payment modes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs self-stretch md:self-auto justify-between md:justify-end">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 whitespace-nowrap">
              💵 Cash: ₹{paymentSummary.total_cash || 0}
            </span>
            <span className="bg-blue-950 text-blue-300 border border-blue-800 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 whitespace-nowrap">
              📱 UPI: ₹{paymentSummary.total_upi || 0}
            </span>
            <span className="bg-purple-950 text-purple-300 border border-purple-800 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 whitespace-nowrap">
              💳 Card: ₹{paymentSummary.total_card || 0}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs flex items-center gap-1 border border-slate-700 ml-1 shrink-0">
            {isOpen ? (
              <><span>Hide Logs</span> <ChevronUp className="w-4 h-4 text-amber-400" /></>
            ) : (
              <><span>View Logs</span> <ChevronDown className="w-4 h-4 text-amber-400" /></>
            )}
          </div>
        </div>
      </button>

      {/* Collapsible Payment Logs Table */}
      {isOpen && (
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Offline Verified Audit Trail
            </span>
            <span className="font-mono text-[11px]">
              Total Register Collections: ₹{(paymentSummary.total_cash || 0) + (paymentSummary.total_upi || 0) + (paymentSummary.total_card || 0)}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            {paymentLogs.length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-8 italic bg-slate-900/40">
                No payment logs recorded yet today. When cash or payments are collected, logs will appear here.
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Time</th>
                    <th className="p-3">Order #</th>
                    <th className="p-3">Table</th>
                    <th className="p-3">Payment Mode</th>
                    <th className="p-3">Collected By (Staff)</th>
                    <th className="p-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium bg-slate-900/30">
                  {paymentLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50 transition">
                      <td className="p-3 font-mono text-slate-400">{log.timestamp}</td>
                      <td className="p-3 font-mono text-slate-400">#{log.order_number}</td>
                      <td className="p-3 font-extrabold text-slate-100">{log.table_number}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold font-mono uppercase inline-flex items-center gap-1 ${
                          log.payment_mode === 'CASH' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                          log.payment_mode === 'UPI' ? 'bg-blue-950 text-blue-300 border border-blue-800' : 'bg-purple-950 text-purple-300 border border-purple-800'
                        }`}>
                          {log.payment_mode === 'CASH' ? '💵 Cash' : log.payment_mode === 'UPI' ? '📱 UPI' : '💳 Card'}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-amber-400">{log.collected_by}</td>
                      <td className="p-3 font-black text-emerald-400 text-sm text-right">₹{log.amount_collected}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
