'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { 
  DollarSign, FileText, TrendingUp, AlertCircle, 
  Settings, BarChart3, Receipt, BookOpen, Plus,
  CheckCircle, Clock, XCircle, FileBarChart, Wallet,
  Building, Calculator
} from 'lucide-react';
import Link from 'next/link';
import Lottie from 'lottie-react';
import financeAnimation from '@/lib/lottie/finance.json';

export default function GSTFinanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [gstConfigured, setGstConfigured] = useState(false);
  const [gstConfigurations, setGstConfigurations] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState({
    totalSalesInvoices: 0,
    totalRevenue: 0,
    totalPurchaseInvoices: 0,
    totalExpenses: 0,
    itcAvailable: 0,
    itcClaimed: 0,
    gstPayable: 0,
  });

  const [recentSalesInvoices, setRecentSalesInvoices] = useState<any[]>([]);
  const [recentPurchaseInvoices, setRecentPurchaseInvoices] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = getAuthToken();
      
      // Check GST Configuration
      const gstConfigRes = await fetch('/api/erp/finance/gst/configuration', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (gstConfigRes.ok) {
        const gstData = await gstConfigRes.json();
        setGstConfigurations(gstData.configurations || []);
        setGstConfigured((gstData.configurations || []).length > 0);
      }

      // Fetch Sales Invoices with GST
      const salesRes = await fetch('/api/erp/finance/invoices/sales?limit=5', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (salesRes.ok) {
        const salesData = await salesRes.json();
        setRecentSalesInvoices(salesData.invoices || []);
        setDashboardStats(prev => ({
          ...prev,
          totalSalesInvoices: salesData.total || 0,
          totalRevenue: salesData.summary?.totalRevenue || 0,
        }));
      }

      // Fetch Purchase Invoices with ITC
      const purchaseRes = await fetch('/api/erp/finance/invoices/purchase?limit=5', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (purchaseRes.ok) {
        const purchaseData = await purchaseRes.json();
        setRecentPurchaseInvoices(purchaseData.invoices || []);
        setDashboardStats(prev => ({
          ...prev,
          totalPurchaseInvoices: purchaseData.total || 0,
          totalExpenses: purchaseData.summary?.totalExpenses || 0,
          itcAvailable: purchaseData.summary?.totalITC || 0,
          itcClaimed: purchaseData.summary?.claimedITC || 0,
          gstPayable: (salesData?.summary?.totalGST || 0) - (purchaseData?.summary?.claimedITC || 0),
        }));
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'draft': 'bg-gray-100 text-gray-700',
      'sent': 'bg-blue-100 text-blue-700',
      'partially_paid': 'bg-yellow-100 text-yellow-700',
      'paid': 'bg-green-100 text-green-700',
      'overdue': 'bg-red-100 text-red-700',
      'cancelled': 'bg-gray-100 text-gray-500',
      'approved': 'bg-green-100 text-green-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const formatCurrency = (amount: string | number | null | undefined) => {
    if (amount === null || amount === undefined || amount === '') return '₹0.00';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '₹0.00';
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">Finance & Billing</h2>
          <p className="text-sm text-gray-500">Manage invoices, bills, payments and financial reports</p>
        </div>
        <div className="w-32 h-32">
          <Lottie animationData={financeAnimation} loop={true} />
        </div>
      </div>
      {/* Date Filter Buttons */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Finance Overview</h2>
        <div className="flex gap-2">
          {[7, 30, 60, 90, 365].map((days) => (
            <button
              key={days}
              onClick={() => setDateFilter(days)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                dateFilter === days
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-300 hover:border-blue-400'
              }`}
            >
              {days === 365 ? '1 Year' : `${days} Days`}
            </button>
          ))}
        </div>
      </div>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">Total Revenue</span>
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-green-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {loading ? '...' : formatCurrency(stats.totalRevenue)}
          </p>
          <p className="text-xs text-gray-500">{stats.paidInvoices} paid invoices</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">Customer Invoices</span>
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <FileText className="text-blue-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {loading ? '...' : stats.totalInvoices}
          </p>
          <p className="text-xs text-gray-500">
            {stats.overdueInvoices > 0 && (
              <span className="text-red-600 font-medium">{stats.overdueInvoices} overdue</span>
            )}
            {stats.overdueInvoices === 0 && 'All up to date'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">Total Expenses</span>
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <Receipt className="text-orange-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {loading ? '...' : formatCurrency(stats.totalExpenses)}
          </p>
          <p className="text-xs text-gray-500">{stats.paidBills} paid bills</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">Vendor Bills</span>
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <CreditCard className="text-purple-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {loading ? '...' : stats.totalBills}
          </p>
          <p className="text-xs text-gray-500">
            {stats.overdueBills > 0 && (
              <span className="text-red-600 font-medium">{stats.overdueBills} overdue</span>
            )}
            {stats.overdueBills === 0 && 'All up to date'}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/erp/sales/invoices">
            <div className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left cursor-pointer">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
                <Plus className="text-blue-600" size={20} />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">Create Invoice</h4>
              <p className="text-xs text-gray-500 mt-1">New customer invoice</p>
            </div>
          </Link>

          <div onClick={() => setShowPaymentModal(true)} className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left cursor-pointer">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-3">
              <CreditCard className="text-green-600" size={20} />
            </div>
            <h4 className="text-sm font-semibold text-gray-900">Record Payment</h4>
            <p className="text-xs text-gray-500 mt-1">Send Razorpay link to customer</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {(['invoices', 'bills', 'payments', 'reports'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Recent Invoices */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Customer Invoices (Sales)</h3>
            <Link href="/erp/sales/invoices" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View All →
            </Link>
          </div>
          {salesInvoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">Invoice #</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">Customer</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Amount</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Paid</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {salesInvoices.map((invoice: any) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{invoice.invoiceNumber || '-'}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {invoice.customer?.name || invoice.customer?.companyName || 'Unknown'}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(invoice.totalAmount || 0)}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600 text-right">
                        {formatCurrency(invoice.paidAmount || 0)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(parseFloat(invoice.balanceAmount || '0') === 0 ? 'paid' : 'unpaid')}`}>
                          {parseFloat(invoice.balanceAmount || '0') === 0 ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No invoices yet</p>
              <p className="text-sm text-gray-500 mt-1">Create your first invoice to get started</p>
            </div>
          )}
        </div>
      )}

      {/* Recent Bills */}
      {activeTab === 'bills' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Supplier Invoices (Purchasing)</h3>
            <Link href="/erp/purchasing/supplier-invoices" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View All →
            </Link>
          </div>
          {supplierInvoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">Invoice #</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">Supplier</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Amount</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600">Paid</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {supplierInvoices.map((bill: any) => (
                    <tr key={bill.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{bill.invoice_number || '-'}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {bill.supplier_name || 'Unknown'}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {bill.invoice_date ? new Date(bill.invoice_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(bill.total_amount || 0)}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600 text-right">
                        {formatCurrency(bill.paid_amount || 0)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor((bill.payment_status || bill.status) === 'paid' ? 'paid' : 'unpaid')}`}>
                          {(bill.payment_status || bill.status) === 'paid' ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No bills yet</p>
              <p className="text-sm text-gray-500 mt-1">Supplier invoices will appear here</p>
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">Payment Summary</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-2 border-dashed border-green-300 rounded-lg p-6 bg-green-50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Received (Revenue)</h4>
                <CreditCard className="text-green-600" size={24} />
              </div>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</p>
              <p className="text-sm text-gray-600 mt-2">From {stats.paidInvoices} paid customer invoices</p>
              <Link href="/erp/sales/invoices" className="text-sm text-green-600 hover:text-green-700 font-medium mt-4 inline-block">
                View All Invoices →
              </Link>
            </div>

            <div className="border-2 border-dashed border-red-300 rounded-lg p-6 bg-red-50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Paid Out (Expenses)</h4>
                <Receipt className="text-red-600" size={24} />
              </div>
              <p className="text-3xl font-bold text-red-600">{formatCurrency(stats.totalExpenses)}</p>
              <p className="text-sm text-gray-600 mt-2">From {stats.paidBills} paid supplier invoices</p>
              <Link href="/erp/purchasing/supplier-invoices" className="text-sm text-red-600 hover:text-red-700 font-medium mt-4 inline-block">
                View All Bills →
              </Link>
            </div>

            <div className="col-span-1 md:col-span-2 border-2 border-blue-300 rounded-lg p-6 bg-blue-50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Net Cash Flow</h4>
                <TrendingUp className="text-blue-600" size={24} />
              </div>
              <p className={`text-3xl font-bold ${stats.totalRevenue - stats.totalExpenses >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(stats.totalRevenue - stats.totalExpenses)}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                {stats.totalRevenue - stats.totalExpenses >= 0 ? 'Positive' : 'Negative'} cash flow (Revenue - Expenses)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">Financial Reports & Summary</h3>
          </div>
          <div className="p-6">
            {/* Profit & Loss Card */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-gray-900">Profit & Loss Statement</h4>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</p>
                  <p className="text-xs text-gray-500 mt-1">From {stats.paidInvoices} paid invoices</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-sm text-gray-600 mb-1">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalExpenses)}</p>
                  <p className="text-xs text-gray-500 mt-1">From {stats.paidBills} paid bills</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-sm text-gray-600 mb-1">Net Profit/Loss</p>
                  <p className={`text-2xl font-bold ${stats.totalRevenue - stats.totalExpenses >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCurrency(stats.totalRevenue - stats.totalExpenses)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.totalRevenue - stats.totalExpenses >= 0 ? 'Profit' : 'Loss'}
                  </p>
                </div>
              </div>
            </div>

            {/* Accounts Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="border-2 border-orange-200 rounded-xl p-6 bg-orange-50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-900">Accounts Receivable</h4>
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Invoices</span>
                    <span className="font-semibold text-gray-900">{stats.totalInvoices}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Paid Invoices</span>
                    <span className="font-semibold text-green-600">{stats.paidInvoices}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Overdue Invoices</span>
                    <span className="font-semibold text-red-600">{stats.overdueInvoices}</span>
                  </div>
                  <Link href="/erp/sales/invoices" className="block mt-4 text-center bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium">
                    View Customer Invoices →
                  </Link>
                </div>
              </div>

              <div className="border-2 border-purple-200 rounded-xl p-6 bg-purple-50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-900">Accounts Payable</h4>
                  <Receipt className="w-6 h-6 text-purple-600" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Bills</span>
                    <span className="font-semibold text-gray-900">{stats.totalBills}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Paid Bills</span>
                    <span className="font-semibold text-green-600">{stats.paidBills}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Overdue Bills</span>
                    <span className="font-semibold text-red-600">{stats.overdueBills}</span>
                  </div>
                  <Link href="/erp/purchasing/supplier-invoices" className="block mt-4 text-center bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium">
                    View Supplier Invoices →
                  </Link>
                </div>
              </div>
            </div>

            {/* Financial Health Indicators */}
            <div className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 rounded-xl p-6">
              <h4 className="font-bold text-gray-900 mb-4">Financial Health Indicators</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Payment Collection Rate</p>
                  <p className="text-xl font-bold text-green-600">
                    {stats.totalInvoices > 0 ? Math.round((stats.paidInvoices / stats.totalInvoices) * 100) : 0}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Bill Payment Rate</p>
                  <p className="text-xl font-bold text-green-600">
                    {stats.totalBills > 0 ? Math.round((stats.paidBills / stats.totalBills) * 100) : 0}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Profit Margin</p>
                  <p className="text-xl font-bold text-blue-600">
                    {stats.totalRevenue > 0 ? Math.round(((stats.totalRevenue - stats.totalExpenses) / stats.totalRevenue) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Record Payment</h2>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedInvoice(null);
                  setSearchTerm('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Unpaid Invoice
                </label>
                <div className="relative">
                  <select
                    value={selectedInvoice?.id || ''}
                    onChange={(e) => {
                      const invoice = unpaidInvoices.find(inv => inv.id === e.target.value);
                      setSelectedInvoice(invoice || null);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                  >
                    <option value="">-- Select an unpaid invoice --</option>
                    {unpaidInvoices
                      .filter((inv: any) => {
                        if (!searchTerm) return true;
                        const search = searchTerm.toLowerCase();
                        return (
                          inv.invoiceNumber?.toLowerCase().includes(search) ||
                          inv.customer?.name?.toLowerCase().includes(search) ||
                          inv.customer?.companyName?.toLowerCase().includes(search)
                        );
                      })
                      .map((invoice: any) => (
                        <option key={invoice.id} value={invoice.id}>
                          {invoice.invoiceNumber} - {invoice.customer?.name || invoice.customer?.companyName} - {formatCurrency(invoice.balanceAmount || 0)} due
                        </option>
                      ))}
                  </select>
                  <div className="absolute right-3 top-3.5 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Search Filter
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type to filter dropdown by invoice # or customer name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <svg className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 mt-1">{unpaidInvoices.filter((inv: any) => {
                  if (!searchTerm) return true;
                  const search = searchTerm.toLowerCase();
                  return (
                    inv.invoiceNumber?.toLowerCase().includes(search) ||
                    inv.customer?.name?.toLowerCase().includes(search) ||
                    inv.customer?.companyName?.toLowerCase().includes(search)
                  );
                }).length} invoices match your search</p>
              </div>

              {selectedInvoice && (
                <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 border-2 border-green-200">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                    <CreditCard className="mr-2 text-green-600" size={20} />
                    Payment Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Invoice Number</p>
                      <p className="font-semibold text-gray-900">{selectedInvoice.invoiceNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Customer</p>
                      <p className="font-semibold text-gray-900">{selectedInvoice.customer?.name || selectedInvoice.customer?.companyName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Amount</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(selectedInvoice.totalAmount || 0)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Balance Due</p>
                      <p className="font-bold text-red-600">{formatCurrency(selectedInvoice.balanceAmount || 0)}</p>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        const token = getAuthToken();
                        const response = await fetch('/api/erp/sales/invoices/send-payment-link', {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ invoiceId: selectedInvoice.id }),
                        });

                        if (response.ok) {
                          alert('Razorpay payment link sent to customer successfully!');
                          setShowPaymentModal(false);
                          setSelectedInvoice(null);
                          setSearchTerm('');
                          fetchFinanceData(); // Refresh data
                        } else {
                          const error = await response.json();
                          alert(`Error: ${error.error || 'Failed to send payment link'}`);
                        }
                      } catch (error) {
                        console.error('Payment link error:', error);
                        alert('Failed to send payment link. Please try again.');
                      }
                    }}
                    className="w-full bg-gradient-to-r from-green-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-green-600 hover:to-blue-700 transition-all shadow-lg flex items-center justify-center"
                  >
                    <CreditCard className="mr-2" size={20} />
                    Send Razorpay Payment Link to Customer
                  </button>
                  <p className="text-xs text-gray-600 mt-3 text-center">
                    Customer will receive payment link via email/SMS. Payment will be auto-captured and invoice will be marked as paid.
                  </p>
                </div>
              )}

              {!selectedInvoice && unpaidInvoices.length > 0 && (
                <div className="text-center text-gray-500 py-8">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>Select an unpaid invoice to send payment link</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
