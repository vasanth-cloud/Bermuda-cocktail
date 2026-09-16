import React, { createContext, useContext, useState, useEffect } from 'react';

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
  
  // Offline Sync State & Connection
  const [syncStatus, setSyncStatus] = useState({ pending_sync_count: 0, connection_mode: 'OFFLINE_LOCAL_SERVER' });
  const [wsConnected, setWsConnected] = useState(false);
  const [isCustomerQrMode, setIsCustomerQrMode] = useState(false);
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

  const fetchStaffUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) setStaffUsers(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const loginUser = async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
        localStorage.setItem('bermuda_user', JSON.stringify(data.user));
        if (data.user.role === 'WAITER') setActiveTab('staff');
        else if (data.user.role === 'BAR_RECEPTION') setActiveTab('bar');
        else if (data.user.role === 'KITCHEN_CHEF') setActiveTab('kitchen');
        else if (data.user.role === 'ADMIN') setActiveTab('admin');
        return { success: true };
      }
      return { success: false, error: data.detail || 'Login failed' };
    } catch (err) {
      return { success: false, error: 'Server connection failed' };
    }
  };

  const logoutUser = () => {
    setCurrentUser(null);
    localStorage.removeItem('bermuda_user');
    setActiveTab('customer');
  };

  const createStaffAccount = async (userData) => {
    try {
      const res = await fetch('/api/users', {
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

  const deleteStaffAccount = async (userId) => {
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchStaffUsers();
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
      const [zonesRes, tablesRes, catRes, prodRes, syncRes] = await Promise.all([
        fetch('/api/zones'),
        fetch('/api/tables'),
        fetch('/api/categories'),
        fetch('/api/products'),
        fetch('/api/sync/status')
      ]);

      const zonesData = await zonesRes.json();
      const tablesData = await tablesRes.json();
      const catData = await catRes.json();
      const prodData = await prodRes.json();
      const syncData = await syncRes.json();

      setZones(Array.isArray(zonesData) ? zonesData : []);
      const validTables = Array.isArray(tablesData) ? tablesData : [];
      setTables(validTables);
      setCategories(Array.isArray(catData) ? catData : []);
      setProducts(Array.isArray(prodData) ? prodData : []);
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
        fetch('/api/orders?target_dept=BAR'),
        fetch('/api/orders?target_dept=KITCHEN'),
        fetch('/api/orders'),
        fetch('/api/payments/log')
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
  }, []);

  // Setup WebSocket connection safely
  useEffect(() => {
    let ws = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws-api/${activeTab}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'NEW_ORDER' || data.event === 'ORDER_STATUS_UPDATED' || data.event === 'ITEM_STATUS_UPDATED' || data.event === 'TABLE_SETTLED' || data.event === 'MENU_UPDATED') {
            fetchOrders();
            fetchData();
          }
        } catch (e) {
          // Ignore non-JSON frames
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
      };

      ws.onclose = () => {
        setWsConnected(false);
      };
    } catch (err) {
      console.warn("WebSocket init error:", err);
    }

    return () => {
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
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Order creation failed");

      const createdOrder = await res.json();
      setActiveCustomerOrder(createdOrder);
      clearCart();
      fetchOrders();
      fetchData();
      return createdOrder;
    } catch (err) {
      console.error(err);
      alert("Error placing order. Please check local connection.");
      return null;
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await fetch(`/api/orders/${orderId}/status`, {
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
      await fetch(`/api/order-items/${itemId}/status`, {
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
      await fetch(`/api/tables/${tableId}/settle`, { method: 'POST' });
      fetchOrders();
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const collectPayment = async (orderId, paymentMode, amount, collectedBy = "Waiter") => {
    try {
      const res = await fetch(`/api/orders/${orderId}/collect-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_mode: paymentMode,
          amount_collected: parseFloat(amount),
          collected_by: collectedBy
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
      const res = await fetch('/api/products', {
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
      const res = await fetch(`/api/products/${productId}`, {
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
      await fetch(`/api/products/${productId}`, {
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
      const res = await fetch('/api/sync/trigger', { method: 'POST' });
      const data = await res.json();
      alert(data.message);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const confirmOrderAsWaiter = async (orderId, waiterName = 'Waiter') => {
    try {
      const res = await fetch(`/api/orders/${orderId}/waiter-confirm?waiter_name=${encodeURIComponent(waiterName)}`, {
        method: 'POST'
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

  const addItemsToOrder = async (orderId, items, waiterName = 'Waiter') => {
    try {
      const res = await fetch(`/api/orders/${orderId}/add-items`, {
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
      const res = await fetch(`/api/order-items/${itemId}`, { method: 'DELETE' });
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

  const updateProduct = async (productId, productData) => {
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      if (res.ok) {
        await fetchData();
        return true;
      }
    } catch (err) {
      console.error("Error updating product:", err);
    }
    return false;
  };

  const deleteProduct = async (productId) => {
    try {
      const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
        return true;
      }
    } catch (err) {
      console.error("Error deleting product:", err);
    }
    return false;
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
        clearCart,
        submitOrder,
        activeCustomerOrder,
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
        confirmOrderAsWaiter,
        addItemsToOrder,
        deleteOrderItem,
        currentUser,
        loginUser,
        logoutUser,
        staffUsers,
        fetchStaffUsers,
        createStaffAccount,
        deleteStaffAccount
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export const useOrder = () => useContext(OrderContext);
