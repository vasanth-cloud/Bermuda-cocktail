import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import CategorySalesReportModal from '../components/CategorySalesReportModal';
import { 
  Users, QrCode, Wine, Utensils, CheckCircle, AlertTriangle, Plus, 
  ChevronRight, Bell, DollarSign, CreditCard, Smartphone, Check, Edit2, 
  Trash2, Search, X, Printer, Eye, LogOut, HelpCircle, RefreshCw, Layers, BarChart3
} from 'lucide-react';

export default function StaffPanel() {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
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
  const [bookingPlatform, setBookingPlatform] = useState('Direct / Walk-in');
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
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
      if (activeOrder.status === 'PENDING' || activeOrder.status === 'PENDING_WAITER') {
        return {
          label: 'PENDING ACCEPT',
          type: 'PENDING_WAITER',
          cardClass: 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 border-4 border-amber-200 shadow-xl shadow-amber-500/60 animate-pulse font-black'
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
    if (!activePaymentOrder) return;

    setIsSubmittingPayment(true);
    let success = false;
    if (activePaymentOrder.id && activePaymentOrder.id !== 0) {
      success = await collectPayment(
        activePaymentOrder.id,
        paymentMode,
        amountCollected || 0,
        waiterName || currentUser?.name || 'Waiter'
      );
    } else if (activePaymentOrder.table_id) {
      await settleTableBill(activePaymentOrder.table_id);
      success = true;
    }
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

          <button
            onClick={() => setIsReportModalOpen(true)}
            className="bg-purple-950/90 hover:bg-purple-900 border border-purple-500/50 text-purple-300 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-md transition"
            title="Open Category-Wise Sales & Payment Report"
          >
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>Category & Sales Reports</span>
          </button>
        </div>

        {/* Customer QR Order Requests Awaiting Waiter Confirmation */}
        {pendingCustomerOrderRequests.length > 0 && (
          <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-2 border-amber-500 p-4 rounded-xl shadow-2xl space-y-3 animate-pulse">
            <div className="flex items-center justify-between border-b border-amber-500/40 pb-2">
              <div className="flex items-center gap-2 font-black text-amber-300 text-xs uppercase tracking-wider">
                <Bell className="w-5 h-5 text-amber-400 animate-bounce" />
                <span>📩 {pendingCustomerOrderRequests.length} Customer QR Order(s) Awaiting Waiter Acceptance</span>
              </div>
              <span className="text-[11px] font-bold text-amber-200 bg-amber-900/60 px-2.5 py-1 rounded-full border border-amber-500/50">
                Logged in Waiter: <strong className="text-white font-extrabold">{currentUser?.name || waiterName || 'Waiter'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingCustomerOrderRequests.map((ord) => {
                const itemsSummary = ord.items ? ord.items.map(i => `${i.quantity}x ${i.product?.name || i.product_name || 'Item'}`).join(', ') : '';
                return (
                  <div key={ord.id} className="bg-slate-950 border-2 border-amber-400 p-3.5 rounded-xl space-y-2.5 text-xs shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-amber-400 font-mono font-bold">{ord.order_number}</span>
                        <h4 className="font-black text-slate-100 text-base">Table {ord.table?.table_number || 'ST-01'}</h4>
                        <span className="text-[11px] text-slate-300">Customer: <strong>{ord.customer_name || 'Guest'}</strong></span>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-amber-400 text-base">₹{ord.total_amount}</div>
                        <span className="text-[10px] text-amber-300/80 font-mono">{getElapsedTimeStr(ord.created_at)} ago</span>
                      </div>
                    </div>

                    {itemsSummary && (
                      <div className="bg-slate-900 border border-slate-800 p-2 rounded text-[11px] text-slate-200 line-clamp-2">
                        <strong>Items:</strong> {itemsSummary}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingOrderForWaiter(ord);
                          setItemsToAdd([]);
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/40 px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>

                      <button
                        disabled={confirmingOrderId === ord.id}
                        onClick={() => handleConfirmOrder(ord.id)}
                        className="flex-1 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 px-3 py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md"
                      >
                        <Check className="w-4 h-4 text-slate-950" />
                        {confirmingOrderId === ord.id ? 'Routing...' : `⚡ ACCEPT ORDER (${currentUser?.name || waiterName || 'Waiter'})`}
                      </button>
                    </div>
                  </div>
                );
              })}
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
                            if (activeOrder) {
                              setEditingOrderForWaiter(activeOrder);
                              setItemsToAdd([]);
                            }
                          }}
                          className={`h-20 rounded-xl p-1.5 flex flex-col justify-between transition cursor-pointer select-none relative group ${statusStyle.cardClass}`}
                          title={`Customer order awaiting acceptance at Table ${table.table_number}`}
                        >
                          <div className="flex items-center justify-between text-[9px] font-mono leading-none gap-1">
                            <span className="font-extrabold text-slate-950">{getElapsedTimeStr(activeOrder.created_at)}</span>
                            <span className="font-black bg-slate-950 text-amber-300 px-1 py-0.5 rounded text-[8px] uppercase">
                              📩 ACCEPT
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
                            disabled={confirmingOrderId === activeOrder?.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeOrder) handleConfirmOrder(activeOrder.id);
                            }}
                            className="w-full bg-slate-950 hover:bg-slate-900 text-amber-400 py-1 rounded text-[10px] font-black transition flex items-center justify-center gap-1 shadow"
                          >
                            <Check className="w-3 h-3 text-amber-400" />
                            {confirmingOrderId === activeOrder?.id ? 'Routing...' : 'ACCEPT'}
                          </button>
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
                            setEditingOrderForWaiter(activeOrder);
                            setItemsToAdd([]);
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
                          {/* Print Icon Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const orderToPrint = activeOrder || {
                                id: 0,
                                order_number: `ORD-${table.table_number}`,
                                table: table,
                                customer_name: 'Guest',
                                total_amount: 0,
                                items: [],
                                waiter_name: currentUser?.name || 'Waiter'
                              };
                              setActivePrintOrder(orderToPrint);
                            }}
                            className="p-1.5 rounded-md bg-slate-950/40 hover:bg-slate-950/80 transition text-white"
                            title="Print KOT / Bill Receipt"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* View/Edit Icon Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeOrder) {
                                setEditingOrderForWaiter(activeOrder);
                                setItemsToAdd([]);
                              } else {
                                setSelectedTable(table);
                                setActiveTab('customer');
                              }
                            }}
                            className="p-1.5 rounded-md bg-slate-950/40 hover:bg-slate-950/80 transition text-white"
                            title="View / Edit Order Items"
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
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-400" /> Collect Payment & Settle Bill
                </h3>
                <p className="text-xs text-slate-400">Order #{activePaymentOrder.order_number} — Table {formatTableLabel(activePaymentOrder.table?.table_number || 'T-01')}</p>
              </div>
              <button
                onClick={() => setActivePaymentOrder(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-4 text-xs">
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

            {/* Modal Actions - Option 1: Edit/Save Items, Option 2: Confirm & Send to Bar/Kitchen */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingOrderForWaiter(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-slate-100 text-xs font-bold"
              >
                Close
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                {/* OPTION 1: EDIT ORDER (Save Items Added/Removed) */}
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={async () => {
                    setIsSavingEdit(true);
                    if (itemsToAdd.length > 0) {
                      await addItemsToOrder(editingOrderForWaiter.id, itemsToAdd, currentUser?.name || waiterName || 'Waiter');
                      setItemsToAdd([]);
                    }
                    setIsSavingEdit(false);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  {isSavingEdit ? 'Saving...' : '✏️ 1. Edit / Add Items'}
                </button>

                {/* OPTION 2: CONFIRM ORDER & SEND TO BAR / KITCHEN */}
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={async () => {
                    setIsSavingEdit(true);
                    const claimingWaiter = currentUser?.name || waiterName || 'Waiter';
                    if (itemsToAdd.length > 0) {
                      await addItemsToOrder(editingOrderForWaiter.id, itemsToAdd, claimingWaiter);
                      setItemsToAdd([]);
                    }
                    await confirmOrderAsWaiter(editingOrderForWaiter.id, claimingWaiter);
                    setIsSavingEdit(false);
                    setEditingOrderForWaiter(null);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                  ⚡ 2. Confirm Order & Send to Bar/Kitchen ({currentUser?.name || waiterName || 'Waiter'})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Sales & Department Revenue Report Modal */}
      <CategorySalesReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  );
}
