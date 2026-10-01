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
    const isKitchen = target === 'KITCHEN';
    const setResult = isKitchen ? setKitchenTestResult : setCashierTestResult;
    const ip = isKitchen ? config.kitchen_printer_ip : config.cashier_printer_ip;
    const port = isKitchen ? config.kitchen_printer_port : config.cashier_printer_port;
    const name = isKitchen ? config.kitchen_printer_name : config.cashier_printer_name;

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
    <div className="fixed inset-0 md:left-64 lg:left-72 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 my-6">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                LAN Thermal Printers Setup
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  ALL-LAN SOCKETS
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Direct TCP/IP socket printing over pub Wi-Fi router / switch (Port 9100)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-sm font-bold transition"
          >
            ✕
          </button>
        </div>

        {saveSuccess && (
          <div className="bg-emerald-950/70 border border-emerald-500/50 p-3 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            {saveSuccess}
          </div>
        )}

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

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          
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

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
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
