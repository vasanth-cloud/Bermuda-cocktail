import React, { useState, useEffect } from 'react';
import { useOrder } from '../context/OrderContext';
import PaymentAuditLogModal from '../components/PaymentAuditLogModal';
import { LayoutDashboard, QrCode, UploadCloud, RefreshCw, Plus, DollarSign, Database, CheckCircle, Edit2, Save, X, Utensils, Wine, Receipt } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function AdminPanel() {
  const { products, categories, tables, syncStatus, triggerSync, addProduct, updateProductPrice, toggleProductAvailability, paymentLogs, paymentSummary } = useOrder();
  const [selectedTableForQr, setSelectedTableForQr] = useState(tables[0] || null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Local IP state for mobile QR scanning
  const [localIpHost, setLocalIpHost] = useState(window.location.host);

  useEffect(() => {
    fetch('/api/system/ip')
      .then(r => r.json())
      .then(data => {
        if (data.local_ip && data.local_ip !== '127.0.0.1') {
          setLocalIpHost(`${data.local_ip}:${data.default_port || 3000}`);
        }
      })
      .catch(() => {});
  }, []);

  // Add Item Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemData, setNewItemData] = useState({
    name: '',
    category_id: categories[0]?.id || 1,
    price: '',
    target_dept: 'KITCHEN',
    description: ''
  });

  // Price Editing State
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');

  // Auto-sync selectedTableForQr when tables load
  useEffect(() => {
    if (!selectedTableForQr && tables && tables.length > 0) {
      setSelectedTableForQr(tables[0]);
    }
  }, [tables, selectedTableForQr]);

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newItemData.name || !newItemData.price) {
      alert("Please fill in item name and price");
      return;
    }

    const success = await addProduct({
      ...newItemData,
      category_id: Number(newItemData.category_id),
      price: parseFloat(newItemData.price)
    });

    if (success) {
      setIsAddModalOpen(false);
      setNewItemData({
        name: '',
        category_id: categories[0]?.id || 1,
        price: '',
        target_dept: 'KITCHEN',
        description: ''
      });
    }
  };

  const handleSavePrice = async (productId) => {
    if (!editingPriceValue || isNaN(editingPriceValue)) return;
    await updateProductPrice(productId, editingPriceValue);
    setEditingPriceId(null);
  };

  const activeQrUrl = selectedTableForQr?.table_number
    ? (localIpHost.startsWith('http://') || localIpHost.startsWith('https://')
        ? `${localIpHost}/?table=${selectedTableForQr.table_number}`
        : `${window.location.protocol}//${localIpHost}/?table=${selectedTableForQr.table_number}`)
    : (localIpHost.startsWith('http://') || localIpHost.startsWith('https://')
        ? `${localIpHost}/`
        : `${window.location.protocol}//${localIpHost}/`);

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
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                Cloud Admin & Management Dashboard
                <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-mono">
                  ONLINE DASHBOARD
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Master menu configuration, price editing, real QR sticker generator, and offline sync queue.
              </p>
            </div>
          </div>

        {/* Top-Right Controls: Audit Log Button & Offline Sync Status Widget */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-extrabold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md transition"
          >
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span>Audit Logs (₹{paymentSummary.grand_total || 0})</span>
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {paymentLogs.length}
            </span>
          </button>

          <div className="bg-slate-950 p-3 sm:p-4 rounded-xl border border-slate-800 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-xs text-slate-400 font-medium">Pending Cloud Sync</div>
                <div className="text-base font-extrabold text-amber-400">
                  {syncStatus.pending_sync_count} Transactions
                </div>
              </div>
            </div>

            <button
              onClick={triggerSync}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-lg shadow-amber-500/20"
            >
              <UploadCloud className="w-4 h-4" /> Sync Now
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Grid Section: Real QR Code Generator + Menu Master */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real Printable QR Code Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-amber-400" /> Printable QR Generator
              </h3>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Select any table to render a live, scannable QR Code URL for table ordering.
            </p>

            <div className="mb-3">
              <label className="text-xs font-bold text-slate-300 block mb-1">Select Table:</label>
              <select
                value={selectedTableForQr?.id || tables[0]?.id || ''}
                onChange={(e) => {
                  const t = tables.find((tbl) => tbl.id === Number(e.target.value));
                  if (t) setSelectedTableForQr(t);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-amber-300 focus:outline-none cursor-pointer"
              >
                {tables.map((tbl) => (
                  <option key={tbl.id} value={tbl.id} className="bg-slate-900 text-slate-200">
                    Table {tbl.table_number} - {tbl.zone?.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-slate-300 block mb-1">Live Domain / Host URL (for QR Stickers):</label>
              <input
                type="text"
                value={localIpHost}
                onChange={(e) => setLocalIpHost(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none"
                placeholder="thebermudapub.com or 192.168.1.50:3000"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">Enter custom domain (e.g. thebermudapub.com) or local IP for QR code generation.</span>
            </div>

            {/* Live Rendered Scannable QR Sticker Mockup */}
            {selectedTableForQr && (
              <div className="bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-amber-500/40 p-6 rounded-2xl text-center space-y-4 shadow-2xl relative overflow-hidden">
                <div className="text-xs font-black text-amber-400 tracking-widest uppercase">BERMUDA COCKTAIL PUB</div>
                <div className="text-3xl font-black text-slate-100">TABLE {selectedTableForQr.table_number}</div>
                <div className="text-xs text-slate-400 font-mono">{selectedTableForQr.zone?.display_name}</div>

                {/* Real SVG QR Code */}
                <div className="bg-white p-4 rounded-2xl inline-block shadow-inner">
                  <QRCodeSVG
                    value={activeQrUrl}
                    size={160}
                    bgColor={"#FFFFFF"}
                    fgColor={"#0F172A"}
                    level={"H"}
                    includeMargin={false}
                  />
                </div>

                <div className="text-center space-y-1">
                  <p className="text-[11px] text-slate-400 font-mono break-all px-2 bg-slate-950/60 py-1 rounded border border-slate-800">
                    {activeQrUrl}
                  </p>
                  <a
                    href={activeQrUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-[11px] font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 px-3 py-1 rounded-lg border border-amber-500/30 transition mt-1"
                  >
                    🔗 Test Open Table Link
                  </a>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => window.print()}
            className="w-full mt-4 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black py-3 rounded-xl shadow-lg transition flex items-center justify-center gap-2"
          >
            🖨️ Print QR Sticker
          </button>
        </div>

        {/* Master Menu List & Price Editor */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="font-extrabold text-lg text-slate-100">Master Menu & Price Config</h3>
              <p className="text-xs text-slate-400">Set item prices and split destination (`BAR` vs `KITCHEN`).</p>
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
            >
              <Plus className="w-4 h-4" /> Add New Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Item Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Split Routing</th>
                  <th className="p-3">Price (₹)</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-850/50">
                    <td className="p-3 font-mono text-slate-500">#{p.id}</td>
                    <td className="p-3 font-bold text-slate-100">
                      <div>{p.name}</div>
                      {p.description && <div className="text-[10px] text-slate-500 font-normal line-clamp-1">{p.description}</div>}
                    </td>
                    <td className="p-3 text-slate-400">{p.category?.name || 'General'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        p.target_dept === 'BAR' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {p.target_dept}
                      </span>
                    </td>
                    <td className="p-3">
                      {editingPriceId === p.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editingPriceValue}
                            onChange={(e) => setEditingPriceValue(e.target.value)}
                            className="w-20 bg-slate-950 border border-amber-500 rounded px-2 py-1 text-xs text-amber-300 font-bold focus:outline-none"
                          />
                          <button
                            onClick={() => handleSavePrice(p.id)}
                            className="bg-emerald-500 text-slate-950 p-1 rounded hover:bg-emerald-400"
                            title="Save Price"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingPriceId(null)}
                            className="bg-slate-800 text-slate-400 p-1 rounded hover:text-slate-100"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-amber-400 text-sm">₹{p.price}</span>
                          <button
                            onClick={() => {
                              setEditingPriceId(p.id);
                              setEditingPriceValue(p.price.toString());
                            }}
                            className="text-slate-500 hover:text-amber-400 p-1"
                            title="Edit Price"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleProductAvailability(p.id, p.is_available)}
                        className={`text-[10px] font-bold px-2 py-1 rounded transition ${
                          p.is_available ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {p.is_available ? 'Available' : 'Unavailable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add New Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" /> Add New Menu Item
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Item Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Bermuda Spicy Wings, Espresso Martini"
                  value={newItemData.name}
                  onChange={(e) => setNewItemData({ ...newItemData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Category</label>
                  <select
                    value={newItemData.category_id}
                    onChange={(e) => {
                      const catId = Number(e.target.value);
                      const cat = categories.find((c) => c.id === catId);
                      setNewItemData({
                        ...newItemData,
                        category_id: catId,
                        target_dept: cat?.target_dept || newItemData.target_dept
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id} className="bg-slate-900">
                        {cat.name} ({cat.target_dept})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="350"
                    value={newItemData.price}
                    onChange={(e) => setNewItemData({ ...newItemData, price: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Split Routing Destination</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewItemData({ ...newItemData, target_dept: 'BAR' })}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition ${
                      newItemData.target_dept === 'BAR'
                        ? 'bg-purple-950 border-purple-500 text-purple-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Wine className="w-4 h-4" /> Bar (Drinks)
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewItemData({ ...newItemData, target_dept: 'KITCHEN' })}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition ${
                      newItemData.target_dept === 'KITCHEN'
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Utensils className="w-4 h-4" /> Kitchen (Food)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Description (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Ingredients or chef notes..."
                  value={newItemData.description}
                  onChange={(e) => setNewItemData({ ...newItemData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                ></textarea>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-full bg-slate-800 text-slate-300 py-3 rounded-xl font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 py-3 rounded-xl font-black shadow-lg"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top-Right Audit Log Popover Modal */}
      <PaymentAuditLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />
    </div>
  );
}
