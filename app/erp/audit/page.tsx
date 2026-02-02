'use client';

import { useState, useEffect } from 'react';
import { Icons } from '@/components/ui/icons';
import { Line, Bar, Doughnut, Chart } from 'react-chartjs-2';
import CustomerSelectionModal from '@/components/modals/CustomerSelectionModal';
import TaxFiling from '@/components/tax-filing/TaxFiling';
import { getAuthToken } from '@/lib/utils/token';
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

interface CustomerInsights {
  customer: {
    id: string;
    name: string;
    email: string;
  };
  kpis: {
    lifetimeValue: number;
    outstandingBalance: number;
    avgOrderValue: number;
    ordersLast12M: number;
    returnRate: number;
    avgPaymentDelay: number;
  };
  revenueTrend: Array<{ month: string; revenue: number }>;
  ordersVsRevenue: Array<{ month: string; orders: number; revenue: number }>;
  topCategories: Array<{ category: string; purchaseCount: number; totalSpent: number }>;
  topProducts: Array<{ name: string; sku: string; timesPurchased: number; totalQuantity: number; totalRevenue: number }>;
  paymentStatus: Array<{ month: string; paid: number; partiallyPaid: number; overdue: number }>;
  paymentDelayTrend: Array<{ month: string; avgDelay: number }>;
  recentOrders: Array<{ id: string; orderNumber: string; date: string; items: number; amount: number; status: string }>;
  invoices: Array<{ invoiceNo: string; date: string; totalAmount: number; paidAmount: number; balance: number; dueDate: string }>;
  creditSummary: {
    creditLimit: number;
    usedCredit: number;
    availableCredit: number;
    avgDelay: number;
    riskLevel: string;
  };
  activityLog: Array<{ date: string; action: string; reference: string; amount: number; performedBy: string }>;
  insights: string[];
}

