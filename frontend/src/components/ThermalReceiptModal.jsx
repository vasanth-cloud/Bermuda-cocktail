import React, { useState } from 'react';
import { Printer, Wifi, CheckCircle2, AlertCircle, X, Receipt, Utensils, Wine, Layers, HelpCircle } from 'lucide-react';
import { apiFetch } from '../config';

export default function ThermalReceiptModal({ order, onClose, initialMode = 'BILL' }) {
  // Modes: 'BILL', 'KITCHEN', 'BAR', 'ALL_KOT'
  const [mode, setMode] = useState(initialMode);
  const [isSendingToRugtek, setIsSendingToRugtek] = useState(false);
  const [isSendingBillToLan, setIsSendingBillToLan] = useState(false);
  const [networkPrintStatus, setNetworkPrintStatus] = useState(null);

  if (!order) return null;

  // Ultra-Fast Isolated Iframe Printing (Eliminates "Preview not available" and browser lag)
  const handleBrowserPrint = () => {
    const receiptEl = document.getElementById('printable-thermal-content');
    if (!receiptEl) {
      window.print();
      return;
    }

    let iframe = document.getElementById('thermal-silent-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'thermal-silent-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${mode === 'BILL' ? `Bill_${order.order_number}` : `KOT_${mode}_${order.order_number}`}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0mm;
            }
            html, body {
              margin: 0;
              padding: 2mm;
              width: 72mm;
              max-width: 72mm;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: 'Courier New', Courier, monospace, monospace !important;
              font-size: 11px !important;
              line-height: 1.25 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            * {
              box-sizing: border-box;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .font-black { font-weight: 900; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .items-center { align-items: center; }
            .items-start { align-items: flex-start; }
            .border-b { border-bottom: 1px dashed #000; }
            .border-t { border-top: 1px dashed #000; }
            .border-b-2 { border-bottom: 2px solid #000; }
            .border-2 { border: 2px solid #000; }
            .py-1 { padding-top: 2px; padding-bottom: 2px; }
            .py-2 { padding-top: 4px; padding-bottom: 4px; }
            .uppercase { text-transform: uppercase; }
            .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .w-12 { width: 48px; }
            .w-14 { width: 56px; }
            .w-half { width: 50%; }
            .rounded { border-radius: 4px; }
            .p-1 { padding: 4px; }
            .p-2 { padding: 8px; }
            .space-y-1 > * + * { margin-top: 3px; }
            .space-y-2 > * + * { margin-top: 6px; }
          </style>
        </head>
        <body>
          ${receiptEl.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error("Iframe print error:", err);
        window.print();
      }
    }, 80);
  };

  const [isSendingToBarBot, setIsSendingToBarBot] = useState(false);

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
        setNetworkPrintStatus({ success: true, message: data.message || `Bill sent to Rugtek RP327 Cashier (RP327 Printer USB001)!` });
      } else {
        setNetworkPrintStatus({
          success: false,
          message: data.message || 'Could not connect to Cashier printer. Use "Print (1-Click Browser)" to print via Windows!'
        });
      }
    } catch (err) {
      setNetworkPrintStatus({
        success: false,
        message: `Print error: ${err.message}. Use "Print (1-Click Browser)" to print directly via Windows!`
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
        setNetworkPrintStatus({ success: true, message: data.message || 'KOT sent to Kitchen Ethernet printer (Rugtek 192.168.0.70)!' });
      } else {
        setNetworkPrintStatus({
          success: false,
          message: data.message || 'Could not connect to Kitchen printer. Use "Print KOT (1-Click Browser)" to print via Windows!'
        });
      }
    } catch (err) {
      setNetworkPrintStatus({
        success: false,
        message: `Print error: ${err.message}. Use "Print KOT (1-Click Browser)" to print directly via Windows!`
      });
    } finally {
      setIsSendingToRugtek(false);
    }
  };

  const handleSendToBarBot = async () => {
    setIsSendingToBarBot(true);
    setNetworkPrintStatus(null);
    try {
      const res = await apiFetch(`/api/printers/print-bot/${order.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNetworkPrintStatus({ success: true, message: data.message || 'BOT sent to Posiflex Bar printer (BAR BOT USB002)!' });
      } else {
        setNetworkPrintStatus({
          success: false,
          message: data.message || 'Could not connect to Posiflex Bar printer. Use "Print Bar BOT (1-Click)" to print via Windows!'
        });
      }
    } catch (err) {
      setNetworkPrintStatus({
        success: false,
        message: `Print error: ${err.message}. Use "Print Bar BOT (1-Click)" to print directly via Windows!`
      });
    } finally {
      setIsSendingToBarBot(false);
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

  const allItems = order.items || [];

  // Helper to distinguish Drink vs Food
  const isDrinkItem = (it) => {
    const dept = (it.target_dept || it.product?.target_dept || '').toUpperCase();
    const cat = (it.product?.category?.name || it.category_name || '').toUpperCase();
    const name = (it.product?.name || it.product_name || '').toUpperCase();
    if (dept === 'BAR' || dept === 'DRINK' || dept === 'BEVERAGE') return true;
    if (dept === 'KITCHEN' || dept === 'FOOD') return false;
    return (
      cat.includes('BEER') || cat.includes('COCKTAIL') || cat.includes('WINE') || 
      cat.includes('BAR') || cat.includes('LIQUOR') || cat.includes('BEVERAGE') || 
      cat.includes('WHISKY') || cat.includes('VODKA') || cat.includes('RUM') || cat.includes('GIN') ||
      name.includes('BEER') || name.includes('COCKTAIL') || name.includes('PEPSI') || name.includes('SODA')
    );
  };

  const foodItems = allItems.filter((it) => !isDrinkItem(it));
  const barItems = allItems.filter(isDrinkItem);

  // Active items for current KOT mode
  let kotItems = allItems;
  let kotTitle = 'MASTER ORDER TICKET';
  let kotPrinterHint = 'Select your target printer';

  if (mode === 'KITCHEN') {
    kotItems = foodItems.length > 0 ? foodItems : allItems;
    kotTitle = 'KITCHEN ORDER TICKET (FOOD)';
    kotPrinterHint = 'Select "KITCHEN KOT" (Rugtek Ethernet 192.168.0.70)';
  } else if (mode === 'BAR') {
    kotItems = barItems.length > 0 ? barItems : allItems;
    kotTitle = 'BAR ORDER TICKET (DRINKS)';
    kotPrinterHint = 'Select "BAR BOT" (Posiflex USB002)';
  } else if (mode === 'ALL_KOT') {
    kotItems = allItems;
    kotTitle = 'MASTER ORDER TICKET (ALL ITEMS)';
    kotPrinterHint = 'Select desired printer in Chrome print box';
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-3 sm:p-4 shrink-0 bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-100 flex items-center gap-1.5">
                Thermal 80mm Multi-Printer
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                  3 PRINTERS READY
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
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3 text-xs">

          {/* 4 Mode Selector Tabs (Bill, Kitchen, Bar, Master KOT) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMode('BILL')}
              className={`py-2 px-2 rounded-lg font-bold text-[11px] flex flex-col items-center justify-center gap-0.5 transition ${
                mode === 'BILL'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Customer Bill</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('KITCHEN')}
              className={`py-2 px-2 rounded-lg font-bold text-[11px] flex flex-col items-center justify-center gap-0.5 transition ${
                mode === 'KITCHEN'
                  ? 'bg-purple-600 text-white shadow-md font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Kitchen KOT ({foodItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('BAR')}
              className={`py-2 px-2 rounded-lg font-bold text-[11px] flex flex-col items-center justify-center gap-0.5 transition ${
                mode === 'BAR'
                  ? 'bg-cyan-600 text-white shadow-md font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wine className="w-3.5 h-3.5" />
              <span>Bar KOT ({barItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('ALL_KOT')}
              className={`py-2 px-2 rounded-lg font-bold text-[11px] flex flex-col items-center justify-center gap-0.5 transition ${
                mode === 'ALL_KOT'
                  ? 'bg-emerald-600 text-white shadow-md font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Master KOT ({allItems.length})</span>
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
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-[350px] overflow-y-auto">
            
            {/* THE 80MM THERMAL RECEIPT SHEET (Targeted by isolated iframe printing) */}
            <div
              id="printable-thermal-content"
              className="printable-thermal-receipt bg-white text-black p-4 rounded-lg font-mono text-[11px] shadow-sm leading-tight select-none"
            >
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
                      {allItems.map((it, idx) => (
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
                /* --- 80mm ORDER TICKET (KITCHEN, BAR, OR MASTER KOT) --- */
                <div>
                  <div className="text-center pb-2 border-b-2 border-black">
                    <div className="text-xs font-black tracking-wider uppercase">*** {kotTitle} ***</div>
                    <div className="text-2xl font-black mt-1 py-1 px-2 border-2 border-black rounded uppercase">
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
                      <span>Guest: {order.customer_name || 'Walk-in'}</span>
                    </div>
                  </div>

                  {/* Food/Bar Items for Chef / Bartender */}
                  <div className="py-2 border-b-2 border-black space-y-2">
                    <div className="flex justify-between font-black text-xs border-b border-gray-400 pb-1">
                      <span>QTY</span>
                      <span>ORDER ITEM DESCRIPTION</span>
                    </div>

                    {kotItems.length === 0 ? (
                      <div className="text-center py-2 text-gray-500 italic text-[10px]">
                        No items found for this department.
                      </div>
                    ) : (
                      kotItems.map((it, idx) => (
                        <div key={idx} className="border-b border-gray-100 pb-1">
                          <div className="flex items-start gap-2 text-xs font-black">
                            <span className="px-1.5 py-0.5 bg-black text-white rounded text-xs font-mono">
                              [{it.quantity}]
                            </span>
                            <span className="flex-1">{it.product?.name || it.product_name || `Item #${it.product_id}`}</span>
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
                    Total Items: {kotItems.reduce((acc, it) => acc + (it.quantity || 1), 0)}
                    <div className="text-[8px] text-gray-500 mt-1">*** END OF TICKET ***</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Action Buttons Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 shrink-0 bg-slate-900/95 space-y-2">
          
          {/* Target Printer Guidance Hint */}
          <div className="text-[11px] text-amber-300/90 font-medium flex items-center justify-between px-1">
            <span className="flex items-center gap-1">
              <Printer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {mode === 'BILL' 
                ? 'Target: Rugtek RP327 (Cashier USB001 → RP327 Printer)' 
                : mode === 'BAR'
                ? 'Target: Posiflex (Bar BOT USB002 → BAR BOT)'
                : mode === 'KITCHEN'
                ? 'Target: Rugtek RP327 (Kitchen LAN → 192.168.0.70 / KITCHEN KOT)'
                : `Target: ${kotPrinterHint}`}
            </span>
            <span className="text-[10px] font-bold text-slate-400">80mm Thermal</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {mode === 'BILL' ? (
              <>
                {/* Browser 1-Click Print (Instant Iframe Print) */}
                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg transition"
                >
                  <Printer className="w-4 h-4 text-slate-950" /> Print Bill (1-Click Instant)
                </button>

                {/* Print Bill over Bridge / Spooler */}
                <button
                  type="button"
                  onClick={handleSendBillToLan}
                  disabled={isSendingBillToLan}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition disabled:opacity-50"
                >
                  <Wifi className="w-4 h-4 text-amber-400" />
                  {isSendingBillToLan ? 'Relaying to Cashier...' : 'Relay to Cashier (RP327 Printer)'}
                </button>
              </>
            ) : mode === 'BAR' ? (
              <>
                {/* Browser 1-Click Print */}
                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg transition"
                >
                  <Printer className="w-4 h-4 text-white" />
                  Print Bar BOT (1-Click)
                </button>

                {/* Send BOT to Posiflex USB */}
                <button
                  type="button"
                  onClick={handleSendToBarBot}
                  disabled={isSendingToBarBot}
                  className="bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition disabled:opacity-50"
                >
                  <Wifi className="w-4 h-4 text-cyan-400" />
                  {isSendingToBarBot ? 'Relaying to Posiflex...' : 'Relay to Bar BOT (Posiflex USB)'}
                </button>
              </>
            ) : (
              <>
                {/* Browser 1-Click Print */}
                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-lg transition ${
                    mode === 'KITCHEN'
                      ? 'bg-purple-600 hover:bg-purple-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <Printer className="w-4 h-4 text-white" />
                  Print {mode === 'KITCHEN' ? 'Kitchen KOT' : 'Master KOT'} (1-Click)
                </button>

                {/* Send KOT to Rugtek Ethernet */}
                <button
                  type="button"
                  onClick={handleSendToRugtek}
                  disabled={isSendingToRugtek}
                  className="bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition disabled:opacity-50"
                >
                  <Wifi className="w-4 h-4 text-purple-400" />
                  {isSendingToRugtek ? 'Relaying to Kitchen...' : 'Relay to Kitchen (192.168.0.70)'}
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
