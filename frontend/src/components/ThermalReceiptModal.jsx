import React, { useState } from 'react';
import { Printer, Wifi, CheckCircle2, AlertCircle, X, Receipt, Utensils, Wine } from 'lucide-react';
import { apiFetch } from '../config';

export default function ThermalReceiptModal({ order, onClose, initialMode = 'BILL' }) {
  const [mode, setMode] = useState(initialMode); // 'BILL' or 'KOT'
  const [isSendingToRugtek, setIsSendingToRugtek] = useState(false);
  const [isSendingBillToLan, setIsSendingBillToLan] = useState(false);
  const [networkPrintStatus, setNetworkPrintStatus] = useState(null);

  if (!order) return null;

  const handleBrowserPrint = () => {
    window.print();
  };

  const handleSendBillToLan = async () => {
    setIsSendingBillToLan(true);
    setNetworkPrintStatus(null);
    try {
      const res = await apiFetch(`/api/printers/print-bill/${order.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNetworkPrintStatus({ success: true, message: data.message || `Bill sent to Cashier LAN printer (${data.ip || 'LAN'})!` });
      } else {
        setNetworkPrintStatus({
          success: false,
          message: data.message || 'Could not connect to Cashier LAN printer. Check printer power & IP address in settings.'
        });
      }
    } catch (err) {
      setNetworkPrintStatus({
        success: false,
        message: `LAN error: ${err.message || 'Check printer IP and connection'}`
      });
    } finally {
      setIsSendingBillToLan(false);
    }
  };

  const handleSendToRugtek = async () => {
    setIsSendingToRugtek(true);
    setNetworkPrintStatus(null);
    try {
      const res = await apiFetch(`/api/printers/print-kot/${order.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNetworkPrintStatus({ success: true, message: data.message || 'KOT sent to Kitchen LAN printer (RUGTEK RP326)!' });
      } else {
        setNetworkPrintStatus({
          success: false,
          message: data.message || 'Could not connect to Kitchen LAN printer. Check printer power & IP address.'
        });
      }
    } catch (err) {
      setNetworkPrintStatus({
        success: false,
        message: `LAN error: ${err.message || 'Check printer IP and connection'}`
      });
    } finally {
      setIsSendingToRugtek(false);
    }
  };

  const tableLabel = order.table?.table_number 
    ? `${order.table.table_number} (${order.table?.zone?.display_name || 'Main'})`
    : (order.table_number || 'T-01');

  const nowFormatted = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const subtotal = Number(order.total_amount || 0);
  const discountAmt = Number(order.discount_amount || 0);
  const discountPct = Number(order.discount_percentage || 0);
  const finalTotal = Number(order.final_amount || (subtotal - discountAmt));

  const foodItems = (order.items || []).filter(
    (it) => (it.target_dept || '').toUpperCase() === 'KITCHEN'
  );
  const barItems = (order.items || []).filter(
    (it) => (it.target_dept || '').toUpperCase() === 'BAR'
  );

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-3.5 sm:p-4 shrink-0 bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-100 flex items-center gap-1.5">
                Thermal 80mm Printer
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                  POSIFLEX & RUGTEK
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Order #{order.order_number} · Table {tableLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-sm font-bold transition shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3.5 text-xs">

        {/* Mode Selector Tab (Bill vs KOT) */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setMode('BILL')}
            className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition ${
              mode === 'BILL'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" /> Customer Bill (80mm)
          </button>
          <button
            type="button"
            onClick={() => setMode('KOT')}
            className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition ${
              mode === 'KOT'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" /> Kitchen KOT ({foodItems.length})
          </button>
        </div>

        {/* Network Print Feedback Toast */}
        {networkPrintStatus && (
          <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
            networkPrintStatus.success
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}>
            {networkPrintStatus.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            )}
            <div className="flex-1 font-mono text-[11px] leading-tight">
              {networkPrintStatus.message}
            </div>
          </div>
        )}

        {/* Printable 80mm Preview Container */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-[380px] overflow-y-auto">
          
          {/* THE 80MM THERMAL RECEIPT SHEET (Targeted by @media print) */}
          <div className="printable-thermal-receipt bg-white text-black p-4 rounded-lg font-mono text-[11px] shadow-sm leading-tight select-none">
            
            {mode === 'BILL' ? (
              /* --- 80mm CUSTOMER FINAL BILL --- */
              <div>
                <div className="text-center pb-2 border-b border-dashed border-gray-400">
                  <div className="text-base font-black tracking-wide">THE BERMUDA COCKTAIL</div>
                  <div className="text-[10px] text-gray-700">Craft Cocktails & Gourmet Kitchen</div>
                  <div className="text-[9px] text-gray-600">Main Boulevard · City Centre</div>
                  <div className="text-[9px] text-gray-600">GSTIN: 33ABCDE1234F1Z5 · Ph: +91 98765 43210</div>
                  <div className="text-xs font-black mt-1 uppercase">Tax Invoice / Final Bill</div>
                </div>

                <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>Bill No: <strong className="font-mono">{order.order_number}</strong></span>
                    <span>{nowFormatted.split(',')[0]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Table: <strong className="font-bold">{tableLabel}</strong></span>
                    <span>{nowFormatted.split(',')[1]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waiter: {order.waiter_name || order.collected_by || 'Staff'}</span>
                    <span>Guest: {order.customer_name || 'Walk-in'}</span>
                  </div>
                  {order.booking_platform && (
                    <div>Platform: <span className="font-bold">{order.booking_platform}</span></div>
                  )}
                </div>

                {/* Items Table */}
                <div className="py-2 border-b border-dashed border-gray-400">
                  <div className="flex justify-between text-[10px] font-black pb-1 border-b border-gray-300">
                    <span className="w-1/2">ITEM</span>
                    <span className="w-12 text-center">QTY</span>
                    <span className="w-12 text-right">RATE</span>
                    <span className="w-14 text-right">AMT</span>
                  </div>

                  <div className="divide-y divide-gray-100 py-1">
                    {(order.items || []).map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 text-[10.5px]">
                        <span className="w-1/2 truncate font-medium">
                          {it.product?.name || it.product_name || `Item #${it.product_id}`}
                        </span>
                        <span className="w-12 text-center font-bold">{it.quantity}</span>
                        <span className="w-12 text-right">₹{it.unit_price}</span>
                        <span className="w-14 text-right font-black">₹{it.quantity * it.unit_price}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="py-2 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between text-gray-800">
                      <span>Discount ({discountPct}%):</span>
                      <span>-₹{discountAmt.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black pt-1 border-t border-gray-300">
                    <span>NET PAYABLE:</span>
                    <span>₹{finalTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Status */}
                <div className="py-2 border-b border-dashed border-gray-400 text-[10px] flex justify-between items-center">
                  <span>Payment Status:</span>
                  <span className="font-black px-1.5 py-0.5 rounded bg-gray-200">
                    {order.payment_status === 'COLLECTED' ? `PAID (${order.payment_mode || 'CASH'})` : 'PENDING'}
                  </span>
                </div>

                {/* Footer */}
                <div className="text-center pt-2 text-[9px] text-gray-600 space-y-0.5">
                  <div className="font-bold">Prices inclusive of all applicable taxes</div>
                  <div>Thank you for visiting Bermuda Pub!</div>
                  <div className="font-semibold text-black">Drink Responsibly · Follow @bermudacocktail</div>
                  <div className="text-[8px] text-gray-400 pt-1">*** END OF BILL ***</div>
                </div>
              </div>
            ) : (
              /* --- 80mm KITCHEN ORDER TICKET (KOT) --- */
              <div>
                <div className="text-center pb-2 border-b-2 border-black">
                  <div className="text-sm font-black tracking-wider uppercase">*** KITCHEN ORDER TICKET ***</div>
                  <div className="text-xl font-black mt-1 py-1 px-2 border-2 border-black rounded uppercase">
                    TABLE: {tableLabel}
                  </div>
                </div>

                <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>KOT / Order: <strong>{order.order_number}</strong></span>
                    <span>{nowFormatted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Server / Waiter: <strong>{order.waiter_name || order.collected_by || 'Staff'}</strong></span>
                  </div>
                </div>

                {/* Food Items for Chef */}
                <div className="py-2 border-b-2 border-black space-y-2">
                  <div className="flex justify-between font-black text-xs border-b border-gray-400 pb-1">
                    <span>QTY</span>
                    <span>KITCHEN FOOD ITEM</span>
                  </div>

                  {foodItems.length === 0 ? (
                    <div className="text-center py-2 text-gray-500 italic text-[10px]">
                      No kitchen food items in this order (Drinks only).
                    </div>
                  ) : (
                    foodItems.map((it, idx) => (
                      <div key={idx} className="border-b border-gray-100 pb-1">
                        <div className="flex items-start gap-2 text-xs font-black">
                          <span className="px-1.5 py-0.5 bg-black text-white rounded text-xs font-mono">
                            [{it.quantity}]
                          </span>
                          <span className="flex-1">{it.product?.name || it.product_name || `Food #${it.product_id}`}</span>
                        </div>
                        {it.notes && (
                          <div className="text-[10px] text-gray-700 italic pl-8">
                            &gt;&gt; Note: &ldquo;{it.notes}&rdquo;
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 text-center text-[10px] font-black">
                  Total Items: {foodItems.reduce((acc, it) => acc + (it.quantity || 1), 0)}
                  <div className="text-[8px] text-gray-500 mt-1">*** END OF TICKET ***</div>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>

        {/* Sticky Action Buttons Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 shrink-0 bg-slate-900/95 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {mode === 'BILL' ? (
              <>
                {/* Print Bill over LAN Socket */}
                <button
                  type="button"
                  onClick={handleSendBillToLan}
                  disabled={isSendingBillToLan}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg transition disabled:opacity-50"
                >
                  <Wifi className="w-4 h-4" />
                  {isSendingBillToLan ? 'Printing to LAN...' : 'Print Bill over LAN'}
                </button>

                {/* Browser Print Backup */}
                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition"
                >
                  <Printer className="w-4 h-4 text-amber-400" /> Browser Print Backup
                </button>
              </>
            ) : (
              <>
                {/* Send KOT over LAN Socket */}
                <button
                  type="button"
                  onClick={handleSendToRugtek}
                  disabled={isSendingToRugtek}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg transition disabled:opacity-50"
                >
                  <Wifi className="w-4 h-4" />
                  {isSendingToRugtek ? 'Sending to Kitchen LAN...' : 'Send KOT to Kitchen (LAN)'}
                </button>

                {/* Browser Print Backup */}
                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  className="bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition"
                >
                  <Printer className="w-4 h-4 text-purple-400" /> Browser Print Backup
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