export default function CustomerInsightsPage() {
  const [showModal, setShowModal] = useState(false);
  const [showTaxFiling, setShowTaxFiling] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  const [insights, setInsights] = useState<CustomerInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [authToken, setAuthToken] = useState('');
  
  // Pagination states
  const [ordersPage, setOrdersPage] = useState(1);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const itemsPerPage = 5;
  
  // Filter states
  //const [timeFilter, setTimeFilter] = useState<'all' | 'q1' | 'q2' | 'q3' | 'q4' | '6m' | '3m'>('all');
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      setAuthToken(token);
      setShowModal(true); // Open modal only after token is set
    }
  }, []);

  const handleSelectCustomer = async (customerId: string, customerName: string) => {
    setSelectedCustomerId(customerId);
    setSelectedCustomerName(customerName);
    setShowModal(false);
    await fetchCustomerInsights(customerId);
  };

  const fetchCustomerInsights = async (customerId: string) => {
    if (!authToken) {
      console.error('No auth token available');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/erp/audit/customer-insights/${customerId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setInsights(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getKPIColor = (value: number, type: 'balance' | 'delay' | 'return') => {
    if (type === 'balance') {
      return value > 50000 ? 'red' : value > 20000 ? 'yellow' : 'green';
    }
    if (type === 'delay') {
      return value > 30 ? 'red' : value > 15 ? 'yellow' : 'green';
    }
    if (type === 'return') {
      return value > 10 ? 'red' : value > 5 ? 'yellow' : 'green';
    }
    return 'green';
  };

  const KPICard = ({
    title,
    value,
    subtitle,
    trend,
    color,
    icon: Icon,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: 'up' | 'down';
    color: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'indigo';
    icon: React.ComponentType<any>;
  }) => {
    const colorClasses = {
      green: 'from-green-500 to-emerald-600',
      red: 'from-red-500 to-rose-600',
      yellow: 'from-yellow-500 to-amber-600',
      blue: 'from-blue-500 to-cyan-600',
      purple: 'from-purple-500 to-fuchsia-600',
      indigo: 'from-indigo-500 to-blue-600',
    };

    return (
      <div className={`bg-linear-to-br ${colorClasses[color]} rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
        <div className="flex items-start justify-between mb-3">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
            <Icon size={24} />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trend === 'up' ? 'bg-white/20' : 'bg-black/20'
            }`}>
              {trend === 'up' ? <Icons.TrendingUp size={12} /> : <Icons.TrendingDown size={12} />}
              {trend === 'up' ? '+' : '-'}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium opacity-90">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {subtitle && <p className="text-xs opacity-75">{subtitle}</p>}
        </div>
      </div>
    );
  };

  // FIRST CHECK: If Tax Filing mode is active, show Tax Filing component
  if (showTaxFiling) {
    return (
      <TaxFiling 
        authToken={authToken} 
        onBack={() => {
          setShowTaxFiling(false);
          setShowModal(true);
        }} 
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading customer insights...</p>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <>
        <CustomerSelectionModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSelectCustomer={handleSelectCustomer}
          authToken={authToken}
          onTaxFiling={() => {
            setShowModal(false);
            setShowTaxFiling(true);
          }}
        />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Icons.Users size={64} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Select a Customer
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Choose a customer to view comprehensive insights
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Select Customer
            </button>
          </div>
        </div>
      </>
    );
  }

  // Chart configurations
  const revenueTrendData = {
    labels: insights.revenueTrend.map((d) => d.month),
    datasets: [{
      label: 'Revenue',
      data: insights.revenueTrend.map((d) => d.revenue),
      borderColor: 'rgb(34, 197, 94)',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      fill: true,
      tension: 0.4,
    }],
  };

  const ordersVsRevenueData = {
    labels: insights.ordersVsRevenue.map((d) => d.month),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Orders',
        data: insights.ordersVsRevenue.map((d) => d.orders),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        yAxisID: 'y',
      },
      {
        type: 'line' as const,
        label: 'Revenue',
        data: insights.ordersVsRevenue.map((d) => d.revenue),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        yAxisID: 'y1',
        tension: 0.4,
      },
    ],
  };

  const categoriesData = {
    labels: insights.topCategories.map((c) => c.category),
    datasets: [{
      data: insights.topCategories.map((c) => c.totalSpent),
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(249, 115, 22, 0.8)',
        'rgba(168, 85, 247, 0.8)',
        'rgba(236, 72, 153, 0.8)',
      ],
    }],
  };

  const paymentStatusData = {
    labels: insights.paymentStatus.map((p) => p.month),
    datasets: [
      {
        label: 'Paid',
        data: insights.paymentStatus.map((p) => p.paid),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
      },
      {
        label: 'Partially Paid',
        data: insights.paymentStatus.map((p) => p.partiallyPaid),
        backgroundColor: 'rgba(251, 191, 36, 0.8)',
      },
      {
        label: 'Overdue',
        data: insights.paymentStatus.map((p) => p.overdue),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
      },
    ],
  };

  const paymentDelayData = {
    labels: insights.paymentDelayTrend.map((p) => p.month),
    datasets: [{
      label: 'Avg Delay (Days)',
      data: insights.paymentDelayTrend.map((p) => p.avgDelay),
      borderColor: 'rgb(249, 115, 22)',
      backgroundColor: 'rgba(249, 115, 22, 0.1)',
      fill: true,
      tension: 0.4,
    }],
  };



  return (
    <>
      <CustomerSelectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSelectCustomer={handleSelectCustomer}
        authToken={authToken}
        onTaxFiling={() => {
          console.log('Tax Filing handler called');
          setShowModal(false);
          setShowTaxFiling(true);
          console.log('showTaxFiling set to true');
        }}
      />
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900 p-6">
        <div className="max-w-[1800px] mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-semibold bg-linear-to-r text-black  bg-clip-text  mb-2">
                  Customer 360° Analytics Dashboard
                </h1>
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <Icons.Users size={12} />
                    <span className="font-semibold text-sm">{insights.customer.name}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-2">
                    <Icons.Mail size={12} />
                    <span className='text-sm'>{insights.customer.email}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* <button
                  onClick={() => setViewMode(viewMode === 'overview' ? 'detailed' : 'overview')}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <Icons.Activity size={16} />
                  {viewMode === 'overview' ? 'Detailed View' : 'Overview'}
                </button> */}
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-medium"
                >
                  <Icons.RefreshCw size={16} />
                  Change Customer
                </button>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Lifetime Value"
              value={`₹${(insights.kpis.lifetimeValue / 1000).toFixed(1)}K`}
              subtitle={`${insights.kpis.ordersLast12M} orders in 12 months`}
              trend="up"
              color="green"
              icon={Icons.DollarSign}
            />
            <KPICard
              title="Avg Order Value"
              value={`₹${(insights.kpis.avgOrderValue / 1000).toFixed(1)}K`}
              subtitle="Per transaction"
              trend="up"
              color="blue"
              icon={Icons.ShoppingCart}
            />
            <KPICard
              title="Outstanding Balance"
              value={`₹${(insights.kpis.outstandingBalance / 1000).toFixed(1)}K`}
              subtitle={`${insights.kpis.ordersLast12M} active orders`}
              color="yellow"
              icon={Icons.Clock}
            />
            <KPICard
              title="Customer Health"
              value={insights.kpis.returnRate < 5 ? 'Excellent' : insights.kpis.returnRate < 10 ? 'Good' : 'At Risk'}
              subtitle={`${insights.kpis.returnRate.toFixed(1)}% return rate`}
              color={insights.kpis.returnRate < 5 ? 'green' : insights.kpis.returnRate < 10 ? 'yellow' : 'red'}
              icon={Icons.Activity}
            />
          </div>
          
          {/* Secondary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{insights.kpis.ordersLast12M}</p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                  <Icons.Package size={24} className="text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Payment Delay</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{Math.round(insights.kpis.avgPaymentDelay)} Days</p>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-lg">
                  <Icons.Clock size={24} className="text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Return Rate</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{insights.kpis.returnRate.toFixed(1)}%</p>
                </div>
                <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg">
                  <Icons.RotateCcw size={24} className="text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Credit Used</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    ₹{insights.creditSummary.usedCredit.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
                  <Icons.TrendingUp size={24} className="text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Main Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend - Larger */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Revenue Trend</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Last 12 Months Performance</p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                  <Icons.TrendingUp size={20} className="text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="h-64">
                <Line data={revenueTrendData} options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                  },
                }} />
              </div>
            </div>

            {/* Orders vs Revenue */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Orders vs Revenue</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Correlation Analysis</p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                  <Icons.ShoppingCart size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="h-64">
                <Chart
                  type="bar"
                  data={ordersVsRevenueData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: { type: 'linear', position: 'left' },
                      y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } },
                    },
                  }}
                />
              </div>
            </div>
          </div>

          {/* Payment Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Status */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Payment Status</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Invoice Payment Breakdown</p>
                </div>
                <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
                  <Icons.DollarSign size={20} className="text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="h-64">
                <Bar
                  data={paymentStatusData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { x: { stacked: true }, y: { stacked: true } },
                  }}
                />
              </div>
            </div>

            {/* Payment Delay */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Payment Delay Trend</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Average Days Delayed</p>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg">
                  <Icons.Clock size={20} className="text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <div className="h-64">
                <Line data={paymentDelayData} options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                  },
                }} />
              </div>
            </div>
          </div>

          {/* Product Insights Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Top Categories */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Top Categories</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">By Purchase Amount</p>
                </div>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{insights.topCategories.length}</span>
              </div>
              <div className="h-56">
                <Doughnut data={categoriesData} options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { 
                      position: 'bottom',
                      labels: { boxWidth: 12, padding: 10 }
                    }
                  }
                }} />
              </div>
            </div>

            {/* Top Products */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Top Products by Revenue</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Best Selling Items</p>
                </div>
                <div className="bg-linear-to-r from-blue-500 to-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  Top {insights.topProducts.length}
                </div>
              </div>
              <div className="space-y-4">
               {insights.topProducts.slice(0, 5).map((product, idx) => (
  <div key={`${product.sku}-${idx}`} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 p-3 rounded-lg transition-all">
    <div className="flex items-center gap-4">
      <div className="shrink-0 w-10 h-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
        #{idx + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{product.name}</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white ml-2">
            ₹{(product.totalRevenue / 1000).toFixed(1)}K
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-2">
          <span>SKU: {product.sku}</span>
          <span>•</span>
          <span>{product.timesPurchased} purchases</span>
          <span>•</span>
          <span>{product.totalQuantity} units</span>
        </div>
        <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500"
            style={{ width: `${(product.totalRevenue / insights.topProducts[0].totalRevenue) * 100}%` }}
          />
        </div>
      </div>
    </div>
  </div>
))}
              </div>
            </div>
          </div>

          {/* Data Tables Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-linear-to-r from-blue-500 to-blue-600 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">Recent Orders</h3>
                    <p className="text-blue-100 text-sm">Latest transactions</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                    <span className="text-white font-semibold">{insights.recentOrders.length} Orders</span>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Order ID</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Items</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {insights.recentOrders
                      .slice((ordersPage - 1) * itemsPerPage, ordersPage * itemsPerPage)
                      .map((order, index) => (
  <tr key={`${order.id}-${index}`} className="hover:bg-blue-50 dark:hover:bg-gray-700/30 transition-colors">
    <td className="px-6 py-4 text-sm font-semibold text-blue-600 dark:text-blue-400">{order.orderNumber}</td>
    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
      {new Date(order.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
    </td>
    <td className="px-6 py-4">
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
        {order.items} items
      </span>
    </td>
    <td className="px-6 py-4">
      <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
        order.status === 'delivered' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
        order.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
        'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
      }`}>
        {order.status}
      </span>
    </td>
  </tr>
))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <button
                  onClick={() => setOrdersPage(Math.max(1, ordersPage - 1))}
                  disabled={ordersPage === 1}
                  className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Page <span className="font-bold">{ordersPage}</span> of <span className="font-bold">{Math.ceil(insights.recentOrders.length / itemsPerPage)}</span>
                </span>
                <button
                  onClick={() => setOrdersPage(Math.min(Math.ceil(insights.recentOrders.length / itemsPerPage), ordersPage + 1))}
                  disabled={ordersPage >= Math.ceil(insights.recentOrders.length / itemsPerPage)}
                  className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>

            {/* Invoices */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-linear-to-r from-purple-500 to-purple-600 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">Invoices & Payments</h3>
                    <p className="text-purple-100 text-sm">Payment tracking</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                    <span className="text-white font-semibold">{insights.invoices.length} Invoices</span>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Invoice</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Paid</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {insights.invoices
                      .slice((invoicesPage - 1) * itemsPerPage, invoicesPage * itemsPerPage)
                      .map((invoice, idx) => (
  <tr key={`${invoice.invoiceNo}-${idx}`} className="hover:bg-purple-50 dark:hover:bg-gray-700/30 transition-colors">
    <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">{invoice.invoiceNo}</td>
    <td className="px-6 py-4 text-sm font-bold text-right text-gray-900 dark:text-white">₹{(invoice.totalAmount / 1000).toFixed(1)}K</td>
    <td className="px-6 py-4 text-sm font-bold text-right text-green-600 dark:text-green-400">₹{(invoice.paidAmount / 1000).toFixed(1)}K</td>
    <td className="px-6 py-4 text-sm font-bold text-right text-red-600 dark:text-red-400">₹{(invoice.balance / 1000).toFixed(1)}K</td>
  </tr>
))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <button
                  onClick={() => setInvoicesPage(Math.max(1, invoicesPage - 1))}
                  disabled={invoicesPage === 1}
                  className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Page <span className="font-bold">{invoicesPage}</span> of <span className="font-bold">{Math.ceil(insights.invoices.length / itemsPerPage)}</span>
                </span>
                <button
                  onClick={() => setInvoicesPage(Math.min(Math.ceil(insights.invoices.length / itemsPerPage), invoicesPage + 1))}
                  disabled={invoicesPage >= Math.ceil(insights.invoices.length / itemsPerPage)}
                  className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Credit Summary & Activity Log */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Credit Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Credit Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Credit Limit</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    ₹{insights.creditSummary.creditLimit.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Used</span>
                  <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                    ₹{insights.creditSummary.usedCredit.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Avg Delay</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    insights.creditSummary.riskLevel === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {insights.creditSummary.riskLevel}
                  </span>
                </div>
              </div>
            </div>

            {/* Activity Log */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Customer Activity Log</h3>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                 {insights.activityLog
                   .slice((activityPage - 1) * itemsPerPage, activityPage * itemsPerPage)
                   .map((activity, idx) => (
  <div key={`${activity.reference}-${idx}`} className="flex items-center gap-4 pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
    <div className="shrink-0">
      <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
        <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full"></div>
      </div>
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{activity.action}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
      <div className="text-xs text-gray-600 dark:text-gray-400">{activity.reference}</div>
    </div>
    <div className="shrink-0">
      <div className="text-sm font-semibold text-green-600 dark:text-green-400">
        ₹{activity.amount.toLocaleString('en-IN')}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 text-right">{activity.performedBy}</div>
    </div>
  </div>
))}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <button
                  onClick={() => setActivityPage(Math.max(1, activityPage - 1))}
                  disabled={activityPage === 1}
                  className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {activityPage} of {Math.ceil(insights.activityLog.length / itemsPerPage)}
                </span>
                <button
                  onClick={() => setActivityPage(Math.min(Math.ceil(insights.activityLog.length / itemsPerPage), activityPage + 1))}
                  disabled={activityPage >= Math.ceil(insights.activityLog.length / itemsPerPage)}
                  className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Auto Insights */}
          {insights.insights.length > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Icons.Lightbulb size={20} className="text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-300 mb-2">
                    Insights
                  </h4>
                  <ul className="space-y-1">
                  {insights.insights.map((insight, idx) => (
  <li key={`insight-${idx}`} className="text-sm text-orange-800 dark:text-orange-400">
    {insight}
  </li>
))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
