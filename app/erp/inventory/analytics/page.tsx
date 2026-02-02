'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/utils/token';

interface Analytics {
  totalProducts: number;
  totalValue: string;
  lowStockCount: number;
  outOfStockCount: number;
  topProducts: Array<{
    name: string;
    sku: string;
    totalQuantity: string;
    value: string;
  }>;
  warehouseStock: Array<{
    warehouseName: string;
    totalProducts: number;
    totalQuantity: string;
    totalValue: string;
  }>;
  recentMovements: Array<{
    movementType: string;
    productName: string;
    quantity: string;
    warehouseName: string;
    createdAt: string;
  }>;
  reorderSuggestions: Array<{
    productName: string;
    sku: string;
    availableQuantity: string;
    suggestedOrderQuantity: string;
    warehouseName?: string;
  }>;
  stockByCategory: Array<{
    categoryName: string;
    productCount: number;
    totalQuantity: string;
    totalValue: string;
  }>;
  stockAging: Array<{
    ageRange: string;
    productCount: number;
    totalValue: string;
  }>;
  turnoverRate: number;
}

export default function InventoryAnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

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
      const response = await fetch('/api/erp/inventory/analytics', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Analytics data:', data);
        // Map API response to component state
        setAnalytics({
          totalProducts: parseInt(data.summary?.total_products || '0'),
          totalValue: data.summary?.total_value || '0',
          lowStockCount: parseInt(data.summary?.low_stock_count || '0'),
          outOfStockCount: parseInt(data.summary?.out_of_stock_count || '0'),
          topProducts: (data.topValueProducts || []).map((p: any) => ({
            name: p.product_name,
            sku: p.sku,
            totalQuantity: p.total_quantity,
            value: p.total_value,
          })),
          warehouseStock: (data.stockByCategory || []).map((c: any) => ({
            warehouseName: c.category_name,
            totalProducts: c.product_count,
            totalQuantity: c.total_quantity,
            totalValue: c.total_value,
          })),
          recentMovements: [],
          reorderSuggestions: (data.reorderSuggestions || []).map((r: any) => ({
            productName: r.product_name,
            sku: r.sku,
            availableQuantity: r.available_quantity,
            suggestedOrderQuantity: r.suggested_order_quantity,
            warehouseName: r.warehouse_name,
          })),
          stockByCategory: (data.stockByCategory || []).map((c: any) => ({
            categoryName: c.category_name,
            productCount: c.product_count,
            totalQuantity: c.total_quantity,
            totalValue: c.total_value,
          })),
          stockAging: data.stockAging || [],
          turnoverRate: parseFloat(data.summary?.turnover_rate || '0'),
        });
      } else {
        setError(`Failed to load analytics: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Error fetching analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading analytics...</div>
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

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Inventory Analytics</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="text-2xl font-bold text-blue-700">{analytics?.totalProducts || 0}</div>
          <p className="text-sm text-blue-600">Total Products</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="text-2xl font-bold text-green-700">
            ₹{parseFloat(analytics?.totalValue || '0').toLocaleString()}
          </div>
          <p className="text-sm text-green-600">Total Inventory Value</p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="text-2xl font-bold text-yellow-700">{analytics?.lowStockCount || 0}</div>
          <p className="text-sm text-yellow-600">Low Stock Items</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="text-2xl font-bold text-red-700">{analytics?.outOfStockCount || 0}</div>
          <p className="text-sm text-red-600">Out of Stock</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Products by Quantity</h3>
          <div className="space-y-3">
            {analytics?.topProducts?.map((product, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-gray-600">{product.sku}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{(parseFloat(product.totalQuantity) || 0).toFixed(2)} units</p>
                  <p className="text-sm text-gray-600">₹{(parseFloat(product.value) || 0).toFixed(2)}</p>
                </div>
              </div>
            ))}
            {(!analytics?.topProducts || analytics?.topProducts.length === 0) && (
              <p className="text-center text-gray-500 py-4">No products found</p>
            )}
          </div>
        </div>

        {/* Warehouse Stock Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock by Warehouse</h3>
          <div className="space-y-3">
            {analytics?.warehouseStock?.map((wh, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{wh.warehouseName}</p>
                  <p className="text-sm text-gray-600">{wh.totalProducts} products</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{(parseFloat(wh.totalQuantity) || 0).toFixed(2)} units</p>
                  <p className="text-sm text-gray-600">₹{(parseFloat(wh.totalValue) || 0).toFixed(2)}</p>
                </div>
              </div>
            ))}
            {(!analytics?.warehouseStock || analytics?.warehouseStock.length === 0) && (
              <p className="text-center text-gray-500 py-4">No warehouses found</p>
            )}
          </div>
        </div>
      </div>

      {/* Reorder Suggestions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Reorder Suggestions (Low Stock Products)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold">Product</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">SKU</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Warehouse</th>
                <th className="px-4 py-2 text-right text-sm font-semibold">Current Stock</th>
                <th className="px-4 py-2 text-right text-sm font-semibold">Suggested Order</th>
                <th className="px-4 py-2 text-center text-sm font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {analytics?.reorderSuggestions?.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{item.productName}</td>
                  <td className="px-4 py-2 text-gray-600">{item.sku}</td>
                  <td className="px-4 py-2 text-gray-700">{item.warehouseName || 'N/A'}</td>
                  <td className="px-4 py-2 text-right">
                    <span className="text-red-600 font-semibold">
                        {(parseFloat(item.availableQuantity) || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-green-600 font-semibold">
                        {(parseFloat(item.suggestedOrderQuantity) || 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                      LOW STOCK
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!analytics?.reorderSuggestions || analytics?.reorderSuggestions.length === 0) && (
            <p className="text-center text-gray-500 py-8">All products are adequately stocked</p>
          )}
        </div>
      </div>

      {/* Stock by Category (ABC Analysis) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Value by Category (ABC Analysis)</h3>
        <div className="space-y-3">
          {analytics?.stockByCategory?.map((category, idx) => {
            const valuePercent =
              (parseFloat(category.totalValue) / parseFloat(analytics?.totalValue || '1')) * 100;
            const categoryClass =
              valuePercent > 50
                ? 'A'
                : valuePercent > 20
                ? 'B'
                : 'C';
            const colorClass =
              categoryClass === 'A'
                ? 'bg-green-100 text-green-800 border-green-300'
                : categoryClass === 'B'
                ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                : 'bg-gray-100 text-gray-800 border-gray-300';

            return (
              <div key={idx} className={`flex justify-between items-center p-4 border-2 rounded ${colorClass}`}>
                <div>
                  <p className="font-semibold">{category.categoryName}</p>
                    <p className="text-sm">{category.productCount} products • {(parseFloat(category.totalQuantity) || 0).toFixed(2)} units</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">₹{(parseFloat(category.totalValue) || 0).toLocaleString('en-IN')}</p>
                  <p className="text-xs">
                    <span className={`px-2 py-1 rounded font-medium ${colorClass}`}>
                      Class {categoryClass} • {valuePercent.toFixed(1)}%
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
          {(!analytics?.stockByCategory || analytics?.stockByCategory.length === 0) && (
            <p className="text-center text-gray-500 py-4">No category data available</p>
          )}
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Turnover</h3>
          <div className="text-center py-6">
            <div className="text-5xl font-bold text-blue-600">
              {analytics?.turnoverRate?.toFixed(2) || '0.00'}x
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Annual turnover rate
            </p>
            <p className="text-xs text-gray-500 mt-4">
              {(analytics?.turnoverRate || 0) > 6
                ? '✅ Excellent inventory movement'
                : (analytics?.turnoverRate || 0) > 3
                ? '⚠️ Moderate inventory movement'
                : '⛔ Slow inventory movement - Review stocking levels'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Health Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
              <span className="font-medium">Optimal Stock</span>
              <span className="text-xl font-bold text-blue-600">
                {Math.max(0, (analytics?.totalProducts || 0) - (analytics?.lowStockCount || 0) - (analytics?.outOfStockCount || 0))}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
              <span className="font-medium">Low Stock</span>
              <span className="text-xl font-bold text-yellow-600">{analytics?.lowStockCount || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded">
              <span className="font-medium">Out of Stock</span>
              <span className="text-xl font-bold text-red-600">{analytics?.outOfStockCount || 0}</span>
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600 mb-1">Stock Health Score</div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full"
                  style={{
                    width: `${
                      (((analytics?.totalProducts || 0) - (analytics?.lowStockCount || 0) - (analytics?.outOfStockCount || 0)) /
                        (analytics?.totalProducts || 1)) *
                      100
                    }%`,
                  }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {(
                  (((analytics?.totalProducts || 0) - (analytics?.lowStockCount || 0) - (analytics?.outOfStockCount || 0)) /
                    (analytics?.totalProducts || 1)) *
                  100
                ).toFixed(1)}% Healthy
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}