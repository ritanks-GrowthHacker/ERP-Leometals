"use client";
import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, Package, ShoppingCart, RefreshCw } from 'lucide-react';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';
import { useRouter } from 'next/navigation';

interface PendingMO {
  id: string;
  moNumber: string;
  productId: string;
  productName: string;
  productSku: string;
  plannedQuantity: number;
  producedQuantity: number;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
}

interface LowStockProduct {
  id: string;
  name: string;
  sku: string;
  availableQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
}

interface MaterialShortage {
  id: string;
  moNumber: string;
  componentName: string;
  componentSku: string;
  requiredQty: number;
  availableQty: number;
  shortageQty: number;
}

interface MRPData {
  pendingMOs: {
    data: PendingMO[];
    total: number;
    page: number;
    limit: number;
  };
  lowStockProducts: {
    data: LowStockProduct[];
    total: number;
    page: number;
    limit: number;
  };
  materialShortages: {
    data: MaterialShortage[];
    total: number;
    page: number;
    limit: number;
  };
}

export default function MRPPage() {
  const { showAlert } = useAlert();
  const router = useRouter();
  const [mrpData, setMrpData] = useState<MRPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchMRPData();
  }, [page]);

  const fetchMRPData = async () => {
    const token = getAuthToken();
    try {
      setLoading(true);
      const res = await fetch(`/api/erp/manufacturing/mrp?page=${page}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch MRP data');
      const data = await res.json();
      setMrpData(data);
    } catch (error) {
      console.error('Error fetching MRP data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePO = async (product: LowStockProduct) => {
    const token = getAuthToken();
    if (!token) {
      showAlert({ type: 'error', title: 'Error', message: 'No authentication token found' });
      return;
    }

    try {
      const poNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      const response = await fetch('/api/erp/purchasing/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          poNumber,
          supplierId: null, // No supplier initially
          orderDate: new Date().toISOString().split('T')[0],
          expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'draft',
          notes: `Auto-created from MRP for low stock product: ${product.name}`,
          lines: [{
            productId: product.id,
            quantity: product.reorderQuantity,
            unitPrice: 0,
          }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        showAlert({ 
          type: 'success', 
          title: 'PO Created', 
          message: `Purchase Order ${poNumber} created. You can add supplier details later.` 
        });
        // Redirect to PO page or refresh
        router.push('/erp/purchasing/orders');
      } else {
        const error = await response.json();
        showAlert({ type: 'error', title: 'Error', message: `Failed to create PO: ${error.error || 'Unknown error'}` });
      }
    } catch (error) {
      console.error('Error creating PO:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create Purchase Order' });
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      done: 'bg-green-100 text-green-800',
      draft: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading MRP analysis...</p>
        </div>
      </div>
    );
  }

  if (!mrpData) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="text-center py-12">
          <p className="text-gray-600">Failed to load MRP data</p>
          <button
            onClick={fetchMRPData}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Material Requirements Planning</h2>
          <p className="text-sm text-gray-500 mt-1">Production planning and material shortage analysis</p>
        </div>
        <button
          onClick={fetchMRPData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
        >
          <RefreshCw size={18} />
          Refresh Analysis
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-5 h-5 text-blue-600" />
            <div className="text-sm font-medium text-gray-600">Pending Orders</div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{mrpData.pendingMOs.total}</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <div className="text-sm font-medium text-gray-600">Low Stock</div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{mrpData.lowStockProducts.total}</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingCart className="w-5 h-5 text-red-600" />
            <div className="text-sm font-medium text-gray-600">Material Shortages</div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{mrpData.materialShortages.total}</div>
        </div>
      </div>

      {/* Material Shortages Table */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900">Material Shortages (Max 10)</h3>
          <div className="text-sm text-gray-600">
            Showing {mrpData.materialShortages.data.length} items
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MO Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Component</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shortage</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mrpData.materialShortages.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    ✅ No material shortages found
                  </td>
                </tr>
              ) : (
                mrpData.materialShortages.data.map((shortage) => (
                  <tr key={shortage.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {shortage.moNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shortage.componentName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{shortage.componentSku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shortage.requiredQty}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shortage.availableQty}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        -{shortage.shortageQty}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Manufacturing Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900">Pending Manufacturing Orders (Max 10)</h3>
          <div className="text-sm text-gray-600">
            Showing {mrpData.pendingMOs.data.length} items
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MO Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Planned Qty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produced Qty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled Start</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mrpData.pendingMOs.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No pending manufacturing orders
                  </td>
                </tr>
              ) : (
                mrpData.pendingMOs.data.map((mo) => (
                  <tr key={mo.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{mo.moNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{mo.productName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{mo.productSku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{mo.plannedQuantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{mo.producedQuantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(mo.scheduledStart).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(mo.status)}`}>
                        {mo.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low Stock Products Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900">Low Stock Products (Max 10)</h3>
          <div className="text-sm text-gray-600">
            Showing {mrpData.lowStockProducts.data.length} items
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reorder Qty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mrpData.lowStockProducts.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    ✅ All products are adequately stocked
                  </td>
                </tr>
              ) : (
                mrpData.lowStockProducts.data.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        {product.availableQuantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.reorderPoint}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.reorderQuantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button 
                        onClick={() => handleCreatePO(product)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold"
                      >
                        Create PO
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}