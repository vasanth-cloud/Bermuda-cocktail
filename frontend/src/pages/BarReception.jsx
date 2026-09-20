import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import PaymentAuditLogModal from '../components/PaymentAuditLogModal';
import CategorySalesReportModal from '../components/CategorySalesReportModal';
import { Wine, Utensils, CheckCircle2, Clock, DollarSign, Receipt, RefreshCw, AlertCircle, Smartphone, CreditCard, Flame, Sparkles, Filter, BarChart3 } from 'lucide-react';

export default function BarReception() {
  const { allOrders, updateOrderStatus, updateItemStatus, collectPayment, settleTableBill, tables, paymentLogs, paymentSummary } = useOrder();
  
  const [stationFilter, setStationFilter] = useState('ALL'); // ALL, BAR, KITCHEN
  const [selectedTableFilter, setSelectedTableFilter] = useState('ALL');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Payment Modal State
  const [activePaymentOrder, setActivePaymentOrder] = useState(null);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [amountCollected, setAmountCollected] = useState('');
  const [cashierName, setCashierName] = useState('Receptionist');
  const [bookingPlatform, setBookingPlatform] = useState('Direct / Walk-in');
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);

  const openPaymentModal = (ord) => {
    setActivePaymentOrder(ord);
    setPaymentMode('CASH');
    setBookingPlatform(ord.booking_platform || 'Direct / Walk-in');
    const pct = ord.discount_percentage || 0;
    const disc = ord.discount_amount || 0;
    const sub = ord.total_amount || 0;
    setDiscountPercentage(pct);
    setDiscountAmount(disc);
    const calculatedNet = disc > 0 ? sub - disc : (pct > 0 ? sub - (sub * pct)/100 : sub);
    setAmountCollected(calculatedNet > 0 ? calculatedNet.toFixed(2) : sub.toString());
  };

  const filteredOrders = allOrders.filter((ord) => {
    const matchesTable = selectedTableFilter === 'ALL' || Number(ord.table_id) === Number(selectedTableFilter);
    if (!matchesTable) return false;

    const deptUpper = (dept) => (dept || '').toUpperCase();

    if (stationFilter === 'BAR') {
      return ord.items && ord.items.some(it => deptUpper(it.target_dept) === 'BAR');
    }
    if (stationFilter === 'KITCHEN') {
      return ord.items && ord.items.some(it => deptUpper(it.target_dept) === 'KITCHEN');
    }

    return true;
  });

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!activePaymentOrder || !amountCollected) return;

    const finalNetPayable = parseFloat(amountCollected);

    const success = await collectPayment(
      activePaymentOrder.id,
      paymentMode,
      finalNetPayable,
      cashierName || 'Receptionist',
      bookingPlatform,
      discountPercentage,
      discountAmount,
      finalNetPayable
    );

    if (success) {
      setActivePaymentOrder(null);
      setAmountCollected('');
      setDiscountPercentage(0);
      setDiscountAmount(0);
      setBookingPlatform('Direct / Walk-in');
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
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-emerald-500/20 border border-purple-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-lg">
              <Wine className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                Bar & Kitchen Combined KDS Panel
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> UNIFIED DRINKS & FOOD KDS
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Single unified terminal for live Bar drink prep, Kitchen food prep & Reception bill settlement.
              </p>
            </div>
          </div>

          {/* Top-Right Utility Bar */}
          <div className="flex items-center gap-3 flex-wrap self-end md:self-auto">
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-purple-300 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-md transition"
              title="Open Category-Wise & Payment Sales Report"
            >
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <span>Category & Sales Reports</span>
            </button>

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

            <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedTableFilter}
                onChange={(e) => setSelectedTableFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-amber-400 focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-slate-200">All Tables ({allOrders.length})</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200">
                    Table {t.table_number} ({t.zone?.display_name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Station Selector Bar (ALL, BAR DRINKS, KITCHEN FOOD) */}
      <div className="flex items-center gap-2 mb-6 bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
        <button
          onClick={() => setStationFilter('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
            stationFilter === 'ALL'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" /> Unified All Tickets ({allOrders.length})
        </button>

        <button
          onClick={() => setStationFilter('BAR')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
            stationFilter === 'BAR'
              ? 'bg-purple-950 border border-purple-500/50 text-purple-300 shadow-lg shadow-purple-950/50'
              : 'text-slate-400 hover:text-purple-300 hover:bg-slate-800'
          }`}
        >
          <Wine className="w-4 h-4 text-purple-400" /> 🍸 Bar Drinks Station
        </button>

        <button
          onClick={() => setStationFilter('KITCHEN')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
            stationFilter === 'KITCHEN'
              ? 'bg-emerald-950 border border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-950/50'
              : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800'
          }`}
        >
          <Utensils className="w-4 h-4 text-emerald-400" /> 🍳 Kitchen Food Station
        </button>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500">
          <Wine className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-400" />
          <h3 className="text-lg font-bold text-slate-300">No Pending Tickets in Bar & Kitchen Queue</h3>
          <p className="text-xs">Scan a table QR code in Customer Menu or confirm a Waiter order to view tickets here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrders.map((order) => {
            const isBilled = order.status === 'BILLED';
            const barItems = order.items.filter((it) => (it.target_dept || '').toUpperCase() === 'BAR');
            const kitchenItems = order.items.filter((it) => (it.target_dept || '').toUpperCase() === 'KITCHEN');

            // COMPACT SLIM CARD FOR BILLED ORDERS
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
                          Table {order.table?.table_number || 'DN-01'}
                        </h4>
                        <span className="text-[10px] font-mono text-slate-400">#{order.order_number}</span>
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full uppercase">
                          BILLED
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Paid <span className="font-extrabold text-emerald-400">₹{order.amount_collected || order.total_amount}</span> via {order.payment_mode || 'CASH'}
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

            // FULL ACTIVE TICKET CARD FOR BAR & KITCHEN
            return (
              <div
                key={order.id}
                className="bg-slate-900 border border-amber-500/30 hover:border-amber-500/70 rounded-2xl p-5 shadow-xl transition flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-2xl font-black text-slate-100">
                        Table {order.table?.table_number || 'DN-01'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono uppercase">
                        {order.table?.zone?.display_name || 'Main Zone'}
                      </span>
                      {(order.waiter_name || order.collected_by) && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                          👤 Waiter: {order.waiter_name || order.collected_by}
                        </span>
                      )}
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

                  {/* Section 1: BAR DRINKS */}
                  {stationFilter !== 'KITCHEN' && barItems.length > 0 && (
                    <div className="space-y-2 mb-3">
                      <div className="text-[10px] font-extrabold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                        <Wine className="w-3 h-3" /> BAR DRINKS ({barItems.length}):
                      </div>
                      {barItems.map((item) => (
                        <div
                          key={item.id}
                          className="bg-slate-950 border border-purple-900/40 p-2.5 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-100 flex items-center gap-1.5">
                              <span className="font-mono text-amber-400 font-extrabold">{item.quantity}x</span>
                              {item.product?.name || `Drink #${item.product_id}`}
                            </div>
                            <div className="text-slate-400 text-[11px] mt-0.5">₹{item.quantity * item.unit_price}</div>
                          </div>

                          <button
                            onClick={() => updateItemStatus(item.id, item.status === 'READY' ? 'PENDING' : 'READY')}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition ${
                              item.status === 'SERVED'
                                ? 'bg-purple-950/60 text-purple-300 border border-purple-800'
                                : item.status === 'READY'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : 'bg-purple-600 hover:bg-purple-500 text-slate-100 shadow-md'
                            }`}
                          >
                            {item.status === 'SERVED' ? '🍽️ Served at Table' : item.status === 'READY' ? '✓ Drink Ready (Notify Waiter)' : 'Mark Drink Ready'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Section 2: KITCHEN FOOD */}
                  {stationFilter !== 'BAR' && kitchenItems.length > 0 && (
                    <div className="space-y-2 mb-3">
                      <div className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <Utensils className="w-3 h-3" /> KITCHEN FOOD ({kitchenItems.length}):
                      </div>
                      {kitchenItems.map((item) => (
                        <div
                          key={item.id}
                          className="bg-slate-950 border border-emerald-900/40 p-2.5 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-100 flex items-center gap-1.5">
                              <span className="font-mono text-emerald-400 font-extrabold">{item.quantity}x</span>
                              {item.product?.name || `Food #${item.product_id}`}
                            </div>
                            {item.notes && <div className="text-[10px] text-amber-300 italic">Note: "{item.notes}"</div>}
                            <div className="text-slate-400 text-[11px] mt-0.5">₹{item.quantity * item.unit_price}</div>
                          </div>

                          <button
                            onClick={() => updateItemStatus(item.id, item.status === 'READY' ? 'PENDING' : 'READY')}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition ${
                              item.status === 'SERVED'
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                                : item.status === 'READY'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-md'
                            }`}
                          >
                            {item.status === 'SERVED' ? '🍽️ Served at Table' : item.status === 'READY' ? '✓ Food Ready (Notify Waiter)' : 'Mark Food Ready'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total & KDS Preparation Status Footer */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between font-black text-slate-100">
                    <span className="text-xs text-slate-400 uppercase tracking-wider">Total Table Bill:</span>
                    <span className="text-amber-400 text-lg">₹{order.total_amount}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {order.items && order.items.every(i => i.status === 'READY' || i.status === 'SERVED') ? (
                      <div className="flex-1 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold py-2 rounded-xl text-center flex items-center justify-center gap-1.5 shadow">
                        ✓ All Ready
                      </div>
                    ) : (
                      <div className="flex-1 bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-bold py-2 rounded-xl text-center flex items-center justify-center gap-1.5">
                        ⏳ Preparing...
                      </div>
                    )}

                    <button
                      onClick={() => openPaymentModal(order)}
                      className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-3 py-2 rounded-xl text-xs flex items-center gap-1 shadow-md transition shrink-0"
                    >
                      <DollarSign className="w-4 h-4" /> Settle Bill
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Collect Payment Modal */}
      {activePaymentOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-amber-400" /> Settle Bill & Collect Payment
                </h3>
                <p className="text-xs text-slate-400">Order #{activePaymentOrder.order_number} — Table {activePaymentOrder.table?.table_number}</p>
              </div>
              <button
                onClick={() => setActivePaymentOrder(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              {/* 1. Booking Platform Selection */}
              <div>
                <label className="font-bold text-slate-300 block mb-1.5 flex items-center justify-between">
                  <span>Booking Platform / Dining Offer Source:</span>
                  <span className="text-amber-400 text-[10px] font-mono">{bookingPlatform}</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'Direct / Walk-in', label: 'Walk-in / Direct', icon: '🚶' },
                    { id: 'District (Zomato District)', label: 'District (Zomato)', icon: '📱' },
                    { id: 'Swiggy (Swiggy Dineout)', label: 'Swiggy Dineout', icon: '🧡' },
                    { id: 'Zomato', label: 'Zomato Gold', icon: '🔴' },
                    { id: 'EazyDiner', label: 'EazyDiner', icon: '🍽️' },
                    { id: 'Other', label: 'Other Offer', icon: '🏷️' }
                  ].map((plat) => (
                    <button
                      key={plat.id}
                      type="button"
                      onClick={() => setBookingPlatform(plat.id)}
                      className={`py-2 px-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 border text-[11px] transition ${
                        bookingPlatform === plat.id
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>{plat.icon}</span>
                      <span className="truncate">{plat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Quick Offer Discount % Calculator */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-300 text-xs">Dining Offer Discount (% or ₹):</label>
                  {discountPercentage > 0 && (
                    <span className="bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                      {discountPercentage}% OFF Applied
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[0, 10, 15, 20, 25, 30, 50].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        setDiscountPercentage(pct);
                        const sub = activePaymentOrder.total_amount || 0;
                        const disc = (sub * pct) / 100;
                        setDiscountAmount(disc);
                        setAmountCollected(Math.max(0, sub - disc).toFixed(2));
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black border transition ${
                        discountPercentage === pct
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {pct === 0 ? 'No Offer' : `${pct}% OFF`}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">Custom Offer %:</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      placeholder="e.g. 15"
                      value={discountPercentage || ''}
                      onChange={(e) => {
                        const pct = parseFloat(e.target.value) || 0;
                        setDiscountPercentage(pct);
                        const sub = activePaymentOrder.total_amount || 0;
                        const disc = (sub * pct) / 100;
                        setDiscountAmount(disc);
                        setAmountCollected(Math.max(0, sub - disc).toFixed(2));
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">Or Flat Discount (₹):</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 200"
                      value={discountAmount || ''}
                      onChange={(e) => {
                        const disc = parseFloat(e.target.value) || 0;
                        setDiscountAmount(disc);
                        const sub = activePaymentOrder.total_amount || 0;
                        if (sub > 0) {
                          setDiscountPercentage(Math.round((disc / sub) * 100));
                        }
                        setAmountCollected(Math.max(0, sub - disc).toFixed(2));
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Real-Time Live Calculation Box */}
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Original Subtotal:</span>
                    <span>₹{activePaymentOrder.total_amount || 0}</span>
                  </div>

                  {(discountPercentage > 0 || discountAmount > 0) && (
                    <div className="flex justify-between text-rose-400 font-bold">
                      <span>Offer Discount ({discountPercentage}% OFF):</span>
                      <span>-₹{(discountAmount || ((activePaymentOrder.total_amount * discountPercentage) / 100)).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-100 font-black text-sm pt-1 border-t border-slate-800">
                    <span className="text-amber-300">Net Remaining Payable:</span>
                    <span className="text-amber-400">
                      ₹{(
                        (activePaymentOrder.total_amount || 0) -
                        (discountAmount || ((activePaymentOrder.total_amount * discountPercentage) / 100))
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Payment Method */}
              <div>
                <label className="font-bold text-slate-300 block mb-1.5">Select Payment Mode:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('CASH')}
                    className={`p-2.5 rounded-xl font-bold flex items-center justify-center gap-1 border transition ${
                      paymentMode === 'CASH'
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    💵 Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('UPI')}
                    className={`p-2.5 rounded-xl font-bold flex items-center justify-center gap-1 border transition ${
                      paymentMode === 'UPI'
                        ? 'bg-purple-950 border-purple-500 text-purple-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    📱 UPI / QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('CARD')}
                    className={`p-2.5 rounded-xl font-bold flex items-center justify-center gap-1 border transition ${
                      paymentMode === 'CARD'
                        ? 'bg-blue-950 border-blue-500 text-blue-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    💳 Card
                  </button>
                </div>
              </div>

              {/* 4. Final Amount Collected Input */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">Final Net Amount Collected (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={
                    amountCollected !== ''
                      ? amountCollected
                      : (
                          (activePaymentOrder.total_amount || 0) -
                          (discountAmount || ((activePaymentOrder.total_amount * discountPercentage) / 100))
                        ).toFixed(2)
                  }
                  onChange={(e) => setAmountCollected(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-base font-extrabold text-amber-400 focus:outline-none focus:border-amber-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Collected By (Staff / Cashier Name)</label>
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
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black py-3 rounded-xl shadow-lg transition"
                >
                  Confirm & Clear Table
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

      {/* Category Sales & Department Revenue Report Modal */}
      <CategorySalesReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  );
}
