'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Receipt, Minus, AlertCircle, Users, ShoppingCart, Package, Box } from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TaxFilingProps {
  authToken: string;
  onBack: () => void;
}

interface TaxData {
  quarter: string;
  year: number;
  startDate: string;
  endDate: string;
  businessSummary: {
    total_revenue: string;
    total_cogs: string;
    gross_profit: string;
    total_tax_collected: string;
    total_orders: string;
    total_customers: string;
  };
  monthlyRevenue: Array<{ month: string; revenue: string; gst_collected: string; orders: string }>;
  topProducts: Array<{
    product_name: string;
    sku: string;
    total_units_sold: string;
    total_revenue: string;
    total_cost: string;
    profit: string;
    profit_margin_percent: string;
  }>;
  topCustomers: Array<{
    customer_name: string;
    city: string;
    state: string;
    email: string;
    phone: string;
    total_revenue: string;
    total_orders: string;
    avg_order_value: string;
    last_order_date: string;
  }>;
  purchaseExpenses: {
    total_purchases: string;
    input_tax_credit: string;
    total_purchase_orders: string;
  };
  inventoryValue: {
    total_inventory_value: string;
    total_units_in_stock: string;
  };
  categoryRevenue: Array<{
    category: string;
    products_count: string;
    total_revenue: string;
    total_cost: string;
    profit: string;
  }>;
}

