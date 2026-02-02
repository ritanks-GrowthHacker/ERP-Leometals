'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';
import { 
  DollarSign, FileText, TrendingUp, AlertCircle, 
  Settings, BarChart3, Receipt, BookOpen, Plus,
  CheckCircle, Clock, XCircle, FileBarChart, Wallet,
  Building, Calculator, ArrowRight
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
          totalSalesInvoices: (salesData.total || 0) + (salesData.summary?.ordersCount || 0),
          totalRevenue: salesData.summary?.totalRevenue || 0,
        }));
      }

      // Fetch Purchase Invoices with ITC
      const purchaseRes = await fetch('/api/erp/finance/invoices/purchase?limit=5', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (purchaseRes.ok) {
        const purchaseData = await purchaseRes.json();
        console.log('📦 Purchase Data Received:', purchaseData);
        console.log('📦 Summary:', purchaseData.summary);
        setRecentPurchaseInvoices(purchaseData.invoices || []);
        
        // Parse expenses properly - API returns numbers not strings
        const totalExpenses = Number(purchaseData.summary?.totalExpenses || 0);
        const totalITC = Number(purchaseData.summary?.totalITC || 0);
        const claimedITC = Number(purchaseData.summary?.claimedITC || 0);
        
        console.log('💰 Parsed Expenses:', totalExpenses);
        console.log('💰 Parsed ITC:', totalITC);
        
        setDashboardStats(prev => ({
          ...prev,
          totalPurchaseInvoices: Number(purchaseData.total || 0),
          totalExpenses: totalExpenses,
          itcAvailable: totalITC,
          itcClaimed: claimedITC,
          gstPayable: (prev.totalRevenue * 0.18) - claimedITC,
        }));
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { bg: string; text: string; label: string } } = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
      approved: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Approved' },
      sent: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Sent' },
      paid: { bg: 'bg-green-100', text: 'text-green-700', label: 'Paid' },
      partially_paid: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Partial' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
    };
    const badge = badges[status] || badges.draft;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  // GST Setup Wizard (shown if not configured)
  if (!loading && !gstConfigured) {
    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-40 h-40 mx-auto mb-6">
              <Lottie animationData={financeAnimation} loop={true} />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to GST Finance Module</h2>
            <p className="text-gray-600">Configure your GST details to get started with Indian GST compliance</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-200 shadow-lg">
            <div className="flex items-start mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                <Building className="text-white" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">GST Setup Required</h3>
                <p className="text-gray-700 mb-4">
                  Before you can create invoices and manage GST compliance, you need to configure your organization's GSTIN details.
                </p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li className="flex items-start">
                    <CheckCircle className="text-green-600 mr-2 mt-0.5 flex-shrink-0" size={16} />
                    <span>Multiple GSTIN support for different business locations</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="text-green-600 mr-2 mt-0.5 flex-shrink-0" size={16} />
                    <span>Automatic CGST/SGST/IGST calculation based on Place of Supply</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="text-green-600 mr-2 mt-0.5 flex-shrink-0" size={16} />
                    <span>Input Tax Credit (ITC) tracking and utilization</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="text-green-600 mr-2 mt-0.5 flex-shrink-0" size={16} />
                    <span>GSTR-1 and GSTR-3B report generation</span>
                  </li>
                </ul>
                <Link href="/erp/finance/gst/configuration">
                  <button className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center">
                    <Settings className="mr-2" size={20} />
                    Configure GST Details
                    <ArrowRight className="ml-2" size={20} />
                  </button>
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
              <FileBarChart className="text-blue-600 mx-auto mb-2" size={32} />
              <h4 className="text-sm font-semibold text-gray-900">GST Reports</h4>
              <p className="text-xs text-gray-500 mt-1">GSTR-1, GSTR-3B</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
              <Calculator className="text-green-600 mx-auto mb-2" size={32} />
              <h4 className="text-sm font-semibold text-gray-900">Auto Tax Calc</h4>
              <p className="text-xs text-gray-500 mt-1">Intra/Inter-state</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
              <Wallet className="text-purple-600 mx-auto mb-2" size={32} />
              <h4 className="text-sm font-semibold text-gray-900">ITC Management</h4>
              <p className="text-xs text-gray-500 mt-1">Claim & Track</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Dashboard (shown after GST configured)
  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">Finance & GST Compliance</h2>
          <p className="text-sm text-gray-500">Manage invoices, ITC, and GST returns</p>
        </div>
        <div className="w-28 h-28">
          <Lottie animationData={financeAnimation} loop={true} />
        </div>
      </div>

      {/* GST Configuration Status */}
      {gstConfigurations.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="text-green-600 mr-3" size={24} />
              <div>
                <h4 className="text-sm font-semibold text-gray-900">
                  GST Configured: {gstConfigurations[0]?.gstin || 'N/A'}
                </h4>
                <p className="text-xs text-gray-600 mt-0.5">
                  {gstConfigurations[0]?.legal_name || ''} • {gstConfigurations[0]?.state_code || ''}
                </p>
              </div>
            </div>
            <Link href="/erp/finance/gst/configuration">
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Manage →
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Sales Invoices */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">Sales Invoices</span>
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <FileText className="text-blue-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {loading ? '...' : dashboardStats.totalSalesInvoices}
          </p>
          <p className="text-xs text-gray-500">{formatCurrency(dashboardStats.totalRevenue)} revenue</p>
        </div>

        {/* Purchase Invoices */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">Purchase Invoices</span>
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <Receipt className="text-orange-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {loading ? '...' : dashboardStats.totalPurchaseInvoices}
          </p>
          <p className="text-xs text-gray-500">{formatCurrency(dashboardStats.totalExpenses)} expenses</p>
        </div>

        {/* ITC Available */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">ITC Available</span>
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Wallet className="text-green-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {loading ? '...' : formatCurrency(dashboardStats.itcAvailable)}
          </p>
          <p className="text-xs text-gray-500">
            {formatCurrency(dashboardStats.itcClaimed)} claimed
          </p>
        </div>

        {/* GST Payable */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">GST Payable</span>
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <DollarSign className="text-purple-600" size={20} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {loading ? '...' : formatCurrency(dashboardStats.gstPayable)}
          </p>
          <p className="text-xs text-gray-500">After ITC adjustment</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Link href="/erp/finance/gst/reports">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white hover:shadow-xl transition-all cursor-pointer">
            <FileBarChart className="mb-3" size={28} />
            <h4 className="text-sm font-semibold mb-1">GST Reports</h4>
            <p className="text-xs opacity-90">GSTR-1, GSTR-3B</p>
          </div>
        </Link>

        <Link href="/erp/finance/accounting/chart-of-accounts">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white hover:shadow-xl transition-all cursor-pointer">
            <BookOpen className="mb-3" size={28} />
            <h4 className="text-sm font-semibold mb-1">Chart of Accounts</h4>
            <p className="text-xs opacity-90">Manage ledgers</p>
          </div>
        </Link>

        <Link href="/erp/finance/accounting/journal-entries">
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white hover:shadow-xl transition-all cursor-pointer">
            <FileText className="mb-3" size={28} />
            <h4 className="text-sm font-semibold mb-1">Journal Entries</h4>
            <p className="text-xs opacity-90">Post transactions</p>
          </div>
        </Link>

        <Link href="/erp/finance/reports">
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white hover:shadow-xl transition-all cursor-pointer">
            <BarChart3 className="mb-3" size={28} />
            <h4 className="text-sm font-semibold mb-1">Financial Reports</h4>
            <p className="text-xs opacity-90">P&L, Trial Balance</p>
          </div>
        </Link>
      </div>

      {/* Recent Invoices Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Invoices */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-blue-50">
            <h3 className="text-base font-semibold text-gray-900">Recent Sales Invoices</h3>
            <Link href="/erp/finance/invoices/sales" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View All →
            </Link>
          </div>
          <div className="p-5">
            {recentSalesInvoices.length > 0 ? (
              <div className="space-y-3">
                {recentSalesInvoices.map((invoice: any) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all">
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <span className="font-semibold text-gray-900 text-sm">{invoice.invoice_number}</span>
                        <span className="mx-2 text-gray-300">•</span>
                        <span className="text-xs text-gray-600">
                          {new Date(invoice.invoice_date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">Customer ID: {invoice.customer_id?.slice(0, 8)}...</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(invoice.total_amount || 0)}</p>
                      {invoice.status && getStatusBadge(invoice.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No sales invoices yet</p>
                <Link href="/erp/finance/invoices/sales/new">
                  <button className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
                    Create First Invoice →
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Purchase Invoices */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-orange-50">
            <h3 className="text-base font-semibold text-gray-900">Recent Purchase Invoices</h3>
            <Link href="/erp/finance/invoices/purchase" className="text-sm text-orange-600 hover:text-orange-700 font-medium">
              View All →
            </Link>
          </div>
          <div className="p-5">
            {recentPurchaseInvoices.length > 0 ? (
              <div className="space-y-3">
                {recentPurchaseInvoices.map((invoice: any) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition-all">
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <span className="font-semibold text-gray-900 text-sm">{invoice.invoice_number}</span>
                        <span className="mx-2 text-gray-300">•</span>
                        <span className="text-xs text-gray-600">
                          {new Date(invoice.invoice_date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        ITC: {formatCurrency(invoice.itc_igst_amount + invoice.itc_cgst_amount + invoice.itc_sgst_amount || 0)}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(invoice.total_amount || 0)}</p>
                      {invoice.status && getStatusBadge(invoice.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No purchase invoices yet</p>
                <Link href="/erp/finance/invoices/purchase/new">
                  <button className="mt-3 text-sm text-orange-600 hover:text-orange-700 font-medium">
                    Create First Invoice →
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
