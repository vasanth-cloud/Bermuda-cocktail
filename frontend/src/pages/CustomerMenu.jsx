import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import BermudaLogo from '../components/BermudaLogo';
import { 
  ShoppingBag, Plus, Minus, Check, Wine, Utensils, Search, 
  Sparkles, Clock, ChevronDown, ChevronUp, AlertCircle, Receipt, X 
} from 'lucide-react';

const productThumbnails = {
  1: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=300&q=80', // Blue Lagoon
  2: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=300&q=80', // Old Fashioned
  3: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=300&q=80', // Mojito
  4: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=300&q=80', // LIIT
  5: 'https://images.unsplash.com/photo-1546171753-97d7676e4602?auto=format&fit=crop&w=300&q=80', // Pina Colada
  6: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=300&q=80', // Watermelon Splash
  7: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=300&q=80', // Spicy Wings
  8: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=300&q=80', // Truffle Fries
  9: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=300&q=80', // Nachos
};

export default function CustomerMenu() {
  const {
    selectedTable,
    categories,
    products,
    cart,
    addToCart,
    updateCartQuantity,
    submitOrder,
    activeCustomerOrder,
    allOrders,
    confirmOrderAsWaiter,
    setActiveTab,
    currentUser,
    isCustomerQrMode
  } = useOrder();

  const [selectedDept, setSelectedDept] = useState('ALL'); // ALL, KITCHEN, BAR
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderTrackerOpen, setIsOrderTrackerOpen] = useState(true);
  const [customerName, setCustomerName] = useState('Guest');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tableActiveOrder = allOrders?.find(o => o.table_id === selectedTable?.id && o.status !== 'BILLED');

  const filteredCategories = categories.filter((cat) => {
    if (selectedDept === 'ALL') return true;
    return (cat.target_dept || '').toUpperCase() === selectedDept;
  });

  const filteredProducts = products.filter((p) => {
    const deptUpper = (p.target_dept || '').toUpperCase();
    const matchesDept = selectedDept === 'ALL' || deptUpper === selectedDept;
    const matchesCat = selectedCategory === 'ALL' || p.category_id === Number(selectedCategory);
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesDept && matchesCat && matchesSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    const result = await submitOrder(customerName);
    setIsSubmitting(false);
    if (result) {
      setIsCartOpen(false);
    }
  };

  return (
    <div className="pb-28 w-full px-3 sm:px-6 lg:px-8 pt-2 sm:pt-4 font-sans text-slate-100 bg-slate-950 min-h-screen">
      {/* WAITER POS CONTROL BAR WITH 2 OPTIONS (WHEN WAITER OPENS MENU PAGE) */}
      {!isCustomerQrMode && currentUser && (
        <div className="bg-gradient-to-r from-slate-900 via-amber-950/90 to-slate-900 border-2 border-amber-500/70 p-3.5 rounded-2xl mb-3.5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🍸</span>
            <div>
              <div className="font-black text-amber-300 flex items-center gap-2 text-sm">
                <span>Table {selectedTable?.table_number || 'DN-01'} — Menu View</span>
                {tableActiveOrder && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold uppercase border border-amber-500/40">
                    Order Status: {tableActiveOrder.status}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 font-medium">
                Logged in Waiter: <strong className="text-white font-extrabold">{currentUser.name}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* OPTION 1: EDIT / ADD ITEMS TO CART */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="flex-1 md:flex-initial bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/50 px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
            >
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              <span>✏️ 1. Edit / Add Items ({cartCount})</span>
            </button>

            {/* OPTION 2: CONFIRM ORDER & SEND TO BAR/KITCHEN */}
            <button
              disabled={isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                const claimingWaiter = currentUser?.name || 'Waiter';
                
                // 1. Submit cart items if waiter added extra items
                let newOrderObj = null;
                if (cart.length > 0) {
                  newOrderObj = await submitOrder(claimingWaiter);
                }
                
                // 2. Find any pending/unconfirmed order for this table
                const pendingOrd = allOrders?.find(
                  o => Number(o.table_id) === Number(selectedTable?.id) && 
                  (o.status === 'PENDING' || o.status === 'PENDING_WAITER')
                ) || newOrderObj || tableActiveOrder;

                if (pendingOrd && pendingOrd.id) {
                  await confirmOrderAsWaiter(pendingOrd.id, claimingWaiter);
                }

                setIsSubmitting(false);
                setActiveTab('staff');
              }}
              className="flex-1 md:flex-initial bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>⚡ 2. Confirm Order & Send to Bar/Kitchen ({currentUser?.name || 'Waiter'})</span>
            </button>

            {/* RETURN TO FLOOR MAP */}
            <button
              onClick={() => setActiveTab('staff')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center"
              title="Return to Waiter Floor Map"
            >
              🔙 Floor
            </button>
          </div>
        </div>
      )}

      {/* MOBILE COMPACT HEADER BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-5 mb-3 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black text-lg">
            🍸
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-500/30 uppercase font-mono">
                Table {selectedTable?.table_number || 'DN-01'}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">
                {selectedTable?.zone?.display_name || 'Pub Area'}
              </span>
            </div>
            <h1 className="text-base sm:text-2xl font-black text-slate-100 tracking-tight leading-tight mt-0.5">
              The Bermuda Pub Menu
            </h1>
          </div>
        </div>

        <button
          onClick={() => setIsCartOpen(true)}
          className="relative bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition active:scale-95"
        >
          <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
          <span className="hidden sm:inline">Cart</span>
          {cartCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-slate-950 text-amber-400 text-[10px] font-mono font-black flex items-center justify-center shadow">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Customer Live Order Summary Drawer */}
      {activeCustomerOrder && (
        <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-3 mb-3 shadow-lg transition-all text-xs">
          <div
            onClick={() => setIsOrderTrackerOpen(!isOrderTrackerOpen)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  ORDER #{activeCustomerOrder.order_number}
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                </div>
                <div className="text-[11px] text-slate-300 font-semibold">
                  Status: <span className="text-amber-300 font-bold uppercase">{activeCustomerOrder.status}</span> • Total ₹{activeCustomerOrder.total_amount}
                </div>
              </div>
            </div>

            <button className="text-slate-400 p-1">
              {isOrderTrackerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Expanded Live Item Details */}
          {isOrderTrackerOpen && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Items Ordered ({activeCustomerOrder.items.length}):
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {activeCustomerOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950 border border-slate-800 p-2 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 font-bold">{item.quantity}x</span>
                      <span className="font-bold text-slate-200">{item.product?.name || `Product #${item.product_id}`}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                        (item.target_dept || '').toUpperCase() === 'BAR' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {(item.target_dept || '').toUpperCase() === 'BAR' ? '🍸 Bar' : '🍳 Kitchen'}
                      </span>

                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                        item.status === 'READY' || item.status === 'SERVED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sticky Mobile Search & Horizontal Category Scrollbar */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md pt-1 pb-2 border-b border-slate-800/80 mb-3 space-y-2">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search cocktails, beer, food, desserts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        {/* TOP LEVEL CLASSIFICATION TABS: ALL ITEMS, FOOD, DRINKS & LIQUOR */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => {
              setSelectedDept('ALL');
              setSelectedCategory('ALL');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 shrink-0 ${
              selectedDept === 'ALL'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            <span>✨ All Items ({products.length})</span>
          </button>

          <button
            onClick={() => {
              setSelectedDept('KITCHEN');
              setSelectedCategory('ALL');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 shrink-0 ${
              selectedDept === 'KITCHEN'
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            <span>🍔 Food & Kitchen ({products.filter(p => (p.target_dept || '').toUpperCase() === 'KITCHEN').length})</span>
          </button>

          <button
            onClick={() => {
              setSelectedDept('BAR');
              setSelectedCategory('ALL');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 shrink-0 ${
              selectedDept === 'BAR'
                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-slate-950 shadow-md shadow-purple-500/20'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            <span>🍸 Drinks & Liquor ({products.filter(p => (p.target_dept || '').toUpperCase() === 'BAR').length})</span>
          </button>
        </div>

        {/* Sub-Category Scrollbar (Filtered by selected department) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              selectedCategory === 'ALL'
                ? 'bg-slate-200 text-slate-950 font-black shadow'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            All Sub-Categories ({filteredProducts.length})
          </button>
          {filteredCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id.toString())}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1 ${
                selectedCategory === cat.id.toString()
                  ? 'bg-slate-200 text-slate-950 font-black shadow'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              <span>{cat.icon}</span> {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* MOBILE-OPTIMIZED CLEAN ITEM LIST */}
      <div className="space-y-2.5 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3 sm:space-y-0">
        {filteredProducts.map((product) => {
          const inCart = cart.find((item) => item.product_id === product.id);
          const isBar = (product.target_dept || '').toUpperCase() === 'BAR';
          const isAvailable = product.is_available ?? true;
          const thumbUrl = productThumbnails[product.id] || (isBar 
            ? 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=300&q=80'
            : 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=300&q=80');

          return (
            <div
              key={product.id}
              className={`bg-slate-900/90 border ${!isAvailable ? 'border-rose-950/60 opacity-70' : 'border-slate-800/80 hover:border-amber-500/50'} rounded-xl p-3 flex items-center justify-between gap-3 shadow-md transition`}
            >
              {/* Left Thumbnail Image */}
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 shrink-0 relative">
                <img
                  src={thumbUrl}
                  alt={product.name}
                  className={`w-full h-full object-cover ${!isAvailable ? 'grayscale opacity-50' : ''}`}
                  loading="lazy"
                />
              </div>

              {/* Middle Product Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded font-mono ${
                    isBar ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}>
                    {isBar ? '🍸 Bar' : '🍳 Kitchen'}
                  </span>

                  {!isAvailable && (
                    <span className="text-[9px] font-bold text-rose-400 bg-rose-950/60 px-1.5 py-0.2 rounded border border-rose-800">
                      Sold Out
                    </span>
                  )}
                </div>

                <h3 className={`font-black text-xs sm:text-sm ${!isAvailable ? 'text-slate-400 line-through' : 'text-slate-100'}`}>
                  {product.name}
                </h3>

                {product.description && (
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-tight font-medium">
                    {product.description}
                  </p>
                )}

                <div className="font-extrabold text-xs text-amber-400 mt-1">
                  ₹{product.price}
                </div>
              </div>

              {/* Right Add / Stepper Button */}
              <div className="shrink-0">
                {!isAvailable ? (
                  <span className="text-[10px] text-rose-400 font-bold bg-rose-950/40 px-2 py-1 rounded">
                    Unavailable
                  </span>
                ) : inCart ? (
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-amber-500/40">
                    <button
                      onClick={() => updateCartQuantity(product.id, -1)}
                      className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-4 text-center font-black text-amber-400 text-xs">
                      {inCart.quantity}
                    </span>
                    <button
                      onClick={() => updateCartQuantity(product.id, 1)}
                      className="w-6 h-6 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-xs shadow"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(product)}
                    className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-black px-3 py-1.5 rounded-xl shadow transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FLOATING STICKY BOTTOM CART BAR FOR MOBILE */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[94%] max-w-md z-40">
          <div className="bg-amber-500 text-slate-950 px-4 py-2.5 rounded-2xl shadow-2xl shadow-amber-500/40 flex items-center justify-between border border-amber-400">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-950 text-amber-400 flex items-center justify-center font-black text-xs">
                {cartCount}
              </div>
              <div>
                <div className="text-[10px] uppercase font-black text-slate-900 tracking-wider leading-none">Cart Total</div>
                <div className="text-sm font-black text-slate-950 leading-tight">₹{cartTotal}</div>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="bg-slate-950 hover:bg-slate-900 text-amber-400 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow transition"
            >
              <ShoppingBag className="w-3.5 h-3.5" /> View Order & Submit ➔
            </button>
          </div>
        </div>
      )}

      {/* MOBILE SLIDE-UP CART REVIEW MODAL */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border-t sm:border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col justify-between p-5 shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <div>
                  <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-amber-400" /> Review & Submit Order
                  </h3>
                  <p className="text-xs text-slate-400">Table: {selectedTable?.table_number || 'DN-01'}</p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Cart Items List */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.product_id} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-200 flex items-center gap-1.5">
                        {item.product.name}
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                          (item.product?.target_dept || '').toUpperCase() === 'BAR' ? 'bg-purple-900 text-purple-300' : 'bg-emerald-900 text-emerald-300'
                        }`}>
                          {(item.product?.target_dept || '').toUpperCase() === 'BAR' ? 'Bar' : 'Kitchen'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">₹{item.product.price} x {item.quantity} = ₹{item.product.price * item.quantity}</div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateCartQuantity(item.product_id, -1)}
                        className="w-6 h-6 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center text-xs font-bold"
                      >
                        -
                      </button>
                      <span className="font-black text-xs text-amber-400 w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item.product_id, 1)}
                        className="w-6 h-6 rounded bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Section */}
            <div className="pt-3 border-t border-slate-800 space-y-3 mt-3">
              <div className="flex justify-between items-center text-sm font-black text-slate-100">
                <span>Total Amount:</span>
                <span className="text-amber-400 text-lg">₹{cartTotal}</span>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition active:scale-95"
              >
                {isSubmitting ? 'Sending Order...' : 'Confirm & Send to Bar/Kitchen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
