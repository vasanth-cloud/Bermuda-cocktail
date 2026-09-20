import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import { 
  QrCode, 
  Plus, 
  CheckCircle, 
  Edit2, 
  Trash2, 
  Layers, 
  Sparkles,
  X
} from 'lucide-react';

export default function PubLayoutPanel() {
  const { 
    tables, 
    zones, 
    addPubTable, 
    updatePubTable, 
    deletePubTable, 
    allOrders 
  } = useOrder();

  const [adminTableZoneFilter, setAdminTableZoneFilter] = useState('ALL');
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);
  const [newTableData, setNewTableData] = useState({
    table_number: '',
    zone_id: zones[0]?.id || 1,
    capacity: 4,
    current_status: 'VACANT'
  });
  const [editingTable, setEditingTable] = useState(null);
  const [editingTableData, setEditingTableData] = useState({
    table_number: '',
    zone_id: 1,
    capacity: 4,
    current_status: 'VACANT'
  });
  const [tableError, setTableError] = useState('');
  const [tableSuccess, setTableSuccess] = useState('');

  const getTableStatusStyle = (table) => {
    const activeOrder = (allOrders || []).find(o => o.table_id === table.id && o.status !== 'BILLED');
    
    if (!activeOrder && (table.current_status === 'VACANT' || !table.current_status)) {
      return {
        label: 'VACANT',
        badgeClass: 'bg-white text-slate-950 font-black shadow border border-slate-300'
      };
    }

    if (activeOrder) {
      if (activeOrder.status === 'BILLED' || activeOrder.payment_status === 'COLLECTED') {
        return {
          label: 'PAID TABLE',
          badgeClass: 'bg-amber-400 text-slate-950 font-black shadow border border-amber-300'
        };
      }
      
      const allItemsReadyOrServed = activeOrder.items && activeOrder.items.length > 0 &&
        activeOrder.items.every(it => it.status === 'READY' || it.status === 'SERVED');

      if (allItemsReadyOrServed || activeOrder.status === 'SERVED' || activeOrder.status === 'PRINTED') {
        return {
          label: 'PRINTED / FINISHED',
          badgeClass: 'bg-emerald-500 text-slate-950 font-black shadow border border-emerald-400'
        };
      }

      return {
        label: 'RUNNING TABLE',
        badgeClass: 'bg-blue-600 text-white font-black shadow border border-blue-400'
      };
    }

    if (table.current_status === 'BILLED' || table.current_status === 'PAID') {
      return {
        label: 'PAID TABLE',
        badgeClass: 'bg-amber-400 text-slate-950 font-black shadow border border-amber-300'
      };
    }

    if (table.current_status === 'PRINTED' || table.current_status === 'FINISHED' || table.current_status === 'SERVED') {
      return {
        label: 'PRINTED / FINISHED',
        badgeClass: 'bg-emerald-500 text-slate-950 font-black shadow border border-emerald-400'
      };
    }

    if (table.current_status === 'OCCUPIED' || table.current_status === 'RUNNING') {
      return {
        label: 'RUNNING TABLE',
        badgeClass: 'bg-blue-600 text-white font-black shadow border border-blue-400'
      };
    }

    return {
      label: 'VACANT',
      badgeClass: 'bg-white text-slate-950 font-black shadow border border-slate-300'
    };
  };

  const handleCreatePubTable = async (e) => {
    e.preventDefault();
    if (!newTableData.table_number) {
      setTableError('Table number is required');
      return;
    }

    setTableError('');
    setTableSuccess('');
    const result = await addPubTable({
      ...newTableData,
      zone_id: Number(newTableData.zone_id),
      capacity: Number(newTableData.capacity)
    });

    if (result.success) {
      setTableSuccess(`Table ${newTableData.table_number.toUpperCase()} created successfully!`);
      setNewTableData({ table_number: '', zone_id: zones[0]?.id || 1, capacity: 4, current_status: 'VACANT' });
      setIsCreateTableOpen(false);
    } else {
      setTableError(result.error || 'Failed to create table');
    }
  };

  const handleOpenEditTable = (table) => {
    setEditingTable(table);
    setEditingTableData({
      table_number: table.table_number,
      zone_id: table.zone_id,
      capacity: table.capacity,
      current_status: table.current_status || 'VACANT'
    });
  };

  const handleSaveEditPubTable = async (e) => {
    e.preventDefault();
    if (!editingTableData.table_number) {
      alert('Table number is required');
      return;
    }

    const result = await updatePubTable(editingTable.id, {
      ...editingTableData,
      zone_id: Number(editingTableData.zone_id),
      capacity: Number(editingTableData.capacity)
    });

    if (result.success) {
      setTableSuccess(`Updated Table ${editingTableData.table_number.toUpperCase()}!`);
      setEditingTable(null);
    } else {
      alert(result.error || 'Failed to update table');
    }
  };

  const handleDeletePubTableItem = async (table) => {
    if (window.confirm(`Are you sure you want to delete Table "${table.table_number}"?`)) {
      await deletePubTable(table.id);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 p-6 shadow-xl">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-45 pointer-events-none"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1600&q=80')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg">
              <Layers className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                Pub Tables Layout Management
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> {tables.length} TABLES
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Manage Pub Rounding (C1-C10), Dining (DN-1..DN-29), and Smoking Zone (SZ-1..SZ-10) tables with live occupancy status.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCreateTableOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2.5 text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 transition whitespace-nowrap z-10"
          >
            <Plus className="w-4 h-4" /> Add New Table
          </button>
        </div>
      </div>

      {tableSuccess && (
        <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center gap-2 shadow">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{tableSuccess}</span>
        </div>
      )}

      {/* Main Container Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setAdminTableZoneFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                adminTableZoneFilter === 'ALL' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Zones ({tables.length})
            </button>
            {zones.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => setAdminTableZoneFilter(z.id.toString())}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  adminTableZoneFilter === z.id.toString() ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {z.display_name}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Live Interactive Grid
          </div>
        </div>

        {/* Legend Indicator Bar */}
        <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <span className="font-extrabold text-slate-400 text-[10px] uppercase tracking-wider">Live Status Key:</span>
          <span className="bg-white text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-full border border-slate-300">⚪ VACANT (White)</span>
          <span className="bg-blue-600 text-white font-black text-[10px] px-2.5 py-1 rounded-full border border-blue-400">🔵 RUNNING TABLE (Blue)</span>
          <span className="bg-emerald-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-full border border-emerald-400">🟢 PRINTED / FINISHED (Green)</span>
          <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-full border border-amber-300">🟡 PAID TABLE (Yellow)</span>
        </div>

        {/* Tables Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {tables
            .filter((t) => adminTableZoneFilter === 'ALL' || t.zone_id === Number(adminTableZoneFilter))
            .sort((a, b) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true, sensitivity: 'base' }))
            .map((t) => {
              const statusStyle = getTableStatusStyle(t);
              return (
                <div key={t.id} className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between hover:border-amber-500/50 transition shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold text-slate-400 font-mono">
                      {t.zone?.prefix || 'TBL'} ({t.capacity}p)
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditTable(t)}
                        className="p-1 text-slate-400 hover:text-amber-400 transition"
                        title="Edit Table"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePubTableItem(t)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition"
                        title="Delete Table"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-center my-1.5">
                    <h4 className="text-xl font-black text-slate-100">{t.table_number}</h4>
                  </div>

                  <div className="mt-2 text-center">
                    <span className={`text-[9px] px-2.5 py-1 rounded-full block uppercase ${statusStyle.badgeClass}`}>
                      {statusStyle.label}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Create Table Modal */}
      {isCreateTableOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" /> Create New Pub Table
              </h3>
              <button
                onClick={() => setIsCreateTableOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {tableError && (
              <div className="bg-rose-950/60 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs">
                {tableError}
              </div>
            )}

            <form onSubmit={handleCreatePubTable} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Table Number (e.g. C1, DN-01, SZ-01) *</label>
                <input
                  type="text"
                  placeholder="e.g. DN-30 or C11"
                  value={newTableData.table_number}
                  onChange={(e) => setNewTableData({ ...newTableData, table_number: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Pub Floor Zone *</label>
                <select
                  value={newTableData.zone_id}
                  onChange={(e) => setNewTableData({ ...newTableData, zone_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none cursor-pointer"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id} className="bg-slate-900 text-slate-200">
                      {z.display_name} ({z.prefix})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Seating Capacity</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={newTableData.capacity}
                  onChange={(e) => setNewTableData({ ...newTableData, capacity: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateTableOpen(false)}
                  className="w-full bg-slate-800 text-slate-300 py-3 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl shadow-lg"
                >
                  Create Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Table Modal */}
      {editingTable && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" /> Edit Table {editingTable.table_number}
              </h3>
              <button
                onClick={() => setEditingTable(null)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditPubTable} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Table Number</label>
                <input
                  type="text"
                  value={editingTableData.table_number}
                  onChange={(e) => setEditingTableData({ ...editingTableData, table_number: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-amber-300 font-bold focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Pub Floor Zone</label>
                <select
                  value={editingTableData.zone_id}
                  onChange={(e) => setEditingTableData({ ...editingTableData, zone_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none cursor-pointer"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id} className="bg-slate-900 text-slate-200">
                      {z.display_name} ({z.prefix})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Status Key Override</label>
                <select
                  value={editingTableData.current_status}
                  onChange={(e) => setEditingTableData({ ...editingTableData, current_status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="VACANT" className="bg-slate-900 text-white">⚪ VACANT (White)</option>
                  <option value="OCCUPIED" className="bg-slate-900 text-blue-300">🔵 RUNNING TABLE (Blue)</option>
                  <option value="PRINTED" className="bg-slate-900 text-emerald-300">🟢 PRINTED / FINISHED (Green)</option>
                  <option value="BILLED" className="bg-slate-900 text-amber-300">🟡 PAID TABLE (Yellow)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="w-full bg-slate-800 text-slate-300 py-3 rounded-xl font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 py-3 rounded-xl font-black shadow-lg"
                >
                  Update Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
