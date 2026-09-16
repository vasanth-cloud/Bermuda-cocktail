import React, { useState, useEffect } from 'react';
import { useOrder } from '../context/OrderContext';
import { 
  CreditCard, 
  Users, 
  QrCode, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle, 
  Award, 
  Sparkles, 
  UserCheck, 
  Phone, 
  FileText, 
  Mail, 
  MapPin, 
  User, 
  RefreshCw, 
  X, 
  Shield 
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function MemberCardPanel() {
  const { 
    members, 
    fetchMembers, 
    createMember, 
    updateMember, 
    deleteMember, 
    recordMemberVisit 
  } = useOrder();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form State for Issuing New Card
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    aadhar_number: '',
    email: '',
    address: '',
    status: 'ACTIVE'
  });

  // Edit Modal State
  const [editingMember, setEditingMember] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    aadhar_number: '',
    email: '',
    address: '',
    status: 'ACTIVE'
  });

  // QR Modal State
  const [selectedMemberForQr, setSelectedMemberForQr] = useState(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    fetchMembers(q);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!formData.name.trim() || !formData.phone.trim()) {
      setErrorMessage('Name and Phone Number are required fields.');
      return;
    }

    setIsSubmitting(true);
    const res = await createMember(formData);
    setIsSubmitting(false);

    if (res.success) {
      setSuccessMessage(`VIP Member Card created successfully for ${res.member.name}! (Code: ${res.member.member_code})`);
      setFormData({
        name: '',
        phone: '',
        aadhar_number: '',
        email: '',
        address: '',
        status: 'ACTIVE'
      });
      setIsCreateOpen(false);
      setTimeout(() => setSuccessMessage(''), 4000);
    } else {
      setErrorMessage(res.error || 'Failed to create member card');
    }
  };

  const handleEditClick = (member) => {
    setEditingMember(member);
    setEditFormData({
      name: member.name || '',
      phone: member.phone || '',
      aadhar_number: member.aadhar_number || '',
      email: member.email || '',
      address: member.address || '',
      status: member.status || 'ACTIVE'
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingMember) return;
    setErrorMessage('');

    setIsSubmitting(true);
    const success = await updateMember(editingMember.id, editFormData);
    setIsSubmitting(false);

    if (success) {
      setSuccessMessage(`Member card updated for ${editFormData.name}!`);
      setEditingMember(null);
      setTimeout(() => setSuccessMessage(''), 4000);
    } else {
      setErrorMessage('Failed to update member card');
    }
  };

  const handleDelete = async (member) => {
    if (window.confirm(`Are you sure you want to delete the member card for ${member.name} (${member.member_code})?`)) {
      const success = await deleteMember(member.id);
      if (success) {
        setSuccessMessage(`Member card ${member.member_code} deleted.`);
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    }
  };

  const handleRecordVisit = async (member) => {
    const success = await recordMemberVisit(member.id);
    if (success) {
      setSuccessMessage(`Visit recorded for ${member.name}! Total visits: ${member.visit_count + 1}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const totalMembers = members.length;
  const vipCount = members.filter(m => m.status === 'VIP').length;
  const totalVisits = members.reduce((acc, m) => acc + (m.visit_count || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400" /> Bermuda Pub Exclusive
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 mt-2 flex items-center gap-2">
              <CreditCard className="w-7 h-7 text-amber-400" />
              VIP Member Card System
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Issue member cards, track customer entry visits, scan QR passes & manage profile details
            </p>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black px-5 py-3 rounded-xl shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition flex items-center justify-center gap-2 text-sm shrink-0"
          >
            <Plus className="w-5 h-5 stroke-[3]" /> Issue New Member Card
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 p-4 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-400 hover:text-emerald-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-950/80 border border-rose-500/40 text-rose-300 p-4 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold shadow-lg">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-rose-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-md">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Members</div>
            <div className="text-2xl font-black text-slate-100">{totalMembers}</div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-md">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">VIP Elite Status</div>
            <div className="text-2xl font-black text-purple-300">{vipCount}</div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-md">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Recorded Visits</div>
            <div className="text-2xl font-black text-emerald-400">{totalVisits}</div>
          </div>
        </div>
      </div>

      {/* Search & Action Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search by Name, Phone, Card Code or Aadhar..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <button
          onClick={() => fetchMembers(searchQuery)}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 self-end sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Directory
        </button>
      </div>

      {/* Members Directory Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-black tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Member Info & Code</th>
                <th className="py-3.5 px-4">Phone / Contact</th>
                <th className="py-3.5 px-4">Aadhar No</th>
                <th className="py-3.5 px-4">Card Status</th>
                <th className="py-3.5 px-4 text-center">Visits</th>
                <th className="py-3.5 px-4 text-center">QR Pass</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {members.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-500">
                    <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No member cards found matching your query.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-100 flex items-center gap-2">
                        <span>{m.name}</span>
                        {m.status === 'VIP' && (
                          <span className="text-[10px] bg-purple-500/20 border border-purple-500/30 text-purple-300 font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Crown className="w-3 h-3 text-purple-400" /> VIP
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-amber-400 font-bold">{m.member_code}</div>
                      {m.address && <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{m.address}</div>}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      <div>{m.phone}</div>
                      {m.email && <div className="text-[11px] text-slate-400 font-sans">{m.email}</div>}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {m.aadhar_number || <span className="text-slate-600 italic">Not provided</span>}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                        m.status === 'VIP' 
                          ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' 
                          : m.status === 'ACTIVE' 
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                          : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      }`}>
                        {m.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-xs font-mono font-black text-amber-400">
                        {m.visit_count}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => setSelectedMemberForQr(m)}
                        className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold transition inline-flex items-center gap-1"
                        title="View Digital QR Card"
                      >
                        <QrCode className="w-4 h-4" /> Pass
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleRecordVisit(m)}
                          className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1"
                          title="Record Customer Visit"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Entry
                        </button>
                        <button
                          onClick={() => handleEditClick(m)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                          title="Edit Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900 border border-rose-500/30 text-rose-400 transition"
                          title="Delete Card"
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

      {/* MODAL: Issue New Member Card */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-black text-slate-100">Issue Bermuda VIP Card</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Customer Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Phone Number *</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Aadhar Number</label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={formData.aadhar_number}
                      onChange={(e) => setFormData({ ...formData, aadhar_number: e.target.value })}
                      placeholder="12-digit Aadhar"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="rahul@gmail.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Membership Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="ACTIVE">ACTIVE Member</option>
                    <option value="VIP">VIP Elite Member</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Residential Address</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <textarea
                    rows="2"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Full street address..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black hover:bg-amber-400 transition flex items-center gap-2"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Issue Member Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Member Card */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-black text-slate-100">Edit VIP Card: {editingMember.member_code}</h3>
              </div>
              <button
                onClick={() => setEditingMember(null)}
                className="text-slate-400 hover:text-slate-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Aadhar Number</label>
                  <input
                    type="text"
                    value={editFormData.aadhar_number}
                    onChange={(e) => setEditFormData({ ...editFormData, aadhar_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Membership Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="ACTIVE">ACTIVE Member</option>
                    <option value="VIP">VIP Elite Member</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Address</label>
                <textarea
                  rows="2"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black hover:bg-amber-400 transition flex items-center gap-2"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Digital Member Pass QR View */}
      {selectedMemberForQr && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-black tracking-widest text-amber-400 uppercase flex items-center gap-1">
                <Crown className="w-4 h-4" /> VIP Digital Pass
              </span>
              <button
                onClick={() => setSelectedMemberForQr(null)}
                className="text-slate-400 hover:text-slate-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* VIP Card Graphics */}
            <div className="bg-gradient-to-br from-amber-500/20 via-slate-900 to-amber-950/50 border-2 border-amber-500/40 p-5 rounded-2xl shadow-xl space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-300 tracking-wider">BERMUDA COCKTAIL PUB</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                  {selectedMemberForQr.status}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl inline-block shadow-lg mx-auto">
                <QRCodeSVG
                  value={selectedMemberForQr.member_code}
                  size={160}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="text-center">
                <div className="text-lg font-black text-slate-100">{selectedMemberForQr.name}</div>
                <div className="text-xs font-mono font-bold text-amber-400 mt-0.5">{selectedMemberForQr.member_code}</div>
                <div className="text-[11px] text-slate-400 mt-1">Ph: {selectedMemberForQr.phone}</div>
              </div>
            </div>

            <button
              onClick={() => setSelectedMemberForQr(null)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 rounded-xl text-xs transition"
            >
              Close Pass
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
