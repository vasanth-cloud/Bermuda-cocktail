import React, { useState, useEffect } from 'react';
import { useOrder } from '../context/OrderContext';
import { 
  Shield, 
  UserPlus, 
  Users, 
  Crown, 
  Wine, 
  CheckCircle, 
  Edit2, 
  Trash2, 
  Sparkles,
  Lock
} from 'lucide-react';

export default function StaffAccountsPanel() {
  const { 
    staffUsers, 
    fetchStaffUsers,
    createStaffAccount, 
    updateStaffAccount, 
    deleteStaffAccount 
  } = useOrder();

  useEffect(() => {
    fetchStaffUsers();
  }, []);

  const ALL_TERMINALS = [
    { id: 'customer', label: 'Customer Menu', desc: 'Digital QR Ordering' },
    { id: 'entry_scanner', label: 'Member QR Scanner', desc: 'Entrance Scan & Audit Logs' },
    { id: 'bar', label: 'Bar & Kitchen KDS', desc: 'Drinks, Food & Reception Billing' },
    { id: 'staff', label: 'Waiter Staff', desc: 'Floor Tables & Pickup Alerts' },
    { id: 'reports', label: 'Category Sales Reports', desc: 'Food vs Bar, UPI/Cash/Card Reports' },
    { id: 'tables', label: 'Pub Layout & Tables', desc: 'Table Layout Config' },
    { id: 'staff_accounts', label: 'Staff Accounts', desc: 'User Credential Config' },
    { id: 'members', label: 'VIP Member Cards', desc: 'Bermuda VIP Cards Directory' },
    { id: 'admin', label: 'Cloud Admin', desc: 'Master Menu & Price Config' }
  ];

  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'WAITER',
    allowed_terminals: ['staff']
  });

  const [editingUser, setEditingUser] = useState(null);
  const [editingUserData, setEditingUserData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'WAITER',
    allowed_terminals: ['staff']
  });

  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

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
      setNewUserData({ name: '', email: '', password: '', role: 'WAITER', allowed_terminals: ['staff'] });
      setIsCreateUserOpen(false);
    } else {
      setUserError(result.error || 'Failed to create user account');
    }
  };

  const handleOpenEditUser = (user) => {
    setEditingUser(user);
    const terminals = user.allowed_terminals
      ? user.allowed_terminals.split(',').map(s => s.trim()).filter(Boolean)
      : ['customer', 'staff', 'reports'];
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
    const autoRole = terms.includes('admin') ? 'ADMIN' : editingUserData.role;

    const payload = {
      name: editingUserData.name,
      email: editingUserData.email,
      role: autoRole,
      allowed_terminals: terms.join(',')
    };
    if (editingUserData.password) {
      payload.password = editingUserData.password;
    }

    const result = await updateStaffAccount(editingUser.id, payload);
    if (result.success) {
      setUserSuccess(`Updated user account for ${editingUserData.name}!`);
      setEditingUser(null);
    } else {
      alert(result.error || 'Failed to update user account');
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.email === 'avasanth081@gmail.com') {
      alert('Cannot delete the primary Master Admin account.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete staff user "${user.name}" (${user.email})?`)) {
      await deleteStaffAccount(user.id);
    }
  };

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
      default:
        return <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full">{role}</span>;
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
              <Shield className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                Staff & Waiter Accounts Management
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> {staffUsers.length} ACCOUNTS
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Create and manage authentication logins for Waiter Staff, Reception Bar, and Kitchen Chefs.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCreateUserOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2.5 text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 transition whitespace-nowrap z-10"
          >
            <UserPlus className="w-4 h-4" /> Create Staff / Waiter Account
          </button>
        </div>
      </div>

      {userSuccess && (
        <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center gap-2 shadow">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{userSuccess}</span>
        </div>
      )}

      {/* Staff Accounts Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" /> Active Staff Login Credentials
          </h3>
          <span className="text-xs font-mono text-slate-400">Security Controlled Access</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5 rounded-l-xl">User Staff Name</th>
                <th className="p-3.5">Email Address</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Permitted Page Terminals</th>
                <th className="p-3.5 text-right rounded-r-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {staffUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-6 text-center text-slate-500 italic">
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
                      <td className="p-3.5 font-extrabold text-slate-100 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black text-xs shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{user.name}</span>
                      </td>

                      <td className="p-3.5 text-slate-300 font-mono">
                        {user.email}
                      </td>

                      <td className="p-3.5">
                        {getRoleBadge(user.role)}
                      </td>

                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1 max-w-sm">
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

                      <td className="p-3.5 text-right">
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

      {/* Create Staff Account Modal */}
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" /> Create Staff / Waiter Account
              </h3>
              <button
                onClick={() => setIsCreateUserOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold"
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
                <label className="font-bold text-slate-300 block mb-1">Staff / Waiter Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Email / Login Username *</label>
                <input
                  type="email"
                  placeholder="e.g. rahul@bermuda.com"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Login Password *</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Allowed Page Terminals (Check to Grant Access):</label>
                <div className="grid grid-cols-1 gap-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-40 overflow-y-auto">
                  {ALL_TERMINALS.map((term) => {
                    const isChecked = newUserData.allowed_terminals.includes(term.id);
                    return (
                      <label key={term.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-900 p-1.5 rounded transition">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewUserData({ ...newUserData, allowed_terminals: [...newUserData.allowed_terminals, term.id] });
                            } else {
                              setNewUserData({ ...newUserData, allowed_terminals: newUserData.allowed_terminals.filter(id => id !== term.id) });
                            }
                          }}
                          className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                        />
                        <div>
                          <div className="font-bold text-slate-200">{term.label}</div>
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
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl shadow-lg"
                >
                  {isSubmittingUser ? 'Creating...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Account Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" /> Edit Staff Account: {editingUser.name}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Staff / Waiter Name</label>
                <input
                  type="text"
                  value={editingUserData.name}
                  onChange={(e) => setEditingUserData({ ...editingUserData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Email / Username</label>
                <input
                  type="email"
                  value={editingUserData.email}
                  onChange={(e) => setEditingUserData({ ...editingUserData, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">New Password (Leave blank to keep unchanged)</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={editingUserData.password}
                  onChange={(e) => setEditingUserData({ ...editingUserData, password: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Allowed Page Terminals (Check to Grant Access):</label>
                <div className="grid grid-cols-1 gap-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-40 overflow-y-auto">
                  {ALL_TERMINALS.map((term) => {
                    const isChecked = editingUserData.allowed_terminals.includes(term.id);
                    return (
                      <label key={term.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-900 p-1.5 rounded transition">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditingUserData({ ...editingUserData, allowed_terminals: [...editingUserData.allowed_terminals, term.id] });
                            } else {
                              setEditingUserData({ ...editingUserData, allowed_terminals: editingUserData.allowed_terminals.filter(id => id !== term.id) });
                            }
                          }}
                          className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                        />
                        <div>
                          <div className="font-bold text-slate-200">{term.label}</div>
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
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl shadow-lg"
                >
                  Save Account Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
