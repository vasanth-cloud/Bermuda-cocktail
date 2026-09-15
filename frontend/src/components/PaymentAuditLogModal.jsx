import React from 'react';
import { useOrder } from '../context/OrderContext';
import { Receipt, X, ShieldCheck, Download, FileSpreadsheet } from 'lucide-react';

export default function PaymentAuditLogModal({ isOpen, onClose }) {
  const { paymentLogs, paymentSummary } = useOrder();

  if (!isOpen) return null;

  const grandTotal = (paymentSummary.total_cash || 0) + (paymentSummary.total_upi || 0) + (paymentSummary.total_card || 0);

  // Excel / CSV Export Function
  const exportToExcel = () => {
    if (!paymentLogs || paymentLogs.length === 0) {
      alert("No payment logs recorded to export.");
      return;
    }

    const headers = ["Timestamp", "Order Number", "Table", "Payment Mode", "Staff (Collected By)", "Amount (INR)"];
    const rows = paymentLogs.map(log => [
      `"${log.timestamp || ''}"`,
      `"#${log.order_number || ''}"`,
      `"${log.table_number || ''}"`,
      `"${log.payment_mode || ''}"`,
      `"${log.collected_by || ''}"`,
      `"${log.amount_collected || 0}"`
    ]);

    const csvString = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `Bermuda_Pub_Cashier_Audit_Log_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
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
                Detailed record of all staff cash & payment collections for today.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-100 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition"
              title="Download Excel CSV report"
            >
              <FileSpreadsheet className="w-4 h-4" /> Download Excel (.csv)
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Payment Summary Bar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
              💵 Cash: ₹{paymentSummary.total_cash || 0}
            </span>
            <span className="bg-blue-950 text-blue-300 border border-blue-800 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
              📱 UPI: ₹{paymentSummary.total_upi || 0}
            </span>
            <span className="bg-purple-950 text-purple-300 border border-purple-800 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
              💳 Card: ₹{paymentSummary.total_card || 0}
            </span>
          </div>

          <div className="bg-amber-500 text-slate-950 font-black px-3.5 py-1.5 rounded-xl text-xs shadow-md">
            💰 Grand Total: ₹{grandTotal}
          </div>
        </div>

        {/* Audit Log Table Area */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Offline Verified Ledger
            </span>
            <span className="font-mono text-[11px]">Auto-saved locally</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            {paymentLogs.length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-12 italic bg-slate-950/40">
                No payment logs recorded yet today. When cash or payments are collected, logs will appear here.
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0">
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

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            onClick={exportToExcel}
            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Download className="w-4 h-4" /> Download Excel Sheet (.csv)
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
          >
            Close Audit Register
          </button>
        </div>
      </div>
    </div>
  );
}
