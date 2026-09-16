import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import { Users, QrCode, Wine, Utensils, CheckCircle, AlertTriangle, Plus, ChevronRight, Bell, DollarSign, CreditCard, Smartphone, Check, Edit2, Trash2, Search, X } from 'lucide-react';

export default function StaffPanel() {
  const { tables, zones, setSelectedTable, setActiveTab, allOrders, collectPayment, updateOrderStatus, updateItemStatus, confirmOrderAsWaiter, addItemsToOrder, deleteOrderItem, products, categories } = useOrder();
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('ALL');

  // Payment Collection Modal State
  const [activePaymentOrder, setActivePaymentOrder] = useState(null);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [amountCollected, setAmountCollected] = useState('');
  const [waiterName, setWaiterName] = useState('Waiter');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState(null);

  // Waiter Order Edit Modal State
  const [editingOrderForWaiter, setEditingOrderForWaiter] = useState(null);
  const [modalCategoryFilter, setModalCategoryFilter] = useState('ALL');
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [itemsToAdd, setItemsToAdd] = useState([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const filteredTables = tables.filter((t) => {
    return selectedZoneFilter === 'ALL' || t.zone_id === Number(selectedZoneFilter);
  });

  const getTableActiveOrder = (tableId) => {
    return allOrders.find((o) => o.table_id === tableId && o.status !== 'BILLED');
  };

  // Customer order requests awaiting Waiter confirmation at table
  const pendingCustomerOrderRequests = allOrders.filter(
    (ord) => ord.status === 'PENDING' || ord.status === 'PENDING_WAITER'
  );

  // Find all items that are READY for pickup across all active orders
  const readyItemsForPickup = [];
  allOrders.forEach((ord) => {
    if (ord.status !== 'BILLED') {
      ord.items.forEach((it) => {
        if (it.status === 'READY') {
          readyItemsForPickup.push({
            item: it,
            order: ord,
            tableNumber: ord.table?.table_number || 'ST-01'
          });
        }
      });
    }
  });

  const handleConfirmOrder = async (orderId) => {
    setConfirmingOrderId(orderId);
    await confirmOrderAsWaiter(orderId, waiterName || 'Waiter');
    setConfirmingOrderId(null);
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!activePaymentOrder || !amountCollected) return;

    setIsSubmittingPayment(true);
    const success = await collectPayment(
      activePaymentOrder.id,
      paymentMode,
      amountCollected,
      waiterName
    );
    setIsSubmittingPayment(false);

    if (success) {
      setActivePaymentOrder(null);
      setAmountCollected('');
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
              Waiter & Floor Staff Panel
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-mono">
                LIVE FLOOR & PAYMENTS
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Confirm table orders with customers, route drinks to Bar & food to Kitchen KOT, serve items, and collect Cash / UPI payments.
            </p>
          </div>
        </div>

        {/* Zone Filters */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
          <button
            onClick={() => setSelectedZoneFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              selectedZoneFilter === 'ALL' ? 'bg-blue-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Zones ({tables.length})
          </button>
          {zones.map((z) => (
            <button
              key={z.id}
              onClick={() => setSelectedZoneFilter(z.id.toString())}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                selectedZoneFilter === z.id.toString() ? 'bg-blue-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {z.display_name}
            </button>
          ))}
        </div>
      </div>

      {/* Customer QR Order Requests Awaiting Waiter Confirmation */}
      {pendingCustomerOrderRequests.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-2 border-amber-500/80 p-5 rounded-2xl shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
            <div className="flex items-center gap-2 font-black text-amber-300 text-sm uppercase tracking-wider">
              <Check className="w-5 h-5 text-amber-400" />
              <span>📩 {pendingCustomerOrderRequests.length} Customer QR Order Requests Awaiting Waiter Confirmation</span>
            </div>
            <span className="text-xs bg-amber-500/20 text-amber-300 font-mono px-3 py-1 rounded-full border border-amber-500/40">
              Review & Confirm at Table
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingCustomerOrderRequests.map((ord) => (
              <div key={ord.id} className="bg-slate-950 border border-amber-500/40 p-4 rounded-xl space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-amber-400 font-mono font-bold uppercase">{ord.order_number}</span>
                    <h4 className="text-lg font-black text-slate-100">Table {ord.table?.table_number || 'ST-01'}</h4>
                    <p className="text-xs text-slate-400">Customer: <span className="text-slate-200 font-bold">{ord.customer_name}</span></p>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-amber-400">₹{ord.total_amount}</div>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                      Awaiting Waiter
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-lg space-y-1 text-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested Items:</div>
                  {ord.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between text-slate-200">
                      <span>{it.quantity}x {it.product?.name || `Item #${it.product_id}`}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                        it.target_dept === 'BAR' ? 'bg-purple-950 text-purple-300' : 'bg-emerald-950 text-emerald-300'
                      }`}>
                        {it.target_dept === 'BAR' ? '🍸 Bar' : '🍳 Kitchen'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      setEditingOrderForWaiter(ord);
                      setItemsToAdd([]);
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/40 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                    title="Add extra drinks/food or remove items"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit / Add Items
                  </button>

                  <button
                    disabled={confirmingOrderId === ord.id}
                    onClick={() => handleConfirmOrder(ord.id)}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
                  >
                    <Check className="w-4 h-4" />
                    {confirmingOrderId === ord.id ? 'Routing to Bar & Kitchen...' : 'Confirm & Route Order to Bar/Kitchen'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Pickup Alert Banner for Waiters */}
      {readyItemsForPickup.length > 0 && (
        <div className="bg-amber-950/40 border-2 border-amber-500/60 p-5 rounded-2xl shadow-2xl space-y-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-amber-400 text-sm uppercase tracking-wider">
              <Bell className="w-5 h-5 text-amber-400 animate-bounce" />
              <span>🔔 {readyItemsForPickup.length} Items Prepared & Ready for Pickup!</span>
            </div>
            <span className="text-xs text-slate-400 font-mono">Notify Waiter</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {readyItemsForPickup.map(({ item, order, tableNumber }) => (
              <div key={item.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-slate-100 text-sm">
                    Table {tableNumber}
                  </div>
                  <div className="text-xs text-slate-300 font-medium">
                    {item.quantity}x {item.product?.name || `Item #${item.product_id}`}
                  </div>
                  <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded mt-1 inline-block ${
                    item.target_dept === 'BAR' ? 'bg-purple-950 text-purple-300' : 'bg-emerald-950 text-emerald-300'
                  }`}>
                    {item.target_dept === 'BAR' ? '🍸 Bar Ready' : '🍳 Kitchen Ready'}
                  </span>
                </div>

                <button
                  onClick={() => updateItemStatus(item.id, 'SERVED')}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 shadow-md"
                >
                  <Check className="w-4 h-4" /> Served
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tables Grid categorized by Zone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTables.map((table) => {
          const activeOrder = getTableActiveOrder(table.id);
          const isOccupied = !!activeOrder;
          const barItems = activeOrder ? activeOrder.items.filter(i => i.target_dept === 'BAR') : [];
          const kitchenItems = activeOrder ? activeOrder.items.filter(i => i.target_dept === 'KITCHEN') : [];

          return (
            <div
              key={table.id}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-xl transition flex flex-col justify-between relative overflow-hidden ${
                isOccupied
                  ? 'border-amber-500/40 bg-gradient-to-b from-slate-900 to-amber-950/20'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Zone Tag & Status Pill */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {table.zone?.display_name || 'Zone'}
                  </span>
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    isOccupied ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {isOccupied ? 'Active Order' : 'Vacant'}
                  </span>
                </div>

                <div className="mb-3">
                  <h3 className="text-2xl font-black text-slate-100">
                    Table {table.table_number}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    Capacity: {table.capacity} Persons
                  </div>
                </div>

                {/* Active Order Summary & Department Routing Breakdown */}
                {activeOrder ? (
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-mono">#{activeOrder.order_number}</span>
                      <span className="font-extrabold text-amber-400 text-sm">₹{activeOrder.total_amount}</span>
                    </div>

                    <div className="space-y-1 border-t border-slate-800/80 pt-2 text-[11px]">
                      <div className="flex justify-between items-center text-purple-400">
                        <span className="flex items-center gap-1 font-semibold">
                          <Wine className="w-3 h-3" /> Bar ({barItems.length}):
                        </span>
                        <span className="font-mono font-bold">
                          {barItems.filter(i => i.status === 'READY' || i.status === 'SERVED').length}/{barItems.length} Ready
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-emerald-400">
                        <span className="flex items-center gap-1 font-semibold">
                          <Utensils className="w-3 h-3" /> Kitchen ({kitchenItems.length}):
                        </span>
                        <span className="font-mono font-bold">
                          {kitchenItems.filter(i => i.status === 'READY' || i.status === 'SERVED').length}/{kitchenItems.length} Ready
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic mb-4 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
                    Ready for next guest scan.
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {isOccupied ? (
                  <button
                    onClick={() => {
                      setActivePaymentOrder(activeOrder);
                      setAmountCollected(activeOrder.total_amount.toString());
                    }}
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-black py-2.5 rounded-xl shadow-lg transition flex items-center justify-center gap-1.5"
                  >
                    <DollarSign className="w-4 h-4" /> Collect Cash / Payment
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedTable(table);
                      setActiveTab('customer');
                    }}
                    className="w-full bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-400 text-xs font-extrabold py-2 rounded-xl border border-slate-700 transition flex items-center justify-center gap-1"
                  >
                    <QrCode className="w-3.5 h-3.5" /> Open Menu
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Collect Payment & Clear Table Modal */}
      {activePaymentOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" /> Collect Payment & Settle Table
                </h3>
                <p className="text-xs text-slate-400">Order #{activePaymentOrder.order_number}</p>
              </div>
              <button
                onClick={() => setActivePaymentOrder(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300 font-bold">Total Bill Amount:</span>
                <span className="text-2xl font-black text-amber-400">₹{activePaymentOrder.total_amount}</span>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1.5">Select Payment Mode:</label>
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
                <label className="font-bold text-slate-300 block mb-1">Collected By (Staff Name)</label>
                <input
                  type="text"
                  value={waiterName}
                  onChange={(e) => setWaiterName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none"
                  placeholder="e.g. Waiter Alex"
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
                  disabled={isSubmittingPayment}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 py-3 rounded-xl font-black shadow-lg"
                >
                  {isSubmittingPayment ? 'Saving Payment...' : 'Confirm Paid & Reset Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Waiter Edit & Add Items Modal */}
      {editingOrderForWaiter && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setEditingOrderForWaiter(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Edit2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
                  Edit & Add Items — Table {editingOrderForWaiter.table?.table_number || 'DN-01'}
                </h3>
                <p className="text-xs text-slate-400">Add extra drinks/dishes requested by customer at table before confirming.</p>
              </div>
            </div>

            {/* Current Items in Order */}
            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Requested Items:</div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {editingOrderForWaiter.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg text-xs border border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-400 font-bold">{it.quantity}x</span>
                      <span className="font-bold text-slate-200">{it.product?.name || `Product #${it.product_id}`}</span>
                      <span className="text-slate-400">₹{it.unit_price * it.quantity}</span>
                    </div>
                    <button
                      onClick={async () => {
                        await deleteOrderItem(it.id);
                        const updated = allOrders.find(o => o.id === editingOrderForWaiter.id);
                        if (updated) setEditingOrderForWaiter(updated);
                      }}
                      className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10"
                      title="Remove item from order"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Items Waiter Added in Modal */}
            {itemsToAdd.length > 0 && (
              <div className="bg-amber-950/30 border border-amber-500/40 p-3 rounded-xl space-y-2">
                <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">New Items Being Added:</div>
                <div className="space-y-1 text-xs">
                  {itemsToAdd.map((newItem, idx) => {
                    const p = products.find(prod => prod.id === newItem.product_id);
                    return (
                      <div key={idx} className="flex items-center justify-between text-amber-200">
                        <span>{newItem.quantity}x {p?.name}</span>
                        <span>₹{(p?.price || 0) * newItem.quantity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add Items Menu Selector */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="text-xs font-bold text-slate-300">Add Extra Drinks / Dishes from Menu:</div>
              
              {/* Category Scrollbar */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  onClick={() => setModalCategoryFilter('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                    modalCategoryFilter === 'ALL' ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  All Items
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setModalCategoryFilter(cat.id.toString())}
                    className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                      modalCategoryFilter === cat.id.toString() ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Product Grid inside Modal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {products
                  .filter(p => modalCategoryFilter === 'ALL' || p.category_id === Number(modalCategoryFilter))
                  .map(p => {
                    const isAvail = p.is_available ?? true;
                    return (
                      <div key={p.id} className={`bg-slate-950 border ${!isAvail ? 'border-rose-950/60 opacity-60' : 'border-slate-800'} p-2.5 rounded-xl flex items-center justify-between text-xs`}>
                        <div>
                          <div className={`font-bold ${!isAvail ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                            {p.name} {!isAvail && <span className="text-[10px] text-rose-400 font-normal italic">(Sold Out)</span>}
                          </div>
                          <div className="text-amber-400 font-extrabold">₹{p.price}</div>
                        </div>
                        {isAvail ? (
                          <button
                            onClick={() => {
                              setItemsToAdd(prev => {
                                const existing = prev.find(item => item.product_id === p.id);
                                if (existing) {
                                  return prev.map(item => item.product_id === p.id ? { ...item, quantity: item.quantity + 1 } : item);
                                }
                                return [...prev, { product_id: p.id, quantity: 1 }];
                              });
                            }}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded-lg text-xs font-black transition flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-rose-400 bg-rose-950/60 border border-rose-800 px-2 py-0.5 rounded">
                            Sold Out
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingOrderForWaiter(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-slate-100 text-xs font-bold"
              >
                Close
              </button>
              <button
                disabled={isSavingEdit}
                onClick={async () => {
                  setIsSavingEdit(true);
                  if (itemsToAdd.length > 0) {
                    await addItemsToOrder(editingOrderForWaiter.id, itemsToAdd, waiterName);
                  }
                  await confirmOrderAsWaiter(editingOrderForWaiter.id, waiterName);
                  setIsSavingEdit(false);
                  setEditingOrderForWaiter(null);
                }}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
              >
                <Check className="w-4 h-4" /> Save & Confirm to Bar/Kitchen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
