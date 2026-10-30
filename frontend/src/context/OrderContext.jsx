import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, getWsBaseUrl, getAssetUrl } from '../config';

const OrderContext = createContext();

export const OrderProvider = ({ children }) => {
  // 1. All State declarations at top of component
  const [activeTab, setActiveTab] = useState('customer'); // customer, bar, kitchen, staff, admin
  const [selectedTable, setSelectedTable] = useState(null); // PubTable object
  const [tables, setTables] = useState([]);
  const [zones, setZones] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  
  // Customer Cart
  const [cart, setCart] = useState([]);
  const [activeCustomerOrder, setActiveCustomerOrder] = useState(null);

  // Real-time Orders for Panels
  const [barOrders, setBarOrders] = useState([]);
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  
  // EDC Addons Master Data
  const [addonsData, setAddonsData] = useState({ total: 0, quick_categories: {}, items: [] });
  // Pub Operational Settings (Customer Punching ON/OFF for peak rush)
  const [pubSettings, setPubSettings] = useState({
    customer_punching_enabled: true,
    weekend_rush_mode: false,
    view_only_message: ''
  });
  
  // Offline Sync State & Connection
  const [syncStatus, setSyncStatus] = useState({ pending_sync_count: 0, connection_mode: 'OFFLINE_LOCAL_SERVER' });
  const [wsConnected, setWsConnected] = useState(false);
  const [isCustomerQrMode, setIsCustomerQrMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return Boolean(urlParams.get('table') || urlParams.get('t'));
    }
    return false;
  });
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('bermuda_theme') || 'dark';
    } catch (e) {
      return 'dark';
    }
  });

  // Apply theme class to <html> element dynamically whenever theme state changes
  useEffect(() => {
    try {
      document.documentElement.classList.remove('dark', 'neon', 'light');
      document.documentElement.classList.add(theme);
      localStorage.setItem('bermuda_theme', theme);
    } catch (e) {
      console.error("Theme toggle error:", e);
    }
  }, [theme]);

  // Sidebar Visibility & Auto-Hide Preferences
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('bermuda_sidebar_open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });

  const [autoHideOnSelect, setAutoHideOnSelect] = useState(() => {
    try {
      const saved = localStorage.getItem('bermuda_sidebar_autohide');
      return saved !== null ? JSON.parse(saved) : false;
    } catch (e) {
      return false;
    }
  });

  const updatePubSettings = async (newSettings) => {
    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setPubSettings(data.settings);
        return { success: true, settings: data.settings };
      }
    } catch (err) {
      console.error('Error updating settings:', err);
    }
    return { success: false };
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('bermuda_sidebar_open', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const setSidebarVisibility = (val) => {
    setIsSidebarOpen(val);
    try {
      localStorage.setItem('bermuda_sidebar_open', JSON.stringify(val));
    } catch (e) {}
  };

  const setAutoHidePreference = (val) => {
    setAutoHideOnSelect(val);
    try {
      localStorage.setItem('bermuda_sidebar_autohide', JSON.stringify(val));
    } catch (e) {}
  };

  // User Auth State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('bermuda_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [staffUsers, setStaffUsers] = useState([]);

  // Validate current user session against backend database with signed JWT
  const verifyCurrentSession = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('bermuda_token') : null;
    if (!token) {
      if (currentUser) {
        setCurrentUser(null);
        localStorage.removeItem('bermuda_user');
      }
      return false;
    }

    try {
      const res = await apiFetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.valid && data.user) {
          setCurrentUser(data.user);
          localStorage.setItem('bermuda_user', JSON.stringify(data.user));
          return true;
        }
      } else {
        // Staff account no longer exists in database or deactivated/token expired
        console.warn("Staff session is invalid or expired. Clearing credentials.");
        setCurrentUser(null);
        localStorage.removeItem('bermuda_user');
        localStorage.removeItem('bermuda_token');
        setActiveTab('customer');
        return false;
      }
    } catch (err) {
      console.warn("Session verification warning:", err);
    }
    return true;
  };

  useEffect(() => {
    verifyCurrentSession();

    // Periodic check every 20 seconds to revoke deleted staff members
    const interval = setInterval(() => {
      verifyCurrentSession();
    }, 20000);

    const onFocus = () => {
      verifyCurrentSession();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const fetchStaffUsers = async () => {
    try {
      const res = await apiFetch('/api/users');
      if (res.ok) {
        const users = await res.json();
        setStaffUsers(users);
        // Verify current user still exists
        const saved = localStorage.getItem('bermuda_user');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.email && parsed.email !== 'avasanth081@gmail.com') {
              const stillExists = users.some(u => 
                (u.id === parsed.id || u.email.toLowerCase() === parsed.email.toLowerCase()) && u.is_active
              );
              if (!stillExists) {
                console.warn("Logged-in staff account is not in active staff list. Logging out.");
                setCurrentUser(null);
                localStorage.removeItem('bermuda_user');
                setActiveTab('customer');
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loginUser = async (email, password) => {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password })
      });
      const data = await res.json();
      if (res.ok && data.user && data.access_token) {
        setCurrentUser(data.user);
        localStorage.setItem('bermuda_user', JSON.stringify(data.user));
        localStorage.setItem('bermuda_token', data.access_token);

        const allowedStr = data.user.allowed_terminals || '';
        const allowedList = allowedStr.split(',').map(s => s.trim()).filter(Boolean);

        if (allowedList.includes('admin') || data.user.role === 'ADMIN') setActiveTab('admin');
        else if (allowedList.includes('bar')) setActiveTab('bar');
        else if (allowedList.includes('staff')) setActiveTab('staff');
        else if (allowedList.includes('entry_scanner')) setActiveTab('entry_scanner');
        else if (allowedList.includes('members')) setActiveTab('members');
        else if (allowedList.length > 0) setActiveTab(allowedList[0]);
        else setActiveTab('customer');

        return { success: true };
      }
      return { success: false, error: data.detail || 'Invalid email or password' };
    } catch (err) {
      return { success: false, error: 'Server connection failed' };
    }
  };

  const logoutUser = () => {
    setCurrentUser(null);
    localStorage.removeItem('bermuda_user');
    localStorage.removeItem('bermuda_token');
    setActiveTab('customer');
  };

  const createStaffAccount = async (userData) => {
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      if (res.ok) {
        await fetchStaffUsers();
        return { success: true };
      }
      return { success: false, error: data.detail || 'Failed to create user' };
    } catch (err) {
      return { success: false, error: 'Server error' };
    }
  };

  const updateStaffAccount = async (userId, userData) => {
    try {
      const res = await apiFetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      if (res.ok) {
        await fetchStaffUsers();
        if (currentUser && currentUser.id === userId) {
          const updatedUser = { ...currentUser, ...data };
          setCurrentUser(updatedUser);
          localStorage.setItem('bermuda_user', JSON.stringify(updatedUser));
        }
        return { success: true };
      }
      return { success: false, error: data.detail || 'Failed to update user' };
    } catch (err) {
      return { success: false, error: 'Server error' };
    }
  };

  const deleteStaffAccount = async (userId) => {
    try {
      const res = await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchStaffUsers();
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const switchOrderTable = async (orderId, newTableId, waiterName = 'Staff', printTransferSlip = true) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/switch-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_table_id: newTableId,
          waiter_name: waiterName,
          print_transfer_slip: printTransferSlip
        })
      });
      const data = await res.json();
      if (res.ok) {
        await fetchTables();
        await fetchOrders();
        return { 
          success: true, 
          message: data.message, 
          from_table: data.from_table, 
          to_table: data.to_table 
        };
      }
      return { success: false, error: data.detail || 'Failed to switch table' };
    } catch (err) {
      console.error("switchOrderTable error:", err);
      return { success: false, error: 'Network error switching table' };
    }
  };

  const fetchTables = async () => {
    try {
      const res = await apiFetch('/api/tables');
      if (res.ok) {
        const data = await res.json();
        setTables(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("fetchTables error:", e);
    }
  };

  const addPubTable = async (tableData) => {
    try {
      const res = await apiFetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tableData)
      });
      const data = await res.json();
      if (res.ok) {
        await fetchTables();
        return { success: true };
      }
      return { success: false, error: data.detail || 'Failed to add table' };
    } catch (err) {
      return { success: false, error: 'Server connection failed' };
    }
  };

  const updatePubTable = async (tableId, tableData) => {
    try {
      const res = await apiFetch(`/api/tables/${tableId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tableData)
      });
      const data = await res.json();
      if (res.ok) {
        await fetchTables();
        return { success: true };
      }
      return { success: false, error: data.detail || 'Failed to update table' };
    } catch (err) {
      return { success: false, error: 'Server connection failed' };
    }
  };

  const deletePubTable = async (tableId) => {
    try {
      const res = await apiFetch(`/api/tables/${tableId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchTables();
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  // Fetch initial metadata
  const fetchData = async () => {
    try {
      const [zonesRes, tablesRes, catRes, prodRes, syncRes, usersRes, addonsRes, settingsRes] = await Promise.all([
        apiFetch('/api/zones'),
        apiFetch('/api/tables'),
        apiFetch('/api/categories'),
        apiFetch('/api/products'),
        apiFetch('/api/sync/status'),
        apiFetch('/api/users'),
        apiFetch('/api/addons'),
        apiFetch('/api/settings')
      ]);

      const zonesData = await zonesRes.json();
      const tablesData = await tablesRes.json();
      const catData = await catRes.json();
      const prodData = await prodRes.json();
      const syncData = await syncRes.json();
      const usersData = await usersRes.json();
      if (addonsRes && addonsRes.ok) {
        const addData = await addonsRes.json();
        setAddonsData(addData);
      }
      if (settingsRes && settingsRes.ok) {
        const settsData = await settingsRes.json();
        setPubSettings(settsData);
      }

      setZones(Array.isArray(zonesData) ? zonesData : []);
      const validTables = Array.isArray(tablesData) ? tablesData : [];
      setTables(validTables);
      setCategories(Array.isArray(catData) ? catData : []);
      setProducts(Array.isArray(prodData) ? prodData : []);
      if (Array.isArray(usersData)) {
        setStaffUsers(usersData);
      }
      if (syncData && syncData.pending_sync_count !== undefined) {
        setSyncStatus(syncData);
      }

      // Detect QR code table parameter from URL (e.g. ?table=DN-06 or ?table=ST-02)
      const urlParams = new URLSearchParams(window.location.search);
      const tableParam = urlParams.get('table') || urlParams.get('t');
      const isQr = Boolean(tableParam);
      setIsCustomerQrMode(isQr);

      let matchedTable = null;
      if (tableParam && validTables.length > 0) {
        matchedTable = validTables.find(
          (t) => t.table_number.toLowerCase() === tableParam.toLowerCase() || t.qr_token === tableParam
        );
      }

      if (matchedTable) {
        setSelectedTable(matchedTable);
        setActiveTab('customer');
      } else if (!selectedTable && validTables.length > 0) {
        setSelectedTable(validTables[5] || validTables[0]); // Default to Dining Table DN-01
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  // Payment Audit Logs State
  const [paymentLogs, setPaymentLogs] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState({ total_cash: 0, total_upi: 0, total_card: 0, grand_total: 0, total_transactions: 0 });

  const fetchOrders = async () => {
    try {
      const [barRes, kitchenRes, allRes, payLogRes] = await Promise.all([
        apiFetch('/api/orders?target_dept=BAR'),
        apiFetch('/api/orders?target_dept=KITCHEN'),
        apiFetch('/api/orders'),
        apiFetch('/api/payments/log')
      ]);

      if (barRes.ok) setBarOrders(await barRes.json());
      if (kitchenRes.ok) setKitchenOrders(await kitchenRes.json());
      if (allRes.ok) setAllOrders(await allRes.json());
      if (payLogRes.ok) {
        const payData = await payLogRes.json();
        setPaymentLogs(payData.logs || []);
        setPaymentSummary(payData.summary || { total_cash: 0, total_upi: 0, total_card: 0, grand_total: 0, total_transactions: 0 });
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchOrders();
  }, [activeTab]);

  const playNotificationChime = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.15);
      gain2.gain.setValueAtTime(0.2, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.5);
    } catch (e) {
      console.warn("Audio chime error:", e);
    }
  };

  // Setup WebSocket connection safely with auto-reconnect and single-use tickets
  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;
    let isDisposed = false;

    const connectWs = async () => {
      try {
        let wsUrl = `${getWsBaseUrl()}/ws-api/${activeTab}`;
        // Authenticate staff/admin channels using short-lived single-use ticket
        if (activeTab !== 'customer') {
          try {
            const ticketRes = await apiFetch('/api/auth/ws-ticket', { method: 'POST' });
            if (ticketRes.ok) {
              const ticketData = await ticketRes.json();
              if (ticketData && ticketData.ticket) {
                wsUrl += `?ticket=${encodeURIComponent(ticketData.ticket)}`;
              }
            } else {
              console.warn("WebSocket ticket fetch unauthorized for channel:", activeTab);
              if (!isDisposed) {
                reconnectTimer = setTimeout(connectWs, 10000);
              }
              return;
            }
          } catch (ticketErr) {
            console.warn("Could not fetch WebSocket ticket:", ticketErr);
            if (!isDisposed) {
              reconnectTimer = setTimeout(connectWs, 5000);
            }
            return;
          }
        }

        if (isDisposed) return;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (!isDisposed) {
            setWsConnected(true);
            fetchOrders();
            fetchData();
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.event === 'STAFF_USER_DELETED' || data.type === 'STAFF_USER_DELETED') {
              fetchStaffUsers();
              const deletedId = data.user_id;
              const deletedEmail = (data.email || '').toLowerCase();
              const savedUserStr = localStorage.getItem('bermuda_user');
              if (savedUserStr) {
                try {
                  const saved = JSON.parse(savedUserStr);
                  if (saved.id === deletedId || (saved.email && saved.email.toLowerCase() === deletedEmail)) {
                    setCurrentUser(null);
                    localStorage.removeItem('bermuda_user');
                    setActiveTab('customer');
                    alert('Your staff account has been deleted by an administrator. Please sign in with valid credentials.');
                  }
                } catch (e) {}
              }
              return;
            }
            if (['NEW_ORDER', 'ORDER_STATUS_UPDATED', 'ITEM_STATUS_UPDATED', 'ITEM_NOTES_UPDATED', 'WAITER_CLAIMED_ORDER', 'TABLE_SETTLED', 'MENU_UPDATED', 'TABLE_STATUS_UPDATED', 'PAYMENT_COLLECTED', 'WAITER_CONFIRMED_ORDER', 'ORDER_ITEMS_ADDED', 'SETTINGS_UPDATED', 'TABLE_TRANSFERRED'].includes(data.event)) {
              if (['NEW_ORDER', 'ITEM_STATUS_UPDATED', 'ITEM_NOTES_UPDATED', 'WAITER_CLAIMED_ORDER', 'WAITER_CONFIRMED_ORDER', 'ORDER_ITEMS_ADDED', 'SETTINGS_UPDATED', 'TABLE_TRANSFERRED'].includes(data.event)) {
                // Bar and kitchen should only chime once order is accepted/confirmed by a waiter
                if (data.event === 'NEW_ORDER' && (activeTab === 'bar' || activeTab === 'kitchen')) {
                  // Customer order pending waiter confirmation
                } else {
                  playNotificationChime();
                }
              }
              if (data.event === 'SETTINGS_UPDATED' && data.settings) {
                setPubSettings(data.settings);
              }
              fetchOrders();
              fetchData();
            }
          } catch (e) {
            // Ignore non-JSON frames
          }
        };

        ws.onerror = () => {
          if (!isDisposed) setWsConnected(false);
        };

        ws.onclose = (event) => {
          if (!isDisposed) {
            setWsConnected(false);
            const delay = event && event.code === 1008 ? 10000 : 3000;
            reconnectTimer = setTimeout(connectWs, delay);
          }
        };
      } catch (err) {
        console.warn("WebSocket init error:", err);
      }
    };

    connectWs();

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [activeTab]);

  // Cart operations
  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product_id: product.id, product, quantity: 1, notes: '' }];
    });
  };

  const updateCartQuantity = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const updateCartItemNotes = (productId, notes) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, notes } : item
      )
    );
  };

  const clearCart = () => setCart([]);

  const submitOrder = async (customerName = "Guest") => {
    if (cart.length === 0 || !selectedTable) return null;

    const payload = {
      table_id: selectedTable.id,
      customer_name: customerName,
      items: cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        notes: item.notes || ''
      }))
    };

    try {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Order creation failed");

      const createdOrder = await res.json();
      setActiveCustomerOrder(createdOrder);
      clearCart();
      // Background async sync without blocking UI modal return
      Promise.all([fetchOrders(), fetchData()]).catch(console.error);
      return createdOrder;
    } catch (err) {
      console.error(err);
      alert("Error placing order. Please check local connection.");
      return null;
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const updateItemStatus = async (itemId, newStatus) => {
    try {
      await apiFetch(`/api/order-items/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const settleTableBill = async (tableId) => {
    try {
      await apiFetch(`/api/tables/${tableId}/settle`, { method: 'POST' });
      fetchOrders();
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const collectPayment = async (
    orderId, 
    paymentMode, 
    amount, 
    collectedBy = "Waiter",
    bookingPlatform = "Direct / Walk-in",
    discountPercentage = 0.0,
    discountAmount = 0.0,
    finalAmount = null,
    bookingReferenceId = null,
    beneficiaryName = null
  ) => {
    try {
      const isComplimentary = paymentMode === 'OTHER' || (bookingPlatform && bookingPlatform.includes('Complimentary'));
      const parsedSubtotal = parseFloat(amount || 0);
      const parsedDiscountPct = isComplimentary ? 100.0 : parseFloat(discountPercentage || 0);
      let parsedDiscountAmt = isComplimentary ? parsedSubtotal : parseFloat(discountAmount || 0);
      if (!isComplimentary && parsedDiscountAmt <= 0 && parsedDiscountPct > 0) {
        parsedDiscountAmt = parseFloat(((parsedSubtotal * parsedDiscountPct) / 100).toFixed(2));
      }
      const computedFinal = isComplimentary ? 0.0 : ((finalAmount !== null && finalAmount !== undefined && !isNaN(finalAmount))
        ? parseFloat(finalAmount)
        : (parsedDiscountAmt > 0 ? Math.max(0, parsedSubtotal - parsedDiscountAmt) : parsedSubtotal));

      const refId = beneficiaryName ? beneficiaryName.trim() : (bookingReferenceId ? bookingReferenceId.trim() : null);

      const res = await apiFetch(`/api/orders/${orderId}/collect-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_mode: paymentMode,
          amount_collected: computedFinal,
          collected_by: collectedBy,
          booking_platform: isComplimentary ? (bookingPlatform || 'Complimentary (Owners/MD/Bouncers)') : bookingPlatform,
          booking_reference_id: refId,
          beneficiary_name: refId,
          discount_percentage: parsedDiscountPct,
          discount_amount: parsedDiscountAmt,
          final_amount: computedFinal
        })
      });
      if (!res.ok) throw new Error("Payment collection failed");
      fetchOrders();
      fetchData();
      return true;
    } catch (err) {
      console.error(err);
      alert("Error logging payment collection");
      return false;
    }
  };

  const addProduct = async (productData) => {
    try {
      const res = await apiFetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      if (!res.ok) throw new Error("Failed to add product");
      await fetchData();
      return true;
    } catch (err) {
      console.error(err);
      alert("Error adding product");
      return false;
    }
  };

  const updateProductPrice = async (productId, newPrice) => {
    try {
      const res = await apiFetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: parseFloat(newPrice) })
      });
      if (!res.ok) throw new Error("Failed to update product price");
      await fetchData();
      return true;
    } catch (err) {
      console.error(err);
      alert("Error updating product price");
      return false;
    }
  };

  const toggleProductAvailability = async (productId, targetAvailability) => {
    try {
      await apiFetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: Boolean(targetAvailability) })
      });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const triggerSync = async () => {
    try {
      const res = await apiFetch('/api/sync/trigger', { method: 'POST' });
      const data = await res.json();
      alert(data.message);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const claimOrderAsWaiter = async (orderId, waiterName = 'Waiter') => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/claim?waiter_name=${encodeURIComponent(waiterName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waiter_name: waiterName })
      });
      if (res.ok) {
        await fetchOrders();
        await fetchData();
        return true;
      }
    } catch (err) {
      console.error("Error claiming order as waiter:", err);
    }
    return false;
  };

  const confirmOrderAsWaiter = async (orderId, waiterName = 'Waiter', updatedItemNotes = null) => {
    try {
      const payload = {
        waiter_name: waiterName,
        updated_item_notes: updatedItemNotes || null
      };
      const res = await apiFetch(`/api/orders/${orderId}/waiter-confirm?waiter_name=${encodeURIComponent(waiterName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchOrders();
        await fetchData();
        return true;
      }
    } catch (err) {
      console.error("Error confirming order as waiter:", err);
    }
    return false;
  };

  const updateOrderItemNotes = async (orderId, itemId, notes) => {
    try {
      const res = await apiFetch(`/api/order-items/${itemId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
      if (res.ok) {
        setAllOrders((prev) =>
          prev.map((ord) => {
            if (ord.id === orderId) {
              return {
                ...ord,
                items: ord.items.map((it) => (it.id === itemId ? { ...it, notes } : it))
              };
            }
            return ord;
          })
        );
        return true;
      }
    } catch (err) {
      console.error("Error updating order item notes:", err);
    }
    return false;
  };

  const addItemsToOrder = async (orderId, items, waiterName = 'Waiter') => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/add-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, waiter_name: waiterName })
      });
      if (res.ok) {
        await fetchOrders();
        await fetchData();
        return true;
      }
    } catch (err) {
      console.error("Error adding items to order:", err);
    }
    return false;
  };

  const deleteOrderItem = async (itemId) => {
    try {
      const res = await apiFetch(`/api/order-items/${itemId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchOrders();
        await fetchData();
        return true;
      }
    } catch (err) {
      console.error("Error deleting order item:", err);
    }
    return false;
  };

  const deleteSinglePaymentLog = async (orderId) => {
    try {
      const res = await apiFetch(`/api/payments/log/${orderId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchOrders();
        await fetchData();
        return true;
      }
    } catch (err) {
      console.error("Error deleting single payment log:", err);
    }
    return false;
  };

  const clearAllPaymentLogs = async () => {
    try {
      const res = await apiFetch('/api/payments/log', { method: 'DELETE' });
      if (res.ok) {
        await fetchOrders();
        await fetchData();
        return true;
      }
    } catch (err) {
      console.error("Error clearing all payment logs:", err);
    }
    return false;
  };

  const clearMemberEntryLogs = async () => {
    try {
      const res = await apiFetch('/api/members/entry-logs', { method: 'DELETE' });
      if (res.ok) {
        await fetchEntryLogs();
        return true;
      }
    } catch (err) {
      console.error("Error clearing member entry logs:", err);
    }
    return false;
  };

  const importExcelMenu = async () => {
    try {
      const res = await apiFetch('/api/menu/import-excel', { method: 'POST' });
      if (res.ok) {
        await fetchData();
        return true;
      }
    } catch (err) {
      console.error("Error importing Excel menu:", err);
    }
    return false;
  };

  const uploadImage = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiFetch('/api/upload-image', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        return data.image_url;
      }
    } catch (err) {
      console.error("Error uploading image:", err);
    }
    return null;
  };

  const updateProduct = async (productId, productData) => {
    try {
      const res = await apiFetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      if (res.ok) {
        await fetchData();
        return true;
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("Failed to update product:", errData);
        alert(errData.detail || "Failed to update item");
      }
    } catch (err) {
      console.error("Error updating product:", err);
      alert("Network error updating product");
    }
    return false;
  };

  const deleteProduct = async (productId) => {
    try {
      const res = await apiFetch(`/api/products/${productId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
        return true;
      }
    } catch (err) {
      console.error("Error deleting product:", err);
    }
    return false;
  };

  // Member Card Management
  const [members, setMembers] = useState([]);

  const fetchMembers = async (query = '') => {
    try {
      const url = query ? `/api/members?q=${encodeURIComponent(query)}` : '/api/members';
      const res = await apiFetch(url);
      if (res.ok) setMembers(await res.json());
    } catch (e) {
      console.error("Error fetching members:", e);
    }
  };

  const createMember = async (memberData) => {
    try {
      const res = await apiFetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberData)
      });
      if (res.ok) {
        await fetchMembers();
        const created = await res.json();
        return { success: true, member: created };
      } else {
        const err = await res.json();
        return { success: false, error: err.detail || 'Failed to create member card' };
      }
    } catch (err) {
      console.error(err);
      return { success: false, error: 'Network error creating member card' };
    }
  };

  const updateMember = async (memberId, memberData) => {
    try {
      const res = await apiFetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberData)
      });
      if (res.ok) {
        await fetchMembers();
        return true;
      }
    } catch (err) {
      console.error(err);
    }
    return false;
  };

  const deleteMember = async (memberId) => {
    try {
      const res = await apiFetch(`/api/members/${memberId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchMembers();
        return true;
      }
    } catch (err) {
      console.error(err);
    }
    return false;
  };

  // Member Entry Audit Logs State
  const [entryLogs, setEntryLogs] = useState([]);

  const fetchEntryLogs = async () => {
    try {
      const res = await apiFetch('/api/members/entry-logs');
      if (res.ok) setEntryLogs(await res.json());
    } catch (e) {
      console.error("Error fetching entry logs:", e);
    }
  };

  const recordMemberVisit = async (memberId) => {
    try {
      const res = await apiFetch(`/api/members/${memberId}/record-visit`, { method: 'POST' });
      if (res.ok) {
        await fetchMembers();
        await fetchEntryLogs();
        return true;
      }
    } catch (err) {
      console.error(err);
    }
    return false;
  };

  const bulkImportMembers = async (membersList) => {
    try {
      const res = await apiFetch('/api/members/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(membersList)
      });
      const data = await res.json();
      if (res.ok) {
        await fetchMembers();
        return { success: true, ...data };
      }
      return { success: false, error: data.detail || 'Bulk import failed' };
    } catch (err) {
      console.error(err);
      return { success: false, error: 'Network error bulk importing members' };
    }
  };

  return (
    <OrderContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedTable,
        setSelectedTable,
        tables,
        zones,
        categories,
        products,
        cart,
        addToCart,
        updateCartQuantity,
        updateCartItemNotes,
        clearCart,
        submitOrder,
        addonsData,
        updateOrderItemNotes,
        activeCustomerOrder,
        fetchTables,
        addPubTable,
        updatePubTable,
        deletePubTable,
        barOrders,
        kitchenOrders,
        allOrders,
        updateOrderStatus,
        updateItemStatus,
        settleTableBill,
        collectPayment,
        syncStatus,
        triggerSync,
        wsConnected,
        theme,
        setTheme,
        addProduct,
        updateProduct,
        updateProductPrice,
        deleteProduct,
        toggleProductAvailability,
        isCustomerQrMode,
        setIsCustomerQrMode,
        paymentLogs,
        paymentSummary,
        isSidebarOpen,
        setIsSidebarOpen: setSidebarVisibility,
        toggleSidebar,
        autoHideOnSelect,
        setAutoHideOnSelect: setAutoHidePreference,
        claimOrderAsWaiter,
        confirmOrderAsWaiter,
        addItemsToOrder,
        deleteOrderItem,
        currentUser,
        loginUser,
        logoutUser,
        staffUsers,
        fetchStaffUsers,
        createStaffAccount,
        updateStaffAccount,
        deleteStaffAccount,
        switchOrderTable,
        members,
        fetchMembers,
        createMember,
        updateMember,
        deleteMember,
        recordMemberVisit,
        entryLogs,
        fetchEntryLogs,
        bulkImportMembers,
        deleteSinglePaymentLog,
        clearAllPaymentLogs,
        clearMemberEntryLogs,
        importExcelMenu,
        uploadImage,
        pubSettings,
        updatePubSettings
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export const useOrder = () => useContext(OrderContext);
