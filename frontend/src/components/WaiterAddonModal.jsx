import React, { useState, useEffect, useMemo } from 'react';
import { useOrder } from '../context/OrderContext';
import { Sparkles, Search, Check, X, Tag, ChefHat, Flame, Scale, Wine, Plus } from 'lucide-react';

export default function WaiterAddonModal({
  isOpen,
  onClose,
  itemName,
  currentNotes = '',
  onApply
}) {
  const { addonsData } = useOrder();
  const [selectedNote, setSelectedNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');

  useEffect(() => {
    if (isOpen) {
      setSelectedNote(currentNotes || '');
      setSearchQuery('');
      setActiveCategory('ALL');
    }
  }, [isOpen, currentNotes]);

  // Curated categories with high-priority EDC items
  const quickCategories = useMemo(() => {
    return {
      Portions: {
        icon: Scale,
        color: 'text-amber-400 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20',
        items: [
          '1/2', 'Quarter', '1/4', 'Full', '1 By 2', 'By 2', 'Half Tandoori', 
          '3/4', 'Double Egg', 'Single Scoop', 'Full Portion'
        ]
      },
      'Spice & Flavor': {
        icon: Flame,
        color: 'text-rose-400 border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20',
        items: [
          'Spicy', 'Medium Spicy', 'Less Spicy', 'Extra Spicy', 'Schezwan', 
          'Peri Peri', 'Salt Pepper', 'No Spicy / For Kids', 'Pepper Fry'
        ]
      },
      'Prep & Kitchen': {
        icon: ChefHat,
        color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20',
        items: [
          'Gravey', 'No Cheese', 'White Sauce', 'Make It Dry', 'Crispy', 
          'No Onion', 'No Garlic', 'Without Cheese', 'Fast / Urgent'
        ]
      },
      'Bar & Beverages': {
        icon: Wine,
        color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20',
        items: [
          'Add Icecube', 'No Ice', 'Make It Strong', 'Sweet', 'Salt', 
          'Sweet & Salt', 'With Soda', 'With Water', 'Less Ice Strong'
        ]
      }
    };
  }, []);

  // Filter 2,636 items from EDC master list
  const filteredEdcItems = useMemo(() => {
    const all = addonsData?.items || [];
    if (!searchQuery.trim()) {
      return all.slice(0, 40); // Show top 40 when not searching
    }
    const q = searchQuery.toLowerCase().trim();
    return all.filter(it => it.name.toLowerCase().includes(q)).slice(0, 50);
  }, [addonsData, searchQuery]);

  if (!isOpen) return null;

  const handleSelectTag = (tag) => {
    if (!selectedNote) {
      setSelectedNote(tag);
    } else {
      // If already in string, don't duplicate
      const parts = selectedNote.split(',').map(s => s.trim());
      if (parts.includes(tag)) {
        // Toggle off if clicked again
        const remaining = parts.filter(p => p !== tag).join(', ');
        setSelectedNote(remaining);
      } else {
        setSelectedNote(`${selectedNote}, ${tag}`);
      }
    }
  };

  const handleApply = () => {
    onApply(selectedNote.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black text-lg shrink-0">
              🏷️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Waiter Add-on Menu
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  2,636 EDC Master Records
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white truncate max-w-xs sm:max-w-md mt-0.5">
                {itemName || 'Custom Item Note'}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Addon / Note Input Bar */}
        <div className="p-3.5 bg-slate-950/90 border-b border-slate-800 shrink-0 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span>Configured Add-on / Item Note:</span>
            {selectedNote && (
              <button
                type="button"
                onClick={() => setSelectedNote('')}
                className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-1 font-bold"
              >
                <X className="w-3 h-3" /> Clear Add-on
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={selectedNote}
              onChange={(e) => setSelectedNote(e.target.value)}
              placeholder="e.g. 1/2, Spicy, Extra Schezwan..."
              className="flex-1 bg-slate-900 border border-amber-500/50 rounded-xl px-3.5 py-2 text-sm text-amber-300 font-bold placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50"
            />
            <button
              type="button"
              onClick={handleApply}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1 shrink-0 shadow-md"
            >
              <Check className="w-4 h-4 stroke-[3]" /> Apply
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Quick Popular Add-on Groups */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>1-Tap Quick Add-ons (Most Requested by Customers):</span>
            </div>

            {Object.entries(quickCategories).map(([catName, group]) => {
              const Icon = group.icon;
              return (
                <div key={catName} className="space-y-1.5 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-300">
                    <Icon className="w-3.5 h-3.5 text-amber-400" />
                    <span>{catName}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((it) => {
                      const isSelected = selectedNote.split(',').map(s => s.trim().toLowerCase()).includes(it.toLowerCase());
                      return (
                        <button
                          key={it}
                          type="button"
                          onClick={() => handleSelectTag(it)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition flex items-center gap-1 ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
                              : `${group.color} text-slate-200 border-slate-800`
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          {it}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Master EDC Addon Search (2,636 Items) */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-amber-400" />
                <span>Search Full EDC Master Addon List:</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {addonsData?.total || 2636} available
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to search (e.g. egg, burji, peri, kakinada, cheese, soup...)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtered EDC List Pills */}
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-1 bg-slate-950/70 rounded-xl border border-slate-800/80">
              {filteredEdcItems.length === 0 ? (
                <div className="p-3 text-center text-slate-400 text-xs w-full italic">
                  No matching EDC add-ons found for "{searchQuery}". You can type custom instructions in the input bar above.
                </div>
              ) : (
                filteredEdcItems.map((it) => {
                  const isSelected = selectedNote.split(',').map(s => s.trim().toLowerCase()).includes(it.name.toLowerCase());
                  return (
                    <button
                      key={it.id || it.name}
                      type="button"
                      onClick={() => handleSelectTag(it.name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1 ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      {it.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
          >
            <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
            <span>Apply Add-on to Item</span>
          </button>
        </div>
      </div>
    </div>
  );
}
