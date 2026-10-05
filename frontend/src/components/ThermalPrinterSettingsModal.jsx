import React, { useState, useEffect } from 'react';
import { Printer, Wifi, Save, RefreshCw, CheckCircle2, AlertCircle, X, Search, HelpCircle, ArrowRight, Usb } from 'lucide-react';
import { apiFetch } from '../config';

export default function ThermalPrinterSettingsModal({ isOpen, onClose }) {
  const [config, setConfig] = useState({
    kitchen_printer_name: 'KITCHEN KOT',
    kitchen_printer_model: 'Rugtek RP327 (Kitchen KOT)',
    kitchen_printer_connection: 'Ethernet',
    kitchen_printer_ip: '192.168.0.70',
    kitchen_printer_port: 9100,
    kitchen_printer_windows_name: 'KITCHEN KOT',
    kitchen_printer_enabled: true,
    auto_print_kot: true,

    cashier_printer_name: 'RP327 Printer',
    cashier_printer_model: 'Rugtek RP327 (Cashier / Billing)',
    cashier_printer_connection: 'USB',
    cashier_printer_windows_name: 'RP327 Printer',
    cashier_printer_port_name: 'USB001',
    cashier_printer_ip: '',
    cashier_printer_port: 9100,
    cashier_printer_enabled: true,
    auto_print_bill: true,

    bar_printer_name: 'BAR BOT',
    bar_printer_model: 'Posiflex (Bar BOT)',
    bar_printer_connection: 'USB',
    bar_printer_windows_name: 'BAR BOT',
    bar_printer_port_name: 'USB002',
    bar_printer_ip: '',
    bar_printer_port: 9100,
    bar_printer_enabled: true,
    auto_print_bar_kot: true,

    bill_header_title: 'THE BERMUDA COCKTAIL',
    bill_header_subtitle: 'Craft Cocktails & Gourmet Pub',
    bill_address: 'Main Boulevard, Pub Row',
    bill_phone: '+91 98765 43210',
    bill_gstin: '33ABCDE1234F1Z5',
    bill_fssai: '12423002000123',
    bill_footer_msg: 'Thank You For Visiting! Drink Responsibly.'
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kitchenTestResult, setKitchenTestResult] = useState(null);
  const [cashierTestResult, setCashierTestResult] = useState(null);
  const [barTestResult, setBarTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState('');

  // Auto-Discovery State
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState(null);
  const [showSelfTestGuide, setShowSelfTestGuide] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/printers/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error("Failed to load printer config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess('');
    try {
      const res = await apiFetch('/api/printers/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setSaveSuccess('Printer hardware settings saved successfully!');
        setTimeout(() => setSaveSuccess(''), 4000);
      }
    } catch (err) {
      alert("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscoverPrinters = async () => {
    setIsDiscovering(true);
    setDiscoveryResult(null);
    try {
      const res = await apiFetch('/api/printers/discover', { method: 'POST' });
      const data = await res.json();
      setDiscoveryResult(data);
    } catch (err) {
      setDiscoveryResult({ message: `Discovery error: ${err.message}` });
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleTestPrinter = async (target) => {
    let setResult = setKitchenTestResult;
    let payload = { target };

    if (target === 'BAR') {
      setResult = setBarTestResult;
      payload.printer_name = config.bar_printer_model || 'Posiflex (Bar BOT)';
      payload.windows_printer = config.bar_printer_windows_name || 'BAR BOT';
      setResult({ loading: true, message: `Sending ESC/POS test packet to Posiflex USB (${payload.windows_printer} on USB002)...` });
    } else if (target === 'CASHIER') {
      setResult = setCashierTestResult;
      payload.printer_name = config.cashier_printer_model || 'Rugtek RP327 (Cashier / Billing)';
      payload.windows_printer = config.cashier_printer_windows_name || 'RP327 Printer';
      setResult({ loading: true, message: `Sending ESC/POS test packet to Rugtek RP327 USB (${payload.windows_printer} on USB001)...` });
    } else {
      setResult = setKitchenTestResult;
      payload.printer_name = config.kitchen_printer_model || 'Rugtek RP327 (Kitchen KOT)';
      payload.windows_printer = config.kitchen_printer_windows_name || 'KITCHEN KOT';
      payload.ip = config.kitchen_printer_ip || '192.168.0.70';
      payload.port = config.kitchen_printer_port || 9100;
      setResult({ loading: true, message: `Sending ESC/POS test packet to Kitchen Ethernet (${payload.ip}:${payload.port})...` });
    }

    try {
      const res = await apiFetch('/api/printers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setResult({
        loading: false,
        success: data.success,
        message: data.message
      });
    } catch (err) {
      setResult({
        loading: false,
        success: false,
        message: `Error testing printer: ${err.message}`
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-3 sm:p-4 shrink-0 bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-100 flex items-center gap-2">
                Thermal 80mm Hardware Printer Setup
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  3 HARDWARE PRINTERS
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Posiflex (Bar BOT) · Rugtek RP327 (Billing) · Rugtek RP327 (Kitchen KOT)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-sm font-bold transition shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 text-xs">
          
          {/* Hardware Summary Banner */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>📌</span> Physical Port & Connection Status
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30">
                <div className="font-bold text-cyan-300 flex items-center gap-1">
                  <Usb className="w-3.5 h-3.5" /> Posiflex (Bar BOT)
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5 font-mono">USB Type-B → USB002</div>
                <div className="text-[10px] text-cyan-400 font-bold">BAR BOT</div>
              </div>
              <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/30">
                <div className="font-bold text-amber-300 flex items-center gap-1">
                  <Usb className="w-3.5 h-3.5" /> Rugtek RP327 (Cashier)
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5 font-mono">USB Type-B → USB001</div>
                <div className="text-[10px] text-amber-400 font-bold">RP327 Printer</div>
              </div>
              <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/30">
                <div className="font-bold text-purple-300 flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5" /> Rugtek RP327 (Kitchen)
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5 font-mono">Ethernet LAN → Port 9100</div>
                <div className="text-[10px] text-purple-400 font-bold">192.168.0.70</div>
              </div>
            </div>
          </div>

          {/* Success Alert */}
          {saveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-2 text-xs font-bold shadow-md">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{saveSuccess}</span>
            </div>
          )}

          {/* Cloud-to-Hardware Print Bridge Status */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${config.bridge_connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                <span className="font-black text-xs text-slate-200">
                  {config.bridge_connected 
                    ? `Print Bridge Connected: ${config.connected_bridges?.join(', ') || 'Counter POS Terminal'}`
                    : 'Cloud-to-Hardware Bridge: OFFLINE (Requires Counter PC Bridge)'}
                </span>
              </div>
              <button
                type="button"
                onClick={fetchConfig}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3 h-3" /> Refresh Status
              </button>
            </div>

            {config.bridge_connected ? (
              <p className="text-[11px] text-emerald-300/90 leading-relaxed font-mono">
                🟢 Your POS counter terminal is linked! Print jobs automatically dispatch to Posiflex (BAR BOT USB002), Rugtek (RP327 Printer USB001), and Kitchen Ethernet (192.168.0.70).
              </p>
            ) : (
              <div className="text-[11px] text-slate-300 space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-amber-500/20">
                <div className="text-amber-300 font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  How to link cloud orders to USB & LAN printers:
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  USB printers (Posiflex & Rugtek RP327) and LAN Ethernet (192.168.0.70) are physically attached to your POS counter Windows PC.
                </p>
                <div className="pt-1 flex flex-wrap gap-2 text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    Start Bridge: Double-click tools\Start_Print_Bridge.bat on counter PC
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                    Local Access: http://localhost:3000
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* PRINTER 1: POSIFLEX (Bar BOT - USB Type-B) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍸</span>
                <div>
                  <div className="font-black text-sm text-cyan-300 flex items-center gap-2">
                    Posiflex – Bar BOT Printer
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                      USB Type-B → USB002
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">Prints cocktails, beers, and drinks tickets at the bar</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[11px] font-bold text-slate-300">Auto-Print Bar BOT</span>
                  <input
                    type="checkbox"
                    checked={config.auto_print_bar_kot}
                    onChange={(e) => setConfig({ ...config, auto_print_bar_kot: e.target.checked })}
                    className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 bg-slate-900 border-slate-700"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Windows Device / Spooler Name:
                </label>
                <input
                  type="text"
                  value={config.bar_printer_windows_name || 'BAR BOT'}
                  onChange={(e) => setConfig({ ...config, bar_printer_windows_name: e.target.value })}
                  placeholder="BAR BOT"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Port Name:</label>
                <input
                  type="text"
                  value={config.bar_printer_port_name || 'USB002'}
                  onChange={(e) => setConfig({ ...config, bar_printer_port_name: e.target.value })}
                  placeholder="USB002"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => handleTestPrinter('BAR')}
                disabled={barTestResult?.loading}
                className="bg-cyan-900/60 hover:bg-cyan-800 border border-cyan-500/40 text-cyan-200 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Usb className="w-3.5 h-3.5" />
                {barTestResult?.loading ? 'Dispatching to Posiflex USB...' : 'Test Bar BOT (Posiflex USB)'}
              </button>
              
              <div className="text-[11px] text-slate-400">
                Target: <span className="font-mono text-cyan-300">{config.bar_printer_windows_name || 'BAR BOT'} ({config.bar_printer_port_name || 'USB002'})</span>
              </div>
            </div>

            {barTestResult && !barTestResult.loading && (
              <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                barTestResult.success
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}>
                {barTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                )}
                <div className="font-mono text-[11px] leading-tight">
                  {barTestResult.message}
                </div>
              </div>
            )}
          </div>

          {/* PRINTER 2: RUGTEK RP327 (Cashier / Billing - USB Type-B) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧾</span>
                <div>
                  <div className="font-black text-sm text-amber-300 flex items-center gap-2">
                    Rugtek RP327 – Cashier / Billing Printer
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                      USB Type-B → USB001
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">Prints customer 80mm tax invoices & settlement receipts</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[11px] font-bold text-slate-300">Auto-Print Bill</span>
                  <input
                    type="checkbox"
                    checked={config.auto_print_bill}
                    onChange={(e) => setConfig({ ...config, auto_print_bill: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Windows Device / Spooler Name:
                </label>
                <input
                  type="text"
                  value={config.cashier_printer_windows_name || 'RP327 Printer'}
                  onChange={(e) => setConfig({ ...config, cashier_printer_windows_name: e.target.value })}
                  placeholder="RP327 Printer"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Port Name:</label>
                <input
                  type="text"
                  value={config.cashier_printer_port_name || 'USB001'}
                  onChange={(e) => setConfig({ ...config, cashier_printer_port_name: e.target.value })}
                  placeholder="USB001"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => handleTestPrinter('CASHIER')}
                disabled={cashierTestResult?.loading}
                className="bg-amber-900/60 hover:bg-amber-800 border border-amber-500/40 text-amber-200 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Usb className="w-3.5 h-3.5" />
                {cashierTestResult?.loading ? 'Dispatching to Rugtek RP327 USB...' : 'Test Billing (Rugtek RP327 USB)'}
              </button>
              
              <div className="text-[11px] text-slate-400">
                Target: <span className="font-mono text-amber-300">{config.cashier_printer_windows_name || 'RP327 Printer'} ({config.cashier_printer_port_name || 'USB001'})</span>
              </div>
            </div>

            {cashierTestResult && !cashierTestResult.loading && (
              <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                cashierTestResult.success
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}>
                {cashierTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                )}
                <div className="font-mono text-[11px] leading-tight">
                  {cashierTestResult.message}
                </div>
              </div>
            )}
          </div>

          {/* PRINTER 3: RUGTEK RP327 (Kitchen KOT - Ethernet LAN) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-purple-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍳</span>
                <div>
                  <div className="font-black text-sm text-purple-300 flex items-center gap-2">
                    Rugtek RP327 – Kitchen KOT Printer
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                      Ethernet LAN
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">Prints food tickets in the kitchen automatically</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[11px] font-bold text-slate-300">Auto-Print Kitchen KOT</span>
                  <input
                    type="checkbox"
                    checked={config.auto_print_kot}
                    onChange={(e) => setConfig({ ...config, auto_print_kot: e.target.checked })}
                    className="w-4 h-4 rounded text-purple-500 focus:ring-purple-500 bg-slate-900 border-slate-700"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-300 block mb-1">
                  Kitchen Printer IP Address:
                </label>
                <input
                  type="text"
                  value={config.kitchen_printer_ip || '192.168.0.70'}
                  onChange={(e) => setConfig({ ...config, kitchen_printer_ip: e.target.value })}
                  placeholder="192.168.0.70"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Port (Default 9100):</label>
                <input
                  type="number"
                  value={config.kitchen_printer_port || 9100}
                  onChange={(e) => setConfig({ ...config, kitchen_printer_port: Number(e.target.value) })}
                  placeholder="9100"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => handleTestPrinter('KITCHEN')}
                disabled={kitchenTestResult?.loading}
                className="bg-purple-900/60 hover:bg-purple-800 border border-purple-500/40 text-purple-200 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Wifi className="w-3.5 h-3.5" />
                {kitchenTestResult?.loading ? 'Pinging Kitchen Ethernet...' : 'Test Kitchen (Rugtek LAN)'}
              </button>
              
              <div className="text-[11px] text-slate-400">
                Target: <span className="font-mono text-purple-300">{config.kitchen_printer_ip || '192.168.0.70'}:{config.kitchen_printer_port || 9100}</span>
              </div>
            </div>

            {kitchenTestResult && !kitchenTestResult.loading && (
              <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                kitchenTestResult.success
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}>
                {kitchenTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                )}
                <div className="font-mono text-[11px] leading-tight">
                  {kitchenTestResult.message}
                </div>
              </div>
            )}
          </div>

          {/* STORE & RECEIPT HEADER SETTINGS */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="font-black text-sm text-slate-200 flex items-center gap-2">
              <span>🏢</span> Store Header & Receipt Details
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Receipt Header Title:</label>
                <input
                  type="text"
                  value={config.bill_header_title}
                  onChange={(e) => setConfig({ ...config, bill_header_title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-bold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Tagline / Subtitle:</label>
                <input
                  type="text"
                  value={config.bill_header_subtitle}
                  onChange={(e) => setConfig({ ...config, bill_header_subtitle: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Pub Address:</label>
                <input
                  type="text"
                  value={config.bill_address}
                  onChange={(e) => setConfig({ ...config, bill_address: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Phone / Helpline:</label>
                <input
                  type="text"
                  value={config.bill_phone}
                  onChange={(e) => setConfig({ ...config, bill_phone: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">GSTIN Number:</label>
                <input
                  type="text"
                  value={config.bill_gstin}
                  onChange={(e) => setConfig({ ...config, bill_gstin: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Footer Message:</label>
                <input
                  type="text"
                  value={config.bill_footer_msg}
                  onChange={(e) => setConfig({ ...config, bill_footer_msg: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sticky Form Actions Footer */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-t border-slate-800 shrink-0 bg-slate-900/95">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition"
            >
              Close
            </button>

            <button
              type="submit"
              disabled={saving}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Settings...' : 'Save Printer Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
