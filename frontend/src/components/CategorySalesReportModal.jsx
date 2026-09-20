import React, { useState, useEffect } from 'react';
import { useOrder } from '../context/OrderContext';
import { BarChart3, X, FileSpreadsheet, Utensils, Wine, DollarSign, Download, Sparkles, Filter, PieChart, ShieldCheck } from 'lucide-react';

export default function CategorySalesReportModal({ isOpen, onClose }) {
  const { allOrders, paymentLogs, paymentSummary } = useOrder();
  const [departmentFilter, setDepartmentFilter] = useState('ALL'); // ALL, KITCHEN, BAR
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchReportData();
    }
  }, [isOpen, allOrders, paymentLogs]);

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/reports/category-summary');
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      } else {
        generateLocalReportData();
      }
    } catch (err) {
      console.warn("Failed to fetch report from API, generating local summary", err);
      generateLocalReportData();
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback client-side report generator
  const generateLocalReportData = () => {
    const collectedOrders = (allOrders || []).filter(o => o.payment_status === 'COLLECTED' || o.status === 'BILLED');
    
    let totalCash = 0;
    let totalUpi = 0;
    let totalCard = 0;
    let totalDiscounts = 0;
    let grandTotal = 0;

    const deptMap = {
      KITCHEN: { items_sold: 0, gross_sales: 0, name: "Food & Kitchen" },
      BAR: { items_sold: 0, gross_sales: 0, name: "Bar Drinks & Liquor" }
    };

    const categoryMap = {};
    const platformMap = {};

    collectedOrders.forEach(ord => {
      const amt = parseFloat(ord.amount_collected || ord.final_amount || ord.total_amount || 0);
      const mode = (ord.payment_mode || 'CASH').toUpperCase();
      const plat = ord.booking_platform || 'Direct / Walk-in';
      const disc = parseFloat(ord.discount_amount || 0);

      if (mode === 'CASH') totalCash += amt;
      else if (mode === 'UPI') totalUpi += amt;
      else if (mode === 'CARD') totalCard += amt;

      grandTotal += amt;
      totalDiscounts += disc;

      if (!platformMap[plat]) {
        platformMap[plat] = { count: 0, collected_amount: 0, discount_amount: 0 };
      }
      platformMap[plat].count += 1;
      platformMap[plat].collected_amount += amt;
      platformMap[plat].discount_amount += disc;

      if (ord.items) {
        ord.items.forEach(item => {
          const qty = item.quantity || 1;
          const itemTotal = qty * (parseFloat(item.unit_price) || 0);
          const dept = (item.target_dept || 'KITCHEN').toUpperCase();

          if (deptMap[dept]) {
            deptMap[dept].items_sold += qty;
            deptMap[dept].gross_sales += itemTotal;
          }

          const catName = item.product?.category?.name || (dept === 'BAR' ? 'Bar Beverages' : 'Kitchen Dishes');
          const catDept = (item.product?.category?.target_dept || dept).toUpperCase();

          if (!categoryMap[catName]) {
            categoryMap[catName] = {
              category_name: catName,
              target_dept: catDept,
              items_sold: 0,
              total_revenue: 0
            };
          }
          categoryMap[catName].items_sold += qty;
          categoryMap[catName].total_revenue += itemTotal;
        });
      }
    });

    const categoryList = Object.values(categoryMap).sort((a, b) => b.total_revenue - a.total_revenue);

    setReportData({
      payment_summary: {
        total_cash: totalCash,
        total_upi: totalUpi,
        total_card: totalCard,
        grand_total: grandTotal,
        total_discounts: totalDiscounts,
        total_orders: collectedOrders.length
      },
      department_summary: deptMap,
      category_sales: categoryList,
      platform_sales: platformMap
    });
  };

  if (!isOpen) return null;

  const paymentSummaryData = reportData?.payment_summary || {
    total_cash: paymentSummary.total_cash || 0,
    total_upi: paymentSummary.total_upi || 0,
    total_card: paymentSummary.total_card || 0,
    grand_total: (paymentSummary.total_cash || 0) + (paymentSummary.total_upi || 0) + (paymentSummary.total_card || 0),
    total_discounts: 0,
    total_orders: paymentLogs.length
  };

  const grandTotal = paymentSummaryData.grand_total || 0;

  const filteredCategorySales = (reportData?.category_sales || []).filter(cat => {
    if (departmentFilter === 'ALL') return true;
    return (cat.target_dept || '').toUpperCase() === departmentFilter;
  });

  const exportCategoryReportToExcel = () => {
    if (!reportData || !reportData.category_sales || reportData.category_sales.length === 0) {
      alert("No category sales report data available to export.");
      return;
    }

    const headers = ["Category Name", "Department", "Items Sold Quantity", "Total Revenue (INR)", "% Share of Total Sales"];
    const rows = reportData.category_sales.map(cat => {
      const sharePct = grandTotal > 0 ? ((cat.total_revenue / grandTotal) * 100).toFixed(1) : '0';
      return [
        `"${cat.category_name}"`,
        `"${cat.target_dept}"`,
        `"${cat.items_sold}"`,
        `"${cat.total_revenue.toFixed(2)}"`,
        `"${sharePct}%"`
      ];
    });

    const summarySection = [
      [],
      ["--- PAYMENT MODE REVENUE SUMMARY ---"],
      ["Payment Mode", "Collected Amount (INR)"],
      ["Cash Revenue", `"${paymentSummaryData.total_cash}"`],
      ["UPI / QR Revenue", `"${paymentSummaryData.total_upi}"`],
      ["Card Revenue", `"${paymentSummaryData.total_card}"`],
      ["Grand Total Net Revenue", `"${paymentSummaryData.grand_total}"`],
      ["Total Offer Discounts Provided", `"${paymentSummaryData.total_discounts}"`]
    ];

    const csvString = [
      headers.join(','), 
      ...rows.map(r => r.join(',')),
      ...summarySection.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `Bermuda_Pub_Category_Sales_Report_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 shadow-lg">
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-100 flex items-center gap-2">
                Category Sales & Department Revenue Report
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  REAL-TIME SALES LEDGER
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Detailed breakdown of Food vs Drinks, Product Category Sales, and Payment Modes (Cash, UPI, Card).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCategoryReportToExcel}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-100 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition"
              title="Download Category Sales Excel (.csv)"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export Report (.csv)
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Report Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Section 1: Top Financial KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-950 border border-amber-500/40 p-4 rounded-xl space-y-1 shadow-md">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>💰 Net Total Revenue</span>
                <span className="text-amber-400 text-[10px]">ALL SETTLED</span>
              </div>
              <div className="text-2xl font-black text-amber-400">₹{grandTotal}</div>
              <div className="text-[10px] text-slate-500 font-mono">{paymentSummaryData.total_orders || 0} Orders Settled</div>
            </div>

            <div className="bg-slate-950 border border-emerald-500/30 p-4 rounded-xl space-y-1 shadow-md">
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                <span>🍳 Food & Kitchen Sales</span>
                <Utensils className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-black text-slate-100">
                ₹{reportData?.department_summary?.KITCHEN?.gross_sales || 0}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {reportData?.department_summary?.KITCHEN?.items_sold || 0} Food Dishes Prepared
              </div>
            </div>

            <div className="bg-slate-950 border border-purple-500/30 p-4 rounded-xl space-y-1 shadow-md">
              <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center justify-between">
                <span>🍸 Bar Drinks Sales</span>
                <Wine className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl font-black text-slate-100">
                ₹{reportData?.department_summary?.BAR?.gross_sales || 0}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {reportData?.department_summary?.BAR?.items_sold || 0} Drinks Served
              </div>
            </div>

            <div className="bg-slate-950 border border-rose-500/30 p-4 rounded-xl space-y-1 shadow-md">
              <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center justify-between">
                <span>🏷️ Offers & Discounts</span>
                <span className="text-rose-400 text-[10px]">SAVINGS</span>
              </div>
              <div className="text-xl font-black text-rose-400">
                -₹{paymentSummaryData.total_discounts || 0}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">Applied at Reception / Waiter</div>
            </div>
          </div>

          {/* Section 2: Payment Mode Revenue Breakdown (Cash, UPI, Card) */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
            <h4 className="font-extrabold text-sm text-slate-200 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-400" /> Payment Mode Breakdown (Cash vs UPI vs Card)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-900 border border-emerald-500/40 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs text-emerald-300 font-bold">
                  <span>💵 Cash Revenue</span>
                  <span className="font-mono text-[11px]">
                    {grandTotal > 0 ? (((paymentSummaryData.total_cash || 0) / grandTotal) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="text-lg font-black text-slate-100">₹{paymentSummaryData.total_cash || 0}</div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${grandTotal > 0 ? ((paymentSummaryData.total_cash || 0) / grandTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-900 border border-blue-500/40 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs text-blue-300 font-bold">
                  <span>📱 UPI / QR Revenue</span>
                  <span className="font-mono text-[11px]">
                    {grandTotal > 0 ? (((paymentSummaryData.total_upi || 0) / grandTotal) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="text-lg font-black text-slate-100">₹{paymentSummaryData.total_upi || 0}</div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full"
                    style={{ width: `${grandTotal > 0 ? ((paymentSummaryData.total_upi || 0) / grandTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-900 border border-purple-500/40 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs text-purple-300 font-bold">
                  <span>💳 Card Revenue</span>
                  <span className="font-mono text-[11px]">
                    {grandTotal > 0 ? (((paymentSummaryData.total_card || 0) / grandTotal) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="text-lg font-black text-slate-100">₹{paymentSummaryData.total_card || 0}</div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full"
                    style={{ width: `${grandTotal > 0 ? ((paymentSummaryData.total_card || 0) / grandTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Product Category-Wise Sales Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-extrabold text-sm text-slate-200 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-amber-400" /> Category-Wise Sales Breakdown
              </h4>

              {/* Department Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setDepartmentFilter('ALL')}
                  className={`px-3 py-1 rounded-lg font-bold transition ${
                    departmentFilter === 'ALL' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Categories
                </button>
                <button
                  onClick={() => setDepartmentFilter('KITCHEN')}
                  className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                    departmentFilter === 'KITCHEN' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Utensils className="w-3.5 h-3.5" /> Food Categories
                </button>
                <button
                  onClick={() => setDepartmentFilter('BAR')}
                  className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                    departmentFilter === 'BAR' ? 'bg-purple-950 text-purple-300 border border-purple-500/40' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Wine className="w-3.5 h-3.5" /> Bar Categories
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
              {filteredCategorySales.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-10 italic">
                  No sales recorded for this category filter yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="p-3">Category Name</th>
                      <th className="p-3">Department</th>
                      <th className="p-3 text-center">Items Sold Qty</th>
                      <th className="p-3 text-right">Revenue (₹)</th>
                      <th className="p-3 w-40">% Share of Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredCategorySales.map((cat, idx) => {
                      const sharePct = grandTotal > 0 ? (cat.total_revenue / grandTotal) * 100 : 0;
                      const isKitchen = (cat.target_dept || '').toUpperCase() === 'KITCHEN';

                      return (
                        <tr key={idx} className="hover:bg-slate-800/50 transition">
                          <td className="p-3 font-extrabold text-slate-100 flex items-center gap-2">
                            <span>{isKitchen ? '🍳' : '🍸'}</span>
                            <span>{cat.category_name}</span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                              isKitchen ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-purple-950 text-purple-300 border-purple-800'
                            }`}>
                              {isKitchen ? 'Food / Kitchen' : 'Liquor / Bar'}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-amber-400">
                            {cat.items_sold} pcs
                          </td>
                          <td className="p-3 text-right font-black text-slate-100 font-mono text-sm">
                            ₹{cat.total_revenue.toFixed(2)}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-900 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isKitchen ? 'bg-emerald-500' : 'bg-purple-500'}`}
                                  style={{ width: `${Math.min(100, sharePct)}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">
                                {sharePct.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-slate-400 font-mono">
            Generated Report • Bermuda Pub & Kitchen POS
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCategoryReportToExcel}
              className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Download className="w-4 h-4" /> Download Excel CSV
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
            >
              Close Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
