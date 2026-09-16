import React, { useState, useEffect, useRef } from 'react';
import { useOrder } from '../context/OrderContext';
import { 
  Scan, 
  QrCode, 
  Search, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  Crown, 
  Users, 
  UserCheck, 
  Camera, 
  Shield, 
  X,
  FileSpreadsheet,
  Calendar,
  Clock,
  Phone
} from 'lucide-react';

export default function MemberEntryScannerPanel() {
  const { 
    members, 
    recordMemberVisit, 
    entryLogs, 
    fetchEntryLogs 
  } = useOrder();

  const [scanInputCode, setScanInputCode] = useState('');
  const [scannedMemberResult, setScannedMemberResult] = useState(null);
  const [scanErrorMsg, setScanErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);

  const scannerInputRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    fetchEntryLogs();
  }, []);

  // Auto-focus input on page load for hardware USB scanners
  useEffect(() => {
    if (scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  }, []);

  // Handle WebCam Video Stream
  useEffect(() => {
    let stream = null;
    if (isCameraActive) {
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch((err) => {
          console.warn("Camera access failed:", err);
          setScanErrorMsg("Camera access denied or unavailable. Use USB hardware scanner or manual input below.");
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isCameraActive]);

  const handleScannerSubmit = async (e) => {
    e?.preventDefault();
    const queryCode = scanInputCode.trim();
    if (!queryCode) return;

    setScanErrorMsg('');
    setScannedMemberResult(null);

    // Look up member in loaded directory by code, phone, or id
    const found = members.find(
      (m) => m.member_code.toLowerCase() === queryCode.toLowerCase() || m.phone === queryCode
    );

    if (found) {
      const success = await recordMemberVisit(found.id);
      if (success) {
        const updatedCount = found.visit_count + 1;
        setScannedMemberResult({ ...found, visit_count: updatedCount, entry_time: new Date().toISOString() });
        setScanInputCode('');
      } else {
        setScanErrorMsg("Failed to record entry visit. Server connection issue.");
      }
    } else {
      setScanErrorMsg(`Member QR Code "${queryCode}" not found in database!`);
      setScanInputCode('');
    }

    if (scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  };

  // Download Entry Audit Logs as CSV File
  const handleDownloadCSV = () => {
    if (entryLogs.length === 0) {
      alert("No entry logs available to download yet.");
      return;
    }

    const headers = ["Log ID", "Entry Time", "Member Code", "Customer Name", "Phone", "Card Status", "Total Visits"];
    const rows = entryLogs.map(log => [
      log.id,
      new Date(log.entry_time).toLocaleString(),
      `"${log.member_code}"`,
      `"${log.name}"`,
      `"${log.phone}"`,
      log.status,
      log.visit_count
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().slice(0,10);
    link.setAttribute("download", `Bermuda_Pub_Member_Entry_Logs_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter logs by search query
  const filteredLogs = entryLogs.filter(log => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.name.toLowerCase().includes(q) ||
      log.member_code.toLowerCase().includes(q) ||
      log.phone.includes(q)
    );
  });

  const totalEntries = entryLogs.length;
  const vipEntries = entryLogs.filter(l => l.status === 'VIP').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Scan className="w-3.5 h-3.5 text-emerald-400" /> Door Entrance Terminal
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 mt-2 flex items-center gap-2">
              <Scan className="w-7 h-7 text-emerald-400" />
              Member QR Entrance & Audit Logs
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Scan VIP member QR codes upon arrival, record entrance visits & download entry audit reports
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={handleDownloadCSV}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-3 rounded-xl shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition flex items-center gap-2 text-xs sm:text-sm"
            >
              <Download className="w-5 h-5 stroke-[2.5]" /> 📥 Download Entry Logs (CSV)
            </button>
          </div>
        </div>
      </div>

      {/* HARDWARE MACHINE QR SCANNER CARD */}
      <div className="bg-slate-900/90 border-2 border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Scan className="w-6 h-6 text-emerald-400" />
            <div>
              <h2 className="text-base font-black text-slate-100">Pub Entrance QR Reader Machine</h2>
              <p className="text-xs text-slate-400">Point USB handheld scanner here or type member code</p>
            </div>
          </div>

          <button
            onClick={() => setIsCameraActive(!isCameraActive)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-bold transition flex items-center gap-2 self-start sm:self-auto"
          >
            <Camera className="w-4 h-4" /> {isCameraActive ? 'Stop Camera WebScan' : 'Turn On Camera WebScan'}
          </button>
        </div>

        {/* Scanner Barcode / Code Form */}
        <form onSubmit={handleScannerSubmit} className="space-y-3">
          <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider">
            Hardware Scanner Code Input / Barcode QR:
          </label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <QrCode className="w-5 h-5 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={scannerInputRef}
                type="text"
                value={scanInputCode}
                onChange={(e) => setScanInputCode(e.target.value)}
                placeholder="Scan QR card code here (e.g. BMC-2896)..."
                className="w-full bg-slate-950 border-2 border-emerald-500/50 rounded-xl pl-11 pr-4 py-3 text-slate-100 text-sm font-mono font-bold focus:outline-none focus:border-emerald-400 shadow-inner"
              />
            </div>
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3 rounded-xl text-xs sm:text-sm transition shrink-0 shadow-lg shadow-emerald-500/20"
            >
              Verify Entry
            </button>
          </div>
        </form>

        {/* Live Camera View Stream */}
        {isCameraActive && (
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video max-w-md mx-auto flex items-center justify-center shadow-2xl">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-0 border-2 border-dashed border-emerald-400/70 rounded-2xl pointer-events-none flex items-center justify-center">
              <span className="text-xs font-black text-emerald-300 bg-slate-950/85 px-3 py-1 rounded-full border border-emerald-400/50 shadow-lg">
                Hold VIP Card QR Code in Front of Camera
              </span>
            </div>
          </div>
        )}

        {/* Live Confirmation Alert Box */}
        {scannedMemberResult && (
          <div className="bg-emerald-950/90 border-2 border-emerald-400 p-5 rounded-2xl space-y-2 animate-in fade-in slide-in-from-top-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-300 uppercase tracking-widest flex items-center gap-1.5">
                <CheckCircle className="w-5 h-5 text-emerald-400" /> 🟢 MEMBER ENTRY CONFIRMED
              </span>
              <span className="text-xs font-mono text-emerald-300 font-black px-3 py-1 rounded-lg bg-emerald-900/80 border border-emerald-500/40">
                {scannedMemberResult.member_code}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="text-xl font-black text-slate-100 flex items-center gap-2">
                  <span>{scannedMemberResult.name}</span>
                  {scannedMemberResult.status === 'VIP' && (
                    <span className="text-[10px] bg-purple-500/20 border border-purple-500/30 text-purple-300 font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Crown className="w-3 h-3 text-purple-400" /> VIP
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">Ph: {scannedMemberResult.phone}</div>
              </div>

              <div className="text-right">
                <div className="text-3xl font-black text-amber-400">{scannedMemberResult.visit_count}</div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Total Entry Visits</div>
              </div>
            </div>
          </div>
        )}

        {scanErrorMsg && (
          <div className="bg-rose-950/90 border border-rose-500/50 p-4 rounded-2xl text-xs text-rose-300 font-bold flex items-center gap-2 shadow-lg">
            <Shield className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{scanErrorMsg}</span>
          </div>
        )}
      </div>

      {/* QUICK LOG STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-md">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Scanned Entries</div>
            <div className="text-2xl font-black text-slate-100">{totalEntries}</div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-md">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">VIP Customer Entrances</div>
            <div className="text-2xl font-black text-purple-300">{vipEntries}</div>
          </div>
        </div>
      </div>

      {/* AUDIT LOGS SEARCH & DOWNLOAD TOOLBAR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs by Name, Phone or Code..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={fetchEntryLogs}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" /> Refresh Logs
          </button>
          <button
            onClick={handleDownloadCSV}
            className="bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/40 text-xs font-extrabold px-4 py-2 rounded-xl transition flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* ENTRY AUDIT LOGS TABLE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-black tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Entry Date & Time</th>
                <th className="py-3.5 px-4">Member Code</th>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Phone Number</th>
                <th className="py-3.5 px-4">Card Status</th>
                <th className="py-3.5 px-4 text-center">Visit Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-500">
                    <Scan className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No customer entry audit logs found. Scan a member card to record an entrance!
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        {new Date(log.entry_time).toLocaleString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-black text-amber-400">
                      {log.member_code}
                    </td>

                    <td className="py-3.5 px-4 font-extrabold text-slate-100">
                      <div className="flex items-center gap-2">
                        <span>{log.name}</span>
                        {log.status === 'VIP' && (
                          <span className="text-[9px] bg-purple-500/20 border border-purple-500/30 text-purple-300 font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Crown className="w-3 h-3 text-purple-400" /> VIP
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {log.phone}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                        log.status === 'VIP' 
                          ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' 
                          : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      }`}>
                        {log.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-xs font-mono font-black text-amber-400">
                        Visit #{log.visit_count}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
