import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import BermudaLogo from '../components/BermudaLogo';
import { ShoppingBag, Plus, Minus, Check, Wine, Utensils, Search, Sparkles, Clock, ChevronDown, ChevronUp, AlertCircle, Receipt } from 'lucide-react';

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
    activeCustomerOrder
  } = useOrder();

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderTrackerOpen, setIsOrderTrackerOpen] = useState(true);
  const [customerName, setCustomerName] = useState('Guest');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'ALL' || p.category_id === Number(selectedCategory);
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
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
    <div className="pb-28 w-full px-4 sm:px-6 lg:px-8 pt-3 sm:pt-6">
      {/* Executive Real Cocktail Bar Atmosphere Hero Banner */}
      <div className="relative w-full rounded-2xl mb-6 shadow-2xl border-2 border-amber-800/50 overflow-hidden bg-slate-950 p-5 sm:p-6 min-h-[160px] flex items-center justify-between">
        {/* Real High-Def Cocktail Bar Photography Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-50 scale-105 transition-transform duration-1000 hover:scale-100 pointer-events-none"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1600&q=80')` }}
        />
        {/* Executive Dark Amber Gradient Mask */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-transparent pointer-events-none" />

        {/* Left Content Area */}
        <div className="relative z-10 max-w-xl space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-amber-500/20 text-amber-300 text-[11px] font-bold px-3 py-1 rounded-full border border-amber-500/40 flex items-center gap-1.5 shadow-md backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> SCANNED QR TABLE
            </span>
            <span className="bg-slate-900/90 text-slate-200 text-[11px] font-semibold px-3 py-1 rounded-full border border-slate-700 backdrop-blur-md">
              {selectedTable?.zone?.display_name || 'Main Zone'} • {selectedTable?.capacity || 4}-Seater
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-amber-300 tracking-tight drop-shadow-md">
              Table {selectedTable?.table_number || 'DN-01'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 font-medium mt-1 leading-relaxed max-w-lg drop-shadow">
              Welcome to <span className="text-amber-400 font-bold">The BerMuda Cocktail Pub</span>. Order drinks directly to Bar counter & food to Kitchen station!
            </p>
          </div>
        </div>

        {/* Top-Right Department Badges */}
        <div className="relative z-20 hidden sm:flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 bg-slate-950/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-amber-700/50 text-xs shadow-xl">
            <span className="flex items-center gap-1.5 font-bold text-purple-300">
              <Wine className="w-4 h-4 text-purple-400" /> Bar Counter
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1.5 font-bold text-emerald-300">
              <Utensils className="w-4 h-4 text-emerald-400" /> Kitchen Station
            </span>
          </div>
          <span className="text-[10px] font-bold text-amber-400/90 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20 font-mono">
            LIVE TABLE QR POS
          </span>
        </div>
      </div>

      {/* Customer Live Order Summary Drawer (Shows Drinks & Food Ordered) */}
      {activeCustomerOrder && (
        <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 mb-5 shadow-xl transition-all">
          <div
            onClick={() => setIsOrderTrackerOpen(!isOrderTrackerOpen)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  LIVE ORDER #{activeCustomerOrder.order_number}
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                </div>
                <div className="text-xs text-slate-300 font-semibold">
                  Status: <span className="text-amber-300 font-bold uppercase">{activeCustomerOrder.status}</span> • Total ₹{activeCustomerOrder.total_amount}
                </div>
              </div>
            </div>

            <button className="text-slate-400 p-1">
              {isOrderTrackerOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>

          {/* Expanded Live Item Details */}
          {isOrderTrackerOpen && (
            <div className="mt-4 pt-3 border-t border-slate-800 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Items Ordered ({activeCustomerOrder.items.length}):
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {activeCustomerOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 font-bold">{item.quantity}x</span>
                      <span className="font-bold text-slate-200">{item.product?.name || `Product #${item.product_id}`}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                        item.target_dept === 'BAR' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {item.target_dept === 'BAR' ? '🍸 Bar' : '🍳 Kitchen'}
                      </span>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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

      {/* Sticky Mobile Search & Category Pills */}
      <div className="sticky top-14 z-30 bg-slate-950/95 backdrop-blur-md pt-2 pb-3 border-b border-slate-800/80 mb-4 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search cocktails, mocktails, burgers, nachos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        {/* Horizontal Category Scrollbar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              selectedCategory === 'ALL'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            All Items ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id.toString())}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                selectedCategory === cat.id.toString()
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              <span>{cat.icon}</span> {cat.name}
              <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                cat.target_dept === 'BAR' ? 'bg-purple-900 text-purple-200' : 'bg-emerald-900 text-emerald-200'
              }`}>
                {cat.target_dept}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile-Optimized Menu Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredProducts.map((product) => {
          const inCart = cart.find((item) => item.product_id === product.id);
          const isBar = product.target_dept === 'BAR';
          const thumbUrl = productThumbnails[product.id] || (isBar 
            ? 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=300&q=80'
            : 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=300&q=80');

          return (
            <div
              key={product.id}
              className="bg-slate-900/90 border border-amber-800/40 hover:border-amber-500/60 rounded-2xl p-4 flex flex-col justify-between transition-all shadow-xl hover:shadow-2xl group relative overflow-hidden backdrop-blur-md"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                {/* Left Info Column */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      isBar ? 'bg-purple-950/80 text-purple-300 border border-purple-500/30' : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {isBar ? <Wine className="w-3 h-3" /> : <Utensils className="w-3 h-3" />}
                      {isBar ? 'Bar Drink' : 'Kitchen Food'}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-slate-100 text-base group-hover:text-amber-400 transition mb-1 leading-snug">
                    {product.name}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {product.description || 'Prepared fresh at Bermuda Cocktail pub.'}
                  </p>
                </div>

                {/* Right Image Thumbnail Column */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="font-black text-amber-400 text-lg sm:text-xl font-mono">
                    ₹{product.price}
                  </span>
                  <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-slate-800 shadow-md bg-slate-950 group-hover:scale-105 transition-transform duration-300">
                    <img
                      src={thumbUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>

              {/* Stepper & Add Button */}
              <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80 mt-1">
                <span className="text-[10px] text-slate-500 font-mono">ID #{product.id}</span>

                {inCart ? (
                  <div className="flex items-center gap-2 bg-slate-950 rounded-xl p-1 border border-amber-500/40 shadow-inner">
                    <button
                      onClick={() => updateCartQuantity(product.id, -1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200 font-bold transition"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-black text-amber-400 text-sm">
                      {inCart.quantity}
                    </span>
                    <button
                      onClick={() => updateCartQuantity(product.id, 1)}
                      className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-400 flex items-center justify-center text-slate-950 font-bold shadow-md transition"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(product)}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-black px-4 py-1.5 rounded-xl shadow-md transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Cart Bar for Mobile */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-40">
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-4 py-3 rounded-2xl shadow-2xl shadow-amber-500/40 flex items-center justify-between border border-amber-400">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center font-black text-xs">
                {cartCount}
              </div>
              <div>
                <div className="text-[10px] uppercase font-extrabold text-slate-900 tracking-wider">Cart Total</div>
                <div className="text-base font-black text-slate-950">₹{cartTotal}</div>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="bg-slate-950 hover:bg-slate-900 text-amber-400 px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md transition"
            >
              <ShoppingBag className="w-4 h-4" /> View Cart & Order
            </button>
          </div>
        </div>
      )}

      {/* Cart Review Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col justify-between p-5 shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <div>
                  <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-amber-400" /> Confirm Table Order
                  </h3>
                  <p className="text-xs text-slate-400">Table: {selectedTable?.table_number}</p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Cart Items List */}
              <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.product_id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-slate-200 flex items-center gap-1.5">
                        {item.product.name}
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                          item.product.target_dept === 'BAR' ? 'bg-purple-900 text-purple-300' : 'bg-emerald-900 text-emerald-300'
                        }`}>
                          {item.product.target_dept === 'BAR' ? 'Bar' : 'Kitchen'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">₹{item.product.price} x {item.quantity} = ₹{item.product.price * item.quantity}</div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateCartQuantity(item.product_id, -1)}
                        className="w-6 h-6 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="font-bold text-xs text-amber-400 w-4 text-center">{item.quantity}</span>
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
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-base font-black text-slate-100">
                <span>Total Amount:</span>
                <span className="text-amber-400 text-xl">₹{cartTotal}</span>
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-purple-400 font-semibold">
                  <span>🍸 Drinks ({cart.filter(c => c.product.target_dept === 'BAR').length}):</span>
                  <span>Routes to Bar</span>
                </div>
                <div className="flex items-center justify-between text-emerald-400 font-semibold">
                  <span>🍳 Food ({cart.filter(c => c.product.target_dept === 'KITCHEN').length}):</span>
                  <span>Routes to Kitchen</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3.5 rounded-xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition active:scale-95"
              >
                {isSubmitting ? 'Placing Order...' : 'Confirm & Send to Bar/Kitchen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
