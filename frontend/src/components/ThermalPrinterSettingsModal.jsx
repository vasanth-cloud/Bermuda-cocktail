import React, { useState, useEffect } from 'react';
import { Printer, Wifi, Save, RefreshCw, CheckCircle2, AlertCircle, X, Search, HelpCircle, ArrowRight } from 'lucide-react';
import { apiFetch } from '../config';

export default function ThermalPrinterSettingsModal({ isOpen, onClose }) {
  const [config, setConfig] = useState({
    kitchen_printer_name: 'RUGTEK RP327 / RP326 (Kitchen KOT)',
    kitchen_printer_ip: '192.168.0.70',
    kitchen_printer_port: 9100,
    kitchen_printer_enabled: true,
    auto_print_kot: true,
    cashier_printer_name: 'POSIFLEX PP-8800 / RP327 (Cashier / Bar Billing)',
    cashier_printer_ip: '192.168.1.87',
    cashier_printer_port: 9100,
    cashier_printer_enabled: true,
    auto_print_bill: true,
    bar_printer_name: 'POSIFLEX PP-8800 (Bar KOT)',
    bar_printer_ip: '192.168.1.87',
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
        setSaveSuccess('Printer network settings saved successfully!');
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
    let ip = config.kitchen_printer_ip;
    let port = config.kitchen_printer_port;
    let name = config.kitchen_printer_name;

    if (target === 'CASHIER') {
      setResult = setCashierTestResult;
      ip = config.cashier_printer_ip;
      port = config.cashier_printer_port;
      name = config.cashier_printer_name;
    } else if (target === 'BAR') {
      setResult = setBarTestResult;
      ip = config.bar_printer_ip || '192.168.1.87';
      port = config.bar_printer_port || 9100;
      name = config.bar_printer_name || 'POSIFLEX PP-8800 (Bar KOT)';
    }

    setResult({ loading: true, message: `Sending ESC/POS test packet to ${name} at ${ip}:${port}...` });
    try {
      const res = await apiFetch('/api/printers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: target,
          ip: ip,
          port: port,
          printer_name: name
        })
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
        message: `Network error: ${err.message}`
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-3.5 sm:p-4 shrink-0 bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-100 flex items-center gap-2">
                LAN Thermal Printers Setup
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  ALL-LAN SOCKETS
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Direct TCP/IP socket printing over pub Wi-Fi router / switch (Port 9100)
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

        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Modal Content */}
          <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3.5 text-xs">
            {saveSuccess && (
              <div className="bg-emerald-950/70 border border-emerald-500/50 p-3 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                {saveSuccess}
              </div>
            )}

            {/* Bridge Status Card */}
            <div className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition-all ${
              config.bridge_connected
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full animate-pulse ${
                    config.bridge_connected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'
                  }`} />
                  <span className="font-extrabold text-xs sm:text-sm text-slate-100">
                    {config.bridge_connected
                      ? `Cloud-to-LAN Print Bridge: CONNECTED (${(config.connected_bridges || []).join(', ') || 'Counter PC'})`
                      : 'Cloud-to-LAN Bridge: OFFLINE (Requires Counter PC Relay)'}
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
                <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                  🟢 Your POS counter terminal is linked to the cloud. KOT tickets and customer bills will automatically dispatch to LAN printers (192.168.0.70 & 192.168.1.87) in under 0.1s.
                </p>
              ) : (
                <div className="text-[11px] text-slate-300 space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-amber-500/20">
                  <div className="text-amber-300 font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    Why IP 192.168.x.x fails from elitedominators.com:
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    <strong>192.168.x.x</strong> is a private local network IP inside the pub. Cloud servers on the internet cannot cross your pub's Wi-Fi router directly.
                  </p>
                  <div className="pt-1 flex flex-wrap gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      Option 1: Double-click tools\Start_Print_Bridge.bat on counter PC
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                      Option 2: Open POS locally at http://localhost:3000
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* LAN Scanner & Self-Test Guide Bar */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-blue-500/30 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDiscoverPrinters}
                  disabled={isDiscovering}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition disabled:opacity-50"
                >
                  <Search className="w-3.5 h-3.5" />
                  {isDiscovering ? 'Scanning Subnet...' : '🔍 Scan & Auto-Discover LAN Printers'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSelfTestGuide(!showSelfTestGuide)}
                  className="text-amber-400 hover:text-amber-300 text-xs font-bold flex items-center gap-1 underline underline-offset-4"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  {showSelfTestGuide ? 'Hide Self-Test Instructions' : 'How to find printer IP in 5 seconds?'}
                </button>
              </div>

              {/* Self-Test Diagnostic Guide */}
              {showSelfTestGuide && (
                <div className="bg-slate-900 border border-amber-500/40 p-3.5 rounded-xl text-[11px] text-slate-300 space-y-2">
                  <div className="font-extrabold text-amber-300 text-xs flex items-center gap-1.5">
                    📄 Print Self-Test Diagnostic Slip (Reveals IP Address):
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-300 leading-relaxed">
                    <li>Turn <strong className="text-white">OFF</strong> the printer power switch.</li>
                    <li>Press and <strong className="text-amber-300">HOLD down the FEED button</strong> on the printer.</li>
                    <li>Turn the power switch <strong className="text-white">ON</strong> while continuing to hold the FEED button.</li>
                    <li>Release the FEED button after <strong className="text-amber-300">2-3 seconds</strong>.</li>
                    <li>The printer will feed and print a self-test diagnostic slip showing its exact <strong className="text-emerald-400">IP Address</strong> (e.g. <span className="font-mono text-emerald-300">192.168.1.xxx</span> or factory default <span className="font-mono text-emerald-300">192.168.123.100</span>).</li>
                  </ol>
                </div>
              )}

              {/* Discovery Output */}
              {discoveryResult && (
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl text-xs space-y-2">
                  <div className="text-slate-300 font-mono text-[11px]">{discoveryResult.message}</div>
                  {discoveryResult.found_printers && discoveryResult.found_printers.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="font-bold text-emerald-400">Detected Printers:</div>
                      {discoveryResult.found_printers.map((ip) => (
                        <div key={ip} className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800">
                          <span className="font-mono font-bold text-amber-300">{ip}:9100</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setConfig({ ...config, kitchen_printer_ip: ip })}
                              className="px-2.5 py-1 bg-purple-900 text-purple-200 rounded font-bold text-[10px] hover:bg-purple-800"
                            >
                              Use for Kitchen
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfig({ ...config, cashier_printer_ip: ip })}
                              className="px-2.5 py-1 bg-amber-900 text-amber-200 rounded font-bold text-[10px] hover:bg-amber-800"
                            >
                              Use for Cashier
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          
          {/* PRINTER 1: RUGTEK RP326 (Kitchen LAN) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-purple-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍳</span>
                <div>
                  <div className="font-black text-sm text-purple-300 flex items-center gap-2">
                    Kitchen KOT Printer (RUGTEK RP326)
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                      LAN Socket
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">Prints food tickets in the kitchen automatically</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[11px] font-bold text-slate-300">Auto-Print KOT</span>
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
                  value={config.kitchen_printer_ip}
                  onChange={(e) => setConfig({ ...config, kitchen_printer_ip: e.target.value })}
                  placeholder="e.g. 192.168.1.87"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Port (Default 9100):</label>
                <input
                  type="number"
                  value={config.kitchen_printer_port}
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
                {kitchenTestResult?.loading ? 'Pinging Kitchen Printer...' : 'Test Kitchen LAN Printer'}
              </button>
              
              <div className="text-[11px] text-slate-400">
                Target: <span className="font-mono text-purple-300">{config.kitchen_printer_ip}:{config.kitchen_printer_port}</span>
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

          {/* PRINTER 2: POSIFLEX PP-8800 (Cashier/Bar LAN) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧾</span>
                <div>
                  <div className="font-black text-sm text-amber-300 flex items-center gap-2">
                    Cashier / Bar Billing Printer (POSIFLEX PP-8800)
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                      LAN Socket
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">Prints customer 80mm tax invoices over the network</div>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-300 block mb-1">
                  Cashier Printer IP Address:
                </label>
                <input
                  type="text"
                  value={config.cashier_printer_ip}
                  onChange={(e) => setConfig({ ...config, cashier_printer_ip: e.target.value })}
                  placeholder="e.g. 192.168.1.201"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Port (Default 9100):</label>
                <input
                  type="number"
                  value={config.cashier_printer_port}
                  onChange={(e) => setConfig({ ...config, cashier_printer_port: Number(e.target.value) })}
                  placeholder="9100"
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
                <Wifi className="w-3.5 h-3.5" />
                {cashierTestResult?.loading ? 'Pinging Cashier Printer...' : 'Test Cashier LAN Printer'}
              </button>
              
              <div className="text-[11px] text-slate-400">
                Target: <span className="font-mono text-amber-300">{config.cashier_printer_ip}:{config.cashier_printer_port}</span>
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

          {/* PRINTER 3: BAR KOT PRINTER (Drinks & Cocktails) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍸</span>
                <div>
                  <div className="font-black text-sm text-cyan-300 flex items-center gap-2">
                    Bar KOT Printer (Cocktails & Drinks)
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                      Bar Station
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">Prints drinks, cocktails, and beer tickets at the bar</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[11px] font-bold text-slate-300">Auto-Print Bar KOT</span>
                  <input
                    type="checkbox"
                    checked={config.auto_print_bar_kot}
                    onChange={(e) => setConfig({ ...config, auto_print_bar_kot: e.target.checked })}
                    className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 bg-slate-900 border-slate-700"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-300 block mb-1">
                  Bar Printer IP Address:
                </label>
                <input
                  type="text"
                  value={config.bar_printer_ip || '192.168.1.87'}
                  onChange={(e) => setConfig({ ...config, bar_printer_ip: e.target.value })}
                  placeholder="e.g. 192.168.1.87"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Port (Default 9100):</label>
                <input
                  type="number"
                  value={config.bar_printer_port || 9100}
                  onChange={(e) => setConfig({ ...config, bar_printer_port: Number(e.target.value) })}
                  placeholder="9100"
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
                <Wifi className="w-3.5 h-3.5" />
                {barTestResult?.loading ? 'Pinging Bar Printer...' : 'Test Bar LAN Printer'}
              </button>
              
              <div className="text-[11px] text-slate-400">
                Target: <span className="font-mono text-cyan-300">{config.bar_printer_ip || '192.168.1.87'}:{config.bar_printer_port || 9100}</span>
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
