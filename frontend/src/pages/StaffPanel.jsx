import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import { 
  Users, QrCode, Wine, Utensils, CheckCircle, AlertTriangle, Plus, 
  ChevronRight, Bell, DollarSign, CreditCard, Smartphone, Check, Edit2, 
  Trash2, Search, X, Printer, Eye, LogOut, HelpCircle, RefreshCw, Layers
} from 'lucide-react';

export default function StaffPanel() {
  const { 
    tables, zones, setSelectedTable, setActiveTab, allOrders, 
    collectPayment, updateOrderStatus, updateItemStatus, confirmOrderAsWaiter, 
    addItemsToOrder, deleteOrderItem, products, categories, logoutUser, currentUser 
  } = useOrder();

  // Search & Filter state for POS Top Bar
  const [searchBillNo, setSearchBillNo] = useState('');
  const [searchKotNo, setSearchKotNo] = useState('');

  // Payment Collection Modal State
  const [activePaymentOrder, setActivePaymentOrder] = useState(null);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [amountCollected, setAmountCollected] = useState('');
  const [waiterName, setWaiterName] = useState(currentUser?.name || 'Waiter');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState(null);

  // Print Bill / KOT Modal State
  const [activePrintOrder, setActivePrintOrder] = useState(null);

  // Waiter Order Edit Modal State
  const [editingOrderForWaiter, setEditingOrderForWaiter] = useState(null);
  const [modalCategoryFilter, setModalCategoryFilter] = useState('ALL');
  const [itemsToAdd, setItemsToAdd] = useState([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Format table label (e.g. DN-15 -> D15, SZ-10 -> S10, C1 -> C1)
  const formatTableLabel = (num) => {
    if (!num) return 'T';
    return num.replace(/^DN-/i, 'D').replace(/^SZ-/i, 'S');
  };

  // Calculate elapsed time in minutes from order creation
  const getElapsedTimeStr = (createdAt) => {
    if (!createdAt) return '0 Min';
    const start = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const diffMins = Math.max(0, Math.floor((now - start) / (1000 * 60)));
    return `${diffMins} Min`;
  };

  const getTableActiveOrder = (tableId) => {
    return allOrders.find((o) => o.table_id === tableId && o.status !== 'BILLED');
  };

  const getTableStatusStyle = (table, activeOrder) => {
    if (!activeOrder && (table.current_status === 'VACANT' || !table.current_status)) {
      return {
        label: 'VACANT',
        type: 'VACANT',
        cardClass: 'bg-slate-100 text-slate-900 border-2 border-slate-300 hover:border-slate-400 hover:bg-white shadow-sm'
      };
    }
    
    if (activeOrder) {
      if (activeOrder.status === 'BILLED' || activeOrder.payment_status === 'COLLECTED') {
        return {
          label: 'PAID TABLE',
          type: 'PAID',
          cardClass: 'bg-amber-400 text-slate-950 border-2 border-amber-300 shadow-md shadow-amber-500/20 font-black'
        };
      }
      
      const allItemsReadyOrServed = activeOrder.items && activeOrder.items.length > 0 &&
        activeOrder.items.every(it => it.status === 'READY' || it.status === 'SERVED');

      if (allItemsReadyOrServed || activeOrder.status === 'SERVED' || activeOrder.status === 'PRINTED') {
        return {
          label: 'PRINTED / FINISHED',
          type: 'PRINTED',
          cardClass: 'bg-emerald-600 text-white border-2 border-emerald-400 shadow-md shadow-emerald-600/30 font-bold'
        };
      }

      return {
        label: 'RUNNING TABLE',
        type: 'RUNNING',
        cardClass: 'bg-blue-600 text-white border-2 border-blue-400 shadow-md shadow-blue-600/30 font-bold'
      };
    }

    if (table.current_status === 'BILLED' || table.current_status === 'PAID') {
      return {
        label: 'PAID TABLE',
        type: 'PAID',
        cardClass: 'bg-amber-400 text-slate-950 border-2 border-amber-300 shadow-md shadow-amber-500/20 font-black'
      };
    }

    if (table.current_status === 'OCCUPIED') {
      return {
        label: 'RUNNING TABLE',
        type: 'RUNNING',
        cardClass: 'bg-blue-600 text-white border-2 border-blue-400 shadow-md shadow-blue-600/30 font-bold'
      };
    }

    return {
      label: 'VACANT',
      type: 'VACANT',
      cardClass: 'bg-slate-100 text-slate-900 border-2 border-slate-300 hover:border-slate-400 hover:bg-white shadow-sm'
    };
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
    const claimingWaiter = currentUser?.name || waiterName || 'Waiter';
    await confirmOrderAsWaiter(orderId, claimingWaiter);
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

  // Group tables by Zone for clean POS floor sections
  const groupedSections = zones.map((zone) => {
    const zoneTables = tables.filter((t) => t.zone_id === zone.id);
    return {
      zone,
      tables: zoneTables
    };
  });

  // Include tables with no zone assigned
  const unzonedTables = tables.filter((t) => !t.zone_id);
  if (unzonedTables.length > 0) {
    groupedSections.push({
      zone: { id: 0, display_name: 'General Pub Tables' },
      tables: unzonedTables
    });
  }

  // Filter tables by Bill Search or KOT Search if typed
  const isTableMatchingSearch = (table) => {
    if (!searchBillNo && !searchKotNo) return true;
    const activeOrder = getTableActiveOrder(table.id);
    if (!activeOrder) return false;
    
    let match = true;
    if (searchBillNo && !activeOrder.order_number.toLowerCase().includes(searchBillNo.toLowerCase())) {
      match = false;
    }
    if (searchKotNo && (!activeOrder.items || !activeOrder.items.some(i => i.id.toString().includes(searchKotNo)))) {
      match = false;
    }
    return match;
  };

  return (
    <div className="w-full bg-slate-950 text-slate-100 min-h-screen pb-12 font-sans space-y-4">
      {/* PETPOOJA STYLE CLEAN POS TOP TOOLBAR */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 shadow-xl">
        {/* Branding & New Order Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-rose-600 text-white font-black flex items-center justify-center text-xs shadow-md">
              POS
            </span>
            <div>
              <h1 className="text-sm font-black text-slate-100 leading-tight">
                The Bermuda <span className="text-slate-400 font-normal text-xs">(R334657)</span>
              </h1>
              <p className="text-[10px] text-slate-400">Restaurant Management Platform</p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('customer')}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-black px-3.5 py-1.5 rounded-lg transition shadow flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New Order
          </button>
        </div>

        {/* Search Inputs */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Q Bill No"
              value={searchBillNo}
              onChange={(e) => setSearchBillNo(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-2.5 py-1.5 w-28 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Q KOT No"
              value={searchKotNo}
              onChange={(e) => setSearchKotNo(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-2.5 py-1.5 w-28 focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* Action Toolbar Icons */}
        <div className="flex items-center gap-3 text-xs text-slate-300">
          <button onClick={() => window.location.reload()} className="flex items-center gap-1 hover:text-slate-100 transition">
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden md:inline">Refresh</span>
          </button>

          <button onClick={() => setActiveTab('staff')} className="flex items-center gap-1 hover:text-slate-100 transition">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden md:inline">Live View</span>
          </button>

          {readyItemsForPickup.length > 0 && (
            <div className="flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-1 rounded-lg text-xs font-bold animate-pulse">
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>{readyItemsForPickup.length} Ready</span>
            </div>
          )}

          {logoutUser && (
            <button onClick={logoutUser} className="flex items-center gap-1 text-rose-400 hover:text-rose-300 transition">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Logout</span>
            </button>
          )}

          <div className="bg-rose-950/60 border border-rose-500/30 text-rose-300 text-[11px] font-bold px-2.5 py-1 rounded-lg">
            Help 07969 223344
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 space-y-5">
        {/* Customer QR Order Requests Awaiting Waiter Confirmation */}
        {pendingCustomerOrderRequests.length > 0 && (
          <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border border-amber-500/60 p-4 rounded-xl shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
              <div className="flex items-center gap-2 font-black text-amber-300 text-xs uppercase tracking-wider">
                <Check className="w-4 h-4 text-amber-400" />
                <span>📩 {pendingCustomerOrderRequests.length} Customer QR Orders Awaiting Confirmation</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingCustomerOrderRequests.map((ord) => (
                <div key={ord.id} className="bg-slate-950 border border-amber-500/40 p-3 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-amber-400 font-mono font-bold">{ord.order_number}</span>
                      <h4 className="font-black text-slate-100 text-sm">Table {ord.table?.table_number || 'ST-01'}</h4>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-amber-400 text-sm">₹{ord.total_amount}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingOrderForWaiter(ord);
                        setItemsToAdd([]);
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/40 px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>

                    <button
                      disabled={confirmingOrderId === ord.id}
                      onClick={() => handleConfirmOrder(ord.id)}
                      className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {confirmingOrderId === ord.id ? 'Routing...' : 'Confirm Order'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Pickup Alert Banner for Waiters */}
        {readyItemsForPickup.length > 0 && (
          <div className="bg-amber-950/40 border border-amber-500/60 p-3.5 rounded-xl shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-amber-400 text-xs uppercase">
                <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
                <span>🔔 {readyItemsForPickup.length} Items Ready for Pickup!</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {readyItemsForPickup.map(({ item, order, tableNumber }) => (
                <div key={item.id} className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <div className="font-black text-slate-100">Table {tableNumber}</div>
                    <div className="text-[11px] text-slate-300">{item.quantity}x {item.product?.name || `Item #${item.product_id}`}</div>
                  </div>
                  <button
                    onClick={() => updateItemStatus(item.id, 'SERVED')}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-2.5 py-1 rounded-lg text-xs font-black transition flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Served
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STACKED POS FLOOR SECTIONS (PETPOOJA POS STYLE GRID) */}
        <div className="space-y-6">
          {groupedSections.map(({ zone, tables: sectionTables }) => {
            const filteredSectionTables = sectionTables.filter(isTableMatchingSearch);
            if (filteredSectionTables.length === 0) return null;

            return (
              <div key={zone.id} className="space-y-2.5">
                {/* Clean Section Header */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5">
                  <h3 className="font-extrabold text-sm text-slate-200 tracking-wide">
                    {zone.display_name}
                  </h3>
                  <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                    {filteredSectionTables.length} Tables
                  </span>
                </div>

                {/* Dense Uniform POS Table Grid */}
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                  {filteredSectionTables.map((table) => {
                    const activeOrder = getTableActiveOrder(table.id);
                    const statusStyle = getTableStatusStyle(table, activeOrder);
                    const tableLabel = formatTableLabel(table.table_number);

                    // 1. VACANT TABLE CARD
                    if (statusStyle.type === 'VACANT') {
                      return (
                        <div
                          key={table.id}
                          onClick={() => {
                            setSelectedTable(table);
                            setActiveTab('customer');
                          }}
                          className={`h-16 rounded-xl flex items-center justify-center transition cursor-pointer select-none shadow-sm ${statusStyle.cardClass}`}
                          title={`Open menu for table ${table.table_number}`}
                        >
                          <span className="text-lg font-black text-slate-800 tracking-tight">
                            {tableLabel}
                          </span>
                        </div>
                      );
                    }

                    // 2. OCCUPIED TABLE CARD (RUNNING / PRINTED / PAID)
                    const elapsedTime = activeOrder ? getElapsedTimeStr(activeOrder.created_at) : '0 Min';
                    const amountStr = activeOrder ? `₹${activeOrder.total_amount}` : '₹0';

                    return (
                      <div
                        key={table.id}
                        className={`h-20 rounded-xl p-1.5 flex flex-col justify-between transition cursor-pointer select-none relative group ${statusStyle.cardClass}`}
                      >
                        {/* Top Row: Duration & Claimed Waiter Name */}
                        <div className="flex items-center justify-between text-[9px] font-mono leading-none gap-1">
                          <span className="opacity-90 font-semibold">{elapsedTime}</span>
                          <span className="truncate max-w-[55px] font-bold opacity-90" title={`Handled by ${activeOrder?.waiter_name || activeOrder?.collected_by || 'Waiter'}`}>
                            👤 {activeOrder?.waiter_name || activeOrder?.collected_by || 'Waiter'}
                          </span>
                        </div>

                        {/* Middle: Table Number & Amount */}
                        <div className="text-center my-0.5">
                          <div className="text-base font-black leading-tight tracking-tight">
                            {tableLabel}
                          </div>
                          <div className="text-[11px] font-extrabold leading-none opacity-95">
                            {amountStr}
                          </div>
                        </div>

                        {/* Bottom Row: Quick Action Icons */}
                        <div className="flex items-center justify-center gap-1.5 pt-0.5 border-t border-black/10">
                          {/* Print Icon Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivePrintOrder(activeOrder);
                            }}
                            className="p-1 rounded bg-black/20 hover:bg-black/40 transition text-white"
                            title="Print KOT / Bill Receipt"
                          >
                            <Printer className="w-3 h-3" />
                          </button>

                          {/* View/Edit Icon Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeOrder) {
                                setEditingOrderForWaiter(activeOrder);
                                setItemsToAdd([]);
                              }
                            }}
                            className="p-1 rounded bg-black/20 hover:bg-black/40 transition text-white"
                            title="View / Edit Order Items"
                          >
                            <Eye className="w-3 h-3" />
                          </button>

                          {/* Pay / Collect Icon Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeOrder) {
                                setActivePaymentOrder(activeOrder);
                                setAmountCollected(activeOrder.total_amount.toString());
                              }
                            }}
                            className="p-1 rounded bg-black/20 hover:bg-black/40 transition text-white"
                            title="Collect Payment"
                          >
                            <DollarSign className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collect Payment & Clear Table Modal */}
      {activePaymentOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-400" /> Collect Payment & Clear Table
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
                    💵 Cash
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
                    📱 UPI
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
                    💳 Card
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-base font-extrabold text-amber-400 focus:outline-none focus:border-amber-500"
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
                  placeholder="e.g. Staff"
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
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 py-3 rounded-xl font-black shadow-lg"
                >
                  {isSubmittingPayment ? 'Saving...' : 'Confirm Paid & Reset Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print KOT / Receipt Preview Modal */}
      {activePrintOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" /> KOT / Bill Receipt
              </h3>
              <button
                onClick={() => setActivePrintOrder(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Printable Receipt Preview */}
            <div className="bg-white text-slate-950 p-4 rounded-xl font-mono text-xs space-y-2 shadow-inner">
              <div className="text-center border-b border-slate-300 pb-2">
                <div className="font-black text-sm">THE BERMUDA COCKTAIL</div>
                <div className="text-[10px] text-slate-600">Table: {formatTableLabel(activePrintOrder.table?.table_number || 'T-01')}</div>
                <div className="text-[10px] text-slate-500">Bill #: {activePrintOrder.order_number}</div>
                <div className="text-[10px] text-amber-700 font-bold">Waiter: {activePrintOrder.waiter_name || activePrintOrder.collected_by || 'Staff'}</div>
              </div>

              <div className="space-y-1 py-1">
                {activePrintOrder.items?.map((it) => (
                  <div key={it.id} className="flex justify-between items-center text-[11px]">
                    <span>{it.quantity}x {it.product?.name || `Item #${it.product_id}`}</span>
                    <span className="font-bold">₹{it.unit_price * it.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-300 pt-2 flex justify-between font-black text-sm">
                <span>Total Amount:</span>
                <span>₹{activePrintOrder.total_amount}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActivePrintOrder(null)}
                className="w-full bg-slate-800 text-slate-300 py-2.5 rounded-xl font-bold text-xs"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  window.print();
                  setActivePrintOrder(null);
                }}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 rounded-xl font-black text-xs shadow-lg flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
            </div>
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
                  Edit & Add Items — Table {formatTableLabel(editingOrderForWaiter.table?.table_number || 'D1')}
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
