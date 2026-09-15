import React from 'react';
import { useOrder } from '../context/OrderContext';
import { UtensilsCrossed, Clock, Check, Flame, AlertCircle } from 'lucide-react';

export default function KitchenKDS() {
  const { kitchenOrders, updateItemStatus, updateOrderStatus } = useOrder();

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
              Kitchen Display System (KDS)
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                FOOD ORDERS ONLY
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Direct offline food routing. Receives food & starter orders automatically from customer table scans.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-xs font-bold text-emerald-400">
          <Flame className="w-4 h-4 animate-bounce" /> Live Kitchen Station Active
        </div>
      </div>

      {/* Food Tickets Grid */}
      {kitchenOrders.length === 0 ? (
        <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500">
          <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-30 text-emerald-400" />
          <h3 className="text-lg font-bold text-slate-300">No Food Orders in Kitchen Queue</h3>
          <p className="text-xs">Scan a table QR code in Customer Menu view and order food items to see live kitchen tickets.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kitchenOrders.map((order) => {
            const foodItems = order.items.filter((it) => it.target_dept === 'KITCHEN');
            if (foodItems.length === 0) return null;

            return (
              <div
                key={order.id}
                className="bg-slate-900 border border-emerald-500/30 hover:border-emerald-500 rounded-2xl p-5 shadow-2xl flex flex-col justify-between"
              >
                <div>
                  {/* Ticket Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <div>
                      <span className="text-2xl font-black text-slate-100 block">
                        Table {order.table?.table_number || 'ST-01'}
                      </span>
                      <span className="text-xs font-mono text-slate-400">#{order.order_number}</span>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="flex items-center gap-1 text-xs font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded-lg">
                        <Clock className="w-3 h-3" /> Just now
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1 uppercase font-bold">{order.table?.zone?.display_name}</span>
                    </div>
                  </div>

                  {/* Food Items List */}
                  <div className="space-y-3 mb-4">
                    {foodItems.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <div className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-black">
                              {item.quantity}x
                            </span>
                            {item.product?.name || `Product #${item.product_id}`}
                          </div>
                          {item.notes && (
                            <div className="text-xs text-amber-400 italic mt-1 bg-amber-950/40 px-2 py-0.5 rounded">
                              Note: "{item.notes}"
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => updateItemStatus(item.id, item.status === 'READY' ? 'SERVED' : 'READY')}
                          className={`px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                            item.status === 'READY' || item.status === 'SERVED'
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 text-amber-400 hover:bg-emerald-500 hover:text-slate-950'
                          }`}
                        >
                          {item.status === 'READY' || item.status === 'SERVED' ? '✓ Ready' : 'Mark Prepared'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-slate-800 flex gap-2">
                  <button
                    onClick={() => updateOrderStatus(order.id, 'SERVED')}
                    className="w-full bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 text-slate-200 text-xs font-extrabold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Mark Whole Ticket Prepared
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
