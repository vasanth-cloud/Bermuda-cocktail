import React, { useState, useEffect } from 'react';
import { Printer, Wifi, Save, RefreshCw, CheckCircle2, AlertCircle, X, Sliders, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../config';

export default function ThermalPrinterSettingsModal({ isOpen, onClose }) {
  const [config, setConfig] = useState({
    kitchen_printer_name: 'RUGTEK RP326 (Kitchen LAN)',
    kitchen_printer_ip: '192.168.1.200',
    kitchen_printer_port: 9100,
    kitchen_printer_enabled: true,
    auto_print_kot: true,
    cashier_printer_name: 'POSIFLEX PP-8800U-B (Counter USB)',
    cashier_printer_type: 'USB_BROWSER',
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
  const [testResult, setTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState('');

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
        setSaveSuccess('Printer settings saved successfully!');
        setTimeout(() => setSaveSuccess(''), 4000);
      }
    } catch (err) {
      alert("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestRugtek = async () => {
    setTestResult({ loading: true, message: 'Testing socket connection to RUGTEK RP326...' });
    try {
      const res = await apiFetch('/api/printers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: config.kitchen_printer_ip,
          port: config.kitchen_printer_port,
          printer_name: config.kitchen_printer_name
        })
      });
      const data = await res.json();
      setTestResult({
        loading: false,
        success: data.success,
        message: data.message
      });
    } catch (err) {
      setTestResult({
        loading: false,
        success: false,
        message: `Connection test error: ${err.message}`
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 md:left-64 lg:left-72 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5 my-6">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                Thermal Printer Hardware Setup
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                  80mm ESC/POS
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Configure RUGTEK RP326 (Kitchen LAN) & POSIFLEX PP-8800U-B (Billing USB)
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

        <form onSubmit={handleSave} className="space-y-6 text-xs">
          
          {/* PRINTER 1: RUGTEK RP326 (Kitchen LAN / Ethernet) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-purple-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🖨️</span>
                <div>
                  <div className="font-black text-sm text-purple-300 flex items-center gap-2">
                    RUGTEK RP326 (Kitchen KOT Printer)
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                      Ethernet LAN
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">Prints food tickets in the kitchen automatically</div>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-[11px] font-bold text-slate-300">Auto-Print KOT</span>
                <input
                  type="checkbox"
                  checked={config.auto_print_kot}
                  onChange={(e) => setConfig({ ...config, auto_print_kot: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-300 block mb-1">
                  Printer IP Address (on Pub Wi-Fi / LAN router):
                </label>
                <input
                  type="text"
                  value={config.kitchen_printer_ip}
                  onChange={(e) => setConfig({ ...config, kitchen_printer_ip: e.target.value })}
                  placeholder="e.g. 192.168.1.200"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Port (Default: 9100):</label>
                <input
                  type="number"
                  value={config.kitchen_printer_port}
                  onChange={(e) => setConfig({ ...config, kitchen_printer_port: Number(e.target.value) })}
                  placeholder="9100"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleTestRugtek}
                disabled={testResult?.loading}
                className="bg-purple-900/60 hover:bg-purple-800 border border-purple-500/40 text-purple-200 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Wifi className="w-3.5 h-3.5" />
                {testResult?.loading ? 'Pinging & Printing...' : 'Test Connection & Print Slip'}
              </button>
              
              <div className="text-[11px] text-slate-400">
                Subnet: <span className="font-mono text-purple-300">192.168.1.x</span>
              </div>
            </div>

            {/* Test Connection Result */}
            {testResult && !testResult.loading && (
              <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                )}
                <div className="font-mono text-[11px] leading-tight">
                  {testResult.message}
                </div>
              </div>
            )}
          </div>

          {/* PRINTER 2: POSIFLEX PP-8800U-B (Counter / Cashier USB) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧾</span>
                <div>
                  <div className="font-black text-sm text-amber-300 flex items-center gap-2">
                    POSIFLEX PP-8800U-B (Cashier & Billing Printer)
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                      USB Connected
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">Prints 80mm tax invoices & customer receipts at counter</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold">
                <ShieldCheck className="w-4 h-4" /> Ready for Print
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
