import React, { useState, useEffect } from 'react';
import { useOrder } from '../context/OrderContext';
import PaymentAuditLogModal from '../components/PaymentAuditLogModal';
import { 
  LayoutDashboard, 
  QrCode, 
  UploadCloud, 
  RefreshCw, 
  Plus, 
  DollarSign, 
  Database, 
  CheckCircle, 
  Edit2, 
  Save, 
  X, 
  Utensils, 
  Wine, 
  Receipt,
  UserPlus,
  Users,
  Trash2,
  Shield,
  Mail,
  Lock,
  User,
  Crown,
  CreditCard,
  Phone,
  FileText,
  MapPin,
  Award,
  Sparkles,
  Search
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function AdminPanel() {
  const { 
    products, 
    categories, 
    tables,
    zones,
    addPubTable,
    updatePubTable,
    deletePubTable,
    allOrders,
    syncStatus, 
    triggerSync, 
    addProduct, 
    updateProduct,
    updateProductPrice, 
    deleteProduct,
    toggleProductAvailability, 
    paymentLogs, 
    paymentSummary,
    staffUsers,
    fetchStaffUsers,
    createStaffAccount,
    updateStaffAccount,
    deleteStaffAccount,
    currentUser,
    members,
    fetchMembers,
    createMember,
    updateMember,
    deleteMember,
    recordMemberVisit
  } = useOrder();

  const ALL_TERMINALS = [
    { id: 'customer', label: 'Customer Menu', desc: 'Digital QR Ordering' },
    { id: 'entry_scanner', label: 'Member QR Scanner', desc: 'Entrance Scan & Audit Logs' },
    { id: 'bar', label: 'Bar & Kitchen KDS', desc: 'Drinks, Food & Reception Billing' },
    { id: 'staff', label: 'Waiter Staff', desc: 'Floor Tables & Pickup Alerts' },
    { id: 'members', label: 'VIP Member Cards', desc: 'Bermuda VIP Cards & Directory' },
    { id: 'admin', label: 'Cloud Admin', desc: 'Master Menu & Staff Accounts' }
  ];

  const [selectedTableForQr, setSelectedTableForQr] = useState(tables[0] || null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Local IP state for mobile QR scanning
  const [localIpHost, setLocalIpHost] = useState(window.location.host);

  // Staff Account Management State
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'WAITER',
    allowed_terminals: ['customer', 'staff']
  });

  const [editingUser, setEditingUser] = useState(null);
  const [editingUserData, setEditingUserData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'WAITER',
    allowed_terminals: ['customer', 'staff']
  });

  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Member Card Management State
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isCreateMemberOpen, setIsCreateMemberOpen] = useState(false);
  const [newMemberData, setNewMemberData] = useState({
    name: '',
    phone: '',
    aadhar_number: '',
    email: '',
    address: '',
    status: 'ACTIVE'
  });
  const [memberError, setMemberError] = useState('');
  const [memberSuccess, setMemberSuccess] = useState('');
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);

  // Edit Member Modal State
  const [editingMember, setEditingMember] = useState(null);
  const [editingMemberData, setEditingMemberData] = useState({
    name: '',
    phone: '',
    aadhar_number: '',
    email: '',
    address: '',
    status: 'ACTIVE'
  });

  // Digital Member VIP Card Modal State
  const [cardPreviewMember, setCardPreviewMember] = useState(null);

  // Pub Table Layout Management State
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
        badgeClass: 'bg-white text-slate-950 font-black shadow border border-slate-300',
        colorName: 'white'
      };
    }

    if (activeOrder) {
      if (activeOrder.status === 'BILLED' || activeOrder.payment_status === 'COLLECTED') {
        return {
          label: 'PAID TABLE',
          badgeClass: 'bg-amber-400 text-slate-950 font-black shadow border border-amber-300',
          colorName: 'yellow'
        };
      }
      
      const allItemsReadyOrServed = activeOrder.items && activeOrder.items.length > 0 &&
        activeOrder.items.every(it => it.status === 'READY' || it.status === 'SERVED');

      if (allItemsReadyOrServed || activeOrder.status === 'SERVED' || activeOrder.status === 'PRINTED') {
        return {
          label: 'PRINTED / FINISHED',
          badgeClass: 'bg-emerald-500 text-slate-950 font-black shadow border border-emerald-400',
          colorName: 'green'
        };
      }

      return {
        label: 'RUNNING TABLE',
        badgeClass: 'bg-blue-600 text-white font-black shadow border border-blue-400',
        colorName: 'blue'
      };
    }

    if (table.current_status === 'BILLED' || table.current_status === 'PAID') {
      return {
        label: 'PAID TABLE',
        badgeClass: 'bg-amber-400 text-slate-950 font-black shadow border border-amber-300',
        colorName: 'yellow'
      };
    }

    if (table.current_status === 'PRINTED' || table.current_status === 'FINISHED' || table.current_status === 'SERVED') {
      return {
        label: 'PRINTED / FINISHED',
        badgeClass: 'bg-emerald-500 text-slate-950 font-black shadow border border-emerald-400',
        colorName: 'green'
      };
    }

    if (table.current_status === 'OCCUPIED' || table.current_status === 'RUNNING') {
      return {
        label: 'RUNNING TABLE',
        badgeClass: 'bg-blue-600 text-white font-black shadow border border-blue-400',
        colorName: 'blue'
      };
    }

    return {
      label: 'VACANT',
      badgeClass: 'bg-white text-slate-950 font-black shadow border border-slate-300',
      colorName: 'white'
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

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingProductData, setEditingProductData] = useState({
    name: '',
    category_id: 1,
    price: '',
    target_dept: 'KITCHEN',
    description: '',
    is_available: true
  });

  useEffect(() => {
    fetch('/api/system/ip')
      .then(r => r.json())
      .then(data => {
        if (data.local_ip && data.local_ip !== '127.0.0.1') {
          setLocalIpHost(`${data.local_ip}:${data.default_port || 3000}`);
        }
      })
      .catch(() => {});

    // Load staff accounts & member cards
    fetchStaffUsers();
    fetchMembers();
  }, []);

  const handleSearchMembers = (query) => {
    setMemberSearchQuery(query);
    fetchMembers(query);
  };

  const handleCreateMemberSubmit = async (e) => {
    e.preventDefault();
    if (!newMemberData.name || !newMemberData.phone) {
      setMemberError("Name and Phone number are required");
      return;
    }

    setIsSubmittingMember(true);
    setMemberError('');
    setMemberSuccess('');

    const res = await createMember({
      ...newMemberData
    });

    setIsSubmittingMember(false);
    if (res.success) {
      setMemberSuccess(`Created Bermuda VIP Member Card for ${res.member.name} (${res.member.member_code})!`);
      setNewMemberData({
        name: '',
        phone: '',
        aadhar_number: '',
        email: '',
        address: '',
        status: 'ACTIVE'
      });
      setIsCreateMemberOpen(false);
    } else {
      setMemberError(res.error || "Failed to create member card");
    }
  };

  const handleOpenEditMember = (member) => {
    setEditingMember(member);
    setEditingMemberData({
      name: member.name,
      phone: member.phone,
      aadhar_number: member.aadhar_number || '',
      email: member.email || '',
      address: member.address || '',
      status: member.status || 'ACTIVE'
    });
  };

  const handleSaveMemberEdit = async (e) => {
    e.preventDefault();
    if (!editingMemberData.name || !editingMemberData.phone) {
      alert("Name and Phone number are required");
      return;
    }

    const success = await updateMember(editingMember.id, {
      ...editingMemberData
    });

    if (success) {
      setEditingMember(null);
    }
  };

  const handleDeleteMemberItem = async (member) => {
    if (window.confirm(`Are you sure you want to delete member card for "${member.name}" (${member.member_code})?`)) {
      await deleteMember(member.id);
    }
  };

  const handleRecordVisit = async (member) => {
    await recordMemberVisit(member.id);
  };

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

  const handleOpenEditModal = (item) => {
    setEditingProduct(item);
    setEditingProductData({
      name: item.name,
      category_id: item.category_id,
      price: item.price,
      target_dept: item.target_dept || 'KITCHEN',
      description: item.description || '',
      is_available: item.is_available ?? true
    });
  };

  const handleSaveProductEdit = async (e) => {
    e.preventDefault();
    if (!editingProductData.name || !editingProductData.price) {
      alert("Please fill in item name and price");
      return;
    }

    const success = await updateProduct(editingProduct.id, {
      ...editingProductData,
      category_id: Number(editingProductData.category_id),
      price: parseFloat(editingProductData.price),
      is_available: Boolean(editingProductData.is_available)
    });

    if (success) {
      setEditingProduct(null);
    }
  };

  const handleDeleteProductItem = async (item) => {
    if (window.confirm(`Are you sure you want to delete product "${item.name}"?`)) {
      await deleteProduct(item.id);
    }
  };

  const handleSavePrice = async (productId) => {
    if (!editingPriceValue || isNaN(editingPriceValue)) return;
    await updateProductPrice(productId, editingPriceValue);
    setEditingPriceId(null);
  };

  const handleCreateStaffUser = async (e) => {
    e.preventDefault();
    if (!newUserData.name || !newUserData.email || !newUserData.password) {
      setUserError('Please fill in name, email, and password');
      return;
    }

    const terms = newUserData.allowed_terminals || [];
    const autoRole = terms.includes('admin') ? 'ADMIN' : 'WAITER';

    setIsSubmittingUser(true);
    setUserError('');
    setUserSuccess('');
    const result = await createStaffAccount({
      ...newUserData,
      role: autoRole,
      allowed_terminals: terms.join(',')
    });
    setIsSubmittingUser(false);

    if (result.success) {
      setUserSuccess(`Created account for ${newUserData.name}!`);
      setNewUserData({ name: '', email: '', password: '', role: 'WAITER', allowed_terminals: ['customer', 'staff'] });
      setIsCreateUserOpen(false);
    } else {
      setUserError(result.error || 'Failed to create user account');
    }
  };

  const handleOpenEditUser = (user) => {
    setEditingUser(user);
    const terminals = user.allowed_terminals
      ? user.allowed_terminals.split(',').map(s => s.trim()).filter(Boolean)
      : ['customer', 'staff'];
    setEditingUserData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role || 'WAITER',
      allowed_terminals: terminals
    });
  };

  const handleSaveEditUser = async (e) => {
    e.preventDefault();
    if (!editingUserData.name || !editingUserData.email) {
      alert('Name and Email are required');
      return;
    }

    const terms = editingUserData.allowed_terminals || [];
    const autoRole = terms.includes('admin') ? 'ADMIN' : 'WAITER';

    setIsSubmittingUser(true);
    const payload = {
      name: editingUserData.name,
      email: editingUserData.email,
      role: autoRole,
      allowed_terminals: terms.join(',')
    };
    if (editingUserData.password && editingUserData.password.trim()) {
      payload.password = editingUserData.password.trim();
    }

    const result = await updateStaffAccount(editingUser.id, payload);
    setIsSubmittingUser(false);

    if (result.success) {
      setUserSuccess(`Updated account for ${editingUserData.name}!`);
      setEditingUser(null);
    } else {
      alert(result.error || 'Failed to update user account');
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.email === 'avasanth081@gmail.com') {
      alert('Master Admin account cannot be deleted.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete user account "${user.name}" (${user.email})?`)) {
      await deleteStaffAccount(user.id);
    }
  };

  const activeQrUrl = selectedTableForQr?.table_number
    ? (localIpHost.startsWith('http://') || localIpHost.startsWith('https://')
        ? `${localIpHost}/?table=${selectedTableForQr.table_number}`
        : `${window.location.protocol}//${localIpHost}/?table=${selectedTableForQr.table_number}`)
    : (localIpHost.startsWith('http://') || localIpHost.startsWith('https://')
        ? `${localIpHost}/`
        : `${window.location.protocol}//${localIpHost}/`);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><Crown className="w-3 h-3 text-amber-400" /> Admin</span>;
      case 'WAITER':
        return <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><Users className="w-3 h-3 text-blue-400" /> Waiter</span>;
      case 'BAR_KITCHEN':
      case 'BAR_RECEPTION':
      case 'KITCHEN_CHEF':
        return <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><Wine className="w-3 h-3 text-purple-400" /> Bar & Kitchen</span>;
    }
  };

  // Access Control Guard: Only Master Admin (ADMIN role) can view Admin Panel
  if (currentUser?.role !== 'ADMIN') {
    return (
      <div className="w-full px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto text-2xl font-black shadow-xl">
          🔒
        </div>
        <h2 className="text-xl font-black text-slate-100">Cloud Admin Access Restricted</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          You are signed in as <span className="text-amber-400 font-bold">{currentUser?.name || 'Staff User'}</span> ({currentUser?.email}). Only the Master Admin (<span className="text-amber-300 font-mono">avasanth081@gmail.com</span>) can access menu configuration, QR sticker generation, and staff account management.
        </p>
      </div>
    );
  }

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
                Master menu configuration, staff user controls, printable table QR generator, and audit logs.
              </p>
            </div>
          </div>

        {/* Top-Right Controls: Audit Log Button */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md transition"
          >
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span>Audit Logs (₹{paymentSummary.grand_total || 0})</span>
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {paymentLogs.length}
            </span>
          </button>
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
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider">
                <tr>
                  <th className="p-3 rounded-l-xl">Item Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Route Dept</th>
                  <th className="p-3">Price (₹)</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {products.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/50 transition">
                    <td className="p-3 font-bold text-slate-100 flex items-center gap-2">
                      {item.name}
                    </td>

                    <td className="p-3 text-slate-400">
                      {categories.find(c => c.id === item.category_id)?.name || 'General'}
                    </td>

                    <td className="p-3">
                      {item.target_dept === 'BAR' ? (
                        <span className="bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-md font-extrabold text-[10px] flex items-center gap-1 w-fit">
                          <Wine className="w-3 h-3" /> BAR
                        </span>
                      ) : (
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-md font-extrabold text-[10px] flex items-center gap-1 w-fit">
                          <Utensils className="w-3 h-3" /> KITCHEN
                        </span>
                      )}
                    </td>

                    <td className="p-3 font-mono font-bold text-amber-400">
                      {editingPriceId === item.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editingPriceValue}
                            onChange={(e) => setEditingPriceValue(e.target.value)}
                            className="w-20 bg-slate-950 border border-amber-500 rounded px-1.5 py-0.5 text-xs text-amber-300 font-bold focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSavePrice(item.id)}
                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500"
                            title="Save Price"
                          >
                            <Save className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setEditingPriceId(null)}
                            className="p-1 bg-slate-800 text-slate-400 rounded hover:text-slate-200"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <span>₹{item.price}</span>
                          <button
                            onClick={() => {
                              setEditingPriceId(item.id);
                              setEditingPriceValue(item.price);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition text-slate-400 hover:text-amber-400"
                            title="Edit Price Quick"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <button
                        onClick={() => toggleProductAvailability(item.id, !item.is_available)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold transition ${
                          item.is_available
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30'
                        }`}
                      >
                        {item.is_available ? 'Available' : 'Sold Out'}
                      </button>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg transition"
                          title="Edit Item Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProductItem(item)}
                          className="p-1.5 bg-rose-950/40 hover:bg-rose-900 border border-rose-500/30 text-rose-300 rounded-lg transition"
                          title="Delete Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pub Tables Layout Management Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="font-black text-xl text-slate-100 flex items-center gap-2">
              <QrCode className="w-6 h-6 text-amber-400" /> Pub Tables Layout Management ({tables.length} Tables)
            </h3>
            <p className="text-xs text-slate-400">
              Manage Pub Rounding (C1-C10), Dining (DN-1..DN-29), and Smoking Zone (SZ-1..SZ-10) tables with live occupancy status tracking.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            {/* Table Zone Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setAdminTableZoneFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  adminTableZoneFilter === 'ALL' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({tables.length})
              </button>
              {zones.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setAdminTableZoneFilter(z.id.toString())}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    adminTableZoneFilter === z.id.toString() ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {z.display_name}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsCreateTableOpen(true)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2 text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Add New Table
            </button>
          </div>
        </div>

        {tableSuccess && (
          <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{tableSuccess}</span>
          </div>
        )}

        {/* Legend Indicator Bar */}
        <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span className="font-extrabold text-slate-400 text-[10px] uppercase tracking-wider">Live Status Key:</span>
          <span className="bg-white text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-full border border-slate-300">⚪ VACANT (White)</span>
          <span className="bg-blue-600 text-white font-black text-[10px] px-2.5 py-1 rounded-full border border-blue-400">🔵 RUNNING TABLE (Blue)</span>
          <span className="bg-emerald-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-full border border-emerald-400">🟢 PRINTED / FINISHED (Green)</span>
          <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-full border border-amber-300">🟡 PAID TABLE (Yellow)</span>
        </div>

        {/* Tables Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tables
            .filter((t) => adminTableZoneFilter === 'ALL' || t.zone_id === Number(adminTableZoneFilter))
            .sort((a, b) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true, sensitivity: 'base' }))
            .map((t) => {
              const statusStyle = getTableStatusStyle(t);
              return (
                <div key={t.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col justify-between hover:border-slate-700 transition">
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
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeletePubTableItem(t)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition"
                        title="Delete Table"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="text-center my-1">
                    <h4 className="text-lg font-black text-slate-100">{t.table_number}</h4>
                  </div>

                  <div className="mt-2 text-center">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full block uppercase ${statusStyle.badgeClass}`}>
                      {statusStyle.label}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Staff & Waiter Account Management Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="font-black text-xl text-slate-100 flex items-center gap-2">
              <Shield className="w-6 h-6 text-amber-400" /> Staff & Waiter Accounts Management
            </h3>
            <p className="text-xs text-slate-400">
              Create and manage authentication logins for Waiter Staff, Reception Bar, and Kitchen Chefs.
            </p>
          </div>

          <button
            onClick={() => setIsCreateUserOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
          >
            <UserPlus className="w-4 h-4" /> Create Staff / Waiter Account
          </button>
        </div>

        {userSuccess && (
          <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{userSuccess}</span>
          </div>
        )}

        {/* Staff Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider">
              <tr>
                <th className="p-3 rounded-l-xl">User Staff Name</th>
                <th className="p-3">Email Address</th>
                <th className="p-3">Permitted Page Terminals</th>
                <th className="p-3">Account Status</th>
                <th className="p-3 text-right rounded-r-xl">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {staffUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-4 text-center text-slate-500 italic">
                    No staff accounts found. Click "Create Staff / Waiter Account" to add users.
                  </td>
                </tr>
              ) : (
                staffUsers.map((user) => {
                  const allowedList = (user.allowed_terminals || '')
                    .split(',')
                    .map(s => s.trim().toLowerCase())
                    .filter(Boolean);

                  return (
                    <tr key={user.id} className="hover:bg-slate-800/50 transition">
                      <td className="p-3 font-bold text-slate-100 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-amber-400 font-bold text-xs">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{user.name}</span>
                      </td>
                      <td className="p-3 text-slate-400 font-mono">{user.email}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {user.role === 'ADMIN' || user.email === 'avasanth081@gmail.com' ? (
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-extrabold px-2 py-0.5 rounded-md">
                              ALL TERMINALS (ADMIN)
                            </span>
                          ) : allowedList.length === 0 ? (
                            <span className="text-[10px] text-slate-500 italic">Default Staff Access</span>
                          ) : (
                            ALL_TERMINALS.filter(t => allowedList.includes(t.id)).map(t => (
                              <span key={t.id} className="bg-slate-950 border border-slate-800 text-slate-300 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                {t.label}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {user.email === 'avasanth081@gmail.com' ? (
                          <span className="text-[10px] text-amber-400/60 font-semibold italic">Primary Master Admin</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditUser(user)}
                              className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-lg transition"
                              title="Edit User Details & Page Permissions"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="p-1.5 bg-rose-950/40 hover:bg-rose-900 border border-rose-500/30 text-rose-300 rounded-lg transition"
                              title="Delete User Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bermuda VIP Customer Member Card Management Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="font-black text-xl text-slate-100 flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-amber-400" /> Bermuda VIP Member Card Management
            </h3>
            <p className="text-xs text-slate-400">
              Issue digital VIP member cards, record entry visits, store Name, Phone & Aadhaar details, and generate QR member passes.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-initial min-w-[220px]">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search name, phone, card code, Aadhaar..."
                value={memberSearchQuery}
                onChange={(e) => handleSearchMembers(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={() => setIsCreateMemberOpen(true)}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-4 py-2 text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Issue New Member Card
            </button>
          </div>
        </div>

        {memberSuccess && (
          <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{memberSuccess}</span>
          </div>
        )}

        {/* Member Cards Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider">
              <tr>
                <th className="p-3 rounded-l-xl">Member Code</th>
                <th className="p-3">Customer Name</th>
                <th className="p-3">Phone & Email</th>
                <th className="p-3">Aadhaar Govt ID</th>
                <th className="p-3">Status / Tier</th>
                <th className="p-3">Visits Count</th>
                <th className="p-3 text-right rounded-r-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {members.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-4 text-center text-slate-500 italic">
                    {memberSearchQuery ? `No member cards found matching "${memberSearchQuery}"` : 'No Bermuda member cards issued yet. Click "Issue New Member Card" to add customers.'}
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-800/50 transition">
                    <td className="p-3 font-mono font-bold text-amber-400 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>{member.member_code}</span>
                    </td>

                    <td className="p-3 font-bold text-slate-100">
                      {member.name}
                    </td>

                    <td className="p-3 text-slate-300 font-mono">
                      <div>{member.phone}</div>
                      {member.email && <div className="text-[10px] text-slate-500 font-sans">{member.email}</div>}
                    </td>

                    <td className="p-3 font-mono text-slate-400">
                      {member.aadhar_number ? (
                        <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px] text-slate-300">
                          {member.aadhar_number}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic">Not Provided</span>
                      )}
                    </td>

                    <td className="p-3">
                      {member.status === 'VIP' ? (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit shadow">
                          <Crown className="w-3.5 h-3.5 text-amber-400" /> VIP Member
                        </span>
                      ) : member.status === 'ACTIVE' ? (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Active Member
                        </span>
                      ) : (
                        <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit">
                          {member.status}
                        </span>
                      )}
                    </td>

                    <td className="p-3 font-mono">
                      <div className="flex items-center gap-1 text-slate-200 font-bold">
                        <span>{member.visit_count || 1} Visits</span>
                        <button
                          onClick={() => handleRecordVisit(member)}
                          className="bg-amber-500/10 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-[9px] px-1.5 py-0.5 rounded font-bold transition ml-1"
                          title="Record Customer Visit (+1)"
                        >
                          +1 Visit
                        </button>
                      </div>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setCardPreviewMember(member)}
                          className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg transition"
                          title="View & Print VIP Gymkhana Member Card / QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleOpenEditMember(member)}
                          className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-lg transition"
                          title="Edit Member Details (Phone, Aadhaar, Name)"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteMemberItem(member)}
                          className="p-1.5 bg-rose-950/40 hover:bg-rose-900 border border-rose-500/30 text-rose-300 rounded-lg transition"
                          title="Delete Member Card"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Staff Account Modal */}
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 relative overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" /> Create Staff Account
              </h3>
              <button
                onClick={() => setIsCreateUserOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {userError && (
              <div className="bg-rose-950/60 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs">
                {userError}
              </div>
            )}

            <form onSubmit={handleCreateStaffUser} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Staff Member Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Waiter, Priya Bar"
                    value={newUserData.name}
                    onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Email / Login ID *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    placeholder="example@gmail.com"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Granular Page Access (Select Permitted Terminals) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {ALL_TERMINALS.map((term) => {
                    const isChecked = (newUserData.allowed_terminals || []).includes(term.id);
                    return (
                      <label key={term.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-amber-500/40 transition">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = newUserData.allowed_terminals || [];
                            if (e.target.checked) {
                              setNewUserData({ ...newUserData, allowed_terminals: [...current, term.id] });
                            } else {
                              setNewUserData({ ...newUserData, allowed_terminals: current.filter(t => t !== term.id) });
                            }
                          }}
                          className="mt-0.5 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-100">{term.label}</div>
                          <div className="text-[10px] text-slate-400">{term.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  className="w-full bg-slate-800 text-slate-300 py-3 rounded-xl font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 py-3 rounded-xl font-black shadow-lg"
                >
                  {isSubmittingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Account & Page Permissions Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-blue-500/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 relative overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" /> Edit Staff Account & Access Permissions
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Staff Member Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={editingUserData.name}
                    onChange={(e) => setEditingUserData({ ...editingUserData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Email / Login ID *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={editingUserData.email}
                    onChange={(e) => setEditingUserData({ ...editingUserData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">New Password (Leave blank to keep unchanged)</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={editingUserData.password}
                    onChange={(e) => setEditingUserData({ ...editingUserData, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Granular Page Access (Select Permitted Terminals) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {ALL_TERMINALS.map((term) => {
                    const isChecked = (editingUserData.allowed_terminals || []).includes(term.id);
                    return (
                      <label key={term.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-blue-500/40 transition">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = editingUserData.allowed_terminals || [];
                            if (e.target.checked) {
                              setEditingUserData({ ...editingUserData, allowed_terminals: [...current, term.id] });
                            } else {
                              setEditingUserData({ ...editingUserData, allowed_terminals: current.filter(t => t !== term.id) });
                            }
                          }}
                          className="mt-0.5 rounded border-slate-700 bg-slate-950 text-blue-500 focus:ring-blue-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-100">{term.label}</div>
                          <div className="text-[10px] text-slate-400">{term.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="w-full bg-slate-800 text-slate-300 py-3 rounded-xl font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black shadow-lg"
                >
                  {isSubmittingUser ? 'Saving...' : 'Save User Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Edit Menu Item Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" /> Edit Menu Item
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProductEdit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Item Name *</label>
                <input
                  type="text"
                  value={editingProductData.name}
                  onChange={(e) => setEditingProductData({ ...editingProductData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Category</label>
                  <select
                    value={editingProductData.category_id}
                    onChange={(e) => {
                      const catId = Number(e.target.value);
                      const cat = categories.find((c) => c.id === catId);
                      setEditingProductData({
                        ...editingProductData,
                        category_id: catId,
                        target_dept: cat?.target_dept || editingProductData.target_dept
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
                    value={editingProductData.price}
                    onChange={(e) => setEditingProductData({ ...editingProductData, price: e.target.value })}
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
                    onClick={() => setEditingProductData({ ...editingProductData, target_dept: 'BAR' })}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition ${
                      editingProductData.target_dept === 'BAR'
                        ? 'bg-purple-950 border-purple-500 text-purple-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Wine className="w-4 h-4" /> Bar (Drinks)
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingProductData({ ...editingProductData, target_dept: 'KITCHEN' })}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition ${
                      editingProductData.target_dept === 'KITCHEN'
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Utensils className="w-4 h-4" /> Kitchen (Food)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Item Stock Status (Availability)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingProductData({ ...editingProductData, is_available: true })}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition ${
                      editingProductData.is_available
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-400 opacity-60'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-400" /> In Stock (Available)
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingProductData({ ...editingProductData, is_available: false })}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition ${
                      !editingProductData.is_available
                        ? 'bg-rose-950 border-rose-500 text-rose-300 shadow-md shadow-rose-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-400 opacity-60'
                    }`}
                  >
                    <X className="w-4 h-4 text-rose-400" /> Out of Stock (Disabled)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Description (Optional)</label>
                <textarea
                  rows="2"
                  value={editingProductData.description}
                  onChange={(e) => setEditingProductData({ ...editingProductData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                ></textarea>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="w-full bg-slate-800 text-slate-300 py-3 rounded-xl font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 py-3 rounded-xl font-black shadow-lg"
                >
                  Update Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Bermuda Member Card Modal */}
      {isCreateMemberOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" /> Issue New Bermuda Member Card
              </h3>
              <button
                onClick={() => setIsCreateMemberOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {memberError && (
              <div className="bg-rose-950/60 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs">
                {memberError}
              </div>
            )}

            <form onSubmit={handleCreateMemberSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Customer Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="e.g. Rajesh Kumar"
                      value={newMemberData.name}
                      onChange={(e) => setNewMemberData({ ...newMemberData, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={newMemberData.phone}
                      onChange={(e) => setNewMemberData({ ...newMemberData, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Aadhaar / Govt ID Number</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="1234-5678-9012"
                      value={newMemberData.aadhar_number}
                      onChange={(e) => setNewMemberData({ ...newMemberData, aadhar_number: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      placeholder="rajesh@bermuda.pub"
                      value={newMemberData.email}
                      onChange={(e) => setNewMemberData({ ...newMemberData, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Membership Status</label>
                <select
                  value={newMemberData.status}
                  onChange={(e) => setNewMemberData({ ...newMemberData, status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-amber-300 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="ACTIVE" className="bg-slate-900 text-emerald-300">🟢 ACTIVE (Regular Member)</option>
                  <option value="VIP" className="bg-slate-900 text-amber-300">👑 VIP MEMBER (Priority Bar Access)</option>
                  <option value="INACTIVE" className="bg-slate-900 text-slate-400">⚪ INACTIVE</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Residential Address / City</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="e.g. Indiranagar, Bangalore"
                    value={newMemberData.address}
                    onChange={(e) => setNewMemberData({ ...newMemberData, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateMemberOpen(false)}
                  className="w-full bg-slate-800 text-slate-300 py-3 rounded-xl font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingMember}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 py-3 rounded-xl font-black shadow-lg"
                >
                  {isSubmittingMember ? 'Generating Pass...' : 'Issue Member Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Details Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-blue-500/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" /> Edit Bermuda Member Details
              </h3>
              <button
                onClick={() => setEditingMember(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMemberEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Customer Full Name *</label>
                  <input
                    type="text"
                    value={editingMemberData.name}
                    onChange={(e) => setEditingMemberData({ ...editingMemberData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={editingMemberData.phone}
                    onChange={(e) => setEditingMemberData({ ...editingMemberData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Aadhaar / Govt ID Number</label>
                  <input
                    type="text"
                    value={editingMemberData.aadhar_number}
                    onChange={(e) => setEditingMemberData({ ...editingMemberData, aadhar_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editingMemberData.email}
                    onChange={(e) => setEditingMemberData({ ...editingMemberData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Membership Status</label>
                <select
                  value={editingMemberData.status}
                  onChange={(e) => setEditingMemberData({ ...editingMemberData, status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-amber-300 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="ACTIVE" className="bg-slate-900 text-emerald-300">🟢 ACTIVE (Regular Member)</option>
                  <option value="VIP" className="bg-slate-900 text-amber-300">👑 VIP MEMBER (Priority Bar Access)</option>
                  <option value="INACTIVE" className="bg-slate-900 text-slate-400">⚪ INACTIVE</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Residential Address / City</label>
                <input
                  type="text"
                  value={editingMemberData.address}
                  onChange={(e) => setEditingMemberData({ ...editingMemberData, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="w-full bg-slate-800 text-slate-300 py-3 rounded-xl font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black shadow-lg"
                >
                  Update Member Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Digital Bermuda Member Card & QR Preview Modal */}
      {cardPreviewMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-center relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base text-amber-400 flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" /> Bermuda VIP Member Card
              </h3>
              <button
                onClick={() => setCardPreviewMember(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Member Card Badge Mockup */}
            <div className="bg-gradient-to-br from-amber-950 via-slate-950 to-amber-950 border-2 border-amber-500/60 p-6 rounded-2xl space-y-4 shadow-2xl relative overflow-hidden text-left">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-amber-400 tracking-widest uppercase">BERMUDA COCKTAIL PUB & CLUB</div>
                  <div className="text-xl font-black text-slate-100">{cardPreviewMember.name}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-bold text-xs shadow">
                  VIP
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <div className="text-[9px] text-slate-400 uppercase">MEMBER CARD CODE</div>
                  <div className="text-amber-300 font-bold">{cardPreviewMember.member_code}</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-400 uppercase">PHONE NO.</div>
                  <div className="text-slate-200 font-bold">{cardPreviewMember.phone}</div>
                </div>
                {cardPreviewMember.aadhar_number && (
                  <div className="col-span-2">
                    <div className="text-[9px] text-slate-400 uppercase">AADHAAR GOVT ID</div>
                    <div className="text-slate-300">{cardPreviewMember.aadhar_number}</div>
                  </div>
                )}
              </div>

              {/* Real QR Code Pass */}
              <div className="bg-white p-4 rounded-xl text-center shadow-inner my-2">
                <QRCodeSVG
                  value={JSON.stringify({
                    member_code: cardPreviewMember.member_code,
                    name: cardPreviewMember.name,
                    phone: cardPreviewMember.phone
                  })}
                  size={150}
                  bgColor={"#FFFFFF"}
                  fgColor={"#0F172A"}
                  level={"H"}
                />
                <span className="text-[10px] text-slate-600 font-mono block mt-1">SCANNABLE MEMBER QR PAYLOAD</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-amber-500/20 pt-2 font-mono">
                <span>Visits Recorded: <strong className="text-amber-300">{cardPreviewMember.visit_count || 1}</strong></span>
                <span>Tier: <strong className="text-amber-300">{cardPreviewMember.status}</strong></span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
              >
                🖨️ Print Member Card & QR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Table Modal */}
      {isCreateTableOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" /> Add New Pub Table
              </h3>
              <button
                onClick={() => setIsCreateTableOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center"
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
                <label className="font-bold text-slate-300 block mb-1">Table Number * (e.g. C11, DN-30, SZ-11)</label>
                <input
                  type="text"
                  placeholder="e.g. C11 or DN-30"
                  value={newTableData.table_number}
                  onChange={(e) => setNewTableData({ ...newTableData, table_number: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 font-bold focus:outline-none focus:border-amber-500 uppercase"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Zone Area</label>
                  <select
                    value={newTableData.zone_id}
                    onChange={(e) => setNewTableData({ ...newTableData, zone_id: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id} className="bg-slate-900">
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
                    value={newTableData.capacity}
                    onChange={(e) => setNewTableData({ ...newTableData, capacity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 font-bold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Initial Table Status</label>
                <select
                  value={newTableData.current_status}
                  onChange={(e) => setNewTableData({ ...newTableData, current_status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-amber-300 font-bold focus:outline-none"
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
                  onClick={() => setIsCreateTableOpen(false)}
                  className="w-full bg-slate-800 text-slate-300 py-3 rounded-xl font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 py-3 rounded-xl font-black shadow-lg"
                >
                  Save Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Table Modal */}
      {editingTable && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" /> Edit Pub Table Details
              </h3>
              <button
                onClick={() => setEditingTable(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditPubTable} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Table Number *</label>
                <input
                  type="text"
                  value={editingTableData.table_number}
                  onChange={(e) => setEditingTableData({ ...editingTableData, table_number: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 font-bold focus:outline-none focus:border-amber-500 uppercase"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Zone Area</label>
                  <select
                    value={editingTableData.zone_id}
                    onChange={(e) => setEditingTableData({ ...editingTableData, zone_id: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id} className="bg-slate-900">
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
                    value={editingTableData.capacity}
                    onChange={(e) => setEditingTableData({ ...editingTableData, capacity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 font-bold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Current Occupancy Status</label>
                <select
                  value={editingTableData.current_status}
                  onChange={(e) => setEditingTableData({ ...editingTableData, current_status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-amber-300 font-bold focus:outline-none"
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

      {/* Top-Right Audit Log Popover Modal */}
      <PaymentAuditLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />
    </div>
  );
}
