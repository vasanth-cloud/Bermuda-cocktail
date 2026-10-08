import React, { useState, useEffect } from 'react';
import { useOrder } from '../context/OrderContext';
import { apiFetch } from '../config';
import CategorySalesReportModal from '../components/CategorySalesReportModal';
import ThermalReceiptModal from '../components/ThermalReceiptModal';
import WaiterAddonModal from '../components/WaiterAddonModal';
import { 
  Users, QrCode, Wine, Utensils, CheckCircle, AlertTriangle, Plus, 
  ChevronRight, Bell, DollarSign, CreditCard, Smartphone, Check, Edit2, 
  Trash2, Search, X, Printer, Eye, LogOut, HelpCircle, RefreshCw, Layers, BarChart3, Tag
} from 'lucide-react';

export default function StaffPanel() {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const { 
    tables, zones, setSelectedTable, setActiveTab, allOrders, 
    collectPayment, updateOrderStatus, updateItemStatus, confirmOrderAsWaiter, claimOrderAsWaiter,
    addItemsToOrder, deleteOrderItem, updateOrderItemNotes, products, categories, logoutUser, currentUser,
    staffUsers
  } = useOrder();

  // Search & Filter state for POS Top Bar
  const [searchBillNo, setSearchBillNo] = useState('');
  const [searchKotNo, setSearchKotNo] = useState('');

  // Payment Collection Modal State
  const [activePaymentOrder, setActivePaymentOrder] = useState(null);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [bookingPlatform, setBookingPlatform] = useState('Direct / Walk-in');
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [amountCollected, setAmountCollected] = useState('');
  const [waiterName, setWaiterName] = useState(currentUser?.name || 'Waiter');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState(null);
  const [claimingOrderId, setClaimingOrderId] = useState(null);
  const [orderAssignedWaiters, setOrderAssignedWaiters] = useState({});

  // Active Floor Waiters for multi-waiter assignment (6-10 staff members on floor)
  const activeWaitersList = React.useMemo(() => {
    const names = new Set();
    if (currentUser?.name) names.add(currentUser.name);
    if (waiterName) names.add(waiterName);
    if (staffUsers && staffUsers.length > 0) {
      staffUsers
        .filter(u => u.is_active !== false && (u.role === 'WAITER' || u.role === 'ADMIN' || u.role === 'STAFF'))
        .forEach(u => names.add(u.name));
    }
    names.add('Vasanth Admin');
    names.add('PADMESH');
    names.add('Ajaykumar');
    return Array.from(names).filter(Boolean);
  }, [currentUser, waiterName, staffUsers]);

  // Print Bill / KOT Modal State
  const [activePrintOrder, setActivePrintOrder] = useState(null);

  // Waiter Order Edit Modal State
  const [editingOrderForWaiter, setEditingOrderForWaiter] = useState(null);
  const [modalCategoryFilter, setModalCategoryFilter] = useState('ALL');
  const [itemsToAdd, setItemsToAdd] = useState([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState(null);

  // Waiter EDC Add-ons Modal State
  const [activeAddonTarget, setActiveAddonTarget] = useState(null);
  const [pendingItemNotes, setPendingItemNotes] = useState({});

  const openOrderEditModal = (order) => {
    setEditingOrderForWaiter(order);
    setItemsToAdd([]);
    setPendingItemNotes({});
  };




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
      if (activeOrder.status === 'PENDING' || activeOrder.status === 'PENDING_WAITER') {
        return {
          label: 'PENDING ACCEPT',
          type: 'PENDING_WAITER',
          cardClass: 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 border-4 border-amber-200 shadow-xl shadow-amber-500/60 animate-pulse font-black'
        };
      }

      if (activeOrder.status === 'ATTENDING' || activeOrder.status === 'CLAIMED') {
        return {
          label: `ATTENDING (${activeOrder.waiter_name || 'WAITER'})`,
          type: 'ATTENDING',
          cardClass: 'bg-gradient-to-br from-indigo-800 via-indigo-700 to-slate-900 text-indigo-100 border-2 border-indigo-400 shadow-lg shadow-indigo-950/50 font-bold'
        };
      }

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

  // Customer order requests awaiting Waiter confirmation at table (new or attending)
  const pendingCustomerOrderRequests = allOrders.filter(
    (ord) => ord.status === 'PENDING' || ord.status === 'PENDING_WAITER' || ord.status === 'ATTENDING' || ord.status === 'CLAIMED'
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

  const [isBridgeConnected, setIsBridgeConnected] = useState(false);

  useEffect(() => {
    const checkBridge = async () => {
      try {
        const res = await apiFetch('/api/printers/config');
        if (res.ok) {
          const cfg = await res.json();
          setIsBridgeConnected(!!cfg.bridge_connected);
        }
      } catch (e) {
        // ignore
      }
    };
    checkBridge();
    const interval = setInterval(checkBridge, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleAutoPrintOrderKOTs = async (e, activeOrder, table) => {
    e.stopPropagation();
    if (!activeOrder || !activeOrder.id) {
      setOrderFeedback({
        type: 'bill_paid',
        title: `Table ${table.table_number}`,
        message: `No active order to print for Table ${table.table_number}.`
      });
      setTimeout(() => setOrderFeedback(null), 4000);
      return;
    }

    try {
      const res = await apiFetch(`/api/printers/auto-route/${activeOrder.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      setOrderFeedback({
        type: 'order_accepted',
        title: `⚡ Respective KOTs Dispatched for Table ${table.table_number}!`,
        message: data.message || `Food routed to Kitchen KOT (192.168.0.70), Drinks routed to Posiflex (BAR BOT USB002). No printer selection required!`
      });
      setTimeout(() => setOrderFeedback(null), 7000);
    } catch (err) {
      console.error("Auto route KOT print error:", err);
      setOrderFeedback({
        type: 'bill_paid',
        title: `Table ${table.table_number} Print`,
        message: `Print routing error: ${err.message}`
      });
      setTimeout(() => setOrderFeedback(null), 5000);
    }
  };

  const handleClaimOrder = async (orderId, explicitWaiter = null) => {
    setClaimingOrderId(orderId);
    const chosenWaiter = explicitWaiter || orderAssignedWaiters[orderId] || currentUser?.name || waiterName || activeWaitersList[0] || 'Waiter';
    const success = await claimOrderAsWaiter(orderId, chosenWaiter);
    setClaimingOrderId(null);
    if (success) {
      const targetOrd = allOrders.find(o => o.id === orderId);
      const tblStr = targetOrd?.table?.table_number || 'ST-01';
      setOrderFeedback({
        type: 'order_accepted',
        title: `Table ${tblStr} Assigned to ${chosenWaiter}!`,
        message: `Order marked as Attending. Walk to customer table, review items, and configure add-ons (1/2, Quarter, Spicy...) before sending to Bar & Kitchen.`
      });
      setTimeout(() => setOrderFeedback(null), 5000);
      if (targetOrd) {
        openOrderEditModal({ ...targetOrd, waiter_name: chosenWaiter, status: 'ATTENDING' });
      }
    }
  };

  const handleConfirmOrder = async (orderId, explicitWaiter = null) => {
    setConfirmingOrderId(orderId);
    const targetOrd = allOrders.find(o => o.id === orderId);
    const claimingWaiter = explicitWaiter || targetOrd?.waiter_name || orderAssignedWaiters[orderId] || currentUser?.name || waiterName || 'Waiter';
    const success = await confirmOrderAsWaiter(orderId, claimingWaiter);
    setConfirmingOrderId(null);
    if (success) {
      const tblStr = targetOrd?.table?.table_number || 'ST-01';
      setOrderFeedback({
        type: 'order_accepted',
        title: `Order Confirmed for Table ${tblStr}!`,
        message: `⚡ Automatic Hardware Routing Active: Food sent to Kitchen KOT (Ethernet 192.168.0.70), Drinks sent to Posiflex (BAR BOT USB002). Handled by ${claimingWaiter}.`
      });
      setTimeout(() => setOrderFeedback(null), 6000);
    }
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!activePaymentOrder) return;

    setIsSubmittingPayment(true);
    let success = false;
    const finalAmount = amountCollected !== '' ? parseFloat(amountCollected) : (activePaymentOrder.total_amount || 0);

    if (activePaymentOrder.id && activePaymentOrder.id !== 0) {
      success = await collectPayment(
        activePaymentOrder.id,
        paymentMode,
        finalAmount,
        waiterName || currentUser?.name || 'Waiter',
        'Direct / Walk-in',
        0,
        0,
        finalAmount,
        null
      );
    } else if (activePaymentOrder.table_id) {
      await settleTableBill(activePaymentOrder.table_id);
      success = true;
    }
    setIsSubmittingPayment(false);

    if (success) {
      const orderJustPaid = { ...activePaymentOrder, payment_status: 'COLLECTED', payment_mode: paymentMode };
      const tblStr = orderJustPaid.table?.table_number || 'T-01';
      setActivePaymentOrder(null);
      setAmountCollected('');
      // Auto-dispatched by backend to RP327 Printer USB001! No manual modal selection needed.
      setOrderFeedback({
        type: 'bill_paid',
        title: `Payment Collected for Table ${tblStr}!`,
        message: `💰 Final Bill (Food + Drinks unified) auto-dispatched to Rugtek RP327 billing machine (USB001). No manual selection needed!`,
        order: orderJustPaid
      });
      setTimeout(() => setOrderFeedback(null), 8000);
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
      {/* Main Floor Container */}

      <div className="px-4 sm:px-6 space-y-5">
        {/* Top Staff Utility Header */}
        <div className="flex items-center justify-between bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 shadow-lg flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                Waiter Floor Terminal
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                  👤 {currentUser?.name || waiterName || 'Waiter'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Live POS Table Grid, Order Routing & Quick Payment Settlement</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isBridgeConnected ? (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-full font-mono font-bold flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                🟢 Auto-KOT Active (Zero-Click)
              </span>
            ) : (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-full font-mono font-bold flex items-center gap-1.5" title="Double-click Start_Print_Bridge.bat on counter PC to enable zero-click auto-printing">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                ⚠️ Run Start_Print_Bridge.bat on Counter PC
              </span>
            )}

            <button
              onClick={() => setIsReportModalOpen(true)}
              className="bg-purple-950/90 hover:bg-purple-900 border border-purple-500/50 text-purple-300 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-md transition"
              title="Open Category-Wise Sales & Payment Report"
            >
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <span>Category & Sales Reports</span>
            </button>
          </div>
        </div>

        {/* Dynamic Hardware Auto-Print Feedback Banner */}
        {orderFeedback && (
          <div className={`p-4 rounded-2xl border-2 shadow-2xl flex items-center justify-between transition-all animate-in fade-in duration-300 ${
            orderFeedback.type === 'order_accepted' 
              ? 'bg-gradient-to-r from-emerald-950/95 via-slate-900 to-emerald-950/95 border-emerald-500 text-emerald-100' 
              : 'bg-gradient-to-r from-amber-950/95 via-slate-900 to-amber-950/95 border-amber-500 text-amber-100'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                orderFeedback.type === 'order_accepted' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              }`}>
                {orderFeedback.type === 'order_accepted' ? '🚀' : '💰'}
              </div>
              <div>
                <h4 className="font-black text-sm text-white flex items-center gap-2">
                  {orderFeedback.title}
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-black/40 text-emerald-400 border border-emerald-500/30">
                    AUTOMATIC HARDWARE ROUTING
                  </span>
                </h4>
                <p className="text-xs text-slate-200 mt-0.5">{orderFeedback.message}</p>
              </div>
            </div>
            <button
              onClick={() => setOrderFeedback(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition text-sm font-bold ml-4"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Customer QR Order Requests Awaiting Waiter Confirmation & Add-ons */}
        {pendingCustomerOrderRequests.length > 0 && (() => {
          const unacceptedCount = pendingCustomerOrderRequests.filter(o => o.status === 'PENDING' || o.status === 'PENDING_WAITER').length;
          const attendingCount = pendingCustomerOrderRequests.filter(o => o.status === 'ATTENDING' || o.status === 'CLAIMED').length;

          return (
            <div className={`p-4 rounded-xl shadow-2xl space-y-3 border-2 transition ${
              unacceptedCount > 0 
                ? 'bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-amber-500' 
                : 'bg-gradient-to-r from-indigo-950/90 via-slate-900 to-indigo-950/90 border-indigo-500'
            }`}>
              <div className="flex items-center justify-between border-b border-white/10 pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2 font-black text-amber-300 text-xs uppercase tracking-wider">
                  <Bell className="w-5 h-5 text-amber-400 animate-bounce" />
                  <span>
                    📩 {pendingCustomerOrderRequests.length} Customer QR Order(s) Awaiting Waiter Action 
                    <span className="text-[11px] font-mono text-slate-300 ml-1.5 lowercase">
                      ({unacceptedCount} new, {attendingCount} attending table)
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-amber-200 bg-amber-900/60 px-2.5 py-1 rounded-full border border-amber-500/50">
                    Logged in Waiter: <strong className="text-white font-extrabold">{currentUser?.name || waiterName || 'Waiter'}</strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingCustomerOrderRequests.map((ord) => {
                  const isAttending = ord.status === 'ATTENDING' || ord.status === 'CLAIMED';
                  const assignedWaiter = orderAssignedWaiters[ord.id] || ord.waiter_name || currentUser?.name || waiterName || activeWaitersList[0] || 'Waiter';
                  const itemsSummary = ord.items ? ord.items.map(i => `${i.quantity}x ${i.product?.name || i.product_name || 'Item'}${i.notes ? ` [🏷️ ${i.notes}]` : ''}`).join(', ') : '';

                  return (
                    <div 
                      key={ord.id} 
                      className={`p-3.5 rounded-xl space-y-2.5 text-xs shadow-lg transition border-2 ${
                        isAttending 
                          ? 'bg-slate-950 border-indigo-500/80 shadow-indigo-950/50' 
                          : 'bg-slate-950 border-amber-400 shadow-amber-950/50'
                      }`}
                    >
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-amber-400 font-mono font-bold">{ord.order_number}</span>
                            {isAttending ? (
                              <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded font-black uppercase">
                                🟢 Attending Table
                              </span>
                            ) : (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-black uppercase">
                                🚨 Awaiting Waiter
                              </span>
                            )}
                          </div>
                          <h4 className="font-black text-slate-100 text-base mt-0.5">Table {ord.table?.table_number || 'ST-01'}</h4>
                          <span className="text-[11px] text-slate-300">Customer: <strong>{ord.customer_name || 'Guest'}</strong></span>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-amber-400 text-base">₹{ord.total_amount}</div>
                          <span className="text-[10px] text-amber-300/80 font-mono">{getElapsedTimeStr(ord.created_at)} ago</span>
                        </div>
                      </div>

                      {/* Items Summary */}
                      {itemsSummary && (
                        <div className="bg-slate-900 border border-slate-800 p-2 rounded text-[11px] text-slate-200 line-clamp-2">
                          <strong>Items:</strong> {itemsSummary}
                        </div>
                      )}

                      {/* Multi-Waiter Selection Dropdown (6-10 Staff Floor Routing) */}
                      <div className="flex items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 p-1.5 rounded-lg">
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">
                          {isAttending ? '👤 Attended By:' : '👤 Assign Waiter:'}
                        </span>
                        <select
                          value={assignedWaiter}
                          onChange={(e) => {
                            const newW = e.target.value;
                            setOrderAssignedWaiters(prev => ({ ...prev, [ord.id]: newW }));
                            if (isAttending) {
                              claimOrderAsWaiter(ord.id, newW);
                            }
                          }}
                          className="bg-slate-950 text-amber-300 border border-slate-700 hover:border-amber-400 rounded px-2 py-0.5 text-xs font-bold w-full max-w-[170px] focus:outline-none focus:ring-1 focus:ring-amber-400"
                        >
                          {activeWaitersList.map(w => (
                            <option key={w} value={w}>{w}</option>
                          ))}
                        </select>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => openOrderEditModal({ ...ord, waiter_name: assignedWaiter })}
                          className="bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/50 px-3 py-2 rounded-lg text-xs font-black transition flex items-center gap-1.5 shadow"
                          title="Configure Waiter Add-ons (Half, Quarter, Spicy, etc.)"
                        >
                          <Tag className="w-3.5 h-3.5 text-amber-400" />
                          <span>🏷️ {isAttending ? 'Review Add-ons' : 'Edit & Add-ons'}</span>
                        </button>

                        {!isAttending ? (
                          <button
                            type="button"
                            disabled={claimingOrderId === ord.id}
                            onClick={() => handleClaimOrder(ord.id, assignedWaiter)}
                            className="flex-1 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 px-3 py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                            title="Accept this order, mark attending, and open add-on options to ask customer at table"
                          >
                            <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                            {claimingOrderId === ord.id ? 'Claiming...' : `🙋 Accept & Take Order (${assignedWaiter})`}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={confirmingOrderId === ord.id}
                            onClick={() => handleConfirmOrder(ord.id, assignedWaiter)}
                            className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 px-3 py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95"
                            title="Add-ons verified with customer. Dispatch KOT to Kitchen & Bar printers"
                          >
                            <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                            {confirmingOrderId === ord.id ? 'Routing...' : `⚡ Confirm & Send KOT (${assignedWaiter})`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
                    <div className="text-[10px] text-amber-400 font-mono">Waiter: {order.waiter_name || order.collected_by || 'Staff'}</div>
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
            const filteredSectionTables = sectionTables
              .filter(isTableMatchingSearch)
              .sort((a, b) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true, sensitivity: 'base' }));
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

                    // 2. PENDING ACCEPTANCE TABLE CARD (GLOWING AMBER)
                    if (statusStyle.type === 'PENDING_WAITER') {
                      return (
                        <div
                          key={table.id}
                          onClick={() => {
                            if (activeOrder) openOrderEditModal(activeOrder);
                          }}
                          className={`h-20 rounded-xl p-1.5 flex flex-col justify-between transition cursor-pointer select-none relative group ${statusStyle.cardClass}`}
                          title={`Customer order awaiting acceptance at Table ${table.table_number}`}
                        >
                          <div className="flex items-center justify-between text-[9px] font-mono leading-none gap-1">
                            <span className="font-extrabold text-slate-950">{getElapsedTimeStr(activeOrder.created_at)}</span>
                            <span className="font-black bg-slate-950 text-amber-300 px-1 py-0.5 rounded text-[8px] uppercase">
                              📩 NEW
                            </span>
                          </div>

                          <div className="text-center my-0.5">
                            <div className="text-base font-black leading-tight tracking-tight text-slate-950">
                              {tableLabel}
                            </div>
                            <div className="text-[11px] font-extrabold leading-none text-slate-900">
                              ₹{activeOrder?.total_amount || 0}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={claimingOrderId === activeOrder?.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeOrder) handleClaimOrder(activeOrder.id);
                            }}
                            className="w-full bg-slate-950 hover:bg-slate-900 text-amber-400 py-1 rounded text-[10px] font-black transition flex items-center justify-center gap-1 shadow"
                          >
                            <Check className="w-3 h-3 text-amber-400" />
                            {claimingOrderId === activeOrder?.id ? 'Claiming...' : 'TAKE ORDER'}
                          </button>
                        </div>
                      );
                    }

                    // 2b. ATTENDING TABLE CARD (INDIGO GLOW)
                    if (statusStyle.type === 'ATTENDING') {
                      return (
                        <div
                          key={table.id}
                          onClick={() => {
                            if (activeOrder) openOrderEditModal(activeOrder);
                          }}
                          className={`h-20 rounded-xl p-1.5 flex flex-col justify-between transition cursor-pointer select-none relative group ${statusStyle.cardClass}`}
                          title={`Order being attended by ${activeOrder?.waiter_name || 'Waiter'} at Table ${table.table_number}`}
                        >
                          <div className="flex items-center justify-between text-[9px] font-mono leading-none gap-1">
                            <span className="font-extrabold text-indigo-200">{getElapsedTimeStr(activeOrder.created_at)}</span>
                            <span className="font-bold truncate max-w-[65px] text-amber-300">
                              👤 {activeOrder?.waiter_name || 'Waiter'}
                            </span>
                          </div>

                          <div className="text-center my-0.5">
                            <div className="text-base font-black leading-tight tracking-tight text-white">
                              {tableLabel}
                            </div>
                            <div className="text-[11px] font-extrabold leading-none text-indigo-200">
                              ₹{activeOrder?.total_amount || 0}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => openOrderEditModal(activeOrder)}
                              className="flex-1 bg-slate-950/80 hover:bg-slate-900 text-amber-400 py-1 rounded text-[9px] font-black transition flex items-center justify-center gap-0.5 border border-amber-500/40"
                              title="Review / Edit Add-ons"
                            >
                              <Tag className="w-2.5 h-2.5" /> ADD-ON
                            </button>
                            <button
                              type="button"
                              disabled={confirmingOrderId === activeOrder?.id}
                              onClick={() => handleConfirmOrder(activeOrder.id)}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-1 rounded text-[9px] font-black transition flex items-center justify-center gap-0.5 shadow"
                              title="Confirm & Send to Kitchen/Bar"
                            >
                              <Check className="w-2.5 h-2.5 stroke-[3]" /> KOT
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // 3. OCCUPIED TABLE CARD (RUNNING / PRINTED / PAID)
                    const elapsedTime = activeOrder ? getElapsedTimeStr(activeOrder.created_at) : '0 Min';
                    const amountStr = activeOrder ? `₹${activeOrder.total_amount}` : '₹0';

                    return (
                      <div
                        key={table.id}
                        onClick={() => {
                          if (activeOrder) {
                            openOrderEditModal(activeOrder);
                          } else {
                            setSelectedTable(table);
                            setActiveTab('customer');
                          }
                        }}
                        className={`h-20 rounded-xl p-1.5 flex flex-col justify-between transition cursor-pointer select-none relative group hover:scale-[1.03] shadow-md ${statusStyle.cardClass}`}
                        title={`Click to view/edit order for Table ${table.table_number}`}
                      >
                        {/* Top Row: Duration & Claimed Waiter Name */}
                        <div className="flex items-center justify-between text-[9px] font-mono leading-none gap-1">
                          <span className="opacity-90 font-semibold">{elapsedTime}</span>
                          <span className="truncate max-w-[55px] font-bold opacity-90" title={`Handled by ${activeOrder?.waiter_name || activeOrder?.collected_by || currentUser?.name || 'Waiter'}`}>
                            👤 {activeOrder?.waiter_name || activeOrder?.collected_by || currentUser?.name || 'Waiter'}
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

                        {/* Bottom Row: Quick Action Buttons */}
                        <div className="flex items-center justify-center gap-1 pt-0.5 border-t border-black/20">
                          {/* Auto-Print Respective KOTs Button */}
                          <button
                            type="button"
                            onClick={(e) => handleAutoPrintOrderKOTs(e, activeOrder, table)}
                            className="p-1.5 rounded-md bg-slate-950/40 hover:bg-slate-950/80 transition text-amber-400 hover:text-amber-300"
                            title="⚡ Auto-Print Respective KOTs (Food ➔ Kitchen KOT, Drinks ➔ Bar Posiflex)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* View/Edit Icon Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeOrder) {
                                openOrderEditModal(activeOrder);
                              } else {
                                setSelectedTable(table);
                                setActiveTab('customer');
                              }
                            }}
                            className="p-1.5 rounded-md bg-slate-950/40 hover:bg-slate-950/80 transition text-white"
                            title="View / Edit Order Items & Add-ons"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Pay / Collect Icon Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const paymentOrder = activeOrder || {
                                id: 0,
                                order_number: `ORD-${table.table_number}`,
                                table_id: table.id,
                                table: table,
                                total_amount: 0,
                                items: []
                              };
                              setActivePaymentOrder(paymentOrder);
                              setAmountCollected((paymentOrder.total_amount || 0).toString());
                            }}
                            className="p-1.5 rounded-md bg-slate-950/40 hover:bg-slate-950/80 transition text-white"
                            title="Collect Payment & Settle Table"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-800 shrink-0 bg-slate-900">
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-100 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-400" /> Collect Payment & Settle Bill
                </h3>
                <p className="text-xs text-slate-400">Order #{activePaymentOrder.order_number} — Table {formatTableLabel(activePaymentOrder.table?.table_number || 'T-01')}</p>
              </div>
              <button
                onClick={() => setActivePaymentOrder(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-sm font-bold shrink-0"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-3.5 text-xs">
              {/* Floor Waiter Information Banner */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-bold text-xs">Table Total Bill Amount:</span>
                  <span className="font-mono font-black text-amber-400 text-base">₹{activePaymentOrder.total_amount || 0}</span>
                </div>
                <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                  <span className="text-sm shrink-0">ℹ️</span>
                  <span>
                    Floor Waiters collect normal <strong className="text-emerald-300">Cash</strong>, <strong className="text-blue-300">UPI</strong>, or <strong className="text-purple-300">Card</strong>. All dining app bookings (<strong className="text-amber-300">District, Swiggy Dineout, Zomato Gold, EazyDiner</strong>) are verified & settled at the <strong>Bar & Kitchen KDS</strong> terminal.
                  </span>
                </div>
              </div>

              {/* 3. Payment Mode */}
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

              {/* 4. Final Amount Collected Input */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">Final Amount Collected (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={
                    amountCollected !== ''
                      ? amountCollected
                      : (activePaymentOrder.total_amount || 0).toFixed(2)
                  }
                  onChange={(e) => setAmountCollected(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-base font-extrabold text-amber-400 focus:outline-none focus:border-amber-500 font-mono"
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

              </div>
              <div className="p-3.5 sm:p-4 border-t border-slate-800 shrink-0 bg-slate-900/95 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActivePaymentOrder(null)}
                  className="w-full bg-slate-800 text-slate-300 py-3 rounded-xl font-bold hover:bg-slate-700 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 py-3 rounded-xl font-black shadow-lg transition disabled:opacity-50"
                >
                  {isSubmittingPayment ? 'Saving...' : 'Confirm Paid & Reset Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 80mm Thermal Receipt & KOT Modal (POSIFLEX USB & RUGTEK LAN) */}
      {activePrintOrder && (
        <ThermalReceiptModal
          order={activePrintOrder}
          initialMode="BILL"
          onClose={() => setActivePrintOrder(null)}
        />
      )}

      {/* Waiter Edit & Add Items Modal */}
      {editingOrderForWaiter && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl relative my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-800 shrink-0 bg-slate-900 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
                    Edit & Add Items — Table {formatTableLabel(editingOrderForWaiter.table?.table_number || 'D1')}
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded font-mono font-bold">
                      {editingOrderForWaiter.status || 'ATTENDING'}
                    </span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">Ask customer for portions (1/2, Quarter), spices, or add-ons before sending to Bar & Kitchen.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Waiter Selection in Modal */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 px-2.5 py-1 rounded-xl text-xs font-bold text-amber-300 shadow-sm">
                  <span className="text-slate-400 text-[10px] shrink-0">👤 Waiter:</span>
                  <select
                    value={editingOrderForWaiter.waiter_name || currentUser?.name || waiterName || activeWaitersList[0] || 'Waiter'}
                    onChange={(e) => {
                      const newW = e.target.value;
                      setEditingOrderForWaiter(prev => ({ ...prev, waiter_name: newW }));
                      if (editingOrderForWaiter.id) {
                        setOrderAssignedWaiters(prev => ({ ...prev, [editingOrderForWaiter.id]: newW }));
                      }
                    }}
                    className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer"
                  >
                    {activeWaitersList.map(w => (
                      <option key={w} value={w} className="bg-slate-900 text-slate-100">{w}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setEditingOrderForWaiter(null)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-100 shrink-0"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-4 text-xs">

            {/* Current Items in Order */}
            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-amber-400" /> Current Requested Items:
                </span>
                <span className="text-[10px] text-amber-300 font-mono font-normal">
                  Tap + Add-on to set 1/2, Quarter, Spicy...
                </span>
              </div>
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {editingOrderForWaiter.items.map((it) => {
                  const effectiveNote = pendingItemNotes[it.id] !== undefined ? pendingItemNotes[it.id] : (it.notes || '');
                  const pName = it.product?.name || `Product #${it.product_id}`;
                  return (
                    <div key={it.id} className="bg-slate-900 p-2.5 rounded-xl text-xs border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-amber-400 font-extrabold">{it.quantity}x</span>
                          <span className="font-bold text-slate-100">{pName}</span>
                          <span className="text-slate-400 font-mono">₹{it.unit_price * it.quantity}</span>
                        </div>
                        <button
                          onClick={async () => {
                            await deleteOrderItem(it.id);
                            const updated = allOrders.find(o => o.id === editingOrderForWaiter.id);
                            if (updated) setEditingOrderForWaiter(updated);
                          }}
                          className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 transition"
                          title="Remove item from order"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Waiter Add-on Selection Row */}
                      <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/80">
                        {effectiveNote ? (
                          <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/40 text-amber-300 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-sm">
                            <Tag className="w-3 h-3 text-amber-400" />
                            <span>Add-on:</span>
                            <strong className="text-amber-200">{effectiveNote}</strong>
                            <button
                              type="button"
                              onClick={() => setActiveAddonTarget({
                                type: 'existing',
                                item: it,
                                itemName: pName,
                                initialNotes: effectiveNote
                              })}
                              className="text-amber-400 hover:text-white ml-1.5 underline text-[10px]"
                            >
                              Change
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingItemNotes(prev => ({ ...prev, [it.id]: '' }))}
                              className="text-rose-400 hover:text-rose-300 ml-1 p-0.5 rounded hover:bg-rose-500/10"
                              title="Remove Add-on"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveAddonTarget({
                              type: 'existing',
                              item: it,
                              itemName: pName,
                              initialNotes: ''
                            })}
                            className="bg-slate-950 hover:bg-slate-800 border border-amber-500/40 text-amber-400 hover:text-amber-300 px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Add-on (1/2, Quarter, Spicy...)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Items Waiter Added in Modal */}
            {itemsToAdd.length > 0 && (
              <div className="bg-amber-950/30 border border-amber-500/40 p-3 rounded-xl space-y-2">
                <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">New Items Being Added:</div>
                <div className="space-y-2 text-xs">
                  {itemsToAdd.map((newItem, idx) => {
                    const p = products.find(prod => prod.id === newItem.product_id);
                    const pName = p?.name || 'Item';
                    return (
                      <div key={idx} className="bg-slate-900 p-2.5 rounded-xl border border-amber-500/30 space-y-2 text-amber-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-400">{newItem.quantity}x</span>
                            <span className="font-bold text-slate-100">{pName}</span>
                            <span className="text-amber-300/80 font-mono">₹{(p?.price || 0) * newItem.quantity}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setItemsToAdd(prev => prev.filter((_, i) => i !== idx))}
                            className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                          {newItem.notes ? (
                            <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/50 text-amber-300 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                              <Tag className="w-3 h-3 text-amber-400" />
                              <span>Add-on:</span>
                              <strong className="text-amber-200">{newItem.notes}</strong>
                              <button
                                type="button"
                                onClick={() => setActiveAddonTarget({
                                  type: 'new',
                                  index: idx,
                                  item: newItem,
                                  itemName: pName,
                                  initialNotes: newItem.notes
                                })}
                                className="text-amber-400 hover:text-white ml-1.5 underline text-[10px]"
                              >
                                Change
                              </button>
                              <button
                                type="button"
                                onClick={() => setItemsToAdd(prev => prev.map((it, i) => i === idx ? { ...it, notes: '' } : it))}
                                className="text-rose-400 hover:text-rose-300 ml-1 p-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActiveAddonTarget({
                                type: 'new',
                                index: idx,
                                item: newItem,
                                itemName: pName,
                                initialNotes: ''
                              })}
                              className="bg-slate-950 hover:bg-slate-800 border border-amber-500/40 text-amber-400 hover:text-amber-300 px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Add-on (1/2, Quarter, Spicy...)</span>
                            </button>
                          )}
                        </div>
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
                                return [...prev, { product_id: p.id, quantity: 1, notes: '' }];
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

            </div>

            {/* Modal Actions - Option 1: Edit/Save Items, Option 2: Confirm & Send to Bar/Kitchen */}
            <div className="p-3.5 sm:p-4 border-t border-slate-800 shrink-0 bg-slate-900/95 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingOrderForWaiter(null);
                  setPendingItemNotes({});
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-slate-100 text-xs font-bold"
              >
                Close
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                {/* OPTION 1: SAVE CHANGES & ADD-ONS (KEEP ATTENDING) */}
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={async () => {
                    setIsSavingEdit(true);
                    const claimingWaiter = editingOrderForWaiter.waiter_name || currentUser?.name || waiterName || activeWaitersList[0] || 'Waiter';
                    
                    // 1. Ensure order is claimed / attending under this waiter
                    await claimOrderAsWaiter(editingOrderForWaiter.id, claimingWaiter);

                    // 2. Save modified notes on existing items
                    for (const [itmId, noteVal] of Object.entries(pendingItemNotes)) {
                      await updateOrderItemNotes(editingOrderForWaiter.id, Number(itmId), noteVal);
                    }
                    setPendingItemNotes({});

                    // 3. Add extra items if any
                    if (itemsToAdd.length > 0) {
                      await addItemsToOrder(editingOrderForWaiter.id, itemsToAdd, claimingWaiter);
                      setItemsToAdd([]);
                    }

                    const tblStr = editingOrderForWaiter.table?.table_number || 'ST-01';
                    setOrderFeedback({
                      type: 'order_accepted',
                      title: `Add-ons Saved for Table ${tblStr}!`,
                      message: `Items & EDC add-ons saved. Order remains in Attending state under ${claimingWaiter}.`
                    });
                    setTimeout(() => setOrderFeedback(null), 5000);

                    const updated = allOrders.find(o => o.id === editingOrderForWaiter.id);
                    if (updated) setEditingOrderForWaiter({ ...updated, waiter_name: claimingWaiter });
                    setIsSavingEdit(false);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  {isSavingEdit ? 'Saving...' : '✏️ 1. Save Changes & Add-ons (Keep Attending)'}
                </button>

                {/* OPTION 2: CONFIRM ORDER & SEND TO BAR / KITCHEN */}
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={async () => {
                    setIsSavingEdit(true);
                    const claimingWaiter = editingOrderForWaiter.waiter_name || currentUser?.name || waiterName || activeWaitersList[0] || 'Waiter';
                    
                    // 1. Prepare updated notes list for all items in order
                    const updatedNotesList = editingOrderForWaiter.items.map(it => ({
                      item_id: it.id,
                      notes: pendingItemNotes[it.id] !== undefined ? pendingItemNotes[it.id] : (it.notes || '')
                    }));

                    // 2. Add extra items if any
                    if (itemsToAdd.length > 0) {
                      await addItemsToOrder(editingOrderForWaiter.id, itemsToAdd, claimingWaiter);
                      setItemsToAdd([]);
                    }

                    // 3. Confirm order with updated notes & selected waiter
                    const tblStr = editingOrderForWaiter.table?.table_number || 'ST-01';
                    await confirmOrderAsWaiter(editingOrderForWaiter.id, claimingWaiter, updatedNotesList);
                    setIsSavingEdit(false);
                    setEditingOrderForWaiter(null);
                    setPendingItemNotes({});
                    setOrderFeedback({
                      type: 'order_accepted',
                      title: `Order Confirmed for Table ${tblStr}!`,
                      message: `⚡ Automatic Hardware Routing Active: Food sent to Kitchen KOT (Ethernet 192.168.0.70), Drinks sent to Posiflex (BAR BOT USB002). Handled by ${claimingWaiter}.`
                    });
                    setTimeout(() => setOrderFeedback(null), 8000);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                  ⚡ 2. Confirm Order & Send to Bar/Kitchen ({editingOrderForWaiter.waiter_name || currentUser?.name || waiterName || 'Waiter'})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Waiter EDC Addon Selection Modal */}
      <WaiterAddonModal
        isOpen={Boolean(activeAddonTarget)}
        onClose={() => setActiveAddonTarget(null)}
        itemName={activeAddonTarget?.itemName || activeAddonTarget?.item?.product?.name || 'Item'}
        currentNotes={activeAddonTarget?.initialNotes || ''}
        onApply={(notes) => {
          if (!activeAddonTarget) return;
          if (activeAddonTarget.type === 'existing') {
            setPendingItemNotes(prev => ({
              ...prev,
              [activeAddonTarget.item.id]: notes
            }));
          } else if (activeAddonTarget.type === 'new') {
            setItemsToAdd(prev => prev.map((it, idx) => 
              idx === activeAddonTarget.index ? { ...it, notes } : it
            ));
          }
          setActiveAddonTarget(null);
        }}
      />

      {/* Category Sales & Department Revenue Report Modal */}
      <CategorySalesReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  );
}
