'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';

interface PurchasingAnalytics {
  poSummary: {
    total_purchase_orders: string;
    draft_count: string;
    confirmed_count: string;
    partially_received_count: string;
    received_count: string;
    cancelled_count: string;
    total_purchase_value: string;
    pending_value: string;
    completed_value: string;
  };
  rfqSummary: {
    total_rfqs: string;
    draft_count: string;
    sent_count: string;
    in_progress_count: string;
    received_count: string;
    closed_count: string;
  };
  invoiceSummary: {
    total_invoices: string;
    pending_count: string;
    paid_count: string;
    overdue_count: string;
    total_invoice_value: string;
    pending_value: string;
    paid_value: string;
  };
  deliveryPerformance: {
    completed_orders: string;
    avg_delivery_days: string;
  };
  receiptSummary: {
    total_po_receipts: string;
    total_invoice_receipts: string;
    po_received: string;
    po_accepted: string;
    invoice_generated: string;
    invoice_downloaded: string;
    total_receipt_amount: string;
  };
  topSuppliers: Array<{
    id: string;
    name: string;
    code: string;
    total_orders: string;
    total_purchase_value: string;
    completed_orders: string;
    completion_rate: string;
  }>;
  purchaseTrends: Array<{
    month: string;
    order_count: string;
    total_value: string;
  }>;
  categorySpending: Array<{
    category_name: string;
    order_count: string;
    total_spending: string;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    sku: string;
    order_count: string;
    total_quantity: string;
    total_value: string;
  }>;
  pendingReceipts: Array<{
    id: string;
    po_number: string;
    supplier_name: string;
    po_date: string;
    expected_delivery_date: string;
    total_amount: string;
    days_overdue: string;
  }>;
}