export default function TaxFiling({ authToken, onBack }: TaxFilingProps) {
  const [selectedQuarter, setSelectedQuarter] = useState('Q1');
  const [selectedYear, setSelectedYear] = useState(2025);
  const [taxData, setTaxData] = useState<TaxData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTaxData();
  }, [selectedQuarter, selectedYear]);

  const fetchTaxData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/erp/audit/tax-filing?quarter=${selectedQuarter}&year=${selectedYear}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();
      if (result.success) {
        setTaxData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch tax data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '₹0.00';
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Chart data preparations with refined colors
  const monthlyRevenueChart = taxData ? {
    labels: taxData.monthlyRevenue.map((m) => m.month),
    datasets: [
      {
        label: 'Revenue',
        data: taxData.monthlyRevenue.map((m) => parseFloat(m.revenue)),
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
      },
      {
        label: 'GST Collected',
        data: taxData.monthlyRevenue.map((m) => parseFloat(m.gst_collected)),
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
      },
    ],
  } : null;

  const categoryRevenueChart = taxData ? {
    labels: taxData.categoryRevenue.map((c) => c.category),
    datasets: [
      {
        label: 'Revenue by Category',
        data: taxData.categoryRevenue.map((c) => parseFloat(c.total_revenue)),
        backgroundColor: [
          'rgba(99, 102, 241, 0.85)',
          'rgba(16, 185, 129, 0.85)',
          'rgba(245, 158, 11, 0.85)',
          'rgba(239, 68, 68, 0.85)',
          'rgba(139, 92, 246, 0.85)',
          'rgba(236, 72, 153, 0.85)',
        ],
        borderWidth: 0,
      },
    ],
  } : null;

  const profitMarginChart = taxData ? {
    labels: taxData.topProducts.slice(0, 5).map((p) => p.product_name),
    datasets: [
      {
        label: 'Profit Margin %',
        data: taxData.topProducts.slice(0, 5).map((p) => parseFloat(p.profit_margin_percent || '0')),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 0,
        borderRadius: 8,
      },
    ],
  } : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-linear-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-100 border-t-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading tax data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">Tax Filing Report</h1>
              <p className="text-slate-600">
                Financial Year {selectedYear}-{(selectedYear + 1) % 100} • {selectedQuarter}
              </p>
            </div>

            {/* Quarter Selection */}
            <div className="flex gap-3">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-5 py-2.5 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700 font-medium shadow-sm hover:border-slate-300 transition-colors"
              >
                <option value={2024}>FY 2024-25</option>
                <option value={2025}>FY 2025-26</option>
                <option value={2026}>FY 2026-27</option>
              </select>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="px-5 py-2.5 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700 font-medium shadow-sm hover:border-slate-300 transition-colors"
              >
                <option value="Q1">Q1 (Apr-Jun)</option>
                <option value="Q2">Q2 (Jul-Sep)</option>
                <option value="Q3">Q3 (Oct-Dec)</option>
                <option value="Q4">Q4 (Jan-Mar)</option>
              </select>
            </div>
          </div>
        </div>

        {taxData && (
          <>
            {/* KPI Cards - Refined Design */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 rounded-xl">
                    <DollarSign className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-500 font-medium mb-1">Total Revenue</p>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(taxData.businessSummary.total_revenue)}</p>
                    <p className="text-xs text-slate-500 mt-1">{taxData.businessSummary.total_orders} orders</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-500 font-medium mb-1">Gross Profit</p>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(taxData.businessSummary.gross_profit)}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {((parseFloat(taxData.businessSummary.gross_profit) / parseFloat(taxData.businessSummary.total_revenue)) * 100).toFixed(1)}% margin
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-violet-50 rounded-xl">
                    <Receipt className="w-6 h-6 text-violet-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-500 font-medium mb-1">GST Collected</p>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(taxData.businessSummary.total_tax_collected)}</p>
                    <p className="text-xs text-slate-500 mt-1">Output tax</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-50 rounded-xl">
                    <Minus className="w-6 h-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-500 font-medium mb-1">Input Tax Credit</p>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(taxData.purchaseExpenses.input_tax_credit)}</p>
                    <p className="text-xs text-slate-500 mt-1">From purchases</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Net GST Liability - Refined */}
           <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-rose-50 rounded-xl">
                  <AlertCircle className="w-6 h-6 text-rose-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500 font-medium mb-1">Net GST Liability</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(
                      (parseFloat(taxData.businessSummary.total_tax_collected || '0') || 0) - 
                      (parseFloat(taxData.purchaseExpenses.input_tax_credit || '0') || 0)
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Output: {formatCurrency(taxData.businessSummary.total_tax_collected || '0')} - 
                    Input Credit: {formatCurrency(taxData.purchaseExpenses.input_tax_credit || '0')}
                  </p>
                </div>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Monthly Revenue & GST */}
               <div className="bg-white rounded-2xl p-7 shadow-sm border border-slate-200 h-[400px]">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Monthly Revenue & GST Trend</h3>
                {monthlyRevenueChart && (
                  <Bar 
                    data={monthlyRevenueChart} 
                    options={{ 
                      responsive: true, 
                      maintainAspectRatio: true,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 20,
                            font: { size: 13, weight: 600 }
                          }
                        },
                        tooltip: {
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          padding: 12,
                          titleFont: { size: 14, weight: 'bold' },
                          bodyFont: { size: 13 },
                          cornerRadius: 8,
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          grid: { 
                            color: 'rgba(0,0,0,0.04)',
                            
                          },
                          ticks: {
                            font: { size: 11 },
                            padding: 8
                          }
                        },
                        x: {
                          grid: { display: false },
                          ticks: {
                            font: { size: 12, weight: 500 },
                            padding: 8
                          }
                        }
                      }
                    }} 
                  />
                )}
              </div>

              {/* Category Revenue Distribution */}
              <div className="bg-white rounded-2xl p-7 shadow-sm border border-slate-200 h-[400px] w-[60%]">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Revenue by Category</h3>
                {categoryRevenueChart && (
                  <Doughnut 
                    data={categoryRevenueChart} 
                    options={{ 
                      responsive: true, 
                      maintainAspectRatio: true,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            usePointStyle: true,
                            padding: 12,
                            font: { size: 11, weight: 500 }
                          }
                        }
                      }
                    }} 
                  />
                )}
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Top Products Profit Margin */}
              <div className="bg-white rounded-2xl p-7 shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Top Products by Profit Margin</h3>
                {profitMarginChart && (
                  <Bar 
                    data={profitMarginChart} 
                    options={{ 
                      responsive: true, 
                      maintainAspectRatio: true, 
                      indexAxis: 'y',
                      plugins: {
                        legend: { display: false }
                      },
                      scales: {
                        x: {
                          grid: { color: 'rgba(0,0,0,0.05)' }
                        },
                        y: {
                          grid: { display: false }
                        }
                      }
                    }} 
                  />
                )}
              </div>

              {/* Business Metrics */}
              <div className="bg-white rounded-2xl p-7 shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Key Business Metrics</h3>
                <div className="space-y-5">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <Users className="w-5 h-5 text-indigo-600" />
                      </div>
                      <span className="text-slate-700 font-medium">Total Customers</span>
                    </div>
                    <span className="text-xl font-bold text-slate-900">{taxData.businessSummary.total_customers}</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <ShoppingCart className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="text-slate-700 font-medium">Total Orders</span>
                    </div>
                    <span className="text-xl font-bold text-slate-900">{taxData.businessSummary.total_orders}</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <Package className="w-5 h-5 text-amber-600" />
                      </div>
                      <span className="text-slate-700 font-medium">Total Purchases</span>
                    </div>
                    <span className="text-xl font-bold text-slate-900">{formatCurrency(taxData.purchaseExpenses.total_purchases)}</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <Box className="w-5 h-5 text-emerald-600" />
                      </div>
                      <span className="text-slate-700 font-medium">Inventory Value</span>
                    </div>
                    <span className="text-xl font-bold text-slate-900">{formatCurrency(taxData.inventoryValue.total_inventory_value)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Products Table */}
            <div className="bg-white rounded-2xl p-7 shadow-sm border border-slate-200 mb-8">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Top 10 Most Profitable Products</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Product</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">SKU</th>
                      <th className="px-4 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Units Sold</th>
                      <th className="px-4 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Revenue</th>
                      <th className="px-4 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Cost</th>
                      <th className="px-4 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Profit</th>
                      <th className="px-4 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {taxData.topProducts.map((product, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4 text-sm text-slate-900 font-medium">{product.product_name}</td>
                        <td className="px-4 py-4 text-sm text-slate-500">{product.sku}</td>
                        <td className="px-4 py-4 text-sm text-slate-700 text-right">{parseFloat(product.total_units_sold).toFixed(0)}</td>
                        <td className="px-4 py-4 text-sm text-slate-900 text-right font-semibold">{formatCurrency(product.total_revenue)}</td>
                        <td className="px-4 py-4 text-sm text-slate-600 text-right">{formatCurrency(product.total_cost)}</td>
                        <td className="px-4 py-4 text-sm text-emerald-600 text-right font-bold">{formatCurrency(product.profit)}</td>
                        <td className="px-4 py-4 text-right">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                            {parseFloat(product.profit_margin_percent || '0').toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Customers Table */}
            <div className="bg-white rounded-2xl p-7 shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Top 10 Customers by Revenue</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Location</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Contact</th>
                      <th className="px-4 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Orders</th>
                      <th className="px-4 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Total Revenue</th>
                      <th className="px-4 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Avg Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {taxData.topCustomers.map((customer, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4 text-sm text-slate-900 font-semibold">{customer.customer_name}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{customer.city}, {customer.state}</td>
                        <td className="px-4 py-4 text-sm text-slate-500 ">{customer.email || customer.phone}</td>
                        <td className="px-4 py-4 text-sm text-slate-700 text-right">{customer.total_orders}</td>
                        <td className="px-4 py-4 text-sm text-slate-900 text-right font-bold">{formatCurrency(customer.total_revenue)}</td>
                        <td className="px-4 py-4 text-sm text-slate-600 text-right font-medium">{formatCurrency(customer.avg_order_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}