import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import { Receipt, X, ShieldCheck, Download, FileSpreadsheet, Trash2, AlertTriangle } from 'lucide-react';

export default function PaymentAuditLogModal({ isOpen, onClose }) {
  const { paymentLogs, paymentSummary, deleteSinglePaymentLog, clearAllPaymentLogs, currentUser } = useOrder();

  // Delete Confirmation Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [logToDelete, setLogToDelete] = useState(null); // null = clear all, object = single log
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const grandTotal = (paymentSummary.total_cash || 0) + (paymentSummary.total_upi || 0) + (paymentSummary.total_card || 0);
  const totalDiscounts = paymentLogs.reduce((acc, log) => acc + (parseFloat(log.discount_amount) || 0), 0);

  // Excel / CSV Export Function
  const exportToExcel = () => {
    if (!paymentLogs || paymentLogs.length === 0) {
      alert("No payment logs recorded to export.");
      return;
    }

    const headers = ["Timestamp", "Order Number", "Table", "Booking Platform", "Original Subtotal (INR)", "Discount Amount (INR)", "Net Payable Collected (INR)", "Payment Mode", "Staff (Collected By)"];
    const rows = paymentLogs.map(log => [
      `"${log.timestamp || ''}"`,
      `"#${log.order_number || ''}"`,
      `"${log.table_number || ''}"`,
      `"${log.booking_platform || 'Direct / Walk-in'}"`,
      `"${log.subtotal_amount || log.total_amount || log.amount_collected || 0}"`,
      `"${log.discount_amount || 0}"`,
      `"${log.amount_collected || log.final_amount || 0}"`,
      `"${log.payment_mode || ''}"`,
      `"${log.collected_by || ''}"`
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

  // Open Delete Confirmation Modal
  const handleOpenDelete = (targetLog = null) => {
    setLogToDelete(targetLog);
    setConfirmText('');
    setIsDeleteModalOpen(true);
  };

  // Execute Deletion
  const handleConfirmDelete = async () => {
    if (confirmText.trim().toUpperCase() !== 'DELETE') return;

    setIsDeleting(true);
    let success = false;
    if (logToDelete && logToDelete.order_id) {
      success = await deleteSinglePaymentLog(logToDelete.order_id);
    } else {
      success = await clearAllPaymentLogs();
    }
    setIsDeleting(false);

    if (success) {
      setIsDeleteModalOpen(false);
      setConfirmText('');
      setLogToDelete(null);
    } else {
      alert("Failed to delete log record. Please try again.");
    }
  };

  const isDeleteConfirmed = confirmText.trim().toUpperCase() === 'DELETE';

  const getPlatformBadge = (plat, pct, disc) => {
    let icon = '🚶';
    let badgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
    const platformName = plat || 'Direct / Walk-in';
    if (platformName.includes('Swiggy')) { icon = '🧡'; badgeClass = 'bg-orange-950/80 text-orange-300 border-orange-800'; }
    else if (platformName.includes('District')) { icon = '📱'; badgeClass = 'bg-purple-950/80 text-purple-300 border-purple-800'; }
    else if (platformName.includes('Zomato')) { icon = '🔴'; badgeClass = 'bg-rose-950/80 text-rose-300 border-rose-800'; }
    else if (platformName.includes('EazyDiner')) { icon = '🍽️'; badgeClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-800'; }
    else if (platformName.includes('Other')) { icon = '🏷️'; badgeClass = 'bg-amber-950/80 text-amber-300 border-amber-800'; }

    return (
      <div className="space-y-0.5">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-flex items-center gap-1 ${badgeClass}`}>
          <span>{icon}</span> {platformName}
        </span>
        {(pct > 0 || disc > 0) && (
          <div className="text-[10px] font-mono text-rose-400 font-extrabold">
            🏷️ {pct > 0 ? `${pct}% OFF` : `₹${disc} OFF`}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 flex-wrap gap-3">
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
                Detailed record of all staff cash, platform dining offers & payment collections today.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {paymentLogs.length > 0 && (
              <button
                onClick={() => handleOpenDelete(null)}
                className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow"
                title="Clear all audit logs with DELETE confirmation"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Clear Audit Logs
              </button>
            )}

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
            {totalDiscounts > 0 && (
              <span className="bg-rose-950 text-rose-300 border border-rose-800 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                🏷️ Total Offers Discounted: -₹{totalDiscounts.toFixed(2)}
              </span>
            )}
          </div>

          <div className="bg-amber-500 text-slate-950 font-black px-3.5 py-1.5 rounded-xl text-xs shadow-md">
            💰 Net Collected Grand Total: ₹{grandTotal}
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
                    <th className="p-3">Platform & Offer</th>
                    <th className="p-3">Payment Mode</th>
                    <th className="p-3">Collected By (Staff)</th>
                    <th className="p-3 text-right">Breakdown & Net (₹)</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium bg-slate-900/30">
                  {paymentLogs.map((log, idx) => {
                    const subtotal = parseFloat(log.subtotal_amount || log.total_amount || log.amount_collected || 0);
                    const disc = parseFloat(log.discount_amount || 0);
                    const netCollected = parseFloat(log.amount_collected || log.final_amount || 0);

                    return (
                      <tr key={idx} className="hover:bg-slate-800/50 transition">
                        <td className="p-3 font-mono text-slate-400">{log.timestamp}</td>
                        <td className="p-3 font-mono text-slate-400">#{log.order_number}</td>
                        <td className="p-3 font-extrabold text-slate-100">{log.table_number}</td>
                        <td className="p-3">{getPlatformBadge(log.booking_platform, log.discount_percentage, disc)}</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold font-mono uppercase inline-flex items-center gap-1 ${
                            log.payment_mode === 'CASH' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                            log.payment_mode === 'UPI' ? 'bg-blue-950 text-blue-300 border border-blue-800' : 'bg-purple-950 text-purple-300 border border-purple-800'
                          }`}>
                            {log.payment_mode === 'CASH' ? '💵 Cash' : log.payment_mode === 'UPI' ? '📱 UPI' : '💳 Card'}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-amber-400">{log.collected_by}</td>
                        <td className="p-3 font-mono text-right">
                          {disc > 0 && (
                            <div className="text-[10px] text-slate-400">
                              Subtotal: <span className="line-through">₹{subtotal}</span> (-₹{disc})
                            </div>
                          )}
                          <div className="font-black text-emerald-400 text-sm">₹{netCollected}</div>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleOpenDelete(log)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition"
                            title={`Delete audit log for #${log.order_number}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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

        {/* MANDATORY 'DELETE' TEXT CONFIRMATION OVERLAY MODAL */}
        {isDeleteModalOpen && (
          <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border-2 border-rose-500/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-slate-100">
                    Confirm Audit Log Deletion
                  </h4>
                  <p className="text-xs text-rose-300 font-medium">
                    {logToDelete
                      ? `Delete log for Order #${logToDelete.order_number} (₹${logToDelete.amount_collected})?`
                      : `Clear ALL ${paymentLogs.length} audit logs (Grand Total: ₹${grandTotal})?`}
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2 text-xs">
                <p className="text-slate-300">
                  To prevent accidental loss of financial audit records, please type <strong className="text-rose-400 font-mono">DELETE</strong> in the box below to authorize deletion:
                </p>
                <input
                  type="text"
                  placeholder="Type DELETE to confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full bg-slate-900 border border-rose-500/50 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-400 transition"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setConfirmText('');
                    setLogToDelete(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!isDeleteConfirmed || isDeleting}
                  onClick={handleConfirmDelete}
                  className={`px-5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-lg ${
                    isDeleteConfirmed
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