export default function PurchasingAnalyticsPage() {
  const [analytics, setAnalytics] = useState<PurchasingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('all');
 
  // Helper function to safely parse float values
  const safeParseFloat = (value: string | number | null | undefined, defaultValue: number = 0): number => {
    if (value === null || value === undefined || value === '') return defaultValue;
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateFilter]);

  const fetchAnalytics = async () => {
    const token = getAuthToken();
    if (!token) {
      setError('No authentication token found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      let url = '/api/erp/purchasing/analytics';
      if (dateFilter !== 'all') {
        const params = new URLSearchParams();
        const endDate = new Date();
        let startDate = new Date();
        
        if (dateFilter === 'month') {
          startDate.setMonth(endDate.getMonth() - 1);
        } else if (dateFilter === 'quarter') {
          startDate.setMonth(endDate.getMonth() - 3);
        } else if (dateFilter === 'year') {
          startDate.setFullYear(endDate.getFullYear() - 1);
        }
        
        params.set('startDate', startDate.toISOString().split('T')[0]);
        params.set('endDate', endDate.toISOString().split('T')[0]);
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Purchasing analytics data:', data);
        setAnalytics(data);
      } else {
        setError(`Failed to load analytics: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching purchasing analytics:', error);
      setError('Error fetching analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading purchasing analytics...</div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="p-6">
        <div className="text-center text-red-500">
          {error || 'Failed to load analytics'}
        </div>
        <div className="text-center mt-4">
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalNonDraftPOs = safeParseFloat(analytics.poSummary.total_purchase_orders) - safeParseFloat(analytics.poSummary.draft_count);
  const receivedAndPartialCount = safeParseFloat(analytics.poSummary.received_count) + safeParseFloat(analytics.poSummary.partially_received_count);
  const completionRate = totalNonDraftPOs > 0
    ? (receivedAndPartialCount / totalNonDraftPOs) * 100
    : 0;

  console.log('Completion Rate Calculation:', {
    totalPOs: analytics.poSummary.total_purchase_orders,
    draftCount: analytics.poSummary.draft_count,
    receivedCount: analytics.poSummary.received_count,
    partiallyReceivedCount: analytics.poSummary.partially_received_count,
    totalNonDraft: totalNonDraftPOs,
    receivedAndPartial: receivedAndPartialCount,
    completionRate
  });

  const paymentRate = safeParseFloat(analytics.invoiceSummary.total_invoices) > 0
    ? (safeParseFloat(analytics.invoiceSummary.paid_count) / safeParseFloat(analytics.invoiceSummary.total_invoices)) * 100
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header with Date Filter */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Purchasing Analytics</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-4 py-2 rounded ${
              dateFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => setDateFilter('month')}
            className={`px-4 py-2 rounded ${
              dateFilter === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            Last Month
          </button>
          <button
            onClick={() => setDateFilter('quarter')}
            className={`px-4 py-2 rounded ${
              dateFilter === 'quarter' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            Last Quarter
          </button>
          <button
            onClick={() => setDateFilter('year')}
            className={`px-4 py-2 rounded ${
              dateFilter === 'year' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            Last Year
          </button>
        </div>
      </div>

      {/* Purchase Orders Summary */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Purchase Orders Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="text-2xl font-bold text-blue-700">
              {analytics.poSummary.total_purchase_orders}
            </div>
            <p className="text-sm text-blue-600">Total Orders</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="text-2xl font-bold text-yellow-700">
              {analytics.poSummary.draft_count}
            </div>
            <p className="text-sm text-yellow-600">Draft</p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <div className="text-2xl font-bold text-purple-700">
              {analytics.poSummary.confirmed_count}
            </div>
            <p className="text-sm text-purple-600">Confirmed</p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="text-2xl font-bold text-green-700">
              {analytics.poSummary.received_count}
            </div>
            <p className="text-sm text-green-600">Completed</p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="text-2xl font-bold text-red-700">
              {analytics.poSummary.cancelled_count}
            </div>
            <p className="text-sm text-red-600">Cancelled</p>
          </div>
        </div>
      </div>

      {/* Financial Overview */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Financial Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-3xl font-bold text-blue-600">
              ₹{safeParseFloat(analytics.poSummary.total_purchase_value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-gray-600">Total Purchase Value</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-3xl font-bold text-yellow-600">
              ₹{safeParseFloat(analytics.poSummary.pending_value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-gray-600">Pending Orders Value</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-3xl font-bold text-green-600">
              ₹{safeParseFloat(analytics.poSummary.completed_value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-gray-600">Completed Orders Value</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-3xl font-bold text-purple-600">
              {completionRate.toFixed(1)}%
            </div>
            <p className="text-sm text-gray-600">Order Completion Rate</p>
            <p className="text-xs text-gray-500 mt-1">
              {analytics.poSummary.received_count} of {totalNonDraftPOs} active orders
            </p>
          </div>
        </div>
      </div>
      {/* Receipts Overview */}
      {analytics.receiptSummary && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Receipts Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="text-2xl font-bold text-blue-700">
                {parseInt(analytics.receiptSummary.total_po_receipts || '0') + parseInt(analytics.receiptSummary.total_invoice_receipts || '0')}
              </div>
              <p className="text-sm text-blue-600">Total Receipts</p>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.receiptSummary.total_po_receipts} PO • {analytics.receiptSummary.total_invoice_receipts} Invoice
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="text-2xl font-bold text-green-700">
                {parseInt(analytics.receiptSummary.po_accepted || '0') + parseInt(analytics.receiptSummary.invoice_downloaded || '0')}
              </div>
              <p className="text-sm text-green-600">Completed</p>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.receiptSummary.po_accepted} accepted • {analytics.receiptSummary.invoice_downloaded} downloaded
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="text-2xl font-bold text-yellow-700">
                {parseInt(analytics.receiptSummary.po_received || '0') + parseInt(analytics.receiptSummary.invoice_generated || '0')}
              </div>
              <p className="text-sm text-yellow-600">Pending</p>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.receiptSummary.po_received} received • {analytics.receiptSummary.invoice_generated} generated
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-2xl font-bold text-teal-600">
                ₹{parseFloat(analytics.receiptSummary.total_receipt_amount || '0').toLocaleString('en-IN')}
              </div>
              <p className="text-sm text-gray-600">Invoice Receipt Value</p>
            </div>
          </div>
        </div>
      )}
      {/* RFQ and Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">RFQ Status</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span>Total RFQs</span>
                <span className="font-bold">{analytics.rfqSummary.total_rfqs}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                <span>Sent</span>
                <span className="font-bold text-blue-600">{analytics.rfqSummary.sent_count}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                <span>In Progress</span>
                <span className="font-bold text-yellow-600">{analytics.rfqSummary.in_progress_count}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                <span>Closed (Completed)</span>
                <span className="font-bold text-purple-600">{analytics.rfqSummary.closed_count}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                <span>Received</span>
                <span className="font-bold text-green-600">{analytics.rfqSummary.received_count}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Invoice Status</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span>Total Invoices</span>
                <span className="font-bold">{analytics.invoiceSummary.total_invoices}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                <span>Pending</span>
                <span className="font-bold text-yellow-600">
                  {analytics.invoiceSummary.pending_count} • ₹
                  {parseFloat(analytics.invoiceSummary.pending_value || '0').toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                <span>Paid</span>
                <span className="font-bold text-green-600">
                  {analytics.invoiceSummary.paid_count} • ₹
                  {parseFloat(analytics.invoiceSummary.paid_value || '0').toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                <span>Overdue</span>
                <span className="font-bold text-red-600">{analytics.invoiceSummary.overdue_count}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Order Completion Rate</h3>
          </div>
          <div className="p-6">
            <div className="text-center py-6">
              <div className="text-5xl font-bold text-blue-600">
                {completionRate.toFixed(1)}%
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {analytics.poSummary.received_count} of {analytics.poSummary.total_purchase_orders} orders completed
              </p>
              <div className="mt-4 w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full"
                  style={{ width: `${completionRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Average Delivery Time</h3>
          </div>
          <div className="p-6">
            <div className="text-center py-6">
              <div className="text-5xl font-bold text-green-600">
                {parseFloat(analytics.deliveryPerformance.avg_delivery_days || '0').toFixed(1)}
              </div>
              <p className="text-sm text-gray-600 mt-2">days</p>
              <p className="text-xs text-gray-500 mt-4">
                Based on {analytics.deliveryPerformance.completed_orders} completed orders
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Payment Rate</h3>
          </div>
          <div className="p-6">
            <div className="text-center py-6">
              <div className="text-5xl font-bold text-purple-600">
                {paymentRate.toFixed(1)}%
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {analytics.invoiceSummary.paid_count} of {analytics.invoiceSummary.total_invoices} invoices paid
              </p>
              <div className="mt-4 w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-purple-500 h-3 rounded-full"
                  style={{ width: `${paymentRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Suppliers */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Top Suppliers by Purchase Value</h3>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {analytics.topSuppliers?.map((supplier, idx) => (
              <div key={supplier.id} className="flex justify-between items-center p-4 bg-gray-50 rounded">
                <div>
                  <p className="font-semibold">{supplier.name}</p>
                  <p className="text-sm text-gray-600">
                    {supplier.total_orders} orders • {supplier.completed_orders} completed
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">
                    ₹{safeParseFloat(supplier.total_purchase_value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-gray-600">
                    {safeParseFloat(supplier.completion_rate).toFixed(1)}% completion rate
                  </p>
                </div>
              </div>
            ))}
            {(!analytics.topSuppliers || analytics.topSuppliers.length === 0) && (
              <p className="text-center text-gray-500 py-4">No supplier data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Purchase Trends */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Purchase Trends (Last 12 Months)</h3>
        </div>
        <div className="p-6">
          <div className="space-y-2">
            {analytics.purchaseTrends?.map((trend, idx) => {
              const maxValue = Math.max(
                ...analytics.purchaseTrends.map((t) => safeParseFloat(t.total_value, 1)),
                1
              );
              const trendValue = safeParseFloat(trend.total_value);
              const percentage = (trendValue / maxValue) * 100;

              return (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-20 text-sm text-gray-600">{trend.month}</div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-8 relative">
                      <div
                        className="bg-blue-500 h-8 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${percentage}%` }}
                      >
                        {percentage > 20 && (
                          <span className="text-white text-xs font-semibold">
                            {trend.order_count} orders
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-32 text-right text-sm font-semibold text-gray-700">
                    ₹{trendValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}
            {(!analytics.purchaseTrends || analytics.purchaseTrends.length === 0) && (
              <p className="text-center text-gray-500 py-4">No trend data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Category Spending */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Spending by Category</h3>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {analytics.categorySpending?.map((category, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{category.category_name}</p>
                  <p className="text-sm text-gray-600">{category.order_count} purchase orders</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">
                    ₹{parseFloat(category.total_spending).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            ))}
            {(!analytics.categorySpending || analytics.categorySpending.length === 0) && (
              <p className="text-center text-gray-500 py-4">No category data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Most Purchased Products</h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Product</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">SKU</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold">Orders</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold">Total Quantity</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analytics.topProducts?.map((product, idx) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{product.name}</td>
                    <td className="px-4 py-2 text-gray-600">{product.sku}</td>
                    <td className="px-4 py-2 text-right">{product.order_count}</td>
                    <td className="px-4 py-2 text-right">{parseFloat(product.total_quantity).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-green-600">
                      ₹{parseFloat(product.total_value).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!analytics.topProducts || analytics.topProducts.length === 0) && (
              <p className="text-center text-gray-500 py-8">No product data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Pending Receipts */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Pending Receipts (Orders to Receive)</h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold">PO Number</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Supplier</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">PO Date</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Expected Delivery</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold">Amount</th>
                  <th className="px-4 py-2 text-center text-sm font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analytics.pendingReceipts?.map((po) => {
                  const daysOverdue = parseInt(po.days_overdue || '0');
                  const isOverdue = daysOverdue > 0;

                  return (
                    <tr key={po.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-2 font-medium">{po.po_number}</td>
                      <td className="px-4 py-2">{po.supplier_name}</td>
                      <td className="px-4 py-2">{new Date(po.po_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2">
                        {new Date(po.expected_delivery_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">
                        ₹{parseFloat(po.total_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {isOverdue ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                            {daysOverdue} days overdue
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(!analytics.pendingReceipts || analytics.pendingReceipts.length === 0) && (
              <p className="text-center text-gray-500 py-8">No pending receipts</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
