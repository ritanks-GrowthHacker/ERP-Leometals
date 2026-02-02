'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/utils/token';
import { Package, TrendingDown, DollarSign, Boxes } from 'lucide-react';

interface DashboardData {
  total_products: number;
  total_stock: number;
  total_value: number;
  low_stock_count: number;
  recent_movements: Array<{
    id: string;
    movement_type: string;
    quantity: number;
    product_name: string;
    movement_date: string;
  }>;
  low_stock_products: Array<{
    id: string;
    name: string;
    sku: string;
    quantity: number;
    reorder_point: number;
  }>;
}

export default function WarehouseManagerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboard = async () => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch('/api/warehouse-manager/inventory/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const dashboardData = await response.json();
        console.log('Dashboard data:', dashboardData);
        setData(dashboardData);
      } else if (response.status === 403) {
        router.push('/login');
      } else {
        console.error('Dashboard fetch error:', response.status);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Warehouse Dashboard</h1>
        <p className="text-gray-600 mt-2">Overview of your warehouse operations</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Products</p>
              <p className="text-3xl font-bold mt-2">{data.total_products ?? 0}</p>
            </div>
            <Package className="h-12 w-12 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Stock</p>
              <p className="text-3xl font-bold mt-2">
                {(data.total_stock ?? 0).toLocaleString()}
              </p>
            </div>
            <Boxes className="h-12 w-12 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-3xl font-bold mt-2">
                ₹{(data.total_value ?? 0).toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-12 w-12 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock Items</p>
              <p className="text-3xl font-bold mt-2 text-red-600">
                {data.low_stock_count ?? 0}
              </p>
            </div>
            <TrendingDown className="h-12 w-12 text-red-600" />
          </div>
        </div>
      </div>

      {/* Recent Movements */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Recent Movements</h2>
        </div>
        <div className="p-6">
          {!data.recent_movements || data.recent_movements.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No recent movements</p>
          ) : (
            <div className="space-y-4">
              {data.recent_movements.map((movement) => (
                <div key={movement.id} className="flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="font-medium">{movement.product_name}</p>
                    <p className="text-sm text-gray-600">{movement.movement_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{movement.quantity} units</p>
                    <p className="text-sm text-gray-600">
                      {new Date(movement.movement_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Products */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Low Stock Alert</h2>
        </div>
        <div className="p-6">
          {!data.low_stock_products || data.low_stock_products.length === 0 ? (
            <p className="text-gray-500 text-center py-4">All products are adequately stocked</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Product</th>
                    <th className="text-left py-2">SKU</th>
                    <th className="text-right py-2">Current Stock</th>
                    <th className="text-right py-2">Min value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.low_stock_products.map((product, index) => (
                    <tr key={`${product.id}-${index}`} className="border-b">
                      <td className="py-2">{product.name}</td>
                      <td className="py-2 text-gray-600">{product.sku}</td>
                      <td className="py-2 text-right text-red-600 font-medium">
                        {product.quantity}
                      </td>
                      <td className="py-2 text-right">{product.reorder_point}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}