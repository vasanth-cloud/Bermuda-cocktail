import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import PaymentAuditLogModal from '../components/PaymentAuditLogModal';
import { Wine, CheckCircle2, Clock, DollarSign, Receipt, RefreshCw, AlertCircle, Smartphone, CreditCard } from 'lucide-react';

export default function BarReception() {
  const { barOrders, updateOrderStatus, updateItemStatus, collectPayment, settleTableBill, tables, paymentLogs, paymentSummary } = useOrder();
  const [selectedTableFilter, setSelectedTableFilter] = useState('ALL');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Payment Modal State
  const [activePaymentOrder, setActivePaymentOrder] = useState(null);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [amountCollected, setAmountCollected] = useState('');
  const [cashierName, setCashierName] = useState('Receptionist');

  const filteredOrders = barOrders.filter((ord) => {
    if (selectedTableFilter === 'ALL') return true;
    return ord.table_id === Number(selectedTableFilter);
  });

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!activePaymentOrder || !amountCollected) return;

    const success = await collectPayment(
      activePaymentOrder.id,
      paymentMode,
      parseFloat(amountCollected),
      cashierName || 'Receptionist'
    );

    if (success) {
      setActivePaymentOrder(null);
      setAmountCollected('');
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      {/* Header Banner with Pub Wallpaper Overlay */}
      <div className="relative rounded-2xl mb-6 shadow-xl border border-slate-800 overflow-hidden bg-slate-900">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-45 pointer-events-none"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1600&q=80')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent pointer-events-none" />

        <div className="relative z-10 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 shadow-lg">
              <Wine className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                Receptionist & Bar Counter Panel
                <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">
                  DRINK ORDERS & BILLING
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Real-time drink preparation display & receptionist bill settlement terminal.
              </p>
            </div>
          </div>

        {/* Top-Right Utility Bar (Audit Log & Table Filter) */}
        <div className="flex items-center gap-3 flex-wrap self-end md:self-auto">
          {/* Top-Right Audit Log Trigger Button */}
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-md transition"
          >
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span>Audit Logs (₹{paymentSummary.grand_total || 0})</span>
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {paymentLogs.length}
            </span>
          </button>

          {/* Table Filter */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold">Filter Table:</span>
            <select
              value={selectedTableFilter}
              onChange={(e) => setSelectedTableFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-amber-400 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-slate-200">All Tables ({barOrders.length})</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200">
                  Table {t.table_number} ({t.zone?.prefix})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500">
          <Wine className="w-12 h-12 mx-auto mb-3 opacity-30 text-purple-400" />
          <h3 className="text-lg font-bold text-slate-300">No Pending Drink Orders</h3>
          <p className="text-xs">Scan a table QR code in Customer Menu view and place a drink order to see live routing.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrders.map((order) => {
            const isBilled = order.status === 'BILLED';
            const barItems = order.items.filter((it) => it.target_dept === 'BAR');

            // COMPACT SLIM CARD FOR COMPLETED / BILLED ORDERS (Saves Vertical Space)
            if (isBilled) {
              return (
                <div
                  key={order.id}
                  className="bg-slate-900/70 border border-emerald-500/30 p-3.5 rounded-xl flex items-center justify-between shadow-sm transition hover:border-emerald-500/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black text-sm shrink-0">
                      ✓
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-slate-100">
                          Table {order.table?.table_number || 'ST-01'}
                        </h4>
                        <span className="text-[10px] font-mono text-slate-400">#{order.order_number}</span>
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full uppercase">
                          BILLED
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Paid <span className="font-extrabold text-emerald-400">₹{order.amount_collected || order.total_amount}</span> via {order.payment_mode || 'CASH'} ({order.collected_by || 'Receptionist'})
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-extrabold text-amber-400 block">₹{order.total_amount}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">Vacant</span>
                  </div>
                </div>
              );
            }

            // FULL ACTIVE ORDER CARD FOR PENDING PREPARATION & BILLING
            return (
              <div
                key={order.id}
                className="bg-slate-900 border border-purple-500/40 hover:border-purple-500 rounded-2xl p-5 shadow-xl transition flex flex-col justify-between"
              >
                <div>
                  {/* Card Top Banner */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-slate-100">
                        Table {order.table?.table_number || 'ST-01'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-purple-300 font-mono uppercase">
                        {order.table?.zone?.display_name || 'Main Zone'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono text-slate-400 block">#{order.order_number}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        order.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  {/* Drink Items List */}
                  <div className="space-y-2.5 mb-4">
                    {barItems.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-100">{item.product?.name || `Item #${item.product_id}`}</div>
                          <div className="text-slate-400 mt-0.5">Qty: {item.quantity} x ₹{item.unit_price} = ₹{item.quantity * item.unit_price}</div>
                        </div>

                        <button
                          onClick={() => updateItemStatus(item.id, item.status === 'READY' ? 'SERVED' : 'READY')}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl transition ${
                            item.status === 'READY' || item.status === 'SERVED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-purple-600 hover:bg-purple-500 text-slate-100 shadow-md'
                          }`}
                        >
                          {item.status === 'READY' || item.status === 'SERVED' ? '✓ Ready (Alerted Waiter)' : 'Mark Drink Ready'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total & Action Footer */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between font-black text-slate-100">
                    <span className="text-xs text-slate-400 uppercase tracking-wider">Total Drinks Bill:</span>
                    <span className="text-amber-400 text-lg">₹{order.total_amount}</span>
                  </div>

                  <button
                    onClick={() => {
                      setActivePaymentOrder(order);
                      setAmountCollected(order.total_amount.toString());
                    }}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-slate-100 text-xs font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md transition"
                  >
                    <Receipt className="w-4 h-4" /> Collect Cash & Settle Bill
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Collect Payment Modal */}
      {activePaymentOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-lg text-slate-100 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" /> Settle Bill & Collect Payment
              </h3>
              <button
                onClick={() => setActivePaymentOrder(null)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Table:</span>
                <span className="font-bold text-slate-200">{activePaymentOrder.table?.table_number}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Order Total:</span>
                <span className="font-black text-amber-400 text-sm">₹{activePaymentOrder.total_amount}</span>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Select Payment Mode *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('CASH')}
                    className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1 border transition ${
                      paymentMode === 'CASH'
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" /> Cash 💵
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('UPI')}
                    className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1 border transition ${
                      paymentMode === 'UPI'
                        ? 'bg-blue-950 border-blue-500 text-blue-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" /> UPI 📱
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('CARD')}
                    className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1 border transition ${
                      paymentMode === 'CARD'
                        ? 'bg-purple-950 border-purple-500 text-purple-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" /> Card 💳
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Amount Collected (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={amountCollected}
                  onChange={(e) => setAmountCollected(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-base font-extrabold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Cashier / Staff Name</label>
                <input
                  type="text"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none"
                  placeholder="e.g. Receptionist"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActivePaymentOrder(null)}
                  className="w-full bg-slate-800 text-slate-300 py-3 rounded-xl font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-slate-100 py-3 rounded-xl font-black shadow-lg"
                >
                  Record Payment & Clear Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top-Right Audit Log Popover Modal */}
      <PaymentAuditLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />
    </div>
  );
}
