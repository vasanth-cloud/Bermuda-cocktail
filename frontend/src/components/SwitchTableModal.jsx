import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import { 
  ArrowRightLeft, 
  X, 
  Check, 
  Printer, 
  AlertCircle, 
  Users, 
  Sparkles,
  MapPin,
  CheckCircle2
} from 'lucide-react';

export default function SwitchTableModal({ isOpen, onClose, activeOrder, onSwitchSuccess }) {
  const { tables, zones, switchOrderTable, currentUser, staffUsers } = useOrder();

  const [selectedDestinationTableId, setSelectedDestinationTableId] = useState(null);
  const [waiterName, setWaiterName] = useState(currentUser?.name || activeOrder?.waiter_name || 'Staff');
  const [autoPrintSlip, setAutoPrintSlip] = useState(true);
  const [zoneFilter, setZoneFilter] = useState('VACANT_ONLY'); // VACANT_ONLY, ALL, or zoneId
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !activeOrder) return null;

  const currentTableId = activeOrder.table_id || activeOrder.table?.id;
  const currentTableNumber = activeOrder.table?.table_number || 'T-01';
  const currentZoneName = activeOrder.table?.zone?.display_name || '';

  // Get eligible destination tables (exclude current table)
  const candidateTables = tables.filter(t => t.id !== currentTableId);

  const displayedTables = candidateTables.filter(t => {
    if (zoneFilter === 'VACANT_ONLY') {
      return t.current_status === 'VACANT' || !t.current_status;
    }
    if (zoneFilter === 'ALL') return true;
    return t.zone_id === zoneFilter;
  });

  const selectedTableObj = tables.find(t => t.id === selectedDestinationTableId);

  const handleConfirmSwitch = async (e) => {
    e.preventDefault();
    if (!selectedDestinationTableId) {
      setErrorMsg('Please select a destination table from the list below.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const res = await switchOrderTable(
      activeOrder.id,
      selectedDestinationTableId,
      waiterName || currentUser?.name || 'Staff',
      autoPrintSlip
    );

    setIsSubmitting(false);

    if (res.success) {
      if (onSwitchSuccess) {
        onSwitchSuccess(res);
      }
      onClose();
    } else {
      setErrorMsg(res.error || 'Failed to switch table. Please try again.');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <ArrowRightLeft className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
                Switch Table / Transfer Order
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                  MOVE GUESTS
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Move active order items to another table and alert Kitchen & Bar.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          {/* Error Banner */}
          {errorMsg && (
            <div className="bg-rose-950/80 border border-rose-500/50 text-rose-300 p-3 rounded-xl flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Current Table vs Destination Visual Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {/* Source (Current Table) */}
              <div className="bg-slate-900 border border-slate-700/80 p-3.5 rounded-xl space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Current Table
                </span>
                <div className="text-lg font-black text-slate-100 flex items-center gap-2">
                  <span>Table {currentTableNumber}</span>
                  {currentZoneName && (
                    <span className="text-[11px] font-medium text-amber-400 font-mono">
                      ({currentZoneName})
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-300 flex items-center gap-2 font-mono">
                  <span>#{activeOrder.order_number}</span>
                  <span>•</span>
                  <span className="text-amber-400 font-bold">₹{activeOrder.total_amount || 0}</span>
                  <span>•</span>
                  <span>{activeOrder.items?.length || 0} items</span>
                </div>
              </div>

              {/* Destination (New Table) */}
              <div className={`p-3.5 rounded-xl space-y-1 border-2 transition-all ${
                selectedTableObj
                  ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-900/60 border-dashed border-slate-700 text-slate-400'
              }`}>
                <span className="text-[10px] font-black uppercase tracking-wider block text-amber-400">
                  New Destination Table
                </span>
                {selectedTableObj ? (
                  <div>
                    <div className="text-lg font-black text-amber-300 flex items-center gap-2">
                      <span>Table {selectedTableObj.table_number}</span>
                      <span className="text-[11px] font-medium text-amber-200 font-mono">
                        ({selectedTableObj.zone?.display_name || 'Floor'})
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ready to receive order</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic py-1">
                    Select a table below to transfer...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table Filter Tabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-slate-200 block text-xs">
                Select New Table:
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {displayedTables.length} tables shown
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setZoneFilter('VACANT_ONLY')}
                className={`px-3 py-1.5 rounded-xl font-bold transition text-xs ${
                  zoneFilter === 'VACANT_ONLY'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                🟢 Available Vacant Only
              </button>

              <button
                type="button"
                onClick={() => setZoneFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl font-bold transition text-xs ${
                  zoneFilter === 'ALL'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                ✨ All Tables
              </button>

              {zones.map(z => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setZoneFilter(z.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition text-xs ${
                    zoneFilter === z.id
                      ? 'bg-blue-600 text-white shadow-md font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {z.display_name}
                </button>
              ))}
            </div>
          </div>

          {/* Table Selection Grid */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 max-h-56 overflow-y-auto">
            {displayedTables.length === 0 ? (
              <div className="text-center text-slate-500 py-8 italic">
                No matching destination tables found for this filter.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {displayedTables.map((t) => {
                  const isSelected = t.id === selectedDestinationTableId;
                  const isVacant = t.current_status === 'VACANT' || !t.current_status;

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedDestinationTableId(t.id)}
                      className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg font-black scale-105'
                          : isVacant
                            ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-200 hover:border-amber-400/50'
                            : 'bg-rose-950/20 border-rose-800/40 text-rose-300 opacity-70'
                      }`}
                    >
                      <span className="text-sm font-black tracking-tight">
                        {t.table_number}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected
                          ? 'bg-slate-950 text-amber-300'
                          : isVacant
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                            : 'bg-rose-950 text-rose-400'
                      }`}>
                        {isVacant ? 'FREE' : 'OCCUPIED'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Waiter & Slip Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-300 block mb-1">
                Handled By (Waiter Name):
              </label>
              <input
                type="text"
                value={waiterName}
                onChange={(e) => setWaiterName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-bold focus:outline-none focus:border-amber-500"
                placeholder="e.g. Ajaykumar"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label 
                className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer select-none hover:border-slate-700 transition"
              >
                <input
                  type="checkbox"
                  checked={autoPrintSlip}
                  onChange={(e) => setAutoPrintSlip(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 focus:outline-none cursor-pointer"
                />
                <div className="text-left">
                  <div className="font-extrabold text-amber-400 flex items-center gap-1.5 text-xs">
                    <Printer className="w-3.5 h-3.5" />
                    <span>Auto-Print Transfer Slip</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Kitchen KOT (Rugtek) & Bar BOT (Posiflex)
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-bold text-slate-400 hover:text-slate-200 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!selectedDestinationTableId || isSubmitting}
            onClick={handleConfirmSwitch}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-95"
          >
            {isSubmitting ? (
              <span>Moving Table...</span>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4 stroke-[2.5]" />
                <span>
                  Confirm Move {selectedTableObj ? `to Table ${selectedTableObj.table_number}` : ''}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

