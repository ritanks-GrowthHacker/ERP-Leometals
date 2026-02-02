'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';

interface AnalyticsData {
  orderSummary: {
    total_orders: number;
    draft_count: number;
    confirmed_count: number;
    in_progress_count: number;
    completed_count: number;
    cancelled_count: number;
    total_sales_value: string;
    avg_order_value: string;
  };
  invoiceSummary: {
    total_invoices: number;
    draft_count: number;
    sent_count: number;
    paid_count: number;
    total_invoice_value: string;
    total_paid: string;
    total_outstanding: string;
  };
  topCustomers: Array<{
    id: string;
    name: string;
    code: string;
    total_orders: number;
    total_sales_value: string;
    completed_orders: number;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    sku: string;
    order_count: number;
    total_quantity: string;
    total_value: string;
  }>;
  salesTrends: Array<{
    month: string;
    order_count: number;
    total_value: string;
  }>;
}

export default function SalesAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30'); // days

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const fetchAnalytics = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/erp/sales/analytics?days=${timeRange}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const analyticsData = await response.json();
        console.log('Analytics data:', analyticsData);
        setData(analyticsData);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-2"></div>
          <div className="text-gray-600">Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-gray-500">No analytics data available</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Track sales performance and trends</p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Revenue</div>
          <div className="text-3xl font-bold text-gray-900">
            ₹{parseFloat(data?.orderSummary?.total_sales_value || '0').toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            From {data?.orderSummary?.total_orders || 0} orders
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Orders</div>
          <div className="text-3xl font-bold text-gray-900">
            {data?.orderSummary?.total_orders || 0}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {data?.orderSummary?.completed_count || 0} completed
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Avg Order Value</div>
          <div className="text-3xl font-bold text-gray-900">
           ₹{parseFloat(data?.orderSummary?.avg_order_value || '0').toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Invoices</div>
          <div className="text-3xl font-bold text-gray-900">
            {data?.invoiceSummary?.total_invoices || 0}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {data?.invoiceSummary?.paid_count || 0} paid
          </div>
        </div>
      </div>

      {/* Order Status Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{data?.orderSummary?.draft_count || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Draft</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{data?.orderSummary?.confirmed_count || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Confirmed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{data?.orderSummary?.in_progress_count || 0}</div>
            <div className="text-xs text-gray-500 mt-1">In Progress</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{data?.orderSummary?.completed_count || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{data?.orderSummary?.cancelled_count || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Cancelled</div>
          </div>
        </div>
      </div>

      {/* Revenue Trend */}
      {data?.salesTrends && data.salesTrends.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend (Last 12 Months)</h2>
          <div className="space-y-3">
            {data.salesTrends.map((item, index) => {
              const maxValue = Math.max(...data.salesTrends.map(m => parseFloat(m.total_value)), 1);
              return (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-gray-600">{item.month}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{
                        width: `${(parseFloat(item.total_value) / maxValue) * 100}%`
                      }}
                    />
                  </div>
                  <div className="w-32 text-sm font-semibold text-gray-900 text-right">
                    ₹{parseFloat(item.total_value).toLocaleString('en-IN')}
                  </div>
                  <div className="w-20 text-xs text-gray-500 text-right">
                    {item.order_count} orders
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Customers */}
      {data?.topCustomers && data.topCustomers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Top Customers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Code
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Avg Order
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.topCustomers.map((customer) => {
                  const totalValue = parseFloat(customer.total_sales_value || '0');
                  const avgOrder = totalValue / (customer.total_orders || 1);
                  return (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {customer.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {customer.code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 text-right">
                        {customer.total_orders}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                        ₹{totalValue.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 text-right">
                        ₹{avgOrder.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Products */}
      {data?.topProducts && data.topProducts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Top Products</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Quantity Sold
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Avg Price
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.topProducts.map((product) => {
                  const totalValue = parseFloat(product.total_value || '0');
                  const quantity = parseFloat(product.total_quantity || '0');
                  const avgPrice = quantity > 0 ? totalValue / quantity : 0;
                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {product.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {product.sku}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 text-right">
                        {quantity.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                        ₹{totalValue.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 text-right">
                        ₹{avgPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}