import React, { useState, useEffect } from 'react';
import { useOrder } from '../context/OrderContext';
import PaymentAuditLogModal from '../components/PaymentAuditLogModal';
import { 
  BarChart3, 
  FileSpreadsheet, 
  Utensils, 
  Wine, 
  DollarSign, 
  Download, 
  Sparkles, 
  Filter, 
  PieChart, 
  ShieldCheck,
  Receipt,
  Printer,
  Calendar,
  Layers,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Smartphone
} from 'lucide-react';

export default function CategoryReportsPanel() {
  const { allOrders, paymentLogs, paymentSummary } = useOrder();
  const [departmentFilter, setDepartmentFilter] = useState('ALL'); // ALL, KITCHEN, BAR
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, [allOrders, paymentLogs]);

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
      console.warn("Failed to fetch report from backend, calculating local summary", err);
      generateLocalReportData();
    } finally {
      setIsLoading(false);
    }
  };

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
              <BarChart3 className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                Category Sales & Revenue Reports Dashboard
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> LIVE FINANCIAL LEDGER
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Detailed category-wise sales, separate Food vs Bar sales, Cash / UPI / Card payment mode analysis.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setIsLogModalOpen(true)}
              className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-extrabold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md transition"
            >
              <Receipt className="w-4 h-4 text-emerald-400" />
              <span>Audit Register (₹{paymentSummaryData.grand_total || 0})</span>
            </button>

            <button
              onClick={exportCategoryReportToExcel}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Report (.csv)</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Section 1: Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border-2 border-amber-500/50 p-5 rounded-2xl space-y-1 shadow-xl relative overflow-hidden">
          <div className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center justify-between">
            <span>💰 Net Total Revenue</span>
            <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-mono">SETTLED</span>
          </div>
          <div className="text-3xl font-black text-amber-400 font-mono">₹{grandTotal}</div>
          <div className="text-xs text-slate-400 font-medium">{paymentSummaryData.total_orders || 0} Total Orders Settled</div>
        </div>

        <div className="bg-slate-900 border border-emerald-500/40 p-5 rounded-2xl space-y-1 shadow-xl">
          <div className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
            <span>🍳 Food & Kitchen Sales</span>
            <Utensils className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 font-mono">
            ₹{reportData?.department_summary?.KITCHEN?.gross_sales || 0}
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {reportData?.department_summary?.KITCHEN?.items_sold || 0} Dishes Prepared
          </div>
        </div>

        <div className="bg-slate-900 border border-purple-500/40 p-5 rounded-2xl space-y-1 shadow-xl">
          <div className="text-xs font-extrabold text-purple-400 uppercase tracking-wider flex items-center justify-between">
            <span>🍸 Bar Drinks Sales</span>
            <Wine className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 font-mono">
            ₹{reportData?.department_summary?.BAR?.gross_sales || 0}
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {reportData?.department_summary?.BAR?.items_sold || 0} Drinks Served
          </div>
        </div>

        <div className="bg-slate-900 border border-rose-500/40 p-5 rounded-2xl space-y-1 shadow-xl">
          <div className="text-xs font-extrabold text-rose-400 uppercase tracking-wider flex items-center justify-between">
            <span>🏷️ Offer Discounts</span>
            <span className="text-rose-400 text-[10px] font-mono">DISCOUNTED</span>
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">
            -₹{paymentSummaryData.total_discounts || 0}
          </div>
          <div className="text-xs text-slate-400 font-medium">Dining Offers Applied</div>
        </div>
      </div>

      {/* KPI Section 2: Payment Mode Breakdown (Cash vs UPI vs Card) */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-400" /> Payment Mode Revenue Breakdown
          </h3>
          <span className="text-xs font-mono text-slate-400">Cash, UPI & Card Registers</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950 border border-emerald-500/40 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
              <span className="flex items-center gap-1.5">💵 Cash Revenue</span>
              <span className="font-mono text-xs bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                {grandTotal > 0 ? (((paymentSummaryData.total_cash || 0) / grandTotal) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="text-2xl font-black text-slate-100 font-mono">
              ₹{paymentSummaryData.total_cash || 0}
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${grandTotal > 0 ? ((paymentSummaryData.total_cash || 0) / grandTotal) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-950 border border-blue-500/40 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-blue-300">
              <span className="flex items-center gap-1.5">📱 UPI / QR Revenue</span>
              <span className="font-mono text-xs bg-blue-950 px-2 py-0.5 rounded border border-blue-800">
                {grandTotal > 0 ? (((paymentSummaryData.total_upi || 0) / grandTotal) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="text-2xl font-black text-slate-100 font-mono">
              ₹{paymentSummaryData.total_upi || 0}
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${grandTotal > 0 ? ((paymentSummaryData.total_upi || 0) / grandTotal) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-950 border border-purple-500/40 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-purple-300">
              <span className="flex items-center gap-1.5">💳 Card Revenue</span>
              <span className="font-mono text-xs bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                {grandTotal > 0 ? (((paymentSummaryData.total_card || 0) / grandTotal) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="text-2xl font-black text-slate-100 font-mono">
              ₹{paymentSummaryData.total_card || 0}
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-purple-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${grandTotal > 0 ? ((paymentSummaryData.total_card || 0) / grandTotal) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Section 3: Product Category-Wise Sales Table */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-amber-400" /> Category-Wise Sales Ledger
            </h3>
            <p className="text-xs text-slate-400">Breakdown of sales revenue by menu item category</p>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setDepartmentFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                departmentFilter === 'ALL' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ✨ All Categories ({reportData?.category_sales?.length || 0})
            </button>
            <button
              onClick={() => setDepartmentFilter('KITCHEN')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                departmentFilter === 'KITCHEN' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" /> 🍳 Food Categories
            </button>
            <button
              onClick={() => setDepartmentFilter('BAR')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                departmentFilter === 'BAR' ? 'bg-purple-950 text-purple-300 border border-purple-500/40 shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wine className="w-3.5 h-3.5" /> 🍸 Bar Categories
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
          {filteredCategorySales.length === 0 ? (
            <div className="text-center text-xs text-slate-500 py-12 italic">
              No sales recorded for this category filter yet.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="p-3.5">Category Name</th>
                  <th className="p-3.5">Department</th>
                  <th className="p-3.5 text-center">Items Sold Qty</th>
                  <th className="p-3.5 text-right">Revenue (₹)</th>
                  <th className="p-3.5 w-48">% Share of Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredCategorySales.map((cat, idx) => {
                  const sharePct = grandTotal > 0 ? (cat.total_revenue / grandTotal) * 100 : 0;
                  const isKitchen = (cat.target_dept || '').toUpperCase() === 'KITCHEN';

                  return (
                    <tr key={idx} className="hover:bg-slate-800/50 transition">
                      <td className="p-3.5 font-extrabold text-slate-100 flex items-center gap-2">
                        <span className="text-base">{isKitchen ? '🍳' : '🍸'}</span>
                        <span>{cat.category_name}</span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase border ${
                          isKitchen ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-purple-950 text-purple-300 border-purple-800'
                        }`}>
                          {isKitchen ? 'Food / Kitchen' : 'Liquor / Bar'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-amber-400 text-sm">
                        {cat.items_sold} pcs
                      </td>
                      <td className="p-3.5 text-right font-black text-slate-100 font-mono text-base">
                        ₹{cat.total_revenue.toFixed(2)}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${isKitchen ? 'bg-emerald-500' : 'bg-purple-500'}`}
                              style={{ width: `${Math.min(100, sharePct)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono font-bold text-slate-300 w-10 text-right">
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

      {/* Audit Log Modal trigger */}
      <PaymentAuditLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />
    </div>
  );
}
